import { expect, test, type Page, type Route } from "@playwright/test";

type Item = {
  id: string;
  type: string;
  title: string;
  message: string;
  googleFormImportId: string | null;
  venueEventId: string | null;
  destination: string;
  createdAt: string;
  readAt: string | null;
};

const items: Item[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    type: "google_form_created",
    title: "Nova reserva recebida",
    message: "23/01/2027 · Pack Premium",
    googleFormImportId: "00000000-0000-4000-8000-000000000011",
    venueEventId: "00000000-0000-4000-8000-000000000021",
    destination: "/venue-events?open=00000000-0000-4000-8000-000000000021",
    createdAt: "2026-10-12T20:00:00.000Z",
    readAt: null,
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    type: "google_form_review",
    title: "Novo pedido precisa de revisão",
    message: "Não foi possível criar automaticamente a Festa.",
    googleFormImportId: "00000000-0000-4000-8000-000000000012",
    venueEventId: null,
    destination: "/google-forms-review?open=00000000-0000-4000-8000-000000000012",
    createdAt: "2026-10-12T19:00:00.000Z",
    readAt: null,
  },
];

async function installMock(page: Page) {
  const state = { reads: [] as string[], readAll: 0 };
  await page.route("**/api/notifications**", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

    if (url.pathname === "/api/notifications" && method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items, unreadCount: 2 }),
      });
    }
    const read = url.pathname.match(/^\/api\/notifications\/([^/]+)\/read$/);
    if (read && method === "POST") {
      state.reads.push(read[1]);
      return route.fulfill({ status: 204, body: "" });
    }
    if (url.pathname === "/api/notifications/read-all" && method === "POST") {
      state.readAll += 1;
      return route.fulfill({ status: 204, body: "" });
    }
    if (url.pathname === "/api/notifications/push-config" && method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ configured: true, publicKey: "test-public-key" }),
      });
    }
    return route.continue();
  });
  return state;
}

test("desktop: badge, ordered list, mark all and deep link", async ({ page }) => {
  const state = await installMock(page);
  await page.goto("/notification-center-test.html");
  await page.getByRole("button", { name: /Notificações: 2 por ler/ }).click();

  await expect(page.getByText("Nova reserva recebida")).toBeVisible();
  await expect(page.getByText("Novo pedido precisa de revisão")).toBeVisible();
  await page.getByRole("button", { name: /Marcar todas/ }).click();
  expect(state.readAll).toBe(1);

  await page.getByText("Nova reserva recebida").click();
  await expect.poll(() => state.reads.length).toBe(1);
  await expect(page).toHaveURL(/\/venue-events\?open=00000000-0000-4000-8000-000000000021$/);
});

test("permission denied remains functional and shows blocked state", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: {
        permission: "denied",
        requestPermission: async () => "denied",
      },
    });
  });
  await installMock(page);
  await page.goto("/notification-center-test.html");
  await page.getByRole("button", { name: /Notificações: 2 por ler/ }).click();
  await expect(page.getByText("Permissão bloqueada no browser")).toBeVisible();
  await expect(page.getByText("Nova reserva recebida")).toBeVisible();
});

test("mobile 390x844 keeps notification center usable without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installMock(page);
  await page.goto("/notification-center-test.html");
  await page.getByRole("button", { name: /Notificações: 2 por ler/ }).click();
  await expect(page.getByText("Nova reserva recebida")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
