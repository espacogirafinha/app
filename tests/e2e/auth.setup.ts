import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import { expect, test as setup } from "@playwright/test";

import { monitorCriticalBrowserErrors } from "./helpers/browser-errors";
import { requireE2EEnv } from "./helpers/env";

const authStatePath = "test-results/e2e/.auth/user.json";

setup("autenticar com a conta E2E", async ({ page }, testInfo) => {
  const assertNoCriticalErrors = monitorCriticalBrowserErrors(page, testInfo);
  const email = requireE2EEnv("E2E_EMAIL");
  const password = requireE2EEnv("E2E_PASSWORD");

  await page.goto("/");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Palavra-passe").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(
    page.getByRole("heading", { name: "Painel de gest\u00e3o" }),
  ).toBeVisible();
  await mkdir(dirname(authStatePath), { recursive: true });
  await page.context().storageState({ path: authStatePath });
  await assertNoCriticalErrors();
});
