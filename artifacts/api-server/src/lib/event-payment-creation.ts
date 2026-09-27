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
