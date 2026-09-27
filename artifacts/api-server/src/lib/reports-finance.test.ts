import assert from "node:assert/strict";
import test from "node:test";
import {
  aggregateFinancials,
  aggregateRefundableDeposits,
  combineFinancialTotals,
  financialPosition,
} from "./reports-finance.ts";
import { eventFinancialPosition, isEventDateInRange } from "./event-finance-read-model.ts";
import { summarizeEventPayments } from "./event-payment-rules.ts";

test("calcula o saldo de uma festa parcialmente paga", () => {
  assert.deepEqual(financialPosition(360, 142.5), { revenue: 360, received: 142.5, pending: 217.5 });
});

test("uma caução em posse fica separada do serviço integralmente pago", () => {
  assert.deepEqual(financialPosition(30, 30), { revenue: 30, received: 30, pending: 0 });
  assert.deepEqual(aggregateRefundableDeposits([{ amount: 30, status: "held" }]), { held: 30, retained: 0 });
});

test("uma caução devolvida não entra nas cauções em posse nem altera a faturação", () => {
  assert.deepEqual(financialPosition(30, 30), { revenue: 30, received: 30, pending: 0 });
  assert.deepEqual(aggregateRefundableDeposits([{ amount: 30, status: "returned" }]), { held: 0, retained: 0 });
});

test("um serviço sem caução preserva o comportamento anterior", () => {
  assert.deepEqual(financialPosition(30, 30), { revenue: 30, received: 30, pending: 0 });
  assert.deepEqual(aggregateRefundableDeposits([{ amount: 0, status: "not_required" }]), { held: 0, retained: 0 });
});

test("um pagamento acima do contrato nunca gera saldo negativo", () => {
  assert.deepEqual(financialPosition(30, 60), { revenue: 30, received: 60, pending: 0 });
});

test("agrega vários tipos de evento e mantém os totais por área coerentes", () => {
  const venue = aggregateFinancials([{ revenue: 360, received: 142.5 }]);
  const external = aggregateFinancials([{ revenue: 30, received: 30 }]);
  const workshops = aggregateFinancials([]);
  const global = combineFinancialTotals([venue, external, workshops]);

  assert.deepEqual(workshops, { revenue: 0, received: 0, pending: 0 });
  assert.deepEqual(global, { revenue: 390, received: 172.5, pending: 217.5 });
  assert.equal(global.revenue, venue.revenue + external.revenue + workshops.revenue);
  assert.equal(global.received, venue.received + external.received + workshops.received);
  assert.equal(global.pending, venue.pending + external.pending + workshops.pending);
});

test("cauções retidas permanecem separadas da receita", () => {
  assert.deepEqual(aggregateRefundableDeposits([
    { amount: 30, status: "held" },
    { amount: 20, status: "retained" },
    { amount: 15, status: "pending" },
  ]), { held: 30, retained: 20 });
});

test("reports: três pagamentos continuam a representar uma única linha de evento", () => {
  const ledger = summarizeEventPayments({
    totalPrice: 550,
    payments: [
      { paymentType: "reservation_deposit", amount: 110, deletedAt: null },
      { paymentType: "payment", amount: 200, deletedAt: null },
      { paymentType: "payment", amount: 50, deletedAt: null },
    ],
  });
  const event = eventFinancialPosition(550, ledger.received);
  const totals = aggregateFinancials([{ revenue: event.revenue, received: event.received }]);

  assert.deepEqual(totals, { revenue: 550, received: 360, pending: 190 });
});

test("reports: legacy_payment conta normalmente para recebido", () => {
  const ledger = summarizeEventPayments({
    totalPrice: 400,
    payments: [{ paymentType: "legacy_payment", amount: 250, deletedAt: null }],
  });
  assert.deepEqual(eventFinancialPosition(400, ledger.received), {
    revenue: 400,
    received: 250,
    pending: 150,
    paymentStatus: "partial",
  });
});

test("reports: soft delete deixa de entrar no recebido", () => {
  const ledger = summarizeEventPayments({
    totalPrice: 550,
    payments: [
      { paymentType: "reservation_deposit", amount: 110, deletedAt: null },
      { paymentType: "payment", amount: 200, deletedAt: new Date("2026-09-27T12:00:00Z") },
    ],
  });
  assert.deepEqual(eventFinancialPosition(550, ledger.received), {
    revenue: 550,
    received: 110,
    pending: 440,
    paymentStatus: "partial",
  });
});

test("reports: evento pago que recebe extra volta a parcial sem alterar recebido", () => {
  const ledger = summarizeEventPayments({
    totalPrice: 550,
    payments: [{ paymentType: "legacy_payment", amount: 550, deletedAt: null }],
  });
  assert.equal(ledger.received, 550);
  assert.deepEqual(eventFinancialPosition(600, ledger.received), {
    revenue: 600,
    received: 550,
    pending: 50,
    paymentStatus: "partial",
  });
});

test("reports: período é determinado pela data do evento, não por paid_at", () => {
  const eventDate = "2026-09-15";
  const paidAtOutsidePeriod = "2026-08-01T10:00:00Z";
  assert.ok(paidAtOutsidePeriod);
  assert.equal(isEventDateInRange(eventDate, "2026-09-01", "2026-09-30"), true);
  assert.equal(isEventDateInRange("2026-10-01", "2026-09-01", "2026-09-30"), false);
});
