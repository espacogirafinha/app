import { expect, test } from "@playwright/test";

const operationalCategory = "11111111-1111-4111-8111-111111111111";
const investmentCategory = "22222222-2222-4222-8222-222222222222";

const rows = [
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    expenseDate: "2026-10-05",
    description: "Despesa operacional teste",
    amount: 500,
    categoryId: operationalCategory,
    categoryName: "Operacional",
    expenseType: "operational",
    supplier: null,
    notes: null,
    venueEventId: null,
    venueEventLabel: null,
    eventLinks: [],
    createdAt: "2026-10-05T10:00:00.000Z",
    updatedAt: "2026-10-05T10:00:00.000Z",
  },
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    expenseDate: "2026-10-10",
    description: "Investimento teste",
    amount: 100,
    categoryId: investmentCategory,
    categoryName: "Equipamento",
    expenseType: "investment",
    supplier: null,
    notes: null,
    venueEventId: null,
    venueEventLabel: null,
    eventLinks: [],
    createdAt: "2026-10-10T10:00:00.000Z",
    updatedAt: "2026-10-10T10:00:00.000Z",
  },
];

test("Despesas: cartões de resumo filtram a lista sem alterar os totais", async ({ page }) => {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname === "/api/settings/expense-categories") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { id: operationalCategory, name: "Operacional", isActive: true, sortOrder: 10, createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z" },
          { id: investmentCategory, name: "Equipamento", isActive: true, sortOrder: 20, createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z" },
        ]),
      });
    }

    if (url.pathname === "/api/venue-events" || url.pathname === "/api/external-events") {
      return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    }

    if (url.pathname === "/api/expenses") {
      const expenseType = url.searchParams.get("expenseType");
      const filtered = expenseType
        ? rows.filter((row) => row.expenseType === expenseType)
        : rows;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(filtered) });
    }

    return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  });

  await page.goto("/expenses-flow-test.html");

  const typeFilter = page.locator("label").filter({ hasText: /^Tipo$/ }).locator("xpath=..").getByRole("combobox").first();
  const operationalCard = page.getByRole("button", { name: /Operacionais/ });
  const investmentCard = page.getByRole("button", { name: /Investimentos/ });

  await expect(operationalCard).toContainText("500,00");
  await expect(investmentCard).toContainText("100,00");
  await expect(page.getByText("600,00 €").first()).toBeVisible();

  await operationalCard.click();
  await expect(typeFilter).toContainText("Despesa operacional");
  await expect(operationalCard).toHaveAttribute("aria-pressed", "true");
  await expect(investmentCard).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByText("Despesa operacional teste", { exact: true })).toBeVisible();
  await expect(page.getByText("Investimento teste", { exact: true })).toHaveCount(0);
  await expect(operationalCard).toContainText("500,00");
  await expect(investmentCard).toContainText("100,00");

  await operationalCard.click();
  await expect(typeFilter).toContainText("Todos");
  await expect(operationalCard).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByText("Investimento teste", { exact: true })).toBeVisible();

  await investmentCard.click();
  await expect(typeFilter).toContainText("Investimento / Equipamento");
  await expect(investmentCard).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Investimento teste", { exact: true })).toBeVisible();
  await expect(page.getByText("Despesa operacional teste", { exact: true })).toHaveCount(0);
  await expect(operationalCard).toContainText("500,00");
  await expect(investmentCard).toContainText("100,00");

  await typeFilter.click();
  await page.getByRole("option", { name: "Todos" }).click();
  await expect(investmentCard).toHaveAttribute("aria-pressed", "false");

  await page.setViewportSize({ width: 390, height: 844 });
  const box = await operationalCard.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(64);
  await operationalCard.click();
  await expect(typeFilter).toContainText("Despesa operacional");
  await expect(operationalCard).toHaveAttribute("aria-pressed", "true");
});
