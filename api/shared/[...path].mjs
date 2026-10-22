import app from "../../artifacts/api-server/dist/app.mjs";

// Only reached through explicit Vercel rewrites for five existing :id routes.
// Restore the original URL before invoking the shared Express application.
export default function handler(req, res) {
  const url = new URL(req.url || "/", "http://localhost");
  const apiPath = url.searchParams.get("__apiPath");

  if (apiPath) {
    url.searchParams.delete("__apiPath");
    const query = url.searchParams.toString();
    req.url = `/api/${apiPath.replace(/^\\/+/, "")}${query ? `?${query}` : ""}`;
  }

  return app(req, res);
}
