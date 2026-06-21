import { Result } from "../../shared/result.js";
import type {
  IDeviceRepository,
  IDeviceAnalyticsRepository,
  AggregatedMetric,
} from "../../domain/entities/repositories.js";
import { DeviceNotFoundError } from "../../domain/errors/domain-errors.js";
import { getLogger } from "../../shared/logger.js";

const log = getLogger("GetDeviceAnalyticsUseCase");

export interface AnalyticsResult {
  deviceId: string;
  deviceName: string;
  aggregation: "hourly" | "daily";
  from: Date;
  to: Date;
  metrics: AggregatedMetric[];
}

export class GetDeviceAnalyticsUseCase {
  constructor(
    private readonly deviceRepo: IDeviceRepository,
    private readonly analyticsRepo: IDeviceAnalyticsRepository,
  ) {}

  async execute(params: {
    deviceId: string;
    from: Date;
    to: Date;
    aggregation: "hourly" | "daily";
  }): Promise<Result<AnalyticsResult, Error>> {
    const { deviceId, from, to, aggregation } = params;

    const device = await this.deviceRepo.findById(deviceId);
    if (!device) {
      log.warn({ deviceId }, "Device not found for analytics");
      return Result.failure(new DeviceNotFoundError(deviceId));
    }

    const metrics = await this.analyticsRepo.getAggregatedMetrics(
      deviceId,
      from,
      to,
      aggregation,
    );

    log.info(
      { deviceId, aggregation, metricCount: metrics.length },
      "Analytics retrieved",
    );

    return Result.success({
      deviceId,
      deviceName: device.name,
      aggregation,
      from,
      to,
      metrics,
    });
  }
}
