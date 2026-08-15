import type { UserRole } from "@workspace/db";

export type { UserRole };

export type UserRoleLookup = (userId: string) => Promise<string | null>;

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
