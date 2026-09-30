import { and, eq, isNull } from "drizzle-orm";
import {
  db,
  eventPaymentsTable,
  externalEventsTable,
  venueEventsTable,
} from "@workspace/db";
import {
  type EventPaymentMethod,
  type EventPaymentModule,
  type EventPaymentType,
  EventPaymentRuleError,
  assertPaymentWithinBalance,
  summarizeEventPayments,
  validatePaymentDraft,
} from "./event-payment-rules";
import {
  buildFinancialMovements,
  type FinancialMovementsResult,
} from "./financial-movements";

export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export class EventPaymentServiceError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: "not_found" | "validation" | "overpayment",
    message: string,
  ) {
    super(message);
    this.name = "EventPaymentServiceError";
  }
}

export type CreateEventPaymentInput = {
  module: EventPaymentModule;
  entityId: string;
  paymentType: Exclude<EventPaymentType, "legacy_payment">;
  amount: number;
  paymentMethod: EventPaymentMethod | null;
  paidAt: Date | null;
  notes?: string | null;
  source?: string;
  sourceReference?: string | null;
};

export type UpdateEventPaymentInput = {
  paymentType?: EventPaymentType;
  amount?: number;
  paymentMethod?: EventPaymentMethod | null;
  paidAt?: Date | null;
  notes?: string | null;
};

function money(value: unknown) {
  return Number.parseFloat(String(value ?? 0));
}

function parentCondition(module: EventPaymentModule, entityId: string) {
  return module === "venue_events"
    ? eq(eventPaymentsTable.venueEventId, entityId)
    : eq(eventPaymentsTable.externalEventId, entityId);
}

async function lockEvent(tx: DbTransaction, module: EventPaymentModule, entityId: string) {
  if (module === "venue_events") {
    const [row] = await tx
      .select()
      .from(venueEventsTable)
      .where(eq(venueEventsTable.id, entityId))
      .for("update");
    if (!row) throw new EventPaymentServiceError(404, "not_found", "Venue event not found");
    return {
      totalPrice: money(row.totalPrice),
      expectedDeposit: row.expectedReservationDepositAmount === null
        ? null
        : money(row.expectedReservationDepositAmount),
      reservationDepositPolicy: row.reservationDepositPolicy,
    };
  }

  const [row] = await tx
    .select()
    .from(externalEventsTable)
    .where(eq(externalEventsTable.id, entityId))
    .for("update");
  if (!row) throw new EventPaymentServiceError(404, "not_found", "External event not found");
  return {
    totalPrice: money(row.totalPrice),
    expectedDeposit: row.expectedReservationDepositAmount === null
      ? null
      : money(row.expectedReservationDepositAmount),
    reservationDepositPolicy: row.reservationDepositPolicy,
  };
}

async function readEvent(module: EventPaymentModule, entityId: string) {
  if (module === "venue_events") {
    const [row] = await db.select().from(venueEventsTable).where(eq(venueEventsTable.id, entityId));
    if (!row) throw new EventPaymentServiceError(404, "not_found", "Venue event not found");
    return {
      totalPrice: money(row.totalPrice),
      expectedDeposit: row.expectedReservationDepositAmount === null
        ? null
        : money(row.expectedReservationDepositAmount),
    };
  }

  const [row] = await db.select().from(externalEventsTable).where(eq(externalEventsTable.id, entityId));
  if (!row) throw new EventPaymentServiceError(404, "not_found", "External event not found");
  return {
    totalPrice: money(row.totalPrice),
    expectedDeposit: row.expectedReservationDepositAmount === null
      ? null
      : money(row.expectedReservationDepositAmount),
  };
}

export async function getActiveReceivedAmount(
  tx: DbTransaction,
  module: EventPaymentModule,
  entityId: string,
) {
  const rows = await tx
    .select({ amount: eventPaymentsTable.amount })
    .from(eventPaymentsTable)
    .where(and(parentCondition(module, entityId), isNull(eventPaymentsTable.deletedAt)));
  return rows.reduce((sum, row) => sum + money(row.amount), 0);
}

async function activePaymentRows(
  tx: DbTransaction,
  module: EventPaymentModule,
  entityId: string,
) {
  return tx
    .select()
    .from(eventPaymentsTable)
    .where(and(parentCondition(module, entityId), isNull(eventPaymentsTable.deletedAt)));
}

function publicPayment(row: typeof eventPaymentsTable.$inferSelect) {
  return {
    id: row.id,
    venueEventId: row.venueEventId,
    externalEventId: row.externalEventId,
    paymentType: row.paymentType as EventPaymentType,
    amount: money(row.amount),
    paymentMethod: row.paymentMethod as EventPaymentMethod | null,
    paidAt: row.paidAt,
    notes: row.notes,
    source: row.source,
    sourceReference: row.sourceReference,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

function toPaymentLike(row: typeof eventPaymentsTable.$inferSelect) {
  return {
    id: row.id,
    paymentType: row.paymentType as EventPaymentType,
    amount: money(row.amount),
    deletedAt: row.deletedAt,
  };
}

export async function synchronizeEventPaymentSummary(
  tx: DbTransaction,
  module: EventPaymentModule,
  entityId: string,
) {
  const event = await lockEvent(tx, module, entityId);
  const rows = await activePaymentRows(tx, module, entityId);
  const summary = summarizeEventPayments({
    totalPrice: event.totalPrice,
    expectedDeposit: event.expectedDeposit,
    payments: rows.map(toPaymentLike),
  });

  if (module === "venue_events") {
    await tx
      .update(venueEventsTable)
      .set({ amountPaid: String(summary.received), paymentStatus: summary.paymentStatus })
      .where(eq(venueEventsTable.id, entityId));
  } else {
    await tx
      .update(externalEventsTable)
      .set({ amountPaid: String(summary.received), paymentStatus: summary.paymentStatus })
      .where(eq(externalEventsTable.id, entityId));
  }

  return summary;
}

function translateRuleError(error: unknown): never {
  if (error instanceof EventPaymentRuleError) {
    throw new EventPaymentServiceError(
      400,
      error.code === "overpayment" ? "overpayment" : "validation",
      error.message,
    );
  }
  throw error;
}

export async function listEventPayments(module: EventPaymentModule, entityId: string) {
  const event = await readEvent(module, entityId);
  const rows = await db
    .select()
    .from(eventPaymentsTable)
    .where(and(parentCondition(module, entityId), isNull(eventPaymentsTable.deletedAt)));

  return {
    items: rows.map(publicPayment),
    summary: summarizeEventPayments({
      totalPrice: event.totalPrice,
      expectedDeposit: event.expectedDeposit,
      payments: rows.map(toPaymentLike),
    }),
  };
}

export async function listFinancialMovements(): Promise<FinancialMovementsResult> {
  const rows = await db
    .select({
      id: eventPaymentsTable.id,
      venueEventId: eventPaymentsTable.venueEventId,
      externalEventId: eventPaymentsTable.externalEventId,
      paymentType: eventPaymentsTable.paymentType,
      amount: eventPaymentsTable.amount,
      paymentMethod: eventPaymentsTable.paymentMethod,
      paidAt: eventPaymentsTable.paidAt,
      notes: eventPaymentsTable.notes,
      createdAt: eventPaymentsTable.createdAt,
      deletedAt: eventPaymentsTable.deletedAt,
      venueCustomerName: venueEventsTable.customerName,
      venueBirthdayChildName: venueEventsTable.birthdayChildName,
      venueEventDate: venueEventsTable.eventDate,
      externalCustomerName: externalEventsTable.customerName,
      externalEventDate: externalEventsTable.eventDate,
    })
    .from(eventPaymentsTable)
    .leftJoin(venueEventsTable, eq(eventPaymentsTable.venueEventId, venueEventsTable.id))
    .leftJoin(externalEventsTable, eq(eventPaymentsTable.externalEventId, externalEventsTable.id))
    .where(isNull(eventPaymentsTable.deletedAt));

  return buildFinancialMovements(
    rows.map((row) => ({
      ...row,
      paymentType: row.paymentType as EventPaymentType,
      amount: money(row.amount),
      paymentMethod: row.paymentMethod as EventPaymentMethod | null,
    })),
  );
}

export async function createEventPaymentInTransaction(
  tx: DbTransaction,
  input: CreateEventPaymentInput,
) {
  try {
    const source = input.source ?? "manual";
    validatePaymentDraft({
      paymentType: input.paymentType,
      amount: input.amount,
      paymentMethod: input.paymentMethod,
      paidAt: input.paidAt,
      source,
    });

    const event = await lockEvent(tx, input.module, input.entityId);
    const rows = await activePaymentRows(tx, input.module, input.entityId);
    assertPaymentWithinBalance(event.totalPrice, rows.map(toPaymentLike), input.amount);

    const [created] = await tx
      .insert(eventPaymentsTable)
      .values({
        venueEventId: input.module === "venue_events" ? input.entityId : null,
        externalEventId: input.module === "external_events" ? input.entityId : null,
        paymentType: input.paymentType,
        amount: String(input.amount),
        paymentMethod: input.paymentMethod,
        paidAt: input.paidAt,
        notes: input.notes ?? null,
        source,
        sourceReference: input.sourceReference ?? null,
      })
      .returning();

    if (
      input.module === "venue_events"
      && input.paymentType === "reservation_deposit"
      && event.reservationDepositPolicy === "auto_20"
    ) {
      await tx
        .update(venueEventsTable)
        .set({ reservationDepositPolicy: "frozen_after_payment" })
        .where(eq(venueEventsTable.id, input.entityId));
    }

    const summary = await synchronizeEventPaymentSummary(tx, input.module, input.entityId);
    return { payment: publicPayment(created), summary };
  } catch (error) {
    translateRuleError(error);
  }
}

export async function createEventPayment(input: CreateEventPaymentInput) {
  return db.transaction((tx) => createEventPaymentInTransaction(tx, input));
}

export async function updateEventPayment(paymentId: string, input: UpdateEventPaymentInput) {
  try {
    return await db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(eventPaymentsTable)
        .where(and(eq(eventPaymentsTable.id, paymentId), isNull(eventPaymentsTable.deletedAt)));

      if (!current) {
        throw new EventPaymentServiceError(404, "not_found", "Payment not found");
      }

      const module: EventPaymentModule = current.venueEventId ? "venue_events" : "external_events";
      const entityId = current.venueEventId ?? current.externalEventId;
      if (!entityId) throw new EventPaymentServiceError(400, "validation", "Payment has no parent event");

      const event = await lockEvent(tx, module, entityId);
      const rows = await activePaymentRows(tx, module, entityId);
      const next = {
        paymentType: (input.paymentType ?? current.paymentType) as EventPaymentType,
        amount: input.amount ?? money(current.amount),
        paymentMethod: (input.paymentMethod === undefined
          ? current.paymentMethod
          : input.paymentMethod) as EventPaymentMethod | null,
        paidAt: input.paidAt === undefined ? current.paidAt : input.paidAt,
        source: current.source,
      };

      validatePaymentDraft(next);
      assertPaymentWithinBalance(event.totalPrice, rows.map(toPaymentLike), next.amount, paymentId);

      const [updated] = await tx
        .update(eventPaymentsTable)
        .set({
          ...(input.paymentType !== undefined ? { paymentType: input.paymentType } : {}),
          ...(input.amount !== undefined ? { amount: String(input.amount) } : {}),
          ...(input.paymentMethod !== undefined ? { paymentMethod: input.paymentMethod } : {}),
          ...(input.paidAt !== undefined ? { paidAt: input.paidAt } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          updatedAt: new Date(),
        })
        .where(eq(eventPaymentsTable.id, paymentId))
        .returning();

      if (
        module === "venue_events"
        && next.paymentType === "reservation_deposit"
        && event.reservationDepositPolicy === "auto_20"
      ) {
        await tx
          .update(venueEventsTable)
          .set({ reservationDepositPolicy: "frozen_after_payment" })
          .where(eq(venueEventsTable.id, entityId));
      }

      const summary = await synchronizeEventPaymentSummary(tx, module, entityId);
      return { payment: publicPayment(updated), summary };
    });
  } catch (error) {
    translateRuleError(error);
  }
}

export async function softDeleteEventPayment(paymentId: string) {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(eventPaymentsTable)
      .where(and(eq(eventPaymentsTable.id, paymentId), isNull(eventPaymentsTable.deletedAt)));

    if (!current) throw new EventPaymentServiceError(404, "not_found", "Payment not found");

    const module: EventPaymentModule = current.venueEventId ? "venue_events" : "external_events";
    const entityId = current.venueEventId ?? current.externalEventId;
    if (!entityId) throw new EventPaymentServiceError(400, "validation", "Payment has no parent event");

    await lockEvent(tx, module, entityId);

    const [deleted] = await tx
      .update(eventPaymentsTable)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(eventPaymentsTable.id, paymentId))
      .returning();

    const summary = await synchronizeEventPaymentSummary(tx, module, entityId);
    return { payment: publicPayment(deleted), summary };
  });
}
