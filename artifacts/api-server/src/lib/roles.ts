import type { RequestHandler } from "express";
import type { UserRole } from "@workspace/db";

export type { UserRole };

export type UserRoleLookup = (userId: string) => Promise<string | null>;
export type UserRoleResolver = (userId: string) => Promise<UserRole | null>;

function isUserRole(value: string | null): value is UserRole {
  return value === "admin" || value === "staff";
}

async function lookupUserRole(userId: string): Promise<string | null> {
  const [{ db, userRolesTable }, { eq }] = await Promise.all([
    import("@workspace/db"),
    import("drizzle-orm"),
  ]);
  const [row] = await db
    .select({ role: userRolesTable.role })
    .from(userRolesTable)
    .where(eq(userRolesTable.userId, userId))
    .limit(1);

  return row?.role ?? null;
}

export async function resolveUserRole(
  userId: string,
  lookup: UserRoleLookup = lookupUserRole,
): Promise<UserRole | null> {
  const role = await lookup(userId);
  return isUserRole(role) ? role : null;
}

export function createRequireRole(
  resolveRole: UserRoleResolver = resolveUserRole,
) {
  return (...allowedRoles: UserRole[]): RequestHandler => {
    const allowed = new Set(allowedRoles);

    return async (_req, res, next) => {
      const userId = res.locals.userId;
      if (typeof userId !== "string" || !userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      try {
        const role = await resolveRole(userId);
        if (!role || !allowed.has(role)) {
          res.status(403).json({ error: "Forbidden" });
          return;
        }

        res.locals.userRole = role;
        next();
      } catch (error) {
        next(error);
      }
    };
  };
}

export const requireRole = createRequireRole();
