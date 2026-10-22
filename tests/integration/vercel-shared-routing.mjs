import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { createServer } from "node:http";

const base = new URL("../../", import.meta.url);
const config = JSON.parse(await readFile(new URL("vercel.json", base), "utf8"));
const names = ["event-payments", "expenses", "external-events", "selected-extras", "venue-events"];
const id = "00000000-0000-4000-8000-000000000000";
const destination = "/api/shared/_router";
for (const name of names) {
  const rule = config.rewrites.find(x => x.source === `/api/${name}/:id`);
  assert.ok(rule, "Missing explicit rewrite for " + name);
  assert.equal(rule.destination, `${destination}?__apiPath=${name}/:id`);
  await assert.rejects(
    () => readFile(new URL(`api/${name}/[id].mjs`, base), "utf8"),
    { code: "ENOENT" }, "Old adapter must be absent"
  );
}
for (const rule of config.rewrites) {
  assert.ok(!rule.source.startsWith("/api/follow-up/"));
  assert.ok(!rule.source.startsWith("/api/integrations/google-forms/review/"));
}
assert.deepEqual(config.crons, [{ path: "/api/internal/follow-up-sync", schedule: "0 9 * * *" }]);

async function countFunctions(path) {
  const entries = await readdir(path, { withFileTypes: true });
  let count = 0;
  for (const entry of entries) {
    const child = new URL(entry.name + (entry.isDirectory() ? "/" : ""), path);
    count += entry.isDirectory() ? await countFunctions(child) : Number(entry.name.endsWith(".mjs"));
  }
  return count;
}
const functions = await countFunctions(new URL("api/", base));
assert.ok(functions <= 11, `Expected at most 11 functions, found ${functions}`);

const appAdapter = (await import("../../api/shared/[...path].mjs")).default;
const observed = [];
const server = createServer((req, res) => {
  const incoming = new URL(req.url ?? "/", "http://localhost");
  const pathParts = incoming.pathname.match(/^\/api\/([^/]+)\/([^/]+)$/);
  if (!pathParts || !names.includes(pathParts[1])) {
    res.writeHead(404);
    return res.end("Missing rewrite");
  }
  const [, name, entityId] = pathParts;
  const rewritten = new URL(destination, "http://localhost");
  rewritten.searchParams.set("__apiPath", name + "/" + entityId);
  incoming.searchParams.forEach((v, k) => rewritten.searchParams.append(k, v));
  req.url = rewritten.pathname + rewritten.search;

  const originalMethod = req.method;
  const originalHeader = req.headers["x-probe"];
  appAdapter(req, res);
  observed.push({
    name, url: req.originalUrl, method: req.method,
    probeHeader: req.headers["x-probe"], originalMethod, originalHeader,
  });
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
try {
  for (const name of names) {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/api/${name}/${id}?cursor=a%2Bb&offset=2`,
      { headers: { "x-probe": "routing-test" } },
    );
    assert.notEqual(response.status, 404, "Routing must not reject " + name);
  }
  assert.equal(observed.length, 5);
  for (const entry of observed) {
    assert.equal(entry.url, `/api/${entry.name}/${id}?cursor=a%2Bb&offset=2`);
    assert.equal(entry.method, "GET");
    assert.equal(entry.originalMethod, "GET");
    assert.equal(entry.probeHeader, "routing-test");
    assert.equal(entry.originalHeader, "routing-test");
  }
  console.log(`SHARED_VERCEL_ROUTING PASS: ${functions} physical API functions; all five original URLs preserved`);
} finally {
  await new Promise(resolve => server.close(resolve));
}
