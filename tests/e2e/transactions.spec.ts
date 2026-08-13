import { expect, test } from "@playwright/test";

import { monitorCriticalBrowserErrors } from "./helpers/browser-errors";
import {
  deleteRecordThroughUi,
  ExactCleanup,
  expandRecord,
  expectCalendarItem,
  formControl,
  futureDateIso,
  getParticipants,
  recordSummary,
  requestAppApi,
  responseEntityId,
  uniqueRunId,
  waitForApiResponse,
} from "./helpers/transactions";

test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);

test("Festa no Espaço: CREATE, READ, UPDATE, calendário e DELETE", async ({
  page,
}, testInfo) => {
  const assertNoCriticalErrors = monitorCriticalBrowserErrors(page, testInfo);
  const cleanup = new ExactCleanup(page, testInfo);
  const runId = uniqueRunId();
  const name = "TESTE E2E Festa " + runId;
  const updatedNote = "TESTE E2E observacao festa " + runId;
  const eventDate = futureDateIso(60);
  let eventId = "";

  try {
    await page.goto("/venue-events");
    await page.getByRole("button", { name: "Nova Festa" }).click();

    const dialog = page.getByRole("dialog", {
      name: "Nova Festa no Espa\u00e7o",
    });
    await expect(dialog).toBeVisible();
    await formControl(dialog, "Nome").fill(name);
    await formControl(dialog, "Telem\u00f3vel").fill("000000000");
    await formControl(dialog, "Data").fill(eventDate);

    const createResponsePromise = waitForApiResponse(
      page,
      "POST",
      "/api/venue-events",
    );
    await dialog
      .getByRole("button", { name: "Guardar Festa", exact: true })
      .click();
    eventId = await responseEntityId(await createResponsePromise);
    cleanup.trackEntity("venue event", eventId, "/api/venue-events/" + eventId);

    await expect(dialog).toBeHidden();
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();

    let expanded = await expandRecord(page, name);
    await expect(expanded).toContainText("10:00-13:00");
    await expect(expanded).toContainText("Pack Simples");
    await expect(expanded).toContainText("Em prepara\u00e7\u00e3o");

    await expanded.getByRole("button", { name: "Editar", exact: true }).click();
    const editDialog = page.getByRole("dialog", {
      name: "Editar Festa no Espa\u00e7o",
    });
    await editDialog
      .getByRole("button", { name: "16h \u00e0s 19h", exact: true })
      .click();
    await formControl(editDialog, "N\u00ba crian\u00e7as").fill("7");
    await formControl(editDialog, "Observa\u00e7\u00f5es internas").fill(
      updatedNote,
    );

    const updateResponsePromise = waitForApiResponse(
      page,
      "PATCH",
      "/api/venue-events/" + eventId,
    );
    await editDialog
      .getByRole("button", { name: "Guardar altera\u00e7\u00f5es" })
      .click();
    expect((await updateResponsePromise).status()).toBe(200);
    await expect(editDialog).toBeHidden();

    expanded = page
      .getByRole("heading", { name, exact: true })
      .locator("xpath=ancestor::div[.//button[normalize-space()='Apagar']][1]");
    await expect(expanded).toContainText("16:00-19:00");
    await expect(expanded).toContainText("7 crian\u00e7as");
    await expect(expanded).toContainText(updatedNote);

    await expectCalendarItem(page, eventDate, eventId, name, true);
    await deleteRecordThroughUi(
      page,
      "/venue-events",
      name,
      "/api/venue-events/" + eventId,
      "Apagar esta festa?",
    );
    await expectCalendarItem(page, eventDate, eventId, name, false);
  } finally {
    await cleanup.cleanup();
    await assertNoCriticalErrors();
  }
});

test("Serviço Externo: CREATE, READ, UPDATE, calendário e DELETE", async ({
  page,
}, testInfo) => {
  const assertNoCriticalErrors = monitorCriticalBrowserErrors(page, testInfo);
  const cleanup = new ExactCleanup(page, testInfo);
  const runId = uniqueRunId();
  const name = "TESTE E2E Servi\u00e7o " + runId;
  const updatedNote = "TESTE E2E observacao servico " + runId;
  const eventDate = futureDateIso(61);
  let eventId = "";

  try {
    await page.goto("/external-events");
    await page.getByRole("button", { name: "Novo Servi\u00e7o" }).click();

    const dialog = page.getByRole("dialog", {
      name: "Novo Servi\u00e7o Externo",
    });
    await expect(dialog).toBeVisible();
    await formControl(dialog, "Nome").fill(name);
    await formControl(dialog, "Telem\u00f3vel").fill("000000000");
    await formControl(dialog, "Data").fill(eventDate);
    await formControl(dialog, "Hora in\u00edcio").fill("11:00");
    await formControl(dialog, "Hora fim").fill("13:00");
    await formControl(dialog, "Local/morada").fill("Local ficticio TESTE E2E");
    await dialog.getByRole("button", { name: /^Decora/ }).click();

    const createResponsePromise = waitForApiResponse(
      page,
      "POST",
      "/api/external-events",
    );
    await dialog
      .getByRole("button", { name: "Guardar Servi\u00e7o", exact: true })
      .click();
    const createResponse = await createResponsePromise;
    eventId = await responseEntityId(createResponse);
    cleanup.trackEntity(
      "external event",
      eventId,
      "/api/external-events/" + eventId,
    );

    const createdBody = (await createResponse.json()) as {
      services?: Array<{ serviceLabel?: string }>;
    };
    const selectedService = createdBody.services?.[0]?.serviceLabel;
    expect(selectedService).toBeTruthy();

    await expect(dialog).toBeHidden();
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();

    let expanded = await expandRecord(page, name);
    await expect(expanded).toContainText("11:00-13:00");
    await expect(expanded).toContainText(selectedService ?? "");
    await expect(expanded).toContainText("Em prepara\u00e7\u00e3o");

    await expanded.getByRole("button", { name: "Editar", exact: true }).click();
    const editDialog = page.getByRole("dialog", {
      name: "Editar Servi\u00e7o Externo",
    });
    await formControl(editDialog, "Hora in\u00edcio").fill("15:30");
    await formControl(editDialog, "Hora fim").fill("18:30");
    await formControl(editDialog, "Observa\u00e7\u00f5es internas").fill(
      updatedNote,
    );

    const updateResponsePromise = waitForApiResponse(
      page,
      "PATCH",
      "/api/external-events/" + eventId,
    );
    await editDialog
      .getByRole("button", { name: "Guardar altera\u00e7\u00f5es" })
      .click();
    expect((await updateResponsePromise).status()).toBe(200);
    await expect(editDialog).toBeHidden();

    expanded = page
      .getByRole("heading", { name, exact: true })
      .locator("xpath=ancestor::div[.//button[normalize-space()='Apagar']][1]");
    await expect(expanded).toContainText("15:30-18:30");
    await expect(expanded).toContainText(updatedNote);

    await expectCalendarItem(page, eventDate, eventId, name, true);
    await deleteRecordThroughUi(
      page,
      "/external-events",
      name,
      "/api/external-events/" + eventId,
      "Apagar este servi\u00e7o externo?",
    );
    await expectCalendarItem(page, eventDate, eventId, name, false);
  } finally {
    await cleanup.cleanup();
    await assertNoCriticalErrors();
  }
});

test("Workshop e participante: CRUD, cancelamento, calendário e cleanup", async ({
  page,
}, testInfo) => {
  const assertNoCriticalErrors = monitorCriticalBrowserErrors(page, testInfo);
  const cleanup = new ExactCleanup(page, testInfo);
  const runId = uniqueRunId();
  const workshopName = "TESTE E2E Workshop " + runId;
  const participantName = "TESTE E2E Participante " + runId;
  const updatedDescription = "TESTE E2E descricao workshop " + runId;
  const participantNote = "TESTE E2E nota participante " + runId;
  const workshopDate = futureDateIso(62);
  let workshopId = "";
  let participantId = "";

  try {
    await page.goto("/workshops");
    await page.getByRole("button", { name: "Novo Workshop" }).click();

    const dialog = page.getByRole("dialog", { name: "Novo Workshop" });
    await expect(dialog).toBeVisible();
    await formControl(dialog, "Nome do workshop").fill(workshopName);
    await formControl(dialog, "Estado").selectOption("open");
    await formControl(dialog, "Data").fill(workshopDate);
    await formControl(dialog, "Hora in\u00edcio").fill("10:30");
    await formControl(dialog, "Hora fim").fill("12:30");
    await formControl(dialog, "N\u00ba vagas").fill("10");
    await formControl(dialog, "Pre\u00e7o por participante").fill("15");

    const createResponsePromise = waitForApiResponse(
      page,
      "POST",
      "/api/workshops",
    );
    await dialog
      .getByRole("button", { name: "Guardar Workshop", exact: true })
      .click();
    workshopId = await responseEntityId(await createResponsePromise);
    cleanup.trackEntity("workshop", workshopId, "/api/workshops/" + workshopId);

    await expect(dialog).toBeHidden();
    await expect(
      page.getByRole("heading", { name: workshopName, exact: true }),
    ).toBeVisible();

    let expanded = await expandRecord(page, workshopName);
    await expect(expanded).toContainText("10:30-12:30");
    await expect(expanded).toContainText("Inscri\u00e7\u00f5es abertas");

    await expanded.getByRole("button", { name: "Editar", exact: true }).click();
    const editDialog = page.getByRole("dialog", { name: "Editar Workshop" });
    await formControl(editDialog, "Hora in\u00edcio").fill("14:30");
    await formControl(editDialog, "Hora fim").fill("16:30");
    await formControl(editDialog, "N\u00ba vagas").fill("12");
    await formControl(editDialog, "Descri\u00e7\u00e3o").fill(
      updatedDescription,
    );

    const updateResponsePromise = waitForApiResponse(
      page,
      "PATCH",
      "/api/workshops/" + workshopId,
    );
    await editDialog
      .getByRole("button", { name: "Guardar altera\u00e7\u00f5es" })
      .click();
    expect((await updateResponsePromise).status()).toBe(200);
    await expect(editDialog).toBeHidden();

    expanded = page
      .getByRole("heading", { name: workshopName, exact: true })
      .locator("xpath=ancestor::div[.//button[normalize-space()='Apagar']][1]");
    await expect(expanded).toContainText("14:30-16:30");
    await expect(expanded).toContainText("Capacidade: 12");
    await expect(expanded).toContainText(updatedDescription);

    await expectCalendarItem(
      page,
      workshopDate,
      workshopId,
      workshopName,
      true,
    );

    await page.goto("/workshops");
    await expect(
      page.getByRole("heading", { name: workshopName, exact: true }),
    ).toBeVisible();
    await recordSummary(page, workshopName)
      .getByRole("button", { name: "Participantes", exact: true })
      .click();

    const participantsDialog = page
      .getByRole("dialog")
      .filter({ hasText: workshopName });
    await expect(participantsDialog).toBeVisible();
    await participantsDialog
      .getByRole("button", { name: "Adicionar participante", exact: true })
      .click();

    const addParticipantDialog = page.getByRole("dialog", {
      name: "Adicionar participante",
    });
    await formControl(addParticipantDialog, "Nome").fill(participantName);
    await formControl(addParticipantDialog, "Telem\u00f3vel").fill("000000000");
    await formControl(addParticipantDialog, "Email").fill(
      "e2e-" + runId + "@example.invalid",
    );

    const participantCreatePromise = waitForApiResponse(
      page,
      "POST",
      "/api/workshops/" + workshopId + "/participants",
    );
    await addParticipantDialog
      .getByRole("button", { name: "Adicionar participante", exact: true })
      .click();
    participantId = await responseEntityId(await participantCreatePromise);
    cleanup.trackParticipant(workshopId, participantId);
    await expect(addParticipantDialog).toBeHidden();

    let participantCard = participantsDialog
      .getByRole("heading", { name: participantName, exact: true })
      .locator("xpath=ancestor::div[.//button[normalize-space()='Editar']][1]");
    await expect(participantCard).toContainText("Inscrito");
    await expect(participantCard).toContainText("Por pagar");

    await participantCard
      .getByRole("button", { name: "Editar", exact: true })
      .click();
    const editParticipantDialog = page.getByRole("dialog", {
      name: "Editar participante",
    });
    await formControl(editParticipantDialog, "Estado").selectOption(
      "confirmed",
    );
    await formControl(editParticipantDialog, "Observa\u00e7\u00f5es").fill(
      participantNote,
    );

    const participantUpdatePromise = waitForApiResponse(
      page,
      "PATCH",
      "/api/workshops/" + workshopId + "/participants/" + participantId,
    );
    await editParticipantDialog
      .getByRole("button", { name: "Guardar altera\u00e7\u00f5es" })
      .click();
    expect((await participantUpdatePromise).status()).toBe(200);
    await expect(editParticipantDialog).toBeHidden();

    participantCard = participantsDialog
      .getByRole("heading", { name: participantName, exact: true })
      .locator("xpath=ancestor::div[.//button[normalize-space()='Editar']][1]");
    await expect(participantCard).toContainText("Confirmado");
    await expect(participantCard).toContainText(participantNote);

    await participantCard
      .getByRole("button", { name: "Cancelar", exact: true })
      .click();
    const cancelAlert = page.getByRole("alertdialog", {
      name: "Cancelar inscri\u00e7\u00e3o?",
    });
    const cancelResponsePromise = waitForApiResponse(
      page,
      "PATCH",
      "/api/workshops/" + workshopId + "/participants/" + participantId,
    );
    await cancelAlert
      .getByRole("button", { name: "Cancelar inscri\u00e7\u00e3o" })
      .click();
    expect((await cancelResponsePromise).status()).toBe(200);
    await expect(participantCard).toContainText("Cancelado");

    await participantCard
      .getByRole("button", { name: "Apagar", exact: true })
      .click();
    const deleteParticipantAlert = page.getByRole("alertdialog", {
      name: "Apagar participante?",
    });
    const deleteParticipantPromise = waitForApiResponse(
      page,
      "DELETE",
      "/api/workshops/" + workshopId + "/participants/" + participantId,
    );
    await deleteParticipantAlert
      .getByRole("button", { name: "Apagar", exact: true })
      .click();
    expect((await deleteParticipantPromise).status()).toBe(204);
    await expect(
      participantsDialog.getByRole("heading", {
        name: participantName,
        exact: true,
      }),
    ).toHaveCount(0);

    const workshopAfterParticipant = await requestAppApi(
      page,
      "/api/workshops/" + workshopId,
    );
    expect(workshopAfterParticipant.status).toBe(200);
    expect(
      getParticipants(workshopAfterParticipant.body).some(
        (participant) => participant.id === participantId,
      ),
    ).toBe(false);

    await participantsDialog
      .getByRole("button", { name: "Close", exact: true })
      .click();
    await expect(participantsDialog).toBeHidden();

    await deleteRecordThroughUi(
      page,
      "/workshops",
      workshopName,
      "/api/workshops/" + workshopId,
      "Apagar este workshop?",
    );
    await expectCalendarItem(
      page,
      workshopDate,
      workshopId,
      workshopName,
      false,
    );
  } finally {
    await cleanup.cleanup();
    await assertNoCriticalErrors();
  }
});
