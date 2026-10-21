import { expect, test, type Page } from "@playwright/test";

// Real Vite SPA, real AuthProvider, real browser HTTP requests.
// External services are substituted by a Playwright-only, local dev-server fixture.
const base = "/api/integrations/google-forms/review";
const id = (n: number) => "11111111-1111-4111-8111-" + String(n).padStart(12, "0");
const linkedEventId = "99999999-9999-4999-8999-999999999999";
const accessToken = [
  Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"),
  Buffer.from(JSON.stringify({ sub: "22222222-2222-4222-8222-222222222222",
    role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url"),
  "local-test-signature",
].join(".");

async function authenticatedBrowser(page: Page) {
  const session = "forms-" + Date.now() + "-" + Math.floor(Math.random() * 1_000_000);
  await page.context().addCookies([{
    name: "google_forms_e2e_session", value: session, url: "http://127.0.0.1:4177",
  }]);
  const user = {
    id: "22222222-2222-4222-8222-222222222222", aud: "authenticated",
    role: "authenticated", email: "forms-test@example.invalid",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {}, created_at: "2026-10-01T00:00:00Z",
  };
  const auth = { access_token: accessToken, refresh_token: "local-only-refresh",
    token_type: "bearer", expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600, user };
  await page.addInitScript(value => {
    localStorage.setItem("sb-127-auth-token", JSON.stringify(value));
    localStorage.setItem("sb-127.0.0.1-auth-token", JSON.stringify(value));
  }, auth);
}

async function audit(page: Page): Promise<{
  reads: string[]; resolved: string[];
  writes: Array<{ path: string; body: { action: string; venueEventId?: string }; hasBearer: boolean; status: number }>;
}> {
  return (await (await page.request.get("/__google-forms-e2e-state")).json());
}

test("authenticated GET presents all five pending reviews with cursor pagination", async ({ page }) => {
  await authenticatedBrowser(page);
  const http: string[] = [];
  page.on("request", req => {
    if (new URL(req.url()).pathname === base) http.push(req.method() + " " + new URL(req.url()).pathname);
  });
  await page.goto("/google-forms-review");
  await expect(page.getByRole("heading", { name: "Pedidos do Formulário" })).toBeVisible();
  await expect(page.getByText("Pedido Teste 1", { exact: true })).toBeVisible();
  await expect(page.getByText("Pedido Teste 2", { exact: true })).toBeVisible();
  await expect(page.getByText("Pedido Teste 3", { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Carregar mais pedidos" }).click();
  await expect(page.getByText("Pedido Teste 4", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Carregar mais pedidos" }).click();
  await expect(page.getByText("Pedido Teste 5", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Carregar mais pedidos" })).toHaveCount(0);
  for (let i = 1; i <= 5; i++) {
    await expect(page.locator("#review-" + id(i))).toBeVisible();
  }
  const state = await audit(page);
  expect(state.reads).toEqual(["", "?cursor=page2", "?cursor=page3"]);
  expect(http.length).toBe(3);
  expect(http.every(request => request === "GET " + base)).toBe(true);
});

test("authenticated confirm, link and dismiss send POST bodies and refetch", async ({ page }) => {
  await authenticatedBrowser(page);
  await page.goto("/google-forms-review");
  await expect(page.locator("#review-" + id(1))).toBeVisible();

  await page.locator("#review-" + id(1)).getByRole("button", { name: "Marcar como revisto" }).click();
  await expect(page.getByText("Pedido revisto", { exact: true })).toBeVisible();
  await expect(page.locator("#review-" + id(1))).toHaveCount(0);

  const second = page.locator("#review-" + id(2));
  await expect(second).toBeVisible();
  await second.getByRole("combobox").selectOption(linkedEventId);
  await second.getByRole("button", { name: "Associar", exact: true }).click();
  await expect(page.getByText("Festa associada ao pedido", { exact: true })).toBeVisible();
  await expect(second).toHaveCount(0);

  const third = page.locator("#review-" + id(3));
  await expect(third).toBeVisible();
  await third.getByRole("button", { name: "Descartar pedido" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Descartar", exact: true }).click();
  await expect(page.getByText("Pedido descartado", { exact: true })).toBeVisible();
  await expect(third).toHaveCount(0);

  const state = await audit(page);
  expect(state.writes.map(row => ({
    path: row.path, body: row.body, status: row.status,
  }))).toEqual([
    { path: base + "/" + id(1) + "/resolve", body: { action: "confirm" }, status: 200 },
    { path: base + "/" + id(2) + "/resolve",
      body: { action: "link", venueEventId: linkedEventId }, status: 200 },
    { path: base + "/" + id(3) + "/resolve", body: { action: "dismiss" }, status: 200 },
  ]);
  expect(state.writes.every(row => row.hasBearer)).toBe(true);
  expect(state.reads.length).toBeGreaterThanOrEqual(4);
});

test("HTTP 409 and 422 preserve specific conflict and mismatch messages", async ({ page }) => {
  await authenticatedBrowser(page);
  await page.context().addCookies([{
    name: "google_forms_e2e_error", value: "409", url: "http://127.0.0.1:4177",
  }]);
  await page.goto("/google-forms-review");
  await expect(page.locator("#review-" + id(1))).toBeVisible();
  await page.locator("#review-" + id(1)).getByRole("button", { name: "Marcar como revisto" }).click();
  await expect(page.getByText("Este pedido já foi resolvido. Atualiza a lista.", { exact: true })).toBeVisible();

  await page.context().addCookies([{
    name: "google_forms_e2e_error", value: "422", url: "http://127.0.0.1:4177",
  }]);
  const second = page.locator("#review-" + id(2));
  await second.getByRole("combobox").selectOption(linkedEventId);
  await second.getByRole("button", { name: "Associar", exact: true }).click();
  await expect(page.getByText("A festa escolhida não corresponde à data e telefone do formulário.", { exact: true })).toBeVisible();

  const state = await audit(page);
  expect(state.writes.map(row => row.status)).toEqual([409, 422]);
  expect(state.writes.every(row => row.hasBearer)).toBe(true);
  expect(state.resolved).toEqual([]);
});

test("unauthenticated browser is redirected to login without requesting reviews", async ({ page }) => {
  const urls: string[] = [];
  page.on("request", req => {
    if (new URL(req.url()).pathname.startsWith(base)) urls.push(req.url());
  });
  await page.goto("/google-forms-review");
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pedidos do Formulário" })).toHaveCount(0);
  expect(urls).toEqual([]);
});
