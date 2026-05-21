import { Router, type IRouter } from "express";
import { and, eq, gte, ilike, lte, or } from "drizzle-orm";
import { db, externalEventsTable, externalEventServicesTable } from "@workspace/db";
import {
  CreateExternalEventBody,
  DeleteExternalEventParams,
  GetExternalEventParams,
  ListExternalEventsQueryParams,
  UpdateExternalEventBody,
  UpdateExternalEventParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function computePaymentStatus(totalPrice: number, amountPaid: number): "unpaid" | "partial" | "paid" {
  if (amountPaid >= totalPrice) return "paid";
  if (amountPaid > 0) return "partial";
  return "unpaid";
}

function compactObject<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as Partial<T>;
}

function money(value: unknown) {
  return Number.parseFloat(String(value ?? 0));
}

type ExternalEventRow = typeof externalEventsTable.$inferSelect;
type ExternalEventServiceRow = typeof externalEventServicesTable.$inferSelect;

function formatExternalEvent(row: ExternalEventRow, services: ExternalEventServiceRow[]) {
  const totalPrice = money(row.totalPrice);
  const amountPaid = money(row.amountPaid);

  return {
    id: row.id,
    customerName: row.customerName,
    phone: row.phone,
    email: row.email,
    nif: row.nif,
    eventDate: row.eventDate,
    startTime: row.startTime,
    endTime: row.endTime,
    status: row.status,
    paymentStatus: row.paymentStatus,
    source: row.source,
    eventLocation: row.eventLocation,
    guestCount: row.guestCount ?? 0,
    eventType: row.eventType,
    eventTheme: row.eventTheme,
    setupNotes: row.setupNotes,
    teardownNotes: row.teardownNotes,
    accessNotes: row.accessNotes,
    totalPrice,
    amountPaid,
    remainingBalance: Math.max(0, totalPrice - amountPaid),
    paymentMethod: row.paymentMethod,
    notes: row.notes,
    services: services
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map(formatExternalEventService),
    createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
    updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
  };
}

function formatExternalEventService(row: ExternalEventServiceRow) {
  return {
    id: row.id,
    externalEventId: row.externalEventId,
    serviceType: row.serviceType,
    serviceLabel: row.serviceLabel,
    price: money(row.price),
    status: row.status,
    notes: row.notes,
    sortOrder: row.sortOrder ?? 0,
    createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
    updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
  };
}

async function getServicesByEventIds(eventIds: string[]) {
  if (eventIds.length === 0) return new Map<string, ExternalEventServiceRow[]>();

  const services = await db
    .select()
    .from(externalEventServicesTable)
    .where(or(...eventIds.map((id) => eq(externalEventServicesTable.externalEventId, id))));

  return services.reduce<Map<string, ExternalEventServiceRow[]>>((acc, service) => {
    const items = acc.get(service.externalEventId) ?? [];
    items.push(service);
    acc.set(service.externalEventId, items);
    return acc;
  }, new Map());
}

router.get("/external-events", async (req, res): Promise<void> => {
  const parsed = ListExternalEventsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { search, status, paymentStatus, dateFrom, dateTo } = parsed.data;
  const conditions = [];

  if (search) {
    conditions.push(
      or(
        ilike(externalEventsTable.customerName, `%${search}%`),
        ilike(externalEventsTable.phone, `%${search}%`),
        ilike(externalEventsTable.eventLocation, `%${search}%`),
      ),
    );
  }

  if (status) conditions.push(eq(externalEventsTable.status, status));
  if (paymentStatus) conditions.push(eq(externalEventsTable.paymentStatus, paymentStatus));
  if (dateFrom) conditions.push(gte(externalEventsTable.eventDate, dateFrom));
  if (dateTo) conditions.push(lte(externalEventsTable.eventDate, dateTo));

  const rows = await db
    .select()
    .from(externalEventsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(externalEventsTable.eventDate);

  const servicesByEventId = await getServicesByEventIds(rows.map((row) => row.id));
  res.json(rows.map((row) => formatExternalEvent(row, servicesByEventId.get(row.id) ?? [])));
});

router.post("/external-events", async (req, res): Promise<void> => {
  const parsed = CreateExternalEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { services, totalPrice, amountPaid, paymentStatus: _paymentStatus, ...body } = parsed.data;
  const paymentStatus = computePaymentStatus(totalPrice, amountPaid);

  const row = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(externalEventsTable)
      .values(compactObject({
        ...body,
        status: body.status ?? "draft",
        paymentStatus,
        guestCount: body.guestCount ?? 0,
        totalPrice: String(totalPrice),
        amountPaid: String(amountPaid),
      }) as typeof externalEventsTable.$inferInsert)
      .returning();

    if (services.length > 0) {
      await tx.insert(externalEventServicesTable).values(
        services.map((service, index) => compactObject({
          externalEventId: created.id,
          serviceType: service.serviceType,
          serviceLabel: service.serviceLabel,
          price: String(service.price ?? 0),
          status: service.status ?? "planned",
          notes: service.notes,
          sortOrder: service.sortOrder ?? index + 1,
        }) as typeof externalEventServicesTable.$inferInsert),
      );
    }

    return created;
  });

  const servicesByEventId = await getServicesByEventIds([row.id]);
  res.status(201).json(formatExternalEvent(row, servicesByEventId.get(row.id) ?? []));
});

router.get("/external-events/:id", async (req, res): Promise<void> => {
  const params = GetExternalEventParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .select()
    .from(externalEventsTable)
    .where(eq(externalEventsTable.id, params.data.id));

  if (!row) {
    res.status(404).json({ error: "External event not found" });
    return;
  }

  const servicesByEventId = await getServicesByEventIds([row.id]);
  res.json(formatExternalEvent(row, servicesByEventId.get(row.id) ?? []));
});

router.patch("/external-events/:id", async (req, res): Promise<void> => {
  const params = UpdateExternalEventParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateExternalEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const row = await db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(externalEventsTable)
      .where(eq(externalEventsTable.id, params.data.id));

    if (!current) return null;

    const { services, paymentStatus: _paymentStatus, ...body } = parsed.data;
    const total = body.totalPrice ?? money(current.totalPrice);
    const paid = body.amountPaid ?? money(current.amountPaid);
    const updateData: Record<string, unknown> = compactObject({ ...body });
    if (body.totalPrice !== undefined) updateData.totalPrice = String(body.totalPrice);
    if (body.amountPaid !== undefined) updateData.amountPaid = String(body.amountPaid);
    if (body.totalPrice !== undefined || body.amountPaid !== undefined || parsed.data.paymentStatus !== undefined) {
      updateData.paymentStatus = computePaymentStatus(total, paid);
    }

    const [updated] = await tx
      .update(externalEventsTable)
      .set(updateData)
      .where(eq(externalEventsTable.id, params.data.id))
      .returning();

    if (services) {
      await tx
        .delete(externalEventServicesTable)
        .where(eq(externalEventServicesTable.externalEventId, params.data.id));

      if (services.length > 0) {
        await tx.insert(externalEventServicesTable).values(
          services.map((service, index) => compactObject({
            externalEventId: params.data.id,
            serviceType: service.serviceType,
            serviceLabel: service.serviceLabel,
            price: String(service.price ?? 0),
            status: service.status ?? "planned",
            notes: service.notes,
            sortOrder: service.sortOrder ?? index + 1,
          }) as typeof externalEventServicesTable.$inferInsert),
        );
      }
    }

    return updated;
  });

  if (!row) {
    res.status(404).json({ error: "External event not found" });
    return;
  }

  const servicesByEventId = await getServicesByEventIds([row.id]);
  res.json(formatExternalEvent(row, servicesByEventId.get(row.id) ?? []));
});

router.delete("/external-events/:id", async (req, res): Promise<void> => {
  const params = DeleteExternalEventParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .delete(externalEventsTable)
    .where(eq(externalEventsTable.id, params.data.id))
    .returning();

  if (!row) {
    res.status(404).json({ error: "External event not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
