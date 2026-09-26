import test from "node:test";
import assert from "node:assert/strict";
import { formatReviewImport } from "./google-forms-review.ts";

test("review listing exposes useful metadata without raw submissions or secrets", () => {
  const row = {
    id: "import-1",
    submittedAt: new Date("2026-09-26T10:00:00Z"),
    status: "needs_review",
    errorMessage: "invalid deposit",
    venueEventId: null,
    payload: { fields: { customerName: "Pessoa Teste", phone: "900000000" }, secret: "hidden" },
    payloadHash: "private-hash",
  };
  assert.deepEqual(formatReviewImport(row), {
    id: "import-1",
    submittedAt: "2026-09-26T10:00:00.000Z",
    status: "needs_review",
    reasons: ["invalid deposit"],
    venueEventId: null,
  });
});
