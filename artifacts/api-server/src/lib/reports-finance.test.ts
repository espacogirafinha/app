import assert from "node:assert/strict";
import test from "node:test";
import { aggregateFinancials, combineFinancialTotals, financialPosition } from "./reports-finance";

test("calcula o saldo de uma festa parcialmente paga", () => {
  assert.deepEqual(financialPosition(360, 142.5), { revenue: 360, received: 142.5, pending: 217.5, overpaid: 0 });
});

test("um serviço integralmente pago não tem saldo", () => {
  assert.deepEqual(financialPosition(30, 30), { revenue: 30, received: 30, pending: 0, overpaid: 0 });
});

test("um pagamento superior ao contrato mantém o recebido real e identifica o excedente", () => {
  assert.deepEqual(financialPosition(30, 60), { revenue: 30, received: 60, pending: 0, overpaid: 30 });
});

test("agrega vários tipos de evento e mantém os totais por área coerentes", () => {
  const venue = aggregateFinancials([{ revenue: 360, received: 142.5 }]);
  const external = aggregateFinancials([{ revenue: 30, received: 30 }]);
  const workshops = aggregateFinancials([]);
  const global = combineFinancialTotals([venue, external, workshops]);

  assert.deepEqual(workshops, { revenue: 0, received: 0, pending: 0, overpaid: 0 });
  assert.deepEqual(global, { revenue: 390, received: 172.5, pending: 217.5, overpaid: 0 });
  assert.equal(global.revenue, venue.revenue + external.revenue + workshops.revenue);
  assert.equal(global.received, venue.received + external.received + workshops.received);
  assert.equal(global.pending, venue.pending + external.pending + workshops.pending);
});

test("o total global preserva dívida e excedente de áreas diferentes", () => {
  const venue = aggregateFinancials([{ revenue: 360, received: 142.5 }]);
  const external = aggregateFinancials([{ revenue: 30, received: 60 }]);
  const global = combineFinancialTotals([venue, external, aggregateFinancials([])]);

  assert.deepEqual(global, { revenue: 390, received: 202.5, pending: 217.5, overpaid: 30 });
  assert.equal(global.revenue, global.received + global.pending - global.overpaid);
});
