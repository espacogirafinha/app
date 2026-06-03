import { boolean, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const checklistTemplatesTable = pgTable("checklist_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  module: text("module").notNull(),
  eventType: text("event_type"),
  serviceType: text("service_type"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()),
});

export const checklistTemplateItemsTable = pgTable("checklist_template_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  templateId: uuid("template_id").notNull().references(() => checklistTemplatesTable.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  description: text("description"),
  isRequired: boolean("is_required").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()),
});

export const eventChecklistsTable = pgTable("event_checklists", {
  id: uuid("id").primaryKey().defaultRandom(),
  module: text("module").notNull(),
  entityId: uuid("entity_id").notNull(),
  templateId: uuid("template_id").references(() => checklistTemplatesTable.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()),
});

export const eventChecklistItemsTable = pgTable("event_checklist_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  checklistId: uuid("checklist_id").notNull().references(() => eventChecklistsTable.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  description: text("description"),
  isRequired: boolean("is_required").notNull().default(false),
  isDone: boolean("is_done").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()),
});

export const insertChecklistTemplateSchema = createInsertSchema(checklistTemplatesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertChecklistTemplateItemSchema = createInsertSchema(checklistTemplateItemsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEventChecklistSchema = createInsertSchema(eventChecklistsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEventChecklistItemSchema = createInsertSchema(eventChecklistItemsTable).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertChecklistTemplate = z.infer<typeof insertChecklistTemplateSchema>;
export type ChecklistTemplate = typeof checklistTemplatesTable.$inferSelect;
export type InsertChecklistTemplateItem = z.infer<typeof insertChecklistTemplateItemSchema>;
export type ChecklistTemplateItem = typeof checklistTemplateItemsTable.$inferSelect;
export type InsertEventChecklist = z.infer<typeof insertEventChecklistSchema>;
export type EventChecklist = typeof eventChecklistsTable.$inferSelect;
export type InsertEventChecklistItem = z.infer<typeof insertEventChecklistItemSchema>;
export type EventChecklistItem = typeof eventChecklistItemsTable.$inferSelect;
