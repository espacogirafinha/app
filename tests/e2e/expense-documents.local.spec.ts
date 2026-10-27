import { test, expect } from "@playwright/test";
const expenseId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const documentId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const row = {
  id: expenseId,
  expenseDate: "2026-10-23",
  description: "Congelados para stock geral",
  amount: 45.68,
  categoryId: "11111111-1111-4111-8111-111111111111",
  categoryName: "Supermercado / Alimentação",
  expenseType: "operational",
  supplier: "Makro",
  notes: null,
  eventLinks: [],
  createdAt: "2026-10-23T10:00:00Z",
  updatedAt: "2026-10-23T10:00:00Z",
};
const doc = {
  id: documentId,
  filename: "FAC-06208202601-005618.pdf",
  mimeType: "application/pdf",
  size: 15000,
  storagePath: "fixture/invoice.pdf",
  associationCount: 2,
};

test("receipt section, reuse, removal, persistence, file inputs and responsive layout", async ({
  page,
}, testInfo) => {
  let attached = false;
  let financialWrites = 0;
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const action = url.searchParams.get("documentAction");
    let result: unknown = [];
    if (action === "counts") result = attached ? { [expenseId]: 1 } : {};
    else if (action === "list") result = attached ? [doc] : [];
    else if (action === "library") result = [doc];
    else if (action === "link") {
      attached = true;
      result = doc;
    } else if (action === "unlink") {
      attached = false;
      result = { cleanupPending: false };
    } else if (action === "prepare") {
      attached = true;
      result = { document: doc, upload: false };
    } else if (url.pathname === "/api/expenses") {
      if (route.request().method() !== "GET") financialWrites++;
      result = [row];
    } else if (url.pathname.endsWith("expense-categories"))
      result = [
        {
          id: row.categoryId,
          name: row.categoryName,
          isActive: true,
          sortOrder: 0,
        },
      ];
    await route.fulfill({ json: result });
  });
  await page.goto("/expenses-flow-test.html");
  await expect(page.getByText("Congelados para stock geral")).toBeVisible();
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  const section = page.getByRole("region", { name: "Comprovativos" });
  await expect(
    section.getByText("Esta despesa ainda não tem comprovativos."),
  ).toBeVisible();
  await expect(section.getByLabel("Fotografar comprovativo")).toHaveAttribute(
    "capture",
    "environment",
  );
  await expect(section.getByLabel("Selecionar comprovativos")).toHaveAttribute(
    "multiple",
    "",
  );
  await section.getByRole("button", { name: "Usar existente" }).click();
  await section.getByLabel("Pesquisar comprovativo").fill("005618");
  await section.getByRole("button", { name: doc.filename }).click();
  await expect(section.getByText(doc.filename)).toBeVisible();
  await expect(section.getByText("Associado a 2 despesas")).toBeVisible();
  await expect(
    section.getByRole("button", { name: "Abrir", exact: true }),
  ).toBeVisible();
  await expect(
    section.getByRole("button", { name: "Descarregar", exact: true }),
  ).toBeVisible();
  await page.getByRole("dialog").screenshot({
    path: testInfo.outputPath(`expense-documents-${testInfo.project.name}.png`),
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(page.getByText("📎 1 comprovativo")).toBeVisible();
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await expect(section.getByText(doc.filename)).toBeVisible();
  await section.getByRole("button", { name: "Remover", exact: true }).click();
  await expect(
    section.getByText(
      "Remover apenas desta despesa? O ficheiro mantém-se nas restantes.",
    ),
  ).toBeVisible();
  await section.getByRole("button", { name: "Confirmar remoção" }).click();
  await expect(
    section.getByText("Esta despesa ainda não tem comprovativos."),
  ).toBeVisible();
  await section.getByLabel("Selecionar comprovativos").setInputFiles({
    name: "foto.png",
    mimeType: "image/png",
    buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  });
  await expect(section.getByText(doc.filename)).toBeVisible();
  expect(financialWrites).toBe(0);
});

test("invalid files and unavailable migration provide clear feedback without financial writes", async ({
  page,
}) => {
  await page.route("**/api/**", (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.has("documentAction"))
      return route.fulfill({
        status: 503,
        json: {
          error:
            "Os comprovativos aguardam a ativação da migration neste ambiente.",
        },
      });
    return route.fulfill({
      json: url.pathname === "/api/expenses" ? [row] : [],
    });
  });
  await page.goto("/expenses-flow-test.html");
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await expect(
    page.getByRole("alert").getByText(/aguardam a ativação/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Anexar comprovativo" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Guardar", exact: true }),
  ).toBeEnabled();
});

test("uploads an image, shows private preview, opens and downloads, rejects unsupported files", async ({
  page,
}) => {
  let attached = false;
  let storageUploads = 0;
  let finalized = false;
  const image = {
    ...doc,
    filename: "talao.png",
    mimeType: "image/png",
    storagePath: "fixture/talao.png",
    associationCount: 1,
  };
  const imageBytes = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a/ksAAAAASUVORK5CYII=",
    "base64",
  );
  await page.route("**/storage/v1/**", async (route) => {
    const request = route.request();
    if (request.method() === "POST") {
      storageUploads++;
      await route.fulfill({
        json: { Key: `expense-documents/${image.storagePath}` },
        headers: { "access-control-allow-origin": "*" },
      });
    } else
      await route.fulfill({
        body: imageBytes,
        contentType: "image/png",
        headers: { "access-control-allow-origin": "*" },
      });
  });
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const action = url.searchParams.get("documentAction");
    let result: unknown = [];
    if (action === "list") result = attached ? [image] : [];
    else if (action === "counts") result = attached ? { [expenseId]: 1 } : {};
    else if (action === "prepare") result = { document: image, upload: true };
    else if (action === "finalize") {
      finalized = true;
      attached = true;
      result = image;
    } else if (url.pathname === "/api/expenses") result = [row];
    await route.fulfill({ json: result });
  });
  await page.goto("/expenses-flow-test.html");
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  const section = page.getByRole("region", { name: "Comprovativos" });
  await expect(
    section.getByText("Esta despesa ainda não tem comprovativos."),
  ).toBeVisible();
  await section.getByLabel("Selecionar comprovativos").setInputFiles({
    name: "talao.png",
    mimeType: "image/png",
    buffer: imageBytes,
  });
  await expect(
    section.getByRole("img", { name: "Pré-visualização de talao.png" }),
  ).toBeVisible();
  expect(storageUploads).toBe(1);
  expect(finalized).toBe(true);
  const downloadPromise = page.waitForEvent("download");
  await section
    .getByRole("button", { name: "Descarregar", exact: true })
    .click();
  expect((await downloadPromise).suggestedFilename()).toBe("talao.png");
  const popupPromise = page.waitForEvent("popup");
  await section.getByRole("button", { name: "Abrir", exact: true }).click();
  const popup = await popupPromise;
  await popup.waitForURL(/^blob:/);
  await popup.close();
  await section.getByLabel("Selecionar comprovativos").setInputFiles({
    name: "programa.exe",
    mimeType: "application/octet-stream",
    buffer: Buffer.from("invalid"),
  });
  await expect(
    page.getByText(
      "Escolha uma fotografia JPG, PNG, WEBP ou um PDF, até 10 MB.",
    ),
  ).toBeVisible();
  expect(storageUploads).toBe(1);
});

test("new expense form shows receipt selection before the financial record exists", async ({ page }) => {
  await page.route("**/api/**", (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.has("documentAction"))
      return route.fulfill({ json: [] });
    if (url.pathname.endsWith("/api/expense-categories"))
      return route.fulfill({ json: [{ id: row.categoryId, name: row.categoryName, isActive: true, sortOrder: 0 }] });
    return route.fulfill({ json: url.pathname === "/api/expenses" ? [row] : [] });
  });
  await page.goto("/expenses-flow-test.html");
  await page.getByRole("button", { name: "Adicionar despesa", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const queued = dialog.getByRole("region", { name: "Comprovativos da nova despesa" });
  await expect(queued.getByRole("button", { name: "Anexar comprovativo" })).toBeVisible();
  await expect(queued.getByLabel("Fotografar comprovativo para nova despesa")).toHaveAttribute("capture", "environment");
  await queued.getByLabel("Selecionar comprovativos para nova despesa").setInputFiles({
    name: "talao-novo.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n%demo\n"),
  });
  await expect(queued.getByText("talao-novo.pdf")).toBeVisible();
  await queued.getByRole("button", { name: "Remover talao-novo.pdf" }).click();
  await expect(queued.getByText("Nenhum comprovativo selecionado (opcional).")).toBeVisible();
});


test("creating an expense attaches the selected document once, in the same save flow", async ({ page }) => {
  const createdId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const created = { ...row, id: createdId, description: "Material de displays — ensaio", amount: 12.34 };
  const prepareExpenseIds: string[] = [];
  let createCount = 0;
  let linked = false;
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const action = url.searchParams.get("documentAction");
    const method = route.request().method();
    let result: unknown = [];
    if (action === "prepare") {
      const body = JSON.parse(route.request().postData() ?? "{}");
      prepareExpenseIds.push(body.expenseId);
      linked = true;
      result = { document: doc, upload: false }; // Existing immutable invoice
    } else if (action === "list") result = linked ? [doc] : [];
    else if (action === "counts") result = linked ? { [createdId]: 1 } : {};
    else if (url.pathname === "/api/expenses") {
      if (method === "POST") {
        createCount++;
        result = created;
      } else result = createCount ? [created, row] : [row];
    } else if (url.pathname.includes("expense-categories")) {
      result = [{ id: row.categoryId, name: row.categoryName, isActive: true, sortOrder: 0 }];
    }
    await route.fulfill({ json: result });
  });
  await page.goto("/expenses-flow-test.html");
  await page.getByRole("button", { name: "Adicionar despesa", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.locator('input[placeholder="Ex.: Continente"]').fill(created.description);
  await dialog.locator('input[inputmode="decimal"]').fill("12,34");
  await dialog.getByText("Escolher categoria").click();
  await page.getByRole("option", { name: row.categoryName }).click();
  const pending = dialog.getByRole("region", { name: "Comprovativos da nova despesa" });
  await pending.getByLabel("Selecionar comprovativos para nova despesa").setInputFiles({
    name: "fatura-displays.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF"),
  });
  await expect(pending.getByText("fatura-displays.pdf")).toBeVisible();
  await dialog.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(createCount).toBe(1);
  expect(prepareExpenseIds).toEqual([createdId]);
  await expect(page.getByText("📎 1 comprovativo")).toBeVisible();
});

test("failed receipt upload never resubmits the financial expense and opens edit for recovery", async ({ page }) => {
  const createdId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  const created = { ...row, id: createdId, description: "Teste de upload falhado", amount: 9.99 };
  let createCount = 0;
  let attemptedUploads = 0;
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const action = url.searchParams.get("documentAction");
    const method = route.request().method();
    if (action === "prepare") {
      attemptedUploads++;
      await route.fulfill({ status: 502, json: { error: "Storage indisponível" } });
      return;
    }
    let result: unknown = [];
    if (action === "list") result = [];
    else if (action === "counts") result = {};
    else if (url.pathname === "/api/expenses") {
      if (method === "POST") {
        createCount++;
        result = created;
      } else result = createCount ? [created, row] : [row];
    } else if (url.pathname.includes("expense-categories")) {
      result = [{ id: row.categoryId, name: row.categoryName, isActive: true, sortOrder: 0 }];
    }
    await route.fulfill({ json: result });
  });
  await page.goto("/expenses-flow-test.html");
  await page.getByRole("button", { name: "Adicionar despesa", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.locator('input[placeholder="Ex.: Continente"]').fill(created.description);
  await dialog.locator('input[inputmode="decimal"]').fill("9,99");
  await dialog.getByText("Escolher categoria").click();
  await page.getByRole("option", { name: row.categoryName }).click();
  await dialog.getByLabel("Selecionar comprovativos para nova despesa").setInputFiles({
    name: "comprovativo-falho.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF"),
  });
  await dialog.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByRole("dialog").getByText("Editar despesa")).toBeVisible();
  await expect(page.getByText("Despesa guardada, mas faltam comprovativos")).toBeVisible();
  expect(attemptedUploads).toBe(1);
  expect(createCount).toBe(1);
});
