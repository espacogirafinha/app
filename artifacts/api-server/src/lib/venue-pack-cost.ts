export function normalizeOptionalCost(value: number | null | undefined) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (!Number.isFinite(value) || value < 0) throw new Error("invalid_pack_estimated_cost");
  return Math.round(value * 100) / 100;
}

export function resolveVenuePackSnapshotCost(
  requestedCost: number | null | undefined,
  catalogCost: number | null | undefined,
) {
  const requested = normalizeOptionalCost(requestedCost);
  if (requested !== undefined) return requested;
  const catalog = normalizeOptionalCost(catalogCost);
  return catalog === undefined ? null : catalog;
}
