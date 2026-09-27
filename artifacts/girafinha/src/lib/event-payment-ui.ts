import type {
  EventPayment,
  EventPaymentMethod,
  EventPaymentSummary,
} from "@workspace/api-client-react";

export const EVENT_PAYMENT_METHOD_OPTIONS: Array<{
  value: EventPaymentMethod;
  label: string;
}> = [
  { value: "cash", label: "Dinheiro" },
  { value: "bank_transfer", label: "Transferência" },
  { value: "mbway", label: "MB Way" },
];

export function suggestVenueReservationDeposit(totalPrice: number) {
  return Math.round(Math.max(0, totalPrice) * 30) / 100;
}

export function initialExpectedDeposit(
  module: "venue_events" | "external_events",
  totalPrice: number,
) {
  return module === "venue_events" ? suggestVenueReservationDeposit(totalPrice) : null;
}

export function collectionDefaultAmount(remainingBalance: number) {
  return Math.max(0, remainingBalance);
}

export function nextAutomaticVenueDeposit(input: {
  totalPrice: number;
  currentExpected: number;
  isManual: boolean;
  depositReceived: number;
}) {
  if (input.isManual || input.depositReceived > 0) return input.currentExpected;
  return suggestVenueReservationDeposit(input.totalPrice);
}

export function formatEuro(value: number) {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function paymentMethodLabel(method: EventPaymentMethod | null) {
  if (!method) return "Método não registado";
  return EVENT_PAYMENT_METHOD_OPTIONS.find((option) => option.value === method)?.label ?? method;
}

export function paymentTypeLabel(payment: Pick<EventPayment, "paymentType">) {
  if (payment.paymentType === "reservation_deposit") return "Sinal de reserva";
  if (payment.paymentType === "legacy_payment") return "Pagamento anterior";
  return "Pagamento";
}

export function paymentSummaryLabel(
  summary: EventPaymentSummary,
  payments: Array<Pick<EventPayment, "paymentType">>,
) {
  if (summary.paymentStatus === "paid" || summary.remainingBalance <= 0) return "Pago";

  if (summary.received <= 0) {
    if (summary.expectedDeposit !== null && summary.expectedDeposit > 0) {
      return `Sinal de ${formatEuro(summary.expectedDeposit)} por receber`;
    }
    return "Pendente";
  }

  const onlyReservationDeposits =
    payments.length > 0
    && payments.every((payment) => payment.paymentType === "reservation_deposit");

  if (onlyReservationDeposits) {
    if (summary.depositRemaining > 0) {
      return `Sinal recebido parcialmente · Faltam ${formatEuro(summary.depositRemaining)} do sinal`;
    }
    return `Sinal pago · Falta ${formatEuro(summary.remainingBalance)}`;
  }

  return `Pago parcialmente · Falta ${formatEuro(summary.remainingBalance)}`;
}

export function toDateTimeLocalInput(value: Date | string = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function toIsoDateTime(value: string) {
  return value ? new Date(value).toISOString() : null;
}
