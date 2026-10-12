import { and, count, desc, eq, isNull, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  db,
  notificationReadsTable,
  notificationsTable,
  pushSubscriptionsTable,
} from "@workspace/db";

const router: IRouter = Router();
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.get("/notifications", async (_req, res): Promise<void> => {
  const userId = String(res.locals.userId ?? "");
  const items = await db
    .select({
      id: notificationsTable.id,
      type: notificationsTable.type,
      title: notificationsTable.title,
      message: notificationsTable.message,
      googleFormImportId: notificationsTable.googleFormImportId,
      venueEventId: notificationsTable.venueEventId,
      destination: notificationsTable.destination,
      createdAt: notificationsTable.createdAt,
      readAt: notificationReadsTable.readAt,
    })
    .from(notificationsTable)
    .leftJoin(
      notificationReadsTable,
      and(
        eq(notificationReadsTable.notificationId, notificationsTable.id),
        eq(notificationReadsTable.userId, userId),
      ),
    )
    .orderBy(desc(notificationsTable.createdAt))
    .limit(50);

  const [unread] = await db
    .select({ value: count() })
    .from(notificationsTable)
    .leftJoin(
      notificationReadsTable,
      and(
        eq(notificationReadsTable.notificationId, notificationsTable.id),
        eq(notificationReadsTable.userId, userId),
      ),
    )
    .where(isNull(notificationReadsTable.notificationId));

  res.json({
    items: items.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      readAt: item.readAt?.toISOString() ?? null,
    })),
    unreadCount: Number(unread?.value ?? 0),
  });
});

router.post("/notifications/:id/read", async (req, res): Promise<void> => {
  const userId = String(res.locals.userId ?? "");
  const id = req.params.id;
  if (typeof id !== "string" || !uuid.test(id)) {
    res.status(400).json({ error: "Notificação inválida" });
    return;
  }

  const [notification] = await db
    .select({ id: notificationsTable.id })
    .from(notificationsTable)
    .where(eq(notificationsTable.id, id))
    .limit(1);
  if (!notification) {
    res.status(404).json({ error: "Notificação não encontrada" });
    return;
  }

  await db
    .insert(notificationReadsTable)
    .values({ notificationId: id, userId })
    .onConflictDoNothing();
  res.sendStatus(204);
});

router.post("/notifications/read-all", async (_req, res): Promise<void> => {
  const userId = String(res.locals.userId ?? "");
  await db.execute(sql`
    insert into app_private.notification_reads (notification_id, user_id)
    select id, ${userId}::uuid
    from app_private.notifications
    on conflict (notification_id, user_id) do nothing
  `);
  res.sendStatus(204);
});

router.get("/notifications/push-config", async (_req, res): Promise<void> => {
  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY ?? "";
  res.json({ configured: Boolean(publicKey), publicKey });
});

router.post(
  "/notifications/push-subscriptions",
  async (req, res): Promise<void> => {
    const userId = String(res.locals.userId ?? "");
    const body = req.body as unknown;
    if (!isPushSubscriptionBody(body)) {
      res.status(400).json({ error: "Subscrição inválida" });
      return;
    }

    await db
      .insert(pushSubscriptionsTable)
      .values({
        userId,
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
      })
      .onConflictDoUpdate({
        target: pushSubscriptionsTable.endpoint,
        set: {
          userId,
          p256dh: body.keys.p256dh,
          auth: body.keys.auth,
          updatedAt: new Date(),
        },
      });
    res.status(201).json({ ok: true });
  },
);

router.delete(
  "/notifications/push-subscriptions",
  async (req, res): Promise<void> => {
    const userId = String(res.locals.userId ?? "");
    const endpoint =
      req.body &&
      typeof req.body === "object" &&
      !Array.isArray(req.body) &&
      typeof (req.body as Record<string, unknown>).endpoint === "string"
        ? String((req.body as Record<string, unknown>).endpoint)
        : "";
    if (!isValidEndpoint(endpoint)) {
      res.status(400).json({ error: "Subscrição inválida" });
      return;
    }

    await db
      .delete(pushSubscriptionsTable)
      .where(
        and(
          eq(pushSubscriptionsTable.userId, userId),
          eq(pushSubscriptionsTable.endpoint, endpoint),
        ),
      );
    res.sendStatus(204);
  },
);

function isPushSubscriptionBody(
  value: unknown,
): value is { endpoint: string; keys: { p256dh: string; auth: string } } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const body = value as Record<string, unknown>;
  if (!isValidEndpoint(body.endpoint)) return false;
  if (!body.keys || typeof body.keys !== "object" || Array.isArray(body.keys))
    return false;
  const keys = body.keys as Record<string, unknown>;
  return (
    typeof keys.p256dh === "string" &&
    keys.p256dh.length >= 20 &&
    keys.p256dh.length <= 512 &&
    typeof keys.auth === "string" &&
    keys.auth.length >= 8 &&
    keys.auth.length <= 256
  );
}

function isValidEndpoint(value: unknown): value is string {
  if (typeof value !== "string" || value.length < 10 || value.length > 4096)
    return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export default router;
