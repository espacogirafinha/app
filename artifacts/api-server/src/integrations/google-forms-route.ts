import { Router, type IRouter } from "express";
import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import {
  db,
  eventExtrasTable,
  eventSelectedExtrasTable,
  googleFormImportsTable,
  venueEventsTable,
  venuePacksTable,
} from "@workspace/db";
import {
  FORM_ID,
  dedupKey,
  importSubmission,
  verifySignature,
  type Submission,
} from "./google-forms";

const router: IRouter = Router();
const ALLOWED_KEYS = new Set([
  "formId",
  "submissionId",
  "submittedAt",
  "fields",
]);
router.post(
  "/integrations/google-forms/venue-event",
  async (req, res): Promise<void> => {
    const secret = process.env.GOOGLE_FORMS_INTEGRATION_SECRET;
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    if (!secret) {
      res
        .status(503)
        .json({ status: "rejected", reason: "integration unavailable" });
      return;
    }
    if (
      !raw.length ||
      raw.length > 65536 ||
      !verifySignature(
        raw,
        req.get("x-girafinha-timestamp"),
        req.get("x-girafinha-signature"),
        secret,
      )
    ) {
      res
        .status(401)
        .json({ status: "rejected", reason: "authentication failed" });
      return;
    }
    let payload: Submission;
    try {
      const data: unknown = JSON.parse(raw.toString("utf8"));
      if (!data || typeof data !== "object" || Array.isArray(data))
        throw Error("payload");
      const o = data as Record<string, unknown>;
      if (
        Object.keys(o).some((k) => !ALLOWED_KEYS.has(k)) ||
        o.formId !== FORM_ID ||
        typeof o.submissionId !== "string" ||
        o.submissionId.length > 200 ||
        !o.submissionId ||
        typeof o.submittedAt !== "string" ||
        Number.isNaN(Date.parse(o.submittedAt)) ||
        !o.fields ||
        typeof o.fields !== "object" ||
        Array.isArray(o.fields)
      )
        throw Error("payload");
      payload = o as Submission;
    } catch {
      res.status(400).json({ status: "rejected", reason: "invalid payload" });
      return;
    }
    try {
      const result = await importSubmission(payload, {
        transact: (fn) =>
          db.transaction(async (tx) => {
            // Serializes imports of the same submission, including concurrent webhook retries.
            await tx.execute(
              sql`select pg_advisory_xact_lock(hashtextextended(${`${payload.formId}:${payload.submissionId}`}, 0))`,
            );
            // A second lock also serializes different submissions for the same party/date.
            const partyKey = dedupKey(payload);
            if (partyKey)
              await tx.execute(
                sql`select pg_advisory_xact_lock(hashtextextended(${partyKey}, 1))`,
              );
            return fn({
              findImport: async () => {
                const [previous] = await tx
                  .select({
                    status: googleFormImportsTable.status,
                    venueEventId: googleFormImportsTable.venueEventId,
                  })
                  .from(googleFormImportsTable)
                  .where(
                    and(
                      eq(googleFormImportsTable.formId, payload.formId),
                      eq(
                        googleFormImportsTable.submissionId,
                        payload.submissionId,
                      ),
                    ),
                  )
                  .limit(1);
                return previous ?? null;
              },
              findEvent: async (date, phone) => {
                const rows = await tx
                  .select({
                    id: venueEventsTable.id,
                    phone: venueEventsTable.phone,
                  })
                  .from(venueEventsTable)
                  .where(eq(venueEventsTable.eventDate, date));
                return (
                  rows.find(
                    (x) =>
                      x.phone.replace(/\D/g, "").replace(/^351/, "") === phone,
                  ) ?? null
                );
              },
              listExtras: async () =>
                tx
                  .select()
                  .from(eventExtrasTable)
                  .where(eq(eventExtrasTable.isActive, true)),
              listPacks: async () =>
                tx
                  .select()
                  .from(venuePacksTable)
                  .where(eq(venuePacksTable.isActive, true)),
              saveImport: async (
                _key,
                status,
                needsReview,
                reasons,
                eventId,
              ) => {
                await tx
                  .insert(googleFormImportsTable)
                  .values({
                    formId: payload.formId,
                    submissionId: payload.submissionId,
                    submittedAt: new Date(payload.submittedAt),
                    venueEventId: eventId ?? null,
                    status,
                    needsReview,
                    errorMessage: reasons.join("; ") || null,
                    payload,
                    payloadHash: createHash("sha256").update(raw).digest("hex"),
                  });
              },
              createEvent: async (event) => {
                const { extraText, totalPrice, amountPaid, ...rest } = event;
                void extraText;
                const [row] = await tx
                  .insert(venueEventsTable)
                  .values({
                    ...rest,
                    termsAccepted: rest.termsAccepted ?? false,
                    totalPrice: String(totalPrice),
                    amountPaid: String(amountPaid),
                  })
                  .returning({ id: venueEventsTable.id });
                return row.id;
              },
              createExtras: async (id, extras) => {
                if (extras.length)
                  await tx
                    .insert(eventSelectedExtrasTable)
                    .values(
                      extras.map((x) => ({
                        module: "venue_events",
                        entityId: id,
                        extraId: x.extraId,
                        extraName: x.extraName,
                        category: x.category,
                        unitPrice: String(x.unitPrice),
                        quantity: x.quantity,
                        totalPrice: String(x.totalPrice),
                      })),
                    );
              },
            });
          }),
      });
      res
        .status(
          result.status === "created"
            ? 201
            : result.status === "rejected"
              ? 400
              : 200,
        )
        .json(result);
    } catch {
      req.log?.error("google forms import failed");
      res.status(500).json({ status: "rejected", reason: "integration error" });
    }
  },
);
export default router;
