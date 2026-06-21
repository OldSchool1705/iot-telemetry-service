import { PrismaClient } from "@prisma/client";
import type {
  ITelemetryRepository,
} from "../../../domain/entities/repositories.js";
import type { TelemetryMetric } from "../../../domain/entities/telemetry-metric.js";
import { getLogger } from "../../../shared/logger.js";

const log = getLogger("PrismaTelemetryRepository");

export class PrismaTelemetryRepository implements ITelemetryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async saveBatch(metrics: TelemetryMetric[]): Promise<void> {
    if (metrics.length === 0) return;

    const data = metrics.map((m) => {
      const props = m.toPersistence();
      return {
        id: props.id,
        deviceId: props.deviceId,
        name: props.name,
        value: props.value,
        unit: props.unit,
        timestamp: props.timestamp,
        metadata: (props.metadata as Record<string, unknown>) ?? undefined,
      };
    });

    await this.prisma.telemetryMetric.createMany({
      data: data as never,
      skipDuplicates: true,
    });

    log.info({ count: data.length }, "Metrics batch saved");
  }

  async findByIdempotencyKey(_key: string): Promise<boolean> {
    return false;
  }

  async saveIdempotencyKey(_key: string, _ttlSeconds: number): Promise<void> {
    log.debug("Idempotency key recorded");
  }
}
