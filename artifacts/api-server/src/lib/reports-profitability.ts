export type VenueProfitabilityEvent = {
  id: string;
  totalPrice: number;
  packEstimatedCost: number | null;
};

export type VenueProfitabilityExtra = {
  entityId: string;
  totalCost: number | null;
};

export type ExpenseFinancialRow = {
  amount: number;
  expenseType: "operational" | "investment";
  categoryName: string;
  supplier: string | null;
};

export type DatedExpenseFinancialRow = ExpenseFinancialRow & {
  expenseDate: string;
  deletedAt: Date | string | null;
};

export function expensesForPeriod(
  rows: DatedExpenseFinancialRow[],
  startDate: string,
  endDate: string,
) {
  return rows
    .filter((row) => row.deletedAt === null && row.expenseDate >= startDate && row.expenseDate <= endDate)
    .map(({ expenseDate: _expenseDate, deletedAt: _deletedAt, ...row }) => row);
}

export type CashPaymentRow = {
  amount: number;
  paidAt: Date | string | null;
  deletedAt?: Date | string | null;
};

const round = (value: number) => Math.round(value * 100) / 100;

export function summarizeVenueProfitability(
  events: VenueProfitabilityEvent[],
  extras: VenueProfitabilityExtra[],
) {
  const ids = new Set(events.map((event) => event.id));
  const relevantExtras = extras.filter((extra) => ids.has(extra.entityId));

  const revenue = round(events.reduce((sum, event) => sum + event.totalPrice, 0));
  const knownPackCosts = round(events.reduce(
    (sum, event) => sum + (event.packEstimatedCost ?? 0),
    0,
  ));
  const unknownPackCostCount = events.filter((event) => event.packEstimatedCost === null).length;
  const knownExtraCosts = round(relevantExtras.reduce(
    (sum, extra) => sum + (extra.totalCost ?? 0),
    0,
  ));
  const unknownExtraCostCount = relevantExtras.filter((extra) => extra.totalCost === null).length;

  return {
    revenue,
    knownPackCosts,
    knownExtraCosts,
    estimatedMarginKnownCosts: round(revenue - knownPackCosts - knownExtraCosts),
    unknownPackCostCount,
    unknownExtraCostCount,
  };
}

function breakdown(rows: ExpenseFinancialRow[], key: (row: ExpenseFinancialRow) => string | null) {
  const map = new Map<string, { count: number; total: number }>();
  for (const row of rows) {
    const label = key(row)?.trim();
    if (!label) continue;
    const current = map.get(label) ?? { count: 0, total: 0 };
    current.count += 1;
    current.total = round(current.total + row.amount);
    map.set(label, current);
  }
  return [...map.entries()]
    .map(([label, value]) => ({ label, count: value.count, total: value.total }))
    .sort((a, b) => b.total - a.total || b.count - a.count || a.label.localeCompare(b.label, "pt"));
}

export function summarizeExpenses(rows: ExpenseFinancialRow[]) {
  const operational = round(rows
    .filter((row) => row.expenseType === "operational")
    .reduce((sum, row) => sum + row.amount, 0));
  const investments = round(rows
    .filter((row) => row.expenseType === "investment")
    .reduce((sum, row) => sum + row.amount, 0));

  return {
    operational,
    investments,
    totalOutflows: round(operational + investments),
    byCategory: breakdown(rows, (row) => row.categoryName),
    topSuppliers: breakdown(rows, (row) => row.supplier).slice(0, 8),
  };
}

export function managementResult(eventRevenue: number, operationalExpenses: number, investments: number) {
  const result = round(eventRevenue - operationalExpenses);
  return {
    eventRevenue: round(eventRevenue),
    operationalExpenses: round(operationalExpenses),
    result,
    investments: round(investments),
    resultAfterInvestments: round(result - investments),
  };
}

function paidAtDate(value: Date | string) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

export function summarizeCashFlow(
  payments: CashPaymentRow[],
  expenseOutflows: number,
  startDate: string,
  endDate: string,
) {
  let received = 0;
  let undatedPaymentsCount = 0;
  let undatedPaymentsAmount = 0;

  for (const payment of payments) {
    if (payment.deletedAt) continue;
    if (!payment.paidAt) {
      undatedPaymentsCount += 1;
      undatedPaymentsAmount += payment.amount;
      continue;
    }
    const date = paidAtDate(payment.paidAt);
    if (date >= startDate && date <= endDate) received += payment.amount;
  }

  const roundedReceived = round(received);
  const roundedExpenses = round(expenseOutflows);
  return {
    received: roundedReceived,
    expensesPaid: roundedExpenses,
    net: round(roundedReceived - roundedExpenses),
    undatedPaymentsCount,
    undatedPaymentsAmount: round(undatedPaymentsAmount),
    workshopsExcluded: true,
  };
}
