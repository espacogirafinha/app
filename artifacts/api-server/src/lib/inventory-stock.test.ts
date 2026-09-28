import assert from "node:assert/strict";
import test from "node:test";
import {
  adjustmentDelta,
  calculateCurrentStock,
  filterInventoryItems,
  inventoryStockState,
  inventorySummary,
  matchesInventorySearch,
  missingToMinimum,
  nextStockAfterDelta,
  normalizeInventoryMetadata,
  signedMovementDelta,
  sortInventoryMovementsNewestFirst,
} from "./inventory-stock.ts";

test("stock inicial 48, entrada 24, saída 10 e ajuste para 58", () => {
  assert.equal(calculateCurrentStock([48]), 48);
  assert.equal(nextStockAfterDelta(48, signedMovementDelta("in", 24)), 72);
  assert.equal(nextStockAfterDelta(72, signedMovementDelta("out", 10)), 62);
  assert.equal(adjustmentDelta(62, 58), -4);
  assert.equal(nextStockAfterDelta(62, adjustmentDelta(62, 58)), 58);
});

test("backend rule rejects negative stock", () => {
  assert.throws(
    () => nextStockAfterDelta(5, signedMovementDelta("out", 8)),
    (error: unknown) =>
      error instanceof Error
      && error.message === "inventory_insufficient_stock"
      && (error as Error & { availableStock?: number }).availableStock === 5,
  );
  assert.equal(nextStockAfterDelta(5, signedMovementDelta("out", 5)), 0);
});

test("minimum stock states and missing quantity are correct", () => {
  assert.equal(inventoryStockState(18, 30), "low");
  assert.equal(missingToMinimum(18, 30), 12);
  assert.equal(inventoryStockState(0, 30), "out");
  assert.equal(inventoryStockState(18, null), "ok");
  assert.equal(missingToMinimum(18, null), 0);
});

test("summary separates low, out and to-restock", () => {
  assert.deepEqual(
    inventorySummary([
      { isActive: true, currentStock: 18, minimumStock: 30 },
      { isActive: true, currentStock: 0, minimumStock: 10 },
      { isActive: true, currentStock: 5, minimumStock: null },
      { isActive: false, currentStock: 0, minimumStock: 10 },
    ]),
    { activeItems: 3, lowStock: 1, outOfStock: 1, toRestock: 2 },
  );
});

test("search finds name, colour and brand text", () => {
  assert.equal(matchesInventorySearch(["Balão Sempertex", "Rosa Pastel"], "rosa"), true);
  assert.equal(matchesInventorySearch(["Painel redondo", "Girafinha"], "água"), false);
  assert.equal(matchesInventorySearch(["Sempertex"], "SEMPertex"), true);
});


test("inactive items stay hidden from the normal view but remain filterable", () => {
  const items = [
    {
      id: "1",
      itemType: "consumable" as const,
      name: "Água",
      category: "Bebidas",
      brand: null,
      color: null,
      size: null,
      location: "Armazém",
      notes: null,
      isActive: true,
      currentStock: 48,
      minimumStock: 30,
      stockState: "ok" as const,
    },
    {
      id: "2",
      itemType: "material" as const,
      name: "Painel antigo",
      category: "Painéis",
      brand: null,
      color: null,
      size: "1,80 m",
      location: "Girafinha",
      notes: null,
      isActive: false,
      currentStock: 2,
      minimumStock: null,
      stockState: "ok" as const,
    },
  ];

  assert.deepEqual(filterInventoryItems(items, {}).map((item) => item.id), ["1"]);
  assert.deepEqual(
    filterInventoryItems(items, { activity: "inactive" }).map((item) => item.id),
    ["2"],
  );
});

test("search rosa finds colour and materials keep optional metadata", () => {
  const material = normalizeInventoryMetadata({
    name: "Balão Sempertex ",
    category: " Balões ",
    brand: " Sempertex ",
    color: " Rosa Pastel ",
    size: ' 12" ',
    unit: " unidade ",
    location: " Armazém ",
    notes: " caixa aberta ",
  });

  assert.deepEqual(material, {
    name: "Balão Sempertex",
    category: "Balões",
    brand: "Sempertex",
    color: "Rosa Pastel",
    size: '12"',
    unit: "unidade",
    location: "Armazém",
    notes: "caixa aberta",
  });

  const matches = filterInventoryItems([
    {
      id: "b",
      itemType: "material" as const,
      ...material,
      isActive: true,
      currentStock: 134,
      minimumStock: 100,
      stockState: "ok" as const,
    },
  ], { search: "rosa" });

  assert.equal(matches.length, 1);
});

test("movement history is newest first", () => {
  const sorted = sortInventoryMovementsNewestFirst([
    { id: "old", occurredAt: "2026-09-20T10:00:00Z", createdAt: "2026-09-20T10:00:00Z" },
    { id: "new", occurredAt: "2026-09-28T10:00:00Z", createdAt: "2026-09-28T10:00:00Z" },
    { id: "middle", occurredAt: "2026-09-27T10:00:00Z", createdAt: "2026-09-27T10:00:00Z" },
  ]);

  assert.deepEqual(sorted.map((movement) => movement.id), ["new", "middle", "old"]);
});
