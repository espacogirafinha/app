import { boolean, date, integer, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const venueEventsTable = pgTable("venue_events", {
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
  packName: text("pack_name").notNull(),
  packEstimatedCost: numeric("pack_estimated_cost", { precision: 10, scale: 2 }),
  birthdayChildName: text("birthday_child_name"),
  birthdayChildAge: integer("birthday_child_age"),
  childrenCount: integer("children_count").default(0),
  childrenAges: text("children_ages"),
  partyTheme: text("party_theme"),
  decorationNotes: text("decoration_notes"),
  cateringNotes: text("catering_notes"),
  allergies: text("allergies"),
  imageAuthorization: text("image_authorization"),
  termsAccepted: boolean("terms_accepted").default(false),
  totalPrice: numeric("total_price", { precision: 10, scale: 2 }).notNull().default("0"),
  expectedReservationDepositAmount: numeric("expected_reservation_deposit_amount", { precision: 10, scale: 2 }),
  reservationDepositPolicy: text("reservation_deposit_policy").notNull().default("auto_20"),
  amountPaid: numeric("amount_paid", { precision: 10, scale: 2 }).notNull().default("0"),
  paymentMethod: text("payment_method"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()),
});

export const insertVenueEventSchema = createInsertSchema(venueEventsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertVenueEvent = z.infer<typeof insertVenueEventSchema>;
export type VenueEvent = typeof venueEventsTable.$inferSelect;
