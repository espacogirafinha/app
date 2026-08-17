import assert from "node:assert/strict";
import test from "node:test";
import type { NextFunction, Request, Response } from "express";
import { createRequireSettingsAdmin } from "../lib/settings-access";

const userId = "00000000-0000-4000-8000-000000000001";

function createResponse(): {
  response: Response;
  getStatus: () => number;
  getBody: () => unknown;
} {
  let statusCode = 200;
  let body: unknown;
  const response = {
    locals: { userId },
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

async function runSettingsGuard(
  role: "admin" | "staff" | null,
  method: string,
) {
  const middleware = createRequireSettingsAdmin(async () => role);
  const { response, getStatus, getBody } = createResponse();
  let nextCalled = false;

  await middleware(
    { method, path: "/settings/venue-packs" } as Request,
    response,
    (() => {
      nextCalled = true;
    }) as NextFunction,
  );

  return { nextCalled, getStatus, getBody };
}

test("Settings admin guard allows ADMIN mutations", async () => {
  for (const method of ["POST", "PATCH"]) {
    const result = await runSettingsGuard("admin", method);
    assert.equal(result.nextCalled, true, method);
    assert.equal(result.getStatus(), 200, method);
  }
});

test("Settings admin guard rejects STAFF mutations with 403", async () => {
  for (const method of ["POST", "PATCH"]) {
    const result = await runSettingsGuard("staff", method);
    assert.equal(result.nextCalled, false, method);
    assert.equal(result.getStatus(), 403, method);
    assert.deepEqual(result.getBody(), { error: "Forbidden" }, method);
  }
});

type RouterLayer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: unknown }>;
  };
};

function firstHandler(
  router: { stack: RouterLayer[] },
  path: string,
  method: string,
): unknown {
  const layer = router.stack.find(
    (candidate) =>
      candidate.route?.path === path &&
      candidate.route.methods[method.toLowerCase()],
  );
  assert.ok(layer?.route, `${method} ${path} is registered`);
  return layer.route.stack[0]?.handle;
}

test("Settings mutation routes use the shared admin guard", async () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL =
    previousDatabaseUrl ??
    "postgresql://unit-test:unit-test@127.0.0.1:5432/unit-test";

  try {
    const [
      { default: settingsCatalogsRouter },
      { default: checklistsRouter },
      { requireSettingsAdmin },
    ] = await Promise.all([
      import("./settings-catalogs"),
      import("./checklists"),
      import("../lib/settings-access"),
    ]);

    const protectedRoutes = [
      [settingsCatalogsRouter, "/settings/venue-packs", "POST"],
      [settingsCatalogsRouter, "/settings/venue-packs/:id", "PATCH"],
      [settingsCatalogsRouter, "/settings/external-services", "POST"],
      [settingsCatalogsRouter, "/settings/external-services/:id", "PATCH"],
      [settingsCatalogsRouter, "/settings/event-extras", "POST"],
      [settingsCatalogsRouter, "/settings/event-extras/:id", "PATCH"],
      [settingsCatalogsRouter, "/settings/message-templates", "POST"],
      [checklistsRouter, "/settings/checklist-templates", "POST"],
      [checklistsRouter, "/settings/checklist-template-items", "POST"],
      [checklistsRouter, "/settings/checklist-templates/:id/items", "POST"],
      [checklistsRouter, "/settings/checklist-template-items/:id", "POST"],
    ] as const;

    for (const [router, path, method] of protectedRoutes) {
      assert.equal(
        firstHandler(
          router as unknown as { stack: RouterLayer[] },
          path,
          method,
        ),
        requireSettingsAdmin,
        `${method} ${path}`,
      );
    }

    assert.notEqual(
      firstHandler(
        settingsCatalogsRouter as unknown as { stack: RouterLayer[] },
        "/settings/venue-packs",
        "GET",
      ),
      requireSettingsAdmin,
      "catalog reads remain available to operational STAFF flows",
    );
    assert.notEqual(
      firstHandler(
        checklistsRouter as unknown as { stack: RouterLayer[] },
        "/checklists",
        "POST",
      ),
      requireSettingsAdmin,
      "operational checklists remain unchanged",
    );
  } finally {
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
  }
});
