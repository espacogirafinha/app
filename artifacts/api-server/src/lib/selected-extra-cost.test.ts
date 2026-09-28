import assert from "node:assert/strict";
import test from "node:test";
import { selectedExtraCostPatch, selectedExtraMargin } from "./selected-extra-cost.ts";

test("updates supplier cost without touching customer price", () => {
  const result = selectedExtraCostPatch(1, 35);
  assert.deepEqual(result, { unitCost: 35, totalCost: 35 });
  assert.equal(selectedExtraMargin(50, result.totalCost), 15);
});

test("quantity multiplies supplier total and margin", () => {
  const result = selectedExtraCostPatch(2, 35);
  assert.deepEqual(result, { unitCost: 35, totalCost: 70 });
  assert.equal(selectedExtraMargin(100, result.totalCost), 30);
});

test("zero is a valid real cost", () => {
  const result = selectedExtraCostPatch(1, 0);
  assert.deepEqual(result, { unitCost: 0, totalCost: 0 });
  assert.equal(selectedExtraMargin(50, result.totalCost), 50);
});

test("null stays unknown", () => {
  const result = selectedExtraCostPatch(1, null);
  assert.deepEqual(result, { unitCost: null, totalCost: null });
  assert.equal(selectedExtraMargin(50, result.totalCost), null);
});

test("negative supplier cost is rejected", () => {
  assert.throws(() => selectedExtraCostPatch(1, -0.01), /invalid_unit_cost/);
});
