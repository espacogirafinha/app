import { Router, type IRouter } from "express";
import { and, eq, gte, ilike, lte, or } from "drizzle-orm";
import { db, workshopParticipantsTable, workshopsTable } from "@workspace/db";
import {
  CreateWorkshopBody,
  CreateWorkshopParticipantBody,
  DeleteWorkshopParams,
  DeleteWorkshopParticipantParams,
  GetWorkshopParams,
  ListWorkshopsQueryParams,
  UpdateWorkshopBody,
  UpdateWorkshopParams,
  UpdateWorkshopParticipantBody,
  UpdateWorkshopParticipantParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

const ACTIVE_PARTICIPANT_STATUSES = new Set(["registered", "confirmed", "attended"]);

type WorkshopRow = typeof workshopsTable.$inferSelect;
type WorkshopParticipantRow = typeof workshopParticipantsTable.$inferSelect;

function compactObject<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as Partial<T>;
}

function money(value: unknown) {
  return Number.parseFloat(String(value ?? 0));
}

function computeParticipantPayment(price: number, amountPaid: number) {
  const amountDue = Math.max(0, price - amountPaid);
  const paymentStatus = amountPaid >= price ? "paid" : amountPaid > 0 ? "partial" : "unpaid";
  return { amountDue, paymentStatus };
}

function isActiveParticipant(status: string) {
  return ACTIVE_PARTICIPANT_STATUSES.has(status);
}

function formatWorkshopParticipant(row: WorkshopParticipantRow) {
  return {
    id: row.id,
    workshopId: row.workshopId,
    name: row.name,
    phone: row.phone,
    email: row.email,
    nif: row.nif,
    amountPaid: money(row.amountPaid),
    amountDue: money(row.amountDue),
    paymentMethod: row.paymentMethod,
    paymentStatus: row.paymentStatus,
    status: row.status,
    notes: row.notes,
    createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
    updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
  };
}

function workshopAggregates(row: WorkshopRow, participants: WorkshopParticipantRow[]) {
  const activeParticipants = participants.filter((participant) => isActiveParticipant(participant.status));
  const participantsCount = participants.length;
  const activeParticipantsCount = activeParticipants.length;
  const totalReceived = activeParticipants.reduce((sum, participant) => sum + money(participant.amountPaid), 0);
  const totalPending = activeParticipants.reduce((sum, participant) => sum + money(participant.amountDue), 0);

  return {
    participantsCount,
    activeParticipantsCount,
    availableSeats: Math.max(0, row.capacity - activeParticipantsCount),
    totalReceived,
    totalPending,
  };
}

function formatWorkshop(row: WorkshopRow, participants: WorkshopParticipantRow[] = [], includeParticipants = false) {
  const aggregates = workshopAggregates(row, participants);

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    date: row.date,
    startTime: row.startTime,
    endTime: row.endTime,
    capacity: row.capacity,
    price: money(row.price),
    kitIncluded: row.kitIncluded,
    status: row.status,
    location: row.location,
    notes: row.notes,
    ...aggregates,
    ...(includeParticipants ? { participants: participants.map(formatWorkshopParticipant) } : {}),
    createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
    updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
  };
}

async function getParticipantsByWorkshopIds(workshopIds: string[]) {
  if (workshopIds.length === 0) return new Map<string, WorkshopParticipantRow[]>();

  const participants = await db
    .select()
    .from(workshopParticipantsTable)
    .where(or(...workshopIds.map((id) => eq(workshopParticipantsTable.workshopId, id))));

  return participants.reduce<Map<string, WorkshopParticipantRow[]>>((acc, participant) => {
    const items = acc.get(participant.workshopId) ?? [];
    items.push(participant);
    acc.set(participant.workshopId, items);
    return acc;
  }, new Map());
}

async function getWorkshopWithParticipants(id: string) {
  const [workshop] = await db.select().from(workshopsTable).where(eq(workshopsTable.id, id));
  if (!workshop) return null;

  const participants = await db
    .select()
    .from(workshopParticipantsTable)
    .where(eq(workshopParticipantsTable.workshopId, id));

  return { workshop, participants };
}

async function canAddActiveParticipant(workshopId: string, nextStatus: string, excludeParticipantId?: string) {
  const data = await getWorkshopWithParticipants(workshopId);
  if (!data) return { ok: false as const, status: 404, error: "Workshop not found" };

  if (!isActiveParticipant(nextStatus)) return { ok: true as const, workshop: data.workshop };

  const activeCount = data.participants.filter(
    (participant) => participant.id !== excludeParticipantId && isActiveParticipant(participant.status),
  ).length;

  if (activeCount >= data.workshop.capacity) {
    return { ok: false as const, status: 400, error: "Workshop capacity reached" };
  }

  return { ok: true as const, workshop: data.workshop };
}

router.get("/workshops", async (req, res): Promise<void> => {
  const parsed = ListWorkshopsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { search, status, dateFrom, dateTo } = parsed.data;
  const conditions = [];

  if (search) {
    conditions.push(or(ilike(workshopsTable.name, `%${search}%`), ilike(workshopsTable.location, `%${search}%`)));
  }

  if (status) conditions.push(eq(workshopsTable.status, status));
  if (dateFrom) conditions.push(gte(workshopsTable.date, dateFrom));
  if (dateTo) conditions.push(lte(workshopsTable.date, dateTo));

  const rows = await db
    .select()
    .from(workshopsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(workshopsTable.date);

  const participantsByWorkshopId = await getParticipantsByWorkshopIds(rows.map((row) => row.id));
  res.json(rows.map((row) => formatWorkshop(row, participantsByWorkshopId.get(row.id) ?? [])));
});

router.post("/workshops", async (req, res): Promise<void> => {
  const parsed = CreateWorkshopBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [row] = await db
    .insert(workshopsTable)
    .values(compactObject({
      ...parsed.data,
      status: parsed.data.status ?? "draft",
      capacity: parsed.data.capacity ?? 0,
      price: String(parsed.data.price ?? 0),
      kitIncluded: parsed.data.kitIncluded ?? false,
    }) as typeof workshopsTable.$inferInsert)
    .returning();

  res.status(201).json(formatWorkshop(row));
});

router.get("/workshops/:id", async (req, res): Promise<void> => {
  const params = GetWorkshopParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const data = await getWorkshopWithParticipants(params.data.id);
  if (!data) {
    res.status(404).json({ error: "Workshop not found" });
    return;
  }

  res.json(formatWorkshop(data.workshop, data.participants, true));
});

router.patch("/workshops/:id", async (req, res): Promise<void> => {
  const params = UpdateWorkshopParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateWorkshopBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = compactObject({ ...parsed.data });
  if (parsed.data.price !== undefined) updateData.price = String(parsed.data.price);

  const [row] = await db
    .update(workshopsTable)
    .set(updateData)
    .where(eq(workshopsTable.id, params.data.id))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Workshop not found" });
    return;
  }

  const participantsByWorkshopId = await getParticipantsByWorkshopIds([row.id]);
  res.json(formatWorkshop(row, participantsByWorkshopId.get(row.id) ?? [], true));
});

router.delete("/workshops/:id", async (req, res): Promise<void> => {
  const params = DeleteWorkshopParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db.delete(workshopsTable).where(eq(workshopsTable.id, params.data.id)).returning();

  if (!row) {
    res.status(404).json({ error: "Workshop not found" });
    return;
  }

  res.sendStatus(204);
});

router.post("/workshops/:id/participants", async (req, res): Promise<void> => {
  const params = GetWorkshopParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = CreateWorkshopParticipantBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const status = parsed.data.status ?? "registered";
  const capacity = await canAddActiveParticipant(params.data.id, status);
  if (!capacity.ok) {
    res.status(capacity.status).json({ error: capacity.error });
    return;
  }

  const amountPaid = parsed.data.amountPaid ?? 0;
  const payment = computeParticipantPayment(money(capacity.workshop.price), amountPaid);

  const [row] = await db
    .insert(workshopParticipantsTable)
    .values(compactObject({
      ...parsed.data,
      workshopId: params.data.id,
      status,
      amountPaid: String(amountPaid),
      amountDue: String(payment.amountDue),
      paymentStatus: payment.paymentStatus,
    }) as typeof workshopParticipantsTable.$inferInsert)
    .returning();

  res.status(201).json(formatWorkshopParticipant(row));
});

router.patch("/workshops/:id/participants/:participantId", async (req, res): Promise<void> => {
  const params = UpdateWorkshopParticipantParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateWorkshopParticipantBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [current] = await db
    .select()
    .from(workshopParticipantsTable)
    .where(eq(workshopParticipantsTable.id, params.data.participantId));

  if (!current || current.workshopId !== params.data.id) {
    res.status(404).json({ error: "Workshop participant not found" });
    return;
  }

  const nextStatus = parsed.data.status ?? current.status;
  const capacity = await canAddActiveParticipant(params.data.id, nextStatus, current.id);
  if (!capacity.ok) {
    res.status(capacity.status).json({ error: capacity.error });
    return;
  }

  const amountPaid = parsed.data.amountPaid ?? money(current.amountPaid);
  const payment = computeParticipantPayment(money(capacity.workshop.price), amountPaid);
  const updateData: Record<string, unknown> = compactObject({
    ...parsed.data,
    amountPaid: String(amountPaid),
    amountDue: String(payment.amountDue),
    paymentStatus: payment.paymentStatus,
  });

  const [row] = await db
    .update(workshopParticipantsTable)
    .set(updateData)
    .where(eq(workshopParticipantsTable.id, params.data.participantId))
    .returning();

  res.json(formatWorkshopParticipant(row));
});

router.delete("/workshops/:id/participants/:participantId", async (req, res): Promise<void> => {
  const params = DeleteWorkshopParticipantParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [current] = await db
    .select()
    .from(workshopParticipantsTable)
    .where(eq(workshopParticipantsTable.id, params.data.participantId));

  if (!current || current.workshopId !== params.data.id) {
    res.status(404).json({ error: "Workshop participant not found" });
    return;
  }

  await db.delete(workshopParticipantsTable).where(eq(workshopParticipantsTable.id, params.data.participantId));
  res.sendStatus(204);
});

export default router;
