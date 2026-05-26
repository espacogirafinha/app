import { Router, type IRouter } from "express";
import {
  db,
  externalEventsTable,
  externalEventServicesTable,
  venueEventsTable,
  workshopParticipantsTable,
  workshopsTable,
} from "@workspace/db";

const router: IRouter = Router();

const SPACE_SLOTS_TOTAL = 2;
const ACTIVE_PARTICIPANT_STATUSES = new Set(["registered", "confirmed", "attended"]);

type VenueEventRow = typeof venueEventsTable.$inferSelect;
type ExternalEventRow = typeof externalEventsTable.$inferSelect;
type ExternalEventServiceRow = typeof externalEventServicesTable.$inferSelect;
type WorkshopRow = typeof workshopsTable.$inferSelect;
type WorkshopParticipantRow = typeof workshopParticipantsTable.$inferSelect;

type CalendarV2ItemType = "venue_event" | "external_event" | "workshop";
type CalendarV2DayStatus = "free" | "busy" | "almost_full" | "full";

type CalendarV2Item = {
  id: string;
  type: CalendarV2ItemType;
  title: string;
  date: string;
  startTime: string;
  endTime: string | null;
  customerName: string | null;
  location: string | null;
  servicesLabels: string[];
  paymentStatus: string | null;
  amountPaid: number | null;
  totalPrice: number | null;
  pendingAmount: number | null;
  capacity: number | null;
  activeParticipantsCount: number | null;
  availableSeats: number | null;
  totalReceived: number | null;
  totalPending: number | null;
  occupiesSpace: boolean;
  status: string;
};

function money(value: unknown) {
  return Number.parseFloat(String(value ?? 0));
}

function todayParts() {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  };
}

function defaultDateRange() {
  const { year, month } = todayParts();
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { startDate, endDate };
}

function addDaysIso(dateValue: string, days: number) {
  const date = new Date(`${dateValue}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function datesBetween(startDate: string, endDate: string) {
  const dates: string[] = [];
  for (let current = startDate; current <= endDate; current = addDaysIso(current, 1)) {
    dates.push(current);
  }
  return dates;
}

function isValidDateParam(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isActiveStatus(status: string) {
  return status !== "cancelled";
}

function isEspacoGirafinha(location: string | null) {
  if (!location) return false;
  const normalized = location
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  return normalized.includes("espaco girafinha") || normalized.includes("espaco") && normalized.includes("girafinha");
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

function venueCalendarItem(row: VenueEventRow): CalendarV2Item {
  const totalPrice = money(row.totalPrice);
  const amountPaid = money(row.amountPaid);

  return {
    id: row.id,
    type: "venue_event",
    title: row.birthdayChildName ? `${row.packName} - ${row.birthdayChildName}` : row.packName,
    date: row.eventDate,
    startTime: row.startTime,
    endTime: row.endTime,
    customerName: row.customerName,
    location: "Espaco Girafinha",
    servicesLabels: [row.packName],
    paymentStatus: row.paymentStatus,
    amountPaid,
    totalPrice,
    pendingAmount: Math.max(0, totalPrice - amountPaid),
    capacity: null,
    activeParticipantsCount: null,
    availableSeats: null,
    totalReceived: null,
    totalPending: null,
    occupiesSpace: true,
    status: row.status,
  };
}

function externalCalendarItem(row: ExternalEventRow, services: ExternalEventServiceRow[]): CalendarV2Item {
  const totalPrice = money(row.totalPrice);
  const amountPaid = money(row.amountPaid);

  return {
    id: row.id,
    type: "external_event",
    title: row.eventType || row.eventTheme || "Servico externo",
    date: row.eventDate,
    startTime: row.startTime,
    endTime: row.endTime,
    customerName: row.customerName,
    location: row.eventLocation,
    servicesLabels: services
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((service) => service.serviceLabel),
    paymentStatus: row.paymentStatus,
    amountPaid,
    totalPrice,
    pendingAmount: Math.max(0, totalPrice - amountPaid),
    capacity: null,
    activeParticipantsCount: null,
    availableSeats: null,
    totalReceived: null,
    totalPending: null,
    occupiesSpace: false,
    status: row.status,
  };
}

function workshopCalendarItem(row: WorkshopRow, participants: WorkshopParticipantRow[]): CalendarV2Item {
  const activeParticipants = participants.filter((participant) => ACTIVE_PARTICIPANT_STATUSES.has(participant.status));
  const totalReceived = activeParticipants.reduce((sum, participant) => sum + money(participant.amountPaid), 0);
  const totalPending = activeParticipants.reduce((sum, participant) => sum + money(participant.amountDue), 0);

  return {
    id: row.id,
    type: "workshop",
    title: row.name,
    date: row.date,
    startTime: row.startTime,
    endTime: row.endTime,
    customerName: null,
    location: row.location,
    servicesLabels: [],
    paymentStatus: null,
    amountPaid: null,
    totalPrice: null,
    pendingAmount: null,
    capacity: row.capacity,
    activeParticipantsCount: activeParticipants.length,
    availableSeats: Math.max(0, row.capacity - activeParticipants.length),
    totalReceived,
    totalPending,
    occupiesSpace: isEspacoGirafinha(row.location),
    status: row.status,
  };
}

function dayStatus(items: CalendarV2Item[]): CalendarV2DayStatus {
  const spaceSlotsUsed = items.filter((item) => item.occupiesSpace).length;
  const hasOperationalItems = items.some((item) => !item.occupiesSpace);

  if (spaceSlotsUsed >= SPACE_SLOTS_TOTAL) return "full";
  if (spaceSlotsUsed === 1 || hasOperationalItems) return "almost_full";
  if (items.length > 0) return "busy";
  return "free";
}

router.get("/calendar-v2", async (req, res): Promise<void> => {
  const defaults = defaultDateRange();
  const startDate = isValidDateParam(req.query.startDate) ? req.query.startDate : defaults.startDate;
  const endDate = isValidDateParam(req.query.endDate) ? req.query.endDate : defaults.endDate;

  if (startDate > endDate) {
    res.status(400).json({ error: "startDate must be before or equal to endDate" });
    return;
  }

  const [venueEvents, externalEvents, externalServices, workshops, workshopParticipants] = await Promise.all([
    db.select().from(venueEventsTable),
    db.select().from(externalEventsTable),
    db.select().from(externalEventServicesTable),
    db.select().from(workshopsTable),
    db.select().from(workshopParticipantsTable),
  ]);

  const servicesByEvent = servicesByExternalEventId(externalServices);
  const participantsByWorkshop = participantsByWorkshopId(workshopParticipants);

  const items = [
    ...venueEvents
      .filter((event) => isActiveStatus(event.status) && event.eventDate >= startDate && event.eventDate <= endDate)
      .map(venueCalendarItem),
    ...externalEvents
      .filter((event) => isActiveStatus(event.status) && event.eventDate >= startDate && event.eventDate <= endDate)
      .map((event) => externalCalendarItem(event, servicesByEvent.get(event.id) ?? [])),
    ...workshops
      .filter((workshop) => isActiveStatus(workshop.status) && workshop.date >= startDate && workshop.date <= endDate)
      .map((workshop) => workshopCalendarItem(workshop, participantsByWorkshop.get(workshop.id) ?? [])),
  ].sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));

  const days = datesBetween(startDate, endDate).map((date) => {
    const dayItems = items.filter((item) => item.date === date);
    const spaceSlotsUsed = dayItems.filter((item) => item.occupiesSpace).length;
    return {
      date,
      status: dayStatus(dayItems),
      spaceSlotsUsed,
      spaceSlotsTotal: SPACE_SLOTS_TOTAL,
      items: dayItems,
    };
  });

  res.json({
    summary: {
      startDate,
      endDate,
      totalItems: items.length,
      spaceOccupyingItems: items.filter((item) => item.occupiesSpace).length,
      externalItems: items.filter((item) => item.type === "external_event").length,
      workshops: items.filter((item) => item.type === "workshop").length,
      freeDays: days.filter((day) => day.status === "free").length,
      busyDays: days.filter((day) => day.status === "busy").length,
      almostFullDays: days.filter((day) => day.status === "almost_full").length,
      fullDays: days.filter((day) => day.status === "full").length,
    },
    days,
    items,
  });
});

export default router;
