import { Router, type IRouter, type Response } from "express";
import {
  CreateEventPaymentBody,
  DeleteEventPaymentParams,
  ListEventPaymentsQueryParams,
  UpdateEventPaymentBody,
  UpdateEventPaymentParams,
} from "@workspace/api-zod";
import {
  EventPaymentServiceError,
  createEventPayment,
  listEventPayments,
  softDeleteEventPayment,
  updateEventPayment,
} from "../lib/event-payments";
import type { EventPaymentModule } from "../lib/event-payment-rules";

const router: IRouter = Router();

function iso(value: Date | null | undefined) {
  return value?.toISOString() ?? null;
}

function serializePayment(payment: {
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  [key: string]: unknown;
}) {
  return {
    ...payment,
    paidAt: iso(payment.paidAt),
    createdAt: iso(payment.createdAt),
    updatedAt: iso(payment.updatedAt),
    deletedAt: iso(payment.deletedAt),
  };
}

function sendError(res: Response, error: unknown) {
  if (error instanceof EventPaymentServiceError) {
    res.status(error.status).json({ error: error.message });
    return true;
  }
  return false;
}

router.get("/event-payments", async (req, res): Promise<void> => {
  const parsed = ListEventPaymentsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const result = await listEventPayments(
      parsed.data.module as EventPaymentModule,
      parsed.data.entityId,
    );
    res.json({
      items: result.items.map(serializePayment),
      summary: result.summary,
    });
  } catch (error) {
    if (!sendError(res, error)) throw error;
  }
});

router.post("/event-payments", async (req, res): Promise<void> => {
  const parsed = CreateEventPaymentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const result = await createEventPayment({
      module: parsed.data.module as EventPaymentModule,
      entityId: parsed.data.entityId,
      paymentType: parsed.data.paymentType,
      amount: parsed.data.amount,
      paymentMethod: parsed.data.paymentMethod,
      paidAt: parsed.data.paidAt,
      notes: parsed.data.notes,
    });
    res.status(201).json({
      payment: serializePayment(result.payment),
      summary: result.summary,
    });
  } catch (error) {
    if (!sendError(res, error)) throw error;
  }
});

router.patch("/event-payments/:id", async (req, res): Promise<void> => {
  const params = UpdateEventPaymentParams.safeParse(req.params);
  const body = UpdateEventPaymentBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: params.success ? body.error.message : params.error.message });
    return;
  }

  try {
    const result = await updateEventPayment(params.data.id, body.data);
    res.json({
      payment: serializePayment(result.payment),
      summary: result.summary,
    });
  } catch (error) {
    if (!sendError(res, error)) throw error;
  }
});

router.delete("/event-payments/:id", async (req, res): Promise<void> => {
  const params = DeleteEventPaymentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  try {
    const result = await softDeleteEventPayment(params.data.id);
    res.json({
      payment: serializePayment(result.payment),
      summary: result.summary,
    });
  } catch (error) {
    if (!sendError(res, error)) throw error;
  }
});

export default router;
