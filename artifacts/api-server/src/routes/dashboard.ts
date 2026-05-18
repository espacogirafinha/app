import { Router, type IRouter } from "express";
import { gte, lte, and } from "drizzle-orm";
import { db, reservationsTable } from "@workspace/db";
import { GetCalendarReservationsQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

function getServiceType(pack: string): string {
  if (pack.startsWith("Workshop")) return "Workshops";
  if (["Decoração Externa", "Catering / Brunch", "Animação", "Aluguer de Insuflável"].includes(pack)) {
    return "Serviços externos";
  }
  return "Festas no espaço";
}

function computePaymentStatus(totalPrice: number, amountPaid: number): string {
  if (amountPaid >= totalPrice) return "paid";
  if (amountPaid > 0) return "partial";
  return "unpaid";
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
    remainingBalance: remaining,
    paymentStatus: computePaymentStatus(total, paid),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

router.get("/dashboard/stats", async (req, res): Promise<void> => {
  const allRows = await db.select().from(reservationsTable);

  const today = new Date().toISOString().slice(0, 10);

  let totalRevenue = 0;
  let totalPaid = 0;
  let totalPending = 0;
  let paidCount = 0;
  let partialCount = 0;
  let unpaidCount = 0;
  let upcomingCount = 0;

  for (const row of allRows) {
    const total = parseFloat(row.totalPrice as unknown as string);
    const paid = parseFloat(row.amountPaid as unknown as string);
    const remaining = Math.max(0, total - paid);

    totalRevenue += total;
    totalPaid += paid;
    totalPending += remaining;

    const status = computePaymentStatus(total, paid);
    if (status === "paid") paidCount++;
    else if (status === "partial") partialCount++;
    else unpaidCount++;

    if (row.eventDate >= today) upcomingCount++;
  }

  res.json({
    totalReservations: allRows.length,
    totalRevenue,
    totalPaid,
    totalPending,
    upcomingCount,
    paidCount,
    partialCount,
    unpaidCount,
  });
});

router.get("/dashboard/upcoming", async (req, res): Promise<void> => {
  const today = new Date().toISOString().slice(0, 10);

  const rows = await db
    .select()
    .from(reservationsTable)
    .where(gte(reservationsTable.eventDate, today))
    .orderBy(reservationsTable.eventDate);

  res.json(rows.map(formatReservation));
});

router.get("/dashboard/calendar", async (req, res): Promise<void> => {
  const parsed = GetCalendarReservationsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { year, month } = parsed.data;

  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const rows = await db
    .select()
    .from(reservationsTable)
    .where(
      and(
        gte(reservationsTable.eventDate, startDate),
        lte(reservationsTable.eventDate, endDate)
      )
    )
    .orderBy(reservationsTable.eventDate);

  const byDate: Record<string, ReturnType<typeof formatReservation>[]> = {};
  for (const row of rows) {
    const date = row.eventDate;
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push(formatReservation(row));
  }

  const calendarDays = Object.entries(byDate).map(([date, reservations]) => ({
    date,
    reservations,
  }));

  res.json(calendarDays);
});

export default router;
