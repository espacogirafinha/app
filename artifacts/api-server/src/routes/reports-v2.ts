import { Router, type IRouter } from "express";
import {
  db,
  externalEventsTable,
  externalEventServicesTable,
  venueEventsTable,
  workshopParticipantsTable,
  workshopsTable,
} from "@workspace/db";
import { aggregateFinancials, combineFinancialTotals, type FinancialLine } from "../lib/reports-finance";

const router: IRouter = Router();
const ACTIVE_PARTICIPANT_STATUSES = new Set(["registered", "confirmed", "attended"]);

type VenueEventRow = typeof venueEventsTable.$inferSelect;
type ExternalEventRow = typeof externalEventsTable.$inferSelect;
type ExternalEventServiceRow = typeof externalEventServicesTable.$inferSelect;
type WorkshopRow = typeof workshopsTable.$inferSelect;
type WorkshopParticipantRow = typeof workshopParticipantsTable.$inferSelect;

type RevenueStat = {
  label: string;
  count: number;
  revenue: number;
  percentage: number;
};

function money(value: unknown) {
  return Number.parseFloat(String(value ?? 0));
}

function roundNumber(value: number) {
  return Math.round(value * 100) / 100;
}

function todayParts() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function defaultDateRange() {
  const { year, month } = todayParts();
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { startDate, endDate };
}

function isValidDateParam(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isActiveStatus(status: string) {
  return status !== "cancelled";
}

function isActiveParticipant(participant: WorkshopParticipantRow) {
  return ACTIVE_PARTICIPANT_STATUSES.has(participant.status);
}

function percentage(count: number, total: number) {
  return total > 0 ? roundNumber((count / total) * 100) : 0;
}

function areaSummary(count: number, finances: ReturnType<typeof aggregateFinancials>) {
  return {
    eventCount: count,
    ...finances,
    averageTicket: count > 0 ? roundNumber(finances.revenue / count) : 0,
  };
}

function statFromMap(map: Map<string, { count: number; revenue: number }>, totalCount: number): RevenueStat[] {
  return [...map.entries()]
    .map(([label, value]) => ({
      label,
      count: value.count,
      revenue: roundNumber(value.revenue),
      percentage: percentage(value.count, totalCount),
    }))
    .sort((a, b) => b.count - a.count || b.revenue - a.revenue || a.label.localeCompare(b.label));
}

function addStat(map: Map<string, { count: number; revenue: number }>, label: string, revenue: number) {
  const current = map.get(label) ?? { count: 0, revenue: 0 };
  map.set(label, { count: current.count + 1, revenue: current.revenue + revenue });
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

function venueReport(venueEvents: VenueEventRow[]) {
  const packStats = new Map<string, { count: number; revenue: number }>();
  const sourceStats = new Map<string, { count: number; revenue: number }>();
  const financialLines: FinancialLine[] = [];
  let childrenTotal = 0;

  for (const event of venueEvents) {
    const total = money(event.totalPrice);
    financialLines.push({ revenue: total, received: money(event.amountPaid) });
    childrenTotal += event.childrenCount ?? 0;
    addStat(packStats, event.packName || "Sem pack", total);
    if (event.source) addStat(sourceStats, event.source, total);
  }

  return {
    partyCount: venueEvents.length,
    ...aggregateFinancials(financialLines),
    topPacks: statFromMap(packStats, venueEvents.length),
    revenueByPack: statFromMap(packStats, venueEvents.length),
    averageChildren: venueEvents.length > 0 ? roundNumber(childrenTotal / venueEvents.length) : 0,
    sources: statFromMap(sourceStats, venueEvents.length),
  };
}

function externalReport(externalEvents: ExternalEventRow[], externalServices: ExternalEventServiceRow[]) {
  const servicesByEvent = servicesByExternalEventId(externalServices);
  const serviceStats = new Map<string, { count: number; revenue: number }>();
  const combinationStats = new Map<string, { count: number; revenue: number }>();
  const financialLines: FinancialLine[] = [];

  for (const event of externalEvents) {
    const total = money(event.totalPrice);
    financialLines.push({ revenue: total, received: money(event.amountPaid) });

    const services = (servicesByEvent.get(event.id) ?? []).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    for (const service of services) addStat(serviceStats, service.serviceLabel || service.serviceType, money(service.price));
    const combination = services.length > 0
      ? services.map((service) => service.serviceLabel || service.serviceType).join(" + ")
      : "Sem serviços";
    addStat(combinationStats, combination, total);
  }

  const finances = aggregateFinancials(financialLines);
  return {
    eventCount: externalEvents.length,
    ...finances,
    topServices: statFromMap(serviceStats, externalServices.length),
    revenueByServiceType: statFromMap(serviceStats, externalServices.length),
    serviceCombinations: statFromMap(combinationStats, externalEvents.length),
    averageTicket: externalEvents.length > 0 ? roundNumber(finances.revenue / externalEvents.length) : 0,
  };
}

function workshopsReport(workshops: WorkshopRow[], participants: WorkshopParticipantRow[]) {
  const participantsByWorkshop = participantsByWorkshopId(participants);
  const paymentStatusCounts = { paid: 0, partial: 0, unpaid: 0 };
  const financialLines: FinancialLine[] = [];
  let activeRegistrations = 0;
  let totalCapacity = 0;

  for (const workshop of workshops) {
    const activeParticipants = (participantsByWorkshop.get(workshop.id) ?? []).filter(isActiveParticipant);
    activeRegistrations += activeParticipants.length;
    totalCapacity += workshop.capacity;

    for (const participant of activeParticipants) {
      financialLines.push({ revenue: money(workshop.price), received: money(participant.amountPaid) });
      if (participant.paymentStatus === "paid") paymentStatusCounts.paid += 1;
      if (participant.paymentStatus === "partial") paymentStatusCounts.partial += 1;
      if (participant.paymentStatus === "unpaid") paymentStatusCounts.unpaid += 1;
    }
  }

  return {
    workshopCount: workshops.length,
    activeRegistrations,
    occupiedSeats: activeRegistrations,
    freeSeats: Math.max(0, totalCapacity - activeRegistrations),
    occupancyRate: totalCapacity > 0 ? roundNumber((activeRegistrations / totalCapacity) * 100) : 0,
    ...aggregateFinancials(financialLines),
    participantsByPaymentStatus: paymentStatusCounts,
  };
}

router.get("/reports-v2", async (req, res): Promise<void> => {
  const defaults = defaultDateRange();
  const startDate = isValidDateParam(req.query.startDate) ? req.query.startDate : defaults.startDate;
  const endDate = isValidDateParam(req.query.endDate) ? req.query.endDate : defaults.endDate;

  if (startDate > endDate) {
    res.status(400).json({ error: "startDate must be before or equal to endDate" });
    return;
  }

  const [venueEventsRows, externalEventsRows, externalServicesRows, workshopsRows, workshopParticipantsRows] = await Promise.all([
    db.select().from(venueEventsTable),
    db.select().from(externalEventsTable),
    db.select().from(externalEventServicesTable),
    db.select().from(workshopsTable),
    db.select().from(workshopParticipantsTable),
  ]);

  const venueEvents = venueEventsRows.filter(
    (event) => isActiveStatus(event.status) && event.eventDate >= startDate && event.eventDate <= endDate,
  );
  const externalEvents = externalEventsRows.filter(
    (event) => isActiveStatus(event.status) && event.eventDate >= startDate && event.eventDate <= endDate,
  );
  const activeExternalEventIds = new Set(externalEvents.map((event) => event.id));
  const externalServices = externalServicesRows.filter((service) => activeExternalEventIds.has(service.externalEventId));
  const workshopRowsInRange = workshopsRows.filter(
    (workshop) => isActiveStatus(workshop.status) && workshop.date >= startDate && workshop.date <= endDate,
  );
  const activeWorkshopIds = new Set(workshopRowsInRange.map((workshop) => workshop.id));
  const workshopParticipants = workshopParticipantsRows.filter(
    (participant) => activeWorkshopIds.has(participant.workshopId) && isActiveParticipant(participant),
  );

  const venue = venueReport(venueEvents);
  const external = externalReport(externalEvents, externalServices);
  const workshops = workshopsReport(workshopRowsInRange, workshopParticipants);
  const venueArea = areaSummary(venue.partyCount, venue);
  const externalArea = areaSummary(external.eventCount, external);
  const workshopArea = areaSummary(workshops.workshopCount, workshops);
  const totals = combineFinancialTotals([venueArea, externalArea, workshopArea]);
  const eventCount = venueArea.eventCount + externalArea.eventCount + workshopArea.eventCount;

  res.json({
    summary: {
      startDate,
      endDate,
      totalRevenue: totals.revenue,
      totalReceived: totals.received,
      totalPending: totals.pending,
      totalOverpaid: totals.overpaid,
      eventCount,
      averageTicket: eventCount > 0 ? roundNumber(totals.revenue / eventCount) : 0,
    },
    areas: { venueEvents: venueArea, externalEvents: externalArea, workshops: workshopArea },
    venueEvents: venue,
    externalEvents: external,
    workshops,
  });
});

export default router;
