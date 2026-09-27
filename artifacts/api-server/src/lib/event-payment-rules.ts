export const EVENT_PAYMENT_MODULES = ["venue_events", "external_events"] as const;
export const EVENT_PAYMENT_TYPES = ["reservation_deposit", "payment", "legacy_payment"] as const;
export const EVENT_PAYMENT_METHODS = ["cash", "bank_transfer", "mbway"] as const;
export const RESERVATION_DEPOSIT_POLICIES = [
  "auto_30",
  "manual",
  "frozen_after_payment",
  "legacy_unknown",
] as const;

export type EventPaymentModule = (typeof EVENT_PAYMENT_MODULES)[number];
export type EventPaymentType = (typeof EVENT_PAYMENT_TYPES)[number];
export type EventPaymentMethod = (typeof EVENT_PAYMENT_METHODS)[number];
export type ReservationDepositPolicy = (typeof RESERVATION_DEPOSIT_POLICIES)[number];
export type EventPaymentStatus = "unpaid" | "partial" | "paid";

export type PaymentLike = {
  id?: string;
  paymentType: EventPaymentType;
  amount: number;
  deletedAt?: Date | string | null;
};

export type PaymentDraft = {
  paymentType: EventPaymentType;
  amount: number;
  paymentMethod: EventPaymentMethod | null;
  paidAt: Date | string | null;
  source: string;
};

export class EventPaymentRuleError extends Error {
  constructor(
    public readonly code:
      | "invalid_amount"
      | "invalid_payment_type"
      | "invalid_payment_method"
      | "manual_method_required"
      | "manual_paid_at_required"
      | "manual_legacy_not_allowed"
      | "invalid_paid_at"
      | "overpayment",
    message: string,
  ) {
    super(message);
    this.name = "EventPaymentRuleError";
  }
}

function cents(value: number) {
  if (!Number.isFinite(value)) return Number.NaN;
  return Math.round(value * 100);
}

function euros(valueInCents: number) {
  return valueInCents / 100;
}

export function roundMoney(value: number) {
  return euros(Math.round(value * 100));
}

export function paymentStatusFromAmounts(totalPrice: number, received: number): EventPaymentStatus {
  const receivedCents = Math.max(0, cents(received));
  const totalCents = Math.max(0, cents(totalPrice));
  if (receivedCents <= 0) return "unpaid";
  if (receivedCents < totalCents) return "partial";
  return "paid";
}

export function suggestVenueReservationDeposit(totalPrice: number) {
  return roundMoney(Math.max(0, totalPrice) * 0.3);
}

export function validatePaymentDraft(input: PaymentDraft) {
  if (!Number.isFinite(input.amount) || cents(input.amount) <= 0) {
    throw new EventPaymentRuleError("invalid_amount", "Payment amount must be greater than zero");
  }
  if (!EVENT_PAYMENT_TYPES.includes(input.paymentType)) {
    throw new EventPaymentRuleError("invalid_payment_type", "Invalid payment type");
  }
  if (input.paymentMethod !== null && !EVENT_PAYMENT_METHODS.includes(input.paymentMethod)) {
    throw new EventPaymentRuleError("invalid_payment_method", "Invalid payment method");
  }
  if (input.paidAt !== null && Number.isNaN(new Date(input.paidAt).getTime())) {
    throw new EventPaymentRuleError("invalid_paid_at", "Invalid payment date");
  }
  if (input.source === "manual") {
    if (input.paymentType === "legacy_payment") {
      throw new EventPaymentRuleError("manual_legacy_not_allowed", "Legacy payments cannot be created manually");
    }
    if (!input.paymentMethod) {
      throw new EventPaymentRuleError("manual_method_required", "Manual payments require a payment method");
    }
    if (!input.paidAt) {
      throw new EventPaymentRuleError("manual_paid_at_required", "Manual payments require a payment date");
    }
  }
}

export function activePayments(payments: PaymentLike[]) {
  return payments.filter((payment) => !payment.deletedAt);
}

export function maximumAllowedPayment(
  totalPrice: number,
  payments: PaymentLike[],
  excludePaymentId?: string,
) {
  const totalCents = Math.max(0, cents(totalPrice));
  const receivedOtherCents = activePayments(payments)
    .filter((payment) => !excludePaymentId || payment.id !== excludePaymentId)
    .reduce((sum, payment) => sum + Math.max(0, cents(payment.amount)), 0);
  return euros(Math.max(0, totalCents - receivedOtherCents));
}

export function assertPaymentWithinBalance(
  totalPrice: number,
  payments: PaymentLike[],
  amount: number,
  excludePaymentId?: string,
) {
  const maximum = maximumAllowedPayment(totalPrice, payments, excludePaymentId);
  if (cents(amount) > cents(maximum)) {
    throw new EventPaymentRuleError(
      "overpayment",
      `Payment exceeds remaining balance. Maximum allowed is ${maximum.toFixed(2)}`,
    );
  }
  return maximum;
}

export function summarizeEventPayments(input: {
  totalPrice: number;
  payments: PaymentLike[];
  expectedDeposit?: number | null;
  refundableDepositAmount?: number | null;
}) {
  void input.refundableDepositAmount;

  const totalPriceCents = Math.max(0, cents(input.totalPrice));
  const active = activePayments(input.payments);
  const receivedCents = active.reduce(
    (sum, payment) => sum + Math.max(0, cents(payment.amount)),
    0,
  );
  const depositReceivedCents = active
    .filter((payment) => payment.paymentType === "reservation_deposit")
    .reduce((sum, payment) => sum + Math.max(0, cents(payment.amount)), 0);
  const expectedDepositCents =
    input.expectedDeposit === null || input.expectedDeposit === undefined
      ? null
      : Math.max(0, cents(input.expectedDeposit));

  const received = euros(receivedCents);
  const totalPrice = euros(totalPriceCents);

  return {
    totalPrice,
    received,
    remainingBalance: euros(Math.max(totalPriceCents - receivedCents, 0)),
    historicalOverpayment: euros(Math.max(receivedCents - totalPriceCents, 0)),
    paymentStatus: paymentStatusFromAmounts(totalPrice, received),
    expectedDeposit:
      expectedDepositCents === null ? null : euros(expectedDepositCents),
    depositReceived: euros(depositReceivedCents),
    depositRemaining:
      expectedDepositCents === null
        ? 0
        : euros(Math.max(expectedDepositCents - depositReceivedCents, 0)),
  };
}

export function compatibilityMirror(summary: ReturnType<typeof summarizeEventPayments>) {
  return {
    amountPaid: summary.received,
    paymentStatus: summary.paymentStatus,
  };
}
