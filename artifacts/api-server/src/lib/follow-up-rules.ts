export type VenueRecord = {
  id: string;
  customerName: string;
  birthdayChildName?: string | null;
  phone: string;
  eventDate: string;
  status: string;
};
export type ExternalRecord = {
  id: string;
  customerName: string;
  phone: string;
  eventDate: string;
  eventType?: string | null;
  status: string;
};
export type Conversion = { kind: "venue_event" | "external_event"; id: string };
export type ConversionResult =
  | { status: "confirmed"; conversion: Conversion }
  | { status: "needs_review"; candidates: Conversion[] }
  | { status: "none" };

export function normalizePortuguesePhone(value: string): string | null {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  const national = digits.startsWith("351") ? digits.slice(3) : digits;
  return /^[29]\d{8}$/.test(national) ? "351" + national : null;
}
function normalizeChild(value: string | null | undefined): string {
  return (value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-PT").replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ").trim();
}
function parts(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error("Data inválida");
  return [Number(match[1]), Number(match[2]), Number(match[3])] as const;
}
export function addMonths(date: string, months: number): string {
  const [y,m,d] = parts(date);
  const target = new Date(Date.UTC(y,m-1+months,1,12));
  const year = target.getUTCFullYear(), month = target.getUTCMonth();
  const last = new Date(Date.UTC(year,month+1,0,12)).getUTCDate();
  return new Date(Date.UTC(year,month,Math.min(d,last),12)).toISOString().slice(0,10);
}
export function addDays(date: string, days: number): string {
  const [y,m,d] = parts(date);
  return new Date(Date.UTC(y,m-1,d+days,12)).toISOString().slice(0,10);
}
export function cycleDates(eventDate: string) {
  const estimate = addMonths(eventDate,12);
  return { nextPartyEstimate:estimate,firstDue:addMonths(eventDate,9),secondDue:addDays(estimate,-42) };
}
export function todayPortugal(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone:"Europe/Lisbon", year:"numeric", month:"2-digit", day:"2-digit",
  }).format(now);
}

/** Never auto-convert an external event without a reliably identified child. */
export function resolveConversion(source: VenueRecord, venues: VenueRecord[], externals: ExternalRecord[]): ConversionResult {
  const phone = normalizePortuguesePhone(source.phone);
  const child = normalizeChild(source.birthdayChildName);
  if (!phone || !child) return { status:"none" };
  const estimate = addMonths(source.eventDate,12);
  const start = addMonths(estimate,-3);
  const end = addMonths(estimate,3);
  const matchesVenue = venues.filter(v =>
    v.id!==source.id && v.status!=="cancelled" &&
    v.eventDate>=start && v.eventDate<=end &&
    normalizePortuguesePhone(v.phone)===phone &&
    normalizeChild(v.birthdayChildName)===child
  );
  if (matchesVenue.length===1) return {status:"confirmed",conversion:{kind:"venue_event",id:matchesVenue[0]!.id}};
  if (matchesVenue.length>1) return {
    status:"needs_review",
    candidates: matchesVenue.map(v=>({kind:"venue_event" as const,id:v.id})),
  };
  const possibleExternals = externals.filter(e =>
    e.status!=="cancelled" && e.eventDate>=start && e.eventDate<=end &&
    normalizePortuguesePhone(e.phone)===phone
  );
  return possibleExternals.length
    ? {status:"needs_review",candidates:possibleExternals.map(e=>({kind:"external_event" as const,id:e.id}))}
    : {status:"none"};
}
