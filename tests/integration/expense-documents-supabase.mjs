// Runs ONLY against a disposable local Supabase started in CI. No remote project access.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createHash, randomUUID } from "node:crypto";
const config = JSON.parse(
  await readFile(process.env.DOCUMENT_SUPABASE_STATUS_FILE, "utf8"),
);
const base = config.API_URL;
const database = config.DB_URL;
if (
  new URL(base).hostname !== "127.0.0.1" ||
  new URL(database).hostname !== "127.0.0.1"
)
  throw new Error("Disposable localhost Supabase required");
const { Pool } = createRequire(
  new URL("../../lib/db/package.json", import.meta.url),
)("pg");
const sql = new Pool({ connectionString: database });
process.env.DATABASE_URL = database;
process.env.SUPABASE_URL = base;
process.env.SUPABASE_ANON_KEY = config.ANON_KEY;
const adminHeaders = {
  apikey: config.SERVICE_ROLE_KEY,
  Authorization: `Bearer ${config.SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
};
const password = `Fixture-${randomUUID()}!`;
async function user(email) {
  let response = await fetch(`${base}/auth/v1/admin/users`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  assert.equal(response.status, 200);
  const created = await response.json();
  response = await fetch(`${base}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: config.ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(response.status, 200);
  return { id: created.id, ...(await response.json()) };
}
const owner = await user("documents-owner@example.test"),
  outsider = await user("documents-outsider@example.test");
await sql.query(
  `create schema app_private;create table app_private.user_roles(user_id uuid primary key,role text not null);create table public.expenses(id uuid primary key,amount numeric(10,2),description text,deleted_at timestamptz,updated_at timestamptz default now());`,
);
await sql.query("insert into app_private.user_roles values($1,$2)", [
  owner.id,
  "admin",
]);
await sql.query(
  await readFile(
    "supabase/migrations/20261023180715_expense_documents.sql",
    "utf8",
  ),
);
const expense1 = randomUUID(),
  expense2 = randomUUID();
await sql.query(
  "insert into public.expenses(id,amount,description) values($1,8.40,'Margarete fixture'),($2,45.68,'Stock fixture')",
  [expense1, expense2],
);
const before = (await sql.query("select * from public.expenses order by id"))
  .rows;
const { default: app } =
  await import("../../artifacts/api-server/dist/app.mjs");
const server = app.listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const api = `http://127.0.0.1:${server.address().port}`;
async function action(name, body, who = owner, query = {}) {
  const response = await fetch(
    `${api}/api/expenses?${new URLSearchParams({ documentAction: name, ...query })}`,
    {
      method: body ? "POST" : "GET",
      headers: {
        ...(who ? { Authorization: `Bearer ${who.access_token}` } : {}),
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    },
  );
  return { status: response.status, data: await response.json() };
}
const storageHeaders = {
  apikey: config.ANON_KEY,
  Authorization: `Bearer ${owner.access_token}`,
};
try {
  assert.equal((await action("counts", undefined, null)).status, 401);
  assert.equal((await action("counts", undefined, outsider)).status, 403);
  const pdf = Buffer.from("%PDF-1.7\nFAC 06208202601/005618\n54.08");
  let shared;
  for (const [filename, mimeType, bytes] of [
    ["talao.jpg", "image/jpeg", Buffer.from([255, 216, 255, 224])],
    ["talao.png", "image/png", Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])],
    ["talao.webp", "image/webp", Buffer.from("RIFF0000WEBP")],
    ["Makro.pdf", "application/pdf", pdf],
  ]) {
    const metadata = {
      filename,
      mimeType,
      size: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };
    const prepared = await action("prepare", { expenseId: expense1, metadata });
    assert.equal(prepared.status, 200);
    assert.equal(prepared.data.upload, true);
    const doc = prepared.data.document;
    const upload = await fetch(
      `${base}/storage/v1/object/expense-documents/${doc.storagePath}`,
      {
        method: "POST",
        headers: { ...storageHeaders, "Content-Type": mimeType },
        body: bytes,
      },
    );
    assert.equal(
      upload.ok,
      true,
      `Storage upload ${filename}: ${await upload.text()}`,
    );
    const finalized = await action("finalize", {
      expenseId: expense1,
      documentId: doc.id,
    });
    assert.equal(finalized.status, 200, JSON.stringify(finalized.data));
    const downloaded = await fetch(
      `${base}/storage/v1/object/authenticated/expense-documents/${doc.storagePath}`,
      { headers: storageHeaders },
    );
    assert.equal(downloaded.status, 200);
    assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), bytes);
    const anonymous = await fetch(
      `${base}/storage/v1/object/authenticated/expense-documents/${doc.storagePath}`,
      { headers: { apikey: config.ANON_KEY } },
    );
    assert.equal(anonymous.ok, false);
    const unauthorized = await fetch(
      `${base}/storage/v1/object/authenticated/expense-documents/${doc.storagePath}`,
      {
        headers: {
          apikey: config.ANON_KEY,
          Authorization: `Bearer ${outsider.access_token}`,
        },
      },
    );
    assert.equal(unauthorized.ok, false);
    const publicRead = await fetch(
      `${base}/storage/v1/object/public/expense-documents/${doc.storagePath}`,
    );
    assert.equal(publicRead.ok, false);
    const overwrite = await fetch(
      `${base}/storage/v1/object/expense-documents/${doc.storagePath}`,
      {
        method: "PUT",
        headers: { ...storageHeaders, "Content-Type": mimeType },
        body: bytes,
      },
    );
    assert.equal(overwrite.ok, false);
    if (mimeType === "application/pdf") {
      shared = doc;
      const reuse = await action("prepare", { expenseId: expense2, metadata });
      assert.equal(reuse.data.upload, false);
      assert.equal(reuse.data.document.id, doc.id);
      assert.equal(
        (
          await sql.query(
            "select count(*)::int n from storage.objects where bucket_id='expense-documents'",
          )
        ).rows[0].n,
        1,
      );
    }
    const removed = await action("unlink", {
      expenseId: expense1,
      documentId: doc.id,
    });
    assert.equal(removed.status, 200);
    assert.equal(removed.data.cleanupPending, false);
    const objects = (
      await sql.query(
        "select count(*)::int n from storage.objects where bucket_id='expense-documents'",
      )
    ).rows[0].n;
    assert.equal(objects, mimeType === "application/pdf" ? 1 : 0);
  }
  const reopened = await action("list", undefined, owner, {
    expenseId: expense2,
  });
  assert.equal(reopened.data.length, 1);
  assert.equal(reopened.data[0].id, shared.id);
  assert.equal(
    (await action("unlink", { expenseId: expense2, documentId: shared.id }))
      .data.cleanupPending,
    false,
  );
  assert.equal(
    (
      await sql.query(
        "select count(*)::int n from storage.objects where bucket_id='expense-documents'",
      )
    ).rows[0].n,
    0,
  );
  assert.deepEqual(
    (await sql.query("select * from public.expenses order by id")).rows,
    before,
  );
  assert.equal(
    (
      await action("prepare", {
        expenseId: expense1,
        metadata: {
          filename: "large.pdf",
          mimeType: "application/pdf",
          size: 10485761,
          sha256: "a".repeat(64),
        },
      })
    ).status,
    400,
  );
  console.log(
    "PASS: real Express + Supabase Auth + private Storage; JPG/PNG/WEBP/PDF upload/read, no public access, roles, immutable files, shared PDF, persistence, final object removal, identical financial snapshot.",
  );
} finally {
  await new Promise((r) => server.close(r));
  await sql.end();
}

process.exit(0);
