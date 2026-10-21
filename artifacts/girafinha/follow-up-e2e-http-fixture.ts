import type { Plugin } from "vite";

type FixtureState = {
  invitationsDone: boolean;
  materialsDone: boolean;
  reads: number;
  writes: Array<{ method: string; path: string; body: unknown; hasBearer: boolean }>;
};
const records = new Map<string, FixtureState>();

function cookie(value: string | undefined, name: string): string | undefined {
  return value?.split(";").map(part => part.trim()).find(part => part.startsWith(name + "="))
    ?.slice(name.length + 1);
}

// Only installed by the local Playwright webServer with an explicit flag.
// Never active in Vite production builds, Preview, or deployed API functions.
export function followUpE2EHttpFixture(): Plugin {
  return {
    name: "follow-up-e2e-http-fixture",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        const session = cookie(req.headers.cookie, "follow_up_e2e_session");
        if (!session || (!url.pathname.startsWith("/api/follow-up") &&
          url.pathname !== "/__follow-up-e2e-state")) return next();

        const state = records.get(session) ?? {
          invitationsDone: false, materialsDone: false, reads: 0, writes: [],
        };
        records.set(session, state);
        res.setHeader("Cache-Control", "no-store");

        const json = (status: number, value: unknown) => {
          res.statusCode = status;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(value));
        };

        if (url.pathname === "/__follow-up-e2e-state") {
          json(200, state); return;
        }
        const hasBearer = /^Bearer\s+\S+$/.test(String(req.headers.authorization ?? ""));
        if (!hasBearer) { json(401, { error: "Unauthorized" }); return; }

        if (req.method === "GET" && url.pathname === "/api/follow-up") {
          state.reads++;
          const pending = !state.invitationsDone || !state.materialsDone;
          json(200, {
            preparations: pending ? [{
              id: "11111111-1111-4111-8111-111111111111",
              customerName: "Ana", birthdayChildName: "Matilde",
              phone: "912000000", eventDate: "2026-11-15",
              theme: "Princesas", packName: "Premium", daysRemaining: 25,
              invitationsDone: state.invitationsDone, materialsDone: state.materialsDone,
            }] : [],
            reactivations: [], preparationCount: pending ? 1 : 0, contactCount: 0,
            campaign: { offer_type: "none", offer_description: "", offer_value: null, offer_scope: "both" },
          }); return;
        }

        if (req.method === "PATCH" && /^\/api\/follow-up\/preparation\/[0-9a-f-]+$/.test(url.pathname)) {
          let raw = "";
          for await (const chunk of req) raw += String(chunk);
          let body: { field?: string; done?: boolean };
          try { body = JSON.parse(raw) as typeof body; } catch { json(400, { error: "Invalid JSON" }); return; }
          state.writes.push({ method: "PATCH", path: url.pathname, body, hasBearer });
          if (cookie(req.headers.cookie, "follow_up_e2e_error") === "503") {
            json(503, { error: "temporarily unavailable" }); return;
          }
          if (body.field !== "invitations" && body.field !== "materials" || typeof body.done !== "boolean") {
            json(400, { error: "Invalid payload" }); return;
          }
          if (body.field === "invitations") state.invitationsDone = body.done;
          else state.materialsDone = body.done;
          res.statusCode = 204;
          res.end(); return;
        }
        return next();
      });
    },
  };
}
