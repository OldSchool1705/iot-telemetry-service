import type { Request, Response } from "express";
import type { IngestTelemetryUseCase } from "../../../application/use-cases/ingest-telemetry.js";
import { IngestTelemetryDTOSchema } from "../../../domain/value-objects/metric-types.js";

export class TelemetryController {
  constructor(private readonly ingestUseCase: IngestTelemetryUseCase) {}

  async ingest(req: Request, res: Response): Promise<void> {
    const validation = IngestTelemetryDTOSchema.safeParse(req.body);

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

    const result = await this.ingestUseCase.execute(validation.data);

    result.fold(
      (success) => {
        res.status(201).json({
          ingested: success.ingested,
          duplicatesSkipped: success.duplicatesSkipped,
        });
      },
      (error) => {
        if (error.message.includes("not found")) {
          res.status(404).json({ error: error.message });
          return;
        }
        res.status(400).json({ error: error.message });
      },
    );
  }

  async health(_req: Request, res: Response): Promise<void> {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  }
}
