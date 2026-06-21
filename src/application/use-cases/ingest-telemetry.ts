import { Result } from "../../shared/result.js";
import type {
  IDeviceRepository,
  ITelemetryRepository,
} from "../../domain/entities/repositories.js";
import { TelemetryMetric as TelemetryMetricEntity } from "../../domain/entities/telemetry-metric.js";
import {
  type IngestTelemetryDTO,
  IngestTelemetryDTOSchema,
} from "../../domain/value-objects/metric-types.js";
import {
  DeviceNotFoundError,
  InvalidTelemetryError,
} from "../../domain/errors/domain-errors.js";
import { getLogger } from "../../shared/logger.js";

const log = getLogger("IngestTelemetryUseCase");

interface IngestResult {
  ingested: number;
  duplicatesSkipped: number;
}

export class IngestTelemetryUseCase {
  constructor(
    private readonly deviceRepo: IDeviceRepository,
    private readonly telemetryRepo: ITelemetryRepository,
  ) {}

  async execute(dto: IngestTelemetryDTO): Promise<Result<IngestResult, Error>> {
    const validation = IngestTelemetryDTOSchema.safeParse(dto);
    if (!validation.success) {
      const msg = validation.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      log.warn({ errors: msg }, "Validation failed");
      return Result.failure(new InvalidTelemetryError(msg));
    }

    const data = validation.data;
    const device = await this.deviceRepo.findById(data.deviceId);
    if (!device) {
      log.warn({ deviceId: data.deviceId }, "Device not found");
      return Result.failure(new DeviceNotFoundError(data.deviceId));
    }

    let ingested = 0;
    let duplicatesSkipped = 0;
    const metricsToSave: TelemetryMetricEntity[] = [];

    for (const m of data.metrics) {
      const idempotencyKey = `${data.deviceId}:${m.name}:${m.timestamp ?? new Date().toISOString()}`;

      const isDuplicate = await this.telemetryRepo.findByIdempotencyKey(idempotencyKey);
      if (isDuplicate) {
        duplicatesSkipped++;
        continue;
      }

      const metric = TelemetryMetricEntity.create({
        deviceId: data.deviceId,
        name: m.name,
        value: m.value,
        unit: m.unit ?? null,
        timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
        metadata: m.metadata ?? null,
      });

      metricsToSave.push(metric);
      await this.telemetryRepo.saveIdempotencyKey(idempotencyKey, 3600);
      ingested++;
    }

    if (metricsToSave.length > 0) {
      await this.telemetryRepo.saveBatch(metricsToSave);
      device.touch();
      await this.deviceRepo.update(device);
    }

    log.info(
      { deviceId: data.deviceId, ingested, duplicatesSkipped },
      "Telemetry ingested",
    );

    return Result.success({ ingested, duplicatesSkipped });
  }
}
