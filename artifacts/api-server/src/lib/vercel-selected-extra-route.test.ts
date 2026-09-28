import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Vercel exposes an explicit dynamic function for selected-extra ids", () => {
  const entrypoint = new URL("../../../../api/selected-extras/[id].mjs", import.meta.url);
  const source = readFileSync(entrypoint, "utf8");

  assert.match(source, /artifacts\/api-server\/dist\/app\.mjs/);
});
