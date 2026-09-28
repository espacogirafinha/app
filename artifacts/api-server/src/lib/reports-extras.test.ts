import assert from "node:assert/strict";
import test from "node:test";
import { aggregateVenueExtrasReport, eligibleVenueEventIds } from "./reports-extras.ts";
import { aggregateFinancials } from "./reports-finance.ts";

const row = (name: string, quantity: number, unitPrice: number, unitCost: number | null, entityId = "event-1") => ({
  entityId,
  extraName: name,
  category: null,
  quantity,
  totalPrice: quantity * unitPrice,
  unitCost,
  totalCost: unitCost === null ? null : quantity * unitCost,
});

test("known margins are calculated per extra", () => {
  const report = aggregateVenueExtrasReport([
    row("Mascote", 1, 90, 75),
    row("Pinturas", 1, 100, 70),
    row("Bolo", 1, 55, 38),
  ]);
  assert.equal(report.revenue, 245);
  assert.equal(report.knownCost, 183);
  assert.equal(report.knownMargin, 62);
  assert.deepEqual(report.items.map((item) => [item.label, item.knownMargin]), [
    ["Pinturas", 30],
    ["Mascote", 15],
    ["Bolo", 17],
  ]);
});

test("quantity multiplies revenue cost and margin", () => {
  const report = aggregateVenueExtrasReport([row("Mascote", 2, 90, 75)]);
  assert.equal(report.soldCount, 2);
  assert.equal(report.revenue, 180);
  assert.equal(report.knownCost, 150);
  assert.equal(report.knownMargin, 30);
});

test("unknown cost never becomes zero margin", () => {
  const report = aggregateVenueExtrasReport([row("Bolo", 2, 55, null)]);
  assert.equal(report.revenue, 110);
  assert.equal(report.knownCost, 0);
  assert.equal(report.knownMargin, 0);
  assert.equal(report.unknownCostCount, 2);
  assert.equal(report.items[0].unknownCostCount, 2);
});

test("reports select extras by venue event date and exclude cancelled events", () => {
  const ids = eligibleVenueEventIds([
    { id: "inside", eventDate: "2026-09-15", status: "confirmed" },
    { id: "cancelled", eventDate: "2026-09-15", status: "cancelled" },
    { id: "outside", eventDate: "2026-10-01", status: "confirmed" },
  ], "2026-09-01", "2026-09-30");

  assert.deepEqual([...ids], ["inside"]);
});

test("several extras for one event do not duplicate the event itself", () => {
  const report = aggregateVenueExtrasReport([
    row("Mascote", 1, 90, 75),
    row("Pinturas", 1, 100, 70),
    row("Bolo", 1, 55, 38),
  ]);
  assert.equal(report.soldCount, 3);
  assert.equal(report.items.length, 3);
});


test("extras decomposition never adds revenue a second time", () => {
  const venueFinancials = aggregateFinancials([{ revenue: 540, received: 110 }]);
  const extras = aggregateVenueExtrasReport([
    row("Mascote", 1, 90, 75),
    row("Bolo", 1, 50, 38),
  ]);

  assert.equal(venueFinancials.revenue, 540);
  assert.equal(extras.revenue, 140);
  assert.equal(venueFinancials.revenue, 540, "extras stay a decomposition of the existing venue total");
});

test("same extra name is grouped without duplicating venue rows", () => {
  const report = aggregateVenueExtrasReport([
    row("Mascote", 1, 90, 75, "event-1"),
    row("Mascote", 2, 90, 75, "event-2"),
  ]);
  assert.equal(report.items.length, 1);
  assert.equal(report.items[0].count, 3);
  assert.equal(report.items[0].revenue, 270);
  assert.equal(report.items[0].knownCost, 225);
  assert.equal(report.items[0].knownMargin, 45);
});
