#!/usr/bin/env node
/**
 * Espaço Girafinha — inventory catalogue preflight (READ-ONLY).
 * Usage:
 *   node scripts/src/preflight-girafinha-catalog.mjs /path/to/Girafinha_Integracao_Manifesto_REVER.json
 *   node scripts/src/preflight-girafinha-catalog.mjs /path/to/manifest.json /path/to/existing-items.json
 *
 * This tool NEVER connects to the database or writes to an API.
 * It validates a proposed import and optionally compares it against an exported
 * JSON array of existing inventory_items, to detect duplicates by catalogue code.
 */
import { readFileSync } from "node:fs";

const ALLOWED_CATEGORIES = new Set([
  "Bebidas", "Snacks", "Doces", "Frescos", "Café / apoio", "Descartáveis",
  "Outros", "Pratos decorativos", "Mesas", "Painéis", "Capas de painéis",
  "Cilindros", "Capas de cilindros", "Displays / temas", "Jarras / vasos",
  "Flores", "Números LED", "Estruturas / suportes", "Tecidos",
]);
const ALLOWED_UNITS = new Set([
  "un", "pacote", "caixa", "garrafa", "lata", "kg", "g", "L", "ml", "conjunto", "outro",
]);
const CODE_PATTERN = /^[A-Z]{1,4}[0-9]{2}(?:-[A-Z0-9]+)?$/;
const PREFIX_PATTERN = /^([A-Z]{1,4}[0-9]{2}(?:-[A-Z0-9]+)?)\s*·\s*/;

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}
function codeInName(name) {
  return String(name ?? "").match(PREFIX_PATTERN)?.[1] ?? null;
}
function fail(message) {
  console.error("ERRO:", message);
  process.exitCode = 1;
}

const manifestPath = process.argv[2];
const existingPath = process.argv[3];

if (!manifestPath || process.argv.some((arg) => arg === "--apply" || arg === "--write")) {
  console.error("Uso: node scripts/src/preflight-girafinha-catalog.mjs manifesto.json [existing-items.json]");
  console.error("Este script é APENAS uma validação de leitura: não possui modo de escrita.");
  process.exit(2);
}

const manifest = readJson(manifestPath);
const groups = manifest.records ?? {};
const proposed = groups.pronto_para_revisao ?? [];
const pending = groups.pendente ?? [];
const borrowed = groups.emprestimo ?? [];
const existing = existingPath ? readJson(existingPath) : [];
const errors = [];

if (manifest.schemaVersion !== "girafinha-inventory-staging-v1") {
  errors.push("Versão de manifesto desconhecida");
}
if (manifest.productionWriteApproved !== false) {
  errors.push("O manifesto deve marcar productionWriteApproved=false");
}
if (!Array.isArray(proposed) || !Array.isArray(pending) ||
    !Array.isArray(borrowed) || !Array.isArray(existing)) {
  errors.push("Grupos ou inventário atual não são listas válidas");
}

const all = [...proposed, ...pending, ...borrowed];
const seen = new Set();
for (const item of all) {
  const code = item.catalogCode;
  if (typeof code !== "string" || !CODE_PATTERN.test(code)) {
    errors.push(`Código inválido: ${String(code)}`);
    continue;
  }
  if (seen.has(code)) errors.push(`Código duplicado no manifesto: ${code}`);
  seen.add(code);
  if (codeInName(item.name) !== code) errors.push(`Nome sem prefixo estável: ${code}`);
}
for (const item of proposed) {
  if (item.itemType !== "material") errors.push(`Tipo inválido: ${item.catalogCode}`);
  if (item.ownership !== "Próprio") errors.push(`Empréstimo no lote próprio: ${item.catalogCode}`);
  if (String(item.validation).startsWith("A validar")) errors.push(`Registo não confirmado: ${item.catalogCode}`);
  if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
    errors.push(`Quantidade inválida: ${item.catalogCode}`);
  }
  if (!ALLOWED_CATEGORIES.has(item.category)) {
    errors.push(`Categoria não suportada na app: ${item.catalogCode} / ${item.category}`);
  }
  if (!ALLOWED_UNITS.has(item.unit)) errors.push(`Unidade inválida: ${item.catalogCode}`);
}
for (const item of borrowed) {
  if (item.ownership !== "Empréstimo") errors.push(`Empréstimo mal classificado: ${item.catalogCode}`);
}

const existingCodes = new Map();
for (const item of existing) {
  const code = codeInName(item.name);
  if (!code) continue;
  existingCodes.set(code, (existingCodes.get(code) ?? 0) + 1);
}
for (const [code, n] of existingCodes) {
  if (n > 1) errors.push(`Código já duplicado no inventário existente: ${code} (${n} itens)`);
}

const toCreate = proposed.filter((item) => !existingCodes.has(item.catalogCode));
const toSkip = proposed.filter((item) => existingCodes.has(item.catalogCode));
console.log(JSON.stringify({
  mode: "READ_ONLY_DRY_RUN",
  source: manifestPath,
  existingDataProvided: Boolean(existingPath),
  catalogueRecords: all.length,
  proposed: proposed.length,
  pending: pending.length,
  borrowed: borrowed.length,
  alreadyPresent: toSkip.map(({ catalogCode }) => catalogCode),
  toCreate: toCreate.map(({ catalogCode }) => catalogCode),
  errors,
  note: "Sem snapshot do inventário existente, não se garante ausência de duplicados na BD.",
}, null, 2));

if (errors.length) fail(`${errors.length} problemas encontrados. Nenhuma escrita efetuada.`);
