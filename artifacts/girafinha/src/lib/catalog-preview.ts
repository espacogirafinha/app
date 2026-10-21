/**
 * Offline-only catalogue preview. This module never calls Supabase, the API or Storage.
 * The uploaded manifest and photo files exist only in browser memory.
 */
export type CatalogueState = "proposto" | "pendente" | "emprestado";

export type CatalogueItem = {
  catalogCode: string;
  name: string;
  category: string;
  quantity: number | null;
  unit: string;
  color?: string | null;
  theme?: string | null;
  notes?: string | null;
  ownership?: string;
  referencePhoto?: string | null;
  validation?: string | null;
  status: CatalogueState;
};

type ManifestEntry = Omit<CatalogueItem, "status">;
type RawManifest = {
  schemaVersion?: unknown;
  productionWriteApproved?: unknown;
  records?: {
    pronto_para_revisao?: unknown;
    pendente?: unknown;
    emprestimo?: unknown;
  };
};

const CODE = /^[A-Z]{1,4}[0-9]{2}(?:-[A-Z0-9]+)?$/;
const NAME_CODE = /^([A-Z]{1,4}[0-9]{2}(?:-[A-Z0-9]+)?)\s*·\s*/;

const demo = [
  ["P01", "Painel arqueado MDF", "Painéis", 1, "Repintável", ""],
  ["P09", "Painel retangular vazado", "Painéis", 1, "Azul-claro", "Aviões"],
  ["CC01", "Capas efeito tronco", "Capas de cilindros", 2, "Castanho", "Dinossauros"],
  ["CC02", "Capas de cilindro", "Capas de cilindros", 2, "Azul-bebé", "Patrulha Pata"],
  ["D66", "Olaf grande em polionda", "Displays / temas", 1, "Branco", "Frozen"],
  ["N09", "Número 4 luminoso em acrílico", "Números LED", 1, "Branco", "Frozen"],
] as const;

export const DEMO_ITEMS: CatalogueItem[] = demo.map(([code, name, category, quantity, color, theme]) => ({
  catalogCode: code,
  name: code + " · " + name,
  category,
  quantity,
  unit: "un",
  color,
  theme,
  notes: "Exemplo demonstrativo. Importa o manifesto para consultar o catálogo completo.",
  ownership: "Próprio",
  status: "proposto",
}));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

function asSafeString(value: unknown, label: string, max = 5000): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== "string" || value.length > max || value.includes("\0")) {
    throw new Error("Campo inválido: " + label);
  }
  return value;
}

function checkedEntry(raw: unknown, status: CatalogueState): CatalogueItem {
  if (!isRecord(raw)) throw new Error("Foi encontrada uma peça com estrutura inválida.");
  const catalogCode = asSafeString(raw.catalogCode, "catalogCode", 40);
  const name = asSafeString(raw.name, "name", 250);
  if (!catalogCode || !CODE.test(catalogCode) || !name || name.match(NAME_CODE)?.[1] !== catalogCode) {
    throw new Error("Código e nome inconsistentes: " + String(catalogCode ?? "desconhecido"));
  }
  const category = asSafeString(raw.category, "category", 150);
  const unit = asSafeString(raw.unit, "unit", 40);
  const color = asSafeString(raw.color, "color");
  const theme = asSafeString(raw.theme, "theme");
  const notes = asSafeString(raw.notes, "notes", 10000);
  const ownership = asSafeString(raw.ownership, "ownership", 100);
  const referencePhoto = asSafeString(raw.referencePhoto, "referencePhoto", 250);
  const validation = asSafeString(raw.validation, "validation", 200);
  if (!category || !unit || !ownership || (status === "emprestado" ? ownership !== "Empréstimo" : ownership !== "Próprio")) {
    throw new Error("Categoria, unidade ou propriedade inválida em " + catalogCode);
  }
  const quantity = raw.quantity;
  if (quantity !== null && (!Number.isSafeInteger(quantity) || Number(quantity) < 0)) {
    throw new Error("Quantidade inválida em " + catalogCode);
  }
  if (status === "proposto" && (!Number.isSafeInteger(quantity) || Number(quantity) <= 0)) {
    throw new Error("Quantidade por confirmar no lote proposto: " + catalogCode);
  }
  if (referencePhoto && !/^[A-Za-z0-9()_-]+\.jpg$/i.test(referencePhoto)) {
    throw new Error("Nome de fotografia inválido em " + catalogCode);
  }
  return {
    catalogCode, name, category,
    quantity: (quantity as number | null) ?? null,
    unit, color, theme, notes, ownership, referencePhoto, validation, status,
  };
}

export function parseCatalogueJson(text: string): CatalogueItem[] {
  if (text.length > 2_000_000) throw new Error("O manifesto ultrapassa o limite de 2 MB.");
  let value: unknown;
  try { value = JSON.parse(text.replace(/^\uFEFF/, "")); }
  catch { throw new Error("O ficheiro não contém JSON válido."); }
  if (!isRecord(value)) throw new Error("O manifesto deve conter um objeto.");
  const manifest = value as RawManifest;
  if (manifest.schemaVersion !== "girafinha-inventory-staging-v1" || manifest.productionWriteApproved !== false) {
    throw new Error("O ficheiro não é o manifesto de revisão do inventário da Girafinha.");
  }
  const groups = manifest.records;
  if (!groups || !Array.isArray(groups.pronto_para_revisao) || !Array.isArray(groups.pendente) ||
    !Array.isArray(groups.emprestimo)) throw new Error("Os grupos do manifesto estão incompletos.");

  const rows = [
    ...groups.pronto_para_revisao.map(item => checkedEntry(item, "proposto")),
    ...groups.pendente.map(item => checkedEntry(item, "pendente")),
    ...groups.emprestimo.map(item => checkedEntry(item, "emprestado")),
  ];
  const codes = new Set(rows.map(item => item.catalogCode));
  if (codes.size !== rows.length) throw new Error("O manifesto contém códigos repetidos.");
  if (rows.length > 1000) throw new Error("O manifesto contém demasiados registos.");
  return rows;
}
