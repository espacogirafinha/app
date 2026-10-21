import app from "../../artifacts/api-server/dist/app.mjs";

// Vercel rewrites nested API paths to this physical function.
export default function handler(req, res) {
  const url = new URL(req.url || "/", "http://localhost");
  const path = url.searchParams.get("__followUpPath") ?? "";
  url.searchParams.delete("__followUpPath");

  const suffix = path.replace(/^\/+/, "");
  const query = url.searchParams.toString();
  req.url = `/api/follow-up${suffix ? `/${suffix}` : ""}${query ? `?${query}` : ""}`;
  return app(req, res);
}
