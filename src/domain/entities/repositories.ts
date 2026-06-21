import type { Device } from "./device.js";
import type { TelemetryMetric } from "./telemetry-metric.js";

export interface IDeviceRepository {
  findById(id: string): Promise<Device | null>;
  findByExternalId(externalId: string): Promise<Device | null>;
  save(device: Device): Promise<Device>;
  update(device: Device): Promise<void>;
}

export interface ITelemetryRepository {
  saveBatch(metrics: TelemetryMetric[]): Promise<void>;
  findByIdempotencyKey(key: string): Promise<boolean>;
  saveIdempotencyKey(key: string, ttlSeconds: number): Promise<void>;
}

export interface IDeviceAnalyticsRepository {
  getAggregatedMetrics(
    deviceId: string,
    from: Date,
    to: Date,
    aggregation: "hourly" | "daily",
  ): Promise<AggregatedMetric[]>;
  getLatestMetrics(
    deviceId: string,
    limit: number,
  ): Promise<TelemetryMetric[]>;
}

export interface AggregatedMetric {
  name: string;
  avg: number;
  min: number;
  max: number;
  sum: number;
  count: number;
  timestamp: Date;
}
