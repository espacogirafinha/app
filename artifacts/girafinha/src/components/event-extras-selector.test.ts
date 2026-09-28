import assert from "node:assert/strict";
import test from "node:test";
import { appendEventExtraDraft, calculateExtraLine, removeEventExtraDraft, toEventExtraDrafts, toSelectedExtraInputs } from "../lib/event-extras";

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


test("three different extras are preserved and one can be removed independently", () => {
  const make = (id: string, name: string, price: number) => ({
    localId: id,
    extraId: id,
    extraName: name,
    category: "Teste",
    unitPrice: price,
    unitCost: null,
    quantity: 1,
    totalPrice: price,
    totalCost: null,
    notes: null,
    sortOrder: 0,
    custom: false,
  });

  let extras = appendEventExtraDraft([], make("mascote", "Mascote", 90));
  extras = appendEventExtraDraft(extras, make("pinturas", "Pinturas", 100));
  extras = appendEventExtraDraft(extras, make("bolo", "Bolo", 55));

  assert.deepEqual(toSelectedExtraInputs(extras).map((extra) => extra.extraName), ["Mascote", "Pinturas", "Bolo"]);

  extras = removeEventExtraDraft(extras, "pinturas");
  assert.deepEqual(toSelectedExtraInputs(extras).map((extra) => extra.extraName), ["Mascote", "Bolo"]);
});

test("extra margins preserve customer and supplier snapshots", () => {
  assert.deepEqual(calculateExtraLine({ quantity: 1, unitPrice: 90, unitCost: 75 }), {
    quantity: 1, unitPrice: 90, unitCost: 75, totalPrice: 90, totalCost: 75, margin: 15,
  });
  assert.equal(calculateExtraLine({ quantity: 1, unitPrice: 100, unitCost: 70 }).margin, 30);
  assert.equal(calculateExtraLine({ quantity: 1, unitPrice: 55, unitCost: 38 }).margin, 17);
  assert.deepEqual(calculateExtraLine({ quantity: 2, unitPrice: 90, unitCost: 75 }), {
    quantity: 2, unitPrice: 90, unitCost: 75, totalPrice: 180, totalCost: 150, margin: 30,
  });
});

test("unknown supplier cost stays null and margin remains unknown", () => {
  assert.deepEqual(calculateExtraLine({ quantity: 1, unitPrice: 90, unitCost: null }), {
    quantity: 1, unitPrice: 90, unitCost: null, totalPrice: 90, totalCost: null, margin: null,
  });
});

test("saved snapshots stay unchanged if catalog suggestions later change", () => {
  const [draft] = toEventExtraDrafts([{
    extraId: "11111111-1111-1111-1111-111111111111",
    extraName: "Mascote",
    category: "Animação",
    unitPrice: 90,
    unitCost: 75,
    quantity: 1,
    totalPrice: 90,
    totalCost: 75,
    notes: null,
    sortOrder: 1,
  }]);

  const catalogChangedLater = { basePrice: 120, baseCost: 80 };
  assert.ok(catalogChangedLater);
  const [saved] = toSelectedExtraInputs([draft]);
  assert.equal(saved.unitPrice, 90);
  assert.equal(saved.unitCost, 75);
  assert.equal(saved.totalPrice, 90);
  assert.equal(saved.totalCost, 75);
});
