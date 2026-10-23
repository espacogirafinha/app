import assert from "node:assert/strict";
import { test } from "node:test";
import {
  validateDocumentMetadata,
  validateDocumentBytes,
  MAX_DOCUMENT_BYTES,
} from "./expense-document-validation.ts";
import { createHash } from "node:crypto";
const bytes = Buffer.from("%PDF-1.7\nreceipt");
const metadata = {
  filename: "fatura.pdf",
  mimeType: "application/pdf",
  size: bytes.length,
  sha256: createHash("sha256").update(bytes).digest("hex"),
};
test("accepts PDF and validates actual content hash", () => {
  assert.doesNotThrow(() => validateDocumentMetadata(metadata));
  assert.doesNotThrow(() => validateDocumentBytes(bytes, metadata));
});
test("accepts JPG PNG WEBP magic bytes", () => {
  for (const [mimeType, filename, bytes] of [
    ["image/jpeg", "a.jpg", Buffer.from([255, 216, 255, 224])],
    ["image/png", "a.png", Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])],
    ["image/webp", "a.webp", Buffer.from("RIFF0000WEBP")],
  ] as const) {
    const m = {
      filename,
      mimeType,
      size: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };
    assert.doesNotThrow(() => validateDocumentMetadata(m));
    assert.doesNotThrow(() => validateDocumentBytes(bytes, m));
  }
});
test("rejects oversized, empty, spoofed type, name and invalid hashes", () => {
  assert.doesNotThrow(() =>
    validateDocumentMetadata({ ...metadata, size: MAX_DOCUMENT_BYTES }),
  );
  for (const patch of [
    { size: MAX_DOCUMENT_BYTES + 1 },
    { size: 0 },
    { mimeType: "image/svg+xml" },
    { filename: "x.exe" },
    { filename: "../x.pdf" },
    { sha256: "bad" },
  ])
    assert.throws(() => validateDocumentMetadata({ ...metadata, ...patch }));
  assert.throws(() =>
    validateDocumentBytes(Buffer.from("malicious"), metadata),
  );
  assert.throws(() =>
    validateDocumentBytes(Buffer.from("%PDF-different"), metadata),
  );
});
