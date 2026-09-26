import { Router, type IRouter } from "express";
import { and, desc, eq, lt, or } from "drizzle-orm";
import { db, googleFormImportsTable, venueEventsTable } from "@workspace/db";
import {
  decodeReviewCursor,
  encodeReviewCursor,
  formatReviewImport,
  resolveReview,
} from "../integrations/google-forms-review";

const router: IRouter = Router();

// Mounted behind the application's ordinary bearer authentication.
router.get(
  "/integrations/google-forms/review",
  async (req, res): Promise<void> => {
    const cursor =
      req.query.cursor === undefined
        ? undefined
        : decodeReviewCursor(req.query.cursor);
    if (req.query.cursor !== undefined && !cursor) {
      res.status(400).json({ error: "Página inválida" });
      return;
    }
    try {
      const rows = await db
        .select({
          id: googleFormImportsTable.id,
          submittedAt: googleFormImportsTable.submittedAt,
          status: googleFormImportsTable.status,
          errorMessage: googleFormImportsTable.errorMessage,
          venueEventId: googleFormImportsTable.venueEventId,
          payload: googleFormImportsTable.payload,
        })
        .from(googleFormImportsTable)
        .where(
          and(
            eq(googleFormImportsTable.needsReview, true),
            cursor
              ? or(
                  lt(googleFormImportsTable.submittedAt, cursor.submittedAt),
                  and(
                    eq(googleFormImportsTable.submittedAt, cursor.submittedAt),
                    lt(googleFormImportsTable.id, cursor.id),
                  ),
                )
              : undefined,
          ),
        )
        .orderBy(
          desc(googleFormImportsTable.submittedAt),
          desc(googleFormImportsTable.id),
        )
        .limit(101);
      const page = rows.slice(0, 100);
      res.json({
        items: page.map(formatReviewImport),
        nextCursor:
          rows.length > 100 ? encodeReviewCursor(page[page.length - 1]) : null,
      });
    } catch {
      res.status(500).json({ error: "Unable to list imports for review" });
    }
  },
);

router.post(
  "/integrations/google-forms/review/:id/resolve",
  async (req, res): Promise<void> => {
    const id = req.params.id;
    const body = req.body as unknown;
    const uuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (
      typeof id !== "string" ||
      !uuid.test(id) ||
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      res.status(400).json({ error: "Pedido inválido" });
      return;
    }
    const input = body as Record<string, unknown>;
    if (
      !(
        ((input.action === "dismiss" || input.action === "confirm") &&
          Object.keys(input).length === 1) ||
        (input.action === "link" &&
          Object.keys(input).length === 2 &&
          typeof input.venueEventId === "string" &&
          uuid.test(input.venueEventId))
      )
    ) {
      res.status(400).json({ error: "Decisão inválida" });
      return;
    }
    const decision =
      input.action === "dismiss"
        ? { action: "dismiss" as const }
        : input.action === "confirm"
          ? { action: "confirm" as const }
          : {
              action: "link" as const,
              venueEventId: input.venueEventId as string,
            };
    try {
      const result = await resolveReview(id, decision, {
        transact: (fn) =>
          db.transaction(async (tx) =>
            fn({
              findImport: async (importId) => {
                const [row] = await tx
                  .select({
                    needsReview: googleFormImportsTable.needsReview,
                    status: googleFormImportsTable.status,
                    venueEventId: googleFormImportsTable.venueEventId,
                    payload: googleFormImportsTable.payload,
                  })
                  .from(googleFormImportsTable)
                  .where(eq(googleFormImportsTable.id, importId))
                  .for("update");
                return row ?? null;
              },
              findEvent: async (eventId) => {
                const [row] = await tx
                  .select({
                    id: venueEventsTable.id,
                    eventDate: venueEventsTable.eventDate,
                    phone: venueEventsTable.phone,
                  })
                  .from(venueEventsTable)
                  .where(eq(venueEventsTable.id, eventId))
                  .limit(1);
                return row ?? null;
              },
              save: async (patch) => {
                await tx
                  .update(googleFormImportsTable)
                  .set({ ...patch, updatedAt: new Date() })
                  .where(
                    and(
                      eq(googleFormImportsTable.id, id),
                      eq(googleFormImportsTable.needsReview, true),
                    ),
                  );
              },
            }),
          ),
      });
      res
        .status(
          result.status === "conflict"
            ? 409
            : result.status === "mismatch"
              ? 422
              : 200,
        )
        .json(result);
    } catch {
      res.status(500).json({ error: "Não foi possível resolver o pedido" });
    }
  },
);

export default router;
