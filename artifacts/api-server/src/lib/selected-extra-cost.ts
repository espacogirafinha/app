export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function selectedExtraCostPatch(quantity: number, unitCost: number | null) {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error("invalid_quantity");
  }
  if (unitCost !== null && (!Number.isFinite(unitCost) || unitCost < 0)) {
    throw new Error("invalid_unit_cost");
  }

  const normalizedUnitCost = unitCost === null ? null : roundMoney(unitCost);
  return {
    unitCost: normalizedUnitCost,
    totalCost: normalizedUnitCost === null ? null : roundMoney(quantity * normalizedUnitCost),
  };
}

export function selectedExtraMargin(totalPrice: number, totalCost: number | null) {
  return totalCost === null ? null : roundMoney(totalPrice - totalCost);
}
