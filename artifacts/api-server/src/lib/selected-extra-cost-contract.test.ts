import assert from "node:assert/strict";
import test from "node:test";
import {
  UpdateSelectedExtraCostBody,
  UpdateSelectedExtraCostParams,
} from "@workspace/api-zod";

test("PATCH contract accepts 20, zero, and null", () => {
  assert.equal(UpdateSelectedExtraCostBody.safeParse({ unitCost: 20 }).success, true);
  assert.equal(UpdateSelectedExtraCostBody.safeParse({ unitCost: 0 }).success, true);
  assert.equal(UpdateSelectedExtraCostBody.safeParse({ unitCost: null }).success, true);
});

test("PATCH contract rejects negative supplier cost", () => {
  assert.equal(UpdateSelectedExtraCostBody.safeParse({ unitCost: -0.01 }).success, false);
});

test("PATCH contract requires a UUID occurrence id", () => {
  assert.equal(
    UpdateSelectedExtraCostParams.safeParse({
      id: "c27162da-5056-46c5-aaf8-93d96ed0c97a",
    }).success,
    true,
  );
  assert.equal(UpdateSelectedExtraCostParams.safeParse({ id: "not-a-uuid" }).success, false);
});
