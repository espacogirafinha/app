import { boolean, date, integer, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const workshopsTable = pgTable("workshops", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  date: date("date").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time"),
  capacity: integer("capacity").notNull().default(0),
  price: numeric("price", { precision: 10, scale: 2 }).notNull().default("0"),
  kitIncluded: boolean("kit_included").notNull().default(false),
  status: text("status").notNull().default("draft"),
  location: text("location"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()),
});

export const workshopParticipantsTable = pgTable("workshop_participants", {
  id: uuid("id").primaryKey().defaultRandom(),
  workshopId: uuid("workshop_id")
    .notNull()
    .references(() => workshopsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  nif: text("nif"),
  amountPaid: numeric("amount_paid", { precision: 10, scale: 2 }).notNull().default("0"),
  amountDue: numeric("amount_due", { precision: 10, scale: 2 }).notNull().default("0"),
  paymentMethod: text("payment_method"),
  paymentStatus: text("payment_status").notNull().default("unpaid"),
  status: text("status").notNull().default("registered"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()),
});

export const insertWorkshopSchema = createInsertSchema(workshopsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWorkshopParticipantSchema = createInsertSchema(workshopParticipantsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertWorkshop = z.infer<typeof insertWorkshopSchema>;
export type Workshop = typeof workshopsTable.$inferSelect;

export type InsertWorkshopParticipant = z.infer<typeof insertWorkshopParticipantSchema>;
export type WorkshopParticipant = typeof workshopParticipantsTable.$inferSelect;
