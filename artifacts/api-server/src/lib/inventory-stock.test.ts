import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateInventoryMovement,
  InventoryStockError,
} from "./inventory-stock.ts";

test("entry increases stock", () => {
  assert.deepEqual(calculateInventoryMovement({
    currentQuantity: 5,
    movementType: "entry",
    quantity: 3,
  }), {
    quantityBefore: 5,
    quantityDelta: 3,
    quantityAfter: 8,
  });
});

test("exit decreases stock", () => {
  assert.deepEqual(calculateInventoryMovement({
    currentQuantity: 5,
    movementType: "exit",
    quantity: 2,
  }), {
    quantityBefore: 5,
    quantityDelta: -2,
    quantityAfter: 3,
  });
});

test("adjustment uses target physical quantity", () => {
  assert.deepEqual(calculateInventoryMovement({
    currentQuantity: 5,
    movementType: "adjustment",
    quantity: 9,
  }), {
    quantityBefore: 5,
    quantityDelta: 4,
    quantityAfter: 9,
  });
});

test("negative stock is blocked", () => {
  assert.throws(
    () => calculateInventoryMovement({
      currentQuantity: 2,
      movementType: "exit",
      quantity: 3,
    }),
    (error) => error instanceof InventoryStockError && /Stock insuficiente/.test(error.message),
  );
});

test("zero entry/exit and no-op adjustment are rejected", () => {
  assert.throws(() => calculateInventoryMovement({
    currentQuantity: 2,
    movementType: "entry",
    quantity: 0,
  }), InventoryStockError);
  assert.throws(() => calculateInventoryMovement({
    currentQuantity: 2,
    movementType: "adjustment",
    quantity: 2,
  }), InventoryStockError);
});
