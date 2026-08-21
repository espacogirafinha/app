import assert from "node:assert/strict";
import test from "node:test";
import { toEventExtraDrafts, toSelectedExtraInputs } from "../lib/event-extras";

test("custom extras keep a reservation-specific snapshot without a catalog id", () => {
  const [draft] = toEventExtraDrafts([
    {
      extraId: null,
      extraName: "Transporte adicional",
      category: null,
      unitPrice: 25,
      quantity: 2,
      totalPrice: 50,
      notes: "Fora da zona habitual",
      sortOrder: 1,
    },
  ]);

  assert.equal(draft.custom, true);
  const [saved] = toSelectedExtraInputs([draft]);
  assert.equal(saved.extraId, null);
  assert.equal(saved.extraName, "Transporte adicional");
  assert.equal(saved.totalPrice, 50);
});

test("blank custom extras are not submitted", () => {
  const [draft] = toEventExtraDrafts([
    {
      extraId: null,
      extraName: "   ",
      category: null,
      unitPrice: 25,
      quantity: 1,
      totalPrice: 25,
      notes: null,
      sortOrder: 1,
    },
  ]);
  assert.deepEqual(toSelectedExtraInputs([draft]), []);
});
