import type { NextFunction, Request, Response } from "express";

const FREEZE_ERROR = "payment_cutover_write_freeze";

function normalizedPath(path: string) {
  if (path.length <= 1) return path;
  return path.replace(/\/+$/, "");
}

export function isPaymentCutoverWriteFreezeEnabled(
  value = process.env.PAYMENT_CUTOVER_WRITE_FREEZE,
) {
  return value?.trim().toLowerCase() === "true";
}

export function isPaymentCutoverProtectedMutation(
  method: string,
  path: string,
) {
  const verb = method.toUpperCase();
  const pathname = normalizedPath(path);

  if (
    verb === "POST"
    && (
      pathname === "/api/venue-events"
      || pathname === "/api/external-events"
      || pathname === "/api/event-payments"
      || pathname === "/api/integrations/google-forms/venue-event"
    )
  ) {
    return true;
  }

  if (
    (verb === "PATCH" || verb === "DELETE")
    && (
      /^\/api\/venue-events\/[^/]+$/.test(pathname)
      || /^\/api\/external-events\/[^/]+$/.test(pathname)
      || /^\/api\/event-payments\/[^/]+$/.test(pathname)
    )
  ) {
    return true;
  }

  return false;
}

export function paymentCutoverWriteFreeze(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (
    !isPaymentCutoverWriteFreezeEnabled()
    || !isPaymentCutoverProtectedMutation(req.method, req.path)
  ) {
    next();
    return;
  }

  res.status(503).json({ error: FREEZE_ERROR });
}
