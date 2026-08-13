import { expect, type Page, type TestInfo } from "@playwright/test";

const CRITICAL_CONSOLE_ERROR =
  /ChunkLoadError|Loading chunk .* failed|Failed to fetch dynamically imported module|Importing a module script failed|uncaught|unhandled/i;

export function monitorCriticalBrowserErrors(page: Page, testInfo: TestInfo) {
  const criticalErrors: string[] = [];
  const consoleErrors: string[] = [];

  page.on("pageerror", (error) => {
    criticalErrors.push(`pageerror: ${error.message}`);
  });

  page.on("console", (message) => {
    if (message.type() !== "error") return;

    const messageText = message.text();
    consoleErrors.push(messageText);
    if (CRITICAL_CONSOLE_ERROR.test(messageText)) {
      criticalErrors.push(`console: ${messageText}`);
    }
  });

  page.on("requestfailed", (request) => {
    if (request.resourceType() !== "script") return;
    criticalErrors.push(
      `script request failed: ${request.url()} (${request.failure()?.errorText ?? "unknown error"})`,
    );
  });

  page.on("response", (response) => {
    if (
      response.request().resourceType() !== "script" ||
      response.status() < 400
    )
      return;
    criticalErrors.push(
      `script response failed: ${response.status()} ${response.url()}`,
    );
  });

  return async () => {
    if (consoleErrors.length > 0) {
      await testInfo.attach("browser-console-errors", {
        body: Buffer.from(consoleErrors.join("\n")),
        contentType: "text/plain",
      });
    }

    expect(criticalErrors, criticalErrors.join("\n")).toEqual([]);
  };
}
