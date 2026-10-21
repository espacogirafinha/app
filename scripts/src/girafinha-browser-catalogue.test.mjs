import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DEMO_ITEMS,
  parseCatalogueJson,
} from "../../artifacts/girafinha/src/lib/catalog-preview.ts";

const row = (code, overrides={}) => ({
  catalogCode: code,
  name: code + " · Item decoração",
  category: "Painéis",
  unit: "un",
  quantity: 1,
  color: "Verde-água",
  theme: "Teste",
  ownership: "Próprio",
  referencePhoto: "festa.jpg",
  notes: "Referência local",
  validation: "Confirmado",
  ...overrides,
});
const fixture=()=>({
  schemaVersion:"girafinha-inventory-staging-v1",
  productionWriteApproved:false,
  records:{
    pronto_para_revisao:[row("P01"),row("CC02",{quantity:2})],
    pendente:[row("SH01",{quantity:null,validation:"Quantidade desconhecida"})],
    emprestimo:[row("TP03",{ownership:"Empréstimo"})],
  }
});
test("pré-visualização tem seis exemplos seguros com códigos",()=>{
  assert.equal(DEMO_ITEMS.length,6);
  assert.ok(DEMO_ITEMS.every(x=>x.name.startsWith(x.catalogCode+" · ")));
});
test("parse dá todas as fichas e estados sem excluir emprestados",()=>{
  const rows=parseCatalogueJson(JSON.stringify(fixture()));
  assert.equal(rows.length,4);
  assert.deepEqual(rows.map(x=>x.status),["proposto","proposto","pendente","emprestado"]);
  assert.equal(rows.find(x=>x.catalogCode==="CC02").quantity,2);
  assert.equal(rows.find(x=>x.catalogCode==="SH01").quantity,null);
});
test("rejeita manifesto com permissão de escrita em produção",()=>{
  const m=fixture();m.productionWriteApproved=true;
  assert.throws(()=>parseCatalogueJson(JSON.stringify(m)),/não é o manifesto/);
});
test("rejeita códigos duplicados entre grupos",()=>{
  const m=fixture();m.records.emprestimo[0].catalogCode="P01";m.records.emprestimo[0].name="P01 · Outra peça";
  assert.throws(()=>parseCatalogueJson(JSON.stringify(m)),/códigos repetidos/);
});
test("rejeita nomes cujo prefixo não coincide",()=>{
  const m=fixture();m.records.pronto_para_revisao[0].name="CC02 · Confusão";
  assert.throws(()=>parseCatalogueJson(JSON.stringify(m)),/inconsistentes/);
});
test("impede que empréstimos sejam apresentados como próprios",()=>{
  const m=fixture();m.records.pronto_para_revisao[0].ownership="Empréstimo";
  assert.throws(()=>parseCatalogueJson(JSON.stringify(m)),/propriedade inválida/);
});
test("quantidades próprias devem ser inteiros positivos",()=>{
  for(const q of [0,-1,null,1.2,"2"]){
    const m=fixture();m.records.pronto_para_revisao[0].quantity=q;
    assert.throws(()=>parseCatalogueJson(JSON.stringify(m)),/Quantidade/);
  }
});
test("caminhos fotográficos suspeitos são rejeitados",()=>{
  const m=fixture();m.records.pronto_para_revisao[0].referencePhoto="../segredos.jpg";
  assert.throws(()=>parseCatalogueJson(JSON.stringify(m)),/fotografia inválido/);
});
test("não utiliza Supabase, fetch, nem upload automático de fotografias",()=>{
  const source=readFileSync("artifacts/girafinha/src/pages/catalog-preview.tsx","utf8");
  const module=readFileSync("artifacts/girafinha/src/lib/catalog-preview.ts","utf8");
  assert.doesNotMatch(source,/useListInventoryItems|useCreateInventoryItem|supabase|fetch\s*\(/i);
  assert.doesNotMatch(module,/supabase|fetch\s*\(/i);
  assert.match(source,/URL\.createObjectURL/);
});
