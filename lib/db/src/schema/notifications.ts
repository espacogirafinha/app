import {
  index,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { appPrivateSchema } from "./user-roles";

export const notificationsTable = appPrivateSchema.table(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type").notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    googleFormImportId: uuid("google_form_import_id"),
    venueEventId: uuid("venue_event_id"),
    destination: text("destination").notNull(),
    sourceKey: text("source_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("notifications_source_key_uidx").on(table.sourceKey),
    index("notifications_created_at_idx").on(table.createdAt),
  ],
);

export const notificationReadsTable = appPrivateSchema.table(
  "notification_reads",
  {
    notificationId: uuid("notification_id")
      .notNull()
      .references(() => notificationsTable.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      name: "notification_reads_pkey",
      columns: [table.notificationId, table.userId],
    }),
    index("notification_reads_user_id_idx").on(table.userId),
  ],
);

export const pushSubscriptionsTable = appPrivateSchema.table(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("push_subscriptions_endpoint_uidx").on(table.endpoint),
    index("push_subscriptions_user_id_idx").on(table.userId),
  ],
);
