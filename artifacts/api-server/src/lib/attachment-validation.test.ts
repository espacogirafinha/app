import assert from "node:assert/strict";
import test from "node:test";
import {
  EVENT_ATTACHMENT_LIMIT,
  EVENT_ATTACHMENT_MAX_BYTES,
  isEventAttachmentEntityType,
  isImageMimeType,
  isValidEventAttachmentPath,
} from "./attachment-validation";

test("attachments support both V2 event entity types", () => {
  assert.equal(isEventAttachmentEntityType("venue_event"), true);
  assert.equal(isEventAttachmentEntityType("external_event"), true);
  assert.equal(isEventAttachmentEntityType("reservation"), false);
});

test("attachment paths stay inside the event folder", () => {
  const id = "00000000-0000-4000-8000-000000000001";
  assert.equal(
    isValidEventAttachmentPath(
      "venue_event",
      id,
      `venue_event/${id}/photo.jpg`,
    ),
    true,
  );
  assert.equal(
    isValidEventAttachmentPath(
      "venue_event",
      id,
      `external_event/${id}/photo.jpg`,
    ),
    false,
  );
  assert.equal(
    isValidEventAttachmentPath(
      "venue_event",
      id,
      `venue_event/${id}/../photo.jpg`,
    ),
    false,
  );
});

test("attachment limits and image MIME validation are explicit", () => {
  assert.equal(EVENT_ATTACHMENT_LIMIT, 10);
  assert.equal(EVENT_ATTACHMENT_MAX_BYTES, 10 * 1024 * 1024);
  assert.equal(isImageMimeType("image/heic"), true);
  assert.equal(isImageMimeType("application/pdf"), false);
});
