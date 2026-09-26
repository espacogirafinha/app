import test from "node:test";
import assert from "node:assert/strict";
import { matchingReviewEvents } from "./google-forms-review.ts";

test("only same-date same-phone parties may be offered for association", () => {
  const rows = [
    { id: "right", eventDate: "2026-11-01", phone: "961148868" },
    { id: "wrong-date", eventDate: "2026-11-02", phone: "961148868" },
    { id: "wrong-phone", eventDate: "2026-11-01", phone: "968508692" },
  ];
  assert.deepEqual(
    matchingReviewEvents(
      { eventDate: "2026-11-01", phone: "+351 961 148 868" },
      rows,
    ).map((x) => x.id),
    ["right"],
  );
  assert.deepEqual(
    matchingReviewEvents({ eventDate: "?", phone: "961148868" }, rows),
    [],
  );
  assert.deepEqual(
    matchingReviewEvents(
      { eventDate: "01/11/2026", phone: "961148868" },
      rows,
    ).map((x) => x.id),
    ["right"],
  );
});
