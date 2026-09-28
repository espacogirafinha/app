import assert from "node:assert/strict";
import test from "node:test";
import { resolveVenuePackSnapshotCost } from "./venue-pack-cost.ts";

test("unknown catalog cost remains null", () => {
  assert.equal(resolveVenuePackSnapshotCost(undefined, null), null);
});

test("zero estimated cost remains zero", () => {
  assert.equal(resolveVenuePackSnapshotCost(undefined, 0), 0);
});

test("new event receives current catalog cost snapshot", () => {
  assert.equal(resolveVenuePackSnapshotCost(undefined, 80), 80);
});

test("explicit event cost wins over later catalog changes", () => {
  assert.equal(resolveVenuePackSnapshotCost(80, 95), 80);
});

test("manual null stays unknown even when catalog has a cost", () => {
  assert.equal(resolveVenuePackSnapshotCost(null, 95), null);
});

test("negative estimated cost is rejected", () => {
  assert.throws(() => resolveVenuePackSnapshotCost(-1, 80), /invalid_pack_estimated_cost/);
});
