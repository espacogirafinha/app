import { normalizePortugueseWhatsAppPhone } from "./booking-confirmation-whatsapp.ts";

export type VenueForFollowUp = {
  id: string;
  customerName: string;
  birthdayChildName?: string | null;
  phone: string;
  eventDate: string;
  status: string;
};

export type FollowUpStage = "first" | "second";
export type ReturnOffer =
  | { type: "none"; description?: string }
  | { type: "fixed"; value: number; description?: string }
  | { type: "percent"; value: number; description?: string }
  | { type: "gift" | "custom"; description: string };

function dateParts(key: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) throw new Error("Invalid event date");
  return [Number(match[1]), Number(match[2]), Number(match[3])] as const;
}

function dateKey(year: number, month: number, day: number) {
  const target = new Date(Date.UTC(year, month - 1, 1, 12));
  const y = target.getUTCFullYear();
  const m = target.getUTCMonth();
  const lastDay = new Date(Date.UTC(y, m + 1, 0, 12)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(day, lastDay), 12)).toISOString().slice(0, 10);
}

export function addCalendarMonths(key: string, months: number) {
  const [year, month, day] = dateParts(key);
  return dateKey(year, month + months, day);
}

export function addCalendarDays(key: string, days: number) {
  const [year, month, day] = dateParts(key);
  const date = new Date(Date.UTC(year, month - 1, day + days, 12));
  return date.toISOString().slice(0, 10);
}

export function portugalToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function followUpDates(eventDate: string) {
  const nextPartyEstimate = addCalendarMonths(eventDate, 12);
  return {
    nextPartyEstimate,
    firstDue: addCalendarMonths(eventDate, 9),
    secondDue: addCalendarDays(nextPartyEstimate, -42),
  };
}

export function preparationIsDue(event: VenueForFollowUp, now = new Date()) {
  const today = portugalToday(now);
  return event.status !== "cancelled" &&
    event.eventDate >= today &&
    addCalendarDays(today, 30) >= event.eventDate;
}

function normalizeName(name: string | null | undefined) {
  return (name ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-PT").replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ").trim();
}

export function findNextBooking(source: VenueForFollowUp, bookings: VenueForFollowUp[]) {
  const phone = normalizePortugueseWhatsAppPhone(source.phone);
  const child = normalizeName(source.birthdayChildName);
  if (!phone || !child) return null;
  const followingYear = addCalendarMonths(source.eventDate, 12).slice(0, 4);
  return bookings.find((booking) =>
    booking.id !== source.id &&
    booking.status !== "cancelled" &&
    booking.eventDate.slice(0, 4) >= followingYear &&
    normalizePortugueseWhatsAppPhone(booking.phone) === phone &&
    normalizeName(booking.birthdayChildName) === child
  ) ?? null;
}

export function canContactStage(input: {
  source: VenueForFollowUp;
  allBookings: VenueForFollowUp[];
  stage: FollowUpStage;
  completedStages: FollowUpStage[];
  noInterest: boolean;
  now?: Date;
}) {
  const { source, allBookings, stage, completedStages, noInterest } = input;
  if (source.status !== "completed" || noInterest ||
      completedStages.includes(stage) || !normalizePortugueseWhatsAppPhone(source.phone) ||
      !normalizeName(source.birthdayChildName) || findNextBooking(source, allBookings)) return false;
  const dates = followUpDates(source.eventDate);
  return portugalToday(input.now) >= (stage === "first" ? dates.firstDue : dates.secondDue);
}

export function reactivationMessage(
  stage: FollowUpStage,
  client: string,
  child: string,
  offer: ReturnOffer = { type: "none" },
) {
  const parent = client.trim().split(/\s+/)[0] || client;
  const childName = child.trim().split(/\s+/)[0] || child;
  const previousPartyReference = childName ? `festa do/a ${childName}` : "vossa festa";
  const birthdayLead = childName ? `O aniversário do/a ${childName} está a aproximar-se` : "Está a aproximar-se mais um aniversário";
  if (stage === "first") {
    return `Olá, ${parent}! 💛 Já passou quase um ano desde a ${previousPartyReference} no Espaço Girafinha 🎉 Como o aniversário se está novamente a aproximar, quisemos avisar com antecedência caso queiram voltar a celebrar connosco. Se este ano preferirem fazer a festa noutro local, também temos serviços de decoração e animação 😊 Se quiserem, podemos já ver disponibilidade.`;
  }
  const offerText = offer.type === "none" ? "" :
    offer.type === "fixed" ? `${offer.value} € de desconto` :
    offer.type === "percent" ? `${offer.value}% de desconto` : offer.description.trim();
  return offerText
    ? `Olá, ${parent}! 💛 ${birthdayLead} 🎉 Como já celebraram connosco, temos também ${offerText} caso queiram voltar ao Espaço Girafinha ou contratar os nossos serviços para outro local 😊 Se quiserem, posso verificar disponibilidade.`
    : `Olá, ${parent}! 💛 O aniversário do/a ${childName} está a aproximar-se 🎉 Gostávamos muito de vos receber novamente no Espaço Girafinha! Se quiserem, posso verificar a disponibilidade 😊`;
}

export function reactivationWhatsAppUrl(phone: string, message: string) {
  const normalized = normalizePortugueseWhatsAppPhone(phone);
  return normalized ? `https://wa.me/${normalized}?text=${encodeURIComponent(message)}` : null;
}

export type ExternalForFollowUp = {
  id: string;
  customerName: string;
  phone: string;
  eventDate: string;
  eventType?: string | null;
  status: string;
};
export type FollowUpConversion = {
  kind: "venue_event" | "external_event";
  id: string;
};
export type ConversionResolution =
  | { status: "confirmed"; conversion: FollowUpConversion }
  | { status: "needs_review"; candidates: FollowUpConversion[] }
  | { status: "none" };

/**
 * An external event does not normally record the child's name. Identical phone
 * alone is never enough to auto-convert: surface a manual review candidate.
 */
export function resolveNewBooking(
  source: VenueForFollowUp,
  venues: VenueForFollowUp[],
  externals: ExternalForFollowUp[],
): ConversionResolution {
  const confirmedVenue = findNextBooking(source, venues);
  if (confirmedVenue) {
    return { status: "confirmed", conversion: { kind: "venue_event", id: confirmedVenue.id } };
  }
  const phone = normalizePortugueseWhatsAppPhone(source.phone);
  if (!phone) return { status: "none" };
  const nextCycle = addCalendarMonths(source.eventDate, 12);
  const start = addCalendarMonths(nextCycle, -3);
  const end = addCalendarMonths(nextCycle, 3);
  const candidates = externals.filter((event) =>
    event.status !== "cancelled" &&
    event.eventDate >= start && event.eventDate <= end &&
    normalizePortugueseWhatsAppPhone(event.phone) === phone
  ).map((event) => ({ kind: "external_event" as const, id: event.id }));
  return candidates.length ? { status: "needs_review", candidates } : { status: "none" };
}
