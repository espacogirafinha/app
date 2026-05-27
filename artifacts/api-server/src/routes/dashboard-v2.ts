import { Router, type IRouter } from "express";
import { db, externalEventsTable, externalEventServicesTable, venueEventsTable, workshopParticipantsTable, workshopsTable } from "@workspace/db";

const router: IRouter = Router();

const ACTIVE_PARTICIPANT_STATUSES = new Set(["registered", "confirmed", "attended"]);

type VenueEventRow = typeof venueEventsTable.$inferSelect;
type ExternalEventRow = typeof externalEventsTable.$inferSelect;
type ExternalEventServiceRow = typeof externalEventServicesTable.$inferSelect;
type WorkshopRow = typeof workshopsTable.$inferSelect;
type WorkshopParticipantRow = typeof workshopParticipantsTable.$inferSelect;

type DashboardAreaType = "venue_events" | "external_events" | "workshops";
type DashboardPaymentStatus = "unpaid" | "partial" | "paid" | "none";

type DashboardAgendaItem = {
  id: string;
  type: DashboardAreaType;
  typeLabel: string;
  title: string;
  date: string;
  time: string;
  location: string | null;
  status: string;
  paymentStatus: DashboardPaymentStatus;
  total: number;
  received: number;
  pending: number;
  nextAction: string;
  href: string;
  services: string[];
};

function money(value: unknown) {
  return Number.parseFloat(String(value ?? 0));
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(baseDate: string, days: number) {
  const date = new Date(`${baseDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function isActiveStatus(status: string) {
  return status !== "cancelled";
}

function isUpcoming(date: string, today: string) {
  return date >= today;
}

function isWithinNextSevenDays(date: string, today: string, endDate: string) {
  return date >= today && date <= endDate;
}

function paymentStatusFromAmounts(total: number, received: number): DashboardPaymentStatus {
  if (total <= 0 && received <= 0) return "none";
  if (received >= total) return "paid";
  if (received > 0) return "partial";
  return "unpaid";
}

function nextAction(status: string, paymentStatus: DashboardPaymentStatus, pending: number, area: DashboardAreaType) {
  if (status === "cancelled") return "Cancelado";
  if (status === "completed") return "Concluido";
  if (paymentStatus !== "paid" && pending > 0) {
    return paymentStatus === "unpaid" ? "Cobrar sinal" : "Cobrar restante";
  }
  if (area === "workshops") return "Ver participantes";
  if (status === "draft") return "Confirmar detalhes";
  return "Preparar evento";
}

function servicesByExternalEventId(services: ExternalEventServiceRow[]) {
  return services.reduce<Map<string, ExternalEventServiceRow[]>>((acc, service) => {
    const items = acc.get(service.externalEventId) ?? [];
    items.push(service);
    acc.set(service.externalEventId, items);
    return acc;
  }, new Map());
}

function participantsByWorkshopId(participants: WorkshopParticipantRow[]) {
  return participants.reduce<Map<string, WorkshopParticipantRow[]>>((acc, participant) => {
    const items = acc.get(participant.workshopId) ?? [];
    items.push(participant);
    acc.set(participant.workshopId, items);
    return acc;
  }, new Map());
}

function venueAgendaItem(row: VenueEventRow): DashboardAgendaItem {
  const total = money(row.totalPrice);
  const received = money(row.amountPaid);
  const pending = Math.max(0, total - received);
  const paymentStatus = paymentStatusFromAmounts(total, received);

  return {
    id: row.id,
    type: "venue_events",
    typeLabel: "Festa no Espaco",
    title: row.birthdayChildName ? `${row.customerName} - ${row.birthdayChildName}` : row.customerName,
    date: row.eventDate,
    time: row.startTime,
    location: "Espaco Girafinha",
    status: row.status,
    paymentStatus,
    total,
    received,
    pending,
    nextAction: nextAction(row.status, paymentStatus, pending, "venue_events"),
    href: "/venue-events",
    services: [row.packName],
  };
}

function externalAgendaItem(row: ExternalEventRow, services: ExternalEventServiceRow[]): DashboardAgendaItem {
  const total = money(row.totalPrice);
  const received = money(row.amountPaid);
  const pending = Math.max(0, total - received);
  const paymentStatus = paymentStatusFromAmounts(total, received);

  return {
    id: row.id,
    type: "external_events",
    typeLabel: "Servico Externo",
    title: row.customerName,
    date: row.eventDate,
    time: row.startTime,
    location: row.eventLocation,
    status: row.status,
    paymentStatus,
    total,
    received,
    pending,
    nextAction: nextAction(row.status, paymentStatus, pending, "external_events"),
    href: "/external-events",
    services: services
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((service) => service.serviceLabel),
  };
}

function workshopAgendaItem(row: WorkshopRow, participants: WorkshopParticipantRow[]): DashboardAgendaItem {
  const activeParticipants = participants.filter((participant) => ACTIVE_PARTICIPANT_STATUSES.has(participant.status));
  const received = activeParticipants.reduce((sum, participant) => sum + money(participant.amountPaid), 0);
  const pending = activeParticipants.reduce((sum, participant) => sum + money(participant.amountDue), 0);
  const total = received + pending;
  const paymentStatus = paymentStatusFromAmounts(total, received);

  return {
    id: row.id,
    type: "workshops",
    typeLabel: "Workshop/Formacao",
    title: row.name,
    date: row.date,
    time: row.startTime,
    location: row.location,
    status: row.status,
    paymentStatus,
    total,
    received,
    pending,
    nextAction: nextAction(row.status, paymentStatus, pending, "workshops"),
    href: "/workshops",
    services: [`${activeParticipants.length}/${row.capacity} inscritos`],
  };
}

function areaSummary(items: DashboardAgendaItem[], today: string, nextSevenDaysEnd: string) {
  const activeItems = items.filter((item) => isActiveStatus(item.status));
  const upcomingItems = activeItems.filter((item) => isUpcoming(item.date, today));

  return {
    totalCount: activeItems.length,
    upcomingCount: upcomingItems.length,
    nextSevenDaysCount: activeItems.filter((item) => isWithinNextSevenDays(item.date, today, nextSevenDaysEnd)).length,
    received: activeItems.reduce((sum, item) => sum + item.received, 0),
    pending: activeItems.reduce((sum, item) => sum + item.pending, 0),
  };
}

router.get("/dashboard-v2", async (_req, res): Promise<void> => {
  const [venueEvents, externalEvents, externalServices, workshops, workshopParticipants] = await Promise.all([
    db.select().from(venueEventsTable),
    db.select().from(externalEventsTable),
    db.select().from(externalEventServicesTable),
    db.select().from(workshopsTable),
    db.select().from(workshopParticipantsTable),
  ]);

  const today = todayIso();
  const nextSevenDaysEnd = addDaysIso(today, 7);
  const servicesByEvent = servicesByExternalEventId(externalServices);
  const participantsByWorkshop = participantsByWorkshopId(workshopParticipants);

  const venueItems = venueEvents.map(venueAgendaItem);
  const externalItems = externalEvents.map((event) => externalAgendaItem(event, servicesByEvent.get(event.id) ?? []));
  const workshopItems = workshops.map((workshop) => workshopAgendaItem(workshop, participantsByWorkshop.get(workshop.id) ?? []));
  const activeWorkshopIds = new Set(workshops.filter((workshop) => isActiveStatus(workshop.status)).map((workshop) => workshop.id));
  const allItems = [...venueItems, ...externalItems, ...workshopItems];
  const activeItems = allItems.filter((item) => isActiveStatus(item.status));

  const agenda = activeItems
    .filter((item) => isUpcoming(item.date, today))
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
    .slice(0, 12);

  res.json({
    summary: {
      todayCount: activeItems.filter((item) => item.date === today).length,
      nextSevenDaysCount: activeItems.filter((item) => isWithinNextSevenDays(item.date, today, nextSevenDaysEnd)).length,
      totalReceived: activeItems.reduce((sum, item) => sum + item.received, 0),
      totalPending: activeItems.reduce((sum, item) => sum + item.pending, 0),
    },
    areas: {
      venueEvents: areaSummary(venueItems, today, nextSevenDaysEnd),
      externalEvents: areaSummary(externalItems, today, nextSevenDaysEnd),
      workshops: {
        ...areaSummary(workshopItems, today, nextSevenDaysEnd),
        activeParticipantsCount: workshopParticipants.filter(
          (participant) => activeWorkshopIds.has(participant.workshopId) && ACTIVE_PARTICIPANT_STATUSES.has(participant.status),
        ).length,
        availableSeats: workshops
          .filter((workshop) => isActiveStatus(workshop.status))
          .reduce((sum, workshop) => {
            const participants = participantsByWorkshop.get(workshop.id) ?? [];
            const activeParticipants = participants.filter((participant) => ACTIVE_PARTICIPANT_STATUSES.has(participant.status));
            return sum + Math.max(0, workshop.capacity - activeParticipants.length);
          }, 0),
      },
    },
    agenda,
  });
});

export default router;
