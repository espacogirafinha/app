import type {
  EventPaymentMethod,
  EventPaymentModule,
  EventPaymentType,
} from "./event-payment-rules";

export type FinancialMovementRow = {
  id: string;
  venueEventId: string | null;
  externalEventId: string | null;
  paymentType: EventPaymentType;
  amount: number;
  paymentMethod: EventPaymentMethod | null;
  paidAt: Date | null;
  notes: string | null;
  createdAt: Date;
  deletedAt: Date | null;
  venueCustomerName: string | null;
  venueBirthdayChildName: string | null;
  venueEventDate: string | null;
  externalCustomerName: string | null;
  externalEventDate: string | null;
};

export type FinancialMovement = {
  id: string;
  module: EventPaymentModule;
  entityId: string;
  customerName: string;
  birthdayChildName: string | null;
  eventDate: string;
  paymentType: EventPaymentType;
  amount: number;
  paymentMethod: EventPaymentMethod | null;
  paidAt: Date | null;
  notes: string | null;
  createdAt: Date;
};

export type FinancialMovementsResult = {
  movements: FinancialMovement[];
  undatedPayments: FinancialMovement[];
};

export function buildFinancialMovements(rows: FinancialMovementRow[]): FinancialMovementsResult {
  const active = rows
    .filter((row) => row.deletedAt === null)
    .map((row): FinancialMovement | null => {
      const module: EventPaymentModule = row.venueEventId ? "venue_events" : "external_events";
      const entityId = row.venueEventId ?? row.externalEventId;
      if (!entityId) return null;

      const customerName = module === "venue_events"
        ? row.venueCustomerName
        : row.externalCustomerName;
      const eventDate = module === "venue_events"
        ? row.venueEventDate
        : row.externalEventDate;

      if (!customerName || !eventDate) return null;

      return {
        id: row.id,
        module,
        entityId,
        customerName,
        birthdayChildName: module === "venue_events" ? row.venueBirthdayChildName : null,
        eventDate,
        paymentType: row.paymentType,
        amount: row.amount,
        paymentMethod: row.paymentMethod,
        paidAt: row.paidAt,
        notes: row.notes,
        createdAt: row.createdAt,
      };
    })
    .filter((row): row is FinancialMovement => row !== null);

  const compareNewestFirst = (a: FinancialMovement, b: FinancialMovement) => {
    const paidAtDiff = (b.paidAt?.getTime() ?? 0) - (a.paidAt?.getTime() ?? 0);
    if (paidAtDiff !== 0) return paidAtDiff;
    const createdAtDiff = b.createdAt.getTime() - a.createdAt.getTime();
    if (createdAtDiff !== 0) return createdAtDiff;
    return b.id.localeCompare(a.id);
  };

  const movements = active
    .filter((row) => row.paidAt !== null)
    .sort(compareNewestFirst);

  const undatedPayments = active
    .filter((row) => row.paidAt === null)
    .sort((a, b) => {
      const createdAtDiff = b.createdAt.getTime() - a.createdAt.getTime();
      return createdAtDiff !== 0 ? createdAtDiff : b.id.localeCompare(a.id);
    });

  return { movements, undatedPayments };
}
