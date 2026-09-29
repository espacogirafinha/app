import { expect, test } from "@playwright/test";

function venueEvent(overrides: Record<string, unknown>) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    customerName: "Diana Pedrosa",
    phone: "+351 912 345 678",
    email: "diana@example.com",
    eventDate: "2099-10-10",
    startTime: "15:00",
    endTime: "18:00",
    status: "confirmed",
    paymentStatus: "partial",
    source: "Google",
    packName: "Premium",
    packEstimatedCost: 100,
    birthdayChildName: "Mia",
    birthdayChildAge: 6,
    childrenCount: 15,
    childrenAges: null,
    partyTheme: "Unicórnios",
    decorationNotes: null,
    cateringNotes: null,
    allergies: null,
    imageAuthorization: null,
    termsAccepted: true,
    totalPrice: 550,
    expectedReservationDepositAmount: 110,
    reservationDepositPolicy: "fixed_amount",
    amountPaid: 110,
    remainingBalance: 440,
    paymentMethod: "transfer",
    notes: null,
    createdAt: "2026-09-01T10:00:00.000Z",
    updatedAt: "2026-09-01T10:00:00.000Z",
    ...overrides,
  };
}

const events = [
  venueEvent({}),
  venueEvent({
    id: "22222222-2222-4222-8222-222222222222",
    customerName: "Ana Costa",
    phone: "+351 934 111 222",
    eventDate: "2020-07-12",
    birthdayChildName: "Lourenço",
  }),
  venueEvent({
    id: "33333333-3333-4333-8333-333333333333",
    customerName: "Rui Santos",
    phone: "+351 961 987 654",
    eventDate: "2099-11-20",
    birthdayChildName: "Tomás",
  }),
];

test("Festas no Espaço: pesquisa local por cliente, criança, telefone e festas anteriores", async ({ page }) => {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === "GET" && url.pathname === "/api/venue-events") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(events),
      });
    }

    if (request.method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    }

    return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "not mocked" }) });
  });

  await page.goto("/venue-events-search-test.html");

  const search = page.getByPlaceholder("Pesquisar por cliente, criança ou telemóvel…");
  await expect(search).toBeVisible();

  await expect(page.locator("h3:visible", { hasText: "Diana Pedrosa" })).toBeVisible();
  await expect(page.locator("h3:visible", { hasText: "Ana Costa" })).toHaveCount(0);

  await search.fill("PEDR");
  await expect(page.locator("h3:visible", { hasText: "Diana Pedrosa" })).toBeVisible();
  await expect(page.locator("h3:visible", { hasText: "Rui Santos" })).toHaveCount(0);

  await search.fill("lourenco");
  await expect(page.locator("h3:visible", { hasText: "Ana Costa" })).toBeVisible();
  await expect(page.getByText("Resultados em festas próximas e anteriores (1).", { exact: true })).toBeVisible();

  await search.fill("9876");
  await expect(page.locator("h3:visible", { hasText: "Rui Santos" })).toBeVisible();
  await expect(page.locator("h3:visible", { hasText: "Diana Pedrosa" })).toHaveCount(0);

  await search.fill("não existe");
  await expect(page.getByText("Nenhuma festa encontrada para esta pesquisa.", { exact: true })).toBeVisible();

  await search.fill("");
  await expect(page.locator("h3:visible", { hasText: "Diana Pedrosa" })).toBeVisible();
  await expect(page.locator("h3:visible", { hasText: "Ana Costa" })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Anteriores" })).toBeEnabled();
});
