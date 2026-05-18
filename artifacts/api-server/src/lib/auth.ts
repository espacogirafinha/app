import bcrypt from "bcryptjs";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import type { RequestHandler } from "express";
import { pool } from "@workspace/db";
import { logger } from "./logger";

const SESSION_SECRET = process.env["SESSION_SECRET"];
const ADMIN_EMAIL = process.env["ADMIN_EMAIL"];
const ADMIN_PASSWORD = process.env["ADMIN_PASSWORD"];
const SUPABASE_URL = process.env["SUPABASE_URL"];
const SUPABASE_ANON_KEY = process.env["SUPABASE_ANON_KEY"] ?? process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];

if (!SESSION_SECRET) {
  throw new Error("SESSION_SECRET environment variable is required");
}

export const ADMIN_EMAIL_NORMALIZED = ADMIN_EMAIL?.trim().toLowerCase() ?? null;
const ADMIN_PASSWORD_HASH = ADMIN_PASSWORD ? bcrypt.hashSync(ADMIN_PASSWORD, 12) : null;

export async function verifyCredentials(
  email: string,
  password: string,
): Promise<boolean> {
  const normalizedEmail = email.trim().toLowerCase();

  try {
    const { rows } = await pool.query<{ password_hash: string }>(
      "select password_hash from app_users where lower(email) = $1 and active = true limit 1",
      [normalizedEmail],
    );
    const user = rows[0];
    if (user) {
      return bcrypt.compare(password, user.password_hash);
    }
  } catch (err) {
    logger.warn({ err }, "Unable to verify app user from database");
  }

  if (!ADMIN_EMAIL_NORMALIZED || !ADMIN_PASSWORD_HASH) return false;

  const emailMatches = normalizedEmail === ADMIN_EMAIL_NORMALIZED;
  const passwordMatches = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
  return emailMatches && passwordMatches;
}

async function verifySupabaseBearerToken(token: string): Promise<string | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;

  try {
    const response = await fetch(`${SUPABASE_URL.replace(/\/+$/, "")}/auth/v1/user`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) return null;

    const data = (await response.json()) as { email?: unknown };
    return typeof data.email === "string" ? data.email : null;
  } catch (err) {
    logger.warn({ err }, "Unable to verify Supabase bearer token");
    return null;
  }
}

const PgStore = connectPgSimple(session);

const isProd = process.env["NODE_ENV"] === "production";

export const sessionMiddleware: RequestHandler = session({
  store: new PgStore({
    pool,
    tableName: "user_sessions",
    createTableIfMissing: false,
  }),
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  proxy: true,
  cookie: {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 24 * 30,
  },
});

declare module "express-session" {
  interface SessionData {
    userEmail?: string;
  }
}

export const requireAuth: RequestHandler = (req, res, next) => {
  if (req.session?.userEmail) {
    next();
    return;
  }

  const header = req.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";

  if (token) {
    verifySupabaseBearerToken(token)
      .then((email) => {
        if (email) {
          req.session.userEmail = email;
          next();
          return;
        }

        res.status(401).json({ error: "Unauthorized" });
      })
      .catch((err: unknown) => {
        logger.warn({ err }, "Failed to authorize Supabase token");
        res.status(401).json({ error: "Unauthorized" });
      });
    return;
  }

  res.status(401).json({ error: "Unauthorized" });
};

logger.info("Auth initialized for single-user mode");
