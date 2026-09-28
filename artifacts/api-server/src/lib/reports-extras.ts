export type ExtraReportEvent = {
  id: string;
  eventDate: string;
  status: string;
};

export type ExtraReportRow = {
  entityId: string;
  extraName: string;
  category: string | null;
  quantity: number;
  totalPrice: number;
  unitCost: number | null;
  totalCost: number | null;
};

export type ExtraBreakdown = {
  label: string;
  category: string | null;
  count: number;
  revenue: number;
  knownCost: number;
  knownMargin: number;
  unknownCostCount: number;
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
    };

    current.count += quantity;
    current.revenue = round(current.revenue + rowRevenue);
    current.knownCost = round(current.knownCost + rowKnownCost);
    current.knownMargin = round(current.knownMargin + rowKnownMargin);
    current.unknownCostCount += unknownUnits;
    if (!current.category && row.category) current.category = row.category;
    byName.set(row.extraName, current);
  }

  return {
    soldCount,
    revenue,
    knownCost,
    knownMargin,
    unknownCostCount,
    items: [...byName.values()].sort((a, b) => b.revenue - a.revenue || b.count - a.count || a.label.localeCompare(b.label)),
  };
}
