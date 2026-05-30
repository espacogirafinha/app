import { Router, type IRouter } from "express";
import { eq, and, ilike, or, gte, lte, sql } from "drizzle-orm";
import { db, reservationsTable, tasksTable } from "@workspace/db";
import {
  ListReservationsQueryParams,
  CreateReservationBody,
  GetReservationParams,
  GetReservationResponse,
  UpdateReservationParams,
  UpdateReservationBody,
  DeleteReservationParams,
  GetCalendarReservationsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function getServiceType(pack: string): string {
  if (pack.startsWith("Workshop")) return "Workshops";
  if (["Decoração Externa", "Catering / Brunch", "Animação", "Aluguer de Insuflável"].includes(pack)) {
    return "Serviços externos";
  }
  return "Festas no espaço";
}

function getReservationType(pack: string): "venue_party" | "external_service" | "workshop" {
  const serviceType = getServiceType(pack);
  if (serviceType === "Workshops") return "workshop";
  if (serviceType === "ServiÃ§os externos") return "external_service";
  return "venue_party";
}

function computePaymentStatus(totalPrice: number, amountPaid: number): string {
  if (amountPaid >= totalPrice) return "paid";
  if (amountPaid > 0) return "partial";
  return "unpaid";
}

function compactObject<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as Partial<T>;
}

function formatReservation(r: typeof reservationsTable.$inferSelect) {
  const total = parseFloat(r.totalPrice as unknown as string);
  const paid = parseFloat(r.amountPaid as unknown as string);
  const remaining = Math.max(0, total - paid);
  return {
    id: r.id,
    customerName: r.customerName,
    phone: r.phone,
    eventDate: r.eventDate,
    eventTime: r.eventTime,
    pack: r.pack,
    serviceType: getServiceType(r.pack),
    numChildren: r.numChildren,
    childrenAges: r.childrenAges,
    extras: r.extras,
    notes: r.notes,
    totalPrice: total,
    amountPaid: paid,
    reservationType: r.reservationType,
    customerEmail: r.customerEmail,
    customerNif: r.customerNif,
    paymentMethod: r.paymentMethod,
    reservationSource: r.reservationSource,
    reservationStatus: r.reservationStatus,
    birthdayChildName: r.birthdayChildName,
    birthdayChildAge: r.birthdayChildAge,
    partyTheme: r.partyTheme,
    decorationNotes: r.decorationNotes,
    cateringOption: r.cateringOption,
    allergies: r.allergies,
    imageAuthorization: r.imageAuthorization,
    termsAccepted: r.termsAccepted,
    eventLocation: r.eventLocation,
    guestCount: r.guestCount,
    eventType: r.eventType,
    eventTheme: r.eventTheme,
    externalServiceNotes: r.externalServiceNotes,
    workshopName: r.workshopName,
    participantCount: r.participantCount,
    workshopNotes: r.workshopNotes,
    remainingBalance: remaining,
    paymentStatus: computePaymentStatus(total, paid),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

router.get("/reservations", async (req, res): Promise<void> => {
  const parsed = ListReservationsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { search, status, serviceType, dateFrom, dateTo } = parsed.data;

  const conditions = [];

  if (search) {
    conditions.push(
      or(
        ilike(reservationsTable.customerName, `%${search}%`),
        ilike(reservationsTable.phone, `%${search}%`)
      )
    );
  }

  if (dateFrom) {
    conditions.push(gte(reservationsTable.eventDate, dateFrom));
  }

  if (dateTo) {
    conditions.push(lte(reservationsTable.eventDate, dateTo));
  }

  let rows = await db
    .select()
    .from(reservationsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(reservationsTable.eventDate);

  const formatted = rows.map(formatReservation);

  const result = status
    ? formatted.filter((r) => r.paymentStatus === status)
    : formatted;

  res.json(serviceType ? result.filter((r) => r.serviceType === serviceType) : result);
});

const DEFAULT_TASKS_BY_PACK: Record<string, string[]> = {
  "Aluguer do Espaço": [
    "Confirmar sinal",
    "Confirmar caução",
    "Preparar espaço",
    "Limpeza final",
  ],
  "Pack Simples": [
    "Confirmar sinal",
    "Confirmar número de crianças",
    "Confirmar menu",
    "Lista de compras",
    "Preparar lanche",
    "Preparar espaço e brinquedos",
  ],
  "Pack com Decoração": [
    "Confirmar sinal",
    "Confirmar número de crianças",
    "Confirmar menu",
    "Lista de compras",
    "Confirmar tema",
    "Confirmar cores",
    "Preparar balões",
    "Preparar displays",
    "Montar decoração",
    "Preparar lanche",
  ],
  "Pack Completo": [
    "Confirmar sinal",
    "Confirmar número de crianças",
    "Confirmar menu",
    "Lista de compras",
    "Confirmar tema",
    "Confirmar cores",
    "Preparar balões",
    "Preparar displays",
    "Preparar decoração",
    "Preparar lanche crianças",
    "Preparar catering adultos",
    "Confirmar bolo/aniversário",
  ],
  "Decoração Externa": [
    "Confirmar local e horário de montagem",
    "Definir tema e cores",
    "Preparar materiais",
    "Montar decoração no local",
  ],
  "Catering / Brunch": [
    "Confirmar número de pessoas",
    "Definir menu",
    "Lista de compras",
    "Preparar entrega/montagem",
  ],
  "Animação": [
    "Confirmar atividades",
    "Preparar materiais",
    "Confirmar horário e local",
  ],
  "Aluguer de Insuflável": [
    "Confirmar local de montagem",
    "Confirmar transporte",
    "Verificar equipamento",
    "Agendar recolha",
  ],
  "Workshop Balões Nível 1": [
    "Confirmar número mínimo de participantes",
    "Preparar materiais",
    "Preparar coffee break",
    "Preparar certificados",
  ],
  "Workshop Balões + Kit Inicial": [
    "Confirmar número mínimo de participantes",
    "Preparar materiais",
    "Preparar kits iniciais",
    "Preparar coffee break",
    "Preparar certificados",
  ],
  "Só Espaço": [
    "Confirmar sinal",
    "Preparar espaço",
    "Confirmar horários",
    "Limpeza final",
  ],
  "Espaço + Lanche": [
    "Confirmar sinal",
    "Confirmar número de crianças",
    "Confirmar menu",
    "Lista de compras",
    "Preparar lanche",
    "Preparar espaço",
  ],
  "Espaço + Decoração": [
    "Confirmar sinal",
    "Confirmar número de crianças",
    "Confirmar tema",
    "Confirmar cores",
    "Lista de compras",
    "Displays do tema",
    "Preparar balões",
    "Montar decoração",
  ],
};

router.post("/reservations", async (req, res): Promise<void> => {
  const parsed = CreateReservationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { totalPrice, amountPaid, serviceType: _serviceType, ...rest } = parsed.data;
  const values = compactObject({
    ...rest,
    reservationType: rest.reservationType ?? getReservationType(rest.pack),
    reservationStatus: rest.reservationStatus ?? "draft",
    totalPrice: String(totalPrice),
    amountPaid: String(amountPaid),
  });

  const row = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(reservationsTable)
      .values(values as typeof reservationsTable.$inferInsert)
      .returning();

    const defaultTasks = DEFAULT_TASKS_BY_PACK[created.pack] ?? [];
    if (defaultTasks.length > 0) {
      await tx.insert(tasksTable).values(
        defaultTasks.map((title, idx) => ({
          reservationId: created.id,
          title,
          sortOrder: idx + 1,
        }))
      );
    }

    return created;
  });

  res.status(201).json(formatReservation(row));
});

router.get("/reservations/:id", async (req, res): Promise<void> => {
  const params = GetReservationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .select()
    .from(reservationsTable)
    .where(eq(reservationsTable.id, params.data.id));

  if (!row) {
    res.status(404).json({ error: "Reservation not found" });
    return;
  }

  res.json(formatReservation(row));
});

router.patch("/reservations/:id", async (req, res): Promise<void> => {
  const params = UpdateReservationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateReservationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { serviceType: _serviceType, ...body } = parsed.data;
  const updateData: Record<string, unknown> = compactObject({ ...body });
  if (parsed.data.totalPrice !== undefined) {
    updateData.totalPrice = String(parsed.data.totalPrice);
  }
  if (parsed.data.amountPaid !== undefined) {
    updateData.amountPaid = String(parsed.data.amountPaid);
  }

  const [row] = await db
    .update(reservationsTable)
    .set(updateData)
    .where(eq(reservationsTable.id, params.data.id))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Reservation not found" });
    return;
  }

  res.json(formatReservation(row));
});

router.delete("/reservations/:id", async (req, res): Promise<void> => {
  const params = DeleteReservationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .delete(reservationsTable)
    .where(eq(reservationsTable.id, params.data.id))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Reservation not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
