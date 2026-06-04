import { integer, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { eventExtrasTable } from "./settings-catalogs";

export const eventSelectedExtrasTable = pgTable("event_selected_extras", {
  id: uuid("id").primaryKey().defaultRandom(),
  module: text("module").notNull(),
  entityId: uuid("entity_id").notNull(),
  extraId: uuid("extra_id").references(() => eventExtrasTable.id, { onDelete: "set null" }),
  extraName: text("extra_name").notNull(),
  category: text("category"),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull().default("0"),
  quantity: integer("quantity").notNull().default(1),
  totalPrice: numeric("total_price", { precision: 10, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()),
});

export const insertEventSelectedExtraSchema = createInsertSchema(eventSelectedExtrasTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertEventSelectedExtra = z.infer<typeof insertEventSelectedExtraSchema>;
export type EventSelectedExtra = typeof eventSelectedExtrasTable.$inferSelect;
