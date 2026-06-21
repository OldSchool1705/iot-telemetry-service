import { PrismaClient } from "@prisma/client";
import type {
  IDeviceAnalyticsRepository,
  AggregatedMetric,
} from "../../../domain/entities/repositories.js";
import type { TelemetryMetric } from "../../../domain/entities/telemetry-metric.js";
import { TelemetryMetric as TelemetryMetricEntity } from "../../../domain/entities/telemetry-metric.js";
import { getLogger } from "../../../shared/logger.js";

const log = getLogger("PrismaAnalyticsRepository");

interface AggregatedRow {
  name: string;
  avg: number;
  min: number;
  max: number;
  sum: number;
  count: bigint;
  timestamp: Date;
}

export class PrismaAnalyticsRepository implements IDeviceAnalyticsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getAggregatedMetrics(
    deviceId: string,
    from: Date,
    to: Date,
    aggregation: "hourly" | "daily",
  ): Promise<AggregatedMetric[]> {
    const truncationUnit = aggregation === "hourly" ? "hour" : "day";

    const results = await this.prisma.$queryRaw<AggregatedRow[]>`
      SELECT
        name,
        AVG(value) as avg,
        MIN(value) as min,
        MAX(value) as max,
        SUM(value) as sum,
        COUNT(*) as count,
        DATE_TRUNC(${truncationUnit}::interval, timestamp) as timestamp
      FROM telemetry_metrics
      WHERE device_id = ${deviceId}
        AND timestamp >= ${from}
        AND timestamp <= ${to}
      GROUP BY name, DATE_TRUNC(${truncationUnit}::interval, timestamp)
      ORDER BY timestamp DESC, name
    `;

    log.info(
      { deviceId, aggregation, rows: results.length },
      "Aggregated metrics fetched",
    );

    return results.map((r: AggregatedRow) => ({
      name: r.name,
      avg: Number(r.avg),
      min: Number(r.min),
      max: Number(r.max),
      sum: Number(r.sum),
      count: Number(r.count),
      timestamp: r.timestamp,
    }));
  }

  async getLatestMetrics(
    deviceId: string,
    limit: number,
  ): Promise<TelemetryMetric[]> {
    const records: Array<{
      id: string;
      deviceId: string;
      name: string;
      value: number;
      unit: string | null;
      timestamp: Date;
      metadata: unknown;
      createdAt: Date;
    }> = await this.prisma.telemetryMetric.findMany({
      where: { deviceId },
      orderBy: { timestamp: "desc" },
      take: limit,
    });

    return records.map((record) =>
      TelemetryMetricEntity.fromPersistence({
        id: record.id,
        deviceId: record.deviceId,
        name: record.name,
        value: record.value,
        unit: record.unit,
        timestamp: record.timestamp,
        metadata: (record.metadata as Record<string, unknown>) ?? null,
        createdAt: record.createdAt,
      }),
    );
  }
}
