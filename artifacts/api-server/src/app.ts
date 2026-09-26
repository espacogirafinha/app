import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import healthRouter from "./routes/health";
import { logger } from "./lib/logger";
import { requireAuth } from "./lib/auth";
import googleFormsRouter from "./integrations/google-forms-route";

const app: Express = express();

app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({ credentials: true }));
app.use("/api/integrations/google-forms/venue-event", express.raw({ type: "application/json", limit: "64kb" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", healthRouter);
app.use("/api", googleFormsRouter);
app.use("/api", requireAuth, router);

export default app;
