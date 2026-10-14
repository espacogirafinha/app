import { expect, test, type Page } from "@playwright/test";

const entityId = "11111111-1111-4111-8111-111111111111";

function payment(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
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
    createdAt: "2026-10-01T10:00:00.000Z",
    updatedAt: "2026-10-01T10:00:00.000Z",
    deletedAt: null,
    ...overrides,
  };
}

async function mockPayments(
  page: Page,
  items: unknown[],
  summary: {
    totalPrice: number;
    received: number;
    remainingBalance: number;
    paymentStatus: "unpaid" | "partial" | "paid";
  },
) {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname === "/api/event-payments" && request.method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items,
          summary: {
            ...summary,
            historicalOverpayment: 0,
            expectedDeposit: 110,
            depositReceived: items
              .filter(
                (item) =>
                  typeof item === "object" &&
                  item !== null &&
                  (item as Record<string, unknown>).paymentType ===
                    "reservation_deposit",
              )
              .reduce(
                (total, item) =>
                  total + Number((item as Record<string, unknown>).amount ?? 0),
                0,
              ),
            depositRemaining: 0,
          },
        }),
      });
    }

    return route.fulfill({
      status: 404,
      contentType: "application/json",
      body: "{}",
    });
  });
}

test("confirmação usa festa de [nome] e texto neutro da criança", async ({
  page,
}) => {
  await mockPayments(page, [payment({ paidAt: null })], {
    totalPrice: 550,
    received: 110,
    remainingBalance: 440,
    paymentStatus: "partial",
  });

  await page.goto(
    "/event-payments-test.html?module=venue_events&eventDate=2026-11-05",
  );

  const link = page.getByRole("link", {
    name: "Confirmar reserva por WhatsApp",
  });
  await expect(link).toBeVisible();

  const href = await link.getAttribute("href");
  expect(href).toContain("https://wa.me/351912345678?text=");

  const message = decodeURIComponent(href!.split("?text=")[1]);
  expect(message).toContain("Olá Cátia 😊");
  expect(message).toContain("A reserva da festa de Kelly está confirmada 🎉");
  expect(message).not.toContain("festa da Kelly");
  expect(message).not.toContain("festa do Kelly");
  expect(message).toContain(
    "Os pais e a criança podem chegar 30 minutos antes, às 15h30, para fazerem com calma os preparativos que forem necessários.",
  );
  expect(message).toContain("📅 5 de novembro");
  expect(message).toContain("🕓 16h às 19h");
  expect(message).toContain("ficando 440,00 € por liquidar");
});

test("feedback ainda não aparece antes do fim da festa", async ({ page }) => {
  await mockPayments(page, [payment()], {
    totalPrice: 550,
    received: 110,
    remainingBalance: 440,
    paymentStatus: "partial",
  });

  await page.goto(
    "/event-payments-test.html?module=venue_events&eventDate=2026-11-05",
  );

  await expect(
    page.getByText("Pedir feedback por WhatsApp", { exact: true }),
  ).toHaveCount(0);
});

test("feedback aparece depois do fim e inclui nomes + Google URL codificado", async ({
  page,
}) => {
  await mockPayments(page, [payment()], {
    totalPrice: 550,
    received: 110,
    remainingBalance: 440,
    paymentStatus: "partial",
  });

  await page.goto(
    "/event-payments-test.html?module=venue_events&eventDate=2026-10-01",
  );

  const link = page.getByRole("link", { name: "Pedir feedback por WhatsApp" });
  await expect(link).toBeVisible();

  const href = await link.getAttribute("href");
  expect(href).toContain("https://wa.me/351912345678?text=");
  const message = decodeURIComponent(href!.split("?text=")[1]);

  expect(message).toContain("Olá Cátia 😊");
  expect(message).toContain("gostado da festa de Kelly 💛");
  expect(message).toContain("Espaço Girafinha");
  expect(message).toContain("⭐ Deixar avaliação no Google:");
  expect(message).toContain("https://maps.app.goo.gl/ofJkUSP6iVL2YH7j7?g_st=ic");
  expect(message).toContain("este dia tão especial! 🥰");
  expect(href).toContain("%C3");
  expect(href).toContain("%F0%9F");
  expect(href).toContain("%0A");
});

test("festa antiga terminada com legacy_payment mostra confirmação segura", async ({
  page,
}) => {
  await mockPayments(
    page,
    [payment({ paymentType: "legacy_payment", amount: 110, paidAt: null })],
    {
      totalPrice: 550,
      received: 110,
      remainingBalance: 440,
      paymentStatus: "partial",
    },
  );

  await page.goto(
    "/event-payments-test.html?module=venue_events&eventDate=2026-10-01",
  );

  const confirmation = page.getByRole("link", {
    name: "Confirmar reserva por WhatsApp",
  });
  await expect(confirmation).toBeVisible();

  const href = await confirmation.getAttribute("href");
  const message = decodeURIComponent(href!.split("?text=")[1]);
  expect(message).toContain(
    "Temos um pagamento registado. A reserva da festa de Kelly está confirmada 🎉",
  );
  expect(message).not.toContain("de sinal");
  expect(message).not.toContain("pagamento dos 110,00 €");
});

test("festa antiga sem qualquer pagamento não mostra confirmação", async ({
  page,
}) => {
  await mockPayments(page, [], {
    totalPrice: 550,
    received: 0,
    remainingBalance: 550,
    paymentStatus: "unpaid",
  });

  await page.goto(
    "/event-payments-test.html?module=venue_events&eventDate=2026-10-01",
  );

  await expect(
    page.getByText("Confirmar reserva por WhatsApp", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Pedir feedback por WhatsApp" }),
  ).toBeVisible();
});

test("festa antiga elegível mostra confirmação e feedback simultaneamente", async ({
  page,
}) => {
  await mockPayments(
    page,
    [payment({ paymentType: "legacy_payment", amount: 110, paidAt: null })],
    {
      totalPrice: 550,
      received: 110,
      remainingBalance: 440,
      paymentStatus: "partial",
    },
  );

  await page.goto(
    "/event-payments-test.html?module=venue_events&eventDate=2026-10-01",
  );

  await expect(
    page.getByRole("link", { name: "Confirmar reserva por WhatsApp" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Pedir feedback por WhatsApp" }),
  ).toBeVisible();
});

test("telefone inválido desativa confirmação e feedback quando aplicável", async ({
  page,
}) => {
  await mockPayments(page, [payment()], {
    totalPrice: 550,
    received: 110,
    remainingBalance: 440,
    paymentStatus: "partial",
  });

  await page.goto(
    "/event-payments-test.html?module=venue_events&eventDate=2026-10-01&phone=12345",
  );

  await expect(
    page.getByRole("button", { name: "Confirmar reserva por WhatsApp" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Pedir feedback por WhatsApp" }),
  ).toBeDisabled();
  await expect(
    page.getByText(
      "Adicione um número de telefone português válido para usar o WhatsApp.",
      { exact: true },
    ),
  ).toBeVisible();
});

test("sem sinal reservation_deposit não apresenta confirmação", async ({
  page,
}) => {
  await mockPayments(
    page,
    [payment({ paymentType: "payment", amount: 110, paidAt: null })],
    {
      totalPrice: 550,
      received: 110,
      remainingBalance: 440,
      paymentStatus: "partial",
    },
  );

  await page.goto(
    "/event-payments-test.html?module=venue_events&eventDate=2026-11-05",
  );

  await expect(
    page.getByText("Confirmar reserva por WhatsApp", { exact: true }),
  ).toHaveCount(0);
});

test("festa totalmente paga gera confirmação sem saldo pendente", async ({
  page,
}) => {
  await mockPayments(
    page,
    [
      payment(),
      payment({
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        paymentType: "payment",
        amount: 440,
        paidAt: "2026-10-15T10:00:00.000Z",
      }),
    ],
    {
      totalPrice: 550,
      received: 550,
      remainingBalance: 0,
      paymentStatus: "paid",
    },
  );

  await page.goto(
    "/event-payments-test.html?module=venue_events&eventDate=2026-11-05",
  );

  const href = await page
    .getByRole("link", { name: "Confirmar reserva por WhatsApp" })
    .getAttribute("href");
  const message = decodeURIComponent(href!.split("?text=")[1]);

  expect(message).toContain("já se encontra totalmente liquidado");
  expect(message).not.toContain("por liquidar");
});

test("mobile 390x844 mostra as duas ações sem overflow depois da festa", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockPayments(
    page,
    [payment({ paymentType: "legacy_payment", amount: 110, paidAt: null })],
    {
      totalPrice: 550,
      received: 110,
      remainingBalance: 440,
      paymentStatus: "partial",
    },
  );

  await page.goto(
    "/event-payments-test.html?module=venue_events&eventDate=2026-10-01",
  );

  await expect(
    page.getByRole("link", { name: "Confirmar reserva por WhatsApp" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Pedir feedback por WhatsApp" }),
  ).toBeVisible();
  await expect(
    page.getByText("Copiar mensagem", { exact: true }),
  ).toHaveCount(0);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);

  await page.screenshot({
    path: "test-results/whatsapp-buttons-preview.png",
    fullPage: true,
  });
});
