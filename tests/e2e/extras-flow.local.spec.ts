import { expect, test } from "@playwright/test";

const eventId = "11111111-1111-4111-8111-111111111111";

const initialCatalog = [
  { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "Mascote", category: "Animação", basePrice: 90, baseCost: 75, appliesTo: "venue_events", isActive: true, sortOrder: 1, internalNotes: null, createdAt: "2026-09-28T10:00:00.000Z", updatedAt: "2026-09-28T10:00:00.000Z" },
  { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "Bolo", category: "Catering", basePrice: 55, baseCost: 38, appliesTo: "venue_events", isActive: true, sortOrder: 2, internalNotes: null, createdAt: "2026-09-28T10:00:00.000Z", updatedAt: "2026-09-28T10:00:00.000Z" },
  { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", name: "Pinturas faciais", category: "Animação", basePrice: 100, baseCost: 70, appliesTo: "venue_events", isActive: true, sortOrder: 3, internalNotes: null, createdAt: "2026-09-28T10:00:00.000Z", updatedAt: "2026-09-28T10:00:00.000Z" },
];

const changedCatalog = initialCatalog.map((extra, index) => ({
  ...extra,
  basePrice: 500 + index,
  baseCost: 400 + index,
  updatedAt: "2026-09-29T10:00:00.000Z",
}));

const venuePack = {
  id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  name: "Pack Simples",
  description: null,
  basePrice: 220,
  defaultStartTime: "10:00",
  defaultEndTime: "13:00",
  isActive: true,
  sortOrder: 1,
  internalNotes: null,
  createdAt: "2026-09-28T10:00:00.000Z",
  updatedAt: "2026-09-28T10:00:00.000Z",
};

test("Festa real UI: 3 extras chegam num único payload e reaparecem ao reabrir", async ({ page }) => {
  let savedItems: Array<Record<string, unknown>> = [];
  let replacePayload: { module?: string; entityId?: string; items?: Array<Record<string, unknown>> } | null = null;
  let useChangedCatalog = false;

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (path === "/api/settings/venue-packs" && method === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([venuePack]) });
    }

    if (path === "/api/settings/event-extras" && method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(useChangedCatalog ? changedCatalog : initialCatalog),
      });
    }

    if (path === "/api/venue-events" && method === "POST") {
      const body = request.postDataJSON() as Record<string, unknown>;
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: eventId,
          customerName: body.customerName,
          phone: body.phone,
          email: body.email ?? null,
          nif: body.nif ?? null,
          source: body.source ?? null,
          eventDate: body.eventDate,
          startTime: body.startTime,
          endTime: body.endTime ?? null,
          status: body.status ?? "draft",
          paymentStatus: "unpaid",
          packName: body.packName,
          birthdayChildName: body.birthdayChildName ?? null,
          birthdayChildAge: body.birthdayChildAge ?? null,
          childrenCount: body.childrenCount ?? 0,
          childrenAges: body.childrenAges ?? null,
          partyTheme: body.partyTheme ?? null,
          decorationNotes: body.decorationNotes ?? null,
          cateringNotes: body.cateringNotes ?? null,
          allergies: body.allergies ?? null,
          imageAuthorization: body.imageAuthorization ?? null,
          termsAccepted: body.termsAccepted ?? false,
          totalPrice: body.totalPrice,
          amountPaid: 0,
          remainingBalance: body.totalPrice,
          expectedReservationDepositAmount: body.expectedReservationDepositAmount ?? null,
          reservationDepositPolicy: body.reservationDepositPolicy ?? "auto_20",
          notes: body.notes ?? null,
          createdAt: "2026-09-28T10:00:00.000Z",
          updatedAt: "2026-09-28T10:00:00.000Z",
        }),
      });
    }

    if (path === "/api/selected-extras" && method === "POST") {
      replacePayload = request.postDataJSON() as typeof replacePayload;
      savedItems = (replacePayload?.items ?? []).map((item, index) => ({
        id: `eeeeeeee-eeee-4eee-8eee-${String(index + 1).padStart(12, "0")}`,
        module: replacePayload?.module,
        entityId: replacePayload?.entityId,
        ...item,
        createdAt: "2026-09-28T10:00:00.000Z",
        updatedAt: "2026-09-28T10:00:00.000Z",
      }));
      useChangedCatalog = true;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(savedItems) });
    }

    if (path === "/api/selected-extras" && method === "GET") {
      expect(url.searchParams.get("module")).toBe("venue_events");
      expect(url.searchParams.get("entityId")).toBe(eventId);
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(savedItems) });
    }

    if (path === "/api/event-attachments" && method === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    }

    return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  await page.goto("/extras-flow-test.html");

  await page.getByRole("button", { name: "Nova Festa Teste" }).click();
  const createDialog = page.getByRole("dialog", { name: "Nova Festa no Espaço" });
  const selector = createDialog.getByTestId("event-extras-selector");

  await expect(selector).toHaveAttribute("data-selected-count", "0");

  await createDialog.getByRole("button", { name: /Mascote/ }).click();
  await expect(selector).toHaveAttribute("data-selected-count", "1");

  await createDialog.getByRole("button", { name: /Bolo/ }).click();
  await expect(selector).toHaveAttribute("data-selected-count", "2");

  await createDialog.getByRole("button", { name: /Pinturas faciais/ }).click();
  await expect(selector).toHaveAttribute("data-selected-count", "3");

  await createDialog.getByLabel("Preço de Mascote").fill("90");
  await createDialog.getByLabel("Custo de Mascote").fill("75");
  await createDialog.getByLabel("Preço de Bolo").fill("55");
  await createDialog.getByLabel("Custo de Bolo").fill("");
  await createDialog.getByLabel("Preço de Pinturas faciais").fill("100");
  await createDialog.getByLabel("Custo de Pinturas faciais").fill("0");

  await createDialog.getByLabel("Nome").first().fill("Teste múltiplos extras");
  await createDialog.getByLabel("Telemóvel").fill("000000000");
  await createDialog.getByLabel("Data").fill("2026-12-15");

  await createDialog.getByRole("button", { name: "Guardar Festa", exact: true }).click();
  await expect(createDialog).toBeHidden();

  expect(replacePayload).not.toBeNull();
  expect(replacePayload?.module).toBe("venue_events");
  expect(replacePayload?.entityId).toBe(eventId);
  expect(replacePayload?.items).toHaveLength(3);
  expect(replacePayload?.items?.map((item) => item.extraName)).toEqual(["Mascote", "Bolo", "Pinturas faciais"]);
  expect(replacePayload?.items?.map((item) => item.unitPrice)).toEqual([90, 55, 100]);
  expect(replacePayload?.items?.map((item) => item.unitCost)).toEqual([75, null, 0]);

  await page.reload();
  await page.getByRole("button", { name: "Reabrir Festa Teste" }).click();

  const editDialog = page.getByRole("dialog", { name: "Editar Festa no Espaço" });
  const reopenedSelector = editDialog.getByTestId("event-extras-selector");

  await expect(reopenedSelector).toHaveAttribute("data-selected-count", "3");
  await expect(editDialog.getByLabel("Preço de Mascote")).toHaveValue("90");
  await expect(editDialog.getByLabel("Custo de Mascote")).toHaveValue("75");
  await expect(editDialog.getByLabel("Preço de Bolo")).toHaveValue("55");
  await expect(editDialog.getByLabel("Custo de Bolo")).toHaveValue("");
  await expect(editDialog.getByLabel("Preço de Pinturas faciais")).toHaveValue("100");
  await expect(editDialog.getByLabel("Custo de Pinturas faciais")).toHaveValue("0");
});
