import assert from "node:assert/strict";
import test from "node:test";
import {
  customFetch,
  setAuthTokenGetter,
} from "../../../../lib/api-client-react/src/custom-fetch.ts";

test("customFetch attaches the Supabase bearer token to API requests", async () => {
  const originalFetch = globalThis.fetch;
  let authorization: string | null = null;

  globalThis.fetch = async (_input, init) => {
    authorization = new Headers(init?.headers).get("authorization");
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  setAuthTokenGetter(async () => "test-access-token");

  try {
    await customFetch("/api/selected-extras/example", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ unitCost: 20 }),
      responseType: "json",
    });
    assert.equal(authorization, "Bearer test-access-token");
  } finally {
    setAuthTokenGetter(null);
    globalThis.fetch = originalFetch;
  }
});
