import { expect, test } from "@playwright/test";

test("desktop: preparação e dois contactos visíveis sem consultar API real", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/**", async route => {
    calls++;
    return route.fulfill({ status: 403, contentType: "application/json", body: "{}" });
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/follow-up-test.html?demo=1");
  await expect(page.getByRole("heading", { name: "Acompanhamento" })).toBeVisible();
  await expect(page.getByText("Demonstração com dados fictícios.", { exact: false })).toBeVisible();
  await expect(page.getByText("Preparação de festas (2)")).toBeVisible();
  await expect(page.getByText("Reativação de clientes (2 por contactar)")).toBeVisible();
  await expect(page.getByText("1.º contacto pendente")).toBeVisible();
  await expect(page.getByText("2.º contacto pendente")).toBeVisible();
  await expect(page.getByText("Convites tratados").first()).toBeVisible();
  await expect(page.getByText("Material tratado").first()).toBeVisible();
  expect(calls).toBe(0);
});

test("mobile 390×844: cartões, ofertas e ações sem overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/follow-up-test.html?demo=1");
  await expect(page.getByRole("heading", { name: "Acompanhamento" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Abrir WhatsApp" }).first()).toBeDisabled();
  await expect(page.getByText("Pequeno mimo na festa").first()).toBeVisible();
  const width = await page.evaluate(() => ({
    viewport: window.innerWidth,
    html: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(width.html).toBeLessThanOrEqual(width.viewport);
  expect(width.body).toBeLessThanOrEqual(width.viewport);
});

test("demo read-only: no real data changes from controls", async ({ page }) => {
  let writes = 0;
  await page.route("**/api/**", async route => {
    if (route.request().method() !== "GET") writes++;
    await route.fulfill({ status: 403, contentType: "application/json", body: "{}" });
  });
  await page.goto("/follow-up-test.html?demo=1");
  await expect(page.getByRole("button", { name: "Marcar como contactado" }).first()).toBeDisabled();
  await expect(page.getByRole("button", { name: "Abrir festa" }).first()).toBeDisabled();
  await expect(page.getByText("Marcar sem interesse").first()).toBeDisabled();
  expect(writes).toBe(0);
});
