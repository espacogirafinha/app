import assert from "node:assert/strict";
import test from "node:test";
import { createEventWithOptionalInitialDeposit } from "./event-payment-creation.ts";

type Store = {
  events: string[];
  payments: string[];
};

function transactionalStore(store: Store) {
  return async <T>(work: (tx: Store) => Promise<T>) => {
    const snapshot = {
      events: [...store.events],
      payments: [...store.payments],
    };

    try {
      return await work(store);
    } catch (error) {
      store.events = snapshot.events;
      store.payments = snapshot.payments;
      throw error;
    }
  };
}

test("event without received deposit creates only the event", async () => {
  const store: Store = { events: [], payments: [] };

  await createEventWithOptionalInitialDeposit(
    transactionalStore(store),
    async (tx) => {
      tx.events.push("venue-1");
      return "venue-1";
    },
  );

  assert.deepEqual(store, { events: ["venue-1"], payments: [] });
});

test("event and initial reservation deposit use one transaction", async () => {
  const store: Store = { events: [], payments: [] };

  await createEventWithOptionalInitialDeposit(
    transactionalStore(store),
    async (tx) => {
      tx.events.push("venue-1");
      return "venue-1";
    },
    async (tx, eventId) => {
      tx.payments.push(`deposit:${eventId}`);
    },
  );

  assert.deepEqual(store, {
    events: ["venue-1"],
    payments: ["deposit:venue-1"],
  });
});

test("failed initial deposit rolls back event creation", async () => {
  const store: Store = { events: [], payments: [] };

  await assert.rejects(
    createEventWithOptionalInitialDeposit(
      transactionalStore(store),
      async (tx) => {
        tx.events.push("venue-1");
        return "venue-1";
      },
      async () => {
        throw new Error("payment failed");
      },
    ),
  );

  assert.deepEqual(store, { events: [], payments: [] });
});
