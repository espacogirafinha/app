import { expect, test } from "@playwright/test";

const response = {
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
      notes: null,
      createdAt: "2026-09-01T10:00:00.000Z",
    },
  ],
};

test("Movimentos financeiros: extrato, filtros, pesquisa e histórico sem data", async ({ page }) => {
  await page.route("**/api/event-payments/movements", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(response),
    });
  });

  await page.goto("/financial-movements-test.html");

  await expect(page.getByRole("heading", { name: "Movimentos financeiros" })).toBeVisible();

  await page.getByLabel("Período pela data do pagamento").click();
  await page.getByRole("option", { name: "Tudo" }).click();

  const receivedSummary = page.getByText("Recebido no período", { exact: true }).locator("..");
  const movementSummary = page.getByText("Movimentos", { exact: true }).locator("..");
  await expect(receivedSummary).toContainText("790,00");
  await expect(movementSummary).toContainText("3");

  const search = page.getByPlaceholder("Pesquisar por cliente ou criança…");
  await search.fill("lourenco");
  await expect(page.locator("tbody tr").filter({ hasText: "Diana Pedrosa" })).toHaveCount(2);
  await expect(page.locator("tbody tr").filter({ hasText: "Rui Santos" })).toHaveCount(0);
  await expect(receivedSummary).toContainText("590,00");

  await search.fill("");
  await page.getByLabel("Método").click();
  await page.getByRole("option", { name: "Dinheiro" }).click();
  await expect(page.locator("tbody tr").filter({ hasText: "Rui Santos" })).toHaveCount(1);
  await expect(page.locator("tbody tr").filter({ hasText: "Diana Pedrosa" })).toHaveCount(0);
  await expect(receivedSummary).toContainText("200,00");

  await page.getByLabel("Método").click();
  await page.getByRole("option", { name: "Todos" }).click();

  await expect(page.getByText("Pagamentos antigos sem data", { exact: true })).toBeVisible();
  await expect(page.getByText("Ana Costa", { exact: true })).toBeVisible();
  await expect(page.getByText("Data não registada · Não registado", { exact: true })).toBeVisible();

  const openVenue = page.getByRole("link", { name: /Abrir/ }).first();
  await expect(openVenue).toHaveAttribute("href", "/venue-events?open=venue-1");
});
