import { Router, type IRouter } from "express";
import { and, eq, gte, ilike, lte, or } from "drizzle-orm";
import { db, eventSelectedExtrasTable, venueEventsTable } from "@workspace/db";
import {
  CreateVenueEventBody,
  DeleteVenueEventParams,
  GetVenueEventParams,
  ListVenueEventsQueryParams,
  UpdateVenueEventBody,
  UpdateVenueEventParams,
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

function formatVenueEvent(row: typeof venueEventsTable.$inferSelect) {
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
    packName: row.packName,
    birthdayChildName: row.birthdayChildName,
    birthdayChildAge: row.birthdayChildAge,
    childrenCount: row.childrenCount ?? 0,
    childrenAges: row.childrenAges,
    partyTheme: row.partyTheme,
    decorationNotes: row.decorationNotes,
    cateringNotes: row.cateringNotes,
    allergies: row.allergies,
    imageAuthorization: row.imageAuthorization,
    termsAccepted: row.termsAccepted ?? false,
    totalPrice,
    amountPaid,
    remainingBalance: Math.max(0, totalPrice - amountPaid),
    paymentMethod: row.paymentMethod,
    notes: row.notes,
    createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
    updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
  };
}

router.get("/venue-events", async (req, res): Promise<void> => {
  const parsed = ListVenueEventsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { search, status, paymentStatus, dateFrom, dateTo } = parsed.data;
  const conditions = [];

  if (search) {
    conditions.push(
      or(
        ilike(venueEventsTable.customerName, `%${search}%`),
        ilike(venueEventsTable.phone, `%${search}%`),
        ilike(venueEventsTable.birthdayChildName, `%${search}%`),
      ),
    );
  }

  if (status) conditions.push(eq(venueEventsTable.status, status));
  if (paymentStatus) conditions.push(eq(venueEventsTable.paymentStatus, paymentStatus));
  if (dateFrom) conditions.push(gte(venueEventsTable.eventDate, dateFrom));
  if (dateTo) conditions.push(lte(venueEventsTable.eventDate, dateTo));

  const rows = await db
    .select()
    .from(venueEventsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(venueEventsTable.eventDate);

  res.json(rows.map(formatVenueEvent));
});

router.post("/venue-events", async (req, res): Promise<void> => {
  const parsed = CreateVenueEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { totalPrice, amountPaid, ...body } = parsed.data;
  const paymentStatus = computePaymentStatus(totalPrice, amountPaid);
  const values = compactObject({
    ...body,
    status: body.status ?? "draft",
    paymentStatus,
    childrenCount: body.childrenCount ?? 0,
    termsAccepted: body.termsAccepted ?? false,
    totalPrice: String(totalPrice),
    amountPaid: String(amountPaid),
  });

  const [row] = await db
    .insert(venueEventsTable)
    .values(values as typeof venueEventsTable.$inferInsert)
    .returning();

  res.status(201).json(formatVenueEvent(row));
});

router.get("/venue-events/:id", async (req, res): Promise<void> => {
  const params = GetVenueEventParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .select()
    .from(venueEventsTable)
    .where(eq(venueEventsTable.id, params.data.id));

  if (!row) {
    res.status(404).json({ error: "Venue event not found" });
    return;
  }

  res.json(formatVenueEvent(row));
});

router.patch("/venue-events/:id", async (req, res): Promise<void> => {
  const params = UpdateVenueEventParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateVenueEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = compactObject({ ...parsed.data });
  if (parsed.data.totalPrice !== undefined) updateData.totalPrice = String(parsed.data.totalPrice);
  if (parsed.data.amountPaid !== undefined) updateData.amountPaid = String(parsed.data.amountPaid);
  if (parsed.data.totalPrice !== undefined || parsed.data.amountPaid !== undefined) {
    const [current] = await db
      .select()
      .from(venueEventsTable)
      .where(eq(venueEventsTable.id, params.data.id));

    if (!current) {
      res.status(404).json({ error: "Venue event not found" });
      return;
    }

    const total = parsed.data.totalPrice ?? money(current.totalPrice);
    const paid = parsed.data.amountPaid ?? money(current.amountPaid);
    updateData.paymentStatus = computePaymentStatus(total, paid);
  }

  const [row] = await db
    .update(venueEventsTable)
    .set(updateData)
    .where(eq(venueEventsTable.id, params.data.id))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Venue event not found" });
    return;
  }

  res.json(formatVenueEvent(row));
});

router.delete("/venue-events/:id", async (req, res): Promise<void> => {
  const params = DeleteVenueEventParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const row = await db.transaction(async (tx) => {
    await tx
      .delete(eventSelectedExtrasTable)
      .where(and(
        eq(eventSelectedExtrasTable.module, "venue_events"),
        eq(eventSelectedExtrasTable.entityId, params.data.id),
      ));

    const [deleted] = await tx
      .delete(venueEventsTable)
      .where(eq(venueEventsTable.id, params.data.id))
      .returning();

    return deleted;
  });

  if (!row) {
    res.status(404).json({ error: "Venue event not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
