import { eq } from "drizzle-orm";
import webPush, { type PushSubscription as WebPushSubscription } from "web-push";
import {
  db,
  notificationsTable,
  pushSubscriptionsTable,
  userRolesTable,
} from "@workspace/db";
import { logger } from "./logger.ts";

export { buildGoogleFormNotification } from "./notification-content.ts";

type PushSender = (
  subscription: WebPushSubscription,
  payload: string,
) => Promise<unknown>;

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
    .from(pushSubscriptionsTable)
    .innerJoin(
      userRolesTable,
      eq(userRolesTable.userId, pushSubscriptionsTable.userId),
    );

  if (!subscriptions.length) return { sent: 0, removed: 0, skipped: false };

  const pushSender = sender ?? createPushSender();
  if (!pushSender) return { sent: 0, removed: 0, skipped: true };

  let sent = 0;
  let removed = 0;
  for (const subscription of subscriptions) {
    try {
      await pushSender(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        },
        JSON.stringify({
          title: notification.title,
          body: notification.message,
          url: notification.destination,
          tag: `girafinha-notification-${notification.id}`,
        }),
      );
      sent += 1;
    } catch (error) {
      const statusCode =
        typeof error === "object" && error !== null && "statusCode" in error
          ? Number((error as { statusCode?: unknown }).statusCode)
          : null;
      if (statusCode === 404 || statusCode === 410) {
        await db
          .delete(pushSubscriptionsTable)
          .where(eq(pushSubscriptionsTable.id, subscription.id));
        removed += 1;
      } else {
        logger.warn({ statusCode }, "Web push delivery failed");
      }
    }
  }

  return { sent, removed, skipped: false };
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
