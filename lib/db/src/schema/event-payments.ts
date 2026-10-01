import { sql } from "drizzle-orm";
import {
  check,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { externalEventsTable } from "./external-events";
import { venueEventsTable } from "./venue-events";

export const eventPaymentsTable = pgTable(
  "event_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    venueEventId: uuid("venue_event_id").references(() => venueEventsTable.id, {
      onDelete: "cascade",
    }),
    externalEventId: uuid("external_event_id").references(() => externalEventsTable.id, {
      onDelete: "cascade",
    }),
    paymentType: text("payment_type").notNull(),
    amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
    paymentMethod: text("payment_method"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    reconciledAt: timestamp("reconciled_at", { withTimezone: true }),
    notes: text("notes"),
    source: text("source").notNull().default("manual"),
    sourceReference: text("source_reference"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    check(
      "event_payments_exactly_one_parent",
      sql`num_nonnulls(${t.venueEventId}, ${t.externalEventId}) = 1`,
    ),
    check(
      "event_payments_payment_type_check",
      sql`${t.paymentType} in ('reservation_deposit', 'payment', 'legacy_payment')`,
    ),
    check("event_payments_amount_positive", sql`${t.amount} > 0`),
    check(
      "event_payments_payment_method_check",
      sql`${t.paymentMethod} is null or ${t.paymentMethod} in ('cash', 'bank_transfer', 'mbway')`,
    ),
    check(
      "event_payments_manual_fields_check",
      sql`${t.source} <> 'manual' or (${t.paymentMethod} is not null and ${t.paidAt} is not null and ${t.paymentType} <> 'legacy_payment')`,
    ),
    check("event_payments_source_not_blank", sql`btrim(${t.source}) <> ''`),
    uniqueIndex("event_payments_source_reference_unique")
      .on(t.sourceReference)
      .where(sql`${t.sourceReference} is not null`),
    index("event_payments_venue_event_id_idx").on(t.venueEventId),
    index("event_payments_external_event_id_idx").on(t.externalEventId),
    index("event_payments_deleted_at_idx").on(t.deletedAt),
  ],
);

export const insertEventPaymentSchema = createInsertSchema(eventPaymentsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertEventPayment = z.infer<typeof insertEventPaymentSchema>;
export type EventPayment = typeof eventPaymentsTable.$inferSelect;
