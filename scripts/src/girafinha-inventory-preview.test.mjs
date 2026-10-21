import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPlan, createPreviewSql, extractCode, sqlString, collectPhotos,
} from "./girafinha-inventory-preview.mjs";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const row=(code,extras={})=>({
  catalogCode:code, itemType:"material", name:code+" · Painel arquedo",
  category:"Painéis", quantity:1, unit:"un", color:"Rosa-pastel",
  theme:"Teste", notes:"Material de decoração", ownership:"Próprio",
  referencePhoto:"festa.jpg", validation:"Confirmado", ...extras,
});
const fixture=()=>({
  schemaVersion:"girafinha-inventory-staging-v1",
  productionWriteApproved:false,
  records:{
    pronto_para_revisao:[row("P01"),row("CC02",{quantity:2,category:"Capas de cilindros"})],
    pendente:[row("SH01",{quantity:null,validation:"Quantidade desconhecida"})],
    emprestimo:[row("TP03",{ownership:"Empréstimo",category:"Tecidos"})],
  }
});
test("conta peças próprias, exclui empréstimo e pendentes, verifica fotografias",()=>{
  const plan=buildPlan(fixture(),[],new Set(["festa.jpg"]));
  assert.equal(plan.total,4);
  assert.equal(plan.toInsert.length,2);
  assert.deepEqual(plan.excludedBorrowed,["TP03"]);
  assert.deepEqual(plan.excludedPending,["SH01"]);
  assert.equal(plan.photoReferencesChecked,true);
});
test("reexecução: artigos existentes são saltados sem alteração ao stock",()=>{
  const first=buildPlan(fixture());
  const second=buildPlan(fixture(),first.toInsert.map(({name})=>({name})));
  assert.deepEqual(second.alreadyExisting,["P01","CC02"]);
  assert.equal(second.toInsert.length,0);
  assert.equal(createPreviewSql(second).includes("INSERT INTO public.inventory_items"),false);
});
test("código duplicado no catálogo é bloqueado",()=>{
  const f=fixture();f.records.pendente.push(row("P01"));
  assert.throws(()=>buildPlan(f),/Código repetido/);
});
test("código duplicado no snapshot existente bloqueia a importação",()=>{
  assert.throws(()=>buildPlan(fixture(),[{name:"P01 · Um"},{name:"P01 · Dois"}]),/Duplicado já presente/);
});
test("empréstimos não entram no lote próprio",()=>{
  const f=fixture();f.records.pronto_para_revisao[0].ownership="Empréstimo";
  assert.throws(()=>buildPlan(f),/não elegível/);
});
test("quantidades incertas, zero e negativas não são aceites",()=>{
  for(const quantity of [null,0,-1,1.5,"1"]){
    const f=fixture(); f.records.pronto_para_revisao[0].quantity=quantity;
    assert.throws(()=>buildPlan(f),/não elegível/);
  }
});
test("fotos não localizadas e caminhos inseguros geram erro",()=>{
  assert.throws(()=>buildPlan(fixture(),[],new Set()),/Fotografia ausente/);
  const f=fixture();f.records.pronto_para_revisao[0].referencePhoto="../prod.jpg";
  assert.throws(()=>buildPlan(f),/inseguro/);
});
test("JPEG real é identificado por assinatura; falso JPEG bloqueado",()=>{
  const dir=mkdtempSync(join(tmpdir(),"girafinha-images-"));
  try{
    writeFileSync(join(dir,"festa.jpg"),Buffer.concat([Buffer.from([255,216,255]),Buffer.alloc(40)]));
    assert.deepEqual([...collectPhotos(dir)],["festa.jpg"]);
    writeFileSync(join(dir,"festa.jpg"),Buffer.alloc(40));
    assert.throws(()=>collectPhotos(dir),/JPEG inválido/);
  }finally {rmSync(dir,{recursive:true,force:true});}
});
test("SQL é transacional, idempotente e guarda movimento inicial",()=>{
  const sql=createPreviewSql(buildPlan(fixture()));
  assert.match(sql,/^-- GIRAFINHA \/ ISOLATED-DB ONLY/);
  assert.match(sql,/^BEGIN;/m);
  assert.match(sql,/ON CONFLICT DO NOTHING/g);
  assert.equal((sql.match(/ON CONFLICT DO NOTHING/g)||[]).length,2);
  assert.match(sql,/inventory_movements/);
  assert.match(sql,/Stock inicial/);
  assert.match(sql,/COMMIT;/);
  assert.doesNotMatch(sql,/TP03 ·/);
  assert.doesNotMatch(sql,/SH01 ·/);
  assert.match(sql,/current_setting\('app\.girafinha_import_target'/);
});
test("aspas em nomes e notas são escapadas em SQL",()=>{
  assert.equal(sqlString("D'Silva"),"'D''Silva'");
  const f=fixture(); f.records.pronto_para_revisao[0].notes="O'Brien";
  assert.match(createPreviewSql(buildPlan(f)),/O''Brien/);
});
test("não aceita manifesto que autorize escrita em produção",()=>{
  const f=fixture();f.productionWriteApproved=true;
  assert.throws(()=>buildPlan(f),/bloqueio de produção/);
});
test("extrai o código do nome, incluindo sufixo de peças individuais",()=>{
  assert.equal(extractCode("D38-A · Silhueta"),"D38-A");
  assert.equal(extractCode("P01 · Painel"),"P01");
  assert.equal(extractCode("Painel genérico"),null);
});
