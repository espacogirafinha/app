import assert from "node:assert/strict";
import test from "node:test";
import {
  nextPaymentReconciledAt,
  paymentComparisonChanged,
  type PaymentReconciliationSnapshot,
} from "./payment-reconciliation.ts";

const reconciledAt = new Date("2026-10-01T10:00:00.000Z");

function current(
  overrides: Partial<PaymentReconciliationSnapshot> = {},
): PaymentReconciliationSnapshot {
  return {
    amount: 100,
    paymentMethod: "bank_transfer",
    paidAt: new Date("2026-10-01T09:00:00.000Z"),
    reconciledAt,
    ...overrides,
  };
}

test("new or unreconciled payment stays pending by default", () => {
  assert.equal(nextPaymentReconciledAt(current({ reconciledAt: null }), {}), null);
});

test("setting reconciledAt marks payment as reconciled", () => {
  const markedAt = new Date("2026-10-01T11:00:00.000Z");
  assert.equal(
    nextPaymentReconciledAt(current({ reconciledAt: null }), { reconciledAt: markedAt }),
    markedAt,
  );
});

test("setting reconciledAt to null undoes reconciliation", () => {
  assert.equal(nextPaymentReconciledAt(current(), { reconciledAt: null }), null);
});

test("changing amount clears reconciliation", () => {
  assert.equal(paymentComparisonChanged(current(), { amount: 125 }), true);
  assert.equal(nextPaymentReconciledAt(current(), { amount: 125 }), null);
});

test("changing paidAt clears reconciliation", () => {
  assert.equal(
    nextPaymentReconciledAt(current(), {
      paidAt: new Date("2026-10-02T09:00:00.000Z"),
    }),
    null,
  );
});

test("changing paymentMethod clears reconciliation", () => {
  assert.equal(
    nextPaymentReconciledAt(current(), { paymentMethod: "mbway" }),
    null,
  );
});

test("changing only notes preserves reconciliation", () => {
  assert.equal(
    nextPaymentReconciledAt(current(), { notes: "Nova nota" }),
    reconciledAt,
  );
});

test("changing only payment type preserves reconciliation", () => {
  assert.equal(
    nextPaymentReconciledAt(current(), { paymentType: "reservation_deposit" }),
    reconciledAt,
  );
});

test("writing the same bank-comparison values preserves reconciliation", () => {
  assert.equal(
    nextPaymentReconciledAt(current(), {
      amount: 100,
      paymentMethod: "bank_transfer",
      paidAt: new Date("2026-10-01T09:00:00.000Z"),
    }),
    reconciledAt,
  );
});
