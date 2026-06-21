import type Redis from "ioredis";
import { getLogger } from "../../../shared/logger.js";

const log = getLogger("RedisIdempotencyStore");

export class RedisIdempotencyStore {
  constructor(
    private readonly redis: Redis,
    private readonly defaultTtlSeconds: number = 3600,
  ) {}

  async isDuplicate(key: string): Promise<boolean> {
    const exists = await this.redis.exists(`idempotency:${key}`);
    return exists === 1;
  }

  async markProcessed(key: string, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds ?? this.defaultTtlSeconds;
    await this.redis.setex(`idempotency:${key}`, ttl, "1");
    log.debug({ key, ttl }, "Idempotency key stored");
  }

  async acquireLock(key: string, ttlMs: number = 5000): Promise<boolean> {
    const result = await this.redis.set(
      `lock:${key}`,
      "1",
      "PX",
      ttlMs,
      "NX",
    );
    return result === "OK";
  }

  async releaseLock(key: string): Promise<void> {
    await this.redis.del(`lock:${key}`);
  }
}
