import assert from "node:assert/strict";
import test from "node:test";
import type { NextFunction, Request, Response } from "express";
import {
  isPaymentCutoverProtectedMutation,
  isPaymentCutoverWriteFreezeEnabled,
  paymentCutoverWriteFreeze,
} from "./payment-cutover-write-freeze.ts";

function createRequest(method: string, path: string): Request {
  return { method, path } as Request;
}

function createResponse() {
  let statusCode = 200;
  let body: unknown;
  const response = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(value: unknown) {
      body = value;
      return this;
    },
  } as unknown as Response;

  return {
    response,
    getStatus: () => statusCode,
    getBody: () => body,
  };
}

async function runMiddleware(
  method: string,
  path: string,
  enabled: string | undefined,
) {
  const previous = process.env.PAYMENT_CUTOVER_WRITE_FREEZE;

  if (enabled === undefined) delete process.env.PAYMENT_CUTOVER_WRITE_FREEZE;
  else process.env.PAYMENT_CUTOVER_WRITE_FREEZE = enabled;

  try {
    const { response, getStatus, getBody } = createResponse();
    let nextCalled = false;

    paymentCutoverWriteFreeze(
      createRequest(method, path),
      response,
      (() => {
        nextCalled = true;
      }) as NextFunction,
    );

    return { status: getStatus(), body: getBody(), nextCalled };
  } finally {
    if (previous === undefined) delete process.env.PAYMENT_CUTOVER_WRITE_FREEZE;
    else process.env.PAYMENT_CUTOVER_WRITE_FREEZE = previous;
  }
}

test("write freeze defaults to disabled", () => {
  assert.equal(isPaymentCutoverWriteFreezeEnabled(undefined), false);
  assert.equal(isPaymentCutoverWriteFreezeEnabled("false"), false);
  assert.equal(isPaymentCutoverWriteFreezeEnabled(" true "), true);
});

test("freeze=false preserves current write behavior", async () => {
  const result = await runMiddleware("POST", "/api/venue-events", "false");
  assert.equal(result.nextCalled, true);
  assert.equal(result.status, 200);
  assert.equal(result.body, undefined);
});

for (const [method, path, label] of [
  ["POST", "/api/venue-events", "criar Festa"],
  ["PATCH", "/api/venue-events/venue-1", "editar Festa"],
  ["DELETE", "/api/venue-events/venue-1", "apagar Festa"],
  ["POST", "/api/external-events", "criar Serviço"],
  ["PATCH", "/api/external-events/external-1", "editar Serviço"],
  ["DELETE", "/api/external-events/external-1", "apagar Serviço"],
  [
    "POST",
    "/api/integrations/google-forms/venue-event",
    "importar Google Forms",
  ],
] as const) {
  test(`freeze=true bloqueia ${label} antes do handler`, async () => {
    assert.equal(isPaymentCutoverProtectedMutation(method, path), true);
    const result = await runMiddleware(method, path, "true");
    assert.equal(result.nextCalled, false);
    assert.equal(result.status, 503);
    assert.deepEqual(result.body, { error: "payment_cutover_write_freeze" });
  });
}

test("GETs continuam disponíveis durante o freeze", async () => {
  const result = await runMiddleware("GET", "/api/venue-events", "true");
  assert.equal(result.nextCalled, true);
  assert.equal(result.status, 200);
});

test("Workshops continuam fora do bloqueio", async () => {
  for (const [method, path] of [
    ["POST", "/api/workshops"],
    ["PATCH", "/api/workshops/workshop-1"],
    ["DELETE", "/api/workshops/workshop-1"],
  ] as const) {
    const result = await runMiddleware(method, path, "true");
    assert.equal(result.nextCalled, true);
    assert.equal(result.status, 200);
  }
});

test("Google Forms freeze stops processing before any route side effect", async () => {
  let routeSideEffects = 0;
  const result = await runMiddleware(
    "POST",
    "/api/integrations/google-forms/venue-event",
    "true",
  );

  if (result.nextCalled) routeSideEffects += 1;

  assert.equal(routeSideEffects, 0);
  assert.equal(result.status, 503);
});

test("unrelated writes remain available", async () => {
  const result = await runMiddleware(
    "POST",
    "/api/settings/message-templates",
    "true",
  );
  assert.equal(result.nextCalled, true);
});
