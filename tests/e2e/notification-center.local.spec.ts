import { expect, test, type Page, type Route } from "@playwright/test";

type PushScenario =
  | "success"
  | "denied"
  | "registration-fail"
  | "ready-timeout"
  | "config-false"
  | "subscribe-fail"
  | "save-fail"
  | "existing-subscription";

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

async function installBrowserPushMock(page: Page, scenario: PushScenario) {
  await page.addInitScript(({ scenario }) => {
    let permission: NotificationPermission = scenario === "denied" ? "denied" : "default";
    let currentSubscription: PushSubscription | null = null;
    const calls = {
      requestPermission: 0,
      register: 0,
      getSubscription: 0,
      subscribe: 0,
      saved: 0,
      usedExisting: false,
    };

    const makeSubscription = (suffix: string) =>
      ({
        endpoint: `https://push.example.test/${suffix}`,
        expirationTime: null,
        options: {
          userVisibleOnly: true,
          applicationServerKey: null,
        },
        getKey: () => null,
        unsubscribe: async () => true,
        toJSON: () => ({
          endpoint: `https://push.example.test/${suffix}`,
          keys: {
            p256dh: "p".repeat(32),
            auth: "a".repeat(16),
          },
        }),
      }) as unknown as PushSubscription;

    if (scenario === "existing-subscription") {
      currentSubscription = makeSubscription("existing");
      calls.usedExisting = true;
    }

    const pushManager = {
      getSubscription: async () => {
        calls.getSubscription += 1;
        return currentSubscription;
      },
      subscribe: async () => {
        calls.subscribe += 1;
        if (scenario === "subscribe-fail") throw new Error("subscribe failed");
        currentSubscription = makeSubscription("created");
        return currentSubscription;
      },
      permissionState: async () => permission,
    } as unknown as PushManager;

    const registration = {
      active: scenario === "ready-timeout" ? null : {},
      installing: null,
      waiting: null,
      pushManager,
      scope: location.origin + "/",
      unregister: async () => true,
      update: async () => registration,
      addEventListener: () => {},
      removeEventListener: () => {},
    } as unknown as ServiceWorkerRegistration;

    const serviceWorker = {
      controller: {},
      getRegistration: async () =>
        scenario === "registration-fail" ? undefined : registration,
      register: async () => {
        calls.register += 1;
        if (scenario === "registration-fail") throw new Error("registration failed");
        return registration;
      },
      ready:
        scenario === "ready-timeout"
          ? new Promise<ServiceWorkerRegistration>(() => {})
          : Promise.resolve(registration),
      addEventListener: () => {},
      removeEventListener: () => {},
    };

    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: serviceWorker,
    });
    Object.defineProperty(window, "PushManager", {
      configurable: true,
      value: function PushManagerMock() {},
    });
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: {
        get permission() {
          return permission;
        },
        requestPermission: async () => {
          calls.requestPermission += 1;
          permission = scenario === "denied" ? "denied" : "granted";
          return permission;
        },
      },
    });
    Object.defineProperty(window, "__pushTest", {
      configurable: true,
      value: calls,
    });
  }, { scenario });
}

async function installApiMock(page: Page, scenario: PushScenario) {
  const state = { reads: [] as string[], readAll: 0, saves: 0 };
  await page.route("**/api/**", async (route: Route) => {
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
    if (url.pathname === "/api/push-config" && method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          configured: scenario !== "config-false",
          publicKey:
            scenario === "config-false"
              ? ""
              : "B".repeat(87),
        }),
      });
    }
    if (url.pathname === "/api/push-subscriptions" && method === "POST") {
      state.saves += 1;
      if (scenario === "save-fail") {
        return route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "save failed" }),
        });
      }
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    }
    return route.continue();
  });
  return state;
}

async function openCenter(page: Page) {
  await page.goto("/notification-center-test.html");
  await page.getByRole("button", { name: /Notificações: 2 por ler/ }).click();
}

async function clickEnable(page: Page) {
  await page
    .getByRole("button", { name: /Ativar notificações neste dispositivo|Tentar novamente/ })
    .click();
}

test("permission default -> granted -> ativa e guarda subscription", async ({ page }) => {
  await installBrowserPushMock(page, "success");
  const api = await installApiMock(page, "success");
  await openCenter(page);
  await clickEnable(page);

  await expect(page.getByText("Notificações ativas neste dispositivo")).toBeVisible();
  await expect.poll(() => api.saves).toBe(1);
  const calls = await page.evaluate(() => (window as any).__pushTest);
  expect(calls.requestPermission).toBe(1);
  expect(calls.subscribe).toBe(1);
});

test("permission denied -> blocked sem novo pedido", async ({ page }) => {
  await installBrowserPushMock(page, "denied");
  await installApiMock(page, "denied");
  await openCenter(page);

  await expect(page.getByText("Permissão bloqueada no browser")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Ativar notificações neste dispositivo" }),
  ).toHaveCount(0);
  const calls = await page.evaluate(() => (window as any).__pushTest);
  expect(calls.requestPermission).toBe(0);
});

test("falha ao registar service worker mostra erro e retry", async ({ page }) => {
  await installBrowserPushMock(page, "registration-fail");
  await installApiMock(page, "registration-fail");
  await openCenter(page);
  await clickEnable(page);

  await expect(page.getByRole("alert")).toContainText(
    "Não foi possível preparar as notificações.",
  );
  await expect(page.getByRole("button", { name: "Tentar novamente" })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText(
    "Fecha e volta a abrir a app e tenta novamente.",
  );
});

test("serviceWorker.ready sem resolver termina com timeout e erro visível", async ({ page }) => {
  test.setTimeout(30_000);
  await installBrowserPushMock(page, "ready-timeout");
  await installApiMock(page, "ready-timeout");
  await openCenter(page);
  await clickEnable(page);

  await expect(page.getByRole("alert")).toContainText(
    "Não foi possível preparar as notificações.",
    { timeout: 12_000 },
  );
  await expect(page.getByRole("button", { name: "Tentar novamente" })).toBeVisible();
});

test("push-config configured=false mostra indisponibilidade", async ({ page }) => {
  await installBrowserPushMock(page, "config-false");
  await installApiMock(page, "config-false");
  await openCenter(page);
  await clickEnable(page);

  await expect(page.getByRole("alert")).toContainText(
    "As notificações estão temporariamente indisponíveis.",
  );
});

test("subscribe falha mostra erro específico", async ({ page }) => {
  await installBrowserPushMock(page, "subscribe-fail");
  await installApiMock(page, "subscribe-fail");
  await openCenter(page);
  await clickEnable(page);

  await expect(page.getByRole("alert")).toContainText(
    "Não foi possível criar a subscrição de notificações.",
  );
});

test("falha ao guardar na API mostra erro e liberta botão", async ({ page }) => {
  await installBrowserPushMock(page, "save-fail");
  const api = await installApiMock(page, "save-fail");
  await openCenter(page);
  await clickEnable(page);

  await expect(page.getByRole("alert")).toContainText(
    "A subscrição não ficou guardada.",
  );
  await expect(page.getByRole("button", { name: "Tentar novamente" })).toBeEnabled();
  expect(api.saves).toBe(1);
});

test("subscription já existente é reutilizada e persistida sem subscribe novo", async ({ page }) => {
  await installBrowserPushMock(page, "existing-subscription");
  const api = await installApiMock(page, "existing-subscription");
  await openCenter(page);
  await clickEnable(page);

  await expect(page.getByText("Notificações ativas neste dispositivo")).toBeVisible();
  await expect.poll(() => api.saves).toBe(1);
  const calls = await page.evaluate(() => (window as any).__pushTest);
  expect(calls.usedExisting).toBe(true);
  expect(calls.subscribe).toBe(0);
});

test("desktop: centro mantém badge, lista, marcar todas e deep link", async ({ page }) => {
  await installBrowserPushMock(page, "success");
  const state = await installApiMock(page, "success");
  await openCenter(page);

  await expect(page.getByText("Nova reserva recebida")).toBeVisible();
  await expect(page.getByText("Novo pedido precisa de revisão")).toBeVisible();
  await page.getByRole("button", { name: /Marcar todas/ }).click();
  expect(state.readAll).toBe(1);

  await page.getByText("Nova reserva recebida").click();
  await expect.poll(() => state.reads.length).toBe(1);
  await expect(page).toHaveURL(/\/venue-events\?open=00000000-0000-4000-8000-000000000021$/);
});

test("mobile 390x844 mantém ativação e painel sem overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installBrowserPushMock(page, "success");
  await installApiMock(page, "success");
  await openCenter(page);
  await expect(page.getByText("Nova reserva recebida")).toBeVisible();
  await clickEnable(page);
  await expect(page.getByText("Notificações ativas neste dispositivo")).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
