import { expect, test, type Locator, type Page } from "@playwright/test";
import { formControl } from "./helpers/transactions";

const foodCategory = "11111111-1111-4111-8111-111111111111";
const equipmentCategory = "22222222-2222-4222-8222-222222222222";
const personnelCategory = "44444444-4444-4444-8444-444444444444";
const supplierCategory = "55555555-5555-4555-8555-555555555555";
const eventId = "33333333-3333-4333-8333-333333333333";

type ExpenseEventLinkInput = {
  eventType: "venue_event" | "external_event";
  eventId: string;
};

type ExpenseEventLinkRow = ExpenseEventLinkInput & {
  id: string;
  eventDate: string;
  customerName: string;
  birthdayChildName: string | null;
  label: string;
};

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
  eventLinks: ExpenseEventLinkRow[];
  createdAt: string;
  updatedAt: string;
};

test("Despesas: criar, editar, filtrar e anular sem exigir evento", async ({ page }) => {
  let sequence = 3;
  let rows: ExpenseRow[] = [
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      expenseDate: "2026-10-05",
      description: "Continente",
      amount: 86.4,
      categoryId: foodCategory,
      categoryName: "Supermercado / Alimentação",
      expenseType: "operational",
      supplier: "Continente",
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
      description: "Mesa redonda",
      amount: 220,
      categoryId: equipmentCategory,
      categoryName: "Equipamento / Mobiliário",
      expenseType: "investment",
      supplier: "Loja",
      notes: null,
      venueEventId: null,
      venueEventLabel: null,
      eventLinks: [],
      createdAt: "2026-10-10T10:00:00.000Z",
      updatedAt: "2026-10-10T10:00:00.000Z",
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
        body: JSON.stringify([{ id: eventId, eventDate: "2026-09-20", customerName: "Cliente Festa", birthdayChildName: "Mia" }]),
      });
    }

    if (url.pathname === "/api/external-events" && method === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
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
        expenseDate: string;
        description: string;
        amount: number;
        categoryId: string;
        expenseType: "operational" | "investment";
        supplier?: string | null;
        notes?: string | null;
        eventLinks?: ExpenseEventLinkInput[];
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
        venueEventId: null,
        venueEventLabel: null,
        eventLinks: [],
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
  await formControl(createDialog, "Data").fill("2026-10-15");
  await formControl(createDialog, "Valor").fill("42");
  await formControl(createDialog, "Descrição").fill("Balões");

  const categoryControl = createDialog.locator("label").filter({ hasText: /^Categoria$/ }).locator("xpath=..").getByRole("combobox");
  await categoryControl.click();
  await page.getByRole("option", { name: "Supermercado / Alimentação" }).click();

  await formControl(createDialog, "Fornecedor / Loja").fill("Loja Balões");
  await createDialog.getByRole("button", { name: "Guardar", exact: true }).click();

  await expect.poll(() => lastCreateBody).not.toBeNull();
  expect(lastCreateBody).toMatchObject({
    expenseDate: "2026-10-15",
    description: "Balões",
    amount: 42,
    categoryId: foodCategory,
    expenseType: "operational",
    eventLinks: [],
  });
  expect(lastCreateBody).not.toHaveProperty("venueEventId");
  await expect(page.getByText("Balões", { exact: true })).toBeVisible();

  const baloesCard = page.getByText("Balões", { exact: true }).locator("xpath=ancestor::div[contains(@class,'rounded-xl') or contains(@class,'p-3')][.//button[contains(.,'Editar')]][1]");
  await baloesCard.getByRole("button", { name: "Editar" }).click();
  const editDialog = page.getByRole("dialog", { name: "Editar despesa" });
  await formControl(editDialog, "Valor").fill("45");
  await editDialog.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect.poll(() => lastPatchBody).not.toBeNull();
  expect(lastPatchBody).toMatchObject({ amount: 45, eventLinks: [] });

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
    if (url.pathname === "/api/external-events" && method === "GET") {
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
        eventLinks?: ExpenseEventLinkInput[];
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
        eventLinks: [],
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
    eventLinks: [],
  });

  const card = page.getByText("Pagamento colaboradora", { exact: true }).locator("xpath=ancestor::div[.//button[contains(.,'Editar')]][1]");
  await card.getByRole("button", { name: "Editar" }).click();
  const editDialog = page.getByRole("dialog", { name: "Editar despesa" });
  const editTypeControl = editDialog.locator("label").filter({ hasText: /^Tipo$/ }).locator("xpath=..").getByRole("combobox");
  await expect(editTypeControl).toBeDisabled();
  await expect(editDialog.getByText("Pessoal / Colaboradores é sempre registado como despesa operacional.", { exact: true })).toBeVisible();
});

test("Despesas mobile: multi-associação, pesquisa e edição de Festas e Serviços Externos", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  const venueEvents = [
    {
      id: "60000000-0000-4000-8000-000000000001",
      eventDate: "2026-09-26",
      customerName: "Mãe da Iara",
      birthdayChildName: "Iara",
    },
    {
      id: "60000000-0000-4000-8000-000000000002",
      eventDate: "2026-09-27",
      customerName: "Diana Pedrosa",
      birthdayChildName: "Lourenço",
    },
    ...Array.from({ length: 24 }, (_, index) => ({
      id: `60000000-0000-4000-8000-${String(index + 10).padStart(12, "0")}`,
      eventDate: "2025-06-15",
      customerName: `Cliente histórico ${index + 1}`,
      birthdayChildName: `Criança histórica ${index + 1}`,
    })),
  ];
  const externalEvents = [
    {
      id: "70000000-0000-4000-8000-000000000001",
      eventDate: "2026-09-26",
      customerName: "Sofia Silvestre",
    },
    {
      id: "70000000-0000-4000-8000-000000000002",
      eventDate: "2026-09-26",
      customerName: "Inês Maria",
    },
  ];
  const allEvents = [
    ...venueEvents.map((event) => ({ ...event, eventType: "venue_event" as const })),
    ...externalEvents.map((event) => ({ ...event, birthdayChildName: null, eventType: "external_event" as const })),
  ];

  let rows: ExpenseRow[] = [];
  let sequence = 1;
  const createBodies: Array<Record<string, unknown>> = [];
  let lastPatchBody: Record<string, unknown> | null = null;

  function responseLinks(inputs: ExpenseEventLinkInput[]) {
    return inputs.map((input, index): ExpenseEventLinkRow => {
      const event = allEvents.find((candidate) => candidate.id === input.eventId && candidate.eventType === input.eventType);
      if (!event) throw new Error("Unknown mocked event");
      const typeLabel = input.eventType === "venue_event" ? "Festa" : "Serviço Externo";
      const name = event.birthdayChildName || event.customerName;
      return {
        id: `80000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
        eventType: input.eventType,
        eventId: input.eventId,
        eventDate: event.eventDate,
        customerName: event.customerName,
        birthdayChildName: event.birthdayChildName,
        label: `${typeLabel} · ${event.eventDate} · ${name}`,
      };
    });
  }

  function makeExpense(body: {
    expenseDate: string;
    description: string;
    amount: number;
    categoryId: string;
    expenseType: "operational" | "investment";
    eventLinks?: ExpenseEventLinkInput[];
  }): ExpenseRow {
    const links = responseLinks(body.eventLinks ?? []);
    const onlyVenue = links.length === 1 && links[0].eventType === "venue_event" ? links[0] : null;
    return {
      id: `90000000-0000-4000-8000-${String(sequence++).padStart(12, "0")}`,
      expenseDate: body.expenseDate,
      description: body.description,
      amount: body.amount,
      categoryId: body.categoryId,
      categoryName: "Supermercado / Alimentação",
      expenseType: body.expenseType,
      supplier: null,
      notes: null,
      venueEventId: onlyVenue?.eventId ?? null,
      venueEventLabel: onlyVenue ? `${onlyVenue.birthdayChildName || onlyVenue.customerName} · ${onlyVenue.eventDate}` : null,
      eventLinks: links,
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
    };
  }

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

    if (url.pathname === "/api/settings/expense-categories" && method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ id: foodCategory, name: "Supermercado / Alimentação", isActive: true, sortOrder: 10, createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z" }]),
      });
    }
    if (url.pathname === "/api/venue-events" && method === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(venueEvents) });
    }
    if (url.pathname === "/api/external-events" && method === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(externalEvents) });
    }
    if (url.pathname === "/api/expenses" && method === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(rows) });
    }
    if (url.pathname === "/api/expenses" && method === "POST") {
      const body = request.postDataJSON() as {
        expenseDate: string;
        description: string;
        amount: number;
        categoryId: string;
        expenseType: "operational" | "investment";
        eventLinks?: ExpenseEventLinkInput[];
      };
      createBodies.push(body);
      const created = makeExpense(body);
      rows = [created, ...rows];
      return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(created) });
    }
    if (url.pathname.startsWith("/api/expenses/") && method === "PATCH") {
      const id = url.pathname.split("/").pop()!;
      lastPatchBody = request.postDataJSON();
      const body = lastPatchBody as { eventLinks?: ExpenseEventLinkInput[]; amount?: number };
      rows = rows.map((row) => {
        if (row.id !== id) return row;
        const eventLinks = body.eventLinks === undefined ? row.eventLinks : responseLinks(body.eventLinks);
        const onlyVenue = eventLinks.length === 1 && eventLinks[0].eventType === "venue_event" ? eventLinks[0] : null;
        return {
          ...row,
          amount: body.amount ?? row.amount,
          eventLinks,
          venueEventId: onlyVenue?.eventId ?? null,
          venueEventLabel: onlyVenue ? `${onlyVenue.birthdayChildName || onlyVenue.customerName} · ${onlyVenue.eventDate}` : null,
        };
      });
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(rows.find((row) => row.id === id)) });
    }

    return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "not mocked" }) });
  });

  await page.goto("/expenses-flow-test.html");

  async function openCreate(description: string, amount = "10") {
    await page.getByRole("button", { name: "Adicionar despesa" }).click();
    const dialog = page.getByRole("dialog", { name: "Adicionar despesa" });
    await formControl(dialog, "Data").fill("2026-10-01");
    await formControl(dialog, "Valor").fill(amount);
    await formControl(dialog, "Descrição").fill(description);
    const category = dialog.locator("label").filter({ hasText: /^Categoria$/ }).locator("xpath=..").getByRole("combobox");
    await category.click();
    await page.getByRole("option", { name: "Supermercado / Alimentação" }).click();
    return dialog;
  }

  async function selectEvent(dialog: Locator, search: string, name: string) {
    const trigger = dialog.getByRole("combobox", { name: "Associar a eventos" });
    if (!(await page.getByPlaceholder("Pesquisar festa ou serviço…").isVisible().catch(() => false))) {
      await trigger.click();
    }
    const input = page.getByPlaceholder("Pesquisar festa ou serviço…");
    await input.fill(search);
    const option = page.getByRole("option").filter({ hasText: name }).first();
    await expect(option).toBeVisible();
    await option.click();
  }

  async function saveDialog(dialog: Locator) {
    if (await page.getByPlaceholder("Pesquisar festa ou serviço…").isVisible().catch(() => false)) {
      await page.keyboard.press("Escape");
    }
    await dialog.getByRole("button", { name: "Guardar", exact: true }).click();
  }

  // 2 Serviços Externos: uma despesa de 50 € continua a contar apenas 50 €.
  let dialog = await openCreate("Colaboradora duas externas", "50");
  const trigger = dialog.getByRole("combobox", { name: "Associar a eventos" });
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();

  const commandList = page.locator("[cmdk-list]");
  await expect(commandList).toBeVisible();
  const box = await commandList.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(844);
  expect(box!.height).toBeLessThanOrEqual(844 * 0.6);
  expect(await commandList.evaluate((element) => getComputedStyle(element).overflowY)).toBe("auto");

  const input = page.getByPlaceholder("Pesquisar festa ou serviço…");
  await input.fill("servico externo");
  await expect(page.getByRole("option").filter({ hasText: "Sofia Silvestre" })).toBeVisible();
  await expect(page.getByRole("option").filter({ hasText: "Inês Maria" })).toBeVisible();
  await input.fill("26/09/2026");
  await expect(page.getByRole("option").filter({ hasText: "Iara" })).toBeVisible();
  await input.fill("sofia");
  await page.getByRole("option").filter({ hasText: "Sofia Silvestre" }).click();
  await input.fill("ines");
  await page.getByRole("option").filter({ hasText: "Inês Maria" }).click();
  await page.keyboard.press("Escape");

  await expect(dialog.getByText("Serviço · Sofia Silvestre · 26/09/2026", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Serviço · Inês Maria · 26/09/2026", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Guardar", exact: true }).click();

  expect(createBodies.at(-1)?.eventLinks).toEqual([
    { eventType: "external_event", eventId: externalEvents[0].id },
    { eventType: "external_event", eventId: externalEvents[1].id },
  ]);
  const totalCard = page.getByText("Total saídas", { exact: true }).locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]");
  await expect(totalCard.getByText("50,00 €", { exact: true })).toBeVisible();
  await expect(page.getByText("Associada a 2 eventos", { exact: true })).toBeVisible();

  // Sem associação.
  dialog = await openCreate("Sem evento");
  await saveDialog(dialog);
  expect(createBodies.at(-1)?.eventLinks).toEqual([]);

  // 1 Festa.
  dialog = await openCreate("Uma festa");
  await selectEvent(dialog, "iara", "Iara");
  await saveDialog(dialog);
  expect(createBodies.at(-1)?.eventLinks).toEqual([
    { eventType: "venue_event", eventId: venueEvents[0].id },
  ]);

  // 1 Serviço Externo.
  dialog = await openCreate("Um serviço");
  await selectEvent(dialog, "sofia", "Sofia Silvestre");
  await saveDialog(dialog);
  expect(createBodies.at(-1)?.eventLinks).toEqual([
    { eventType: "external_event", eventId: externalEvents[0].id },
  ]);

  // 2 Festas.
  dialog = await openCreate("Duas festas");
  await selectEvent(dialog, "iara", "Iara");
  await selectEvent(dialog, "lourenco", "Lourenço");
  await saveDialog(dialog);
  expect(createBodies.at(-1)?.eventLinks).toEqual([
    { eventType: "venue_event", eventId: venueEvents[0].id },
    { eventType: "venue_event", eventId: venueEvents[1].id },
  ]);

  // Festa + Serviço Externo.
  dialog = await openCreate("Festa e serviço");
  await selectEvent(dialog, "iara", "Iara");
  await selectEvent(dialog, "sofia", "Sofia Silvestre");
  await saveDialog(dialog);
  expect(createBodies.at(-1)?.eventLinks).toEqual([
    { eventType: "venue_event", eventId: venueEvents[0].id },
    { eventType: "external_event", eventId: externalEvents[0].id },
  ]);

  // Editar: remover a Festa e adicionar outro Serviço.
  const mixedCard = page.getByText("Festa e serviço", { exact: true }).locator("xpath=ancestor::div[.//button[contains(.,'Editar')]][1]");
  await mixedCard.getByRole("button", { name: "Editar" }).click();
  const editDialog = page.getByRole("dialog", { name: "Editar despesa" });
  await expect(editDialog.getByText("Festa · Iara · 26/09/2026", { exact: true })).toBeVisible();
  await editDialog.getByRole("button", { name: "Remover Iara" }).click();
  await selectEvent(editDialog, "ines", "Inês Maria");
  await saveDialog(editDialog);

  await expect.poll(() => lastPatchBody).not.toBeNull();
  expect(lastPatchBody?.eventLinks).toEqual([
    { eventType: "external_event", eventId: externalEvents[0].id },
    { eventType: "external_event", eventId: externalEvents[1].id },
  ]);
});
