import { expect, test } from "@playwright/test";

// This suite mounts the real App/Router/AuthProvider on /follow-up, not the
// isolated follow-up-test.html harness. Only the external auth/API services
// are intercepted; browser transport and authentication remain real.
const eventId = "11111111-1111-4111-8111-111111111111";
const accessToken = [
  Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"),
  Buffer.from(JSON.stringify({
    sub: "22222222-2222-4222-8222-222222222222",
    role: "authenticated", aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 3600,
  })).toString("base64url"),
  "isolated-playwright-signature",
].join(".");

async function loginViaAuthProvider(page: import("@playwright/test").Page, browserName: string) {
  if (browserName === "webkit") {
    // Safari-like return visit: AuthProvider reads the same persisted
    // Supabase session as on a normal signed-in Production browser.
    const session = {
      access_token: accessToken,
      refresh_token: "isolated-playwright-refresh",
      token_type: "bearer", expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: {
        id: "22222222-2222-4222-8222-222222222222",
        aud: "authenticated", role: "authenticated",
        email: "playwright@example.invalid",
        app_metadata: { provider: "email", providers: ["email"] },
        user_metadata: {}, created_at: "2026-10-01T00:00:00Z",
      },
    };
    await page.addInitScript(value => {
      localStorage.setItem("sb-127-auth-token", JSON.stringify(value));
      localStorage.setItem("sb-127.0.0.1-auth-token", JSON.stringify(value));
    }, session);
    await page.goto("/follow-up");
    await expect(page.getByRole("heading", { name: "Acompanhamento" })).toBeVisible();
    return;
  }
  await page.route("**/auth/v1/token?grant_type=password", async route => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({
        access_token: accessToken,
        refresh_token: "isolated-playwright-refresh",
        token_type: "bearer",
        expires_in: 3600,
        user: {
          id: "22222222-2222-4222-8222-222222222222",
          aud: "authenticated", role: "authenticated",
          email: "playwright@example.invalid",
          app_metadata: { provider: "email", providers: ["email"] },
          user_metadata: {}, created_at: "2026-10-01T00:00:00Z",
        },
      }),
    });
  });
  await page.goto("/follow-up");
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
  await page.getByLabel("Email").fill("playwright@example.invalid");
  await page.getByLabel("Palavra-passe").fill("isolated-test-password");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Acompanhamento" })).toBeVisible();
}

function response(preparation: { invitationsDone: boolean; materialsDone: boolean }) {
  const pending = !(preparation.invitationsDone && preparation.materialsDone);
  return {
    preparations: pending ? [{
      id: eventId, customerName: "Ana", birthdayChildName: "Matilde",
      phone: "912000000", eventDate: "2026-11-15",
      theme: "Princesas", packName: "Premium", daysRemaining: 25,
      ...preparation,
    }] : [],
    reactivations: [], preparationCount: Number(pending), contactCount: 0,
    campaign: { offer_type: "none", offer_description: "", offer_value: null, offer_scope: "both" },
  };
}

test("real SPA AuthProvider: PATCH invitations/materials on 204 and refetch, including undo", async ({ page, browserName }) => {
  const state = { invitationsDone: false, materialsDone: false };
  const writes: Array<{ path: string; auth: string | undefined; body: unknown }> = [];
  let reads = 0;

  await page.context().route("**/*", async route => {
    if (!new URL(route.request().url()).pathname.startsWith("/api/follow-up")) return route.continue();
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === "PATCH") {
      writes.push({
        path, auth: request.headers()["authorization"],
        body: request.postDataJSON(),
      });
      const body = request.postDataJSON() as { field: "invitations" | "materials"; done: boolean };
      if (body.field === "invitations") state.invitationsDone = body.done;
      else state.materialsDone = body.done;
      return route.fulfill({ status: 204, body: "" });
    }
    if (request.method() !== "GET") return route.fulfill({ status: 405 });
    reads++;
    return route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify(response(state)),
    });
  });

  await loginViaAuthProvider(page, browserName);
  await expect(page.getByText("Preparação de festas (1)")).toBeVisible();
  const invitations = page.getByRole("checkbox", { name: "Convites tratados" });
  const materials = page.getByRole("checkbox", { name: "Material tratado" });
  await expect(invitations).not.toBeChecked();
  await expect(materials).not.toBeChecked();

  await invitations.click();
  await expect(invitations).toBeChecked();
  await materials.click();
  await expect(page.getByText("Preparação de festas (0)")).toBeVisible();
  // Reopen the pending item by undoing before completing both, in a fresh
  // refetch. This tests both directions without writing to Production.
  await expect.poll(() => reads).toBeGreaterThanOrEqual(3);

  // The last completion removes the card, so we revisit the same locally
  // mocked booking after resetting the second field and triggering an API GET.
  state.materialsDone = false;
  await page.getByRole("button", { name: "Atualizar" }).click();
  await expect(materials).not.toBeChecked();
  await invitations.click();
  await expect(invitations).not.toBeChecked();
  await materials.click();
  await expect(materials).toBeChecked();
  await materials.click();
  await expect(materials).not.toBeChecked();

  expect(writes.map(w => ({ path: w.path, body: w.body }))).toEqual([
    { path: `/api/follow-up/preparation/${eventId}`, body: { field: "invitations", done: true } },
    { path: `/api/follow-up/preparation/${eventId}`, body: { field: "materials", done: true } },
    { path: `/api/follow-up/preparation/${eventId}`, body: { field: "invitations", done: false } },
    { path: `/api/follow-up/preparation/${eventId}`, body: { field: "materials", done: true } },
    { path: `/api/follow-up/preparation/${eventId}`, body: { field: "materials", done: false } },
  ]);
  expect(writes.every(w => w.auth === `Bearer ${accessToken}`)).toBe(true);
  expect(reads).toBeGreaterThanOrEqual(6);
});

test("real SPA: without an authenticated session the route is blocked before API calls", async ({ page }) => {
  const requests: string[] = [];
  await page.context().route("**/*", async route => {
    if (!new URL(route.request().url()).pathname.startsWith("/api/follow-up")) return route.continue();
    requests.push(route.request().method());
    return route.fulfill({ status: 401, body: "{}" });
  });
  await page.goto("/follow-up");
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Convites tratados" })).toHaveCount(0);
  expect(requests).toEqual([]);
});

test("real SPA: failed PATCH preserves HTTP status in the UI and console", async ({ page, browserName }) => {
  const errors: string[] = [];
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.context().route("**/*", async route => {
    if (!new URL(route.request().url()).pathname.startsWith("/api/follow-up")) return route.continue();
    if (route.request().method() === "PATCH") return route.fulfill({
      status: 503, contentType: "application/json", body: JSON.stringify({ error: "temporarily unavailable" }),
    });
    return route.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify(response({ invitationsDone: false, materialsDone: false })) });
  });
  await loginViaAuthProvider(page, browserName);
  await page.getByRole("checkbox", { name: "Convites tratados" }).click();
  await expect(page.getByText("Não foi possível guardar a tarefa (HTTP 503).", { exact: true })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Convites tratados" })).not.toBeChecked();
  expect(errors.some(text => text.includes("[follow-up] Request failed") && text.includes("503"))).toBe(true);
});
