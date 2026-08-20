export type FinancialLine = {
  revenue: number;
  received: number;
};

export type FinancialTotals = {
  revenue: number;
  received: number;
  pending: number;
  overpaid: number;
};

const roundCurrency = (value: number) => Math.round(value * 100) / 100;

export function financialPosition(revenue: number, received: number): FinancialTotals {
  const safeRevenue = Math.max(0, revenue);
  const safeReceived = Math.max(0, received);

  return {
    revenue: roundCurrency(safeRevenue),
    received: roundCurrency(safeReceived),
    pending: roundCurrency(Math.max(safeRevenue - safeReceived, 0)),
    overpaid: roundCurrency(Math.max(safeReceived - safeRevenue, 0)),
  };
}

export function aggregateFinancials(lines: FinancialLine[]): FinancialTotals {
  return lines.reduce<FinancialTotals>(
    (totals, line) => {
      const item = financialPosition(line.revenue, line.received);
      return {
        revenue: roundCurrency(totals.revenue + item.revenue),
        received: roundCurrency(totals.received + item.received),
        pending: roundCurrency(totals.pending + item.pending),
        overpaid: roundCurrency(totals.overpaid + item.overpaid),
      };
    },
    { revenue: 0, received: 0, pending: 0, overpaid: 0 },
  );
}

export function combineFinancialTotals(items: FinancialTotals[]): FinancialTotals {
  return items.reduce<FinancialTotals>(
    (totals, item) => ({
      revenue: roundCurrency(totals.revenue + item.revenue),
      received: roundCurrency(totals.received + item.received),
      pending: roundCurrency(totals.pending + item.pending),
      overpaid: roundCurrency(totals.overpaid + item.overpaid),
    }),
    { revenue: 0, received: 0, pending: 0, overpaid: 0 },
  );
}
