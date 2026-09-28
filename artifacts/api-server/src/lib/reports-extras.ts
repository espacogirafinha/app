export type ExtraReportEvent = {
  id: string;
  eventDate: string;
  status: string;
};

export type ExtraReportRow = {
  id: string;
  entityId: string;
  eventDate: string;
  customerName: string;
  birthdayChildName: string | null;
  extraName: string;
  category: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  unitCost: number | null;
  totalCost: number | null;
};

export type ExtraOccurrence = {
  id: string;
  entityId: string;
  eventDate: string;
  customerName: string;
  birthdayChildName: string | null;
  extraName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  unitCost: number | null;
  totalCost: number | null;
  margin: number | null;
};

export type ExtraBreakdown = {
  label: string;
  category: string | null;
  count: number;
  revenue: number;
  knownCost: number;
  knownMargin: number;
  unknownCostCount: number;
  occurrences: ExtraOccurrence[];
};

const round = (value: number) => Math.round(value * 100) / 100;

export function eligibleVenueEventIds(
  events: ExtraReportEvent[],
  startDate: string,
  endDate: string,
) {
  return new Set(
    events
      .filter((event) => event.status !== "cancelled" && event.eventDate >= startDate && event.eventDate <= endDate)
      .map((event) => event.id),
  );
}

export function aggregateVenueExtrasReport(rows: ExtraReportRow[]) {
  const byName = new Map<string, ExtraBreakdown>();
  let soldCount = 0;
  let revenue = 0;
  let knownCost = 0;
  let knownMargin = 0;
  let unknownCostCount = 0;

  for (const row of rows) {
    const quantity = Math.max(0, row.quantity || 0);
    const rowRevenue = round(Math.max(0, row.totalPrice || 0));
    const hasKnownCost = row.unitCost !== null && row.totalCost !== null;
    const rowKnownCost = hasKnownCost ? round(Math.max(0, row.totalCost ?? 0)) : 0;
    const rowKnownMargin = hasKnownCost ? round(rowRevenue - rowKnownCost) : 0;
    const unknownUnits = hasKnownCost ? 0 : quantity;
    const occurrence: ExtraOccurrence = {
      id: row.id,
      entityId: row.entityId,
      eventDate: row.eventDate,
      customerName: row.customerName,
      birthdayChildName: row.birthdayChildName,
      extraName: row.extraName,
      quantity,
      unitPrice: round(Math.max(0, row.unitPrice || 0)),
      totalPrice: rowRevenue,
      unitCost: row.unitCost,
      totalCost: hasKnownCost ? rowKnownCost : null,
      margin: hasKnownCost ? rowKnownMargin : null,
    };

    soldCount += quantity;
    revenue = round(revenue + rowRevenue);
    knownCost = round(knownCost + rowKnownCost);
    knownMargin = round(knownMargin + rowKnownMargin);
    unknownCostCount += unknownUnits;

    const current = byName.get(row.extraName) ?? {
      label: row.extraName,
      category: row.category,
      count: 0,
      revenue: 0,
      knownCost: 0,
      knownMargin: 0,
      unknownCostCount: 0,
      occurrences: [],
    };

    current.count += quantity;
    current.revenue = round(current.revenue + rowRevenue);
    current.knownCost = round(current.knownCost + rowKnownCost);
    current.knownMargin = round(current.knownMargin + rowKnownMargin);
    current.unknownCostCount += unknownUnits;
    current.occurrences.push(occurrence);
    if (!current.category && row.category) current.category = row.category;
    byName.set(row.extraName, current);
  }

  const items = [...byName.values()]
    .map((item) => ({
      ...item,
      occurrences: item.occurrences.sort((a, b) => {
        const aUnknown = a.unitCost === null ? 0 : 1;
        const bUnknown = b.unitCost === null ? 0 : 1;
        return aUnknown - bUnknown || b.eventDate.localeCompare(a.eventDate) || a.customerName.localeCompare(b.customerName);
      }),
    }))
    .sort((a, b) => b.revenue - a.revenue || b.count - a.count || a.label.localeCompare(b.label));

  return {
    soldCount,
    revenue,
    knownCost,
    knownMargin,
    unknownCostCount,
    items,
  };
}
