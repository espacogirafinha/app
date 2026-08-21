const MONEY_INPUT_PATTERN = /^\d*(?:[.,]\d{0,2})?$/;

export function sanitizeMoneyInput(value: string): string {
  const normalized = value.replace(/\s/g, "");
  return MONEY_INPUT_PATTERN.test(normalized) ? normalized : "";
}

export function isValidMoneyInput(value: string): boolean {
  return MONEY_INPUT_PATTERN.test(value.replace(/\s/g, ""));
}

export function parseMoneyInput(
  value: string | number | null | undefined,
): number {
  if (typeof value === "number")
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  const normalized = String(value ?? "")
    .trim()
    .replace(",", ".");
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

export function formatMoneyInput(value: number): string {
  const safeValue = Number.isFinite(value) ? Math.max(0, value) : 0;
  return Number.isInteger(safeValue) ? String(safeValue) : safeValue.toFixed(2);
}
