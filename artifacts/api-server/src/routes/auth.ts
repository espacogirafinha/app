import { Router, type IRouter, type RequestHandler } from "express";
import { verifyCredentials } from "../lib/auth";

const router: IRouter = Router();

const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 15 * 60 * 1000;

const loginRateLimit: RequestHandler = (req, res, next) => {
  const ip = req.ip ?? "unknown";
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || entry.resetAt < now) {
    loginAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    next();
    return;
  }
  entry.count += 1;
  if (entry.count > MAX_ATTEMPTS) {
    res.status(429).json({ error: "Demasiadas tentativas. Tente novamente mais tarde." });
    return;
  }
  next();
};

router.post("/auth/login", loginRateLimit, async (req, res): Promise<void> => {
  const body = req.body as { email?: unknown; password?: unknown } | undefined;
  const email = typeof body?.email === "string" ? body.email : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    res.status(400).json({ error: "Email e palavra-passe são obrigatórios" });
    return;
  }

  const ok = await verifyCredentials(email, password);
  if (!ok) {
    res.status(401).json({ error: "Credenciais inválidas" });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  req.session.regenerate((regenErr) => {
    if (regenErr) {
      req.log.error({ err: regenErr }, "Failed to regenerate session");
      res.status(500).json({ error: "Erro ao iniciar sessão" });
      return;
    }
    req.session.userEmail = normalizedEmail;
    req.session.save((err) => {
      if (err) {
        req.log.error({ err }, "Failed to save session");
        res.status(500).json({ error: "Erro ao iniciar sessão" });
        return;
      }
      loginAttempts.delete(req.ip ?? "unknown");
      res.json({ email: normalizedEmail });
    });
  });
});

router.post("/auth/logout", (req, res): void => {
  req.session.destroy((err) => {
    if (err) {
      req.log.error({ err }, "Failed to destroy session");
      res.status(500).json({ error: "Erro ao terminar sessão" });
      return;
    }
    res.clearCookie("connect.sid");
    res.status(204).end();
  });
});

router.get("/auth/me", (req, res): void => {
  if (req.session?.userEmail) {
    res.json({ email: req.session.userEmail });
    return;
  }
  res.status(401).json({ error: "Não autenticado" });
});

export default router;
