import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const inventoryItemsTable = pgTable(
  "inventory_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemType: text("item_type").notNull(),
    name: text("name").notNull(),
    category: text("category"),
    brand: text("brand"),
    color: text("color"),
    size: text("size"),
    unit: text("unit").notNull().default("unidade"),
    minimumStock: numeric("minimum_stock", { precision: 12, scale: 3 }),
    location: text("location"),
    referenceCost: numeric("reference_cost", { precision: 12, scale: 4 }),
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    check("inventory_items_type_check", sql`${t.itemType} in ('consumable', 'material')`),
    check("inventory_items_name_not_blank", sql`btrim(${t.name}) <> ''`),
    check("inventory_items_unit_not_blank", sql`btrim(${t.unit}) <> ''`),
    check(
      "inventory_items_minimum_stock_nonnegative",
      sql`${t.minimumStock} is null or ${t.minimumStock} >= 0`,
    ),
    check(
      "inventory_items_reference_cost_nonnegative",
      sql`${t.referenceCost} is null or ${t.referenceCost} >= 0`,
    ),
    index("inventory_items_type_active_idx").on(t.itemType, t.isActive),
    index("inventory_items_category_idx").on(t.category),
  ],
);

export const inventoryMovementsTable = pgTable(
  "inventory_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => inventoryItemsTable.id, { onDelete: "restrict" }),
    quantityDelta: numeric("quantity_delta", { precision: 12, scale: 3 }).notNull(),
    reason: text("reason").notNull(),
    note: text("note"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("inventory_movements_quantity_nonzero", sql`${t.quantityDelta} <> 0`),
    check(
      "inventory_movements_reason_check",
      sql`${t.reason} in ('initial_stock', 'purchase', 'usage', 'correction', 'damaged', 'lost', 'return')`,
    ),
    index("inventory_movements_item_occurred_idx").on(t.itemId, t.occurredAt),
  ],
);

export const insertInventoryItemSchema = createInsertSchema(inventoryItemsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertInventoryMovementSchema = createInsertSchema(inventoryMovementsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertInventoryItem = z.infer<typeof insertInventoryItemSchema>;
export type InventoryItem = typeof inventoryItemsTable.$inferSelect;
export type InsertInventoryMovement = z.infer<typeof insertInventoryMovementSchema>;
export type InventoryMovement = typeof inventoryMovementsTable.$inferSelect;
