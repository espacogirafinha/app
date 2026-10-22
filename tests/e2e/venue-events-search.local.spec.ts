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

    if (request.method() === "GET" && url.pathname === "/api/event-payments") {
      const entityId = url.searchParams.get("entityId");
      const historicalLegacy =
        entityId === "22222222-2222-4222-8222-222222222222";
      const upcomingDeposit =
        entityId === "11111111-1111-4111-8111-111111111111";

      const items = historicalLegacy
        ? [
            {
              id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              venueEventId: entityId,
              externalEventId: null,
              paymentType: "legacy_payment",
              amount: 110,
              paymentMethod: null,
              paidAt: null,
              reconciledAt: null,
              notes: null,
              source: "legacy_migration",
              sourceReference: "legacy:test",
              createdAt: "2020-07-01T10:00:00.000Z",
              updatedAt: "2020-07-01T10:00:00.000Z",
              deletedAt: null,
            },
          ]
        : upcomingDeposit
          ? [
              {
                id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                venueEventId: entityId,
                externalEventId: null,
                paymentType: "reservation_deposit",
                amount: 110,
                paymentMethod: "bank_transfer",
                paidAt: null,
                reconciledAt: null,
                notes: null,
                source: "manual",
                sourceReference: null,
                createdAt: "2026-09-01T10:00:00.000Z",
                updatedAt: "2026-09-01T10:00:00.000Z",
                deletedAt: null,
              },
            ]
          : [];

      const event = events.find((candidate) => candidate.id === entityId);
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items,
          summary: {
            totalPrice: event?.totalPrice ?? 0,
            received: event?.amountPaid ?? 0,
            remainingBalance: event?.remainingBalance ?? 0,
            paymentStatus: event?.paymentStatus ?? "unpaid",
            historicalOverpayment: 0,
            expectedDeposit: event?.expectedReservationDepositAmount ?? null,
            depositReceived: upcomingDeposit ? 110 : 0,
            depositRemaining: 0,
          },
        }),
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
  const upcomingRow = page.locator("#venue-event-11111111-1111-4111-8111-111111111111");
  await expect(upcomingRow.getByRole("link", { name: "Confirmar reserva por WhatsApp" })).toBeVisible();
  await expect(upcomingRow.getByText("Pedir feedback por WhatsApp", { exact: true })).toHaveCount(0);
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


test("desktop: festa histórica apresenta apenas feedback sem expandir a festa", async ({ page }) => {
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

    if (request.method() === "GET" && url.pathname === "/api/event-payments") {
      const entityId = url.searchParams.get("entityId");
      const event = events.find((candidate) => candidate.id === entityId);
      const items =
        entityId === "22222222-2222-4222-8222-222222222222"
          ? [
              {
                id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                venueEventId: entityId,
                externalEventId: null,
                paymentType: "legacy_payment",
                amount: 110,
                paymentMethod: null,
                paidAt: null,
                reconciledAt: null,
                notes: null,
                source: "legacy_migration",
                sourceReference: "legacy:test",
                createdAt: "2020-07-01T10:00:00.000Z",
                updatedAt: "2020-07-01T10:00:00.000Z",
                deletedAt: null,
              },
            ]
          : [];

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items,
          summary: {
            totalPrice: event?.totalPrice ?? 0,
            received: event?.amountPaid ?? 0,
            remainingBalance: event?.remainingBalance ?? 0,
            paymentStatus: event?.paymentStatus ?? "unpaid",
            historicalOverpayment: 0,
            expectedDeposit: event?.expectedReservationDepositAmount ?? null,
            depositReceived: 0,
            depositRemaining: 0,
          },
        }),
      });
    }

    if (request.method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    }

    return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  });

  await page.goto("/venue-events-search-test.html");
  const search = page.getByPlaceholder("Pesquisar por cliente, criança ou telemóvel…");
  await search.fill("Ana Costa");

  const row = page.locator("#venue-event-22222222-2222-4222-8222-222222222222");
  await expect(row).toBeVisible();
  await expect(
    row.locator("#venue-event-details-22222222-2222-4222-8222-222222222222"),
  ).toHaveCount(0);
  await expect(
    row.getByRole("link", { name: "Confirmar reserva por WhatsApp" }),
  ).toHaveCount(0);
  await expect(
    row.getByRole("link", { name: "Pedir feedback por WhatsApp" }),
  ).toBeVisible();
  await expect(row.getByText("Informação da festa")).toHaveCount(0);

  await page.screenshot({
    path: "test-results/whatsapp-actions-list-desktop.png",
    fullPage: true,
  });
});

test("mobile: festa histórica apresenta apenas feedback sem expandir e sem overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

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

    if (request.method() === "GET" && url.pathname === "/api/event-payments") {
      const entityId = url.searchParams.get("entityId");
      const event = events.find((candidate) => candidate.id === entityId);
      const items =
        entityId === "22222222-2222-4222-8222-222222222222"
          ? [
              {
                id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                venueEventId: entityId,
                externalEventId: null,
                paymentType: "legacy_payment",
                amount: 110,
                paymentMethod: null,
                paidAt: null,
                reconciledAt: null,
                notes: null,
                source: "legacy_migration",
                sourceReference: "legacy:test",
                createdAt: "2020-07-01T10:00:00.000Z",
                updatedAt: "2020-07-01T10:00:00.000Z",
                deletedAt: null,
              },
            ]
          : [];

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items,
          summary: {
            totalPrice: event?.totalPrice ?? 0,
            received: event?.amountPaid ?? 0,
            remainingBalance: event?.remainingBalance ?? 0,
            paymentStatus: event?.paymentStatus ?? "unpaid",
            historicalOverpayment: 0,
            expectedDeposit: event?.expectedReservationDepositAmount ?? null,
            depositReceived: 0,
            depositRemaining: 0,
          },
        }),
      });
    }

    if (request.method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    }

    return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  });

  await page.goto("/venue-events-search-test.html");
  const search = page.getByPlaceholder("Pesquisar por cliente, criança ou telemóvel…");
  await search.fill("Ana Costa");

  const row = page.locator("#venue-event-22222222-2222-4222-8222-222222222222");
  await expect(row.locator('button[aria-controls="venue-event-details-22222222-2222-4222-8222-222222222222"][aria-expanded="false"]')).toBeVisible();
  await expect(
    row.getByRole("link", { name: "Confirmar reserva por WhatsApp" }),
  ).toHaveCount(0);
  await expect(
    row.getByRole("link", { name: "Pedir feedback por WhatsApp" }),
  ).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);

  await page.screenshot({
    path: "test-results/whatsapp-actions-list-mobile.png",
    fullPage: true,
  });
});

test("festa no próprio dia alterna exclusivamente na hora de fim em Lisboa", async ({ page }) => {
  const today = venueEvent({
    id: "44444444-4444-4444-8444-444444444444",
    customerName: "Beatriz Silva",
    eventDate: "2026-10-14",
    startTime: "16:00",
    endTime: "19:00",
    amountPaid: 110,
  });
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/venue-events") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([today]) });
    }
    if (url.pathname === "/api/event-payments") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: [{
            id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            paymentType: "reservation_deposit", amount: 110,
            paidAt: null, deletedAt: null,
          }],
          summary: {
            totalPrice: 550, received: 110, remainingBalance: 440,
            paymentStatus: "partial", expectedDeposit: 110,
            depositReceived: 110, depositRemaining: 0, historicalOverpayment: 0,
          },
        }),
      });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  await page.clock.setFixedTime(new Date("2026-10-14T17:59:00.000Z"));
  await page.goto("/venue-events-search-test.html");
  const row = page.locator("#venue-event-44444444-4444-4444-8444-444444444444");
  await expect(row.getByRole("link", { name: "Confirmar reserva por WhatsApp" })).toBeVisible();
  await expect(row.getByText("Pedir feedback por WhatsApp", { exact: true })).toHaveCount(0);

  await page.clock.setFixedTime(new Date("2026-10-14T18:01:00.000Z"));
  await page.reload();
  await page.getByRole("tab", { name: "Anteriores" }).click();
  await expect(row.getByRole("link", { name: "Pedir feedback por WhatsApp" })).toBeVisible();
  await expect(row.getByText("Confirmar reserva por WhatsApp", { exact: true })).toHaveCount(0);
});

// Synthetic regressions for the reported names; no Production records are read.
for (const scenario of [
  { name: "Ana Raquel", type: "reservation_deposit", received: 110, price: 550, label: "Confirmar reserva por WhatsApp", text: "pagamento dos 110,00 € de sinal" },
  { name: "Alexandra", type: "legacy_payment", received: 110, price: 550, label: "Confirmar reserva por WhatsApp", text: "Temos um pagamento registado." },
  { name: "Susana", type: "legacy_payment", received: 550, price: 550, label: "Confirmar reserva por WhatsApp", text: "já se encontra totalmente liquidado" },
  { name: "Marisa", type: null, received: 0, price: 550, label: "Pedir sinal por WhatsApp", text: "Para confirmar a reserva" },
  { name: "Reserva gratuita", type: null, received: 0, price: 0, label: "Confirmar reserva por WhatsApp", text: "está confirmada" },
]) {
  for (const mobile of [false, true]) {
    test(`WhatsApp lista: ${scenario.name}, ${mobile ? "mobile" : "desktop"}`, async ({ page }) => {
      await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
      await page.clock.setFixedTime(new Date("2026-10-22T12:00:00Z"));
      const event = venueEvent({ customerName: scenario.name, amountPaid: 0,
        totalPrice: scenario.price, remainingBalance: scenario.price - scenario.received });
      await page.route("**/api/**", async route => {
        const path = new URL(route.request().url()).pathname;
        expect(route.request().method()).toBe("GET");
        if (path === "/api/venue-events") return route.fulfill({ json: [event] });
        if (path === "/api/event-payments") return route.fulfill({ json: {
          items: scenario.type ? [{ paymentType: scenario.type, amount: scenario.received }] : [],
          summary: { totalPrice: scenario.price, received: scenario.received,
            remainingBalance: scenario.price - scenario.received, historicalOverpayment: 0,
            paymentStatus: scenario.received ? "partial" : "unpaid", expectedDeposit: 110,
            depositReceived: scenario.type === "reservation_deposit" ? 110 : 0, depositRemaining: 0 },
        } });
        return route.fulfill({ json: [] });
      });
      await page.goto("/venue-events-search-test.html");
      const link = page.getByRole("link", { name: scenario.label, exact: true });
      await expect(link).toBeVisible();
      const message = new URL((await link.getAttribute("href"))!).searchParams.get("text")!;
      expect(message).toContain(scenario.text);
      if (scenario.type === "legacy_payment") expect(message).not.toContain("de sinal");
      if (!scenario.received) expect(message).not.toMatch(/Temos um pagamento|Já recebemos|totalmente liquidado/);
      if (scenario.price === 0) expect(message).not.toMatch(/pagamento|sinal|liquid|numerário/i);
      await expect(page.getByRole("link", { name: "WhatsApp", exact: true })).toHaveCount(0);
      await expect(page.getByRole("link", { name: "Pedir feedback por WhatsApp" })).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      if (scenario.name === "Alexandra") await page.screenshot({ path: `test-results/venue-whatsapp-${mobile ? "mobile" : "desktop"}.png`, fullPage: true });
    });
  }
}

test("WhatsApp lista: erro nunca revela fallback e permite repetir consulta", async ({ page }) => {
  let fail = true;
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/venue-events") return route.fulfill({ json: [venueEvent({})] });
    if (path === "/api/event-payments") {
      if (fail) return route.fulfill({ status: 500, json: {} });
      return route.fulfill({ json: { items: [], summary: { totalPrice: 550, received: 0 } } });
    }
    return route.fulfill({ json: [] });
  });
  await page.goto("/venue-events-search-test.html");
  await expect(page.getByRole("button", { name: "Voltar a verificar pagamentos" })).toBeVisible();
  await expect(page.getByRole("link", { name: "WhatsApp", exact: true })).toHaveCount(0);
  fail = false;
  await page.getByRole("button", { name: "Voltar a verificar pagamentos" }).click();
  await expect(page.getByRole("link", { name: "Pedir sinal por WhatsApp" })).toBeVisible();
});

test("WhatsApp lista: carregamento e telefone inválido nunca usam mensagem antiga", async ({ page }) => {
  let release!: () => void;
  const ready = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/venue-events") return route.fulfill({ json: [venueEvent({ phone: "12345", amountPaid: 0 })] });
    if (path === "/api/event-payments") {
      await ready;
      return route.fulfill({ json: { items: [], summary: { totalPrice: 550, received: 0 } } });
    }
    return route.fulfill({ json: [] });
  });
  await page.goto("/venue-events-search-test.html");
  await expect(page.getByRole("button", { name: "A verificar…" })).toBeDisabled();
  await expect(page.getByRole("link", { name: /WhatsApp/ })).toHaveCount(0);
  release();
  await expect(page.getByRole("button", { name: "Pedir sinal por WhatsApp" })).toBeDisabled();
  await expect(page.getByRole("link", { name: /WhatsApp/ })).toHaveCount(0);
});
