import { expect, test } from "@playwright/test";

test("desktop: preparação e dois contactos visíveis sem consultar API real", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/**", async route => {
    calls++;
    return route.fulfill({ status: 403, contentType: "application/json", body: "{}" });
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/follow-up-test.html?demo=1");
  await expect(page.getByRole("heading", { name: "Acompanhamento" })).toBeVisible();
  await expect(page.getByText("Demonstração com dados fictícios.", { exact: false })).toBeVisible();
  await expect(page.getByText("Preparação de festas (2)")).toBeVisible();
  await expect(page.getByText("Reativação de clientes (2 por contactar)")).toBeVisible();
  await expect(page.getByText("1.º contacto pendente")).toBeVisible();
  await expect(page.getByText("2.º contacto pendente")).toBeVisible();
  await expect(page.getByText("Convites tratados").first()).toBeVisible();
  await expect(page.getByText("Material tratado").first()).toBeVisible();
  expect(calls).toBe(0);
});

test("mobile 390×844: cartões, ofertas e ações sem overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/follow-up-test.html?demo=1");
  await expect(page.getByRole("heading", { name: "Acompanhamento" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Abrir WhatsApp" }).first()).toBeDisabled();
  await expect(page.getByText("Pequeno mimo na festa").first()).toBeVisible();
  const width = await page.evaluate(() => ({
    viewport: window.innerWidth,
    html: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(width.html).toBeLessThanOrEqual(width.viewport);
  expect(width.body).toBeLessThanOrEqual(width.viewport);
});

test("demo read-only: no real data changes from controls", async ({ page }) => {
  let writes = 0;
  await page.route("**/api/**", async route => {
    if (route.request().method() !== "GET") writes++;
    await route.fulfill({ status: 403, contentType: "application/json", body: "{}" });
  });
  await page.goto("/follow-up-test.html?demo=1");
  await expect(page.getByRole("button", { name: "Marcar como contactado" }).first()).toBeDisabled();
  await expect(page.getByRole("button", { name: "Abrir festa" }).first()).toBeDisabled();
  await expect(page.getByText("Marcar sem interesse").first()).toBeDisabled();
  expect(writes).toBe(0);
});

test("mock API: completing a task persists through the API and removes it from pending", async ({ page }) => {
  const writes: Array<Record<string, unknown>> = [];
  const event = {
    id: "11111111-1111-4111-8111-111111111111",
    customerName: "Ana", birthdayChildName: "Matilde", phone: "912000000",
    eventDate: "2026-11-15", theme: "Princesas", packName: "Premium",
    daysRemaining: 26, invitationsDone: false, materialsDone: true,
  };
  await page.route("**/api/follow-up**", async route => {
    const request = route.request();
    if (request.method() === "PATCH") {
      const body = request.postDataJSON() as Record<string, unknown>;
      writes.push(body);
      if (body.field === "invitations") event.invitationsDone = body.done as boolean;
      return route.fulfill({status:204,body:""});
    }
    return route.fulfill({ status:200, contentType:"application/json", body:JSON.stringify({
      preparations: event.invitationsDone ? [] : [event],
      reactivations: [],preparationCount:event.invitationsDone?0:1,contactCount:0,
      campaign:{offer_type:"none",offer_description:"",offer_value:null,offer_scope:"both"},
    }) });
  });
  await page.goto("/follow-up-test.html");
  await expect(page.getByText("Preparação de festas (1)")).toBeVisible();
  await page.getByRole("checkbox", {name:"Convites tratados"}).click();
  await expect(page.getByText("Preparação de festas (0)")).toBeVisible();
  expect(writes).toEqual([{field:"invitations",done:true}]);
});

test("mock API: opening WhatsApp does not mark contacted; separate action does", async ({ page }) => {
  let contacted = false;
  const writes: Array<Record<string, unknown>> = [];
  await page.route("**/api/follow-up**", async route => {
    const request = route.request();
    if (request.method() === "PATCH") {
      const body = request.postDataJSON() as Record<string, unknown>;
      writes.push(body);
      if (body.action === "contact") contacted = true;
      return route.fulfill({status:204,body:""});
    }
    return route.fulfill({ status:200, contentType:"application/json", body:JSON.stringify({
      preparations: [], preparationCount:0, contactCount:contacted?0:1,
      campaign:{offer_type:"none",offer_description:"",offer_value:null,offer_scope:"both"},
      reactivations:[{
        id:"22222222-2222-4222-8222-222222222222",
        source:{id:"33333333-3333-4333-8333-333333333333",
          customerName:"Ana",birthdayChildName:"Matilde",phone:"912000000",eventDate:"2026-01-20"},
        theme:"Princesas",packName:"Premium",estimate:"2027-01-20",
        firstDue:"2026-10-20",secondDue:"2026-12-09",
        firstContactedAt:contacted?"2026-10-20T12:00:00Z":null,
        secondContactedAt:null,stage:contacted?null:"first",
        needsReview:false,reviewCandidates:[],converted:false,conversion:null,noInterest:false,
        offer:{type:"none",description:"",value:null,scope:"both",proposedAt:null,usedAt:null},
      }],
    }) });
  });
  await page.goto("/follow-up-test.html");
  await expect(page.getByText("1.º contacto pendente")).toBeVisible();
  const whatsapp = page.getByRole("link", {name:"Abrir WhatsApp"});
  await expect(whatsapp).toHaveAttribute("href", /wa\.me\/351912000000\?text=/);
  expect(writes).toHaveLength(0);
  await page.getByRole("button", {name:"Marcar como contactado"}).click();
  await expect(page.getByText("1.º contacto realizado")).toBeVisible();
  expect(writes).toEqual([{action:"contact",stage:"first"}]);
});
