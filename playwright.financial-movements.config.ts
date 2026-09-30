import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /financial-movements\.local\.spec\.ts/,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4177",
    ...devices["Desktop Chrome"],
    trace: "retain-on-failure",
  },
  webServer: {
    command: "PORT=4177 VITE_SUPABASE_URL=http://127.0.0.1:9999 VITE_SUPABASE_ANON_KEY=test-anon-key corepack pnpm --filter @workspace/girafinha dev",
    url: "http://127.0.0.1:4177/financial-movements-test.html",
    timeout: 120_000,
    reuseExistingServer: true,
  },
});
