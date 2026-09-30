import { expect, test } from "@playwright/test";
import { formControl } from "./helpers/transactions";

const foodCategory = "11111111-1111-4111-8111-111111111111";
const equipmentCategory = "22222222-2222-4222-8222-222222222222";
const personnelCategory = "44444444-4444-4444-8444-444444444444";
const supplierCategory = "55555555-5555-4555-8555-555555555555";
const eventId = "33333333-3333-4333-8333-333333333333";

type ExpenseRow = {
  id: string;
  expenseDate: string;
  description: string;
  amount: number;
  categoryId: string;
  categoryName: string;
  expenseType: "operational" | "investment";
  supplier: string | null;
  notes: string | null;
  venueEventId: string | null;
  venueEventLabel: string | null;
  createdAt: string;
  updatedAt: string;
};

test("Despesas: criar, editar, filtrar e anular sem exigir Festa", async ({ page }) => {
  let sequence = 3;
  let rows: ExpenseRow[] = [
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      expenseDate: "2026-09-05",
      description: "Continente",
      amount: 86.4,
      categoryId: foodCategory,
      categoryName: "Supermercado / Alimentação",
      expenseType: "operational",
      supplier: "Continente",
      notes: null,
      venueEventId: null,
      venueEventLabel: null,
      createdAt: "2026-09-05T10:00:00.000Z",
      updatedAt: "2026-09-05T10:00:00.000Z",
    },
    {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      expenseDate: "2026-09-10",
      description: "Mesa redonda",
      amount: 220,
      categoryId: equipmentCategory,
      categoryName: "Equipamento / Mobiliário",
      expenseType: "investment",
      supplier: "Loja",
      notes: null,
      venueEventId: null,
      venueEventLabel: null,
      createdAt: "2026-09-10T10:00:00.000Z",
      updatedAt: "2026-09-10T10:00:00.000Z",
    },
  ];

  let lastCreateBody: Record<string, unknown> | null = null;
  let lastPatchBody: Record<string, unknown> | null = null;
  let lastDeleteId: string | null = null;
  let lastListUrl = "";

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

    if (url.pathname === "/api/settings/expense-categories" && method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { id: foodCategory, name: "Supermercado / Alimentação", isActive: true, sortOrder: 10, createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z" },
          { id: equipmentCategory, name: "Equipamento / Mobiliário", isActive: true, sortOrder: 20, createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z" },
        ]),
      });
    }

    if (url.pathname === "/api/venue-events" && method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{
          id: eventId,
          eventDate: "2026-09-20",
          customerName: "Cliente Festa",
          birthdayChildName: "Mia",
        }]),
      });
    }

    if (url.pathname === "/api/expenses" && method === "GET") {
      lastListUrl = request.url();
      const type = url.searchParams.get("expenseType");
      const categoryId = url.searchParams.get("categoryId");
      const search = url.searchParams.get("search")?.toLowerCase();
      const start = url.searchParams.get("startDate");
      const end = url.searchParams.get("endDate");
      const filtered = rows.filter((row) => (
        (!type || row.expenseType === type)
        && (!categoryId || row.categoryId === categoryId)
        && (!search || row.description.toLowerCase().includes(search) || row.supplier?.toLowerCase().includes(search))
        && (!start || row.expenseDate >= start)
        && (!end || row.expenseDate <= end)
      ));
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(filtered) });
    }

    if (url.pathname === "/api/expenses" && method === "POST") {
      lastCreateBody = request.postDataJSON();
      const body = lastCreateBody as {
        expenseDate: string; description: string; amount: number; categoryId: string;
        expenseType: "operational" | "investment"; supplier?: string | null; notes?: string | null; venueEventId?: string | null;
      };
      const categoryName = body.categoryId === foodCategory ? "Supermercado / Alimentação" : "Equipamento / Mobiliário";
      const id = `cccccccc-cccc-4ccc-8ccc-${String(sequence++).padStart(12, "0")}`;
      const created: ExpenseRow = {
        id,
        expenseDate: body.expenseDate,
        description: body.description,
        amount: body.amount,
        categoryId: body.categoryId,
        categoryName,
        expenseType: body.expenseType,
        supplier: body.supplier ?? null,
        notes: body.notes ?? null,
        venueEventId: body.venueEventId ?? null,
        venueEventLabel: body.venueEventId ? "Mia · 2026-09-20" : null,
        createdAt: "2026-09-28T10:00:00.000Z",
        updatedAt: "2026-09-28T10:00:00.000Z",
      };
      rows = [created, ...rows];
      return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(created) });
    }

    if (url.pathname.startsWith("/api/expenses/") && method === "PATCH") {
      const id = url.pathname.split("/").pop()!;
      lastPatchBody = request.postDataJSON();
      rows = rows.map((row) => row.id === id ? { ...row, ...(lastPatchBody as Partial<ExpenseRow>) } : row);
      const updated = rows.find((row) => row.id === id)!;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(updated) });
    }

    if (url.pathname.startsWith("/api/expenses/") && method === "DELETE") {
      const id = url.pathname.split("/").pop()!;
      lastDeleteId = id;
      rows = rows.filter((row) => row.id !== id);
      return route.fulfill({ status: 204, body: "" });
    }

    return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "not mocked" }) });
  });

  await page.goto("/expenses-flow-test.html");
  await expect(page.getByText("86,40 €").first()).toBeVisible();
  await expect(page.getByText("220,00 €").first()).toBeVisible();
  await expect(page.getByText("306,40 €").first()).toBeVisible();

  await page.getByRole("button", { name: "Adicionar despesa" }).click();
  const createDialog = page.getByRole("dialog", { name: "Adicionar despesa" });
  await formControl(createDialog, "Data").fill("2026-09-15");
  await formControl(createDialog, "Valor").fill("42");
  await formControl(createDialog, "Descrição").fill("Balões");

  const categoryControl = createDialog.locator("label").filter({ hasText: /^Categoria$/ }).locator("xpath=..").getByRole("combobox");
  await categoryControl.click();
  await page.getByRole("option", { name: "Supermercado / Alimentação" }).click();

  await formControl(createDialog, "Fornecedor / Loja").fill("Loja Balões");
  await createDialog.getByRole("button", { name: "Guardar", exact: true }).click();

  await expect.poll(() => lastCreateBody).not.toBeNull();
  expect(lastCreateBody).toMatchObject({
    expenseDate: "2026-09-15",
    description: "Balões",
    amount: 42,
    categoryId: foodCategory,
    expenseType: "operational",
    venueEventId: null,
  });
  await expect(page.getByText("Balões", { exact: true })).toBeVisible();

  const baloesCard = page.getByText("Balões", { exact: true }).locator("xpath=ancestor::div[contains(@class,'rounded-xl') or contains(@class,'p-3')][.//button[contains(.,'Editar')]][1]");
  await baloesCard.getByRole("button", { name: "Editar" }).click();
  const editDialog = page.getByRole("dialog", { name: "Editar despesa" });
  await formControl(editDialog, "Valor").fill("45");
  await editDialog.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect.poll(() => lastPatchBody).not.toBeNull();
  expect(lastPatchBody).toMatchObject({ amount: 45 });

  const typeFilter = page.locator("label").filter({ hasText: /^Tipo$/ }).locator("xpath=..").getByRole("combobox").first();
  await typeFilter.click();
  await page.getByRole("option", { name: "Investimento / Equipamento" }).click();
  await expect.poll(() => lastListUrl).toContain("expenseType=investment");
  await expect(page.getByText("Mesa redonda", { exact: true })).toBeVisible();
  await expect(page.getByText("Continente", { exact: true })).toHaveCount(0);

  await typeFilter.click();
  await page.getByRole("option", { name: "Todos" }).click();
  await page.getByText("Mesa redonda", { exact: true }).locator("xpath=ancestor::div[.//button[contains(.,'Anular')]][1]").getByRole("button", { name: "Anular" }).click();
  const deleteDialog = page.getByRole("dialog", { name: "Anular despesa?" });
  await deleteDialog.getByRole("button", { name: "Anular", exact: true }).click();

  await expect.poll(() => lastDeleteId).toBe("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
  await expect(page.getByText("Mesa redonda", { exact: true })).toHaveCount(0);
});


test("Despesas: Pessoal / Colaboradores aparece e fica sempre operacional", async ({ page }) => {
  let lastCreateBody: Record<string, unknown> | null = null;
  let rows: ExpenseRow[] = [];

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

    if (url.pathname === "/api/settings/expense-categories" && method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { id: supplierCategory, name: "Fornecedores / Animação", isActive: true, sortOrder: 30, createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z" },
          { id: personnelCategory, name: "Pessoal / Colaboradores", isActive: true, sortOrder: 35, createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z" },
        ]),
      });
    }

    if (url.pathname === "/api/venue-events" && method === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
    }

    if (url.pathname === "/api/expenses" && method === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(rows) });
    }

    if (url.pathname === "/api/expenses" && method === "POST") {
      lastCreateBody = request.postDataJSON();
      const body = lastCreateBody as {
        expenseDate: string;
        description: string;
        amount: number;
        categoryId: string;
        expenseType: "operational" | "investment";
      };
      const created: ExpenseRow = {
        id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        expenseDate: body.expenseDate,
        description: body.description,
        amount: body.amount,
        categoryId: body.categoryId,
        categoryName: "Pessoal / Colaboradores",
        expenseType: body.expenseType,
        supplier: null,
        notes: null,
        venueEventId: null,
        venueEventLabel: null,
        createdAt: "2026-10-01T00:00:00.000Z",
        updatedAt: "2026-10-01T00:00:00.000Z",
      };
      rows = [created];
      return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(created) });
    }

    if (url.pathname.startsWith("/api/expenses/") && method === "PATCH") {
      const body = request.postDataJSON() as Partial<ExpenseRow>;
      rows = rows.map((row) => ({ ...row, ...body }));
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(rows[0]) });
    }

    return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "not mocked" }) });
  });

  await page.goto("/expenses-flow-test.html");
  await page.getByRole("button", { name: "Adicionar despesa" }).click();

  const createDialog = page.getByRole("dialog", { name: "Adicionar despesa" });
  const categoryControl = createDialog.locator("label").filter({ hasText: /^Categoria$/ }).locator("xpath=..").getByRole("combobox");
  await categoryControl.click();
  await expect(page.getByRole("option", { name: "Pessoal / Colaboradores" })).toBeVisible();
  await expect(page.getByRole("option", { name: "Fornecedores / Animação" })).toBeVisible();
  await page.getByRole("option", { name: "Pessoal / Colaboradores" }).click();

  const typeControl = createDialog.locator("label").filter({ hasText: /^Tipo$/ }).locator("xpath=..").getByRole("combobox");
  await expect(typeControl).toBeDisabled();
  await expect(createDialog.getByText("Pessoal / Colaboradores é sempre registado como despesa operacional.", { exact: true })).toBeVisible();

  await formControl(createDialog, "Data").fill("2026-10-01");
  await formControl(createDialog, "Valor").fill("120");
  await formControl(createDialog, "Descrição").fill("Pagamento colaboradora");
  await createDialog.getByRole("button", { name: "Guardar", exact: true }).click();

  await expect.poll(() => lastCreateBody).not.toBeNull();
  expect(lastCreateBody).toMatchObject({
    categoryId: personnelCategory,
    expenseType: "operational",
    description: "Pagamento colaboradora",
    amount: 120,
  });

  const card = page.getByText("Pagamento colaboradora", { exact: true }).locator("xpath=ancestor::div[.//button[contains(.,'Editar')]][1]");
  await card.getByRole("button", { name: "Editar" }).click();
  const editDialog = page.getByRole("dialog", { name: "Editar despesa" });
  const editTypeControl = editDialog.locator("label").filter({ hasText: /^Tipo$/ }).locator("xpath=..").getByRole("combobox");
  await expect(editTypeControl).toBeDisabled();
  await expect(editDialog.getByText("Pessoal / Colaboradores é sempre registado como despesa operacional.", { exact: true })).toBeVisible();
});


test("Despesas mobile: seletor de Festa fica no viewport e permite percorrer toda a lista", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  const venueEvents = [
    {
      id: "60000000-0000-4000-8000-000000000001",
      eventDate: "2026-12-31",
      customerName: "Cliente recente",
      birthdayChildName: "Festa recente",
    },
    ...Array.from({ length: 28 }, (_, index) => ({
      id: `60000000-0000-4000-8000-${String(index + 2).padStart(12, "0")}`,
      eventDate: "2025-06-15",
      customerName: `Cliente ${index + 2}`,
      birthdayChildName: `Criança ${index + 2}`,
    })),
    {
      id: "60000000-0000-4000-8000-000000000030",
      eventDate: "2024-01-01",
      customerName: "Cliente antigo",
      birthdayChildName: "Festa antiga",
    },
  ];

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

    if (url.pathname === "/api/settings/expense-categories" && method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: foodCategory,
            name: "Supermercado / Alimentação",
            isActive: true,
            sortOrder: 10,
            createdAt: "2026-10-01T00:00:00.000Z",
            updatedAt: "2026-10-01T00:00:00.000Z",
          },
        ]),
      });
    }

    if (url.pathname === "/api/venue-events" && method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(venueEvents),
      });
    }

    if (url.pathname === "/api/expenses" && method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    }

    return route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "not mocked" }),
    });
  });

  await page.goto("/expenses-flow-test.html");
  await page.getByRole("button", { name: "Adicionar despesa" }).click();

  const createDialog = page.getByRole("dialog", { name: "Adicionar despesa" });
  const eventControl = createDialog
    .locator("label")
    .filter({ hasText: /^Associar a uma Festa$/ })
    .locator("xpath=..")
    .getByRole("combobox");

  await eventControl.scrollIntoViewIfNeeded();
  await eventControl.click();

  const listbox = page.getByRole("listbox");
  await expect(listbox).toBeVisible();
  await expect(page.getByRole("option", { name: "Sem associação" })).toBeVisible();

  const initialBox = await listbox.boundingBox();
  expect(initialBox).not.toBeNull();
  expect(initialBox!.y).toBeGreaterThanOrEqual(0);
  expect(initialBox!.y + initialBox!.height).toBeLessThanOrEqual(844);
  expect(initialBox!.height).toBeLessThanOrEqual(844 * 0.6);
  expect(await listbox.evaluate((element) => getComputedStyle(element).overflowY)).toBe("auto");

  const newest = page.getByRole("option", { name: "2026-12-31 · Festa recente" });
  await expect(newest).toBeVisible();

  const oldest = page.getByRole("option", { name: "2024-01-01 · Festa antiga" });
  await oldest.scrollIntoViewIfNeeded();
  await expect(oldest).toBeVisible();

  const scrolledBox = await listbox.boundingBox();
  expect(scrolledBox).not.toBeNull();
  expect(scrolledBox!.y).toBeGreaterThanOrEqual(0);
  expect(scrolledBox!.y + scrolledBox!.height).toBeLessThanOrEqual(844);

  await newest.scrollIntoViewIfNeeded();
  await expect(newest).toBeVisible();
});
