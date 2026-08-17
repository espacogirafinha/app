import { Router, type IRouter } from "express";
import { asc, eq } from "drizzle-orm";
import {
  db,
  eventExtrasTable,
  externalServiceCatalogTable,
  messageTemplatesTable,
  venuePacksTable,
} from "@workspace/db";
import {
  CreateEventExtraBody,
  CreateExternalServiceBody,
  CreateMessageTemplateBody,
  CreateVenuePackBody,
  UpdateEventExtraBody,
  UpdateEventExtraParams,
  UpdateExternalServiceBody,
  UpdateExternalServiceParams,
  UpdateVenuePackBody,
  UpdateVenuePackParams,
} from "@workspace/api-zod";
import { requireSettingsAdmin } from "../lib/settings-access";

const router: IRouter = Router();

function compactObject<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as Partial<T>;
}

function money(value: unknown) {
  return Number.parseFloat(String(value ?? 0));
}

function iso(value: Date | null | undefined) {
  return value?.toISOString() ?? new Date().toISOString();
}

function getErrorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code)
    : undefined;
}

function bodyId(body: unknown) {
  if (typeof body !== "object" || body === null || !("id" in body)) return undefined;

  const id = (body as { id?: unknown }).id;
  return typeof id === "string" && id.trim() ? id : undefined;
}

type VenuePackRow = typeof venuePacksTable.$inferSelect;
type ExternalServiceCatalogRow = typeof externalServiceCatalogTable.$inferSelect;
type EventExtraRow = typeof eventExtrasTable.$inferSelect;
type MessageTemplateRow = typeof messageTemplatesTable.$inferSelect;

function formatVenuePack(row: VenuePackRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    basePrice: money(row.basePrice),
    defaultStartTime: row.defaultStartTime,
    defaultEndTime: row.defaultEndTime,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    internalNotes: row.internalNotes,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function formatExternalService(row: ExternalServiceCatalogRow) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    basePrice: money(row.basePrice),
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    operationalNotes: row.operationalNotes,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function formatEventExtra(row: EventExtraRow) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    basePrice: money(row.basePrice),
    appliesTo: row.appliesTo,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    internalNotes: row.internalNotes,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function formatMessageTemplate(row: MessageTemplateRow) {
  return {
    id: row.id,
    name: row.name,
    module: row.module,
    triggerType: row.triggerType,
    body: row.body,
    variables: row.variables,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

router.get("/settings/venue-packs", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(venuePacksTable)
    .orderBy(asc(venuePacksTable.sortOrder), asc(venuePacksTable.name));

  res.json(rows.map(formatVenuePack));
});

router.post("/settings/venue-packs", requireSettingsAdmin, async (req, res): Promise<void> => {
  const parsed = CreateVenuePackBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const id = bodyId(req.body);
  const body = parsed.data;
  const { basePrice, ...payload } = body;

  if (id) {
    const updateData = compactObject({
      ...payload,
      basePrice: String(basePrice),
    }) as Partial<typeof venuePacksTable.$inferInsert>;

    const [row] = await db
      .update(venuePacksTable)
      .set(updateData)
      .where(eq(venuePacksTable.id, id))
      .returning();

    if (!row) {
      res.status(404).json({ error: "Venue pack not found" });
      return;
    }

    res.json(formatVenuePack(row));
    return;
  }

  const [row] = await db
    .insert(venuePacksTable)
    .values(compactObject({
      ...payload,
      basePrice: String(basePrice),
      isActive: body.isActive ?? true,
      sortOrder: body.sortOrder ?? 0,
    }) as typeof venuePacksTable.$inferInsert)
    .returning();

  res.status(201).json(formatVenuePack(row));
});

router.patch("/settings/venue-packs/:id", requireSettingsAdmin, async (req, res): Promise<void> => {
  const params = UpdateVenuePackParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateVenuePackBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { basePrice, ...body } = parsed.data;
  const updateData = compactObject({
    ...body,
    basePrice: basePrice === undefined ? undefined : String(basePrice),
  }) as Partial<typeof venuePacksTable.$inferInsert>;

  const [row] = await db
    .update(venuePacksTable)
    .set(updateData)
    .where(eq(venuePacksTable.id, params.data.id))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Venue pack not found" });
    return;
  }

  res.json(formatVenuePack(row));
});

router.get("/settings/external-services", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(externalServiceCatalogTable)
    .orderBy(asc(externalServiceCatalogTable.sortOrder), asc(externalServiceCatalogTable.name));

  res.json(rows.map(formatExternalService));
});

router.post("/settings/external-services", requireSettingsAdmin, async (req, res): Promise<void> => {
  const parsed = CreateExternalServiceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const id = bodyId(req.body);
  const body = parsed.data;
  const { basePrice, ...payload } = body;

  try {
    if (id) {
      const updateData = compactObject({
        ...payload,
        basePrice: String(basePrice),
      }) as Partial<typeof externalServiceCatalogTable.$inferInsert>;

      const [row] = await db
        .update(externalServiceCatalogTable)
        .set(updateData)
        .where(eq(externalServiceCatalogTable.id, id))
        .returning();

      if (!row) {
        res.status(404).json({ error: "External service not found" });
        return;
      }

      res.json(formatExternalService(row));
      return;
    }

    const [row] = await db
      .insert(externalServiceCatalogTable)
      .values(compactObject({
        ...payload,
        basePrice: String(basePrice),
        isActive: body.isActive ?? true,
        sortOrder: body.sortOrder ?? 0,
      }) as typeof externalServiceCatalogTable.$inferInsert)
      .returning();

    res.status(201).json(formatExternalService(row));
  } catch (error) {
    if (getErrorCode(error) === "23505") {
      res.status(409).json({ error: "External service code already exists" });
      return;
    }

    throw error;
  }
});

router.patch("/settings/external-services/:id", requireSettingsAdmin, async (req, res): Promise<void> => {
  const params = UpdateExternalServiceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateExternalServiceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { basePrice, ...body } = parsed.data;
  const updateData = compactObject({
    ...body,
    basePrice: basePrice === undefined ? undefined : String(basePrice),
  }) as Partial<typeof externalServiceCatalogTable.$inferInsert>;

  try {
    const [row] = await db
      .update(externalServiceCatalogTable)
      .set(updateData)
      .where(eq(externalServiceCatalogTable.id, params.data.id))
      .returning();

    if (!row) {
      res.status(404).json({ error: "External service not found" });
      return;
    }

    res.json(formatExternalService(row));
  } catch (error) {
    if (getErrorCode(error) === "23505") {
      res.status(409).json({ error: "External service code already exists" });
      return;
    }

    throw error;
  }
});

router.get("/settings/event-extras", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(eventExtrasTable)
    .orderBy(asc(eventExtrasTable.sortOrder), asc(eventExtrasTable.name));

  res.json(rows.map(formatEventExtra));
});

router.post("/settings/event-extras", requireSettingsAdmin, async (req, res): Promise<void> => {
  const parsed = CreateEventExtraBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const id = bodyId(req.body);
  const body = parsed.data;
  const { basePrice, ...payload } = body;

  if (id) {
    const updateData = compactObject({
      ...payload,
      basePrice: String(basePrice),
    }) as Partial<typeof eventExtrasTable.$inferInsert>;

    const [row] = await db
      .update(eventExtrasTable)
      .set(updateData)
      .where(eq(eventExtrasTable.id, id))
      .returning();

    if (!row) {
      res.status(404).json({ error: "Event extra not found" });
      return;
    }

    res.json(formatEventExtra(row));
    return;
  }

  const [row] = await db
    .insert(eventExtrasTable)
    .values(compactObject({
      ...payload,
      basePrice: String(basePrice),
      appliesTo: body.appliesTo ?? "all",
      isActive: body.isActive ?? true,
      sortOrder: body.sortOrder ?? 0,
    }) as typeof eventExtrasTable.$inferInsert)
    .returning();

  res.status(201).json(formatEventExtra(row));
});

router.patch("/settings/event-extras/:id", requireSettingsAdmin, async (req, res): Promise<void> => {
  const params = UpdateEventExtraParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateEventExtraBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { basePrice, ...body } = parsed.data;
  const updateData = compactObject({
    ...body,
    basePrice: basePrice === undefined ? undefined : String(basePrice),
  }) as Partial<typeof eventExtrasTable.$inferInsert>;

  const [row] = await db
    .update(eventExtrasTable)
    .set(updateData)
    .where(eq(eventExtrasTable.id, params.data.id))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Event extra not found" });
    return;
  }

  res.json(formatEventExtra(row));
});

router.get("/settings/message-templates", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(messageTemplatesTable)
    .orderBy(
      asc(messageTemplatesTable.module),
      asc(messageTemplatesTable.triggerType),
      asc(messageTemplatesTable.sortOrder),
      asc(messageTemplatesTable.name),
    );

  res.json(rows.map(formatMessageTemplate));
});

router.post("/settings/message-templates", requireSettingsAdmin, async (req, res): Promise<void> => {
  const parsed = CreateMessageTemplateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const id = bodyId(req.body);
  const body = parsed.data;
  const payload = compactObject({
    name: body.name,
    module: body.module,
    triggerType: body.triggerType,
    body: body.body,
    variables: body.variables,
    isActive: body.isActive ?? true,
    sortOrder: body.sortOrder ?? 0,
  }) as Partial<typeof messageTemplatesTable.$inferInsert>;

  if (id) {
    const [row] = await db
      .update(messageTemplatesTable)
      .set(payload)
      .where(eq(messageTemplatesTable.id, id))
      .returning();

    if (!row) {
      res.status(404).json({ error: "Message template not found" });
      return;
    }

    res.json(formatMessageTemplate(row));
    return;
  }

  const [row] = await db
    .insert(messageTemplatesTable)
    .values(payload as typeof messageTemplatesTable.$inferInsert)
    .returning();

  res.status(201).json(formatMessageTemplate(row));
});

export default router;
