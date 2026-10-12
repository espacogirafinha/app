import type { PushSubscription as WebPushSubscription } from "web-push";

export type PushSender = (
  subscription: WebPushSubscription,
  payload: string,
) => Promise<unknown>;

export async function deliverPushToSubscriptions(
  subscriptions: Array<{
    id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
  }>,
  payload: string,
  sender: PushSender,
  removeInvalid: (id: string) => Promise<void>,
  onDeliveryError: (statusCode: number | null) => void = () => {},
) {
  let sent = 0;
  let removed = 0;
  for (const subscription of subscriptions) {
    try {
      await sender(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        },
        payload,
      );
      sent += 1;
    } catch (error) {
      const statusCode =
        typeof error === "object" && error !== null && "statusCode" in error
          ? Number((error as { statusCode?: unknown }).statusCode)
          : null;
      if (statusCode === 404 || statusCode === 410) {
        await removeInvalid(subscription.id);
        removed += 1;
      } else {
        onDeliveryError(statusCode);
      }
    }
  }
  return { sent, removed, skipped: false };
}
