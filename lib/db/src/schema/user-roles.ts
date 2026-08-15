import { sql } from "drizzle-orm";
import { check, pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const appPrivateSchema = pgSchema("app_private");

export const userRolesTable = appPrivateSchema.table(
  "user_roles",
  {
    userId: uuid("user_id").primaryKey(),
    role: text("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    check("user_roles_role_check", sql`${table.role} in ('admin', 'staff')`),
  ],
);

export type UserRole = "admin" | "staff";
export type UserRoleRecord = Omit<
  typeof userRolesTable.$inferSelect,
  "role"
> & {
  role: UserRole;
};
export type InsertUserRole = Omit<
  typeof userRolesTable.$inferInsert,
  "role"
> & {
  role: UserRole;
};
