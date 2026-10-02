import { sql } from "drizzle-orm";
import { boolean, check, index, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const INVENTORY_ITEM_TYPES = ["consumable", "material"] as const;
export const INVENTORY_UNITS = ["un","pacote","caixa","garrafa","lata","kg","g","L","ml","conjunto","outro"] as const;
export const INVENTORY_CONDITIONS = ["bom", "danificado", "em_reparacao"] as const;
export const INVENTORY_MOVEMENT_TYPES = ["entry", "exit", "adjustment"] as const;

export const inventoryItemsTable = pgTable(
  "inventory_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemType: text("item_type").notNull(),
    name: text("name").notNull(),
    category: text("category").notNull(),
    quantityCurrent: numeric("quantity_current", { precision: 12, scale: 3 }).notNull().default("0"),
    unit: text("unit").notNull(),
    minimumStock: numeric("minimum_stock", { precision: 12, scale: 3 }),
    unitCost: numeric("unit_cost", { precision: 12, scale: 2 }),
    photoPath: text("photo_path").unique(),
    color: text("color"),
    theme: text("theme"),
    location: text("location"),
    condition: text("condition"),
    purchaseCost: numeric("purchase_cost", { precision: 12, scale: 2 }),
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    check("inventory_items_type_check", sql`${t.itemType} in ('consumable', 'material')`),
    check("inventory_items_unit_check", sql`${t.unit} in ('un','pacote','caixa','garrafa','lata','kg','g','L','ml','conjunto','outro')`),
    check("inventory_items_name_not_blank", sql`btrim(${t.name}) <> ''`),
    check("inventory_items_category_not_blank", sql`btrim(${t.category}) <> ''`),
    check("inventory_items_quantity_non_negative", sql`${t.quantityCurrent} >= 0`),
    check("inventory_items_minimum_stock_non_negative", sql`${t.minimumStock} is null or ${t.minimumStock} >= 0`),
    check("inventory_items_unit_cost_non_negative", sql`${t.unitCost} is null or ${t.unitCost} >= 0`),
    check("inventory_items_purchase_cost_non_negative", sql`${t.purchaseCost} is null or ${t.purchaseCost} >= 0`),
    check("inventory_items_condition_check", sql`${t.condition} is null or ${t.condition} in ('bom', 'danificado', 'em_reparacao')`),
    index("inventory_items_type_active_idx").on(t.itemType, t.isActive),
    index("inventory_items_category_idx").on(t.category),
    index("inventory_items_location_idx").on(t.location),
    index("inventory_items_condition_idx").on(t.condition),
  ],
);

export const inventoryMovementsTable = pgTable(
  "inventory_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id").notNull().references(() => inventoryItemsTable.id, { onDelete: "restrict" }),
    movementType: text("movement_type").notNull(),
    quantityDelta: numeric("quantity_delta", { precision: 12, scale: 3 }).notNull(),
    quantityBefore: numeric("quantity_before", { precision: 12, scale: 3 }).notNull(),
    quantityAfter: numeric("quantity_after", { precision: 12, scale: 3 }).notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("inventory_movements_type_check", sql`${t.movementType} in ('entry', 'exit', 'adjustment')`),
    check("inventory_movements_delta_non_zero", sql`${t.quantityDelta} <> 0`),
    check("inventory_movements_before_non_negative", sql`${t.quantityBefore} >= 0`),
    check("inventory_movements_after_non_negative", sql`${t.quantityAfter} >= 0`),
    check("inventory_movements_balance_check", sql`${t.quantityAfter} = ${t.quantityBefore} + ${t.quantityDelta}`),
    index("inventory_movements_item_date_idx").on(t.itemId, t.occurredAt),
  ],
);

export const insertInventoryItemSchema = createInsertSchema(inventoryItemsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertInventoryMovementSchema = createInsertSchema(inventoryMovementsTable).omit({ id: true, createdAt: true });

export type InventoryItem = typeof inventoryItemsTable.$inferSelect;
export type InventoryMovement = typeof inventoryMovementsTable.$inferSelect;
export type InsertInventoryItem = z.infer<typeof insertInventoryItemSchema>;
export type InsertInventoryMovement = z.infer<typeof insertInventoryMovementSchema>;
