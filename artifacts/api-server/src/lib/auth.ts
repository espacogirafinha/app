import bcrypt from "bcryptjs";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import type { RequestHandler } from "express";
import { pool } from "@workspace/db";
import { logger } from "./logger";

const SESSION_SECRET = process.env["SESSION_SECRET"];
const ADMIN_EMAIL = process.env["ADMIN_EMAIL"];
const ADMIN_PASSWORD = process.env["ADMIN_PASSWORD"];

if (!SESSION_SECRET) {
  throw new Error("SESSION_SECRET environment variable is required");
}
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  throw new Error(
    "ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required",
  );
}

export const ADMIN_EMAIL_NORMALIZED = ADMIN_EMAIL.trim().toLowerCase();
const ADMIN_PASSWORD_HASH = bcrypt.hashSync(ADMIN_PASSWORD, 12);

export async function verifyCredentials(
  email: string,
  password: string,
): Promise<boolean> {
  const emailMatches = email.trim().toLowerCase() === ADMIN_EMAIL_NORMALIZED;
  const passwordMatches = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
  return emailMatches && passwordMatches;
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
  res.status(401).json({ error: "Unauthorized" });
};

logger.info("Auth initialized for single-user mode");
