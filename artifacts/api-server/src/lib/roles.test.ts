import assert from "node:assert/strict";
import test from "node:test";
import { resolveUserRole } from "./roles";

const userId = "00000000-0000-4000-8000-000000000001";

test("resolveUserRole returns admin", async () => {
  const role = await resolveUserRole(userId, async () => "admin");
  assert.equal(role, "admin");
});

test("resolveUserRole returns staff", async () => {
  const role = await resolveUserRole(userId, async () => "staff");
  assert.equal(role, "staff");
});

test("resolveUserRole returns null when no role is assigned", async () => {
  const role = await resolveUserRole(userId, async () => null);
  assert.equal(role, null);
});

test("resolveUserRole fails closed for an unexpected database value", async () => {
  const role = await resolveUserRole(userId, async () => "unexpected");
  assert.equal(role, null);
});
