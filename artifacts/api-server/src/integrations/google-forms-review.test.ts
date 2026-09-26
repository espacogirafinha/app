import test from "node:test";
import assert from "node:assert/strict";
import {
  decodeReviewCursor,
  encodeReviewCursor,
  formatReviewImport,
  resolveReview,
  reviewLinkMatches,
} from "./google-forms-review.ts";

test("pagination cursor includes time and ID for simultaneous submissions and rejects malformed values", () => {
  const expected = {
    submittedAt: new Date("2026-09-26T10:00:00Z"),
    id: "123e4567-e89b-42d3-a456-426614174000",
  };
  assert.deepEqual(decodeReviewCursor(encodeReviewCursor(expected)), expected);
  assert.equal(decodeReviewCursor("not-a-valid-cursor"), null);
  assert.equal(decodeReviewCursor(123), null);
});

test("review listing exposes useful metadata without raw submissions or secrets", () => {
  const row = {
    id: "import-1",
    submittedAt: new Date("2026-09-26T10:00:00Z"),
    status: "needs_review",
    errorMessage: "invalid deposit",
    venueEventId: null,
    payload: {
      fields: {
        customerName: "Pessoa Teste",
        phone: "900000000",
        eventDate: "2026-11-01",
        deposit: "Sim",
        requestedExtras: "Talvez mascote",
      },
      secret: "hidden",
    },
    payloadHash: "private-hash",
  };
  assert.deepEqual(formatReviewImport(row), {
    id: "import-1",
    submittedAt: "2026-09-26T10:00:00.000Z",
    status: "needs_review",
    reasons: ["invalid deposit"],
    venueEventId: null,
    fields: {
      customerName: "Pessoa Teste",
      phone: "900000000",
      eventDate: "2026-11-01",
      deposit: "Sim",
      requestedExtras: "Talvez mascote",
    },
  });
});

test("review shows the current schedule and free-form request from the actual form", () => {
  const row = {
    id: "import-2",
    submittedAt: new Date("2026-09-26T10:00:00Z"),
    status: "needs_review",
    errorMessage: "requested extras require review",
    venueEventId: null,
    payload: {
      fields: {
        time: "16:00h às 19:00h",
        oldTime: "16h-19h",
        requestedService: "Talvez mascote",
        oldEmail: "antigo@example.com",
        extras: "",
        source: "Formulário",
      },
    },
  };
  assert.deepEqual(formatReviewImport(row).fields, {
    time: "16:00h às 19:00h",
    oldTime: "16h-19h",
    requestedService: "Talvez mascote",
    oldEmail: "antigo@example.com",
    source: "Formulário",
  });
});

test("association requires the same event date and normalized Portuguese phone", () => {
  const payload = {
    fields: { eventDate: "2026-11-01", phone: "+351 961 148 868" },
  };
  assert.equal(
    reviewLinkMatches(payload, { eventDate: "2026-11-01", phone: "961148868" }),
    true,
  );
  assert.equal(
    reviewLinkMatches(payload, { eventDate: "2026-11-02", phone: "961148868" }),
    false,
  );
  assert.equal(
    reviewLinkMatches(payload, { eventDate: "2026-11-01", phone: "968508692" }),
    false,
  );
  assert.equal(
    reviewLinkMatches(
      { fields: { eventDate: "?", phone: "?" } },
      { eventDate: "2026-11-01", phone: "961148868" },
    ),
    false,
  );
});

test("dismissal only closes an open review and does not modify a party", async () => {
  let state = {
    needsReview: true,
    status: "needs_review",
    venueEventId: null as string | null,
    payload: { fields: {} },
  };
  const store = {
    transact: async (fn: any) =>
      fn({
        findImport: async () => state,
        findEvent: async () => {
          throw Error("must not touch an event");
        },
        save: async (patch: any) => {
          state = { ...state, ...patch };
        },
      }),
  };
  assert.equal(
    (await resolveReview("import-1", { action: "dismiss" }, store)).status,
    "rejected",
  );
  assert.equal(state.needsReview, false);
  assert.equal(
    (await resolveReview("import-1", { action: "dismiss" }, store)).status,
    "conflict",
  );
});

test("association rejects a different party without changing the review", async () => {
  let saved = false;
  const store = {
    transact: async (fn: any) =>
      fn({
        findImport: async () => ({
          needsReview: true,
          status: "needs_review",
          venueEventId: null,
          payload: { fields: { eventDate: "2026-11-01", phone: "961148868" } },
        }),
        findEvent: async () => ({
          id: "other",
          eventDate: "2026-11-02",
          phone: "961148868",
        }),
        save: async () => {
          saved = true;
        },
      }),
  };
  assert.equal(
    (
      await resolveReview(
        "import-1",
        { action: "link", venueEventId: "other" },
        store,
      )
    ).status,
    "mismatch",
  );
  assert.equal(saved, false);
});

test("association closes review and links a matching party without writing payments", async () => {
  let patch: unknown;
  const store = {
    transact: async (fn: any) =>
      fn({
        findImport: async () => ({
          needsReview: true,
          status: "needs_review",
          venueEventId: null,
          payload: {
            fields: { eventDate: "2026-11-01", phone: "+351 961148868" },
          },
        }),
        findEvent: async () => ({
          id: "event-1",
          eventDate: "2026-11-01",
          phone: "961 148 868",
          amountPaid: "200.00",
        }),
        save: async (value: unknown) => {
          patch = value;
        },
      }),
  };
  assert.deepEqual(
    await resolveReview(
      "import-1",
      { action: "link", venueEventId: "event-1" },
      store,
    ),
    { status: "already_exists", venueEventId: "event-1" },
  );
  assert.deepEqual(patch, {
    status: "already_exists",
    needsReview: false,
    venueEventId: "event-1",
  });
});

test("confirm closes review for the party already created by the import", async () => {
  let patch: unknown;
  const store = {
    transact: async (fn: any) =>
      fn({
        findImport: async () => ({
          needsReview: true,
          status: "needs_review",
          venueEventId: "event-created",
          payload: { fields: { eventDate: "2026-11-01", phone: "961148868" } },
        }),
        findEvent: async () => {
          throw Error("confirm must not relink the party");
        },
        save: async (value: unknown) => {
          patch = value;
        },
      }),
  };

  assert.deepEqual(
    await resolveReview("import-1", { action: "confirm" }, store),
    { status: "created", venueEventId: "event-created" },
  );
  assert.deepEqual(patch, {
    status: "created",
    needsReview: false,
    venueEventId: "event-created",
  });
});
