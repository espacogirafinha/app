export type FinancialLine = {
  revenue: number;
  received: number;
};

export type FinancialTotals = {
  revenue: number;
  received: number;
  pending: number;
};

export type RefundableDepositLine = {
  amount: number;
  status: "not_required" | "pending" | "held" | "returned" | "retained";
};

export type RefundableDepositTotals = {
  held: number;
  retained: number;
};

const roundCurrency = (value: number) => Math.round(value * 100) / 100;

export function financialPosition(revenue: number, received: number): FinancialTotals {
  const safeRevenue = Math.max(0, revenue);
  const safeReceived = Math.max(0, received);

  return {
    revenue: roundCurrency(safeRevenue),
    received: roundCurrency(safeReceived),
    pending: roundCurrency(Math.max(safeRevenue - safeReceived, 0)),
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
      };
    },
    { revenue: 0, received: 0, pending: 0 },
  );
}

export function combineFinancialTotals(items: FinancialTotals[]): FinancialTotals {
  return items.reduce<FinancialTotals>(
    (totals, item) => ({
      revenue: roundCurrency(totals.revenue + item.revenue),
      received: roundCurrency(totals.received + item.received),
      pending: roundCurrency(totals.pending + item.pending),
    }),
    { revenue: 0, received: 0, pending: 0 },
  );
}

export function aggregateRefundableDeposits(lines: RefundableDepositLine[]): RefundableDepositTotals {
  return lines.reduce<RefundableDepositTotals>(
    (totals, line) => {
      const amount = roundCurrency(Math.max(0, line.amount));
      return {
        held: roundCurrency(totals.held + (line.status === "held" ? amount : 0)),
        retained: roundCurrency(totals.retained + (line.status === "retained" ? amount : 0)),
      };
    },
    { held: 0, retained: 0 },
  );
}
