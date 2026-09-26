import { normalizePhone, parseDate } from "./google-forms.ts";

export function encodeReviewCursor(row: {
  submittedAt: Date;
  id: string;
}): string {
  return Buffer.from(
    JSON.stringify([row.submittedAt.toISOString(), row.id]),
  ).toString("base64url");
}
export function decodeReviewCursor(
  value: unknown,
): { submittedAt: Date; id: string } | null {
  if (
    typeof value !== "string" ||
    value.length > 200 ||
    !/^[\w-]+$/.test(value)
  )
    return null;
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    );
    if (
      !Array.isArray(parsed) ||
      parsed.length !== 2 ||
      typeof parsed[0] !== "string" ||
      typeof parsed[1] !== "string" ||
      !/^\d{4}-\d\d-\d\dT/.test(parsed[0]) ||
      !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(parsed[1])
    )
      return null;
    const submittedAt = new Date(parsed[0]);
    return Number.isNaN(submittedAt.valueOf())
      ? null
      : { submittedAt, id: parsed[1] };
  } catch {
    return null;
  }
}

type ReviewRow = {
  id: string;
  submittedAt: Date;
  status: string;
  errorMessage: string | null;
  venueEventId: string | null;
  payload?: unknown;
};

const DISPLAY_FIELDS = [
  "customerName",
  "phone",
  "email",
  "oldEmail",
  "nif",
  "eventDate",
  "time",
  "oldTime",
  "pack",
  "birthdayChildName",
  "birthdayChildAge",
  "partyTheme",
  "decorationNotes",
  "cateringNotes",
  "allergies",
  "imageAuthorization",
  "deposit",
  "paymentMethod",
  "requestedExtras",
  "requestedService",
  "notes",
  "termsAccepted",
  "source",
  "extras",
] as const;

function fieldsFrom(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object") return {};
  const fields = (payload as Record<string, unknown>).fields;
  return fields && typeof fields === "object" && !Array.isArray(fields)
    ? (fields as Record<string, unknown>)
    : {};
}

export function formatReviewImport(row: ReviewRow) {
  return {
    id: row.id,
    submittedAt: row.submittedAt.toISOString(),
    status: row.status,
    reasons: row.errorMessage ? row.errorMessage.split("; ") : [],
    venueEventId: row.venueEventId,
    fields: Object.fromEntries(
      DISPLAY_FIELDS.flatMap((key) => {
        const v = fieldsFrom(row.payload)[key];
        return typeof v === "string" && v.trim() ? [[key, v.trim()]] : [];
      }),
    ),
  };
}

export function reviewLinkMatches(
  payload: unknown,
  event: { eventDate: string; phone: string },
): boolean {
  const fields = fieldsFrom(payload);
  const date = parseDate(fields.eventDate),
    phone = normalizePhone(fields.phone);
  return Boolean(
    date &&
    phone &&
    date === event.eventDate &&
    phone === normalizePhone(event.phone),
  );
}

type Decision =
  | { action: "dismiss" }
  | { action: "confirm" }
  | { action: "link"; venueEventId: string };
type Import = {
  needsReview: boolean;
  status: string;
  venueEventId: string | null;
  payload: unknown;
};
type Event = { id: string; eventDate: string; phone: string };
type Patch = {
  status: "created" | "rejected" | "already_exists";
  needsReview: false;
  venueEventId: string | null;
};
type ReviewTx = {
  findImport: (id: string) => Promise<Import | null>;
  findEvent: (id: string) => Promise<Event | null>;
  save: (patch: Patch) => Promise<void>;
};
export async function resolveReview(
  id: string,
  decision: Decision,
  store: { transact: <T>(fn: (tx: ReviewTx) => Promise<T>) => Promise<T> },
): Promise<{
  status: "created" | "rejected" | "already_exists" | "conflict" | "mismatch";
  venueEventId?: string;
}> {
  return store.transact(async (tx) => {
    const previous = await tx.findImport(id);
    if (!previous?.needsReview) return { status: "conflict" };
    if (decision.action === "dismiss") {
      await tx.save({
        status: "rejected",
        needsReview: false,
        venueEventId: previous.venueEventId,
      });
      return { status: "rejected" };
    }
    if (decision.action === "confirm") {
      if (!previous.venueEventId) return { status: "conflict" };
      await tx.save({
        status: "created",
        needsReview: false,
        venueEventId: previous.venueEventId,
      });
      return { status: "created", venueEventId: previous.venueEventId };
    }
    const event = await tx.findEvent(decision.venueEventId);
    if (!event || !reviewLinkMatches(previous.payload, event))
      return { status: "mismatch" };
    await tx.save({
      status: "already_exists",
      needsReview: false,
      venueEventId: event.id,
    });
    return { status: "already_exists", venueEventId: event.id };
  });
}
