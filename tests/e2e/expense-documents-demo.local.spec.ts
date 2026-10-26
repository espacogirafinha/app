import { test, expect } from "@playwright/test";
test("free offline demo shares files, uploads, downloads, resets and never calls an API", async ({
  page,
}, testInfo) => {
  const requests: string[] = [];
  page.on("request", (r) => {
    if (/\/api\/|supabase\.|\/storage\/v1\/|\/auth\/v1\//.test(r.url()))
      requests.push(r.url());
  });
  await page.goto("/comprovativos-demo.html");
  await expect(
    page.getByText("Demonstração · dados fictícios · 0 € de custos adicionais"),
  ).toBeVisible();
  const section = page.getByRole("region", { name: "Comprovativos" });
  await expect(section.getByText("Fatura-ficticia-54-08.pdf")).toBeVisible();
  await expect(section.getByText("Associado a 2 despesas")).toBeVisible();
  await section.getByRole("button", { name: "Remover", exact: true }).click();
  await section.getByRole("button", { name: "Confirmar remoção" }).click();
  await expect(
    section.getByText("Esta despesa ainda não tem comprovativos."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /Congelados para stock geral/ })
    .click();
  await expect(section.getByText("Fatura-ficticia-54-08.pdf")).toBeVisible();
  await page.getByRole("button", { name: /Salgados para catering/ }).click();
  await section.getByRole("button", { name: "Usar existente" }).click();
  await section
    .getByRole("button", { name: "Fatura-ficticia-54-08.pdf" })
    .click();
  await expect(section.getByText("Associado a 2 despesas")).toBeVisible();
  const bytes = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a/ksAAAAASUVORK5CYII=",
    "base64",
  );
  await section
    .getByLabel("Selecionar comprovativos")
    .setInputFiles({
      name: "foto-demo.png",
      mimeType: "image/png",
      buffer: bytes,
    });
  await expect(
    section.getByRole("img", { name: "Pré-visualização de foto-demo.png" }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await section
    .getByRole("button", { name: "Descarregar", exact: true })
    .last()
    .click();
  expect((await download).suggestedFilename()).toBe("foto-demo.png");
  const popupPromise = page.waitForEvent("popup");
  await section
    .getByRole("button", { name: "Abrir", exact: true })
    .last()
    .click();
  const popup = await popupPromise;
  await popup.waitForURL(/^blob:/);
  await popup.close();
  await expect(section.getByLabel("Fotografar comprovativo")).toHaveAttribute(
    "capture",
    "environment",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath(
      `expense-documents-demo-${testInfo.project.name}.png`,
    ),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Repor demonstração" }).click();
  await expect(section.getByText("foto-demo.png")).toHaveCount(0);
  await expect(section.getByText("Associado a 2 despesas")).toBeVisible();
  expect(requests).toEqual([]);
});

test("free demo accepts attachments during creation of a new fictional expense", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (r) => {
    if (/\/api\/|supabase\.|\/storage\/v1\/|\/auth\/v1\//.test(r.url()))
      requests.push(r.url());
  });
  await page.goto("/comprovativos-demo.html");
  await page.getByRole("button", { name: "Adicionar despesa" }).click();
  const pending = page.getByRole("region", { name: "Comprovativos da nova despesa" });
  await expect(pending.getByRole("button", { name: "Anexar comprovativo" })).toBeVisible();
  await expect(pending.getByLabel("Fotografar comprovativo para nova despesa")).toHaveAttribute(
    "capture",
    "environment",
  );
  const image = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a/ksAAAAASUVORK5CYII=",
    "base64",
  );
  await pending.getByLabel("Selecionar comprovativos para nova despesa").setInputFiles({
    name: "talão-novo.png", mimeType: "image/png", buffer: image,
  });
  await expect(pending.getByText("talão-novo.png")).toBeVisible();
  await page.getByRole("button", { name: "Guardar despesa e comprovativos" }).click();
  await expect(page.getByRole("button", { name: /Nova despesa fictícia/ })).toBeVisible();
  const saved = page.getByRole("region", { name: "Comprovativos", exact: true });
  await expect(saved.getByText("talão-novo.png")).toBeVisible();
  expect(requests).toEqual([]);
});
