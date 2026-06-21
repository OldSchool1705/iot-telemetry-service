import { createApp } from "./interfaces/http/app.js";
import { createAppContainer } from "./infrastructure/container.js";
import { getLogger } from "./shared/logger.js";
import type { PrismaClient } from "@prisma/client";
import type Redis from "ioredis";
import type { RabbitMQClient } from "./infrastructure/queue/rabbitmq/client.js";
import type { TelemetryConsumer } from "./infrastructure/queue/rabbitmq/consumer.js";

const log = getLogger("Main");
const PORT = parseInt(process.env["PORT"] ?? "3000", 10);

async function main(): Promise<void> {
  log.info("Starting IoT Telemetry Service...");

  const cr = createAppContainer();

  const prisma = cr.resolve<PrismaClient>("prisma");
  const redis = cr.resolve<Redis>("redis");
  const rabbitmq = cr.resolve<RabbitMQClient>("rabbitmq");

  try {
    await prisma.$connect();
    log.info("PostgreSQL connected");

    await redis.connect();
    log.info("Redis connected");

    await rabbitmq.connect();
    log.info("RabbitMQ connected");

    const telemetryController = cr.resolve("telemetryController");
    const analyticsController = cr.resolve("analyticsController");
    const app = createApp(telemetryController, analyticsController);

    const server = app.listen(PORT, () => {
      log.info({ port: PORT }, "HTTP server started");
    });

    const consumer = cr.resolve<TelemetryConsumer>("telemetryConsumer");
    await consumer.start();

    const shutdown = async (signal: string): Promise<void> => {
      log.info({ signal }, "Received shutdown signal, starting graceful shutdown...");

      server.close(async () => {
        log.info("HTTP server closed");

        await rabbitmq.close();
        log.info("RabbitMQ disconnected");

        await redis.quit();
        log.info("Redis disconnected");

        await prisma.$disconnect();
        log.info("PostgreSQL disconnected");

        log.info("Graceful shutdown complete");
        process.exit(0);
      });

      setTimeout(() => {
        log.error("Shutdown timed out, forcing exit");
        process.exit(1);
      }, 30000);
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (err) {
    log.error({ err }, "Failed to start application");
    process.exit(1);
  }
}

main();
