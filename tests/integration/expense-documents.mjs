import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
const requireApi = createRequire(
  new URL("../../artifacts/api-server/package.json", import.meta.url),
);
const { build } = requireApi("esbuild");
const temp = await mkdtemp(`${tmpdir()}/girafinha-documents-`);
await build({
  entryPoints: ["artifacts/api-server/src/lib/expense-documents.ts"],
  outfile: `${temp}/service.mjs`,
  bundle: true,
  platform: "node",
  format: "esm",
});
const { ExpenseDocuments } = await import(pathToFileURL(`${temp}/service.mjs`));
let sql, close, pool;
if (process.env.PGLITE_MODULE) {
  const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE));
  const db = new PGlite();
  await db.waitReady;
  sql = {
    query: (text, params) =>
      params
        ? db.query(text, params)
        : db.exec(text).then((r) => r.at(-1) ?? { rows: [] }),
  };
  // PGlite shares one connection. Serialize checked-out clients like a real pool of size 1.
  let last = Promise.resolve();
  pool = {
    ...sql,
    connect: async () => {
      let release;
      const prior = last;
      last = new Promise((r) => {
        release = r;
      });
      await prior;
      return { ...sql, release };
    },
  };
  close = () => db.close();
} else {
  const url = process.env.DOCUMENT_TEST_DATABASE_URL;
  if (!url || !["localhost", "127.0.0.1"].includes(new URL(url).hostname))
    throw new Error(
      "Only an explicitly configured disposable localhost PostgreSQL is allowed",
    );
  const { Pool } = createRequire(
    new URL("../../lib/db/package.json", import.meta.url),
  )("pg");
  pool = new Pool({ connectionString: url, max: 1 });
  sql = pool;
  close = () => pool.end();
}
const fixture = `
create role anon; create role authenticated;
create schema auth; create schema app_private; create schema storage;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth,storage to authenticated,anon;
grant execute on function auth.uid() to authenticated,anon;
create table app_private.user_roles(user_id uuid primary key,role text not null);
create table public.expenses(id uuid primary key,amount numeric(10,2),description text,deleted_at timestamptz,venue_event_id uuid,updated_at timestamptz default now());
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,unique(bucket_id,name));
alter table storage.objects enable row level security;
grant select,insert,update,delete on storage.objects to authenticated,anon;
`;
try {
  await sql.query(fixture);
  await sql.query(
    await readFile(
      "supabase/migrations/20261023180715_expense_documents.sql",
      "utf8",
    ),
  );
  const user = randomUUID(),
    stranger = randomUUID(),
    expense1 = randomUUID(),
    expense2 = randomUUID();
  await sql.query("insert into auth.users values($1),($2)", [user, stranger]);
  await sql.query("insert into app_private.user_roles values($1,'admin')", [
    user,
  ]);
  await sql.query(
    "insert into public.expenses(id,amount,description,venue_event_id) values($1,8.40,'Catering Margarete',$3),($2,45.68,'Stock',null)",
    [expense1, expense2, randomUUID()],
  );
  const before = (await sql.query("select * from public.expenses order by id"))
    .rows;
  const files = new Map();
  let failDelete = false;
  const storage = {
    read: async (p) => {
      if (!files.has(p)) throw new Error("missing");
      return files.get(p);
    },
    remove: async (p) => {
      if (failDelete) throw new Error("offline");
      files.delete(p);
    },
  };
  const service = new ExpenseDocuments(pool, storage, user);
  const bytes = Buffer.from("%PDF-1.7\nFAC 06208202601/005618\n54.08");
  const metadata = {
    filename: "Makro-23-10-2026.pdf",
    mimeType: "application/pdf",
    size: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
  const prepared = await service.prepare(expense1, metadata);
  assert.equal(prepared.upload, true);
  files.set(prepared.document.storagePath, bytes);
  await service.finalize(expense1, prepared.document.id);
  assert.equal((await service.list(expense1)).length, 1);
  const reuse = await service.prepare(expense2, metadata);
  assert.equal(reuse.upload, false);
  assert.equal(reuse.document.id, prepared.document.id);
  assert.equal(files.size, 1);
  assert.equal((await service.list(expense2))[0].associationCount, 2);
  await service.unlink(expense1, prepared.document.id);
  assert.equal(files.size, 1);
  assert.equal((await service.list(expense2)).length, 1);
  assert.equal((await service.list(expense1)).length, 0);
  const secondService = new ExpenseDocuments(pool, storage, user);
  assert.equal((await secondService.list(expense2)).length, 1);
  await service.link(expense1, prepared.document.id);
  await service.link(expense1, prepared.document.id);
  assert.equal((await service.list(expense1)).length, 1);
  assert.deepEqual(await service.counts([expense1, expense2]), {
    [expense1]: 1,
    [expense2]: 1,
  });
  await service.unlink(expense1, prepared.document.id);
  failDelete = true;
  assert.equal(
    (await service.unlink(expense2, prepared.document.id)).cleanupPending,
    true,
  );
  assert.equal(files.size, 1);
  assert.equal(
    (
      await sql.query(
        "select status from public.expense_documents where id=$1",
        [prepared.document.id],
      )
    ).rows[0].status,
    "deleting",
  );
  failDelete = false;
  await service.cleanup();
  assert.equal(files.size, 0);
  assert.equal(
    (
      await sql.query(
        "select status from public.expense_documents where id=$1",
        [prepared.document.id],
      )
    ).rows[0].status,
    "deleted",
  );
  const reupload = await service.prepare(expense1, metadata);
  assert.notEqual(reupload.document.id, prepared.document.id);
  await service.abort(reupload.document.id);
  for (const [filename, mimeType, data] of [
    ["foto.jpg", "image/jpeg", Buffer.from([255, 216, 255, 224])],
    ["foto.png", "image/png", Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])],
    ["foto.webp", "image/webp", Buffer.from("RIFF0000WEBP")],
  ]) {
    const m = {
      filename,
      mimeType,
      size: data.length,
      sha256: createHash("sha256").update(data).digest("hex"),
    };
    const p = await service.prepare(expense1, m);
    files.set(p.document.storagePath, data);
    await service.finalize(expense1, p.document.id);
    assert.equal((await service.list(expense1)).length, 1);
    await service.unlink(expense1, p.document.id);
  }
  // Both finalizers read pending before either enters its transaction.
  const concurrent = await service.prepare(expense1, metadata);
  files.set(concurrent.document.storagePath, bytes);
  let reads = 0,
    release;
  const barrier = new Promise((resolve) => {
    release = resolve;
  });
  const concurrentService = new ExpenseDocuments(
    pool,
    {
      ...storage,
      read: async (path) => {
        if (++reads === 2) release();
        await barrier;
        return storage.read(path);
      },
    },
    user,
  );
  await Promise.all([
    concurrentService.finalize(expense1, concurrent.document.id),
    concurrentService.finalize(expense2, concurrent.document.id),
  ]);
  assert.equal((await service.list(expense1))[0].associationCount, 2);
  await service.unlink(expense1, concurrent.document.id);
  await service.unlink(expense2, concurrent.document.id);
  // Preserve audit receipts when an expense is annulled, but allow explicit detach.
  const archived = randomUUID();
  await sql.query(
    "insert into public.expenses(id,amount,description,deleted_at) values($1,1,'Archived fixture',now())",
    [archived],
  );
  const retained = await service.prepare(expense1, metadata);
  files.set(retained.document.storagePath, bytes);
  await service.finalize(expense1, retained.document.id);
  await sql.query(
    "insert into public.expense_document_links(expense_id,document_id) values($1,$2)",
    [archived, retained.document.id],
  );
  await service.unlink(expense1, retained.document.id);
  assert.equal(files.size, 1);
  assert.equal((await service.list(archived)).length, 1);
  await service.unlink(archived, retained.document.id);
  assert.equal(files.size, 0);
  await sql.query("delete from public.expenses where id=$1", [archived]);
  const bad = await service.prepare(expense1, metadata);
  files.set(bad.document.storagePath, Buffer.from("spoof"));
  await assert.rejects(() => service.finalize(expense1, bad.document.id));
  assert.equal(files.size, 0);
  await assert.rejects(() =>
    service.prepare(expense1, { ...metadata, size: 10485761 }),
  );
  await assert.rejects(() => service.link(randomUUID(), prepared.document.id));
  // RLS: unknown authenticated user cannot read metadata, upload, or read another role's files.
  const pending = await service.prepare(expense1, metadata);
  await sql.query(
    "insert into storage.objects(bucket_id,name) values('expense-documents',$1)",
    [pending.document.storagePath],
  );
  await sql.query("set role authenticated");
  await sql.query("select set_config('request.jwt.claim.sub',$1,false)", [
    stranger,
  ]);
  assert.equal(
    (await sql.query("select * from public.expense_documents")).rows.length,
    0,
  );
  assert.equal(
    (
      await sql.query(
        "select * from storage.objects where bucket_id='expense-documents'",
      )
    ).rows.length,
    0,
  );
  await assert.rejects(() =>
    sql.query(
      "insert into storage.objects(bucket_id,name) values('expense-documents','forged.pdf')",
    ),
  );
  await assert.rejects(() =>
    sql.query(
      "insert into public.expense_document_links(expense_id,document_id) values($1,$2)",
      [expense1, pending.document.id],
    ),
  );
  await sql.query("select set_config('request.jwt.claim.sub',$1,false)", [
    user,
  ]);
  assert.equal(
    (await sql.query("select * from public.expense_documents")).rows.length > 0,
    true,
  );
  assert.equal(
    (
      await sql.query(
        "select * from storage.objects where bucket_id='expense-documents'",
      )
    ).rows.length,
    1,
  );
  assert.equal(
    (
      await sql.query(
        "delete from storage.objects where bucket_id='expense-documents' returning *",
      )
    ).rows.length,
    0,
  );
  assert.equal(
    (await sql.query("update storage.objects set name='changed' returning *"))
      .rows.length,
    0,
  );
  await sql.query("reset role");
  await sql.query("set role anon");
  await assert.rejects(() =>
    sql.query("select * from public.expense_documents"),
  );
  assert.equal(
    (await sql.query("select * from storage.objects")).rows.length,
    0,
  );
  await sql.query("reset role");
  assert.deepEqual(
    (await sql.query("select * from public.expenses order by id")).rows,
    before,
  );
  // Rollback must refuse to strand physical files.
  const rollback = await readFile(
    "docs/expense-documents/rollback.sql",
    "utf8",
  );
  await assert.rejects(() => sql.query(rollback));
  await sql.query("rollback");
  console.log(
    "PASS: PDF/JPG/PNG/WEBP, shared invoice, deduplication, idempotent links, reopen, last-link deletion, failure recovery, content spoofing, limits, RLS, financial snapshot unchanged.",
  );
  await sql.query(
    "delete from storage.objects where bucket_id='expense-documents'",
  );
  await sql.query(
    await readFile("docs/expense-documents/rollback.sql", "utf8"),
  );
  assert.equal(
    (await sql.query("select to_regclass('public.expense_documents') as name"))
      .rows[0].name,
    null,
  );
  console.log("PASS: reversible migration and guarded rollback.");
} finally {
  await close();
}
