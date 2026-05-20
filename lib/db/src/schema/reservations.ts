import { boolean, pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const reservationsTable = pgTable("reservations", {
  id: serial("id").primaryKey(),
  customerName: text("customer_name").notNull(),
  phone: text("phone").notNull(),
  eventDate: text("event_date").notNull(),
  eventTime: text("event_time").notNull(),
  pack: text("pack").notNull(),
  numChildren: integer("num_children").notNull(),
  childrenAges: text("children_ages").notNull(),
  extras: text("extras"),
  notes: text("notes"),
  totalPrice: numeric("total_price", { precision: 10, scale: 2 }).notNull(),
  amountPaid: numeric("amount_paid", { precision: 10, scale: 2 }).notNull(),
  reservationType: text("reservation_type").notNull().default("venue_party"),
  customerEmail: text("customer_email"),
  customerNif: text("customer_nif"),
  paymentMethod: text("payment_method"),
  reservationSource: text("reservation_source"),
  reservationStatus: text("reservation_status").notNull().default("draft"),
  birthdayChildName: text("birthday_child_name"),
  birthdayChildAge: integer("birthday_child_age"),
  partyTheme: text("party_theme"),
  decorationNotes: text("decoration_notes"),
  cateringOption: text("catering_option"),
  allergies: text("allergies"),
  imageAuthorization: text("image_authorization"),
  termsAccepted: boolean("terms_accepted"),
  eventLocation: text("event_location"),
  guestCount: integer("guest_count"),
  eventType: text("event_type"),
  eventTheme: text("event_theme"),
  externalServiceNotes: text("external_service_notes"),
  workshopName: text("workshop_name"),
  participantCount: integer("participant_count"),
  workshopNotes: text("workshop_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertReservationSchema = createInsertSchema(reservationsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertReservation = z.infer<typeof insertReservationSchema>;
export type Reservation = typeof reservationsTable.$inferSelect;
