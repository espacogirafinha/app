import {
  expect,
  type Locator,
  type Page,
  type Response,
  type TestInfo,
} from "@playwright/test";

type AppApiResult = { status: number; body: unknown };

type ExactResource =
  | {
      kind: "venue event" | "external event" | "workshop";
      id: string;
      path: string;
    }
  | {
      kind: "workshop participant";
      id: string;
      path: string;
      parentPath: string;
    };

export class ExactCleanup {
  private readonly resources: ExactResource[] = [];

  constructor(
    private readonly page: Page,
    private readonly testInfo: TestInfo,
  ) {}

  trackEntity(
    kind: "venue event" | "external event" | "workshop",
    id: string,
    path: string,
  ) {
    this.resources.push({ kind, id, path });
  }

  trackParticipant(workshopId: string, participantId: string) {
    this.resources.push({
      kind: "workshop participant",
      id: participantId,
      path: "/api/workshops/" + workshopId + "/participants/" + participantId,
      parentPath: "/api/workshops/" + workshopId,
    });
  }

  async cleanup() {
    const results: string[] = [];
    const failures: string[] = [];

    for (const resource of [...this.resources].reverse()) {
      try {
        const deletion = await requestAppApi(
          this.page,
          resource.path,
          "DELETE",
        );
        if (![204, 404].includes(deletion.status)) {
          throw new Error("DELETE returned HTTP " + deletion.status);
        }

        if (resource.kind === "workshop participant") {
          const parent = await requestAppApi(this.page, resource.parentPath);
          if (parent.status === 200) {
            expect(
              getParticipants(parent.body).some(
                (participant) => participant.id === resource.id,
              ),
              "participant " +
                resource.id +
                " still exists in " +
                resource.parentPath,
            ).toBe(false);
          } else {
            expect(parent.status).toBe(404);
          }
        } else {
          const verification = await requestAppApi(this.page, resource.path);
          expect(
            verification.status,
            resource.kind + " " + resource.id + " still exists after cleanup",
          ).toBe(404);
        }

        results.push(
          resource.kind +
            " " +
            resource.id +
            ": clean (DELETE " +
            deletion.status +
            ")",
        );
      } catch (error) {
        failures.push(
          resource.kind +
            " " +
            resource.id +
            ": " +
            (error instanceof Error ? error.message : String(error)),
        );
      }
    }

    await this.testInfo.attach("transaction-cleanup", {
      body: Buffer.from([...results, ...failures].join("\n")),
      contentType: "text/plain",
    });

    if (failures.length > 0) {
      throw new Error("Exact E2E cleanup failed:\n" + failures.join("\n"));
    }
  }
}

export function formControl(container: Locator, label: string) {
  const labelPattern = new RegExp("^" + escapeRegex(label) + "(?:\\s*\\*)?$");
  return container
    .locator("label")
    .filter({ hasText: labelPattern })
    .locator("xpath=..")
    .locator("input, textarea, select");
}

export function recordSummary(page: Page, name: string) {
  return page
    .getByRole("heading", { name, exact: true })
    .locator("xpath=ancestor::div[.//button[normalize-space()='Detalhes']][1]");
}

export async function expandRecord(page: Page, name: string) {
  await recordSummary(page, name)
    .getByRole("button", { name: "Detalhes", exact: true })
    .click();

  return page
    .getByRole("heading", { name, exact: true })
    .locator("xpath=ancestor::div[.//button[normalize-space()='Apagar']][1]");
}

export async function deleteRecordThroughUi(
  page: Page,
  listPath: string,
  name: string,
  apiPath: string,
  confirmTitle: string,
) {
  await page.goto(listPath);
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();

  const expanded = await expandRecord(page, name);
  await expanded.getByRole("button", { name: "Apagar", exact: true }).click();

  const alert = page.getByRole("alertdialog", { name: confirmTitle });
  await expect(alert).toBeVisible();

  const responsePromise = waitForApiResponse(page, "DELETE", apiPath);
  await alert.getByRole("button", { name: "Apagar", exact: true }).click();
  const response = await responsePromise;

  expect(response.status()).toBe(204);
  await expect(page.getByRole("heading", { name, exact: true })).toHaveCount(0);
  await expectExactEntityMissing(page, apiPath);
}

export async function expectCalendarItem(
  page: Page,
  date: string,
  id: string,
  title: string,
  present: boolean,
) {
  await page.goto("/calendar");
  await expect(
    page.getByRole("heading", { name: "Calend\u00e1rio V2" }),
  ).toBeVisible();

  const result = await requestAppApi(
    page,
    "/api/calendar-v2?startDate=" + date + "&endDate=" + date,
  );
  expect(result.status).toBe(200);

  const item = getCalendarItems(result.body).find(
    (candidate) => candidate.id === id,
  );
  if (present) {
    expect(item).toBeDefined();
    expect([item?.title, item?.customerName]).toContain(title);
  } else {
    expect(item).toBeUndefined();
  }
}

export async function expectExactEntityMissing(page: Page, path: string) {
  const result = await requestAppApi(page, path);
  expect(result.status, "expected " + path + " to return 404").toBe(404);
}

export async function requestAppApi(
  page: Page,
  path: string,
  method: "GET" | "DELETE" = "GET",
): Promise<AppApiResult> {
  const accessToken = await page.evaluate(() => {
    const authEntry = Object.entries(localStorage).find(([key]) =>
      /^sb-.+-auth-token$/.test(key),
    );
    if (!authEntry) return null;

    const session = JSON.parse(authEntry[1]) as {
      access_token?: string;
      currentSession?: { access_token?: string };
    };
    return session.access_token ?? session.currentSession?.access_token ?? null;
  });

  if (!accessToken) {
    return { status: 0, body: { error: "Authenticated session not found" } };
  }

  const response = await page.request.fetch(
    new URL(path, page.url()).toString(),
    {
      method,
      headers: { authorization: "Bearer " + accessToken },
      failOnStatusCode: false,
    },
  );
  const text = await response.text();
  let body: unknown = null;

  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  return { status: response.status(), body };
}

export function waitForApiResponse(
  page: Page,
  method: string,
  path: string | RegExp,
) {
  return page.waitForResponse((response) => {
    const pathname = new URL(response.url()).pathname;
    const matchesPath =
      typeof path === "string" ? pathname === path : path.test(pathname);
    return response.request().method() === method && matchesPath;
  });
}

export async function responseEntityId(response: Response) {
  expect(response.status()).toBe(201);
  const body = (await response.json()) as { id?: unknown };
  expect(typeof body.id).toBe("string");
  expect(body.id).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  return body.id;
}

export function futureDateIso(offsetDays: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

export function uniqueRunId() {
  const timestamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  const random = Math.random().toString(36).slice(2, 7);
  return timestamp + "-" + random;
}

export function getParticipants(body: unknown) {
  if (!body || typeof body !== "object") return [];
  const participants = (body as { participants?: unknown }).participants;
  if (!Array.isArray(participants)) return [];

  return participants.filter(
    (participant): participant is { id: string; status?: string } =>
      Boolean(
        participant &&
        typeof participant === "object" &&
        typeof (participant as { id?: unknown }).id === "string",
      ),
  );
}

function getCalendarItems(body: unknown) {
  if (!body || typeof body !== "object") return [];
  const items = (body as { items?: unknown }).items;
  if (!Array.isArray(items)) return [];

  return items.filter(
    (
      item,
    ): item is { id: string; title: string; customerName?: string | null } =>
      Boolean(
        item &&
        typeof item === "object" &&
        typeof (item as { id?: unknown }).id === "string" &&
        typeof (item as { title?: unknown }).title === "string",
      ),
  );
}

function escapeRegex(value: string) {
  return value.replace(/[|\\{}()[\]^$+*?.-]/g, "\\$&");
}
