import assert from "node:assert/strict";
import test from "node:test";
import {
  canContactStage, findNextBooking, followUpDates, preparationIsDue,
  reactivationMessage, reactivationWhatsAppUrl,
  type VenueForFollowUp,
} from "./venue-follow-up.ts";

const previous: VenueForFollowUp = {
  id: "previous", customerName: "Ana Silva", birthdayChildName: "Matilde Silva",
  phone: "912 345 678", eventDate: "2026-01-20", status: "completed",
};

test("annual cycle uses 3 months and 42 days ahead", () => {
  assert.deepEqual(followUpDates("2026-01-20"), {
    nextPartyEstimate: "2027-01-20", firstDue: "2026-10-20", secondDue: "2026-12-09",
  });
});

test("D-30 preparation is due, cancelled party is excluded", () => {
  const party = { ...previous, eventDate: "2026-11-19", status: "confirmed" };
  assert.equal(preparationIsDue(party, new Date("2026-10-20T12:00:00Z")), true);
  assert.equal(preparationIsDue({ ...party, status: "cancelled" }, new Date("2026-10-20T12:00:00Z")), false);
  assert.equal(preparationIsDue({ ...party, eventDate: "2026-11-21" }, new Date("2026-10-20T12:00:00Z")), false);
});

test("first stage available at due date, second unavailable until later", () => {
  assert.equal(canContactStage({ source: previous, allBookings: [previous], stage: "first", completedStages: [], noInterest: false, now: new Date("2026-10-20T12:00:00Z") }), true);
  assert.equal(canContactStage({ source: previous, allBookings: [previous], stage: "second", completedStages: [], noInterest: false, now: new Date("2026-10-20T12:00:00Z") }), false);
});

test("contacted, declined and cancelled records are blocked", () => {
  const args = { source: previous, allBookings: [previous], stage: "second" as const, now: new Date("2026-12-10T12:00:00Z") };
  assert.equal(canContactStage({ ...args, completedStages: ["second"], noInterest: false }), false);
  assert.equal(canContactStage({ ...args, completedStages: [], noInterest: true }), false);
  assert.equal(canContactStage({ ...args, source: { ...previous, status: "cancelled" }, completedStages: [], noInterest: false }), false);
});

test("new booking for same phone and child blocks reactivation", () => {
  const next = { ...previous, id: "next", eventDate: "2027-01-15", status: "confirmed", birthdayChildName: "Matilde Silva", phone: "+351912345678" };
  assert.equal(findNextBooking(previous, [previous, next])?.id, "next");
  assert.equal(canContactStage({ source: previous, allBookings: [previous, next], stage: "second", completedStages: [], noInterest: false, now: new Date("2026-12-10T12:00:00Z") }), false);
});

test("different child does not block another child's birthday", () => {
  assert.equal(findNextBooking(previous, [previous, { ...previous, id: "next", eventDate: "2027-01-15", birthdayChildName: "Tomás" }]), null);
});

test("return gift is only mentioned in second message", () => {
  const offer = { type: "gift" as const, description: "um pequeno mimo na festa" };
  assert.equal(reactivationMessage("first", "Ana Silva", "Matilde Silva", offer).includes("mimo"), false);
  assert.equal(reactivationMessage("second", "Ana Silva", "Matilde Silva", offer).includes("mimo"), true);
  assert.ok(reactivationWhatsAppUrl(previous.phone, "Olá! 💛")?.includes("wa.me/351912345678"));
});
