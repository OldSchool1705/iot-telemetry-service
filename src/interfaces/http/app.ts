import express from "express";
import type { TelemetryController } from "./controllers/index.js";
import type { AnalyticsController } from "./controllers/index.js";
import { traceMiddleware, errorHandler } from "./middleware/index.js";

export function createApp(
  telemetryCtrl: TelemetryController,
  analyticsCtrl: AnalyticsController,
): express.Express {
  const app = express();

  app.use(express.json({ limit: "1mb" }));
  app.use(traceMiddleware);

  app.get("/health", (req, res) => telemetryCtrl.health(req, res));
  app.post("/api/v1/telemetry", (req, res) => telemetryCtrl.ingest(req, res));
  app.get(
    "/api/v1/devices/:deviceId/analytics",
    (req, res) => analyticsCtrl.getDeviceAnalytics(req, res),
  );

  app.use(errorHandler);

  return app;
}
