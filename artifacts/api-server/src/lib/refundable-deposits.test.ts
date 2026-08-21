import assert from "node:assert/strict";
import test from "node:test";
import { CreateExternalEventBody } from "@workspace/api-zod";
import {
  refundableDepositCreateValues,
  refundableDepositUpdateValues,
} from "./refundable-deposits";

test("existing services receive safe refundable-deposit defaults", () => {
  const values = refundableDepositCreateValues({});
  assert.deepEqual(values, {
    refundableDepositAmount: "0",
    refundableDepositStatus: "not_required",
    refundableDepositReceivedAt: null,
    refundableDepositReturnedAt: null,
    refundableDepositNotes: null,
  });
});

test("refundable deposits remain separate from service revenue and payments", () => {
  const financials = { totalPrice: "30", amountPaid: "30" };
  const deposit = refundableDepositCreateValues({
    refundableDepositAmount: 30,
    refundableDepositStatus: "held",
  });
  const row = { ...financials, ...deposit };

  assert.equal(row.totalPrice, "30");
  assert.equal(row.amountPaid, "30");
  assert.equal(row.refundableDepositAmount, "30");
});

test("create and update preserve nullable deposit timestamps", () => {
  const receivedAt = "2026-08-20T10:30:00.000Z";
  const created = refundableDepositCreateValues({
    refundableDepositAmount: 25,
    refundableDepositStatus: "held",
    refundableDepositReceivedAt: receivedAt,
    refundableDepositNotes: "Piscina de bolas",
  });
  assert.equal(created.refundableDepositReceivedAt?.toISOString(), receivedAt);
  assert.equal(created.refundableDepositReturnedAt, null);

  const updated = refundableDepositUpdateValues({
    refundableDepositStatus: "returned",
    refundableDepositReturnedAt: receivedAt,
  });
  assert.equal((updated.refundableDepositReturnedAt as Date).toISOString(), receivedAt);
  assert.equal(updated.refundableDepositAmount, undefined);
});

test("the API accepts only supported refundable-deposit states", () => {
  const body = {
    customerName: "Teste",
    phone: "910000000",
    eventDate: "2026-08-24",
    startTime: "15:00",
    totalPrice: 30,
    amountPaid: 30,
    services: [{
      serviceType: "insuflavel" as const,
      serviceLabel: "Piscina de bolas",
    }],
  };

  for (const refundableDepositStatus of ["not_required", "pending", "held", "returned", "retained"] as const) {
    assert.equal(CreateExternalEventBody.safeParse({ ...body, refundableDepositStatus }).success, true);
  }
  assert.equal(CreateExternalEventBody.safeParse({ ...body, refundableDepositStatus: "overpaid" }).success, false);
});

test("negative refundable deposits are rejected", () => {
  assert.throws(() => refundableDepositCreateValues({ refundableDepositAmount: -1 }));
});
