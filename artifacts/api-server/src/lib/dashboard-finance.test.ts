import assert from "node:assert/strict";
import test from "node:test";
import { summarizeEventPayments } from "./event-payment-rules.ts";
import {
  dashboardFinancialStatusText,
  eventFinancialPosition,
  summarizeDashboardEvents,
} from "./event-finance-read-model.ts";

const payment = (
  paymentType: "reservation_deposit" | "payment" | "legacy_payment",
  amount: number,
  deletedAt: Date | null = null,
) => ({ paymentType, amount, deletedAt });

test("Dashboard: 550 with 110 + 200 receives 310 and leaves 240", () => {
  const ledger = summarizeEventPayments({
    totalPrice: 550,
    expectedDeposit: 110,
    payments: [
      payment("reservation_deposit", 110),
      payment("payment", 200),
    ],
  });
  const dashboard = eventFinancialPosition(550, ledger.received);

  assert.deepEqual(dashboard, {
    revenue: 550,
    received: 310,
    pending: 240,
    paymentStatus: "partial",
  });
});

test("Dashboard: only reservation deposit uses signal wording", () => {
  assert.equal(
    dashboardFinancialStatusText({
      totalPrice: 550,
      amountPaidMirror: 110,
      expectedDeposit: 110,
      payments: [payment("reservation_deposit", 110)],
    }),
    "Sinal pago · Falta 440,00 €",
  );
});

test("Dashboard: later payments use partial-payment wording", () => {
  assert.equal(
    dashboardFinancialStatusText({
      totalPrice: 550,
      amountPaidMirror: 310,
      expectedDeposit: 110,
      payments: [
        payment("reservation_deposit", 110),
        payment("payment", 200),
      ],
    }),
    "Pago parcialmente · Falta 240,00 €",
  );
});

test("Dashboard: unpaid event with expected deposit shows deposit due", () => {
  assert.equal(
    dashboardFinancialStatusText({
      totalPrice: 550,
      amountPaidMirror: 0,
      expectedDeposit: 110,
      payments: [],
    }),
    "Sinal de 110,00 € por receber",
  );
});

test("Dashboard: fully paid event is Paid", () => {
  assert.equal(
    dashboardFinancialStatusText({
      totalPrice: 550,
      amountPaidMirror: 550,
      expectedDeposit: 110,
      payments: [
        payment("reservation_deposit", 110),
        payment("payment", 440),
      ],
    }),
    "Pago",
  );
});

test("Dashboard: legacy payment counts normally and is not called signal", () => {
  assert.equal(
    dashboardFinancialStatusText({
      totalPrice: 550,
      amountPaidMirror: 250,
      expectedDeposit: null,
      payments: [payment("legacy_payment", 250)],
    }),
    "Pago parcialmente · Falta 300,00 €",
  );
});

test("Dashboard: one event with three payments is counted once", () => {
  const ledger = summarizeEventPayments({
    totalPrice: 550,
    payments: [
      payment("reservation_deposit", 110),
      payment("payment", 200),
      payment("payment", 240),
    ],
  });
  const summary = summarizeDashboardEvents([
    { totalPrice: 550, amountPaid: ledger.received },
  ]);

  assert.deepEqual(summary, {
    revenue: 550,
    received: 550,
    pending: 0,
    paidCount: 1,
    partialCount: 0,
    unpaidCount: 0,
  });
});
