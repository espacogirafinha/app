export const INVENTORY_QUANTITY_SCALE = 3;

export type InventoryStockState = "ok" | "low" | "out";

export type InventorySummaryInput = {
  isActive: boolean;
  currentStock: number;
  minimumStock: number | null;
};

function roundQuantity(value: number) {
  const factor = 10 ** INVENTORY_QUANTITY_SCALE;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function calculateCurrentStock(deltas: Array<number | string>) {
  return roundQuantity(
    deltas.reduce((sum, delta) => sum + Number(delta), 0),
  );
}

export function signedMovementDelta(
  direction: "in" | "out",
  quantity: number,
) {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("inventory_quantity_must_be_positive");
  }
  return roundQuantity(direction === "in" ? quantity : -quantity);
}

export function nextStockAfterDelta(currentStock: number, delta: number) {
  const next = roundQuantity(currentStock + delta);
  if (next < 0) {
    const error = new Error("inventory_insufficient_stock") as Error & {
      availableStock?: number;
    };
    error.availableStock = currentStock;
    throw error;
  }
  return next;
}

export function adjustmentDelta(currentStock: number, realStock: number) {
  if (!Number.isFinite(realStock) || realStock < 0) {
    throw new Error("inventory_real_stock_must_be_nonnegative");
  }
  return roundQuantity(realStock - currentStock);
}

export function inventoryStockState(
  currentStock: number,
  minimumStock: number | null,
): InventoryStockState {
  if (currentStock <= 0) return "out";
  if (minimumStock !== null && currentStock < minimumStock) return "low";
  return "ok";
}

export function missingToMinimum(
  currentStock: number,
  minimumStock: number | null,
) {
  if (minimumStock === null || currentStock >= minimumStock) return 0;
  return roundQuantity(minimumStock - currentStock);
}

export function inventorySummary(items: InventorySummaryInput[]) {
  const active = items.filter((item) => item.isActive);
  const lowStock = active.filter(
    (item) =>
      item.currentStock > 0
      && item.minimumStock !== null
      && item.currentStock < item.minimumStock,
  ).length;
  const outOfStock = active.filter((item) => item.currentStock <= 0).length;
  const toRestock = active.filter(
    (item) =>
      item.minimumStock !== null && item.currentStock < item.minimumStock,
  ).length;

  return {
    activeItems: active.length,
    lowStock,
    outOfStock,
    toRestock,
  };
}

export function matchesInventorySearch(
  fields: Array<string | null | undefined>,
  query: string | null | undefined,
) {
  const normalized = query?.trim().toLocaleLowerCase("pt-PT");
  if (!normalized) return true;
  return fields.some((field) =>
    field?.toLocaleLowerCase("pt-PT").includes(normalized),
  );
}
