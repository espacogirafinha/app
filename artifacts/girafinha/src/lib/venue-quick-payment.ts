import type { EventPaymentMethod } from "@workspace/api-client-react";

export function canQuickMarkVenuePaid(remainingBalance: number) {
  return remainingBalance > 0;
}

export function quickVenuePaymentAmount(remainingBalance: number) {
  return Math.max(0, remainingBalance);
}

export function buildVenueQuickPaymentData(input: {
  entityId: string;
  remainingBalance: number;
  paymentMethod: EventPaymentMethod | "";
  paidAt: string;
  notes?: string;
}) {
  if (!input.paymentMethod) {
    throw new Error("payment_method_required");
  }

  const amount = quickVenuePaymentAmount(input.remainingBalance);
  if (amount <= 0) {
    throw new Error("no_remaining_balance");
  }

  return {
    module: "venue_events" as const,
    entityId: input.entityId,
    paymentType: "payment" as const,
    amount,
    paymentMethod: input.paymentMethod,
    paidAt: input.paidAt,
    notes: input.notes?.trim() || null,
  };
}
