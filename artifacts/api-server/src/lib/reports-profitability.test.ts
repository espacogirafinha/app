import assert from "node:assert/strict";
import test from "node:test";
import {
  expensesForPeriod,
  managementResult,
  summarizeCashFlow,
  summarizeExpenses,
  summarizeVenueProfitability,
} from "./reports-profitability.ts";

test("venue profitability uses pack snapshot and known extra costs without double-counting extras revenue", () => {
  const result = summarizeVenueProfitability(
    [{ id: "event-1", totalPrice: 550, packEstimatedCost: 110 }],
    [{ entityId: "event-1", totalCost: 75 }],
  );
  assert.deepEqual(result, {
    revenue: 550,
    knownPackCosts: 110,
    knownExtraCosts: 75,
    estimatedMarginKnownCosts: 365,
    unknownPackCostCount: 0,
    unknownExtraCostCount: 0,
  });
});

test("unknown pack cost is not converted to zero certainty", () => {
  const result = summarizeVenueProfitability(
    [{ id: "event-1", totalPrice: 550, packEstimatedCost: null }],
    [{ entityId: "event-1", totalCost: 75 }],
  );
  assert.equal(result.knownPackCosts, 0);
  assert.equal(result.unknownPackCostCount, 1);
  assert.equal(result.estimatedMarginKnownCosts, 475);
});

test("unknown extra cost keeps estimated profitability incomplete", () => {
  const result = summarizeVenueProfitability(
    [{ id: "event-1", totalPrice: 550, packEstimatedCost: 110 }],
    [
      { entityId: "event-1", totalCost: 75 },
      { entityId: "event-1", totalCost: null },
    ],
  );
  assert.equal(result.knownExtraCosts, 75);
  assert.equal(result.unknownExtraCostCount, 1);
  assert.equal(result.estimatedMarginKnownCosts, 365);
});

test("expense summary separates operations and investments", () => {
  const result = summarizeExpenses([
    { amount: 86.4, expenseType: "operational", categoryName: "Supermercado / Alimentação", supplier: "Continente" },
    { amount: 750, expenseType: "operational", categoryName: "Renda", supplier: null },
    { amount: 220, expenseType: "investment", categoryName: "Equipamento / Mobiliário", supplier: "Loja" },
  ]);
  assert.equal(result.operational, 836.4);
  assert.equal(result.investments, 220);
  assert.equal(result.totalOutflows, 1056.4);
  assert.equal(result.byCategory.find((item) => item.label === "Renda")?.total, 750);
});

test("one 50 euro expense stays 50 even when traced to multiple events", () => {
  const result = summarizeExpenses([
    {
      amount: 50,
      expenseType: "operational",
      categoryName: "Pessoal / Colaboradores",
      supplier: null,
    },
  ]);

  assert.equal(result.operational, 50);
  assert.equal(result.totalOutflows, 50);
});

test("management result never subtracts estimated pack or extra costs", () => {
  assert.deepEqual(managementResult(2000, 900, 300), {
    eventRevenue: 2000,
    operationalExpenses: 900,
    result: 1100,
    investments: 300,
    resultAfterInvestments: 800,
  });
});

test("cash flow uses paid_at, ignores undated payments and includes investments in cash out", () => {
  const result = summarizeCashFlow([
    { amount: 100, paidAt: "2026-09-10T10:00:00.000Z" },
    { amount: 50, paidAt: "2026-08-31T23:00:00.000Z" },
    { amount: 75, paidAt: null },
    { amount: 999, paidAt: null, deletedAt: "2026-09-20T10:00:00.000Z" },
    { amount: 20, paidAt: "2026-09-15T10:00:00.000Z", deletedAt: "2026-09-20T10:00:00.000Z" },
  ], 120, "2026-09-01", "2026-09-30");

  assert.deepEqual(result, {
    received: 100,
    expensesPaid: 120,
    net: -20,
    undatedPaymentsCount: 1,
    undatedPaymentsAmount: 75,
    workshopsExcluded: true,
  });
});


test("expenses enter reports by expense_date and annulled rows stay out", () => {
  const rows = expensesForPeriod([
    { expenseDate: "2026-09-05", deletedAt: null, amount: 50, expenseType: "operational", categoryName: "Limpeza", supplier: null },
    { expenseDate: "2026-08-31", deletedAt: null, amount: 60, expenseType: "operational", categoryName: "Limpeza", supplier: null },
    { expenseDate: "2026-09-10", deletedAt: "2026-09-20T10:00:00.000Z", amount: 70, expenseType: "operational", categoryName: "Limpeza", supplier: null },
    { expenseDate: "2026-09-15", deletedAt: null, amount: 220, expenseType: "investment", categoryName: "Equipamento / Mobiliário", supplier: "Loja" },
  ], "2026-09-01", "2026-09-30");

  assert.equal(rows.length, 2);
  const summary = summarizeExpenses(rows);
  assert.equal(summary.operational, 50);
  assert.equal(summary.investments, 220);
  assert.equal(summary.totalOutflows, 270);
});
