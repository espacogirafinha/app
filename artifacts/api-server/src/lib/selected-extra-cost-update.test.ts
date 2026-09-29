import assert from "node:assert/strict";
import test from "node:test";
import {
  updateSelectedExtraCostSnapshot,
  type SelectedExtraCostValues,
} from "./selected-extra-cost-update.ts";

type Row = {
  id: string;
  quantity: number;
  totalPrice: number;
  unitCost: number | null;
  totalCost: number | null;
};

function store(initial: Row) {
  let row = { ...initial };
  return {
    load: async (id: string) => id === row.id ? { ...row } : null,
    persist: async (id: string, values: SelectedExtraCostValues) => {
      assert.equal(id, row.id);
      row = { ...row, ...values };
      return { ...row };
    },
    current: () => ({ ...row }),
  };
}

test("unitCost 20 persists for quantity 1 without changing totalPrice", async () => {
  const memory = store({
    id: "extra-1",
    quantity: 1,
    totalPrice: 50,
    unitCost: null,
    totalCost: null,
  });

  const updated = await updateSelectedExtraCostSnapshot(
    "extra-1",
    20,
    memory.load,
    memory.persist,
  );

  assert.equal(updated?.unitCost, 20);
  assert.equal(updated?.totalCost, 20);
  assert.equal(updated?.totalPrice, 50);
  assert.deepEqual(memory.current(), {
    id: "extra-1",
    quantity: 1,
    totalPrice: 50,
    unitCost: 20,
    totalCost: 20,
  });
});

test("unitCost 0 persists as zero", async () => {
  const memory = store({
    id: "extra-1",
    quantity: 1,
    totalPrice: 50,
    unitCost: 20,
    totalCost: 20,
  });

  await updateSelectedExtraCostSnapshot("extra-1", 0, memory.load, memory.persist);
  assert.equal(memory.current().unitCost, 0);
  assert.equal(memory.current().totalCost, 0);
});

test("unitCost NULL persists as unknown cost", async () => {
  const memory = store({
    id: "extra-1",
    quantity: 2,
    totalPrice: 100,
    unitCost: 35,
    totalCost: 70,
  });

  await updateSelectedExtraCostSnapshot("extra-1", null, memory.load, memory.persist);
  assert.equal(memory.current().unitCost, null);
  assert.equal(memory.current().totalCost, null);
  assert.equal(memory.current().totalPrice, 100);
});

test("quantity 2 recalculates totalCost on the server side", async () => {
  const memory = store({
    id: "extra-1",
    quantity: 2,
    totalPrice: 100,
    unitCost: null,
    totalCost: null,
  });

  await updateSelectedExtraCostSnapshot("extra-1", 35, memory.load, memory.persist);
  assert.equal(memory.current().totalCost, 70);
  assert.equal(memory.current().totalPrice - (memory.current().totalCost ?? 0), 30);
});

test("missing selected extra returns null and never persists", async () => {
  let persisted = false;
  const result = await updateSelectedExtraCostSnapshot(
    "missing",
    20,
    async () => null,
    async () => {
      persisted = true;
      throw new Error("should not persist");
    },
  );

  assert.equal(result, null);
  assert.equal(persisted, false);
});
