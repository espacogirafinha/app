#!/usr/bin/env node
/**
 * Girafinha: generate an inventory import plan and PREVIEW-ONLY SQL.
 * No network calls, Supabase credentials, database clients, or automatic writes.
 *
 * node scripts/src/girafinha-inventory-preview.mjs manifest.json \
 *   --existing existing-items.json --photos-dir extracted/Fotos --out /tmp/girafinha-preview.sql
 *
 * The SQL is NOT executed here and MUST NOT be run against Production.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const ALLOWED_CATEGORIES = new Set([
  "Pratos decorativos", "Mesas", "Painéis", "Capas de painéis",
  "Cilindros", "Capas de cilindros", "Displays / temas",
  "Jarras / vasos", "Flores", "Números LED", "Estruturas / suportes",
  "Tecidos", "Outros",
]);
export const ALLOWED_UNITS = new Set(["un", "conjunto"]);
const CODE = /^[A-Z]{1,4}[0-9]{2}(?:-[A-Z0-9]+)?$/;
const PREFIX = /^([A-Z]{1,4}[0-9]{2}(?:-[A-Z0-9]+)?)\s*·\s*/;
const IMAGE_LIMIT = 5 * 1024 * 1024;

export function itemCode(item) {
  return String(item?.catalogCode ?? "").trim();
}
export function extractCode(name) {
  return String(name ?? "").match(PREFIX)?.[1] ?? null;
}
function requireSafeText(value, label, max=5000) {
  if (value != null && (typeof value !== "string" || value.length > max || value.includes("\u0000")))
    throw new Error("Campo inválido: " + label);
}
function validImageFiles(item, files) {
  if (!item.referencePhoto) return;
  const name = item.referencePhoto;
  if (!/^[A-Za-z0-9()_-]+\.jpg$/.test(name))
    throw new Error("Nome de foto inseguro: " + name);
  if (files && !files.has(name))
    throw new Error("Fotografia ausente: " + name + " (" + item.catalogCode + ")");
}
export function buildPlan(manifest, existing=[], files=null) {
  if (manifest?.schemaVersion !== "girafinha-inventory-staging-v1" ||
      manifest.productionWriteApproved !== false)
    throw new Error("Manifesto inválido ou sem bloqueio de produção");
  if (!Array.isArray(existing)) throw new Error("Snapshot existente inválido");
  const groups = manifest.records;
  const keys = ["pronto_para_revisao","pendente","emprestimo"];
  if (!groups || keys.some(k => !Array.isArray(groups[k])))
    throw new Error("Grupos obrigatórios ausentes");
  const seen = new Set();
  for (const [group, entries] of keys.map(k => [k, groups[k]])) {
    for (const item of entries) {
      const code = itemCode(item);
      if (!CODE.test(code)) throw new Error("Código inválido: " + code);
      if (seen.has(code)) throw new Error("Código repetido: " + code);
      seen.add(code);
      if (extractCode(item.name) !== code)
        throw new Error("Nome sem código consistente: " + code);
      for (const field of ["name","color","theme","notes","referencePhoto"]) 
        requireSafeText(item[field], code + "." + field);
      validImageFiles(item, files);
      if (group === "pronto_para_revisao") {
        if (item.itemType !== "material" || item.ownership !== "Próprio" ||
            !Number.isSafeInteger(item.quantity) || item.quantity <= 0 ||
            !ALLOWED_CATEGORIES.has(item.category) ||
            !ALLOWED_UNITS.has(item.unit) ||
            String(item.validation).startsWith("A validar"))
          throw new Error("Item não elegível no lote próprio: " + code);
      } else if (group === "emprestimo" && item.ownership !== "Empréstimo") {
        throw new Error("Empréstimo mal classificado: " + code);
      }
    }
  }
  const known = new Set();
  for (const item of existing) {
    const code = item.catalogCode ?? extractCode(item.name);
    if (!code) continue;
    if (known.has(code)) throw new Error("Duplicado já presente na BD: " + code);
    known.add(code);
  }
  return {
    total: seen.size, excludedPending: groups.pendente.map(itemCode),
    excludedBorrowed: groups.emprestimo.map(itemCode),
    toInsert: groups.pronto_para_revisao.filter(item => !known.has(item.catalogCode)),
    alreadyExisting: groups.pronto_para_revisao.filter(item => known.has(item.catalogCode)).map(itemCode),
    photoReferencesChecked: files !== null,
    uniqueCodes: seen.size,
  };
}
export function sqlString(v) {
  if (v == null || v === "") return "NULL";
  if (typeof v !== "string" || v.includes("\u0000")) throw new Error("SQL: texto inválido");
  return "'" + v.replaceAll("'", "''") + "'";
}
/**
 * A unique index on the extracted catalogue prefix is a PRECONDITION.
 * Every insert and its initial movement are done in one transaction.
 * No updates to existing articles or movements are generated.
 */
export function createPreviewSql(plan) {
  const lines = [
    "-- GIRAFINHA / ISOLATED-DB ONLY. NEVER APPLY TO PRODUCTION.",
    "-- Prepare a disposable database, run migration 20261021160000,",
    "-- then explicitly set the session variable BEFORE executing this file:",
    "-- SET app.girafinha_import_target = 'isolated';",
    "BEGIN;",
    `DO $guard$ BEGIN
      IF current_setting('app.girafinha_import_target', true) IS DISTINCT FROM 'isolated'
      THEN RAISE EXCEPTION 'Inventory import blocked: isolated database acknowledgement required';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_indexes
          WHERE schemaname='public' AND indexname='inventory_items_catalog_code_unique_idx')
      THEN RAISE EXCEPTION 'Inventory import blocked: unique catalogue index absent';
      END IF;
    END $guard$;`,
  ];
  for (const item of plan.toInsert) {
    const columns=["item_type","name","category","quantity_current","unit","color","theme","notes","is_active"];
    const values=[
      sqlString("material"),sqlString(item.name),sqlString(item.category),
      String(item.quantity),sqlString(item.unit),sqlString(item.color),
      sqlString(item.theme),sqlString(item.notes), "TRUE"
    ];
    lines.push(`-- ${item.catalogCode}
WITH newly_inserted AS (
  INSERT INTO public.inventory_items (${columns.join(", ")})
  VALUES (${values.join(", ")})
  ON CONFLICT DO NOTHING
  RETURNING id, quantity_current
)
INSERT INTO public.inventory_movements
  (item_id, movement_type, quantity_delta, quantity_before, quantity_after, reason)
SELECT id, 'adjustment', quantity_current, 0, quantity_current, 'Stock inicial · catálogo Girafinha'
FROM newly_inserted;`);
  }
  lines.push("COMMIT;", "");
  return lines.join("\n");
}
export function collectPhotos(dir) {
  if (!dir) return null;
  const files = new Set();
  for (const name of readdirSync(dir)) {
    const full=join(dir,name);
    if (!statSync(full).isFile()) continue;
    if (!/^[A-Za-z0-9()_-]+\.jpg$/.test(name)) throw new Error("Nome de ficheiro inválido: " + name);
    if (statSync(full).size > IMAGE_LIMIT || statSync(full).size < 10)
      throw new Error("Fotografia fora dos limites: " + name);
    const sig=readFileSync(full).subarray(0,3);
    if (!(sig[0]===0xff && sig[1]===0xd8 && sig[2]===0xff))
      throw new Error("Formato JPEG inválido: " + name);
    files.add(name);
  }
  return files;
}
function argvValue(args,flag) {
  const index=args.indexOf(flag);
  return index<0?null:args[index+1];
}
export function runCli(args) {
  if (!args[0] || args.includes("--apply") || args.includes("--production") ||
      args.some(a=>!a || /^--(?!out$|photos-dir$|existing$)/.test(a)))
    throw new Error("Apenas preparação local. Uso: manifesto.json [--existing json] [--photos-dir Fotos] [--out preview.sql]. Não existe --apply.");
  const manifest=JSON.parse(readFileSync(args[0],"utf8"));
  const existingPath=argvValue(args,"--existing");
  const existing=existingPath?JSON.parse(readFileSync(existingPath,"utf8")):[];
  const files=collectPhotos(argvValue(args,"--photos-dir"));
  const plan=buildPlan(manifest,existing,files);
  const output=argvValue(args,"--out");
  if (output) writeFileSync(output,createPreviewSql(plan),"utf8");
  console.log(JSON.stringify({
    status:"PREVIEW SQL ONLY; no database connection; no changes",
    proposed:plan.toInsert.length,
    duplicatesSkipped:plan.alreadyExisting.length,
    pendingExcluded:plan.excludedPending.length,
    borrowedExcluded:plan.excludedBorrowed.length,
    photosChecked:plan.photoReferencesChecked,
    sqlGenerated:Boolean(output)
  },null,2));
  return plan;
}
if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  try { runCli(process.argv.slice(2)); }
  catch (err) { console.error("ERRO:",err.message); process.exitCode=1; }
}
