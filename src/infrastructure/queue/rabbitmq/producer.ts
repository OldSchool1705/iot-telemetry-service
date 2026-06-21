import { RabbitMQClient } from "./client.js";
import { getLogger } from "../../../shared/logger.js";

const log = getLogger("TelemetryProducer");

export class TelemetryProducer {
  constructor(private readonly rabbitmq: RabbitMQClient) {}

  async publish(
    queue: string,
    payload: Record<string, unknown>,
    options?: { traceId?: string },
  ): Promise<boolean> {
    const data = Buffer.from(JSON.stringify(payload));

    const published = await this.rabbitmq.publish(queue, data, {
      persistent: true,
    });

    log.info(
      { queue, published, traceId: options?.traceId },
      "Message published",
    );

    return published;
  }
}
