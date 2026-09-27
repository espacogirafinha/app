import { createHmac, timingSafeEqual } from "node:crypto";

export const FORM_ID = "19JReWvo-11bzk6X1iIARghDLEh0pLDaJHr2Bu8RmMFc";
type Fields = Record<string, unknown>;
export type Submission = {
  formId: string;
  submissionId: string;
  submittedAt: string;
  fields: Fields;
};
type Extra = {
  id: string;
  name: string;
  basePrice: string;
  isActive: boolean;
  appliesTo: string;
  category?: string | null;
};
type Pack = {
  id: string;
  name: string;
  basePrice: string;
  isActive: boolean;
};
const value = (v: unknown) =>
  typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
const field = (f: Fields, ...keys: string[]) =>
  keys.map((k) => value(f[k])).find(Boolean) ?? "";
export function normalizePhone(v: unknown): string | null {
  const d = value(v)
    .replace(/[\s().-]/g, "")
    .replace(/^\+351/, "");
  return /^9\d{8}$/.test(d) ? d : null;
}
export function parseMoney(v: unknown): number | null {
  const s = value(v).replace(/\s|€/g, "");
  if (!/^(?:\d{1,3}(?:\.\d{3})+|\d+)(?:[,.]\d{1,2})?$/.test(s)) return null;
  const n = Number(
    s.includes(",")
      ? s.replace(/\./g, "").replace(",", ".")
      : s.includes(".") && /\.\d{3}(?:\.|$)/.test(s)
        ? s.replace(/\./g, "")
        : s,
  );
  return Number.isFinite(n) && n >= 0 ? n : null;
}
export function parseTimeRange(
  v: unknown,
): { startTime: string; endTime: string } | null {
  const m =
    /^\s*(\d{1,2})(?::|h)(\d{2})?h?\s*(?:[-–]|às|as)\s*(\d{1,2})(?::|h)(\d{2})?h?\s*$/i.exec(
      value(v),
    );
  if (!m) return null;
  const [a, b, c, d] = [
    Number(m[1]),
    Number(m[2] ?? 0),
    Number(m[3]),
    Number(m[4] ?? 0),
  ];
  if (a > 23 || c > 23 || b > 59 || d > 59 || a * 60 + b >= c * 60 + d)
    return null;
  const time = (h: number, min: number) =>
    `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  return { startTime: time(a, b), endTime: time(c, d) };
}
export function normalizePack(
  v: unknown,
): "Essencial" | "Completo" | "Premium" | null {
  const match = value(v)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .match(/\b(essencial|completo|premium)\b/i);
  return match
    ? (
        {
          essencial: "Essencial",
          completo: "Completo",
          premium: "Premium",
        } as const
      )[match[1].toLowerCase() as "essencial" | "completo" | "premium"]
    : null;
}
export function normalizeImageAuthorization(v: unknown): string | null {
  const s = value(v)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (/nao autor|sem foto/.test(s)) return "nao_autorizo";
  if (/tapad/.test(s)) return "rosto_tapado";
  if (/visiv/.test(s)) return "rosto_visivel";
  return null;
}
export function parseAge(v: unknown): number | null {
  const s = value(v).toLowerCase();
  if (/^\d{1,2}$/.test(s)) return Number(s);
  const years = /^(\d{1,2})\s*anos?$/.exec(s);
  if (years) return Number(years[1]);
  const m = /^(\d+)\s*meses?$/.exec(s);
  if (m && Number(m[1]) % 12 === 0) return Number(m[1]) / 12;
  return null;
}
export function parseDate(v: unknown): string | null {
  const s = value(v);
  let iso: string;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    iso = s;
  } else {
    const ymdSlash = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(s);
    const dmySlash = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
    if (ymdSlash) {
      iso = `${ymdSlash[1]}-${ymdSlash[2]}-${ymdSlash[3]}`;
    } else if (dmySlash) {
      iso = `${dmySlash[3]}-${dmySlash[2]}-${dmySlash[1]}`;
    } else {
      return null;
    }
  }
  const d = new Date(`${iso}T12:00:00Z`);
  return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === iso
    ? iso
    : null;
}
export function parseTerms(v: unknown): boolean | null {
  const s = value(v).toLowerCase();
  if (/^(sim|aceito|concordo|true)$/i.test(s)) return true;
  if (/^(não|nao|false)$/i.test(s)) return false;
  return null;
}
export function normalizeSubmission(s: Submission) {
  const f = s.fields;
  return {
    customerName: field(f, "customerName"),
    phone: normalizePhone(f.phone),
    email: field(f, "email", "oldEmail") || null,
    nif: field(f, "nif") || null,
    eventDate: parseDate(f.eventDate),
    ...parseTimeRange(field(f, "time", "oldTime")),
    packName: normalizePack(f.pack),
    birthdayChildName: field(f, "birthdayChildName") || null,
    birthdayChildAge: parseAge(f.birthdayChildAge),
    partyTheme: field(f, "partyTheme") || null,
    decorationNotes: field(f, "decorationNotes") || null,
    cateringNotes: field(f, "cateringNotes") || null,
    allergies: field(f, "allergies") || null,
    imageAuthorization: normalizeImageAuthorization(f.imageAuthorization),
    termsAccepted: parseTerms(f.termsAccepted),
    amountPaid: parseMoney(f.deposit),
    paymentMethod: field(f, "paymentMethod") || null,
    source: field(f, "source") || "Google Forms",
    notes: field(f, "notes") || null,
    extraText: field(f, "extras"),
  };
}
export function dedupKey(s: Submission): string | null {
  const date = parseDate(s.fields.eventDate),
    phone = normalizePhone(s.fields.phone);
  return date && phone ? `${date}:${phone}` : null;
}
export function verifySignature(
  raw: Buffer,
  timestamp: unknown,
  signature: unknown,
  secret: unknown,
  nowMs = Date.now(),
  maxSkewSeconds = 300,
): boolean {
  if (
    typeof secret !== "string" ||
    !secret ||
    typeof timestamp !== "string" ||
    !/^\d{10}$/.test(timestamp) ||
    typeof signature !== "string" ||
    !/^[0-9a-f]{64}$/i.test(signature)
  )
    return false;
  const timestampMs = Number(timestamp) * 1000;
  if (
    !Number.isFinite(timestampMs) ||
    Math.abs(nowMs - timestampMs) > maxSkewSeconds * 1000
  )
    return false;
  const expected = createHmac("sha256", secret)
    .update(timestamp)
    .update(".")
    .update(raw)
    .digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
export function planImport(
  s: Submission,
  catalog: Extra[] = [],
  packs: Pack[] = [],
) {
  const n = normalizeSubmission(s);
  const reasons: string[] = [];
  if (
    s.formId !== FORM_ID ||
    !s.submissionId ||
    !/^\d{4}-\d\d-\d\dT/.test(s.submittedAt) ||
    !s.fields ||
    typeof s.fields !== "object"
  )
    return {
      status: "rejected" as const,
      reasons: ["invalid envelope"],
      event: null,
      extras: [],
    };
  if (
    !n.customerName ||
    !n.phone ||
    !n.eventDate ||
    !n.startTime ||
    !n.endTime ||
    !n.packName
  )
    return {
      status: "needs_review" as const,
      reasons: ["required event fields invalid"],
      event: null,
      extras: [],
    };
  const matchingPacks = packs.filter(
    (pack) => pack.isActive && normalizePack(pack.name) === n.packName,
  );
  const packBasePrice =
    matchingPacks.length === 1 ? parseMoney(matchingPacks[0].basePrice) : null;
  if (packBasePrice === null || packBasePrice <= 0)
    return {
      status: "needs_review" as const,
      reasons: ["pack price unavailable"],
      event: null,
      extras: [],
    };
  if (n.amountPaid === null) reasons.push("missing or invalid deposit");
  if (field(s.fields, "birthdayChildAge") && n.birthdayChildAge === null)
    reasons.push("ambiguous age");
  if (!n.imageAuthorization)
    reasons.push("missing or ambiguous image authorization");
  if (n.termsAccepted !== true) reasons.push("terms not accepted");
  if (
    n.cateringNotes &&
    !/^(lanche infantil inclu[ií]do|inclui lanche para as crian[cç]as|pack com catering|sem catering)$/i.test(
      n.cateringNotes,
    )
  )
    reasons.push("catering requires review");
  if (n.decorationNotes) reasons.push("decoration requires review");
  const requested = [
    field(s.fields, "requestedExtras"),
    field(s.fields, "requestedService"),
  ].filter(
    (x) =>
      x &&
      !/^n[aã]o pretendo adicionar nenhum serviço extra$/i.test(x) &&
      !/^n[aã]o$/i.test(x),
  );
  if (requested.length) reasons.push("requested extras require review");
  const extras: {
    extraId: string;
    extraName: string;
    category: string | null;
    unitPrice: number;
    quantity: number;
    totalPrice: number;
  }[] = [];
  if (n.extraText) {
    if (s.fields.extrasConfirmed !== true) {
      reasons.push("extra not confirmed");
    } else {
      const matches = catalog.filter(
        (x) =>
          x.isActive &&
          ["all", "venue_events"].includes(x.appliesTo) &&
          x.name.toLocaleLowerCase("pt-PT") ===
            n.extraText.toLocaleLowerCase("pt-PT"),
      );
      if (matches.length === 1) {
        const price = parseMoney(matches[0].basePrice);
        if (price !== null && price > 0)
          extras.push({
            extraId: matches[0].id,
            extraName: matches[0].name,
            category: matches[0].category ?? null,
            unitPrice: price,
            quantity: 1,
            totalPrice: price,
          });
        else reasons.push("extra price invalid");
      } else reasons.push("extra requires review");
    }
  }
  const paid = n.amountPaid ?? 0;
  const total =
    packBasePrice + extras.reduce((sum, x) => sum + x.totalPrice, 0);
  const event = {
    ...n,
    phone: n.phone,
    eventDate: n.eventDate,
    startTime: n.startTime,
    endTime: n.endTime,
    packName: n.packName,
    totalPrice: total,
    amountPaid: paid,
    paymentStatus: paid >= total ? "paid" : paid > 0 ? "partial" : "unpaid",
    status: "draft",
    notes:
      [
        n.notes,
        n.extraText ? `Extra confirmado: ${n.extraText}` : null,
        ...requested.map((x) => `Pedido de extra (por confirmar): ${x}`),
      ]
        .filter(Boolean)
        .join("\n") || null,
  };
  return {
    status: reasons.length ? ("needs_review" as const) : ("created" as const),
    reasons,
    event,
    extras,
  };
}
export type ImportResult = {
  status: "created" | "already_exists" | "needs_review" | "rejected";
  venueEventId?: string;
  reasons?: string[];
};
type Tx = {
  findImport: (
    id: string,
  ) => Promise<{ status: string; venueEventId?: string | null } | null>;
  findEvent: (date: string, phone: string) => Promise<{ id: string } | null>;
  listExtras: () => Promise<Extra[]>;
  listPacks: () => Promise<Pack[]>;
  saveImport: (
    id: string,
    status: string,
    needsReview: boolean,
    reasons: string[],
    eventId?: string,
  ) => Promise<void>;
  createEvent: (
    event: NonNullable<ReturnType<typeof planImport>["event"]>,
  ) => Promise<string>;
  createExtras: (
    id: string,
    extras: ReturnType<typeof planImport>["extras"],
  ) => Promise<void>;
};
export async function importSubmission(
  s: Submission,
  store: { transact: <T>(fn: (tx: Tx) => Promise<T>) => Promise<T> },
): Promise<ImportResult> {
  return store.transact(async (tx) => {
    const key = `${s.formId}:${s.submissionId}`;
    const previous = await tx.findImport(key);
    if (previous)
      return {
        status:
          previous.status === "needs_review"
            ? "needs_review"
            : "already_exists",
        venueEventId: previous.venueEventId ?? undefined,
      };
    const p = planImport(s, await tx.listExtras(), await tx.listPacks());
    if (p.status === "rejected")
      return { status: "rejected", reasons: p.reasons };
    const n = normalizeSubmission(s);
    if (n.eventDate && n.phone) {
      const existing = await tx.findEvent(n.eventDate, n.phone);
      if (existing) {
        await tx.saveImport(
          key,
          "already_exists",
          true,
          ["matching date and phone"],
          existing.id,
        );
        return { status: "already_exists", venueEventId: existing.id };
      }
    }
    if (!p.event) {
      await tx.saveImport(key, "needs_review", true, p.reasons);
      return { status: "needs_review", reasons: p.reasons };
    }
    const id = await tx.createEvent(p.event);
    await tx.createExtras(id, p.extras);
    if (p.status === "needs_review") {
      await tx.saveImport(key, "needs_review", true, p.reasons, id);
      return { status: "needs_review", venueEventId: id, reasons: p.reasons };
    }
    await tx.saveImport(key, "created", false, [], id);
    return { status: "created", venueEventId: id };
  });
}
