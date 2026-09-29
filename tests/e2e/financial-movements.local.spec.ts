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

  await expect(page.getByText("890,00 €", { exact: true })).toBeVisible();
  await expect(page.getByText("3", { exact: true })).toBeVisible();

  const search = page.getByPlaceholder("Pesquisar por cliente ou criança…");
  await search.fill("lourenco");
  await expect(page.getByText("Diana Pedrosa", { exact: true })).toHaveCount(2);
  await expect(page.getByText("Rui Santos", { exact: true })).toHaveCount(0);
  await expect(page.getByText("590,00 €", { exact: true })).toBeVisible();

  await search.fill("");
  await page.getByLabel("Método").click();
  await page.getByRole("option", { name: "Dinheiro" }).click();
  await expect(page.getByText("Rui Santos", { exact: true })).toBeVisible();
  await expect(page.getByText("Diana Pedrosa", { exact: true })).toHaveCount(0);
  await expect(page.getByText("200,00 €", { exact: true })).toBeVisible();

  await page.getByLabel("Método").click();
  await page.getByRole("option", { name: "Todos" }).click();

  await expect(page.getByRole("heading", { name: "Pagamentos antigos sem data" })).toBeVisible();
  await expect(page.getByText("Ana Costa", { exact: true })).toBeVisible();
  await expect(page.getByText("Data não registada · Não registado", { exact: true })).toBeVisible();

  const openVenue = page.getByRole("link", { name: /Abrir/ }).first();
  await expect(openVenue).toHaveAttribute("href", "/venue-events?open=venue-1");
});
