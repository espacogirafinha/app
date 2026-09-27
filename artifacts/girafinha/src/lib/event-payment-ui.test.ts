import assert from "node:assert/strict";
import test from "node:test";
import {
  EVENT_PAYMENT_METHOD_OPTIONS,
  collectionDefaultAmount,
  initialExpectedDeposit,
  nextAutomaticVenueDeposit,
  paymentMethodLabel,
  paymentSummaryLabel,
  suggestVenueReservationDeposit,
} from "./event-payment-ui.ts";

test("venue 550 euros suggests exactly 165 euros deposit", () => {
  assert.equal(suggestVenueReservationDeposit(550), 165);
});

test("automatic venue deposit follows total changes", () => {
  assert.equal(nextAutomaticVenueDeposit({
    totalPrice: 400,
    currentExpected: 0,
    isManual: false,
    depositReceived: 0,
  }), 120);

  assert.equal(nextAutomaticVenueDeposit({
    totalPrice: 500,
    currentExpected: 120,
    isManual: false,
    depositReceived: 0,
  }), 150);
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
    currentExpected: 165,
    isManual: false,
    depositReceived: 100,
  }), 165);
});

test("payment status wording distinguishes deposit from generic partial payment", () => {
  const base = {
    totalPrice: 550,
    expectedDeposit: 165,
    historicalOverpayment: 0,
  };

  assert.equal(paymentSummaryLabel({
    ...base,
    received: 0,
    remainingBalance: 550,
    paymentStatus: "unpaid",
    depositReceived: 0,
    depositRemaining: 165,
  }, []), "Sinal de 165,00 € por receber");

  assert.equal(paymentSummaryLabel({
    ...base,
    received: 165,
    remainingBalance: 385,
    paymentStatus: "partial",
    depositReceived: 165,
    depositRemaining: 0,
  }, [{ paymentType: "reservation_deposit" }]), "Sinal pago · Falta 385,00 €");

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

test("external service has no automatic 30 percent deposit", () => {
  assert.equal(initialExpectedDeposit("external_events", 550), null);
  assert.equal(initialExpectedDeposit("venue_events", 550), 165);
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
    expectedDeposit: 165,
    depositReceived: 100,
    depositRemaining: 65,
  }, [{ paymentType: "reservation_deposit" }]), "Sinal recebido parcialmente · Faltam 65,00 € do sinal");
});
