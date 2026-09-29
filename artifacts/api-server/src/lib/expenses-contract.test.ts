import assert from "node:assert/strict";
import test from "node:test";
import {
  CreateExpenseBody,
  ListExpensesQueryParams,
  UpdateExpenseBody,
} from "../../../../lib/api-zod/src/generated/api.ts";

const categoryId = "11111111-1111-4111-8111-111111111111";
const eventId = "22222222-2222-4222-8222-222222222222";

test("operational expense without an event is valid", () => {
  const parsed = CreateExpenseBody.safeParse({
    expenseDate: "2026-09-15",
    description: "Continente",
    amount: 86.4,
    categoryId,
    expenseType: "operational",
    supplier: "Continente",
    venueEventId: null,
  });
  assert.equal(parsed.success, true);
});

test("investment expense is valid and event association remains optional", () => {
  const withoutEvent = CreateExpenseBody.safeParse({
    expenseDate: "2026-09-15",
    description: "Mesa redonda",
    amount: 220,
    categoryId,
    expenseType: "investment",
  });
  assert.equal(withoutEvent.success, true);

  const withEvent = CreateExpenseBody.safeParse({
    expenseDate: "2026-09-15",
    description: "Fornecedor específico",
    amount: 75,
    categoryId,
    expenseType: "operational",
    venueEventId: eventId,
  });
  assert.equal(withEvent.success, true);
});

test("negative and zero expenses are rejected", () => {
  for (const amount of [-1, 0]) {
    const parsed = CreateExpenseBody.safeParse({
      expenseDate: "2026-09-15",
      description: "Inválida",
      amount,
      categoryId,
      expenseType: "operational",
    });
    assert.equal(parsed.success, false);
  }
});

test("expense update can change amount category type and optional event independently", () => {
  const parsed = UpdateExpenseBody.safeParse({
    amount: 42,
    categoryId,
    expenseType: "operational",
    venueEventId: null,
    supplier: "Loja",
  });
  assert.equal(parsed.success, true);
  if (!parsed.success) return;
  assert.equal(parsed.data.amount, 42);
  assert.equal(parsed.data.venueEventId, null);
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
