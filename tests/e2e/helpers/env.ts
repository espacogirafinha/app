export type E2EEnvName = "E2E_BASE_URL" | "E2E_EMAIL" | "E2E_PASSWORD";

export function requireE2EEnv(name: E2EEnvName): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. Set E2E_BASE_URL, E2E_EMAIL and E2E_PASSWORD before running E2E tests.`,
    );
  }

  return value;
}
