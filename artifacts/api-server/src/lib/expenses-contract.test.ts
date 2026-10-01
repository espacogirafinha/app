import assert from "node:assert/strict";
import test from "node:test";
import {
  CreateExpenseBody,
  ListExpensesQueryParams,
  UpdateExpenseBody,
} from "../../../../lib/api-zod/src/generated/api.ts";

const categoryId = "11111111-1111-4111-8111-111111111111";
const venueA = "22222222-2222-4222-8222-222222222221";
const venueB = "22222222-2222-4222-8222-222222222222";
const externalA = "33333333-3333-4333-8333-333333333331";
const externalB = "33333333-3333-4333-8333-333333333332";

function baseExpense() {
  return {
    expenseDate: "2026-09-15",
    description: "Pagamento colaboradora",
    amount: 50,
    categoryId,
    expenseType: "operational" as const,
  };
}

test("expense association is optional", () => {
  const parsed = CreateExpenseBody.safeParse(baseExpense());
  assert.equal(parsed.success, true);
});

test("expense accepts one venue event", () => {
  const parsed = CreateExpenseBody.safeParse({
    ...baseExpense(),
    eventLinks: [{ eventType: "venue_event", eventId: venueA }],
  });
  assert.equal(parsed.success, true);
});

test("expense accepts one external event", () => {
  const parsed = CreateExpenseBody.safeParse({
    ...baseExpense(),
    eventLinks: [{ eventType: "external_event", eventId: externalA }],
  });
  assert.equal(parsed.success, true);
});

test("expense accepts two venue events", () => {
  const parsed = CreateExpenseBody.safeParse({
    ...baseExpense(),
    eventLinks: [
      { eventType: "venue_event", eventId: venueA },
      { eventType: "venue_event", eventId: venueB },
    ],
  });
  assert.equal(parsed.success, true);
});

test("expense accepts two external events", () => {
  const parsed = CreateExpenseBody.safeParse({
    ...baseExpense(),
    eventLinks: [
      { eventType: "external_event", eventId: externalA },
      { eventType: "external_event", eventId: externalB },
    ],
  });
  assert.equal(parsed.success, true);
});

test("expense accepts mixed venue and external events", () => {
  const parsed = CreateExpenseBody.safeParse({
    ...baseExpense(),
    eventLinks: [
      { eventType: "venue_event", eventId: venueA },
      { eventType: "external_event", eventId: externalA },
    ],
  });
  assert.equal(parsed.success, true);
});

test("legacy venueEventId remains accepted for compatibility", () => {
  const parsed = CreateExpenseBody.safeParse({
    ...baseExpense(),
    venueEventId: venueA,
  });
  assert.equal(parsed.success, true);
});

test("expense update can replace or remove all associations", () => {
  const replace = UpdateExpenseBody.safeParse({
    eventLinks: [
      { eventType: "external_event", eventId: externalA },
      { eventType: "external_event", eventId: externalB },
    ],
  });
  const remove = UpdateExpenseBody.safeParse({ eventLinks: [] });

  assert.equal(replace.success, true);
  assert.equal(remove.success, true);
});

test("invalid event association type is rejected", () => {
  const parsed = CreateExpenseBody.safeParse({
    ...baseExpense(),
    eventLinks: [{ eventType: "workshop", eventId: externalA }],
  });
  assert.equal(parsed.success, false);
});

test("negative and zero expenses are rejected", () => {
  for (const amount of [-1, 0]) {
    const parsed = CreateExpenseBody.safeParse({
      ...baseExpense(),
      amount,
    });
    assert.equal(parsed.success, false);
  }
});

test("expense filters accept month range category and type as date strings", () => {
  const parsed = ListExpensesQueryParams.safeParse({
    startDate: "2026-09-01",
    endDate: "2026-09-30",
    categoryId,
    expenseType: "investment",
    search: "mesa",
  });
  assert.equal(parsed.success, true);
  if (!parsed.success) return;
  assert.equal(parsed.data.startDate, "2026-09-01");
  assert.equal(parsed.data.endDate, "2026-09-30");
  assert.equal(parsed.data.categoryId, categoryId);
  assert.equal(parsed.data.expenseType, "investment");
});
