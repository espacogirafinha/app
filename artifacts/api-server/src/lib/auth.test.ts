import assert from "node:assert/strict";
import test from "node:test";
import type { NextFunction, Request, Response } from "express";
import {
  createRequireAuth,
  verifySupabaseBearerToken,
  type AuthenticatedIdentity,
} from "./auth";

const user: AuthenticatedIdentity = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "unit-test@example.invalid",
};

function createRequest(authorization?: string): Request {
  return {
    get(name: string) {
      return name.toLowerCase() === "authorization" ? authorization : undefined;
    },
  } as Request;
}

function createResponse(): {
  response: Response;
  getStatus: () => number;
  getBody: () => unknown;
} {
  let statusCode = 200;
  let body: unknown;
  const response = {
    locals: {},
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

test("valid Supabase token response exposes the verified user ID", async () => {
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_ANON_KEY;
  process.env.SUPABASE_URL = "https://unit-test.supabase.co";
  process.env.SUPABASE_ANON_KEY = "unit-test-anon-key";

  try {
    const verified = await verifySupabaseBearerToken(
      "unit-test-token",
      async () =>
        new Response(JSON.stringify(user), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );

    assert.deepEqual(verified, user);
  } finally {
    if (previousUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_ANON_KEY;
    else process.env.SUPABASE_ANON_KEY = previousKey;
  }
});

test("invalid token keeps the current 401 response", async () => {
  const middleware = createRequireAuth(async () => null);
  const { response, getStatus, getBody } = createResponse();
  let nextCalled = false;

  await middleware(
    createRequest("Bearer invalid-unit-test-token"),
    response,
    (() => {
      nextCalled = true;
    }) as NextFunction,
  );

  assert.equal(nextCalled, false);
  assert.equal(getStatus(), 401);
  assert.deepEqual(getBody(), { error: "Unauthorized" });
});

test("authenticated user without a role continues normally", async () => {
  const middleware = createRequireAuth(async () => user);
  const { response, getStatus } = createResponse();
  let nextCalled = false;

  await middleware(
    createRequest("Bearer valid-unit-test-token"),
    response,
    (() => {
      nextCalled = true;
    }) as NextFunction,
  );

  assert.equal(nextCalled, true);
  assert.equal(getStatus(), 200);
  assert.equal(response.locals.userId, user.id);
  assert.equal(response.locals.userEmail, user.email);
  assert.equal(response.locals.userRole, undefined);
});
