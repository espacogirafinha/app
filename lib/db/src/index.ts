import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

let usesSupabasePostgres = false;

function getConnectionString(value: string): string {
  const url = new URL(value);
  const directSupabaseHost = url.hostname.match(/^db\.([^.]+)\.supabase\.co$/);

  if (directSupabaseHost) {
    usesSupabasePostgres = true;
    const projectRef = directSupabaseHost[1];
    url.hostname = process.env.SUPABASE_DB_POOLER_HOST ?? "aws-1-eu-north-1.pooler.supabase.com";
    url.port = process.env.SUPABASE_DB_POOLER_PORT ?? "6543";

    const [user, password] = url.username.includes(".")
      ? [url.username, url.password]
      : [`${url.username}.${projectRef}`, url.password];

    url.username = user;
    url.password = password;
    url.searchParams.delete("sslmode");
  } else if (url.hostname.endsWith(".pooler.supabase.com")) {
    usesSupabasePostgres = true;
    url.searchParams.delete("sslmode");
  }

  return url.toString();
}

export const pool = new Pool({
  connectionString: getConnectionString(databaseUrl),
  ssl: usesSupabasePostgres ? { rejectUnauthorized: false } : undefined,
});
export const db = drizzle(pool, { schema });

export * from "./schema";
