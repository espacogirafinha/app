import type { RequestHandler } from "express";
import { logger } from "./logger";

const SUPABASE_URL = process.env["SUPABASE_URL"];
const SUPABASE_ANON_KEY =
  process.env["SUPABASE_ANON_KEY"] ?? process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];

async function verifySupabaseBearerToken(token: string): Promise<string | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    logger.error("SUPABASE_URL and SUPABASE_ANON_KEY are required for API auth");
    return null;
  }

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

export const requireAuth: RequestHandler = (req, res, next) => {
  const header = req.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";

  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  verifySupabaseBearerToken(token)
    .then((email) => {
      if (!email) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      res.locals.userEmail = email;
      next();
    })
    .catch((err: unknown) => {
      logger.warn({ err }, "Failed to authorize Supabase token");
      res.status(401).json({ error: "Unauthorized" });
    });
};

logger.info("Auth initialized with Supabase Auth");
