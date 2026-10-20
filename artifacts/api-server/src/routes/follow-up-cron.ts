import { Router, type IRouter } from "express";
import { followUpWritesEnabled, refreshDueNotifications } from "./follow-up";

const router: IRouter = Router();

router.get("/internal/follow-up-sync", async (req, res): Promise<void> => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    res.status(401).json({ error: "Não autorizado" }); return;
  }
  if (!followUpWritesEnabled()) {
    res.status(503).json({ error: "Acompanhamento ainda não ativado" }); return;
  }
  try {
    await refreshDueNotifications();
    res.json({ ok: true });
  } catch (error) {
    console.error("Scheduled follow-up sync failed", error);
    res.status(500).json({ error: "Erro ao atualizar lembretes" });
  }
});

export default router;
