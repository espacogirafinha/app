import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /extras-flow\.local\.spec\.ts/,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    ...devices["Desktop Chrome"],
    trace: "retain-on-failure",
  },
  webServer: {
    command: "PORT=4173 corepack pnpm --filter @workspace/girafinha dev",
    url: "http://127.0.0.1:4173/extras-flow-test.html",
    timeout: 120_000,
    reuseExistingServer: false,
  },
});
