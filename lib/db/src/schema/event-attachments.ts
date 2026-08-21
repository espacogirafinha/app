import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const eventAttachmentsTable = pgTable("event_attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  storagePath: text("storage_path").notNull().unique(),
  originalFilename: text("original_filename").notNull(),
  mimeType: text("mime_type").notNull(),
  caption: text("caption"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertEventAttachmentSchema = createInsertSchema(
  eventAttachmentsTable,
).omit({
  id: true,
  createdAt: true,
});

export type InsertEventAttachment = z.infer<typeof insertEventAttachmentSchema>;
export type EventAttachment = typeof eventAttachmentsTable.$inferSelect;
