import assert from "node:assert/strict";
import test from "node:test";
import {
  changeRefundableDepositStatus,
  markRefundableDepositReceivedNow,
  shouldHighlightHeldRefundableDeposit,
  shouldShowRefundableDeposit,
} from "./refundable-deposit";

const now = "2026-08-20T11:00:00.000Z";

test("not-required or zero-value deposits stay hidden", () => {
  assert.equal(shouldShowRefundableDeposit(0, "not_required"), false);
  assert.equal(shouldShowRefundableDeposit(30, "not_required"), false);
  assert.equal(shouldShowRefundableDeposit(0, "held"), false);
  assert.equal(shouldShowRefundableDeposit(30, "held"), true);
});

test("only held deposits are highlighted in the compact list", () => {
  assert.equal(shouldHighlightHeldRefundableDeposit(30, "held"), true);
  assert.equal(shouldHighlightHeldRefundableDeposit(30, "pending"), false);
  assert.equal(shouldHighlightHeldRefundableDeposit(30, "returned"), false);
  assert.equal(shouldHighlightHeldRefundableDeposit(30, "retained"), false);
});

test("classifying a historical deposit as held does not invent a received date", () => {
  const changed = changeRefundableDepositStatus(
    { status: "pending", receivedAt: null, returnedAt: null },
    "held",
    now,
  );
  assert.equal(changed.receivedAt, null);
});

test("receiving now and returning now use explicit action timestamps", () => {
  const held = markRefundableDepositReceivedNow(
    { status: "pending", receivedAt: null, returnedAt: null },
    now,
  );
  assert.equal(held.status, "held");
  assert.equal(held.receivedAt, now);

  const returnedAt = "2026-08-21T09:00:00.000Z";
  const returned = changeRefundableDepositStatus(held, "returned", returnedAt);
  assert.equal(returned.returnedAt, returnedAt);
});
