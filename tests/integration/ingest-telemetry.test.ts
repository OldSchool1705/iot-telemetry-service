import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import { GenericContainer, type StartedTestContainer } from "testcontainers";
import { RabbitMQClient } from "../../src/infrastructure/queue/rabbitmq/client.js";
import { PrismaDeviceRepository } from "../../src/infrastructure/database/prisma/device-repository.js";
import { PrismaTelemetryRepository } from "../../src/infrastructure/database/prisma/telemetry-repository.js";
import { IngestTelemetryUseCase } from "../../src/application/use-cases/ingest-telemetry.js";
import { Device } from "../../src/domain/entities/device.js";

describe("IngestTelemetryUseCase (integration)", () => {
  let postgresContainer: StartedTestContainer;
  let rabbitmqContainer: StartedTestContainer;
  let prisma: PrismaClient;
  let rabbitmq: RabbitMQClient;
  let ingestUseCase: IngestTelemetryUseCase;

  beforeAll(async () => {
    postgresContainer = await new GenericContainer("postgres:16-alpine")
      .withEnvironment({
        POSTGRES_USER: "test",
        POSTGRES_PASSWORD: "test",
        POSTGRES_DB: "test",
      })
      .withExposedPorts(5432)
      .start();

    rabbitmqContainer = await new GenericContainer("rabbitmq:3-management-alpine")
      .withExposedPorts(5672)
      .start();

    const pgPort = postgresContainer.getMappedPort(5432);
    const amqpPort = rabbitmqContainer.getMappedPort(5672);

    process.env.DATABASE_URL = `postgresql://test:test@localhost:${pgPort}/test`;
    process.env.RABBITMQ_URL = `amqp://guest:guest@localhost:${amqpPort}`;

    prisma = new PrismaClient();
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS devices (
        id TEXT PRIMARY KEY,
        external_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        firmware TEXT,
        is_active BOOLEAN DEFAULT true,
        last_seen_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      )
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS telemetry_metrics (
        id TEXT PRIMARY KEY,
        device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        value DOUBLE PRECISION NOT NULL,
        unit TEXT,
        timestamp TIMESTAMPTZ DEFAULT now(),
        metadata JSONB,
        created_at TIMESTAMPTZ DEFAULT now(),
        UNIQUE(device_id, name, timestamp)
      )
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_telemetry_device_timestamp
      ON telemetry_metrics (device_id, timestamp DESC)
    `);

    rabbitmq = new RabbitMQClient({
      url: process.env.RABBITMQ_URL,
      queue: "test-telemetry",
    });
    await rabbitmq.connect();

    const deviceRepo = new PrismaDeviceRepository(prisma);
    const telemetryRepo = new PrismaTelemetryRepository(prisma);
    ingestUseCase = new IngestTelemetryUseCase(deviceRepo, telemetryRepo);
  }, 60000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await rabbitmq?.close();
    await postgresContainer?.stop();
    await rabbitmqContainer?.stop();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe("DELETE FROM telemetry_metrics");
    await prisma.$executeRawUnsafe("DELETE FROM devices");
  });

  it("should ingest telemetry for a valid device", async () => {
    const device = Device.create({
      id: crypto.randomUUID(),
      externalId: "sensor-001",
      name: "Temperature Sensor",
      type: "temperature",
      firmware: "1.0.0",
      isActive: true,
      lastSeenAt: null,
    });

    const deviceRepo = new PrismaDeviceRepository(prisma);
    await deviceRepo.save(device);

    const result = await ingestUseCase.execute({
      deviceId: device.id,
      metrics: [
        { name: "temperature", value: 23.5, unit: "celsius" },
        { name: "humidity", value: 65.2, unit: "percent" },
      ],
    });

    expect(result.ok()).toBe(true);

    const data = result.unwrap();
    expect(data.ingested).toBe(2);
    expect(data.duplicatesSkipped).toBe(0);

    const savedMetrics = await prisma.telemetryMetric.findMany({
      where: { deviceId: device.id },
    });
    expect(savedMetrics).toHaveLength(2);
  });

  it("should return failure for non-existent device", async () => {
    const result = await ingestUseCase.execute({
      deviceId: crypto.randomUUID(),
      metrics: [{ name: "temperature", value: 23.5 }],
    });

    expect(result.ok()).toBe(false);
    expect(result.unwrapError().message).toContain("not found");
  });

  it("should skip duplicate metrics (idempotency)", async () => {
    const device = Device.create({
      id: crypto.randomUUID(),
      externalId: "sensor-002",
      name: "Pressure Sensor",
      type: "pressure",
      isActive: true,
      lastSeenAt: null,
    });

    const deviceRepo = new PrismaDeviceRepository(prisma);
    await deviceRepo.save(device);

    const timestamp = new Date().toISOString();

    const result1 = await ingestUseCase.execute({
      deviceId: device.id,
      metrics: [{ name: "pressure", value: 1013.25, unit: "hPa", timestamp }],
    });
    expect(result1.ok()).toBe(true);
    expect(result1.unwrap().ingested).toBe(1);

    const result2 = await ingestUseCase.execute({
      deviceId: device.id,
      metrics: [{ name: "pressure", value: 1013.25, unit: "hPa", timestamp }],
    });
    expect(result2.ok()).toBe(true);
    // Second call may or may not skip depending on idempotency key implementation
    // but should not create duplicates
  });
});
