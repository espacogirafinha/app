import { Router, type IRouter } from "express";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lte,
  or,
} from "drizzle-orm";
import {
  db,
  expenseCategoriesTable,
  expenseEventLinksTable,
  expensesTable,
  externalEventsTable,
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

type ExpenseEventLinkInput = {
  eventType: "venue_event" | "external_event";
  eventId: string;
};

type ExpenseEventLinkResponse = ExpenseEventLinkInput & {
  id: string;
  eventDate: string;
  customerName: string;
  birthdayChildName: string | null;
  label: string;
};

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

function normalizeEventLinks(links: ExpenseEventLinkInput[]) {
  const unique = new Map<string, ExpenseEventLinkInput>();
  for (const link of links) {
    unique.set(`${link.eventType}:${link.eventId}`, link);
  }
  return [...unique.values()];
}

function requestedEventLinks(data: {
  eventLinks?: ExpenseEventLinkInput[];
  venueEventId?: string | null;
}) {
  if (data.eventLinks !== undefined) {
    return normalizeEventLinks(data.eventLinks);
  }
  if (data.venueEventId !== undefined) {
    return data.venueEventId
      ? [{ eventType: "venue_event" as const, eventId: data.venueEventId }]
      : [];
  }
  return undefined;
}

function legacyVenueProjection(links: ExpenseEventLinkInput[]) {
  return links.length === 1 && links[0].eventType === "venue_event"
    ? links[0].eventId
    : null;
}

async function eventLinksExist(links: ExpenseEventLinkInput[]) {
  const venueIds = links.filter((link) => link.eventType === "venue_event").map((link) => link.eventId);
  const externalIds = links.filter((link) => link.eventType === "external_event").map((link) => link.eventId);

  const [venueRows, externalRows] = await Promise.all([
    venueIds.length
      ? db.select({ id: venueEventsTable.id }).from(venueEventsTable).where(inArray(venueEventsTable.id, venueIds))
      : Promise.resolve([]),
    externalIds.length
      ? db.select({ id: externalEventsTable.id }).from(externalEventsTable).where(inArray(externalEventsTable.id, externalIds))
      : Promise.resolve([]),
  ]);

  return venueRows.length === venueIds.length && externalRows.length === externalIds.length;
}

async function loadExpenseLinks(expenseIds: string[]) {
  const grouped = new Map<string, ExpenseEventLinkResponse[]>();
  if (expenseIds.length === 0) return grouped;

  const rows = await db
    .select({
      id: expenseEventLinksTable.id,
      expenseId: expenseEventLinksTable.expenseId,
      venueEventId: expenseEventLinksTable.venueEventId,
      externalEventId: expenseEventLinksTable.externalEventId,
      venueEventDate: venueEventsTable.eventDate,
      venueCustomerName: venueEventsTable.customerName,
      birthdayChildName: venueEventsTable.birthdayChildName,
      externalEventDate: externalEventsTable.eventDate,
      externalCustomerName: externalEventsTable.customerName,
    })
    .from(expenseEventLinksTable)
    .leftJoin(venueEventsTable, eq(expenseEventLinksTable.venueEventId, venueEventsTable.id))
    .leftJoin(externalEventsTable, eq(expenseEventLinksTable.externalEventId, externalEventsTable.id))
    .where(inArray(expenseEventLinksTable.expenseId, expenseIds))
    .orderBy(asc(expenseEventLinksTable.createdAt), asc(expenseEventLinksTable.id));

  for (const row of rows) {
    let link: ExpenseEventLinkResponse | null = null;
    if (row.venueEventId && row.venueEventDate && row.venueCustomerName) {
      const displayName = row.birthdayChildName || row.venueCustomerName;
      link = {
        id: row.id,
        eventType: "venue_event",
        eventId: row.venueEventId,
        eventDate: row.venueEventDate,
        customerName: row.venueCustomerName,
        birthdayChildName: row.birthdayChildName,
        label: `Festa · ${row.venueEventDate} · ${displayName}`,
      };
    } else if (row.externalEventId && row.externalEventDate && row.externalCustomerName) {
      link = {
        id: row.id,
        eventType: "external_event",
        eventId: row.externalEventId,
        eventDate: row.externalEventDate,
        customerName: row.externalCustomerName,
        birthdayChildName: null,
        label: `Serviço Externo · ${row.externalEventDate} · ${row.externalCustomerName}`,
      };
    }
    if (!link) continue;
    const current = grouped.get(row.expenseId) ?? [];
    current.push(link);
    grouped.set(row.expenseId, current);
  }

  return grouped;
}

function expenseResponse(
  row: {
    id: string;
    expenseDate: string;
    description: string;
    amount: string;
    categoryId: string;
    categoryName: string;
    expenseType: string;
    supplier: string | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  },
  eventLinks: ExpenseEventLinkResponse[],
) {
  const legacyVenue = eventLinks.length === 1 && eventLinks[0].eventType === "venue_event"
    ? eventLinks[0]
    : null;

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
    venueEventId: legacyVenue?.eventId ?? null,
    venueEventLabel: legacyVenue
      ? `${legacyVenue.birthdayChildName || legacyVenue.customerName} · ${legacyVenue.eventDate}`
      : null,
    eventLinks,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
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
      createdAt: expensesTable.createdAt,
      updatedAt: expensesTable.updatedAt,
    })
    .from(expensesTable)
    .innerJoin(expenseCategoriesTable, eq(expensesTable.categoryId, expenseCategoriesTable.id))
    .where(and(eq(expensesTable.id, id), isNull(expensesTable.deletedAt)))
    .limit(1);

  if (!row) return null;
  const linksByExpense = await loadExpenseLinks([row.id]);
  return expenseResponse(row, linksByExpense.get(row.id) ?? []);
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
      createdAt: expensesTable.createdAt,
      updatedAt: expensesTable.updatedAt,
    })
    .from(expensesTable)
    .innerJoin(expenseCategoriesTable, eq(expensesTable.categoryId, expenseCategoriesTable.id))
    .where(and(...conditions))
    .orderBy(desc(expensesTable.expenseDate), desc(expensesTable.createdAt));

  const linksByExpense = await loadExpenseLinks(rows.map((row) => row.id));
  res.json(rows.map((row) => expenseResponse(row, linksByExpense.get(row.id) ?? [])));
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

  const links = requestedEventLinks(parsed.data) ?? [];
  if (!(await eventLinksExist(links))) {
    res.status(400).json({ error: "One or more associated events do not exist" });
    return;
  }

  const createdId = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(expensesTable)
      .values({
        expenseDate: dateOnly(parsed.data.expenseDate),
        description: parsed.data.description.trim(),
        amount: String(parsed.data.amount),
        categoryId: parsed.data.categoryId,
        expenseType: parsed.data.expenseType,
        supplier: nullableText(parsed.data.supplier),
        notes: nullableText(parsed.data.notes),
        venueEventId: legacyVenueProjection(links),
      })
      .returning({ id: expensesTable.id });

    if (links.length > 0) {
      await tx.insert(expenseEventLinksTable).values(
        links.map((link) => ({
          expenseId: created.id,
          venueEventId: link.eventType === "venue_event" ? link.eventId : null,
          externalEventId: link.eventType === "external_event" ? link.eventId : null,
        })),
      );
    }
    return created.id;
  });

  res.status(201).json(await loadExpense(createdId));
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

  const links = requestedEventLinks(body.data);
  if (links !== undefined && !(await eventLinksExist(links))) {
    res.status(400).json({ error: "One or more associated events do not exist" });
    return;
  }

  const [existing] = await db
    .select({ id: expensesTable.id })
    .from(expensesTable)
    .where(and(eq(expensesTable.id, params.data.id), isNull(expensesTable.deletedAt)))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Expense not found" });
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
  if (links !== undefined) update.venueEventId = legacyVenueProjection(links);

  await db.transaction(async (tx) => {
    if (Object.keys(update).length > 0) {
      await tx
        .update(expensesTable)
        .set(update)
        .where(eq(expensesTable.id, params.data.id));
    }

    if (links !== undefined) {
      await tx
        .delete(expenseEventLinksTable)
        .where(eq(expenseEventLinksTable.expenseId, params.data.id));

      if (links.length > 0) {
        await tx.insert(expenseEventLinksTable).values(
          links.map((link) => ({
            expenseId: params.data.id,
            venueEventId: link.eventType === "venue_event" ? link.eventId : null,
            externalEventId: link.eventType === "external_event" ? link.eventId : null,
          })),
        );
      }
    }
  });

  res.json(await loadExpense(params.data.id));
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
