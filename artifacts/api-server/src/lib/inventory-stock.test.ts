import assert from "node:assert/strict";
import test from "node:test";
import {
  adjustmentDelta,
  calculateCurrentStock,
  inventoryStockState,
  inventorySummary,
  matchesInventorySearch,
  missingToMinimum,
  nextStockAfterDelta,
  signedMovementDelta,
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
