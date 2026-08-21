import { Router, type IRouter } from "express";
import { and, asc, count, eq } from "drizzle-orm";
import {
  db,
  eventAttachmentsTable,
  externalEventsTable,
  venueEventsTable,
} from "@workspace/db";
import {
  CreateEventAttachmentBody,
  DeleteEventAttachmentParams,
  ListEventAttachmentsQueryParams,
} from "@workspace/api-zod";
import {
  EVENT_ATTACHMENT_LIMIT,
  isImageMimeType,
  isValidEventAttachmentPath,
} from "../lib/attachment-validation";

const router: IRouter = Router();

type AttachmentRow = typeof eventAttachmentsTable.$inferSelect;

function formatAttachment(row: AttachmentRow) {
  return {
    id: row.id,
    entityType: row.entityType as "venue_event" | "external_event",
    entityId: row.entityId,
    storagePath: row.storagePath,
    originalFilename: row.originalFilename,
    mimeType: row.mimeType,
    caption: row.caption,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
  };
}

async function eventExists(
  entityType: "venue_event" | "external_event",
  entityId: string,
) {
  const table =
    entityType === "venue_event" ? venueEventsTable : externalEventsTable;
  const rows = await db
    .select({ id: table.id })
    .from(table)
    .where(eq(table.id, entityId))
    .limit(1);
  return rows.length > 0;
}

router.get("/event-attachments", async (req, res): Promise<void> => {
  const parsed = ListEventAttachmentsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const rows = await db
    .select()
    .from(eventAttachmentsTable)
    .where(
      and(
        eq(eventAttachmentsTable.entityType, parsed.data.entityType),
        eq(eventAttachmentsTable.entityId, parsed.data.entityId),
      ),
    )
    .orderBy(
      asc(eventAttachmentsTable.sortOrder),
      asc(eventAttachmentsTable.createdAt),
    );

  res.json(rows.map(formatAttachment));
});

router.post("/event-attachments", async (req, res): Promise<void> => {
  const parsed = CreateEventAttachmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const body = parsed.data;
  if (
    !isImageMimeType(body.mimeType) ||
    !isValidEventAttachmentPath(
      body.entityType,
      body.entityId,
      body.storagePath,
    )
  ) {
    res.status(400).json({ error: "Invalid event attachment metadata" });
    return;
  }

  if (!(await eventExists(body.entityType, body.entityId))) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const [{ value: existingCount }] = await db
    .select({ value: count() })
    .from(eventAttachmentsTable)
    .where(
      and(
        eq(eventAttachmentsTable.entityType, body.entityType),
        eq(eventAttachmentsTable.entityId, body.entityId),
      ),
    );

  if (existingCount >= EVENT_ATTACHMENT_LIMIT) {
    res
      .status(409)
      .json({ error: `Maximum of ${EVENT_ATTACHMENT_LIMIT} images reached` });
    return;
  }

  try {
    const [created] = await db
      .insert(eventAttachmentsTable)
      .values({
        entityType: body.entityType,
        entityId: body.entityId,
        storagePath: body.storagePath,
        originalFilename: body.originalFilename,
        mimeType: body.mimeType,
        caption: body.caption ?? null,
        sortOrder: body.sortOrder ?? existingCount,
      })
      .returning();

    res.status(201).json(formatAttachment(created));
  } catch {
    res.status(409).json({ error: "Attachment metadata already exists" });
  }
});

router.delete("/event-attachments/:id", async (req, res): Promise<void> => {
  const parsed = DeleteEventAttachmentParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [deleted] = await db
    .delete(eventAttachmentsTable)
    .where(eq(eventAttachmentsTable.id, parsed.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Attachment not found" });
    return;
  }

  res.json(formatAttachment(deleted));
});

export default router;
