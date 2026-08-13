import { expect, test } from "@playwright/test";

import { monitorCriticalBrowserErrors } from "./helpers/browser-errors";

const routes = [
  { path: "/dashboard", heading: "Painel de gest\u00e3o" },
  { path: "/venue-events", heading: "Festas no Espa\u00e7o" },
  { path: "/external-events", heading: "Servi\u00e7os Externos" },
  { path: "/workshops", heading: "Workshops/Forma\u00e7\u00f5es" },
  { path: "/calendar", heading: "Calend\u00e1rio V2" },
  { path: "/reports", heading: "Relat\u00f3rios" },
  { path: "/settings", heading: "Defini\u00e7\u00f5es" },
] as const;

for (const route of routes) {
  test(`${route.path} carrega sem erros criticos`, async ({
    page,
  }, testInfo) => {
    const assertNoCriticalErrors = monitorCriticalBrowserErrors(page, testInfo);

    await page.goto(route.path);
    await expect(
      page.getByRole("heading", { name: route.heading }),
    ).toBeVisible();

    await assertNoCriticalErrors();
  });
}

test("/reservations carrega sem mojibake nem erros criticos", async ({
  page,
}, testInfo) => {
  const assertNoCriticalErrors = monitorCriticalBrowserErrors(page, testInfo);

  await page.goto("/reservations");
  await expect(
    page.getByRole("heading", { name: "Reservas", exact: true }),
  ).toBeVisible();

  const visibleText = await page.locator("body").innerText();
  expect(visibleText).not.toMatch(
    /[\u00c2\u00c3\ufffd]|\u00e2(?:\u201a|\u20ac)/,
  );

  await assertNoCriticalErrors();
});
