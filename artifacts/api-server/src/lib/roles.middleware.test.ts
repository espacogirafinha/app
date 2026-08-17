import assert from "node:assert/strict";
import test from "node:test";
import type { NextFunction, Request, Response } from "express";
import { createRequireRole, type UserRole } from "./roles";

const userId = "00000000-0000-4000-8000-000000000001";

function createRequest(method = "GET"): Request {
  return { method } as Request;
}

function createResponse(authenticated = true): {
  response: Response;
  getStatus: () => number;
  getBody: () => unknown;
} {
  let statusCode = 200;
  let body: unknown;
  const response = {
    locals: authenticated ? { userId } : {},
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

async function runRoleGuard(
  resolvedRole: UserRole | null,
  allowedRoles: UserRole[],
  options: { authenticated?: boolean; method?: string } = {},
) {
  const middleware = createRequireRole(async (resolvedUserId) => {
    assert.equal(resolvedUserId, userId);
    return resolvedRole;
  })(...allowedRoles);
  const { response, getStatus, getBody } = createResponse(
    options.authenticated ?? true,
  );
  let nextError: unknown;
  let nextCalled = false;

  await middleware(createRequest(options.method), response, ((
    error?: unknown,
  ) => {
    nextError = error;
    nextCalled = error === undefined;
  }) as NextFunction);

  return { response, getStatus, getBody, nextCalled, nextError };
}

test("requireRole leaves unauthenticated requests as 401", async () => {
  let resolverCalled = false;
  const middleware = createRequireRole(async () => {
    resolverCalled = true;
    return "admin";
  })("admin");
  const { response, getStatus, getBody } = createResponse(false);
  let nextCalled = false;

  await middleware(createRequest(), response, (() => {
    nextCalled = true;
  }) as NextFunction);

  assert.equal(resolverCalled, false);
  assert.equal(nextCalled, false);
  assert.equal(getStatus(), 401);
  assert.deepEqual(getBody(), { error: "Unauthorized" });
});

test("requireRole allows admin on an admin-only endpoint", async () => {
  const result = await runRoleGuard("admin", ["admin"]);

  assert.equal(result.nextCalled, true);
  assert.equal(result.nextError, undefined);
  assert.equal(result.getStatus(), 200);
  assert.equal(result.response.locals.userRole, "admin");
});

test("requireRole rejects staff on an admin-only endpoint", async () => {
  const result = await runRoleGuard("staff", ["admin"]);

  assert.equal(result.nextCalled, false);
  assert.equal(result.getStatus(), 403);
  assert.deepEqual(result.getBody(), { error: "Forbidden" });
});

test("requireRole rejects an authenticated user without a role", async () => {
  const result = await runRoleGuard(null, ["admin"]);

  assert.equal(result.nextCalled, false);
  assert.equal(result.getStatus(), 403);
  assert.deepEqual(result.getBody(), { error: "Forbidden" });
});

test("requireRole supports endpoints shared by admin and staff", async () => {
  const result = await runRoleGuard("staff", ["admin", "staff"]);

  assert.equal(result.nextCalled, true);
  assert.equal(result.nextError, undefined);
  assert.equal(result.response.locals.userRole, "staff");
});

test("requireRole fails closed when role resolution throws", async () => {
  const expectedError = new Error("role lookup failed");
  const middleware = createRequireRole(async () => {
    throw expectedError;
  })("admin");
  const { response, getStatus } = createResponse();
  let nextError: unknown;

  await middleware(createRequest(), response, ((error?: unknown) => {
    nextError = error;
  }) as NextFunction);

  assert.equal(nextError, expectedError);
  assert.equal(getStatus(), 200);
  assert.equal(response.locals.userRole, undefined);
});
