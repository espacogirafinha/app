import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import pg from "pg";
import { buildPlan, createPreviewSql } from "./girafinha-inventory-preview.mjs";

test("PostgreSQL efémero: migração, importação inicial, repetição e movimentos", async () => {
  if (!process.env.PGTEST_URL || !process.env.PGTEST_URL.includes("localhost:5432/girafinha_inventory_preview"))
    throw new Error("Recusa de ligação: PGTEST_URL deve apontar ao PostgreSQL efémero local");
  const client = new pg.Client({ connectionString: process.env.PGTEST_URL });
  await client.connect();
  try {
    await client.query(`
      CREATE SCHEMA IF NOT EXISTS public;
      CREATE TABLE public.inventory_items (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        item_type text NOT NULL,
        name text NOT NULL,
        category text NOT NULL,
        quantity_current numeric(12,3) NOT NULL DEFAULT 0,
        unit text NOT NULL,
        color text, theme text, notes text,
        is_active boolean NOT NULL DEFAULT TRUE,
        CONSTRAINT inv_nonnegative CHECK(quantity_current >= 0)
      );
      CREATE TABLE public.inventory_movements (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        item_id uuid NOT NULL REFERENCES public.inventory_items(id),
        movement_type text NOT NULL,
        quantity_delta numeric(12,3) NOT NULL,
        quantity_before numeric(12,3) NOT NULL,
        quantity_after numeric(12,3) NOT NULL,
        reason text,
        CONSTRAINT balance_consistent CHECK(quantity_after = quantity_before + quantity_delta)
      );
    `);
    const migration=readFileSync("supabase/migrations/20261021160000_inventory_catalog_code_unique_preview.sql","utf8");
    await client.query(migration);
    const item = (code, qty=1) => ({
      catalogCode:code, name:code+" · Peça da Girafinha",
      itemType:"material", category:"Painéis", unit:"un",
      quantity:qty, color:"Rosa pastel", theme:"Teste", notes:"Foto só referência",
      ownership:"Próprio", validation:"Confirmado", referencePhoto:"foto.jpg"
    });
    const manifest={
      schemaVersion:"girafinha-inventory-staging-v1",productionWriteApproved:false,
      records:{
        pronto_para_revisao:[item("P01"),item("D38-A",2)],
        pendente:[{...item("SH01"),quantity:null,validation:"Quantidade desconhecida"}],
        emprestimo:[{...item("TP03"),ownership:"Empréstimo"}]
      }
    };
    const plan=buildPlan(manifest);
    const sql=createPreviewSql(plan);
    await assert.rejects(client.query(sql),/isolated database acknowledgement required/);
    await client.query("ROLLBACK");
    await client.query("SET app.girafinha_import_target = 'isolated'");
    await client.query(sql);
    let a=await client.query("SELECT name,quantity_current FROM public.inventory_items ORDER BY name");
    let b=await client.query("SELECT item_id,quantity_delta,quantity_before,quantity_after FROM public.inventory_movements ORDER BY item_id");
    assert.equal(a.rowCount,2);
    assert.equal(b.rowCount,2);
    assert.deepEqual(a.rows.map(r=>Number(r.quantity_current)),[2,1]); // D38-A precedes P01
    assert.ok(b.rows.every(r=>Number(r.quantity_before)===0 && Number(r.quantity_delta)===Number(r.quantity_after)));
    await client.query(sql);
    a=await client.query("SELECT * FROM public.inventory_items");
    b=await client.query("SELECT * FROM public.inventory_movements");
    assert.equal(a.rowCount,2,"Reimportação não altera a quantidade de artigos");
    assert.equal(b.rowCount,2,"Reimportação não cria movimentos duplicados");
    await assert.rejects(
      client.query("INSERT INTO public.inventory_items (item_type,name,category,quantity_current,unit) VALUES ('material','P01 · Outro nome','Painéis',1,'un')"),
      e=>e.code==="23505"
    );
    await client.query("ROLLBACK");
  } finally {
    await client.end();
  }
});
