import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /follow-up(?:\.auth)?\.local\.spec\.ts/,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  reporter: [["list"], ["html", { outputFolder: "playwright-follow-up-report", open: "never" }]],
  use: { baseURL: "http://127.0.0.1:4177", trace: "retain-on-failure" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", testMatch: /follow-up\.auth\.local\.spec\.ts/, use: { ...devices["Desktop Safari"] } },
  ],
  webServer: {
    command: "PORT=4177 VITE_SUPABASE_URL=http://127.0.0.1:9999 VITE_SUPABASE_ANON_KEY=test-anon-key corepack pnpm --filter @workspace/girafinha dev",
    url: "http://127.0.0.1:4177/follow-up-test.html",
    timeout: 120_000,
    reuseExistingServer: true,
  },
});
