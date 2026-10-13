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

test("sinal ativo, mesmo com paid_at NULL, mostra confirmação preenchida", async ({
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
    name: "Enviar confirmação por WhatsApp",
  });
  await expect(link).toBeVisible();

  const href = await link.getAttribute("href");
  expect(href).toBeTruthy();
  expect(href).toContain("https://wa.me/351912345678?text=");

  const message = decodeURIComponent(href!.split("?text=")[1]);
  expect(message).toContain("Olá Cátia 😊");
  expect(message).toContain("A reserva da festa da Kelly está confirmada 🎉");
  expect(message).toContain("📅 5 de novembro");
  expect(message).toContain("🕓 16h às 19h");
  expect(message).toContain("às 15h30");
  expect(message).toContain("ficando 440,00 € por liquidar");
});

test("telefone inválido mantém ação desativada e explica motivo", async ({
  page,
}) => {
  await mockPayments(page, [payment()], {
    totalPrice: 550,
    received: 110,
    remainingBalance: 440,
    paymentStatus: "partial",
  });

  await page.goto(
    "/event-payments-test.html?module=venue_events&eventDate=2026-11-05&phone=12345",
  );

  await expect(
    page.getByRole("button", { name: "Enviar confirmação por WhatsApp" }),
  ).toBeDisabled();
  await expect(
    page.getByText(
      "Adicione um número de telefone português válido para enviar a confirmação.",
      { exact: true },
    ),
  ).toBeVisible();
});

test("sem sinal reservation_deposit não apresenta botão de confirmação", async ({
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
    page.getByText("Enviar confirmação por WhatsApp", { exact: true }),
  ).toHaveCount(0);
});

test("festa totalmente paga gera mensagem sem saldo por liquidar", async ({
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
    .getByRole("link", { name: "Enviar confirmação por WhatsApp" })
    .getAttribute("href");
  const message = decodeURIComponent(href!.split("?text=")[1]);

  expect(message).toContain("já se encontra totalmente liquidado");
  expect(message).not.toContain("por liquidar");
});
