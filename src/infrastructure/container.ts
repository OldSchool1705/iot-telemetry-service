import { createContainer, InjectionMode, asClass, asValue } from "awilix";
import { PrismaClient } from "@prisma/client";
import { PrismaDeviceRepository } from "../infrastructure/database/prisma/device-repository.js";
import { PrismaTelemetryRepository } from "../infrastructure/database/prisma/telemetry-repository.js";
import { PrismaAnalyticsRepository } from "../infrastructure/database/prisma/analytics-repository.js";
import { RabbitMQClient } from "../infrastructure/queue/rabbitmq/client.js";
import { createRedisClient } from "../infrastructure/cache/redis/client.js";
import { IngestTelemetryUseCase } from "../application/use-cases/ingest-telemetry.js";
import { GetDeviceAnalyticsUseCase } from "../application/use-cases/get-device-analytics.js";
import { TelemetryController } from "../interfaces/http/controllers/telemetry-controller.js";
import { AnalyticsController } from "../interfaces/http/controllers/analytics-controller.js";
import { TelemetryConsumer } from "../infrastructure/queue/rabbitmq/consumer.js";
import { TelemetryProducer } from "../infrastructure/queue/rabbitmq/producer.js";
import { getLogger } from "../shared/logger.js";

const log = getLogger("Container");

export function createAppContainer() {
  const cr = createContainer({
    injectionMode: InjectionMode.CLASSIC,
  });

  const prisma = new PrismaClient();
  const redis = createRedisClient({
    url: process.env["REDIS_URL"] ?? "redis://localhost:6379",
  });
  const rabbitmq = new RabbitMQClient({
    url: process.env["RABBITMQ_URL"] ?? "amqp://guest:guest@localhost:5672",
    queue: process.env["RABBITMQ_QUEUE"] ?? "telemetry-ingestion",
  });

  cr.register({
    prisma: asValue(prisma),
    redis: asValue(redis),
    rabbitmq: asValue(rabbitmq),

    deviceRepo: asClass(PrismaDeviceRepository).singleton(),
    telemetryRepo: asClass(PrismaTelemetryRepository).singleton(),
    analyticsRepo: asClass(PrismaAnalyticsRepository).singleton(),

    ingestUseCase: asClass(IngestTelemetryUseCase).singleton(),
    analyticsUseCase: asClass(GetDeviceAnalyticsUseCase).singleton(),

    telemetryController: asClass(TelemetryController).singleton(),
    analyticsController: asClass(AnalyticsController).singleton(),

    telemetryConsumer: asClass(TelemetryConsumer).singleton(),
    telemetryProducer: asClass(TelemetryProducer).singleton(),
  });

  log.info("DI container created");
  return cr;
}
