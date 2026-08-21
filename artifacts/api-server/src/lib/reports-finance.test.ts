import assert from "node:assert/strict";
import test from "node:test";
import {
  aggregateFinancials,
  aggregateRefundableDeposits,
  combineFinancialTotals,
  financialPosition,
} from "./reports-finance";

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
