import {
  boolean,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { venueEventsTable } from "./venue-events";
export const googleFormImportsTable = pgTable(
  "google_form_imports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    formId: text("form_id").notNull(),
    submissionId: text("submission_id").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull(),
    venueEventId: uuid("venue_event_id").references(() => venueEventsTable.id, {
      onDelete: "set null",
    }),
    status: text("status").notNull(),
    needsReview: boolean("needs_review").notNull().default(false),
    errorMessage: text("error_message"),
    payload: jsonb("payload").notNull(),
    payloadHash: text("payload_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("google_form_imports_unique_submission").on(
      t.formId,
      t.submissionId,
    ),
  ],
);
