import { randomUUID } from "node:crypto";
import {
  DOCUMENT_BUCKET,
  DocumentError,
  validateDocumentMetadata,
  validateDocumentBytes,
  MAX_DOCUMENT_BYTES,
  type DocumentMetadata,
} from "./expense-document-validation";

type Row = Record<string, any>;
export type DocumentSql = {
  query: (sql: string, values?: any[]) => Promise<{ rows: Row[] }>;
};
export type DocumentPool = DocumentSql & {
  connect: () => Promise<DocumentSql & { release: () => void }>;
};
export type DocumentStorage = {
  read: (path: string) => Promise<Uint8Array>;
  remove: (path: string) => Promise<void>;
};
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function documentId(value: unknown): string {
  if (typeof value !== "string" || !uuidPattern.test(value))
    throw new DocumentError("Identificador inválido.");
  return value;
}
function dto(row: Row) {
  return {
    id: row.id,
    filename: row.filename,
    mimeType: row.mime_type,
    size: row.byte_size,
    storagePath: row.storage_path,
    associationCount: Number(row.association_count ?? 0),
  };
}
export function createDocumentStorage(token: string): DocumentStorage {
  const base = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const key =
    process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !key)
    throw new DocumentError(
      "Armazenamento de comprovativos indisponível.",
      503,
    );
  const headers = { apikey: key, Authorization: `Bearer ${token}` };
  return {
    async read(path) {
      const response = await fetch(
        `${base}/storage/v1/object/authenticated/${DOCUMENT_BUCKET}/${path}`,
        { headers, signal: AbortSignal.timeout(30_000) },
      );
      if (!response.ok)
        throw new DocumentError(
          "Não foi possível ler o carregamento. Tente novamente.",
          502,
        );
      const chunks: Uint8Array[] = [];
      let size = 0;
      if (!response.body) throw new DocumentError("Ficheiro vazio.");
      const reader = response.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > MAX_DOCUMENT_BYTES)
            throw new DocumentError("O ficheiro excede 10 MB.");
          chunks.push(value);
        }
      } finally {
        await reader.cancel();
      }
      return Buffer.concat(chunks);
    },
    async remove(path) {
      const response = await fetch(
        `${base}/storage/v1/object/${DOCUMENT_BUCKET}`,
        {
          method: "DELETE",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ prefixes: [path] }),
          signal: AbortSignal.timeout(15_000),
        },
      );
      if (!response.ok)
        throw new DocumentError(
          "A remoção do ficheiro será repetida automaticamente.",
          502,
        );
    },
  };
}
export class ExpenseDocuments {
  pool: DocumentPool;
  storage: DocumentStorage;
  userId: string;
  constructor(pool: DocumentPool, storage: DocumentStorage, userId: string) {
    this.pool = pool;
    this.storage = storage;
    this.userId = userId;
  }
  async locked<T>(operation: (sql: DocumentSql) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      await client.query(
        "select pg_advisory_xact_lock(hashtext('expense-documents'))",
      );
      const result = await operation(client);
      await client.query("commit");
      return result;
    } catch (e) {
      await client.query("rollback");
      throw e;
    } finally {
      client.release();
    }
  }
  async expense(sql: DocumentSql, id: string, includeDeleted = false) {
    const { rows } = await sql.query(
      "select id from public.expenses where id=$1 and ($2::boolean or deleted_at is null)",
      [documentId(id), includeDeleted],
    );
    if (!rows.length) throw new DocumentError("Despesa não encontrada.", 404);
  }
  async list(expenseId?: string, search = "") {
    if (expenseId) await this.expense(this.pool, expenseId, true);
    const { rows } = await this.pool.query(
      `select d.*, (select count(*) from public.expense_document_links l where l.document_id=d.id) as association_count
      from public.expense_documents d where d.status='ready'
      and ($1::uuid is null or exists(select 1 from public.expense_document_links l where l.document_id=d.id and l.expense_id=$1))
      and d.filename ilike $2 order by d.created_at desc limit 100`,
      [expenseId ?? null, `%${search.slice(0, 100)}%`],
    );
    return rows.map(dto);
  }
  async counts(ids: string[]) {
    if (ids.length > 500) throw new DocumentError("Demasiadas despesas.");
    ids.forEach(documentId);
    const { rows } = await this.pool.query(
      `select l.expense_id, count(*)::int as count from public.expense_document_links l join public.expense_documents d on d.id=l.document_id and d.status='ready' where l.expense_id=any($1::uuid[]) group by l.expense_id`,
      [ids],
    );
    return Object.fromEntries(rows.map((r) => [r.expense_id, r.count]));
  }
  async link(expenseId: string, id: string) {
    return this.locked(async (sql) => {
      await this.expense(sql, expenseId);
      const { rows } = await sql.query(
        "select * from public.expense_documents where id=$1 and status='ready'",
        [documentId(id)],
      );
      if (!rows.length)
        throw new DocumentError("Comprovativo não disponível.", 404);
      await sql.query(
        "insert into public.expense_document_links(expense_id,document_id) values($1,$2) on conflict do nothing",
        [expenseId, id],
      );
      return dto(rows[0]);
    });
  }
  async prepare(expenseId: string, metadata: DocumentMetadata) {
    validateDocumentMetadata(metadata);
    await this.cleanup();
    return this.locked(async (sql) => {
      await this.expense(sql, expenseId);
      const { rows } = await sql.query(
        "select * from public.expense_documents where sha256=$1 and status<>'deleted'",
        [metadata.sha256],
      );
      if (rows[0]?.status === "ready") {
        await sql.query(
          "insert into public.expense_document_links(expense_id,document_id) values($1,$2) on conflict do nothing",
          [expenseId, rows[0].id],
        );
        return { document: dto(rows[0]), upload: false };
      }
      if (rows.length) {
        if (rows[0].status !== "pending" || rows[0].created_by !== this.userId)
          throw new DocumentError(
            "Este ficheiro está a ser processado. Tente novamente.",
            409,
          );
        return { document: dto(rows[0]), upload: true };
      }
      const id = randomUUID();
      const path = `${id}/${metadata.sha256}.${metadata.filename.split(".").pop()!.toLowerCase()}`;
      const inserted = await sql.query(
        `insert into public.expense_documents(id,filename,mime_type,byte_size,sha256,storage_path,created_by) values($1,$2,$3,$4,$5,$6,$7) returning *`,
        [
          id,
          metadata.filename,
          metadata.mimeType,
          metadata.size,
          metadata.sha256,
          path,
          this.userId,
        ],
      );
      return { document: dto(inserted.rows[0]), upload: true };
    });
  }
  async finalize(expenseId: string, id: string) {
    documentId(id);
    const { rows } = await this.pool.query(
      "select * from public.expense_documents where id=$1 and status='pending' and created_by=$2",
      [id, this.userId],
    );
    if (!rows.length) return this.link(expenseId, id); // idempotent network retry after successful finalize
    const row = rows[0];
    const bytes = await this.storage.read(row.storage_path);
    try {
      validateDocumentBytes(bytes, {
        filename: row.filename,
        mimeType: row.mime_type,
        size: row.byte_size,
        sha256: row.sha256,
      });
    } catch (e) {
      await this.abort(id);
      throw e;
    }
    return this.locked(async (sql) => {
      await this.expense(sql, expenseId);
      const updated = await sql.query(
        "update public.expense_documents set status='ready' where id=$1 and status='pending' and created_by=$2 returning *",
        [id, this.userId],
      );
      if (!updated.rows.length) {
        const ready = await sql.query(
          "select * from public.expense_documents where id=$1 and status='ready'",
          [id],
        );
        if (!ready.rows.length)
          throw new DocumentError(
            "O carregamento foi cancelado. Volte a anexar.",
            409,
          );
        updated.rows.push(ready.rows[0]);
      }
      await sql.query(
        "insert into public.expense_document_links(expense_id,document_id) values($1,$2) on conflict do nothing",
        [expenseId, id],
      );
      return dto(updated.rows[0]);
    });
  }
  async unlink(expenseId: string, id: string) {
    await this.locked(async (sql) => {
      await this.expense(sql, expenseId, true);
      documentId(id);
      await sql.query(
        "delete from public.expense_document_links where expense_id=$1 and document_id=$2",
        [expenseId, id],
      );
      await sql.query(
        "update public.expense_documents d set status='deleting' where d.id=$1 and d.status='ready' and not exists(select 1 from public.expense_document_links l where l.document_id=d.id)",
        [id],
      );
    });
    return { cleanupPending: !(await this.removeFile(id)) };
  }
  async abort(id: string) {
    await this.locked((sql) =>
      sql.query(
        "update public.expense_documents set status='deleting' where id=$1 and status='pending' and created_by=$2",
        [documentId(id), this.userId],
      ),
    );
    return { cleanupPending: !(await this.removeFile(id)) };
  }
  async removeFile(id: string) {
    const { rows } = await this.pool.query(
      "select * from public.expense_documents where id=$1 and status='deleting'",
      [id],
    );
    if (!rows.length) return true;
    try {
      await this.storage.remove(rows[0].storage_path);
      await this.pool.query(
        "update public.expense_documents set status='deleted' where id=$1 and status='deleting'",
        [id],
      );
      return true;
    } catch {
      return false;
    } // keep metadata and retry, never forget a remaining object
  }
  async cleanup() {
    await this.locked((sql) =>
      sql.query(
        "update public.expense_documents set status='deleting' where status='pending' and created_at < now()-interval '24 hours'",
      ),
    );
    const { rows } = await this.pool.query(
      "select id from public.expense_documents where status='deleting' order by created_at limit 10",
    );
    for (const row of rows) await this.removeFile(row.id);
  }
}
