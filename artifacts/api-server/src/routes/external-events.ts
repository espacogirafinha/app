import { Router, type IRouter } from "express";
import { and, eq, gte, ilike, lte, or } from "drizzle-orm";
import { db, eventChecklistsTable, eventSelectedExtrasTable, externalEventsTable, externalEventServicesTable } from "@workspace/db";
import {
  CreateExternalEventBody,
  DeleteExternalEventParams,
  GetExternalEventParams,
  ListExternalEventsQueryParams,
  UpdateExternalEventBody,
  UpdateExternalEventParams,
} from "@workspace/api-zod";
import { refundableDepositCreateValues, refundableDepositUpdateValues } from "../lib/refundable-deposits";
import { createEventPaymentInTransaction, getActiveReceivedAmount, synchronizeEventPaymentSummary, type DbTransaction } from "../lib/event-payments";
import { createEventWithOptionalInitialDeposit, initialReservationDepositPaymentInput } from "../lib/event-payment-creation";

const router: IRouter = Router();

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
    expectedReservationDepositAmount: row.expectedReservationDepositAmount === null ? null : money(row.expectedReservationDepositAmount),
    reservationDepositPolicy: row.reservationDepositPolicy,
    amountPaid,
    refundableDepositAmount: money(row.refundableDepositAmount),
    refundableDepositStatus: row.refundableDepositStatus,
    refundableDepositReceivedAt: row.refundableDepositReceivedAt?.toISOString() ?? null,
    refundableDepositReturnedAt: row.refundableDepositReturnedAt?.toISOString() ?? null,
    refundableDepositNotes: row.refundableDepositNotes,
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

  const {
    services,
    totalPrice,
    amountPaid: _legacyAmountPaid,
    paymentStatus: _legacyPaymentStatus,
    expectedReservationDepositAmount,
    reservationDepositPolicy,
    initialReservationDeposit,
    refundableDepositAmount,
    refundableDepositStatus,
    refundableDepositReceivedAt,
    refundableDepositReturnedAt,
    refundableDepositNotes,
    ...body
  } = parsed.data;
  const depositPolicy = reservationDepositPolicy ?? "manual";

  try {
    const row = await createEventWithOptionalInitialDeposit<DbTransaction, typeof externalEventsTable.$inferSelect>(
      (work) => db.transaction(work),
      async (tx) => {
        const [created] = await tx
          .insert(externalEventsTable)
          .values(compactObject({
            ...body,
            status: body.status ?? "draft",
            paymentStatus: "unpaid",
            guestCount: body.guestCount ?? 0,
            totalPrice: String(totalPrice),
            expectedReservationDepositAmount:
              expectedReservationDepositAmount === undefined || expectedReservationDepositAmount === null
                ? null
                : String(expectedReservationDepositAmount),
            reservationDepositPolicy: depositPolicy,
            amountPaid: "0",
            ...refundableDepositCreateValues({
              refundableDepositAmount,
              refundableDepositStatus,
              refundableDepositReceivedAt,
              refundableDepositReturnedAt,
              refundableDepositNotes,
            }),
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
      },
      initialReservationDeposit
        ? async (tx, created) => {
            const paymentInput = initialReservationDepositPaymentInput(
              "external_events",
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
      .from(externalEventsTable)
      .where(eq(externalEventsTable.id, row.id));

    const servicesByEventId = await getServicesByEventIds([row.id]);
    res.status(201).json(formatExternalEvent(fresh ?? row, servicesByEventId.get(row.id) ?? []));
  } catch (error) {
    if (error instanceof Error && "status" in error && typeof (error as { status?: unknown }).status === "number") {
      res.status((error as { status: number }).status).json({ error: error.message });
      return;
    }
    throw error;
  }
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

  const result = await db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(externalEventsTable)
      .where(eq(externalEventsTable.id, params.data.id))
      .for("update");

    if (!current) return { status: 404 as const, error: "External event not found" };

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

    const received = await getActiveReceivedAmount(tx, "external_events", params.data.id);
    const nextTotal = parsed.data.totalPrice ?? money(current.totalPrice);
    if (nextTotal + 0.001 < received) {
      return { status: 400 as const, error: "totalPrice cannot be lower than the amount already received" };
    }

    const {
      services,
      amountPaid: _amountPaid,
      paymentStatus: _paymentStatus,
      expectedReservationDepositAmount,
      reservationDepositPolicy,
      refundableDepositAmount,
      refundableDepositStatus,
      refundableDepositReceivedAt,
      refundableDepositReturnedAt,
      refundableDepositNotes,
      ...body
    } = parsed.data;
    const updateData: Record<string, unknown> = compactObject({
      ...body,
      ...refundableDepositUpdateValues({
        refundableDepositAmount,
        refundableDepositStatus,
        refundableDepositReceivedAt,
        refundableDepositReturnedAt,
        refundableDepositNotes,
      }),
    });

    if (body.totalPrice !== undefined) updateData.totalPrice = String(body.totalPrice);
    if (expectedReservationDepositAmount !== undefined) {
      updateData.expectedReservationDepositAmount =
        expectedReservationDepositAmount === null ? null : String(expectedReservationDepositAmount);
    }
    if (reservationDepositPolicy !== undefined) {
      updateData.reservationDepositPolicy = reservationDepositPolicy;
    } else if (expectedReservationDepositAmount !== undefined) {
      updateData.reservationDepositPolicy = "manual";
    }

    await tx
      .update(externalEventsTable)
      .set(updateData)
      .where(eq(externalEventsTable.id, params.data.id));

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

    await synchronizeEventPaymentSummary(tx, "external_events", params.data.id);
    const [row] = await tx
      .select()
      .from(externalEventsTable)
      .where(eq(externalEventsTable.id, params.data.id));

    return { status: 200 as const, row };
  });

  if (result.status !== 200) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  const servicesByEventId = await getServicesByEventIds([result.row.id]);
  res.json(formatExternalEvent(result.row, servicesByEventId.get(result.row.id) ?? []));
});

router.delete("/external-events/:id", async (req, res): Promise<void> => {
  const params = DeleteExternalEventParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const row = await db.transaction(async (tx) => {
    await tx
      .delete(eventSelectedExtrasTable)
      .where(and(
        eq(eventSelectedExtrasTable.module, "external_events"),
        eq(eventSelectedExtrasTable.entityId, params.data.id),
      ));

    await tx
      .delete(eventChecklistsTable)
      .where(and(
        eq(eventChecklistsTable.module, "external_events"),
        eq(eventChecklistsTable.entityId, params.data.id),
      ));

    const [deleted] = await tx
      .delete(externalEventsTable)
      .where(eq(externalEventsTable.id, params.data.id))
      .returning();

    return deleted;
  });

  if (!row) {
    res.status(404).json({ error: "External event not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
