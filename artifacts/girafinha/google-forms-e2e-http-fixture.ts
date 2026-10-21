import type { Plugin } from "vite";

type ReviewWrite = { path: string; body: unknown; hasBearer: boolean; status: number };
type State = { reads: string[]; writes: ReviewWrite[]; resolved: string[] };
const states = new Map<string, State>();
const eventId = "99999999-9999-4999-8999-999999999999";
const base = "/api/integrations/google-forms/review";

function getCookie(header: string | undefined, name: string): string | undefined {
  return header?.split(";").map(part => part.trim())
    .find(part => part.startsWith(name + "="))?.slice(name.length + 1);
}

// Registered only by explicitly opted-in local Playwright Vite dev server.
// Not active in production builds or production API.
export function googleFormsE2EHttpFixture(): Plugin {
  return {
    name: "google-forms-e2e-http-fixture",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        const token = getCookie(req.headers.cookie, "google_forms_e2e_session");
        if (!token || !(url.pathname.startsWith(base) ||
          url.pathname === "/api/venue-events" ||
          url.pathname === "/__google-forms-e2e-state")) return next();

        const state = states.get(token) ?? { reads: [], writes: [], resolved: [] };
        states.set(token, state);
        const json = (status: number, body: unknown) => {
          res.statusCode = status;
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Cache-Control", "no-store");
          res.end(JSON.stringify(body));
        };
        if (url.pathname === "/__google-forms-e2e-state") {
          json(200, state);
          return;
        }
        const hasBearer = /^Bearer\s+\S+$/.test(req.headers.authorization ?? "");
        if (!hasBearer) { json(401, { error: "unauthorized" }); return; }

        if (url.pathname === "/api/venue-events" && req.method === "GET") {
          json(200, [{ id: eventId, customerName: "Cliente Associação",
            phone: "912000000", eventDate: "2026-11-15" }]);
          return;
        }
        if (url.pathname === base && req.method === "GET") {
          state.reads.push(url.search);
          const cursor = url.searchParams.get("cursor");
          const offset = cursor === "page2" ? 2 : cursor === "page3" ? 4 : 0;
          const all = Array.from({ length: 5 }, (_, i) => ({
            id: "11111111-1111-4111-8111-" + String(i + 1).padStart(12, "0"),
            submittedAt: "2026-10-20T12:00:00Z",
            status: "needs_review",
            reasons: ["requested extras require review"],
            venueEventId: i === 0 ? eventId : null,
            fields: { customerName: "Pedido Teste " + (i + 1),
              phone: "912000000", eventDate: "2026-11-15", pack: "Premium" },
          })).filter(row => !state.resolved.includes(row.id));
          json(200, { items: all.slice(offset, offset + 2),
            nextCursor: offset + 2 < all.length
              ? (offset + 2 >= 4 ? "page3" : "page2") : null });
          return;
        }
        if (req.method === "POST" && url.pathname.startsWith(base + "/") &&
          url.pathname.endsWith("/resolve")) {
          let raw = "";
          for await (const chunk of req) raw += String(chunk);
          let body: { action: string; venueEventId?: string };
          try { body = JSON.parse(raw) as typeof body; }
          catch { json(400, { error: "invalid JSON" }); return; }
          const desired = Number(getCookie(req.headers.cookie, "google_forms_e2e_error"));
          const status = desired === 409 || desired === 422 ? desired : 200;
          state.writes.push({ path: url.pathname, body, hasBearer, status });
          if (status === 409) { json(409, { status: "conflict" }); return; }
          if (status === 422) { json(422, { status: "mismatch" }); return; }
          const id = url.pathname.split("/").at(-2) ?? "";
          state.resolved.push(id);
          json(200, { status: "resolved" });
          return;
        }
        next();
      });
    },
  };
}
