import assert from "node:assert/strict";
import test from "node:test";
import { summarizeEventPayments } from "./event-payment-rules.ts";
import { eventFinancialPosition } from "./event-finance-read-model.ts";

const payment = (
  paymentType: "reservation_deposit" | "payment" | "legacy_payment",
  amount: number,
  deletedAt: Date | null = null,
) => ({ paymentType, amount, deletedAt });

test("Calendar: pendingAmount uses the synchronized ledger mirror", () => {
  const scenarios = [
    { payments: [], expected: 550, status: "unpaid" },
    { payments: [payment("reservation_deposit", 110)], expected: 440, status: "partial" },
    {
      payments: [payment("reservation_deposit", 110), payment("payment", 200)],
      expected: 240,
      status: "partial",
    },
    {
      payments: [payment("reservation_deposit", 110), payment("payment", 440)],
      expected: 0,
      status: "paid",
    },
  ];

  for (const scenario of scenarios) {
    const ledger = summarizeEventPayments({
      totalPrice: 550,
      expectedDeposit: 110,
      payments: scenario.payments,
    });
    const calendar = eventFinancialPosition(550, ledger.received);
    assert.equal(calendar.pending, scenario.expected);
    assert.equal(calendar.paymentStatus, scenario.status);
  }
});

test("Calendar: soft-deleted payment no longer contributes", () => {
  const ledger = summarizeEventPayments({
    totalPrice: 550,
    payments: [
      payment("reservation_deposit", 110),
      payment("payment", 200, new Date("2026-09-27T12:00:00Z")),
    ],
  });

  const calendar = eventFinancialPosition(550, ledger.received);
  assert.equal(calendar.received, 110);
  assert.equal(calendar.pending, 440);
  assert.equal(calendar.paymentStatus, "partial");
});

test("Calendar: adding an extra changes total, not previous received amount", () => {
  const ledger = summarizeEventPayments({
    totalPrice: 550,
    payments: [payment("legacy_payment", 550)],
  });
  assert.equal(ledger.received, 550);

  const afterExtra = eventFinancialPosition(600, ledger.received);
  assert.deepEqual(afterExtra, {
    revenue: 600,
    received: 550,
    pending: 50,
    paymentStatus: "partial",
  });
});
