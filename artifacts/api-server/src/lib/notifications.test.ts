import assert from "node:assert/strict";
import test from "node:test";
import { buildGoogleFormNotification } from "./notification-content.ts";

test("created Google Forms party builds reservation notification", () => {
  const value = buildGoogleFormNotification({
    importId: "00000000-0000-4000-8000-000000000001",
    status: "created",
    venueEventId: "00000000-0000-4000-8000-000000000002",
    eventDate: "2027-01-23",
    packName: "Premium",
  });
  assert.equal(value.title, "Nova reserva recebida");
  assert.equal(value.message, "23/01/2027 · Pack Premium");
  assert.equal(
    value.destination,
    "/venue-events?open=00000000-0000-4000-8000-000000000002",
  );
  assert.equal(
    value.sourceKey,
    "google_forms:00000000-0000-4000-8000-000000000001:initial",
  );
});

test("review import with party links directly to that party", () => {
  const value = buildGoogleFormNotification({
    importId: "00000000-0000-4000-8000-000000000003",
    status: "needs_review",
    venueEventId: "00000000-0000-4000-8000-000000000004",
    eventDate: "2026-11-05",
    packName: "Essencial",
  });
  assert.equal(value.title, "Nova reserva — precisa de revisão");
  assert.equal(value.message, "05/11/2026 · Pack Essencial");
  assert.equal(
    value.destination,
    "/venue-events?open=00000000-0000-4000-8000-000000000004",
  );
});

test("review import without party contains no personal data and links to review", () => {
  const value = buildGoogleFormNotification({
    importId: "00000000-0000-4000-8000-000000000005",
    status: "needs_review",
  });
  assert.equal(value.title, "Novo pedido precisa de revisão");
  assert.equal(value.message, "Não foi possível criar automaticamente a Festa.");
  assert.equal(
    value.destination,
    "/google-forms-review?open=00000000-0000-4000-8000-000000000005",
  );
  assert.equal(JSON.stringify(value).includes("phone"), false);
  assert.equal(JSON.stringify(value).includes("email"), false);
});
