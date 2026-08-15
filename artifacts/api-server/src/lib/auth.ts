import type { RequestHandler } from "express";
import { logger } from "./logger";

export type AuthenticatedIdentity = {
  id: string;
  email: string;
};

export type TokenVerifier = (
  token: string,
) => Promise<AuthenticatedIdentity | null>;

export async function verifySupabaseBearerToken(
  token: string,
  fetchImplementation: typeof fetch = fetch,
): Promise<AuthenticatedIdentity | null> {
  const supabaseUrl = process.env["SUPABASE_URL"];
  const supabaseAnonKey =
    process.env["SUPABASE_ANON_KEY"] ??
    process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];

  if (!supabaseUrl || !supabaseAnonKey) {
    logger.error(
      "SUPABASE_URL and SUPABASE_ANON_KEY are required for API auth",
    );
    return null;
  }

  try {
    const response = await fetchImplementation(
      `${supabaseUrl.replace(/\/+$/, "")}/auth/v1/user`,
      {
        headers: {
          apikey: supabaseAnonKey,
          authorization: `Bearer ${token}`,
        },
      },
    );

    if (!response.ok) return null;

    const data = (await response.json()) as { id?: unknown; email?: unknown };
    if (typeof data.id !== "string" || typeof data.email !== "string")
      return null;

    return { id: data.id, email: data.email };
  } catch (err) {
    logger.warn({ err }, "Unable to verify Supabase bearer token");
    return null;
  }
}

export function createRequireAuth(
  verifyToken: TokenVerifier = verifySupabaseBearerToken,
): RequestHandler {
  return async (req, res, next) => {
    const header = req.get("authorization");
    const token = header?.startsWith("Bearer ")
      ? header.slice("Bearer ".length).trim()
      : "";

    if (!token) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    try {
      const user = await verifyToken(token);
      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      res.locals.userId = user.id;
      res.locals.userEmail = user.email;
      next();
    } catch (err) {
      logger.warn({ err }, "Failed to authorize Supabase token");
      res.status(401).json({ error: "Unauthorized" });
    }
  };
}

export const requireAuth = createRequireAuth();

logger.info("Auth initialized with Supabase Auth");
