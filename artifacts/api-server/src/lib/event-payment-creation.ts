import type { EventPaymentMethod, EventPaymentModule } from "./event-payment-rules";

export type TransactionRunner<TTransaction> = <TResult>(
  work: (transaction: TTransaction) => Promise<TResult>,
) => Promise<TResult>;

export async function createEventWithOptionalInitialDeposit<TTransaction, TEvent>(
  transaction: TransactionRunner<TTransaction>,
  createEvent: (tx: TTransaction) => Promise<TEvent>,
  createInitialDeposit?: (tx: TTransaction, event: TEvent) => Promise<void>,
) {
  return transaction(async (tx) => {
    const event = await createEvent(tx);
    if (createInitialDeposit) {
      await createInitialDeposit(tx, event);
    }
    return event;
  });
}

export type InitialReservationDepositInput = {
  amount: number;
  paymentMethod: EventPaymentMethod;
  paidAt: Date;
  notes?: string | null;
};

export function initialReservationDepositPaymentInput(
  module: EventPaymentModule,
  entityId: string,
  deposit?: InitialReservationDepositInput,
) {
  if (!deposit) return undefined;

  return {
    module,
    entityId,
    paymentType: "reservation_deposit" as const,
    amount: deposit.amount,
    paymentMethod: deposit.paymentMethod,
    paidAt: deposit.paidAt,
    notes: deposit.notes ?? null,
  };
}
