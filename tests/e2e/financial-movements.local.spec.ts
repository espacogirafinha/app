import { expect, test, type Page } from "@playwright/test";

function makeResponse() {
  return {
    movements: [
      {
        id: "payment-final",
        module: "venue_events",
        entityId: "venue-1",
        customerName: "Diana Pedrosa",
        birthdayChildName: "Lourenço",
        eventDate: "2026-11-15",
        paymentType: "payment",
        amount: 480,
        paymentMethod: "bank_transfer",
        paidAt: "2026-11-01T18:22:00.000Z",
        reconciledAt: "2026-11-01T19:00:00.000Z",
        notes: "Pagamento final",
        createdAt: "2026-11-01T18:23:00.000Z",
      },
      {
        id: "cash-external",
        module: "external_events",
        entityId: "external-1",
        customerName: "Rui Santos",
        birthdayChildName: null,
        eventDate: "2026-10-20",
        paymentType: "payment",
        amount: 200,
        paymentMethod: "cash",
        paidAt: "2026-10-05T12:00:00.000Z",
        reconciledAt: null,
        notes: null,
        createdAt: "2026-10-05T12:01:00.000Z",
      },
      {
        id: "signal",
        module: "venue_events",
        entityId: "venue-1",
        customerName: "Diana Pedrosa",
        birthdayChildName: "Lourenço",
        eventDate: "2026-11-15",
        paymentType: "reservation_deposit",
        amount: 110,
        paymentMethod: "bank_transfer",
        paidAt: "2026-09-30T09:00:00.000Z",
        reconciledAt: null,
        notes: null,
        createdAt: "2026-09-30T09:01:00.000Z",
      },
    ],
    undatedPayments: [
      {
        id: "legacy",
        module: "venue_events",
        entityId: "venue-old",
        customerName: "Ana Costa",
        birthdayChildName: "Mia",
        eventDate: "2026-07-12",
        paymentType: "legacy_payment",
        amount: 250,
        paymentMethod: null,
        paidAt: null,
        reconciledAt: null,
        notes: null,
        createdAt: "2026-09-01T10:00:00.000Z",
      },
    ],
  };
}

async function mockFinancialMovements(page: Page) {
  const response = makeResponse();
  const patches: Array<{ id: string; body: { reconciledAt?: string | null } }> = [];

  await page.route("**/api/event-payments/movements", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(response),
    });
  });

  await page.route("**/api/event-payments/*", async (route) => {
    const request = route.request();
    if (request.method() !== "PATCH") {
      return route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: "not mocked" }),
      });
    }

    const id = new URL(request.url()).pathname.split("/").pop()!;
    const body = request.postDataJSON() as { reconciledAt?: string | null };
    patches.push({ id, body });

    const movement = response.movements.find((item) => item.id === id);
    if (!movement) {
      return route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: "Payment not found" }),
      });
    }

    if (body.reconciledAt !== undefined) {
      movement.reconciledAt = body.reconciledAt;
    }

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        payment: {
          id,
          venueEventId: movement.module === "venue_events" ? movement.entityId : null,
          externalEventId: movement.module === "external_events" ? movement.entityId : null,
          paymentType: movement.paymentType,
          amount: movement.amount,
          paymentMethod: movement.paymentMethod,
          paidAt: movement.paidAt,
          reconciledAt: movement.reconciledAt,
          notes: movement.notes,
          source: "manual",
          sourceReference: null,
          createdAt: movement.createdAt,
          updatedAt: "2026-10-01T00:30:00.000Z",
          deletedAt: null,
        },
        summary: {
          totalPrice: 1000,
          received: 790,
          remainingBalance: 210,
          historicalOverpayment: 0,
          paymentStatus: "partial",
          expectedDeposit: null,
          depositReceived: 110,
          depositRemaining: 0,
        },
      }),
    });
  });

  return { response, patches };
}

test("Movimentos financeiros: conferência, filtros, resumo e histórico sem data", async ({ page }) => {
  const { patches } = await mockFinancialMovements(page);

  await page.goto("/financial-movements-test.html");
  await expect(page.getByRole("heading", { name: "Movimentos financeiros" })).toBeVisible();

  await page.getByLabel("Período pela data do pagamento").click();
  await page.getByRole("option", { name: "Tudo" }).click();

  const receivedSummary = page.getByText("Recebido no período", { exact: true }).locator("..");
  const movementSummary = page.getByText("Movimentos", { exact: true }).locator("..");
  const pendingSummary = page.getByText("Por conferir", { exact: true }).first().locator("..");
  const reconciledSummary = page.getByText("Conferidos", { exact: true }).first().locator("..");

  await expect(receivedSummary).toContainText("790,00");
  await expect(movementSummary).toContainText("3");
  await expect(pendingSummary).toContainText("310,00");
  await expect(pendingSummary).toContainText("2 movimentos");
  await expect(reconciledSummary).toContainText("480,00");
  await expect(reconciledSummary).toContainText("1 movimento");

  const rows = page.locator("tbody tr");
  await expect(rows.nth(0)).toContainText("Diana Pedrosa");
  await expect(rows.nth(0)).toContainText("480,00");
  await expect(rows.nth(1)).toContainText("Rui Santos");
  await expect(rows.nth(2)).toContainText("110,00");

  const ruiRow = rows.filter({ hasText: "Rui Santos" });
  await expect(ruiRow.getByText("Por conferir", { exact: true })).toBeVisible();
  await ruiRow.getByRole("button", { name: "Marcar como conferido" }).click();

  await expect.poll(() => patches.length).toBe(1);
  expect(patches[0]?.id).toBe("cash-external");
  expect(typeof patches[0]?.body.reconciledAt).toBe("string");
  await expect(ruiRow.getByText("Conferido", { exact: true })).toBeVisible();
  await expect(pendingSummary).toContainText("110,00");
  await expect(pendingSummary).toContainText("1 movimento");
  await expect(reconciledSummary).toContainText("680,00");
  await expect(reconciledSummary).toContainText("2 movimentos");

  await ruiRow.getByRole("button", { name: "Voltar a Por conferir" }).click();
  await expect.poll(() => patches.length).toBe(2);
  expect(patches[1]).toEqual({
    id: "cash-external",
    body: { reconciledAt: null },
  });
  await expect(ruiRow.getByText("Por conferir", { exact: true })).toBeVisible();

  await page.getByLabel("Estado de conferência").click();
  await page.getByRole("option", { name: "Por conferir" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await expect(page.locator("tbody tr").filter({ hasText: "Rui Santos" })).toHaveCount(1);
  await expect(page.locator("tbody tr").filter({ hasText: "110,00" })).toHaveCount(1);
  await expect(receivedSummary).toContainText("310,00");
  await expect(reconciledSummary).toContainText("0,00");

  const search = page.getByPlaceholder("Pesquisar por cliente ou criança…");
  await search.fill("lourenco");
  await page.getByLabel("Método").click();
  await page.getByRole("option", { name: "Transferência" }).click();
  await page.getByLabel("Origem").click();
  await page.getByRole("option", { name: "Festas no Espaço" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody tr").first()).toContainText("110,00");
  await expect(receivedSummary).toContainText("110,00");

  await search.fill("");
  await page.getByLabel("Método").click();
  await page.getByRole("option", { name: "Todos" }).click();
  await page.getByLabel("Origem").click();
  await page.getByRole("option", { name: "Todas" }).click();
  await page.getByLabel("Estado de conferência").click();
  await page.getByRole("option", { name: "Conferidos" }).click();

  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody tr").first()).toContainText("480,00");
  await expect(receivedSummary).toContainText("480,00");
  await expect(pendingSummary).toContainText("0,00");
  await expect(reconciledSummary).toContainText("480,00");

  await expect(page.getByText("Pagamentos antigos sem data", { exact: true })).toBeVisible();
  await expect(page.getByText("Ana Costa", { exact: true })).toBeVisible();
  await expect(page.getByText("Data não registada · Não registado", { exact: true })).toBeVisible();

  const openVenue = page.getByRole("link", { name: /Abrir/ }).first();
  await expect(openVenue).toHaveAttribute("href", "/venue-events?open=venue-1");
});

test("Movimentos financeiros mobile: ação de conferência fica disponível no próprio movimento", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { patches } = await mockFinancialMovements(page);

  await page.goto("/financial-movements-test.html");
  await page.getByLabel("Período pela data do pagamento").click();
  await page.getByRole("option", { name: "Tudo" }).click();

  const ruiCard = page.locator(".md\\:hidden > div").filter({ hasText: "Rui Santos" });
  await expect(ruiCard.getByText("Por conferir", { exact: true })).toBeVisible();
  const action = ruiCard.getByRole("button", { name: "Marcar como conferido" });
  await expect(action).toBeVisible();
  await action.click();

  await expect.poll(() => patches.length).toBe(1);
  await expect(ruiCard.getByText("Conferido", { exact: true })).toBeVisible();
  await expect(ruiCard.getByRole("button", { name: "Voltar a Por conferir" })).toBeVisible();
  await expect(ruiCard.getByRole("link", { name: "Rui Santos" })).toHaveAttribute(
    "href",
    "/external-events?open=external-1",
  );
});
