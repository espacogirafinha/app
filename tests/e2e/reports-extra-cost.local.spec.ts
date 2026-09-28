import { expect, test } from "@playwright/test";

const unknownId = "11111111-1111-4111-8111-111111111111";
const knownId = "22222222-2222-4222-8222-222222222222";
const eventOne = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const eventTwo = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function baseReport() {
  const occurrenceUnknown = {
    id: unknownId,
    entityId: eventOne,
    eventDate: "2026-09-10",
    customerName: "Cliente A",
    birthdayChildName: "Mia",
    extraName: "Pinturas faciais",
    quantity: 1,
    unitPrice: 50,
    totalPrice: 50,
    unitCost: null,
    totalCost: null,
    margin: null,
  };
  const occurrenceKnown = {
    id: knownId,
    entityId: eventTwo,
    eventDate: "2026-09-12",
    customerName: "Cliente B",
    birthdayChildName: null,
    extraName: "Pinturas faciais",
    quantity: 1,
    unitPrice: 50,
    totalPrice: 50,
    unitCost: 20,
    totalCost: 20,
    margin: 30,
  };

  return {
    summary: {
      startDate: "2026-09-01",
      endDate: "2026-09-30",
      totalRevenue: 500,
      totalReceived: 100,
      totalPending: 400,
      heldDeposits: 0,
      retainedDeposits: 0,
      eventCount: 2,
      averageTicket: 250,
    },
    areas: {
      venueEvents: { eventCount: 2, revenue: 500, received: 100, pending: 400, heldDeposits: 0, retainedDeposits: 0, averageTicket: 250 },
      externalEvents: { eventCount: 0, revenue: 0, received: 0, pending: 0, heldDeposits: 0, retainedDeposits: 0, averageTicket: 0 },
      workshops: { eventCount: 0, revenue: 0, received: 0, pending: 0, heldDeposits: 0, retainedDeposits: 0, averageTicket: 0 },
    },
    venueEvents: {
      partyCount: 2,
      revenue: 500,
      received: 100,
      pending: 400,
      topPacks: [],
      revenueByPack: [],
      averageChildren: 10,
      sources: [],
    },
    extras: {
      soldCount: 2,
      revenue: 100,
      knownCost: 20,
      knownMargin: 30,
      unknownCostCount: 1,
      items: [{
        label: "Pinturas faciais",
        category: "Animação",
        count: 2,
        revenue: 100,
        knownCost: 20,
        knownMargin: 30,
        unknownCostCount: 1,
        occurrences: [occurrenceUnknown, occurrenceKnown],
      }],
    },
    externalEvents: {
      eventCount: 0,
      revenue: 0,
      received: 0,
      pending: 0,
      heldDeposits: 0,
      retainedDeposits: 0,
      topServices: [],
      revenueByServiceType: [],
      serviceCombinations: [],
      averageTicket: 0,
    },
    workshops: {
      workshopCount: 0,
      activeRegistrations: 0,
      occupiedSeats: 0,
      freeSeats: 0,
      occupancyRate: 0,
      revenue: 0,
      received: 0,
      pending: 0,
      participantsByPaymentStatus: { paid: 0, partial: 0, unpaid: 0 },
    },
  };
}

test("Reports: edit one occurrence supplier cost without changing event revenue", async ({ page }) => {
  let report = baseReport();
  let patchBody: unknown = null;
  let reportsFetches = 0;

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname === "/api/reports-v2" && request.method() === "GET") {
      reportsFetches += 1;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(report),
      });
    }

    if (url.pathname === `/api/selected-extras/${unknownId}` && request.method() === "PATCH") {
      patchBody = request.postDataJSON();
      const unitCost = (patchBody as { unitCost: number | null }).unitCost;
      const totalCost = unitCost === null ? null : unitCost;
      const margin = totalCost === null ? null : 50 - totalCost;

      report = {
        ...report,
        extras: {
          ...report.extras,
          knownCost: 40,
          knownMargin: 60,
          unknownCostCount: 0,
          items: [{
            ...report.extras.items[0],
            knownCost: 40,
            knownMargin: 60,
            unknownCostCount: 0,
            occurrences: [
              {
                ...report.extras.items[0].occurrences[0],
                unitCost,
                totalCost,
                margin,
              },
              report.extras.items[0].occurrences[1],
            ],
          }],
        },
      };

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: unknownId,
          module: "venue_events",
          entityId: eventOne,
          extraId: null,
          extraName: "Pinturas faciais",
          category: "Animação",
          unitPrice: 50,
          unitCost,
          quantity: 1,
          totalPrice: 50,
          totalCost,
          notes: null,
          sortOrder: 1,
          createdAt: "2026-09-01T10:00:00.000Z",
          updatedAt: "2026-09-28T10:00:00.000Z",
        }),
      });
    }

    return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "not mocked" }) });
  });

  await page.goto("/reports-extra-cost-test.html");

  const card = page.getByRole("button", { name: "Ver ocorrências de Pinturas faciais" });
  await expect(card).toBeVisible();
  await expect(card).toContainText("1 com custo por apurar");
  await card.click();

  const detail = page.getByRole("dialog").filter({ hasText: "Ocorrências individuais no período" });
  await expect(detail).toBeVisible();
  await expect(detail).toContainText("Custo por apurar");

  const detailText = await detail.textContent();
  expect(detailText?.indexOf("Mia")).toBeLessThan(detailText?.indexOf("Cliente B") ?? Number.MAX_SAFE_INTEGER);

  await detail.getByRole("button", { name: "Adicionar custo" }).click();

  const editor = page.getByRole("dialog").filter({ hasText: "Altera apenas o custo deste extra nesta Festa." });
  await expect(editor).toBeVisible();
  await editor.getByLabel("Pago ao fornecedor").fill("20");
  await expect(editor.getByText("30.00 €", { exact: true })).toBeVisible();
  await editor.getByRole("button", { name: "Guardar", exact: true }).click();

  await expect.poll(() => patchBody).toEqual({ unitCost: 20 });
  await expect.poll(() => reportsFetches).toBeGreaterThan(1);
  await expect(editor).toBeHidden();

  const updatedOccurrence = detail.getByTestId(`extra-occurrence-${unknownId}`);
  await expect(updatedOccurrence).toContainText("20.00 €");
  await expect(updatedOccurrence).toContainText("30.00 €");
  await expect(detail.getByText("Custo por apurar")).toHaveCount(0);

  await detail.getByRole("button", { name: "Close" }).click();
  await expect(detail).toBeHidden();
  await expect(page.getByText(/ainda com custo por apurar/)).toHaveCount(0);

  const refreshedCard = page.getByRole("button", { name: "Ver ocorrências de Pinturas faciais" });
  await expect(refreshedCard).toBeVisible();
  await expect(refreshedCard).toContainText("40.00 €");
  await expect(refreshedCard).toContainText("60.00 €");

  await page.reload();
  const cardAfterReload = page.getByRole("button", { name: "Ver ocorrências de Pinturas faciais" });
  await expect(cardAfterReload).toBeVisible();
  await cardAfterReload.click();
  const detailAfterReload = page.getByRole("dialog").filter({ hasText: "Ocorrências individuais no período" });
  const persistedOccurrence = detailAfterReload.getByTestId(`extra-occurrence-${unknownId}`);
  await expect(persistedOccurrence).toContainText("20.00 €");
  await expect(persistedOccurrence).toContainText("30.00 €");
  await expect(persistedOccurrence.getByText("Custo por apurar")).toHaveCount(0);

  expect((patchBody as Record<string, unknown>).totalPrice).toBeUndefined();
  expect((patchBody as Record<string, unknown>).totalCost).toBeUndefined();
  expect((patchBody as Record<string, unknown>).paymentStatus).toBeUndefined();
  expect(report.summary.totalRevenue).toBe(500);
  expect(report.summary.totalReceived).toBe(100);
  expect(report.extras.items[0].occurrences.map((item) => item.unitCost)).toEqual([20, 20]);
});


for (const scenario of [
  {
    status: 401,
    title: "Sessão expirada",
    description: "Volta a iniciar sessão e tenta guardar novamente.",
  },
  {
    status: 404,
    title: "Extra não encontrado",
    description: "Atualiza os Relatórios e tenta novamente.",
  },
]) {
  test(`Reports: PATCH ${scenario.status} mostra erro útil e não faz refetch`, async ({ page }) => {
    const report = baseReport();
    let reportsFetches = 0;

    await page.route("**/api/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());

      if (url.pathname === "/api/reports-v2" && request.method() === "GET") {
        reportsFetches += 1;
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(report),
        });
      }

      if (url.pathname === `/api/selected-extras/${unknownId}` && request.method() === "PATCH") {
        return route.fulfill({
          status: scenario.status,
          contentType: "application/json",
          body: JSON.stringify({ error: scenario.status === 401 ? "Unauthorized" : "Selected extra not found" }),
        });
      }

      return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
    });

    await page.goto("/reports-extra-cost-test.html");
    await page.getByRole("button", { name: "Ver ocorrências de Pinturas faciais" }).click();
    const detail = page.getByRole("dialog").filter({ hasText: "Ocorrências individuais no período" });
    await detail.getByRole("button", { name: "Adicionar custo" }).click();
    const editor = page.getByRole("dialog").filter({ hasText: "Altera apenas o custo deste extra nesta Festa." });
    await editor.getByLabel("Pago ao fornecedor").fill("20");
    await editor.getByRole("button", { name: "Guardar", exact: true }).click();

    await expect(page.getByText(scenario.title, { exact: true })).toBeVisible();
    await expect(page.getByText(scenario.description, { exact: true })).toBeVisible();
    await expect(editor).toBeVisible();
    expect(reportsFetches).toBe(1);
  });
}
