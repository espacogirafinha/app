import { Router, type IRouter } from "express";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  isNull,
  lte,
  or,
} from "drizzle-orm";
import {
  db,
  expenseCategoriesTable,
  expensesTable,
  venueEventsTable,
} from "@workspace/db";
import {
  CreateExpenseBody,
  CreateExpenseCategoryBody,
  DeleteExpenseParams,
  ListExpensesQueryParams,
  UpdateExpenseBody,
  UpdateExpenseCategoryBody,
  UpdateExpenseCategoryParams,
  UpdateExpenseParams,
} from "@workspace/api-zod";
import { requireSettingsAdmin } from "../lib/settings-access";

const router: IRouter = Router();

function money(value: unknown) {
  return Number.parseFloat(String(value ?? 0));
}

function iso(value: Date | null | undefined) {
  return value?.toISOString() ?? new Date().toISOString();
}

function dateOnly(value: Date | string) {
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

function nullableText(value: string | null | undefined) {
  if (value === null || value === undefined) return value ?? null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function categoryResponse(row: typeof expenseCategoriesTable.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

async function categoryExists(id: string, requireActive = false) {
  const [row] = await db
    .select({ id: expenseCategoriesTable.id, isActive: expenseCategoriesTable.isActive })
    .from(expenseCategoriesTable)
    .where(eq(expenseCategoriesTable.id, id))
    .limit(1);
  return Boolean(row && (!requireActive || row.isActive));
}

async function venueEventExists(id: string) {
  const [row] = await db
    .select({ id: venueEventsTable.id })
    .from(venueEventsTable)
    .where(eq(venueEventsTable.id, id))
    .limit(1);
  return Boolean(row);
}

function expenseLabel(childName: string | null, customerName: string | null, eventDate: string | null) {
  if (!customerName || !eventDate) return null;
  return `${childName || customerName} · ${eventDate}`;
}

async function loadExpense(id: string) {
  const [row] = await db
    .select({
      id: expensesTable.id,
      expenseDate: expensesTable.expenseDate,
      description: expensesTable.description,
      amount: expensesTable.amount,
      categoryId: expensesTable.categoryId,
      categoryName: expenseCategoriesTable.name,
      expenseType: expensesTable.expenseType,
      supplier: expensesTable.supplier,
      notes: expensesTable.notes,
      venueEventId: expensesTable.venueEventId,
      customerName: venueEventsTable.customerName,
      birthdayChildName: venueEventsTable.birthdayChildName,
      eventDate: venueEventsTable.eventDate,
      createdAt: expensesTable.createdAt,
      updatedAt: expensesTable.updatedAt,
    })
    .from(expensesTable)
    .innerJoin(expenseCategoriesTable, eq(expensesTable.categoryId, expenseCategoriesTable.id))
    .leftJoin(venueEventsTable, eq(expensesTable.venueEventId, venueEventsTable.id))
    .where(and(eq(expensesTable.id, id), isNull(expensesTable.deletedAt)))
    .limit(1);

  if (!row) return null;

  return {
    id: row.id,
    expenseDate: row.expenseDate,
    description: row.description,
    amount: money(row.amount),
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    expenseType: row.expenseType as "operational" | "investment",
    supplier: row.supplier,
    notes: row.notes,
    venueEventId: row.venueEventId,
    venueEventLabel: expenseLabel(row.birthdayChildName, row.customerName, row.eventDate),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

router.get("/settings/expense-categories", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(expenseCategoriesTable)
    .orderBy(asc(expenseCategoriesTable.sortOrder), asc(expenseCategoriesTable.name));
  res.json(rows.map(categoryResponse));
});

router.post("/settings/expense-categories", requireSettingsAdmin, async (req, res): Promise<void> => {
  const parsed = CreateExpenseCategoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const [row] = await db
      .insert(expenseCategoriesTable)
      .values({
        name: parsed.data.name.trim(),
        isActive: parsed.data.isActive ?? true,
        sortOrder: parsed.data.sortOrder ?? 0,
      })
      .returning();
    res.status(201).json(categoryResponse(row));
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : undefined;
    if (code === "23505") {
      res.status(409).json({ error: "Expense category name already exists" });
      return;
    }
    throw error;
  }
});

router.patch("/settings/expense-categories/:id", requireSettingsAdmin, async (req, res): Promise<void> => {
  const params = UpdateExpenseCategoryParams.safeParse(req.params);
  const body = UpdateExpenseCategoryBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const update: Partial<typeof expenseCategoriesTable.$inferInsert> = {};
  if (body.data.name !== undefined) update.name = body.data.name.trim();
  if (body.data.isActive !== undefined) update.isActive = body.data.isActive;
  if (body.data.sortOrder !== undefined) update.sortOrder = body.data.sortOrder;

  try {
    const [row] = await db
      .update(expenseCategoriesTable)
      .set(update)
      .where(eq(expenseCategoriesTable.id, params.data.id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Expense category not found" });
      return;
    }
    res.json(categoryResponse(row));
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : undefined;
    if (code === "23505") {
      res.status(409).json({ error: "Expense category name already exists" });
      return;
    }
    throw error;
  }
});

router.get("/expenses", async (req, res): Promise<void> => {
  const parsed = ListExpensesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const conditions = [isNull(expensesTable.deletedAt)];
  if (parsed.data.startDate) conditions.push(gte(expensesTable.expenseDate, dateOnly(parsed.data.startDate)));
  if (parsed.data.endDate) conditions.push(lte(expensesTable.expenseDate, dateOnly(parsed.data.endDate)));
  if (parsed.data.categoryId) conditions.push(eq(expensesTable.categoryId, parsed.data.categoryId));
  if (parsed.data.expenseType) conditions.push(eq(expensesTable.expenseType, parsed.data.expenseType));
  if (parsed.data.search?.trim()) {
    const search = `%${parsed.data.search.trim()}%`;
    conditions.push(or(
      ilike(expensesTable.description, search),
      ilike(expensesTable.supplier, search),
      ilike(expenseCategoriesTable.name, search),
    )!);
  }

  const rows = await db
    .select({
      id: expensesTable.id,
      expenseDate: expensesTable.expenseDate,
      description: expensesTable.description,
      amount: expensesTable.amount,
      categoryId: expensesTable.categoryId,
      categoryName: expenseCategoriesTable.name,
      expenseType: expensesTable.expenseType,
      supplier: expensesTable.supplier,
      notes: expensesTable.notes,
      venueEventId: expensesTable.venueEventId,
      customerName: venueEventsTable.customerName,
      birthdayChildName: venueEventsTable.birthdayChildName,
      eventDate: venueEventsTable.eventDate,
      createdAt: expensesTable.createdAt,
      updatedAt: expensesTable.updatedAt,
    })
    .from(expensesTable)
    .innerJoin(expenseCategoriesTable, eq(expensesTable.categoryId, expenseCategoriesTable.id))
    .leftJoin(venueEventsTable, eq(expensesTable.venueEventId, venueEventsTable.id))
    .where(and(...conditions))
    .orderBy(desc(expensesTable.expenseDate), desc(expensesTable.createdAt));

  res.json(rows.map((row) => ({
    id: row.id,
    expenseDate: row.expenseDate,
    description: row.description,
    amount: money(row.amount),
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    expenseType: row.expenseType as "operational" | "investment",
    supplier: row.supplier,
    notes: row.notes,
    venueEventId: row.venueEventId,
    venueEventLabel: expenseLabel(row.birthdayChildName, row.customerName, row.eventDate),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  })));
});

router.post("/expenses", async (req, res): Promise<void> => {
  const parsed = CreateExpenseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (!(await categoryExists(parsed.data.categoryId, true))) {
    res.status(400).json({ error: "Expense category is inactive or does not exist" });
    return;
  }
  if (parsed.data.venueEventId && !(await venueEventExists(parsed.data.venueEventId))) {
    res.status(400).json({ error: "Venue event does not exist" });
    return;
  }

  const [created] = await db
    .insert(expensesTable)
    .values({
      expenseDate: dateOnly(parsed.data.expenseDate),
      description: parsed.data.description.trim(),
      amount: String(parsed.data.amount),
      categoryId: parsed.data.categoryId,
      expenseType: parsed.data.expenseType,
      supplier: nullableText(parsed.data.supplier),
      notes: nullableText(parsed.data.notes),
      venueEventId: parsed.data.venueEventId ?? null,
    })
    .returning({ id: expensesTable.id });

  res.status(201).json(await loadExpense(created.id));
});

router.patch("/expenses/:id", async (req, res): Promise<void> => {
  const params = UpdateExpenseParams.safeParse(req.params);
  const body = UpdateExpenseBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  if (body.data.categoryId && !(await categoryExists(body.data.categoryId, true))) {
    res.status(400).json({ error: "Expense category is inactive or does not exist" });
    return;
  }
  if (body.data.venueEventId && !(await venueEventExists(body.data.venueEventId))) {
    res.status(400).json({ error: "Venue event does not exist" });
    return;
  }

  const update: Partial<typeof expensesTable.$inferInsert> = {};
  if (body.data.expenseDate !== undefined) update.expenseDate = dateOnly(body.data.expenseDate);
  if (body.data.description !== undefined) update.description = body.data.description.trim();
  if (body.data.amount !== undefined) update.amount = String(body.data.amount);
  if (body.data.categoryId !== undefined) update.categoryId = body.data.categoryId;
  if (body.data.expenseType !== undefined) update.expenseType = body.data.expenseType;
  if (body.data.supplier !== undefined) update.supplier = nullableText(body.data.supplier);
  if (body.data.notes !== undefined) update.notes = nullableText(body.data.notes);
  if (body.data.venueEventId !== undefined) update.venueEventId = body.data.venueEventId;

  const [updated] = await db
    .update(expensesTable)
    .set(update)
    .where(and(eq(expensesTable.id, params.data.id), isNull(expensesTable.deletedAt)))
    .returning({ id: expensesTable.id });

  if (!updated) {
    res.status(404).json({ error: "Expense not found" });
    return;
  }

  res.json(await loadExpense(updated.id));
});

router.delete("/expenses/:id", async (req, res): Promise<void> => {
  const params = DeleteExpenseParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .update(expensesTable)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(expensesTable.id, params.data.id), isNull(expensesTable.deletedAt)))
    .returning({ id: expensesTable.id });

  if (!deleted) {
    res.status(404).json({ error: "Expense not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
