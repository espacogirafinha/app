import test from "node:test";
import assert from "node:assert/strict";
import {
  catalogueImportEnabled,
  validateCatalogueImport,
} from "../../artifacts/api-server/src/lib/catalog-batch.ts";
import { readFileSync } from "node:fs";

const owned = (code, overrides={}) => ({
  catalogCode: code,
  name: code + " · Peça física",
  itemType: "material",
  ownership: "Próprio",
  validation: "Confirmado",
  category: "Painéis",
  quantity: 1,
  unit: "un",
  color: "Rosa",
  theme: "Teste",
  notes: "Peça de decoração",
  ...overrides,
});
const payload = (items=[owned("P01"), owned("CC02",{quantity:2,category:"Capas de cilindros"})]) => ({
  schemaVersion: "girafinha-inventory-staging-v1",
  productionWriteApproved: false,
  confirmation: "IMPORTAR MATERIAIS",
  items,
});

test("conserva códigos, cores e quantidades, incluindo duas capas azul-bebé", () => {
  const p = payload([owned("CC02",{quantity:2,color:"Azul-bebé pastel",category:"Capas de cilindros"})]);
  const result=validateCatalogueImport(p);
  assert.equal(result.length,1);
  assert.equal(result[0].catalogCode,"CC02");
  assert.equal(result[0].quantity,2);
  assert.equal(result[0].color,"Azul-bebé pastel");
});
test("recusa códigos repetidos e nomes com prefixo errado", () => {
  assert.throws(()=>validateCatalogueImport(payload([owned("P01"),owned("P01")])),/Código repetido/);
  assert.throws(()=>validateCatalogueImport(payload([owned("P01",{name:"P09 · Errado"})])),/Código repetido ou incompatível/);
});
test("recusa empréstimos e artigos por confirmar", () => {
  assert.throws(()=>validateCatalogueImport(payload([owned("TP03",{ownership:"Empréstimo"})])),/Material sem confirmação/);
  assert.throws(()=>validateCatalogueImport(payload([owned("D79",{validation:"A validar"})])),/Material sem confirmação/);
});
test("recusa quantidades erradas e textos inseguros", () => {
  for(const quantity of [null,0,-1,1.1,"2",2000]) {
    assert.throws(()=>validateCatalogueImport(payload([owned("P01",{quantity})])),/Material sem confirmação/);
  }
  assert.throws(()=>validateCatalogueImport(payload([owned("P01",{notes:"ab\0cd"})])),/Campo textual inválido/);
});
test("recusa pedido não identificado ou lista vazia", () => {
  assert.throws(()=>validateCatalogueImport({}),/Manifesto ou lote/);
  assert.throws(()=>validateCatalogueImport(payload([])),/Manifesto ou lote/);
  assert.throws(()=>validateCatalogueImport(payload(Array.from({length:251},(_,i)=>owned("P01")))),/Manifesto ou lote/);
});
test("tranca qualquer Preview, development e owner não autorizado", () => {
  const env={
    VERCEL_ENV:"preview",
    GIRAFINHA_CATALOG_IMPORT_ENABLED:"owner-approved-one-time-import",
    GIRAFINHA_CATALOG_IMPORT_OWNER_EMAIL:"owner@example.com",
  };
  assert.equal(catalogueImportEnabled(env,"owner@example.com"),false);
  assert.equal(catalogueImportEnabled({...env,VERCEL_ENV:"development"},"owner@example.com"),false);
  assert.equal(catalogueImportEnabled({...env,VERCEL_ENV:"production"},"other@example.com"),false);
  assert.equal(catalogueImportEnabled({...env,VERCEL_ENV:"production",GIRAFINHA_CATALOG_IMPORT_ENABLED:""},"owner@example.com"),false);
  assert.equal(catalogueImportEnabled({...env,VERCEL_ENV:"production"},"owner@example.com"),true);
});
test("endpoint faz validação de environment antes de tocar na BD", () => {
  const source=readFileSync("artifacts/api-server/src/routes/inventory.ts","utf8");
  const section=source.split('router.post("/inventory/catalog/import"')[1];
  assert.ok(section,"Rota de importação existe");
  assert.ok(section.indexOf("catalogueImportEnabled") < section.indexOf("db.execute"));
  assert.match(section,/onConflictDoNothing\(\)/);
  assert.match(section,/db\.transaction/);
  assert.match(section,/inventoryMovementsTable/);
  assert.match(section,/inventory_items_catalog_code_unique_idx/);
});
