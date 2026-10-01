import assert from "node:assert/strict";
import test from "node:test";
import { buildFinancialMovements, type FinancialMovementRow } from "./financial-movements.ts";

function row(overrides: Partial<FinancialMovementRow> = {}): FinancialMovementRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    venueEventId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    externalEventId: null,
    paymentType: "reservation_deposit",
    amount: 110,
    paymentMethod: "bank_transfer",
    paidAt: new Date("2026-10-01T10:00:00.000Z"),
    reconciledAt: null,
    notes: null,
    createdAt: new Date("2026-10-01T10:00:01.000Z"),
    deletedAt: null,
    venueCustomerName: "Cliente A",
    venueBirthdayChildName: "Lourenço",
    venueEventDate: "2026-11-15",
    externalCustomerName: null,
    externalEventDate: null,
    ...overrides,
  };
}

test("movimentos datados são ordenados por paid_at DESC e created_at desempata", () => {
  const result = buildFinancialMovements([
    row({
      id: "00000000-0000-4000-8000-000000000001",
      paidAt: new Date("2026-10-02T09:00:00.000Z"),
      createdAt: new Date("2026-10-02T09:01:00.000Z"),
    }),
    row({
      id: "00000000-0000-4000-8000-000000000002",
      paidAt: new Date("2026-10-02T09:00:00.000Z"),
      createdAt: new Date("2026-10-02T09:02:00.000Z"),
    }),
    row({
      id: "00000000-0000-4000-8000-000000000003",
      paidAt: new Date("2026-10-01T18:00:00.000Z"),
    }),
  ]);

  assert.deepEqual(result.movements.map((item) => item.id), [
    "00000000-0000-4000-8000-000000000002",
    "00000000-0000-4000-8000-000000000001",
    "00000000-0000-4000-8000-000000000003",
  ]);
});

test("sinal e pagamento final da mesma festa permanecem movimentos separados", () => {
  const result = buildFinancialMovements([
    row({ id: "signal", paymentType: "reservation_deposit", amount: 110 }),
    row({
      id: "final",
      paymentType: "payment",
      amount: 440,
      paidAt: new Date("2026-11-01T10:00:00.000Z"),
      createdAt: new Date("2026-11-01T10:00:01.000Z"),
    }),
  ]);

  assert.equal(result.movements.length, 2);
  assert.deepEqual(result.movements.map((item) => [item.paymentType, item.amount]), [
    ["payment", 440],
    ["reservation_deposit", 110],
  ]);
});

test("a ordenação usa pagamento e não data do evento", () => {
  const result = buildFinancialMovements([
    row({
      id: "future-event-paid-now",
      venueEventDate: "2027-01-20",
      paidAt: new Date("2026-10-10T12:00:00.000Z"),
    }),
    row({
      id: "old-event-paid-later",
      venueEventDate: "2026-07-01",
      paidAt: new Date("2026-11-05T12:00:00.000Z"),
    }),
  ]);

  assert.deepEqual(result.movements.map((item) => item.id), [
    "old-event-paid-later",
    "future-event-paid-now",
  ]);
});

test("soft-deleted fica fora e legacy sem paid_at fica apenas no histórico", () => {
  const result = buildFinancialMovements([
    row({ id: "active" }),
    row({
      id: "deleted",
      deletedAt: new Date("2026-10-03T10:00:00.000Z"),
    }),
    row({
      id: "legacy",
      paymentType: "legacy_payment",
      paidAt: null,
      paymentMethod: null,
      amount: 250,
      createdAt: new Date("2026-09-01T10:00:00.000Z"),
    }),
  ]);

  assert.deepEqual(result.movements.map((item) => item.id), ["active"]);
  assert.deepEqual(result.undatedPayments.map((item) => item.id), ["legacy"]);
});

test("estado de reconciliação é preservado no read model sem alterar ordenação", () => {
  const reconciledAt = new Date("2026-10-03T12:00:00.000Z");
  const result = buildFinancialMovements([
    row({
      id: "pending",
      paidAt: new Date("2026-10-02T09:00:00.000Z"),
      reconciledAt: null,
    }),
    row({
      id: "reconciled",
      paidAt: new Date("2026-10-03T09:00:00.000Z"),
      reconciledAt,
    }),
  ]);

  assert.deepEqual(result.movements.map((item) => item.id), ["reconciled", "pending"]);
  assert.equal(result.movements[0]?.reconciledAt, reconciledAt);
  assert.equal(result.movements[1]?.reconciledAt, null);
});

test("serviço externo é enriquecido sem nome de criança", () => {
  const result = buildFinancialMovements([
    row({
      id: "external",
      venueEventId: null,
      externalEventId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      venueCustomerName: null,
      venueBirthdayChildName: null,
      venueEventDate: null,
      externalCustomerName: "Empresa Cliente",
      externalEventDate: "2026-12-20",
    }),
  ]);

  assert.equal(result.movements[0]?.module, "external_events");
  assert.equal(result.movements[0]?.customerName, "Empresa Cliente");
  assert.equal(result.movements[0]?.birthdayChildName, null);
});
