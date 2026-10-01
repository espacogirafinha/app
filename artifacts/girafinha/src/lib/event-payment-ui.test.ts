import assert from "node:assert/strict";
import test from "node:test";
import {
  EVENT_PAYMENT_METHOD_OPTIONS,
  collectionDefaultAmount,
  initialExpectedDeposit,
  initialPaymentPaidAt,
  isHistoricalEventDate,
  nextAutomaticVenueDeposit,
  paymentMethodLabel,
  paymentSummaryLabel,
  suggestVenueReservationDeposit,
} from "./event-payment-ui.ts";

test("venue reservation deposit suggestion is 20 percent", () => {
  assert.equal(suggestVenueReservationDeposit(400), 80);
  assert.equal(suggestVenueReservationDeposit(550), 110);
  assert.equal(suggestVenueReservationDeposit(600), 120);
});

test("automatic venue deposit follows total changes", () => {
  assert.equal(nextAutomaticVenueDeposit({
    totalPrice: 400,
    currentExpected: 0,
    isManual: false,
    depositReceived: 0,
  }), 80);

  assert.equal(nextAutomaticVenueDeposit({
    totalPrice: 500,
    currentExpected: 80,
    isManual: false,
    depositReceived: 0,
  }), 100);
});

test("manual venue deposit stays frozen when total changes", () => {
  assert.equal(nextAutomaticVenueDeposit({
    totalPrice: 500,
    currentExpected: 100,
    isManual: true,
    depositReceived: 0,
  }), 100);
});

test("received reservation deposit freezes automatic suggestion", () => {
  assert.equal(nextAutomaticVenueDeposit({
    totalPrice: 600,
    currentExpected: 110,
    isManual: false,
    depositReceived: 100,
  }), 110);
});

test("payment status wording distinguishes deposit from generic partial payment", () => {
  const base = {
    totalPrice: 550,
    expectedDeposit: 110,
    historicalOverpayment: 0,
  };

  assert.equal(paymentSummaryLabel({
    ...base,
    received: 0,
    remainingBalance: 550,
    paymentStatus: "unpaid",
    depositReceived: 0,
    depositRemaining: 110,
  }, []), "Sinal de 110,00 € por receber");

  assert.equal(paymentSummaryLabel({
    ...base,
    received: 110,
    remainingBalance: 440,
    paymentStatus: "partial",
    depositReceived: 110,
    depositRemaining: 0,
  }, [{ paymentType: "reservation_deposit" }]), "Sinal pago · Falta 440,00 €");

  assert.equal(paymentSummaryLabel({
    ...base,
    received: 200,
    remainingBalance: 350,
    paymentStatus: "partial",
    depositReceived: 0,
    depositRemaining: 165,
  }, [{ paymentType: "payment" }]), "Pago parcialmente · Falta 350,00 €");
});

test("supported payment methods are exactly the approved three", () => {
  assert.deepEqual(EVENT_PAYMENT_METHOD_OPTIONS.map((option) => option.value), [
    "cash",
    "bank_transfer",
    "mbway",
  ]);
  assert.equal(paymentMethodLabel(null), "Método não registado");
});

test("external service has no automatic percentage deposit", () => {
  assert.equal(initialExpectedDeposit("external_events", 550), null);
  assert.equal(initialExpectedDeposit("venue_events", 550), 110);
});

test("charge action defaults to the current remaining balance", () => {
  assert.equal(collectionDefaultAmount(185), 185);
  assert.equal(collectionDefaultAmount(0), 0);
});

test("partial reservation deposit keeps the remaining deposit visible", () => {
  assert.equal(paymentSummaryLabel({
    totalPrice: 550,
    received: 100,
    remainingBalance: 450,
    historicalOverpayment: 0,
    paymentStatus: "partial",
    expectedDeposit: 110,
    depositReceived: 100,
    depositRemaining: 10,
  }, [{ paymentType: "reservation_deposit" }]), "Sinal recebido parcialmente · Faltam 10,00 € do sinal");
});


test("historical event dates use Europe/Lisbon day and do not default payment time", () => {
  const now = new Date("2026-10-01T23:30:00.000Z"); // 02/10/2026 00:30 in Lisbon
  assert.equal(isHistoricalEventDate("2026-10-01", now), true);
  assert.equal(isHistoricalEventDate("2026-10-02", now), false);
  assert.equal(isHistoricalEventDate("2026-10-03", now), false);
  assert.equal(initialPaymentPaidAt("2026-10-01", now), "");
  assert.notEqual(initialPaymentPaidAt("2026-10-02", now), "");
  assert.notEqual(initialPaymentPaidAt("2026-10-03", now), "");
});
