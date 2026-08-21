import assert from "node:assert/strict";
import test from "node:test";
import {
  EVENT_IMAGE_MAX_BYTES,
  validateEventImageFiles,
} from "./attachment-files";

function image(name: string, size: number, type = "image/jpeg") {
  return { name, size, type } as File;
}

test("accepts multiple common browser image formats", () => {
  const result = validateEventImageFiles(
    [image("one.jpg", 100), image("two.heic", 200, "image/heic")],
    10,
  );
  assert.equal(result.accepted.length, 2);
  assert.equal(result.rejected.length, 0);
});

test("rejects files over 10 MB, non-images and images beyond the event limit", () => {
  const result = validateEventImageFiles(
    [
      image("large.jpg", EVENT_IMAGE_MAX_BYTES + 1),
      image("document.pdf", 100, "application/pdf"),
      image("allowed.jpg", 100),
      image("overflow.jpg", 100),
    ],
    1,
  );
  assert.equal(result.accepted.length, 1);
  assert.equal(result.rejected.length, 3);
});
