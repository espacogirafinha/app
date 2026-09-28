const ROUTES = [
  {
    name: "workshop",
    method: "GET",
    path: "/api/workshops/11111111-1111-4111-8111-111111111111",
  },
  {
    name: "workshopParticipants",
    method: "GET",
    path: "/api/workshops/11111111-1111-4111-8111-111111111111/participants",
  },
  {
    name: "workshopParticipantPatch",
    method: "PATCH",
    path: "/api/workshops/11111111-1111-4111-8111-111111111111/participants/22222222-2222-4222-8222-222222222222",
    body: {},
  },
  {
    name: "selectedExtraPatch",
    method: "PATCH",
    path: "/api/selected-extras/c27162da-5056-46c5-aaf8-93d96ed0c97a",
    body: { unitCost: 20 },
  },
  {
    name: "health",
    method: "GET",
    path: "/api/healthz",
  },
  {
    name: "root",
    method: "GET",
    path: "/",
  },
  {
    name: "reports",
    method: "GET",
    path: "/reports",
  },
];

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.end("Method Not Allowed");
    return;
  }

  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || "https";
  const base = `${proto}://${host}`;

  const forwardedHeaders = {
    accept: "application/json",
  };

  if (req.headers.cookie) {
    forwardedHeaders.cookie = req.headers.cookie;
  }
  if (req.headers["x-vercel-protection-bypass"]) {
    forwardedHeaders["x-vercel-protection-bypass"] = req.headers["x-vercel-protection-bypass"];
  }

  const results = [];
  for (const route of ROUTES) {
    const headers = { ...forwardedHeaders };
    if (route.body !== undefined) {
      headers["content-type"] = "application/json";
    }

    const response = await fetch(base + route.path, {
      method: route.method,
      headers,
      body: route.body === undefined ? undefined : JSON.stringify(route.body),
      redirect: "manual",
    });
    const text = await response.text();

    results.push({
      name: route.name,
      method: route.method,
      path: route.path,
      status: response.status,
      body: text.slice(0, 200),
      poweredBy: response.headers.get("x-powered-by"),
      vercelError: response.headers.get("x-vercel-error"),
    });
  }

  res.setHeader("content-type", "application/json");
  res.statusCode = 200;
  res.end(JSON.stringify({ results }));
}
