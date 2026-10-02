export type InventoryMovementKind = "entry" | "exit" | "adjustment";

export class InventoryStockError extends Error {}

export function calculateInventoryMovement(input: {
  currentQuantity: number;
  movementType: InventoryMovementKind;
  quantity: number;
}) {
  const { currentQuantity, movementType, quantity } = input;

  if (!Number.isFinite(currentQuantity) || currentQuantity < 0) {
    throw new InventoryStockError("Current stock is invalid.");
  }
  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new InventoryStockError("Movement quantity is invalid.");
  }
  if (movementType !== "adjustment" && quantity <= 0) {
    throw new InventoryStockError("Movement quantity must be greater than zero.");
  }

  let quantityDelta = 0;
  if (movementType === "entry") quantityDelta = quantity;
  if (movementType === "exit") quantityDelta = -quantity;
  if (movementType === "adjustment") quantityDelta = quantity - currentQuantity;

  if (quantityDelta === 0) {
    throw new InventoryStockError("A quantidade já corresponde ao valor indicado.");
  }

  const quantityAfter = currentQuantity + quantityDelta;
  if (quantityAfter < 0) {
    throw new InventoryStockError("Stock insuficiente. A saída não pode deixar o stock negativo.");
  }

  return {
    quantityBefore: currentQuantity,
    quantityDelta,
    quantityAfter,
  };
}
