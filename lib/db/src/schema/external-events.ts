import { date, integer, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const externalEventsTable = pgTable("external_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerName: text("customer_name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  nif: text("nif"),
  eventDate: date("event_date").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time"),
  status: text("status").notNull().default("draft"),
  paymentStatus: text("payment_status").notNull().default("unpaid"),
  source: text("source"),
  eventLocation: text("event_location"),
  guestCount: integer("guest_count").default(0),
  eventType: text("event_type"),
  eventTheme: text("event_theme"),
  setupNotes: text("setup_notes"),
  teardownNotes: text("teardown_notes"),
  accessNotes: text("access_notes"),
  totalPrice: numeric("total_price", { precision: 10, scale: 2 }).notNull().default("0"),
  amountPaid: numeric("amount_paid", { precision: 10, scale: 2 }).notNull().default("0"),
  refundableDepositAmount: numeric("refundable_deposit_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  refundableDepositStatus: text("refundable_deposit_status").notNull().default("not_required"),
  refundableDepositReceivedAt: timestamp("refundable_deposit_received_at", { withTimezone: true }),
  refundableDepositReturnedAt: timestamp("refundable_deposit_returned_at", { withTimezone: true }),
  refundableDepositNotes: text("refundable_deposit_notes"),
  paymentMethod: text("payment_method"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()),
});

export const externalEventServicesTable = pgTable("external_event_services", {
  id: uuid("id").primaryKey().defaultRandom(),
  externalEventId: uuid("external_event_id")
    .notNull()
    .references(() => externalEventsTable.id, { onDelete: "cascade" }),
  serviceType: text("service_type").notNull(),
  serviceLabel: text("service_label").notNull(),
  price: numeric("price", { precision: 10, scale: 2 }).default("0"),
  status: text("status").notNull().default("planned"),
  notes: text("notes"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()),
});

export const insertExternalEventSchema = createInsertSchema(externalEventsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertExternalEventServiceSchema = createInsertSchema(externalEventServicesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertExternalEvent = z.infer<typeof insertExternalEventSchema>;
export type ExternalEvent = typeof externalEventsTable.$inferSelect;

export type InsertExternalEventService = z.infer<typeof insertExternalEventServiceSchema>;
export type ExternalEventService = typeof externalEventServicesTable.$inferSelect;
