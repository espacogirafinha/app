import assert from "node:assert/strict";
import test from "node:test";
import {
  buildVenueQuickPaymentData,
  canQuickMarkVenuePaid,
  quickVenuePaymentAmount,
} from "./venue-quick-payment.ts";

test("quick paid action creates exactly the current 440 euro balance", () => {
  const data = buildVenueQuickPaymentData({
    entityId: "event-1",
    remainingBalance: 440,
    paymentMethod: "mbway",
    paidAt: "2026-09-28T09:30:00.000Z",
  });

  assert.deepEqual(data, {
    module: "venue_events",
    entityId: "event-1",
    paymentType: "payment",
    amount: 440,
    paymentMethod: "mbway",
    paidAt: "2026-09-28T09:30:00.000Z",
    notes: null,
  });
});

test("quick paid action creates exactly the current 240 euro balance", () => {
  assert.equal(quickVenuePaymentAmount(240), 240);
  assert.equal(buildVenueQuickPaymentData({
    entityId: "event-2",
    remainingBalance: 240,
    paymentMethod: "cash",
    paidAt: "2026-09-28T09:30:00.000Z",
    notes: "  Liquidado  ",
  }).amount, 240);
});

test("already paid venue event does not expose the quick paid action", () => {
  assert.equal(canQuickMarkVenuePaid(0), false);
  assert.equal(canQuickMarkVenuePaid(-1), false);
  assert.equal(canQuickMarkVenuePaid(0.01), true);
});

test("payment method is mandatory", () => {
  assert.throws(() => buildVenueQuickPaymentData({
    entityId: "event-3",
    remainingBalance: 100,
    paymentMethod: "",
    paidAt: "2026-09-28T09:30:00.000Z",
  }), /payment_method_required/);
});
