import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createHmac, createHash } from "node:crypto";
import vm from "node:vm";

function simulatedSubmissions() {
  const sent = [];
  const context = {
    Date,
    console: { log() {} },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) =>
          k === "GOOGLE_FORMS_INTEGRATION_SECRET"
            ? "test-secret"
            : "https://example.invalid",
      }),
    },
    Utilities: {
      Charset: { UTF_8: "utf8" },
      DigestAlgorithm: { SHA_256: "sha256" },
      computeDigest: (_algorithm, value) => [
        ...createHash("sha256").update(value).digest(),
      ],
      computeHmacSha256Signature: (payload, key) => [
        ...createHmac("sha256", key).update(payload).digest(),
      ],
    },
    UrlFetchApp: {
      fetch: (_url, request) => {
        sent.push(JSON.parse(request.payload));
        return { getResponseCode: () => 200 };
      },
    },
  };
  vm.createContext(context);
  vm.runInContext(
    readFileSync(new URL("./Code.gs", import.meta.url), "utf8"),
    context,
  );
  const map = vm.runInContext("HEADERS", context);
  const headers = Array(26).fill("");
  for (const [index, title] of Object.values(map)) headers[index - 1] = title;
  const cells = Array(26).fill("");
  cells[1] = "new@example.invalid";
  cells[2] = "Teste";
  cells[3] = "968000000";
  cells[4] = "old@example.invalid";
  cells[8] = "27/03/2027";
  cells[9] = "10h às 13h";
  cells[10] = "Pack Completo";
  cells[23] = "16:00h às 19:00h";
  cells[24] = "Animação com mascote";
  const sheet = {
    getName: () => "Respostas do Formulário 1",
    getParent: () => ({
      getId: () => "1NfrBGvwW-E9ncHnvhlMDgl_qbTiMraJD8N2Un9mIwe0",
    }),
    getLastColumn: () => 26,
    getSheetId: () => 1206505899,
    getRange: (row) => ({
      getDisplayValues: () => [row === 1 ? headers : cells],
      getValue: () => new Date("2026-09-26T10:00:00Z"),
    }),
  };
  for (const row of [2, 5])
    context.onGirafinhaFormSubmit({
      range: { getSheet: () => sheet, getRow: () => row },
    });
  return sent;
}
test("Google Form response identity survives row reordering", () => {
  const [first, moved] = simulatedSubmissions();
  assert.equal(first.submissionId, moved.submissionId);
});
test("new time and email preferred; requested service never sent as confirmed extra", () => {
  const [first] = simulatedSubmissions();
  assert.equal(first.fields.time, "16:00h às 19:00h");
  assert.equal(first.fields.email, "new@example.invalid");
  assert.equal(first.fields.requestedService, "Animação com mascote");
  assert.equal("extras" in first.fields, false);
});
