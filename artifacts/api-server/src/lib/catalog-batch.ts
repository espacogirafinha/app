import { createHash } from "node:crypto";

/**
 * Permanent Girafinha decoration catalogue import: strict request validation.
 * No data is sent to production unless the authenticated, independently guarded
 * route explicitly receives an approved batch.
 */
export type CatalogueImportRow = {
  catalogCode: string;
  name: string;
  category: string;
  quantity: number;
  unit: "un" | "conjunto";
  color: string | null;
  theme: string | null;
  notes: string | null;
};

const CODE = /^[A-Z]{1,4}[0-9]{2}(?:-[A-Z0-9]+)?$/;
const CATEGORIES = new Set([
  "Pratos decorativos", "Mesas", "Painéis", "Capas de painéis",
  "Cilindros", "Capas de cilindros", "Displays / temas",
  "Jarras / vasos", "Flores", "Números LED",
  "Estruturas / suportes", "Tecidos", "Outros",
]);
const safeText = (value: unknown, limit: number, required: boolean): string | null => {
  if (value === null || value === undefined || value === "") {
    if (required) throw new Error("Um campo obrigatório está vazio");
    return null;
  }
  if (typeof value !== "string" || !value.trim() || value.length > limit || value.includes("\0"))
    throw new Error("Campo textual inválido");
  return value.trim();
};

/** Refuse Preview, development, and production unless owner authorizes a release. */
export function catalogueImportEnabled(
  env: Record<string, string | undefined>,
  requesterEmail: string | undefined,
): boolean {
  const owner = env.GIRAFINHA_CATALOG_IMPORT_OWNER_EMAIL?.trim().toLowerCase();
  return env.VERCEL_ENV === "production"
    && env.GIRAFINHA_CATALOG_IMPORT_ENABLED === "owner-approved-one-time-import"
    && Boolean(owner)
    && Boolean(requesterEmail)
    && owner === requesterEmail?.trim().toLowerCase();
}

export function validateCatalogueImport(payload: unknown): CatalogueImportRow[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    throw new Error("Pedido de importação inválido");
  const request = payload as Record<string, unknown>;
  if (request.schemaVersion !== "girafinha-inventory-staging-v1"
    || request.productionWriteApproved !== false
    || !Array.isArray(request.items)
    || request.items.length < 1
    || request.items.length > 250) throw new Error("Manifesto ou lote de importação inválido");

  const seen = new Set<string>();
  return request.items.map((value: unknown) => {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error("Artigo inválido");
    const item = value as Record<string, unknown>;
    const catalogCode = safeText(item.catalogCode, 40, true)!;
    const name = safeText(item.name, 250, true)!;
    const category = safeText(item.category, 100, true)!;
    const color = safeText(item.color, 250, false);
    const theme = safeText(item.theme, 250, false);
    const notes = safeText(item.notes, 2000, false);
    if (!CODE.test(catalogCode) ||
        !name.startsWith(catalogCode + " · ") ||
        seen.has(catalogCode)) throw new Error("Código repetido ou incompatível: " + catalogCode);
    seen.add(catalogCode);
    if (item.itemType !== "material" ||
        item.ownership !== "Próprio" ||
        (typeof item.validation === "string" && item.validation.startsWith("A validar")) ||
        !CATEGORIES.has(category) ||
        (item.unit !== "un" && item.unit !== "conjunto") ||
        typeof item.quantity !== "number" ||
        !Number.isSafeInteger(item.quantity) ||
        item.quantity <= 0 || item.quantity > 1000)
      throw new Error("Material sem confirmação ou quantidade inválida: " + catalogCode);
    return {catalogCode, name, category, quantity: item.quantity, unit: item.unit, color, theme, notes};
  });
}

/**
 * Deterministic digest of the validated owned-material batch.
 * Fingerprints only stable, imported fields. No private catalogue is
 * committed to GitHub or bundled into the Preview.
 */
export function catalogueImportFingerprint(rows: CatalogueImportRow[]): string {
  const canonical = rows
    .map(({catalogCode,name,category,quantity,unit,color,theme,notes}) => ({
      catalogCode,name,category,quantity,unit,color,theme,notes,
    }))
    .sort((a,b) => a.catalogCode.localeCompare(b.catalogCode, "en"));
  return createHash("sha256").update(JSON.stringify(canonical), "utf8").digest("hex");
}

export function approvedBatchMatches(
  rows: CatalogueImportRow[],
  expectedDigest: string | undefined
): boolean {
  return typeof expectedDigest === "string"
    && /^[0-9a-f]{64}$/.test(expectedDigest)
    && catalogueImportFingerprint(rows) === expectedDigest;
}
