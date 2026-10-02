import { expect, test, type Locator, type Page, type Route } from "@playwright/test";

type MockItem = {
  id: string;
  itemType: "consumable" | "material";
  name: string;
  category: string;
  quantityCurrent: number;
  unit: string;
  minimumStock: number | null;
  unitCost: number | null;
  photoPath: string | null;
  color: string | null;
  theme: string | null;
  location: string | null;
  condition: "bom" | "danificado" | "em_reparacao" | null;
  purchaseCost: number | null;
  notes: string | null;
  isActive: boolean;
  isLowStock: boolean;
  createdAt: string;
  updatedAt: string;
};

type MockMovement = {
  id: string;
  itemId: string;
  movementType: "entry" | "exit" | "adjustment";
  quantityDelta: number;
  quantityBefore: number;
  quantityAfter: number;
  occurredAt: string;
  reason: string | null;
  createdAt: string;
};

function nowIso() {
  return "2026-10-02T00:15:00.000Z";
}

function field(scope: Locator, label: string) {
  return scope.locator("label").filter({ hasText: label }).locator("xpath=..");
}

async function selectField(page: Page, scope: Locator, label: string, option: string) {
  await field(scope, label).getByRole("combobox").click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

function buildItem(id: string, body: Record<string, unknown>): MockItem {
  const quantity = Number(body.quantity ?? 0);
  const minimumStock = body.minimumStock == null ? null : Number(body.minimumStock);
  return {
    id,
    itemType: body.itemType as MockItem["itemType"],
    name: String(body.name),
    category: String(body.category),
    quantityCurrent: quantity,
    unit: String(body.unit),
    minimumStock,
    unitCost: body.unitCost == null ? null : Number(body.unitCost),
    photoPath: null,
    color: body.color == null ? null : String(body.color),
    theme: body.theme == null ? null : String(body.theme),
    location: body.location == null ? null : String(body.location),
    condition: (body.condition ?? null) as MockItem["condition"],
    purchaseCost: body.purchaseCost == null ? null : Number(body.purchaseCost),
    notes: body.notes == null ? null : String(body.notes),
    isActive: body.isActive !== false,
    isLowStock: minimumStock !== null && quantity <= minimumStock,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

async function installInventoryMock(page: Page) {
  const items: MockItem[] = [];
  const movements = new Map<string, MockMovement[]>();
  let nextId = 1;
  let uploadCount = 0;
  let deleteCount = 0;
  const uploadedPaths: string[] = [];

  await page.route("**/*", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

    if (url.pathname === "/api/inventory/items" && method === "GET") {
      const itemType = url.searchParams.get("itemType");
      const search = (url.searchParams.get("search") ?? "").toLocaleLowerCase("pt-PT");
      const category = url.searchParams.get("category");
      const location = url.searchParams.get("location");
      const condition = url.searchParams.get("condition");
      const active = url.searchParams.get("active");
      const lowStock = url.searchParams.get("lowStock");

      const result = items.filter((item) => {
        if (itemType && item.itemType !== itemType) return false;
        if (search && !(item.name.toLocaleLowerCase("pt-PT").includes(search) || (item.theme ?? "").toLocaleLowerCase("pt-PT").includes(search))) return false;
        if (category && item.category !== category) return false;
        if (location && item.location !== location) return false;
        if (condition && item.condition !== condition) return false;
        if (active !== null && item.isActive !== (active === "true")) return false;
        if (lowStock === "true" && !item.isLowStock) return false;
        return true;
      });

      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(result) });
    }

    if (url.pathname === "/api/inventory/items" && method === "POST") {
      const body = request.postDataJSON() as Record<string, unknown>;
      const id = "00000000-0000-4000-8000-" + String(nextId++).padStart(12, "0");
      const item = buildItem(id, body);
      items.push(item);
      if (item.quantityCurrent > 0) {
        movements.set(item.id, [{
          id: "10000000-0000-4000-8000-" + String(nextId++).padStart(12, "0"),
          itemId: item.id,
          movementType: "adjustment",
          quantityDelta: item.quantityCurrent,
          quantityBefore: 0,
          quantityAfter: item.quantityCurrent,
          occurredAt: nowIso(),
          reason: "Stock inicial",
          createdAt: nowIso(),
        }]);
      }
      return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(item) });
    }

    const itemMatch = url.pathname.match(/^\/api\/inventory\/items\/([^/]+)$/);
    if (itemMatch && method === "PATCH") {
      const item = items.find((entry) => entry.id === itemMatch[1]);
      if (!item) return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "not found" }) });
      const body = request.postDataJSON() as Record<string, unknown>;
      Object.assign(item, body, { updatedAt: nowIso() });
      item.minimumStock = body.minimumStock === undefined ? item.minimumStock : body.minimumStock == null ? null : Number(body.minimumStock);
      item.unitCost = body.unitCost === undefined ? item.unitCost : body.unitCost == null ? null : Number(body.unitCost);
      item.purchaseCost = body.purchaseCost === undefined ? item.purchaseCost : body.purchaseCost == null ? null : Number(body.purchaseCost);
      item.photoPath = body.photoPath === undefined ? item.photoPath : body.photoPath == null ? null : String(body.photoPath);
      item.isLowStock = item.minimumStock !== null && item.quantityCurrent <= item.minimumStock;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(item) });
    }

    const movementMatch = url.pathname.match(/^\/api\/inventory\/items\/([^/]+)\/movements$/);
    if (movementMatch && method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([...(movements.get(movementMatch[1]) ?? [])].reverse()),
      });
    }

    if (movementMatch && method === "POST") {
      const item = items.find((entry) => entry.id === movementMatch[1]);
      if (!item) return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "not found" }) });
      const body = request.postDataJSON() as { movementType: MockMovement["movementType"]; quantity: number; occurredAt?: string; reason?: string | null };
      const before = item.quantityCurrent;
      const delta = body.movementType === "entry"
        ? body.quantity
        : body.movementType === "exit"
          ? -body.quantity
          : body.quantity - before;
      const after = before + delta;
      if (after < 0) {
        return route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({ error: "Stock insuficiente. A saída não pode deixar o stock negativo." }),
        });
      }
      const movement: MockMovement = {
        id: "20000000-0000-4000-8000-" + String(nextId++).padStart(12, "0"),
        itemId: item.id,
        movementType: body.movementType,
        quantityDelta: delta,
        quantityBefore: before,
        quantityAfter: after,
        occurredAt: body.occurredAt ?? nowIso(),
        reason: body.reason ?? null,
        createdAt: nowIso(),
      };
      item.quantityCurrent = after;
      item.isLowStock = item.minimumStock !== null && item.quantityCurrent <= item.minimumStock;
      movements.set(item.id, [...(movements.get(item.id) ?? []), movement]);
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ item, movement }),
      });
    }

    if (url.pathname.includes("/mock-supabase/storage/v1/object/sign/inventory-images/") && method === "POST") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ signedURL: "/mock-inventory-image.png" }),
      });
    }

    if (url.pathname.includes("/mock-supabase/storage/v1/object/inventory-images/") && method === "POST") {
      uploadCount += 1;
      const marker = "/object/inventory-images/";
      uploadedPaths.push(decodeURIComponent(url.pathname.slice(url.pathname.indexOf(marker) + marker.length)));
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ Key: "inventory-images/" + uploadedPaths.at(-1) }),
      });
    }

    if (url.pathname.endsWith("/mock-supabase/storage/v1/object/inventory-images") && method === "DELETE") {
      deleteCount += 1;
      return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    }

    if (url.pathname === "/mock-inventory-image.png") {
      return route.fulfill({
        status: 200,
        contentType: "image/png",
        body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
      });
    }

    return route.continue();
  });

  return {
    items,
    movements,
    uploads: () => uploadCount,
    deletes: () => deleteCount,
    uploadedPaths,
  };
}

async function createConsumable(page: Page) {
  await page.getByRole("button", { name: "Novo artigo" }).click();
  const dialog = page.getByRole("dialog");
  await field(dialog, "Nome").getByRole("textbox").fill("Água pequena");
  await selectField(page, dialog, "Categoria", "Bebidas");
  await field(dialog, "Quantidade inicial").locator("input").fill("5");
  await field(dialog, "Stock mínimo").locator("input").fill("6");
  await field(dialog, "Custo unitário aproximado").locator("input").fill("0.25");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByText("Água pequena", { exact: true })).toBeVisible();
}

test("consumíveis: CRUD, movimentos, histórico, stock baixo, bloqueio negativo e ativo/inativo", async ({ page }) => {
  await installInventoryMock(page);
  await page.goto("/inventory-flow-test.html");

  await createConsumable(page);
  await expect(page.getByText("Stock baixo", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Editar Água pequena" }).click();
  let dialog = page.getByRole("dialog");
  await field(dialog, "Nome").getByRole("textbox").fill("Água 33cl");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByText("Água 33cl", { exact: true })).toBeVisible();

  let card = page.getByText("Água 33cl", { exact: true }).locator("xpath=ancestor::article");
  await card.getByRole("button", { name: /Entrada/ }).click();
  dialog = page.getByRole("dialog");
  await field(dialog, "Quantidade").locator("input").fill("2");
  await field(dialog, "Motivo / nota").getByRole("textbox").fill("Compra");
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(card.getByText(/7\s*un/)).toBeVisible();
  await expect(card.getByText("Stock baixo", { exact: true })).toHaveCount(0);

  card = page.getByText("Água 33cl", { exact: true }).locator("xpath=ancestor::article");
  await card.getByRole("button", { name: /Saída/ }).click();
  dialog = page.getByRole("dialog");
  await field(dialog, "Quantidade").locator("input").fill("6");
  await field(dialog, "Motivo / nota").getByRole("textbox").fill("Utilizado em festa");
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  card = page.getByText("Água 33cl", { exact: true }).locator("xpath=ancestor::article");
  await expect(card.getByText(/1\s*un/)).toBeVisible();
  await expect(card.getByText("Stock baixo", { exact: true })).toBeVisible();

  await card.getByRole("button", { name: /Saída/ }).click();
  dialog = page.getByRole("dialog");
  await field(dialog, "Quantidade").locator("input").fill("2");
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(page.getByText(/Stock insuficiente/)).toBeVisible();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  card = page.getByText("Água 33cl", { exact: true }).locator("xpath=ancestor::article");
  await expect(card.getByText(/1\s*un/)).toBeVisible();

  await card.getByRole("button", { name: "Ajuste", exact: true }).click();
  dialog = page.getByRole("dialog");
  await field(dialog, "Nova quantidade física").locator("input").fill("4");
  await field(dialog, "Motivo / nota").getByRole("textbox").fill("Acerto de inventário");
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  card = page.getByText("Água 33cl", { exact: true }).locator("xpath=ancestor::article");
  await expect(card.getByText(/4\s*un/)).toBeVisible();

  await card.getByRole("button", { name: "Histórico" }).click();
  await expect(page.getByRole("dialog", { name: "Histórico de stock" })).toBeVisible();
  await expect(page.getByText("Compra", { exact: true })).toBeVisible();
  await expect(page.getByText("Utilizado em festa", { exact: true })).toBeVisible();
  await expect(page.getByText("Acerto de inventário", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Fechar", exact: true }).click();

  await page.getByPlaceholder("Pesquisar por nome…").fill("Água 33");
  await expect(page.getByText("Água 33cl", { exact: true })).toBeVisible();
  await page.getByPlaceholder("Pesquisar por nome…").fill("inexistente");
  await expect(page.getByText("Nenhum artigo encontrado", { exact: true })).toBeVisible();
  await page.getByPlaceholder("Pesquisar por nome…").fill("");

  await page.getByRole("combobox").filter({ hasText: "Todas as categorias" }).click();
  await page.getByRole("option", { name: "Snacks", exact: true }).click();
  await expect(page.getByText("Nenhum artigo encontrado", { exact: true })).toBeVisible();
  await page.getByRole("combobox").filter({ hasText: "Snacks" }).click();
  await page.getByRole("option", { name: "Todas as categorias", exact: true }).click();

  await page.getByRole("button", { name: "Ver stock baixo" }).click();
  await expect(page.getByText("Água 33cl", { exact: true })).toBeVisible();

  card = page.getByText("Água 33cl", { exact: true }).locator("xpath=ancestor::article");
  await card.getByRole("button", { name: "Inativar artigo" }).click();
  await expect(page.getByText("Água 33cl", { exact: true })).toHaveCount(0);

  await page.getByRole("combobox").filter({ hasText: "Ativos" }).click();
  await page.getByRole("option", { name: "Inativos", exact: true }).click();
  card = page.getByText("Água 33cl", { exact: true }).locator("xpath=ancestor::article");
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Reativar artigo" }).click();
  await expect(page.getByText("Água 33cl", { exact: true })).toHaveCount(0);

  await page.getByRole("combobox").filter({ hasText: "Inativos" }).click();
  await page.getByRole("option", { name: "Ativos", exact: true }).click();
  await expect(page.getByText("Água 33cl", { exact: true })).toBeVisible();
});

test("material: foto, substituição, edição, filtros e mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const mock = await installInventoryMock(page);
  await page.goto("/inventory-flow-test.html");

  await page.getByRole("tab", { name: "Material / decoração" }).click();
  await page.getByRole("button", { name: "Novo artigo" }).click();

  let dialog = page.getByRole("dialog");
  await field(dialog, "Nome").getByRole("textbox").fill("Painel Patrulha");
  await selectField(page, dialog, "Categoria", "Painéis");
  await field(dialog, "Quantidade inicial").locator("input").fill("2");
  await field(dialog, "Tema").getByRole("textbox").fill("Patrulha Pata");
  await selectField(page, dialog, "Localização", "Arrecadação");
  await selectField(page, dialog, "Estado / condição", "Bom estado");
  await field(dialog, "Custo de compra").locator("input").fill("90");

  await dialog.locator('input[type="file"]').setInputFiles({
    name: "painel.png",
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
  });
  await page.getByRole("button", { name: "Guardar", exact: true }).click();

  await expect(page.getByText("Painel Patrulha", { exact: true })).toBeVisible();
  expect(mock.uploads()).toBe(1);
  expect(mock.items[0].photoPath).toMatch(/^material\/00000000-0000-4000-8000-\d{12}\//);

  await page.getByRole("button", { name: "Editar Painel Patrulha" }).click();
  dialog = page.getByRole("dialog");
  await field(dialog, "Cor").getByRole("textbox").fill("Azul");
  await dialog.locator('input[type="file"]').setInputFiles({
    name: "painel-novo.webp",
    mimeType: "image/webp",
    buffer: Buffer.from("UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEAAUAmJaQAA3AA/v89WAAAAA==", "base64"),
  });
  await page.getByRole("button", { name: "Guardar", exact: true }).click();

  await expect(page.getByText("Painel Patrulha", { exact: true })).toBeVisible();
  expect(mock.uploads()).toBe(2);
  await expect.poll(() => mock.deletes()).toBe(1);
  expect(mock.uploadedPaths[0]).not.toBe(mock.uploadedPaths[1]);
  expect(mock.items[0].color).toBe("Azul");

  await page.getByPlaceholder("Pesquisar nome ou tema…").fill("patrulha");
  await expect(page.getByText("Painel Patrulha", { exact: true })).toBeVisible();
  await page.getByPlaceholder("Pesquisar nome ou tema…").fill("");

  await page.getByRole("combobox").filter({ hasText: "Todas as categorias" }).click();
  await page.getByRole("option", { name: "Mesas", exact: true }).click();
  await expect(page.getByText("Nenhum artigo encontrado", { exact: true })).toBeVisible();
  await page.getByRole("combobox").filter({ hasText: "Mesas" }).click();
  await page.getByRole("option", { name: "Todas as categorias", exact: true }).click();

  await page.getByRole("combobox").filter({ hasText: "Todas as localizações" }).click();
  await page.getByRole("option", { name: "Loja", exact: true }).click();
  await expect(page.getByText("Nenhum artigo encontrado", { exact: true })).toBeVisible();
  await page.getByRole("combobox").filter({ hasText: "Loja" }).click();
  await page.getByRole("option", { name: "Todas as localizações", exact: true }).click();

  await page.getByRole("combobox").filter({ hasText: "Todos os estados" }).click();
  await page.getByRole("option", { name: "Danificado", exact: true }).click();
  await expect(page.getByText("Nenhum artigo encontrado", { exact: true })).toBeVisible();
  await page.getByRole("combobox").filter({ hasText: "Danificado" }).click();
  await page.getByRole("option", { name: "Todos os estados", exact: true }).click();

  const card = page.getByText("Painel Patrulha", { exact: true }).locator("xpath=ancestor::article");
  await card.getByRole("button", { name: "Inativar artigo" }).click();
  await expect(page.getByText("Painel Patrulha", { exact: true })).toHaveCount(0);
  await page.getByRole("combobox").filter({ hasText: "Ativos" }).click();
  await page.getByRole("option", { name: "Inativos", exact: true }).click();
  await expect(page.getByText("Painel Patrulha", { exact: true })).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
