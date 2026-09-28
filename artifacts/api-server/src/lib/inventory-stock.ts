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
    deltas.reduce<number>((sum, delta) => sum + Number(delta), 0),
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


export type InventoryFilterableItem = {
  id: string;
  itemType: "consumable" | "material";
  name: string;
  category?: string | null;
  brand?: string | null;
  color?: string | null;
  size?: string | null;
  location?: string | null;
  notes?: string | null;
  isActive: boolean;
  currentStock: number;
  minimumStock: number | null;
  stockState: InventoryStockState;
};

export function filterInventoryItems<T extends InventoryFilterableItem>(
  items: T[],
  filters: {
    search?: string;
    itemType?: "consumable" | "material";
    category?: string;
    activity?: "active" | "inactive" | "all";
    stockStatus?: "low" | "out" | "to_restock";
  },
) {
  const activity = filters.activity ?? "active";
  const targetCategory = filters.category?.trim().toLocaleLowerCase("pt-PT");

  return items
    .filter((item) => {
      if (activity === "active" && !item.isActive) return false;
      if (activity === "inactive" && item.isActive) return false;
      if (filters.itemType && item.itemType !== filters.itemType) return false;
      if (
        targetCategory
        && item.category?.toLocaleLowerCase("pt-PT") !== targetCategory
      ) return false;
      if (filters.stockStatus === "low" && item.stockState !== "low") return false;
      if (filters.stockStatus === "out" && item.stockState !== "out") return false;
      if (
        filters.stockStatus === "to_restock"
        && !(item.minimumStock !== null && item.currentStock < item.minimumStock)
      ) return false;
      return matchesInventorySearch(
        [item.name, item.category, item.brand, item.color, item.size, item.location, item.notes],
        filters.search,
      );
    })
    .sort(
      (a, b) =>
        a.name.localeCompare(b.name, "pt-PT", { sensitivity: "base" })
        || a.id.localeCompare(b.id),
    );
}

export function sortInventoryMovementsNewestFirst<
  T extends { occurredAt: Date | string; createdAt: Date | string },
>(movements: T[]) {
  return [...movements].sort((a, b) => {
    const occurred = new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime();
    if (occurred !== 0) return occurred;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export function normalizeInventoryMetadata(input: {
  name: string;
  category?: string | null;
  brand?: string | null;
  color?: string | null;
  size?: string | null;
  unit: string;
  location?: string | null;
  notes?: string | null;
}) {
  const optional = (value?: string | null) => value?.trim() || null;
  return {
    name: input.name.trim(),
    category: optional(input.category),
    brand: optional(input.brand),
    color: optional(input.color),
    size: optional(input.size),
    unit: input.unit.trim(),
    location: optional(input.location),
    notes: optional(input.notes),
  };
}
