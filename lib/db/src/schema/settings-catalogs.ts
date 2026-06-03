import { boolean, integer, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const venuePacksTable = pgTable("venue_packs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  basePrice: numeric("base_price", { precision: 10, scale: 2 }).notNull().default("0"),
  defaultStartTime: text("default_start_time"),
  defaultEndTime: text("default_end_time"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  internalNotes: text("internal_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()),
});

export const externalServiceCatalogTable = pgTable("external_service_catalog", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  basePrice: numeric("base_price", { precision: 10, scale: 2 }).notNull().default("0"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  operationalNotes: text("operational_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()),
});

export const eventExtrasTable = pgTable("event_extras", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  category: text("category"),
  basePrice: numeric("base_price", { precision: 10, scale: 2 }).notNull().default("0"),
  appliesTo: text("applies_to").notNull().default("all"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  internalNotes: text("internal_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()),
});

export const messageTemplatesTable = pgTable("message_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  module: text("module").notNull(),
  triggerType: text("trigger_type").notNull(),
  body: text("body").notNull(),
  variables: text("variables"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()),
});

export const insertVenuePackSchema = createInsertSchema(venuePacksTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertExternalServiceCatalogSchema = createInsertSchema(externalServiceCatalogTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEventExtraSchema = createInsertSchema(eventExtrasTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});


export const insertMessageTemplateSchema = createInsertSchema(messageTemplatesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertVenuePack = z.infer<typeof insertVenuePackSchema>;
export type VenuePack = typeof venuePacksTable.$inferSelect;

export type InsertExternalServiceCatalog = z.infer<typeof insertExternalServiceCatalogSchema>;
export type ExternalServiceCatalog = typeof externalServiceCatalogTable.$inferSelect;

export type InsertEventExtra = z.infer<typeof insertEventExtraSchema>;
export type EventExtra = typeof eventExtrasTable.$inferSelect;

export type InsertMessageTemplate = z.infer<typeof insertMessageTemplateSchema>;
export type MessageTemplate = typeof messageTemplatesTable.$inferSelect;
