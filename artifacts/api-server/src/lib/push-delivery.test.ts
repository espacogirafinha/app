import assert from "node:assert/strict";
import test from "node:test";
import { deliverPushToSubscriptions } from "./push-delivery.ts";

const subscriptions = [
  { id: "sub-1", endpoint: "https://push.example/1", p256dh: "a".repeat(32), auth: "b".repeat(16) },
  { id: "sub-2", endpoint: "https://push.example/2", p256dh: "c".repeat(32), auth: "d".repeat(16) },
];

test("two subscriptions are both eligible for push", async () => {
  const endpoints: string[] = [];
  const result = await deliverPushToSubscriptions(
    subscriptions,
    "{}",
    async (subscription) => {
      endpoints.push(subscription.endpoint);
    },
    async () => {
      throw Error("must not remove healthy subscription");
    },
  );
  assert.deepEqual(endpoints, ["https://push.example/1", "https://push.example/2"]);
  assert.deepEqual(result, { sent: 2, removed: 0, skipped: false });
});

test("expired subscription is removed without failing other delivery", async () => {
  const removed: string[] = [];
  const result = await deliverPushToSubscriptions(
    subscriptions,
    "{}",
    async (subscription) => {
      if (subscription.endpoint.endsWith("/1")) {
        const error = new Error("gone") as Error & { statusCode: number };
        error.statusCode = 410;
        throw error;
      }
    },
    async (id) => {
      removed.push(id);
    },
  );
  assert.deepEqual(removed, ["sub-1"]);
  assert.deepEqual(result, { sent: 1, removed: 1, skipped: false });
});

test("push provider failure is contained and does not throw", async () => {
  const removed: string[] = [];
  const result = await deliverPushToSubscriptions(
    [subscriptions[0]],
    "{}",
    async () => {
      const error = new Error("temporary failure") as Error & { statusCode: number };
      error.statusCode = 503;
      throw error;
    },
    async (id) => {
      removed.push(id);
    },
  );
  assert.deepEqual(removed, []);
  assert.deepEqual(result, { sent: 0, removed: 0, skipped: false });
});
