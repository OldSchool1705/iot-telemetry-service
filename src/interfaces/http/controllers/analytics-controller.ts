import type { Request, Response } from "express";
import type { GetDeviceAnalyticsUseCase } from "../../../application/use-cases/get-device-analytics.js";
import { GetAnalyticsQuerySchema } from "../../../application/dto/analytics-query.js";

export class AnalyticsController {
  constructor(private readonly analyticsUseCase: GetDeviceAnalyticsUseCase) {}

  async getDeviceAnalytics(req: Request, res: Response): Promise<void> {
    const validation = GetAnalyticsQuerySchema.safeParse({
      deviceId: req.params["deviceId"],
      from: req.query["from"],
      to: req.query["to"],
      aggregation: req.query["aggregation"],
      limit: req.query["limit"],
    });

    if (!validation.success) {
      res.status(400).json({
        error: "Validation error",
        details: validation.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      });
      return;
    }

    const { deviceId, from, to, aggregation } = validation.data;

    const result = await this.analyticsUseCase.execute({
      deviceId,
      from: new Date(from),
      to: new Date(to),
      aggregation,
    });

    result.fold(
      (data) => {
        res.json(data);
      },
      (error) => {
        if (error.message.includes("not found")) {
          res.status(404).json({ error: error.message });
          return;
        }
        res.status(500).json({ error: error.message });
      },
    );
  }
}
