import app from "../../artifacts/api-server/dist/app.mjs";

export default function handler(req, res) {
  const url = new URL(req.url || "/", "http://localhost");
  const workshopPath = url.searchParams.get("__workshopPath");

  if (workshopPath) {
    url.searchParams.delete("__workshopPath");
    const query = url.searchParams.toString();
    req.url = `/api/workshops/${workshopPath}${query ? `?${query}` : ""}`;
  }

  return app(req, res);
}
