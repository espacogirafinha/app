import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  uniqueIndex,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { venueEventsTable } from "./venue-events";
import { externalEventsTable } from "./external-events";

export const expenseCategoriesTable = pgTable("expense_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const expensesTable = pgTable(
  "expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    expenseDate: date("expense_date").notNull(),
    description: text("description").notNull(),
    amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => expenseCategoriesTable.id, { onDelete: "restrict" }),
    expenseType: text("expense_type").notNull(),
    supplier: text("supplier"),
    notes: text("notes"),
    venueEventId: uuid("venue_event_id").references(() => venueEventsTable.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    check("expenses_amount_positive", sql`${t.amount} > 0`),
    check(
      "expenses_type_check",
      sql`${t.expenseType} in ('operational', 'investment')`,
    ),
    check("expenses_description_not_blank", sql`btrim(${t.description}) <> ''`),
    index("expenses_expense_date_idx").on(t.expenseDate),
    index("expenses_category_id_idx").on(t.categoryId),
    index("expenses_type_idx").on(t.expenseType),
    index("expenses_venue_event_id_idx").on(t.venueEventId),
    index("expenses_deleted_at_idx").on(t.deletedAt),
  ],
);


export const expenseEventLinksTable = pgTable(
  "expense_event_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    expenseId: uuid("expense_id")
      .notNull()
      .references(() => expensesTable.id, { onDelete: "cascade" }),
    venueEventId: uuid("venue_event_id").references(() => venueEventsTable.id, {
      onDelete: "cascade",
    }),
    externalEventId: uuid("external_event_id").references(() => externalEventsTable.id, {
      onDelete: "cascade",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      "expense_event_links_exactly_one_event",
      sql`num_nonnulls(${t.venueEventId}, ${t.externalEventId}) = 1`,
    ),
    index("expense_event_links_expense_id_idx").on(t.expenseId),
    index("expense_event_links_venue_event_id_idx").on(t.venueEventId),
    index("expense_event_links_external_event_id_idx").on(t.externalEventId),
    uniqueIndex("expense_event_links_expense_venue_unique")
      .on(t.expenseId, t.venueEventId)
      .where(sql`${t.venueEventId} is not null`),
    uniqueIndex("expense_event_links_expense_external_unique")
      .on(t.expenseId, t.externalEventId)
      .where(sql`${t.externalEventId} is not null`),
  ],
);

export const insertExpenseCategorySchema = createInsertSchema(expenseCategoriesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertExpenseSchema = createInsertSchema(expensesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
});

export type InsertExpenseCategory = z.infer<typeof insertExpenseCategorySchema>;
export type ExpenseCategory = typeof expenseCategoriesTable.$inferSelect;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expensesTable.$inferSelect;
