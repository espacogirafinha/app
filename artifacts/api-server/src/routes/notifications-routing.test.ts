import assert from "node:assert/strict";
import test from "node:test";
import type { Request, Response } from "express";

type RouterLayer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: (req: Request, res: Response) => Promise<void> | void }>;
  };
};

function handlerFor(
  router: { stack: RouterLayer[] },
  path: string,
  method: string,
) {
  const layer = router.stack.find(
    (candidate) =>
      candidate.route?.path === path &&
      candidate.route.methods[method.toLowerCase()],
  );
  assert.ok(layer?.route, `${method} ${path} is registered`);
  const handler = layer.route.stack[0]?.handle;
  assert.ok(handler, `${method} ${path} has a handler`);
  return handler;
}

function createResponse(userId = "00000000-0000-4000-8000-000000000001") {
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
    sendStatus(code: number) {
      statusCode = code;
      return this;
    },
  } as unknown as Response;

  return {
    response,
    status: () => statusCode,
    body: () => body,
  };
}

test("push endpoints are flat routes served by the root /api function", async () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL =
    previousDatabaseUrl ??
    "postgresql://unit-test:unit-test@127.0.0.1:5432/unit-test";

  try {
    const { createNotificationsRouter } = await import("./notifications");
    const router = createNotificationsRouter({
      publicKey: () => "public-test-key",
      saveSubscription: async () => {},
      deleteSubscription: async () => {},
    }) as unknown as { stack: RouterLayer[] };

    handlerFor(router, "/push-config", "GET");
    handlerFor(router, "/push-subscriptions", "POST");
    handlerFor(router, "/push-subscriptions", "DELETE");

    assert.equal(
      router.stack.some((layer) => layer.route?.path === "/notifications/push-config"),
      false,
    );
    assert.equal(
      router.stack.some(
        (layer) => layer.route?.path === "/notifications/push-subscriptions",
      ),
      false,
    );
  } finally {
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
  }
});

test("GET /push-config returns configured public key only", async () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL =
    previousDatabaseUrl ??
    "postgresql://unit-test:unit-test@127.0.0.1:5432/unit-test";

  try {
    const { createNotificationsRouter } = await import("./notifications");
    const router = createNotificationsRouter({
      publicKey: () => "public-test-key",
      saveSubscription: async () => {},
      deleteSubscription: async () => {},
    }) as unknown as { stack: RouterLayer[] };
    const { response, status, body } = createResponse();

    await handlerFor(router, "/push-config", "GET")({} as Request, response);

    assert.equal(status(), 200);
    assert.deepEqual(body(), {
      configured: true,
      publicKey: "public-test-key",
    });
    assert.equal(JSON.stringify(body()).includes("PRIVATE"), false);
  } finally {
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
  }
});

test("POST /push-subscriptions is idempotent at the route contract", async () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL =
    previousDatabaseUrl ??
    "postgresql://unit-test:unit-test@127.0.0.1:5432/unit-test";

  const saves: Array<{ userId: string; endpoint: string }> = [];
  try {
    const { createNotificationsRouter } = await import("./notifications");
    const router = createNotificationsRouter({
      publicKey: () => "public-test-key",
      saveSubscription: async (userId, subscription) => {
        const existing = saves.find((entry) => entry.endpoint === subscription.endpoint);
        if (existing) existing.userId = userId;
        else saves.push({ userId, endpoint: subscription.endpoint });
      },
      deleteSubscription: async () => {},
    }) as unknown as { stack: RouterLayer[] };

    const request = {
      body: {
        endpoint: "https://push.example.invalid/subscription-1",
        keys: {
          p256dh: "p".repeat(32),
          auth: "a".repeat(16),
        },
      },
    } as Request;

    for (let index = 0; index < 2; index += 1) {
      const { response, status, body } = createResponse();
      await handlerFor(router, "/push-subscriptions", "POST")(request, response);
      assert.equal(status(), 201);
      assert.deepEqual(body(), { ok: true });
    }

    assert.deepEqual(saves, [
      {
        userId: "00000000-0000-4000-8000-000000000001",
        endpoint: "https://push.example.invalid/subscription-1",
      },
    ]);
  } finally {
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
  }
});

test("DELETE /push-subscriptions deletes only the current user's endpoint", async () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL =
    previousDatabaseUrl ??
    "postgresql://unit-test:unit-test@127.0.0.1:5432/unit-test";

  const deletes: Array<{ userId: string; endpoint: string }> = [];
  try {
    const { createNotificationsRouter } = await import("./notifications");
    const router = createNotificationsRouter({
      publicKey: () => "public-test-key",
      saveSubscription: async () => {},
      deleteSubscription: async (userId, endpoint) => {
        deletes.push({ userId, endpoint });
      },
    }) as unknown as { stack: RouterLayer[] };

    const { response, status } = createResponse();
    await handlerFor(router, "/push-subscriptions", "DELETE")(
      {
        body: { endpoint: "https://push.example.invalid/subscription-1" },
      } as Request,
      response,
    );

    assert.equal(status(), 204);
    assert.deepEqual(deletes, [
      {
        userId: "00000000-0000-4000-8000-000000000001",
        endpoint: "https://push.example.invalid/subscription-1",
      },
    ]);
  } finally {
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
  }
});
