import assert from "node:assert/strict";
import test from "node:test";
import type { FinancialMovement } from "@workspace/api-client-react";
import {
  filterFinancialMovements,
  filterUndatedFinancialMovements,
  summarizeFinancialMovements,
  type FinancialMovementFilters,
} from "./financial-movements.ts";

function movement(overrides: Partial<FinancialMovement> = {}): FinancialMovement {
  return {
    id: "movement-1",
    module: "venue_events",
    entityId: "event-1",
    customerName: "Diana Pedrosa",
    birthdayChildName: "Lourenço",
    eventDate: "2026-11-15",
    paymentType: "reservation_deposit",
    amount: 110,
    paymentMethod: "bank_transfer",
    paidAt: "2026-10-05T10:00:00.000Z",
    notes: null,
    createdAt: "2026-10-05T10:01:00.000Z",
    ...overrides,
  };
}

const baseFilters: FinancialMovementFilters = {
  search: "",
  periodMode: "all",
  customStart: "",
  customEnd: "",
  method: "all",
  origin: "all",
};

test("pesquisa por cliente e criança é parcial, case-insensitive e tolerante a acentos", () => {
  const rows = [
    movement(),
    movement({ id: "movement-2", customerName: "Rui Santos", birthdayChildName: "Mia" }),
  ];

  assert.deepEqual(
    filterFinancialMovements(rows, { ...baseFilters, search: "PEDR" }).map((item) => item.id),
    ["movement-1"],
  );
  assert.deepEqual(
    filterFinancialMovements(rows, { ...baseFilters, search: "lourenco" }).map((item) => item.id),
    ["movement-1"],
  );
});

test("filtro de método e origem usa os movimentos reais", () => {
  const rows = [
    movement({ id: "transfer", paymentMethod: "bank_transfer" }),
    movement({ id: "cash", paymentMethod: "cash" }),
    movement({
      id: "external",
      module: "external_events",
      entityId: "external-1",
      birthdayChildName: null,
      paymentMethod: "bank_transfer",
    }),
  ];

  assert.deepEqual(
    filterFinancialMovements(rows, { ...baseFilters, method: "cash" }).map((item) => item.id),
    ["cash"],
  );
  assert.deepEqual(
    filterFinancialMovements(rows, { ...baseFilters, origin: "external_events" }).map((item) => item.id),
    ["external"],
  );
});

test("filtro de período usa paid_at em Europe/Lisbon e não a data do evento", () => {
  const rows = [
    movement({
      id: "future-event-paid-this-month",
      eventDate: "2027-02-10",
      paidAt: "2026-10-02T09:00:00.000Z",
    }),
    movement({
      id: "old-event-paid-this-month",
      eventDate: "2026-07-01",
      paidAt: "2026-10-20T15:00:00.000Z",
    }),
    movement({
      id: "paid-last-month",
      eventDate: "2026-12-01",
      paidAt: "2026-09-30T12:00:00.000Z",
    }),
  ];

  const now = new Date("2026-10-15T12:00:00.000Z");
  assert.deepEqual(
    filterFinancialMovements(rows, { ...baseFilters, periodMode: "this_month" }, now).map((item) => item.id),
    ["future-event-paid-this-month", "old-event-paid-this-month"],
  );
  assert.deepEqual(
    filterFinancialMovements(rows, { ...baseFilters, periodMode: "previous_month" }, now).map((item) => item.id),
    ["paid-last-month"],
  );
});

test("intervalo personalizado é inclusivo pela data do pagamento", () => {
  const rows = [
    movement({ id: "start", paidAt: "2026-10-10T00:00:00.000Z" }),
    movement({ id: "inside", paidAt: "2026-10-11T12:00:00.000Z" }),
    movement({ id: "outside", paidAt: "2026-10-13T12:00:00.000Z" }),
  ];

  const filtered = filterFinancialMovements(rows, {
    ...baseFilters,
    periodMode: "custom",
    customStart: "2026-10-10",
    customEnd: "2026-10-12",
  });

  assert.deepEqual(filtered.map((item) => item.id), ["start", "inside"]);
});

test("pagamentos sem data ficam fora do período e podem ser filtrados separadamente", () => {
  const legacy = movement({
    id: "legacy",
    paymentType: "legacy_payment",
    paidAt: null,
    paymentMethod: null,
    amount: 250,
  });

  assert.deepEqual(filterFinancialMovements([legacy], baseFilters), []);
  assert.deepEqual(filterUndatedFinancialMovements([legacy], baseFilters).map((item) => item.id), ["legacy"]);
  assert.deepEqual(
    filterUndatedFinancialMovements([legacy], { ...baseFilters, method: "cash" }),
    [],
  );
});

test("Recebido no período soma apenas os movimentos datados já filtrados", () => {
  const filtered = filterFinancialMovements([
    movement({ id: "a", amount: 110, paidAt: "2026-10-01T10:00:00.000Z" }),
    movement({ id: "b", amount: 200, paidAt: "2026-10-20T10:00:00.000Z" }),
    movement({ id: "c", amount: 999, paidAt: "2026-09-20T10:00:00.000Z" }),
  ], { ...baseFilters, periodMode: "this_month" }, new Date("2026-10-15T12:00:00.000Z"));

  assert.deepEqual(summarizeFinancialMovements(filtered), { received: 310, count: 2 });
});
