import { Router, type IRouter } from "express";

export type PushSubscriptionBody = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export type PushRouteDeps = {
  publicKey: () => string;
  saveSubscription: (
    userId: string,
    body: PushSubscriptionBody,
  ) => Promise<void>;
  deleteSubscription: (userId: string, endpoint: string) => Promise<void>;
};

export function createPushRouter(pushDeps: PushRouteDeps): IRouter {
  const router: IRouter = Router();

  router.get("/push-config", async (_req, res): Promise<void> => {
    const publicKey = pushDeps.publicKey();
    res.json({ configured: Boolean(publicKey), publicKey });
  });

  router.post("/push-subscriptions", async (req, res): Promise<void> => {
    const userId = String(res.locals.userId ?? "");
    const body = req.body as unknown;
    if (!isPushSubscriptionBody(body)) {
      res.status(400).json({ error: "Subscrição inválida" });
      return;
    }

    await pushDeps.saveSubscription(userId, body);
    res.status(201).json({ ok: true });
  });

  router.delete("/push-subscriptions", async (req, res): Promise<void> => {
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

    await pushDeps.deleteSubscription(userId, endpoint);
    res.sendStatus(204);
  });

  return router;
}

export function isPushSubscriptionBody(
  value: unknown,
): value is PushSubscriptionBody {
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

export function isValidEndpoint(value: unknown): value is string {
  if (typeof value !== "string" || value.length < 10 || value.length > 4096)
    return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
