import app from "../../../../artifacts/api-server/dist/app.mjs";

// Isolated to /review; does not intercept the existing /venue-event webhook.
export default function handler(req, res) {
  const url = new URL(req.url || "/", "http://localhost");
  const path = url.searchParams.get("__reviewPath") ?? "";
  url.searchParams.delete("__reviewPath");

  const suffix = path.replace(/^\/+/, "");
  const query = url.searchParams.toString();
  req.url = `/api/integrations/google-forms/review${suffix ? `/${suffix}` : ""}${query ? `?${query}` : ""}`;
  return app(req, res);
}
