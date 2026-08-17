import { Router, type IRouter } from "express";
import { and, asc, eq } from "drizzle-orm";
import {
  checklistTemplateItemsTable,
  checklistTemplatesTable,
  db,
  eventChecklistItemsTable,
  eventChecklistsTable,
} from "@workspace/db";
import {
  CreateChecklistBody,
  CreateChecklistTemplateBody,
  CreateChecklistTemplateItemForTemplateBody,
  CreateChecklistTemplateItemForTemplateParams,
  ListChecklistsQueryParams,
  UpdateChecklistItemBody,
  UpdateChecklistItemParams,
  UpdateChecklistTemplateItemBody,
  UpdateChecklistTemplateItemParams,
} from "@workspace/api-zod";
import { requireSettingsAdmin } from "../lib/settings-access";

const router: IRouter = Router();

type ChecklistTemplateRow = typeof checklistTemplatesTable.$inferSelect;
type ChecklistTemplateItemRow = typeof checklistTemplateItemsTable.$inferSelect;
type EventChecklistRow = typeof eventChecklistsTable.$inferSelect;
type EventChecklistItemRow = typeof eventChecklistItemsTable.$inferSelect;

function iso(value: Date | null | undefined) {
  return value?.toISOString() ?? new Date().toISOString();
}

function compactObject<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as Partial<T>;
}

function bodyId(body: unknown) {
  if (typeof body !== "object" || body === null || !("id" in body)) return undefined;
  const id = (body as { id?: unknown }).id;
  return typeof id === "string" && id.trim() ? id : undefined;
}

function formatTemplateItem(row: ChecklistTemplateItemRow) {
  return {
    id: row.id,
    templateId: row.templateId,
    label: row.label,
    description: row.description,
    isRequired: row.isRequired,
    sortOrder: row.sortOrder,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function formatTemplate(row: ChecklistTemplateRow, items: ChecklistTemplateItemRow[] = []) {
  return {
    id: row.id,
    name: row.name,
    module: row.module,
    eventType: row.eventType,
    serviceType: row.serviceType,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    items: items.sort(sortItems).map(formatTemplateItem),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function formatChecklistItem(row: EventChecklistItemRow) {
  return {
    id: row.id,
    checklistId: row.checklistId,
    label: row.label,
    description: row.description,
    isRequired: row.isRequired,
    isDone: row.isDone,
    sortOrder: row.sortOrder,
    completedAt: iso(row.completedAt),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function formatChecklist(row: EventChecklistRow, items: EventChecklistItemRow[] = []) {
  return {
    id: row.id,
    module: row.module,
    entityId: row.entityId,
    templateId: row.templateId,
    title: row.title,
    items: items.sort(sortItems).map(formatChecklistItem),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function sortItems(a: { sortOrder: number; label: string }, b: { sortOrder: number; label: string }) {
  return a.sortOrder - b.sortOrder || a.label.localeCompare(b.label);
}

async function loadTemplates() {
  const [templates, items] = await Promise.all([
    db.select().from(checklistTemplatesTable).orderBy(
      asc(checklistTemplatesTable.module),
      asc(checklistTemplatesTable.sortOrder),
      asc(checklistTemplatesTable.name),
    ),
    db.select().from(checklistTemplateItemsTable).orderBy(
      asc(checklistTemplateItemsTable.sortOrder),
      asc(checklistTemplateItemsTable.label),
    ),
  ]);

  return templates.map((template) => formatTemplate(template, items.filter((item) => item.templateId === template.id)));
}

async function loadChecklists(module?: string, entityId?: string) {
  const filters = [];
  if (module) filters.push(eq(eventChecklistsTable.module, module));
  if (entityId) filters.push(eq(eventChecklistsTable.entityId, entityId));

  const checklists = await db
    .select()
    .from(eventChecklistsTable)
    .where(filters.length === 0 ? undefined : filters.length === 1 ? filters[0] : and(...filters))
    .orderBy(asc(eventChecklistsTable.createdAt));

  const items = await db
    .select()
    .from(eventChecklistItemsTable)
    .orderBy(asc(eventChecklistItemsTable.sortOrder), asc(eventChecklistItemsTable.label));

  return checklists.map((checklist) => formatChecklist(checklist, items.filter((item) => item.checklistId === checklist.id)));
}

router.get("/settings/checklist-templates", async (_req, res): Promise<void> => {
  res.json(await loadTemplates());
});

router.post("/settings/checklist-templates", requireSettingsAdmin, async (req, res): Promise<void> => {
  const parsed = CreateChecklistTemplateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const id = bodyId(req.body);
  const body = parsed.data;
  const payload = compactObject({
    name: body.name,
    module: body.module,
    eventType: body.eventType,
    serviceType: body.serviceType,
    isActive: body.isActive ?? true,
    sortOrder: body.sortOrder ?? 0,
  }) as Partial<typeof checklistTemplatesTable.$inferInsert>;

  if (id) {
    const [row] = await db.update(checklistTemplatesTable).set(payload).where(eq(checklistTemplatesTable.id, id)).returning();
    if (!row) {
      res.status(404).json({ error: "Checklist template not found" });
      return;
    }
    const items = await db.select().from(checklistTemplateItemsTable).where(eq(checklistTemplateItemsTable.templateId, row.id));
    res.json(formatTemplate(row, items));
    return;
  }

  const [row] = await db.insert(checklistTemplatesTable).values(payload as typeof checklistTemplatesTable.$inferInsert).returning();
  res.status(201).json(formatTemplate(row));
});

router.get("/settings/checklist-template-items", async (req, res): Promise<void> => {
  const templateId = typeof req.query.templateId === "string" ? req.query.templateId : undefined;
  const rows = await db
    .select()
    .from(checklistTemplateItemsTable)
    .where(templateId ? eq(checklistTemplateItemsTable.templateId, templateId) : undefined)
    .orderBy(asc(checklistTemplateItemsTable.sortOrder), asc(checklistTemplateItemsTable.label));

  res.json(rows.map(formatTemplateItem));
});


router.post("/settings/checklist-template-items", requireSettingsAdmin, async (req, res): Promise<void> => {
  const parsed = CreateChecklistTemplateItemForTemplateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const id = bodyId(req.body);
  const body = parsed.data;
  if (!id && !body.templateId) {
    res.status(400).json({ error: "templateId is required" });
    return;
  }

  const payload = compactObject({
    templateId: body.templateId,
    label: body.label,
    description: body.description,
    isRequired: body.isRequired ?? false,
    sortOrder: body.sortOrder ?? 0,
  }) as Partial<typeof checklistTemplateItemsTable.$inferInsert>;

  if (id) {
    const [row] = await db.update(checklistTemplateItemsTable).set(payload).where(eq(checklistTemplateItemsTable.id, id)).returning();
    if (!row) {
      res.status(404).json({ error: "Checklist template item not found" });
      return;
    }
    res.json(formatTemplateItem(row));
    return;
  }

  const [row] = await db.insert(checklistTemplateItemsTable).values(payload as typeof checklistTemplateItemsTable.$inferInsert).returning();
  res.status(201).json(formatTemplateItem(row));
});
router.post("/settings/checklist-templates/:id/items", requireSettingsAdmin, async (req, res): Promise<void> => {
  const params = CreateChecklistTemplateItemForTemplateParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = CreateChecklistTemplateItemForTemplateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const id = bodyId(req.body);
  const body = parsed.data;
  const payload = compactObject({
    templateId: params.data.id,
    label: body.label,
    description: body.description,
    isRequired: body.isRequired ?? false,
    sortOrder: body.sortOrder ?? 0,
  }) as Partial<typeof checklistTemplateItemsTable.$inferInsert>;

  if (id) {
    const [row] = await db.update(checklistTemplateItemsTable).set(payload).where(eq(checklistTemplateItemsTable.id, id)).returning();
    if (!row) {
      res.status(404).json({ error: "Checklist template item not found" });
      return;
    }
    res.json(formatTemplateItem(row));
    return;
  }

  const [row] = await db.insert(checklistTemplateItemsTable).values(payload as typeof checklistTemplateItemsTable.$inferInsert).returning();
  res.status(201).json(formatTemplateItem(row));
});

router.post("/settings/checklist-template-items/:id", requireSettingsAdmin, async (req, res): Promise<void> => {
  const params = UpdateChecklistTemplateItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateChecklistTemplateItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const body = parsed.data;
  const payload = compactObject({
    templateId: body.templateId,
    label: body.label,
    description: body.description,
    isRequired: body.isRequired ?? false,
    sortOrder: body.sortOrder ?? 0,
  }) as Partial<typeof checklistTemplateItemsTable.$inferInsert>;

  const [row] = await db.update(checklistTemplateItemsTable).set(payload).where(eq(checklistTemplateItemsTable.id, params.data.id)).returning();
  if (!row) {
    res.status(404).json({ error: "Checklist template item not found" });
    return;
  }
  res.json(formatTemplateItem(row));
});

router.get("/checklists", async (req, res): Promise<void> => {
  const parsed = ListChecklistsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  res.json(await loadChecklists(parsed.data.module, parsed.data.entityId));
});

router.post("/checklists", async (req, res): Promise<void> => {
  const parsed = CreateChecklistBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const id = bodyId(req.body);
  const body = parsed.data;
  const payload = compactObject({
    module: body.module,
    entityId: body.entityId,
    templateId: body.templateId,
    title: body.title,
  }) as Partial<typeof eventChecklistsTable.$inferInsert>;

  if (id) {
    const [row] = await db.update(eventChecklistsTable).set(payload).where(eq(eventChecklistsTable.id, id)).returning();
    if (!row) {
      res.status(404).json({ error: "Checklist not found" });
      return;
    }
    const items = await db.select().from(eventChecklistItemsTable).where(eq(eventChecklistItemsTable.checklistId, row.id));
    res.json(formatChecklist(row, items));
    return;
  }

  const [row] = await db.insert(eventChecklistsTable).values(payload as typeof eventChecklistsTable.$inferInsert).returning();

  const items = body.items?.length
    ? await db.insert(eventChecklistItemsTable).values(body.items.map((item, index) => ({
        checklistId: row.id,
        label: item.label,
        description: item.description,
        isRequired: item.isRequired ?? false,
        sortOrder: item.sortOrder ?? index,
      }))).returning()
    : [];

  res.status(201).json(formatChecklist(row, items));
});

router.get("/checklist-items", async (req, res): Promise<void> => {
  const checklistId = typeof req.query.checklistId === "string" ? req.query.checklistId : undefined;
  const rows = await db
    .select()
    .from(eventChecklistItemsTable)
    .where(checklistId ? eq(eventChecklistItemsTable.checklistId, checklistId) : undefined)
    .orderBy(asc(eventChecklistItemsTable.sortOrder), asc(eventChecklistItemsTable.label));

  res.json(rows.map(formatChecklistItem));
});


router.post("/checklist-items", async (req, res): Promise<void> => {
  const parsed = UpdateChecklistItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const id = bodyId(req.body);
  const body = parsed.data;
  const isDone = body.isDone;
  const payload = compactObject({
    checklistId: body.checklistId,
    label: body.label,
    description: body.description,
    isRequired: body.isRequired,
    isDone,
    sortOrder: body.sortOrder,
    completedAt: isDone === undefined ? body.completedAt ? new Date(body.completedAt) : undefined : isDone ? new Date() : null,
  }) as Partial<typeof eventChecklistItemsTable.$inferInsert>;

  if (id) {
    const [row] = await db.update(eventChecklistItemsTable).set(payload).where(eq(eventChecklistItemsTable.id, id)).returning();
    if (!row) {
      res.status(404).json({ error: "Checklist item not found" });
      return;
    }

    res.json(formatChecklistItem(row));
    return;
  }

  if (!body.checklistId || !body.label) {
    res.status(400).json({ error: "checklistId and label are required" });
    return;
  }

  const [row] = await db.insert(eventChecklistItemsTable).values({
    checklistId: body.checklistId,
    label: body.label,
    description: body.description,
    isRequired: body.isRequired ?? false,
    isDone: body.isDone ?? false,
    sortOrder: body.sortOrder ?? 0,
    completedAt: body.isDone ? new Date() : null,
  }).returning();

  res.status(201).json(formatChecklistItem(row));
});
router.post("/checklist-items/:id", async (req, res): Promise<void> => {
  const params = UpdateChecklistItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateChecklistItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const body = parsed.data;
  const isDone = body.isDone;
  const payload = compactObject({
    label: body.label,
    description: body.description,
    isRequired: body.isRequired,
    isDone,
    sortOrder: body.sortOrder,
    completedAt: isDone === undefined ? body.completedAt ? new Date(body.completedAt) : undefined : isDone ? new Date() : null,
  }) as Partial<typeof eventChecklistItemsTable.$inferInsert>;

  const [row] = await db.update(eventChecklistItemsTable).set(payload).where(eq(eventChecklistItemsTable.id, params.data.id)).returning();
  if (!row) {
    res.status(404).json({ error: "Checklist item not found" });
    return;
  }

  res.json(formatChecklistItem(row));
});

export default router;



