import { and, count, desc, eq, isNull, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  db,
  notificationReadsTable,
  notificationsTable,
  pushSubscriptionsTable,
} from "@workspace/db";
import { createPushRouter } from "./push-routes";
import { refreshDueNotifications } from "./follow-up";

const router: IRouter = Router();
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.get("/notifications", async (_req, res): Promise<void> => {
  // The notification centre is already polled while users are in the app.
  // Synchronize D-30 notifications once per event; uniqueness is enforced in Postgres.
  // No writes run in Preview or before explicit activation.
  try { await refreshDueNotifications(); }
  catch (error) { console.error("Could not synchronize preparation notifications", error); }
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

router.use(
  createPushRouter({
    publicKey: () => process.env.WEB_PUSH_VAPID_PUBLIC_KEY ?? "",
    async saveSubscription(userId, body) {
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
    },
    async deleteSubscription(userId, endpoint) {
      await db
        .delete(pushSubscriptionsTable)
        .where(
          and(
            eq(pushSubscriptionsTable.userId, userId),
            eq(pushSubscriptionsTable.endpoint, endpoint),
          ),
        );
    },
  }),
);

export default router;
