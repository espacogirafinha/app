import { Router, type IRouter } from "express";
import { and, eq, gte, ilike, lte, or } from "drizzle-orm";
import { createEventPaymentInTransaction, getActiveReceivedAmount, synchronizeEventPaymentSummary, type DbTransaction } from "../lib/event-payments";
import { createEventWithOptionalInitialDeposit, initialReservationDepositPaymentInput } from "../lib/event-payment-creation";
import { suggestVenueReservationDeposit } from "../lib/event-payment-rules";
import { db, eventChecklistsTable, eventSelectedExtrasTable, venueEventsTable } from "@workspace/db";
import {
  CreateVenueEventBody,
  DeleteVenueEventParams,
  GetVenueEventParams,
  ListVenueEventsQueryParams,
  UpdateVenueEventBody,
  UpdateVenueEventParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

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
    expectedReservationDepositAmount: row.expectedReservationDepositAmount === null ? null : money(row.expectedReservationDepositAmount),
    reservationDepositPolicy: row.reservationDepositPolicy,
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

  const {
    totalPrice,
    amountPaid: _legacyAmountPaid,
    expectedReservationDepositAmount,
    reservationDepositPolicy,
    initialReservationDeposit,
    ...body
  } = parsed.data;
  const depositPolicy = reservationDepositPolicy ?? "auto_30";
  const expectedDeposit = depositPolicy === "auto_30"
    ? suggestVenueReservationDeposit(totalPrice)
    : expectedReservationDepositAmount ?? null;

  try {
    const row = await createEventWithOptionalInitialDeposit<DbTransaction, typeof venueEventsTable.$inferSelect>(
      (work) => db.transaction(work),
      async (tx) => {
        const [created] = await tx
          .insert(venueEventsTable)
          .values(compactObject({
            ...body,
            status: body.status ?? "draft",
            paymentStatus: "unpaid",
            childrenCount: body.childrenCount ?? 0,
            termsAccepted: body.termsAccepted ?? false,
            totalPrice: String(totalPrice),
            expectedReservationDepositAmount: expectedDeposit === null ? null : String(expectedDeposit),
            reservationDepositPolicy: depositPolicy,
            amountPaid: "0",
          }) as typeof venueEventsTable.$inferInsert)
          .returning();

        return created;
      },
      initialReservationDeposit
        ? async (tx, created) => {
            const paymentInput = initialReservationDepositPaymentInput(
              "venue_events",
              created.id,
              initialReservationDeposit,
            );
            if (paymentInput) {
              await createEventPaymentInTransaction(tx, paymentInput);
            }
          }
        : undefined,
    );

    const [fresh] = await db
      .select()
      .from(venueEventsTable)
      .where(eq(venueEventsTable.id, row.id));

    res.status(201).json(formatVenueEvent(fresh ?? row));
  } catch (error) {
    if (error instanceof Error && "status" in error && typeof (error as { status?: unknown }).status === "number") {
      res.status((error as { status: number }).status).json({ error: error.message });
      return;
    }
    throw error;
  }
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

  const result = await db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(venueEventsTable)
      .where(eq(venueEventsTable.id, params.data.id))
      .for("update");

    if (!current) return { status: 404 as const, error: "Venue event not found" };

    if (
      parsed.data.amountPaid !== undefined
      && Math.abs(parsed.data.amountPaid - money(current.amountPaid)) > 0.001
    ) {
      return { status: 400 as const, error: "amountPaid is read-only; use /event-payments" };
    }
    if (
      parsed.data.paymentStatus !== undefined
      && parsed.data.paymentStatus !== current.paymentStatus
    ) {
      return { status: 400 as const, error: "paymentStatus is derived from event payments" };
    }

    const received = await getActiveReceivedAmount(tx, "venue_events", params.data.id);
    const nextTotal = parsed.data.totalPrice ?? money(current.totalPrice);
    if (nextTotal + 0.001 < received) {
      return { status: 400 as const, error: "totalPrice cannot be lower than the amount already received" };
    }

    const {
      amountPaid: _amountPaid,
      paymentStatus: _paymentStatus,
      expectedReservationDepositAmount,
      reservationDepositPolicy,
      ...body
    } = parsed.data;
    const updateData: Record<string, unknown> = compactObject({ ...body });
    if (parsed.data.totalPrice !== undefined) updateData.totalPrice = String(parsed.data.totalPrice);

    let nextPolicy = reservationDepositPolicy ?? current.reservationDepositPolicy;
    if (
      expectedReservationDepositAmount !== undefined
      && reservationDepositPolicy === undefined
      && (
        expectedReservationDepositAmount === null
          ? current.expectedReservationDepositAmount !== null
          : current.expectedReservationDepositAmount === null
            || Math.abs(expectedReservationDepositAmount - money(current.expectedReservationDepositAmount)) > 0.001
      )
    ) {
      nextPolicy = "manual";
    }
    updateData.reservationDepositPolicy = nextPolicy;

    if (nextPolicy === "auto_30") {
      updateData.expectedReservationDepositAmount = String(suggestVenueReservationDeposit(nextTotal));
    } else if (expectedReservationDepositAmount !== undefined) {
      updateData.expectedReservationDepositAmount =
        expectedReservationDepositAmount === null ? null : String(expectedReservationDepositAmount);
    }

    await tx
      .update(venueEventsTable)
      .set(updateData)
      .where(eq(venueEventsTable.id, params.data.id));

    await synchronizeEventPaymentSummary(tx, "venue_events", params.data.id);
    const [row] = await tx
      .select()
      .from(venueEventsTable)
      .where(eq(venueEventsTable.id, params.data.id));

    return { status: 200 as const, row };
  });

  if (result.status !== 200) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  res.json(formatVenueEvent(result.row));
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

    await tx
      .delete(eventChecklistsTable)
      .where(and(
        eq(eventChecklistsTable.module, "venue_events"),
        eq(eventChecklistsTable.entityId, params.data.id),
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
