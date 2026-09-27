import { financialPosition } from "./reports-finance";

export type FinancialPaymentKind =
  | "reservation_deposit"
  | "payment"
  | "legacy_payment";

export type FinancialPaymentSnapshot = {
  paymentType: FinancialPaymentKind;
  amount: number;
  deletedAt?: Date | string | null;
};

export type EventFinancialPosition = {
  revenue: number;
  received: number;
  pending: number;
  paymentStatus: "unpaid" | "partial" | "paid";
};

export function eventFinancialPosition(
  totalPrice: number,
  amountPaidMirror: number,
): EventFinancialPosition {
  const position = financialPosition(totalPrice, amountPaidMirror);
  const paymentStatus =
    position.received <= 0
      ? "unpaid"
      : position.received < position.revenue
        ? "partial"
        : "paid";

  return {
    ...position,
    paymentStatus,
  };
}

export function dashboardFinancialStatusText(input: {
  totalPrice: number;
  amountPaidMirror: number;
  expectedDeposit: number | null;
  payments: FinancialPaymentSnapshot[];
}) {
  const position = eventFinancialPosition(input.totalPrice, input.amountPaidMirror);

  if (position.paymentStatus === "paid") return "Pago";

  if (position.received <= 0) {
    return input.expectedDeposit !== null && input.expectedDeposit > 0
      ? `Sinal de ${formatEuro(input.expectedDeposit)} por receber`
      : "Pendente";
  }

  const activePayments = input.payments.filter((payment) => !payment.deletedAt);
  const onlyReservationDeposit =
    activePayments.length > 0
    && activePayments.every((payment) => payment.paymentType === "reservation_deposit");

  return onlyReservationDeposit
    ? `Sinal pago · Falta ${formatEuro(position.pending)}`
    : `Pago parcialmente · Falta ${formatEuro(position.pending)}`;
}

export function summarizeDashboardEvents(
  events: Array<{ totalPrice: number; amountPaid: number }>,
) {
  return events.reduce(
    (summary, event) => {
      const position = eventFinancialPosition(event.totalPrice, event.amountPaid);
      summary.revenue = roundMoney(summary.revenue + position.revenue);
      summary.received = roundMoney(summary.received + position.received);
      summary.pending = roundMoney(summary.pending + position.pending);
      if (position.paymentStatus === "paid") summary.paidCount += 1;
      if (position.paymentStatus === "partial") summary.partialCount += 1;
      if (position.paymentStatus === "unpaid") summary.unpaidCount += 1;
      return summary;
    },
    {
      revenue: 0,
      received: 0,
      pending: 0,
      paidCount: 0,
      partialCount: 0,
      unpaidCount: 0,
    },
  );
}

export function isEventDateInRange(
  eventDate: string,
  startDate: string,
  endDate: string,
) {
  return eventDate >= startDate && eventDate <= endDate;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function formatEuro(value: number) {
  return `${roundMoney(value).toFixed(2).replace(".", ",")} €`;
}
