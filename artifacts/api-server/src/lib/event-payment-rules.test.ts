import assert from "node:assert/strict";
import test from "node:test";
import {
  EventPaymentRuleError,
  assertPaymentWithinBalance,
  compatibilityMirror,
  maximumAllowedPayment,
  paymentStatusFromAmounts,
  suggestVenueReservationDeposit,
  summarizeEventPayments,
  validatePaymentDraft,
} from "./event-payment-rules.ts";

const payment = (
  id: string,
  amount: number,
  paymentType: "reservation_deposit" | "payment" | "legacy_payment" = "payment",
) => ({ id, amount, paymentType, deletedAt: null });

test("multiple active payments are summed", () => {
  const summary = summarizeEventPayments({
    totalPrice: 550,
    payments: [payment("a", 50, "reservation_deposit"), payment("b", 100), payment("c", 150)],
    expectedDeposit: 165,
  });
  assert.equal(summary.received, 300);
  assert.equal(summary.remainingBalance, 250);
  assert.equal(summary.depositReceived, 50);
  assert.equal(summary.depositRemaining, 115);
  assert.equal(summary.paymentStatus, "partial");
});

test("partial and final payment statuses are derived from totals", () => {
  assert.equal(paymentStatusFromAmounts(550, 0), "unpaid");
  assert.equal(paymentStatusFromAmounts(550, 50), "partial");
  assert.equal(paymentStatusFromAmounts(550, 550), "paid");
});

test("a payment cannot exceed the remaining balance", () => {
  const payments = [payment("a", 100), payment("b", 265)];
  assert.equal(maximumAllowedPayment(550, payments), 185);
  assert.throws(
    () => assertPaymentWithinBalance(550, payments, 185.01),
    (error) => error instanceof EventPaymentRuleError && error.code === "overpayment",
  );
  assert.doesNotThrow(() => assertPaymentWithinBalance(550, payments, 185));
});

test("editing a payment excludes that payment from the balance calculation", () => {
  const payments = [payment("a", 100), payment("b", 300)];
  assert.equal(maximumAllowedPayment(550, payments, "b"), 450);
  assert.doesNotThrow(() => assertPaymentWithinBalance(550, payments, 450, "b"));
  assert.throws(() => assertPaymentWithinBalance(550, payments, 450.01, "b"));
});

test("zero payment is rejected", () => {
  assert.throws(
    () => validatePaymentDraft({
      paymentType: "payment",
      amount: 0,
      paymentMethod: "cash",
      paidAt: new Date(),
      source: "manual",
    }),
    (error) => error instanceof EventPaymentRuleError && error.code === "invalid_amount",
  );
});

test("manual payment requires method and paid_at", () => {
  assert.throws(
    () => validatePaymentDraft({
      paymentType: "payment",
      amount: 10,
      paymentMethod: null,
      paidAt: new Date(),
      source: "manual",
    }),
    (error) => error instanceof EventPaymentRuleError && error.code === "manual_method_required",
  );
  assert.throws(
    () => validatePaymentDraft({
      paymentType: "payment",
      amount: 10,
      paymentMethod: "mbway",
      paidAt: null,
      source: "manual",
    }),
    (error) => error instanceof EventPaymentRuleError && error.code === "manual_paid_at_required",
  );
  for (const method of ["cash", "bank_transfer", "mbway"] as const) {
    assert.doesNotThrow(() => validatePaymentDraft({
      paymentType: "payment",
      amount: 10,
      paymentMethod: method,
      paidAt: new Date(),
      source: "manual",
    }));
  }
});

test("legacy payment may omit method and paid_at", () => {
  assert.doesNotThrow(() => validatePaymentDraft({
    paymentType: "legacy_payment",
    amount: 125,
    paymentMethod: null,
    paidAt: null,
    source: "legacy_migration",
  }));
});

test("manual legacy payment is rejected", () => {
  assert.throws(
    () => validatePaymentDraft({
      paymentType: "legacy_payment",
      amount: 125,
      paymentMethod: "cash",
      paidAt: new Date(),
      source: "manual",
    }),
    (error) => error instanceof EventPaymentRuleError && error.code === "manual_legacy_not_allowed",
  );
});

test("soft-deleted payments do not contribute to received", () => {
  const summary = summarizeEventPayments({
    totalPrice: 300,
    payments: [payment("a", 100), { ...payment("b", 50), deletedAt: new Date() }],
  });
  assert.equal(summary.received, 100);
  assert.equal(summary.remainingBalance, 200);
});

test("compatibility mirror is derived from the ledger", () => {
  const summary = summarizeEventPayments({
    totalPrice: 200,
    payments: [payment("a", 50), payment("b", 150)],
  });
  assert.deepEqual(compatibilityMirror(summary), {
    amountPaid: 200,
    paymentStatus: "paid",
  });
});

test("changing total_price recalculates payment status", () => {
  const payments = [payment("a", 200)];
  assert.equal(summarizeEventPayments({ totalPrice: 200, payments }).paymentStatus, "paid");
  assert.equal(summarizeEventPayments({ totalPrice: 300, payments }).paymentStatus, "partial");
});

test("venue and external events use the same payment rules", () => {
  for (const module of ["venue_events", "external_events"] as const) {
    const summary = summarizeEventPayments({
      totalPrice: module === "venue_events" ? 400 : 600,
      payments: [payment("deposit", 100, "reservation_deposit")],
    });
    assert.equal(summary.received, 100);
    assert.equal(summary.paymentStatus, "partial");
  }
});

test("refundable deposit does not affect received or remaining", () => {
  const withoutDeposit = summarizeEventPayments({
    totalPrice: 500,
    payments: [payment("a", 100)],
    refundableDepositAmount: 0,
  });
  const withDeposit = summarizeEventPayments({
    totalPrice: 500,
    payments: [payment("a", 100)],
    refundableDepositAmount: 250,
  });
  assert.equal(withDeposit.received, withoutDeposit.received);
  assert.equal(withDeposit.remainingBalance, withoutDeposit.remainingBalance);
});

test("venue 30 percent suggestion is rounded to cents", () => {
  assert.equal(suggestVenueReservationDeposit(550), 165);
  assert.equal(suggestVenueReservationDeposit(333.33), 100);
});
