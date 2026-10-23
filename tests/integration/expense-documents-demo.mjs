import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
const { build } = createRequire(
  new URL("../../artifacts/api-server/package.json", import.meta.url),
)("esbuild");
const dir = await mkdtemp(`${tmpdir()}/receipts-demo-`);
await build({
  entryPoints: [
    "artifacts/girafinha/src/testing/expense-documents-demo-store.ts",
  ],
  outfile: `${dir}/store.mjs`,
  bundle: true,
  platform: "node",
  format: "esm",
});
const { createDemoDocumentClient, demoExpenses } = await import(
  pathToFileURL(`${dir}/store.mjs`)
);
const before = JSON.stringify(demoExpenses);
globalThis.fetch = () => {
  throw new Error("Demo must never access a network service");
};
const client = await createDemoDocumentClient();
const list = (id) => client.request("list", undefined, { expenseId: id });
const [first, second] = demoExpenses;
const original = (await list(first.id))[0];
assert.equal(original.associationCount, 2);
assert.equal((await list(second.id))[0].id, original.id);
assert.equal((await client.download(original)).type, "application/pdf");
await client.request("unlink", {
  expenseId: first.id,
  documentId: original.id,
});
assert.equal((await list(first.id)).length, 0);
assert.equal((await list(second.id)).length, 1);
await client.request("link", { expenseId: first.id, documentId: original.id });
const file = new File(
  [Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])],
  "foto.png",
  { type: "image/png" },
);
await client.upload(first.id, file);
await client.upload(second.id, file);
await client.upload(second.id, file);
const uploaded = (await list(first.id)).find((d) => d.filename === "foto.png");
assert.equal(uploaded.associationCount, 2);
assert.deepEqual(
  Buffer.from(await (await client.download(uploaded)).arrayBuffer()),
  Buffer.from(await file.arrayBuffer()),
);
await client.request("unlink", {
  expenseId: first.id,
  documentId: uploaded.id,
});
await client.request("unlink", {
  expenseId: second.id,
  documentId: uploaded.id,
});
assert.equal((await client.request("library")).length, 1);
await assert.rejects(() => client.download(uploaded));
await assert.rejects(() =>
  client.upload(
    first.id,
    new File(["x"], "x.exe", { type: "application/octet-stream" }),
  ),
);
await assert.rejects(() =>
  client.upload(
    first.id,
    new File([new Uint8Array(10485761)], "x.pdf", { type: "application/pdf" }),
  ),
);
assert.equal(JSON.stringify(demoExpenses), before);
assert.equal(
  (
    await (
      await createDemoDocumentClient()
    ).request("list", undefined, { expenseId: first.id })
  )[0].associationCount,
  2,
);
console.log(
  "PASS: network-free demo, shared document, upload/dedup, open/download bytes, unlink/last removal, file limits, reset, financial fixtures unchanged.",
);
