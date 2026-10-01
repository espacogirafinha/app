import type {
  EventPaymentMethod,
  EventPaymentType,
} from "./event-payment-rules";

export type PaymentReconciliationSnapshot = {
  amount: number;
  paymentMethod: EventPaymentMethod | null;
  paidAt: Date | null;
  reconciledAt: Date | null;
};

export type PaymentReconciliationPatch = {
  paymentType?: EventPaymentType;
  amount?: number;
  paymentMethod?: EventPaymentMethod | null;
  paidAt?: Date | null;
  notes?: string | null;
  reconciledAt?: Date | null;
};

function instant(value: Date | null) {
  return value?.getTime() ?? null;
}

export function paymentComparisonChanged(
  current: PaymentReconciliationSnapshot,
  patch: PaymentReconciliationPatch,
) {
  if (patch.amount !== undefined && patch.amount !== current.amount) return true;
  if (
    patch.paymentMethod !== undefined
    && patch.paymentMethod !== current.paymentMethod
  ) return true;
  if (
    patch.paidAt !== undefined
    && instant(patch.paidAt) !== instant(current.paidAt)
  ) return true;
  return false;
}

export function nextPaymentReconciledAt(
  current: PaymentReconciliationSnapshot,
  patch: PaymentReconciliationPatch,
) {
  if (paymentComparisonChanged(current, patch)) return null;
  return patch.reconciledAt === undefined
    ? current.reconciledAt
    : patch.reconciledAt;
}
