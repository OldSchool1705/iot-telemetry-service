import type { ConsumeMessage } from "amqplib";
import { RabbitMQClient } from "./client.js";
import { IngestTelemetryDTOSchema } from "../../../domain/value-objects/metric-types.js";
import type { IngestTelemetryUseCase } from "../../../application/use-cases/ingest-telemetry.js";
import {
  runWithTraceId,
  setDeviceId,
  getLogger,
} from "../../../shared/logger.js";
import { v4 as uuidv4 } from "uuid";

const log = getLogger("TelemetryConsumer");

export class TelemetryConsumer {
  constructor(
    private readonly rabbitmq: RabbitMQClient,
    private readonly ingestUseCase: IngestTelemetryUseCase,
  ) {}

  async start(): Promise<void> {
    await this.rabbitmq.consume(
      process.env["RABBITMQ_QUEUE"] ?? "telemetry-ingestion",
      this.handleMessage.bind(this),
    );
    log.info("Telemetry consumer started");
  }

  private async handleMessage(msg: ConsumeMessage | null): Promise<void> {
    if (!msg) return;

    const traceId =
      msg.properties.headers?.["x-trace-id"]?.toString() ?? uuidv4();

    runWithTraceId(traceId, async () => {
      try {
        const content = JSON.parse(msg.content.toString()) as unknown;
        const validation = IngestTelemetryDTOSchema.safeParse(content);

        if (!validation.success) {
          log.warn(
            { errors: validation.error.issues, messageId: msg.properties.messageId },
            "Invalid message format",
          );
          await this.rabbitmq.nack(msg, false);
          return;
        }

        const dto = validation.data;
        setDeviceId(dto.deviceId);

        const result = await this.ingestUseCase.execute(dto);

        result.fold(
          (success) => {
            log.info(
              {
                messageId: msg.properties.messageId,
                ingested: success.ingested,
                duplicatesSkipped: success.duplicatesSkipped,
              },
              "Message processed successfully",
            );
          },
          (error) => {
            log.error(
              { error: error.message, messageId: msg.properties.messageId },
              "Failed to process message",
            );
          },
        );

        await this.rabbitmq.ack(msg);
      } catch (err) {
        log.error({ err, messageId: msg.properties.messageId }, "Unexpected error");
        await this.rabbitmq.nack(msg, false);
      }
    });
  }
}
