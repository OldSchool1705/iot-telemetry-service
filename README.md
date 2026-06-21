# IoT Telemetry Service

Production-ready Node.js backend for IoT telemetry data ingestion and analytics.

## Architecture

The project follows **Clean Architecture** principles with strict layer separation:

```
src/
  domain/              -- Pure business logic (no framework dependencies)
    entities/          -- Device, TelemetryMetric, repository interfaces
    value-objects/     -- DeviceType, MetricName, IngestTelemetryDTO (Zod schemas)
    errors/            -- DomainError, DeviceNotFoundError, InvalidTelemetryError, DeviceInactiveError
  application/         -- Use cases (orchestrate domain + infrastructure)
    use-cases/         -- IngestTelemetryUseCase, GetDeviceAnalyticsUseCase
    dto/               -- GetAnalyticsQuerySchema
  infrastructure/      -- External service adapters
    database/prisma/   -- PrismaDeviceRepository, PrismaTelemetryRepository, PrismaAnalyticsRepository
    cache/redis/       -- Redis client, RedisIdempotencyStore
    queue/rabbitmq/    -- RabbitMQClient, TelemetryProducer, TelemetryConsumer
    container.ts       -- Awilix IoC container
  interfaces/          -- Delivery mechanisms
    http/              -- Express app, controllers, middleware
  shared/              -- Cross-cutting concerns
    result.ts          -- Result monad for error handling
    logger.ts          -- Pino logger with AsyncLocalStorage trace propagation
```

## Tech Stack

| Component | Technology |
|---|---|
| Runtime | Node.js >= 20 |
| Language | TypeScript 5.7+ (strict mode) |
| HTTP Framework | Express 4 |
| ORM | Prisma 6 |
| Database | PostgreSQL 16 |
| Cache / Idempotency | Redis 7 |
| Message Broker | RabbitMQ 3 |
| DI Container | Awilix |
| Validation | Zod |
| Logging | Pino |
| Testing | Vitest, Testcontainers |
| Containerization | Docker, Docker Compose |

## API Endpoints

### Health Check

```
GET /health
```

Response:
```json
{ "status": "ok", "timestamp": "2026-06-21T12:00:00.000Z" }
```

### Ingest Telemetry

```
POST /api/v1/telemetry
```

Request body:
```json
{
  "deviceId": "550e8400-e29b-41d4-a716-446655440000",
  "metrics": [
    {
      "name": "temperature",
      "value": 23.5,
      "unit": "celsius",
      "timestamp": "2026-06-21T12:00:00Z",
      "metadata": { "location": "sensor-1" }
    }
  ]
}
```

- `deviceId` (UUID, required)
- `metrics` (1-100 items)
  - `name` (1-128 chars, `[a-zA-Z0-9._-]`)
  - `value` (number, required)
  - `unit` (string, up to 32 chars, optional)
  - `timestamp` (ISO datetime, optional — defaults to now())
  - `metadata` (arbitrary JSON, optional)

Response (201):
```json
{ "ingested": 2, "duplicatesSkipped": 0 }
```

### Get Device Analytics

```
GET /api/v1/devices/:deviceId/analytics?from=2026-06-01T00:00:00Z&to=2026-06-21T23:59:59Z&aggregation=hourly&limit=100
```

Query parameters:
| Parameter | Type | Required | Description |
|---|---|---|---|
| `from` | ISO datetime | Yes | Start of period |
| `to` | ISO datetime | Yes | End of period |
| `aggregation` | `hourly` / `daily` | No | Aggregation level (default `hourly`) |
| `limit` | int 1-1000 | No | Max results (default 100) |

## Database

### Prisma Models

**devices** — IoT devices
| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `external_id` | String | External ID (unique) |
| `name` | String | Device name |
| `type` | String | `temperature`, `humidity`, `pressure`, `motion`, `light`, `custom` |
| `firmware` | String? | Firmware version |
| `is_active` | Boolean | Whether device is active |
| `last_seen_at` | DateTime? | Last telemetry received |

**telemetry_metrics** — telemetry metrics
| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `device_id` | String | FK -> devices.id (cascade delete) |
| `name` | String | Metric name |
| `value` | Float | Metric value |
| `unit` | String? | Unit of measurement |
| `timestamp` | DateTime | Measurement timestamp |
| `metadata` | Json? | Additional data |

Unique constraint: `[device_id, name, timestamp]`

**alerts** — alerts
| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `device_id` | String | FK -> devices.id |
| `type` | String | Alert type |
| `severity` | Enum | `INFO`, `WARNING`, `CRITICAL` |
| `message` | String | Alert message |
| `value` / `threshold` | Float | Value and threshold |

## Infrastructure

### Redis (cache / idempotency)

- **IdempotencyStore** — prevents duplicate metric ingestion (TTL 1 hour by default)
- **Distributed Lock** — distributed locking via `SET ... NX PX`
- Auto-reconnect with exponential backoff

### RabbitMQ (message queue)

- Durable queue with 24h TTL and 1M message limit
- Prefetch count: 10
- Auto-reconnect (up to 10 attempts)
- Dual ingestion paths: HTTP REST API and async RabbitMQ consumer

### DI Container (Awilix)

All dependencies registered as singletons: PrismaClient, Redis, RabbitMQ, repositories, use cases, controllers, producer/consumer.

## Getting Started

### Option 1: Docker Compose (recommended)

```bash
cd iot-telemetry-service
docker-compose up -d
```

Starts:
- PostgreSQL (port **5433**)
- Redis (port **6380**)
- RabbitMQ (port **5672**, Management UI: **15672**)
- Application (port **3000**)

Stop:
```bash
docker-compose down
```

Stop with data cleanup:
```bash
docker-compose down -v
```

### Option 2: Local Development

```bash
cd iot-telemetry-service

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:migrate

# Start in dev mode (hot reload)
npm run dev
```

### Option 3: Production Build

```bash
# Compile TypeScript
npm run build

# Start
npm start
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/iot_telemetry` | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `RABBITMQ_URL` | `amqp://guest:guest@localhost:5672` | RabbitMQ AMQP connection string |
| `RABBITMQ_QUEUE` | `telemetry-ingestion` | Queue name for telemetry messages |
| `LOG_LEVEL` | `info` | Log level (`debug`, `info`, `warn`, `error`) |
| `NODE_ENV` | `development` | Environment (`development` enables pino-pretty) |
| `PORT` | `3000` | HTTP server port |

## Testing

```bash
# Unit tests
npm test

# Watch mode
npm run test:watch

# Integration tests (requires Docker)
npm run test:integration
```

Integration tests use **Testcontainers** to spin up real PostgreSQL and RabbitMQ containers.

### Key test scenarios:
- Successful telemetry ingestion for a valid device
- Failure when ingesting for a non-existent device
- Idempotency — duplicate metrics are skipped

## Linting & Formatting

```bash
npm run lint          # ESLint check
npm run lint:fix      # Auto-fix
npm run format        # Prettier formatting
```

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`) runs on push/PR to `main`:

1. **lint** — ESLint + Prettier
2. **test** — Vitest with real PostgreSQL, Redis, RabbitMQ (via Services)
3. **build** — TypeScript compilation (depends on lint + test)

## Example Requests

### Ingest Telemetry

```bash
curl -X POST http://localhost:3000/api/v1/telemetry \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "550e8400-e29b-41d4-a716-446655440000",
    "metrics": [
      { "name": "temperature", "value": 23.5, "unit": "celsius" },
      { "name": "humidity", "value": 65.2, "unit": "percent" }
    ]
  }'
```

### Get Analytics

```bash
curl "http://localhost:3000/api/v1/devices/550e8400-e29b-41d4-a716-446655440000/analytics?from=2026-06-01T00:00:00Z&to=2026-06-21T23:59:59Z&aggregation=hourly"
```

## License

MIT
