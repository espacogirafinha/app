import { eq } from "drizzle-orm";
import webPush from "web-push";
import {
  db,
  notificationsTable,
  pushSubscriptionsTable,
} from "@workspace/db";
import { logger } from "./logger.ts";
import { deliverPushToSubscriptions, type PushSender } from "./push-delivery.ts";

export { buildGoogleFormNotification } from "./notification-content.ts";

export async function sendPushForNotification(
  notificationId: string,
  sender?: PushSender,
) {
  const [notification] = await db
    .select({
      id: notificationsTable.id,
      title: notificationsTable.title,
      message: notificationsTable.message,
      destination: notificationsTable.destination,
    })
    .from(notificationsTable)
    .where(eq(notificationsTable.id, notificationId))
    .limit(1);

  if (!notification) return { sent: 0, removed: 0, skipped: true };

  const subscriptions = await db
    .select({
      id: pushSubscriptionsTable.id,
      endpoint: pushSubscriptionsTable.endpoint,
      p256dh: pushSubscriptionsTable.p256dh,
      auth: pushSubscriptionsTable.auth,
    })
    .from(pushSubscriptionsTable);

  if (!subscriptions.length) return { sent: 0, removed: 0, skipped: false };

  const pushSender = sender ?? createPushSender();
  if (!pushSender) return { sent: 0, removed: 0, skipped: true };

  const payload = JSON.stringify({
    title: notification.title,
    body: notification.message,
    url: notification.destination,
    tag: `girafinha-notification-${notification.id}`,
  });
  return deliverPushToSubscriptions(
    subscriptions,
    payload,
    pushSender,
    async (id) => {
      await db
        .delete(pushSubscriptionsTable)
        .where(eq(pushSubscriptionsTable.id, id));
    },
    (statusCode) => {
      logger.warn({ statusCode }, "Web push delivery failed");
    },
  );
}

function createPushSender(): PushSender | null {
  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
  const subject = process.env.WEB_PUSH_VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    logger.warn("Web push is not configured");
    return null;
  }
  webPush.setVapidDetails(subject, publicKey, privateKey);
  return (subscription, payload) =>
    webPush.sendNotification(subscription, payload, { TTL: 300 });
}


