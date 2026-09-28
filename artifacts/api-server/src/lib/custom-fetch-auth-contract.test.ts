import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("customFetch attaches configured bearer auth to API requests", () => {
  const sourceUrl = new URL("../../../../lib/api-client-react/src/custom-fetch.ts", import.meta.url);
  const source = readFileSync(sourceUrl, "utf8");

  assert.match(source, /_authTokenGetter/);
  assert.match(source, /headers\.set\("authorization", `Bearer \$\{token\}`\)/);
  assert.match(source, /credentials:\s*"include"/);
});

test("web auth provider configures customFetch from Supabase session", () => {
  const sourceUrl = new URL("../../../girafinha/src/hooks/use-auth.tsx", import.meta.url);
  const source = readFileSync(sourceUrl, "utf8");

  assert.match(source, /setAuthTokenGetter/);
  assert.match(source, /supabase\.auth\.getSession\(\)/);
  assert.match(source, /session\?\.access_token/);
});
