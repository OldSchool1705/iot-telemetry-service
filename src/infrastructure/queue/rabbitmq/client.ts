import amqplib, { type Channel, type ChannelModel, type ConsumeMessage } from "amqplib";
import { EventEmitter } from "node:events";
import { getLogger } from "../../../shared/logger.js";

const log = getLogger("RabbitMQ");

export interface RabbitMQConfig {
  url: string;
  queue: string;
  prefetchCount?: number;
  reconnectIntervalMs?: number;
  maxReconnectAttempts?: number;
}

export class RabbitMQClient extends EventEmitter {
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private reconnectAttempts = 0;
  private isConnecting = false;
  private shouldReconnect = true;
  private consumerTag: string | null = null;

  constructor(private readonly config: RabbitMQConfig) {
    super();
  }

  async connect(): Promise<void> {
    if (this.isConnecting) return;
    this.isConnecting = true;

    try {
      this.connection = await amqplib.connect(this.config.url);

      this.connection.on("error", (err: Error) => {
        log.error({ err }, "RabbitMQ connection error");
        this.handleReconnect();
      });

      this.connection.on("close", () => {
        log.warn("RabbitMQ connection closed");
        this.handleReconnect();
      });

      this.channel = await this.connection.createChannel();

      this.channel.on("error", (err: Error) => {
        log.error({ err }, "RabbitMQ channel error");
      });

      this.channel.on("close", () => {
        log.warn("RabbitMQ channel closed");
      });

      await this.channel.assertQueue(this.config.queue, {
        durable: true,
        arguments: {
          "x-message-ttl": 86400000,
          "x-max-length": 1000000,
        },
      });

      await this.channel.prefetch(this.config.prefetchCount ?? 10);

      this.reconnectAttempts = 0;
      this.isConnecting = false;

      log.info(
        { queue: this.config.queue, url: this.config.url },
        "RabbitMQ connected",
      );
    } catch (err) {
      this.isConnecting = false;
      log.error({ err }, "RabbitMQ connection failed");
      await this.handleReconnect();
    }
  }

  private async handleReconnect(): Promise<void> {
    if (!this.shouldReconnect) return;

    const maxAttempts = this.config.maxReconnectAttempts ?? 10;
    if (this.reconnectAttempts >= maxAttempts) {
      log.error("Max reconnect attempts reached, giving up");
      this.emit("maxRetriesReached");
      return;
    }

    this.reconnectAttempts++;
    const delay = this.config.reconnectIntervalMs ?? 5000;
    log.info(
      { attempt: this.reconnectAttempts, delay },
      "Reconnecting to RabbitMQ...",
    );

    await new Promise((resolve) => setTimeout(resolve, delay));
    await this.connect();
  }

  async publish(queue: string, data: Buffer, options?: { persistent?: boolean }): Promise<boolean> {
    if (!this.channel) {
      throw new Error("RabbitMQ channel not initialized");
    }
    return this.channel.sendToQueue(queue, data, {
      persistent: options?.persistent ?? true,
      timestamp: Date.now(),
      contentType: "application/json",
    });
  }

  async consume(
    queue: string,
    handler: (msg: ConsumeMessage | null) => Promise<void>,
  ): Promise<void> {
    if (!this.channel) {
      throw new Error("RabbitMQ channel not initialized");
    }

    const result = await this.channel.consume(queue, handler, {
      noAck: false,
    });

    this.consumerTag = result.consumerTag;
    log.info({ queue, consumerTag: result.consumerTag }, "Consuming from queue");
  }

  async ack(msg: ConsumeMessage): Promise<void> {
    if (!this.channel) {
      throw new Error("RabbitMQ channel not initialized");
    }
    this.channel.ack(msg);
  }

  async nack(msg: ConsumeMessage, requeue = false): Promise<void> {
    if (!this.channel) {
      throw new Error("RabbitMQ channel not initialized");
    }
    this.channel.nack(msg, false, requeue);
  }

  async close(): Promise<void> {
    this.shouldReconnect = false;

    if (this.channel && this.consumerTag) {
      try {
        await this.channel.cancel(this.consumerTag);
        log.info("Consumer cancelled");
      } catch (err) {
        log.warn({ err }, "Failed to cancel consumer");
      }
    }

    if (this.channel) {
      await this.channel.close();
      log.info("Channel closed");
    }

    if (this.connection) {
      await this.connection.close();
      log.info("Connection closed");
    }
  }
}
