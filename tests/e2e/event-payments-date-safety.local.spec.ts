import { expect, test } from "@playwright/test";

const entityId = "11111111-1111-4111-8111-111111111111";
const historicalWarning = "Este evento já aconteceu. Confirme a data real em que o pagamento foi recebido.";

function portugalDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return part("year") + "-" + part("month") + "-" + part("day");
}

function shiftedPortugalDate(days: number) {
  const today = portugalDateKey();
  const base = new Date(today + "T12:00:00.000Z");
  base.setUTCDate(base.getUTCDate() + days);
  return portugalDateKey(base);
}

function emptySummary() {
  return {
    totalPrice: 400,
    received: 0,
    remainingBalance: 400,
    historicalOverpayment: 0,
    paymentStatus: "unpaid",
    expectedDeposit: 80,
    depositReceived: 0,
    depositRemaining: 80,
  };
}

async function mockPayments(page: import("@playwright/test").Page, items: unknown[] = []) {
  let postCount = 0;
  let lastPatchBody: Record<string, unknown> | null = null;

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname === "/api/event-payments" && request.method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items, summary: emptySummary() }),
      });
    }

    if (url.pathname === "/api/event-payments" && request.method() === "POST") {
      postCount += 1;
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ payment: {}, summary: emptySummary() }),
      });
    }

    if (url.pathname.startsWith("/api/event-payments/") && request.method() === "PATCH") {
      lastPatchBody = request.postDataJSON();
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ payment: {}, summary: emptySummary() }),
      });
    }

    if ((url.pathname === "/api/venue-events" || url.pathname === "/api/external-events") && request.method() === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    }

    return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  });

  return {
    getPostCount: () => postCount,
    getLastPatchBody: () => lastPatchBody,
  };
}

function dateInput(page: import("@playwright/test").Page) {
  return page.locator("label").filter({ hasText: /^Data$/ }).locator("xpath=..").locator('input[type="datetime-local"]');
}

async function openCreate(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Registar pagamento", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Registar pagamento" })).toBeVisible();
}

test("Festa passada: data vazia, aviso visível e bloqueio sem data", async ({ page }) => {
  const state = await mockPayments(page);
  await page.goto("/event-payments-test.html?module=venue_events&eventDate=" + shiftedPortugalDate(-1));
  await openCreate(page);

  await expect(dateInput(page)).toHaveValue("");
  await expect(page.getByText(historicalWarning, { exact: true })).toBeVisible();

  const method = page.locator("label").filter({ hasText: /^Método$/ }).locator("xpath=..").getByRole("combobox");
  await method.click();
  await page.getByRole("option", { name: "Dinheiro" }).click();
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();

  await expect(page.getByText("Indique a data em que o pagamento foi recebido.", { exact: true })).toBeVisible();
  expect(state.getPostCount()).toBe(0);
});

test("Serviço Externo passado tem a mesma proteção", async ({ page }) => {
  await mockPayments(page);
  await page.goto("/event-payments-test.html?module=external_events&eventDate=" + shiftedPortugalDate(-1));
  await openCreate(page);

  await expect(dateInput(page)).toHaveValue("");
  await expect(page.getByText(historicalWarning, { exact: true })).toBeVisible();
});

test("Evento de hoje continua com data/hora atual pré-preenchida", async ({ page }) => {
  await mockPayments(page);
  await page.goto("/event-payments-test.html?module=venue_events&eventDate=" + shiftedPortugalDate(0));
  await openCreate(page);

  await expect(dateInput(page)).not.toHaveValue("");
  await expect(page.getByText(historicalWarning, { exact: true })).toHaveCount(0);
});

test("Evento futuro continua com data/hora atual pré-preenchida", async ({ page }) => {
  await mockPayments(page);
  await page.goto("/event-payments-test.html?module=external_events&eventDate=" + shiftedPortugalDate(1));
  await openCreate(page);

  await expect(dateInput(page)).not.toHaveValue("");
  await expect(page.getByText(historicalWarning, { exact: true })).toHaveCount(0);
});

test("Editar preserva paid_at existente e legacy sem paid_at continua vazio", async ({ page }) => {
  const existingPaidAt = "2026-07-15T14:30:00.000Z";
  const items = [
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      venueEventId: entityId,
      externalEventId: null,
      paymentType: "payment",
      amount: 50,
      paymentMethod: "cash",
      paidAt: existingPaidAt,
      reconciledAt: null,
      notes: "normal-existing",
      source: "manual",
      sourceReference: null,
      createdAt: "2026-07-15T14:30:00.000Z",
      updatedAt: "2026-07-15T14:30:00.000Z",
      deletedAt: null,
    },
    {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      venueEventId: entityId,
      externalEventId: null,
      paymentType: "legacy_payment",
      amount: 25,
      paymentMethod: null,
      paidAt: null,
      reconciledAt: null,
      notes: "legacy-existing",
      source: "legacy",
      sourceReference: null,
      createdAt: "2026-07-01T10:00:00.000Z",
      updatedAt: "2026-07-01T10:00:00.000Z",
      deletedAt: null,
    },
  ];
  const state = await mockPayments(page, items);
  await page.goto("/event-payments-test.html?module=venue_events&eventDate=" + shiftedPortugalDate(-30));

  const normalRow = page.getByText("normal-existing", { exact: true }).locator("xpath=ancestor::div[.//button[@aria-label='Editar pagamento']][1]");
  await normalRow.getByRole("button", { name: "Editar pagamento" }).click();
  await expect(dateInput(page)).not.toHaveValue("");
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect.poll(() => state.getLastPatchBody()).not.toBeNull();
  expect(new Date(String(state.getLastPatchBody()?.paidAt)).toISOString()).toBe(existingPaidAt);

  const legacyRow = page.getByText("legacy-existing", { exact: true }).locator("xpath=ancestor::div[.//button[@aria-label='Editar pagamento']][1]");
  await legacyRow.getByRole("button", { name: "Editar pagamento" }).click();
  await expect(dateInput(page)).toHaveValue("");
  await expect(page.getByText("Data não registada.", { exact: true })).toBeVisible();
  await expect(page.getByText(historicalWarning, { exact: true })).toHaveCount(0);
});

test("Mobile: proteção histórica continua visível e utilizável", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockPayments(page);
  await page.goto("/event-payments-test.html?module=venue_events&eventDate=" + shiftedPortugalDate(-1));
  await openCreate(page);

  await expect(dateInput(page)).toBeVisible();
  await expect(dateInput(page)).toHaveValue("");
  await expect(page.getByText(historicalWarning, { exact: true })).toBeVisible();

  const dialog = page.getByRole("dialog", { name: "Registar pagamento" });
  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeLessThanOrEqual(390);
});
