import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

test("manual venue event creation is not wired to new-reservation notifications", async () => {
  const source = await fs.readFile(
    new URL("../artifacts/api-server/src/routes/venue-events.ts", import.meta.url),
    "utf8",
  );
  assert.equal(source.includes("notificationsTable"), false);
  assert.equal(source.includes("createNotification"), false);
  assert.equal(source.includes("sendPushForNotification"), false);
});

test("Google Forms integration owns new-reservation notification creation", async () => {
  const source = await fs.readFile(
    new URL("../artifacts/api-server/src/integrations/google-forms-route.ts", import.meta.url),
    "utf8",
  );
  assert.equal(source.includes("notificationsTable"), true);
  assert.equal(source.includes("sendPushForNotification"), true);
});
