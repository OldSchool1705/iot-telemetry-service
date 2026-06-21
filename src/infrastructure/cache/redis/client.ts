import Redis from "ioredis";
import { getLogger } from "../../../shared/logger.js";

const log = getLogger("Redis");

export interface RedisConfig {
  url: string;
  keyPrefix?: string;
  maxRetriesPerRequest?: number;
  retryStrategy?: (times: number) => number | null;
}

export function createRedisClient(config: RedisConfig): Redis {
  const client = new Redis(config.url, {
    keyPrefix: config.keyPrefix,
    maxRetriesPerRequest: config.maxRetriesPerRequest ?? 3,
    retryStrategy: config.retryStrategy ?? ((times: number) => {
      if (times > 10) return null;
      return Math.min(times * 200, 5000);
    }),
    enableReadyCheck: true,
    lazyConnect: true,
  });

  client.on("connect", () => log.info("Redis connected"));
  client.on("ready", () => log.info("Redis ready"));
  client.on("error", (err: Error) => log.error({ err }, "Redis error"));
  client.on("close", () => log.warn("Redis connection closed"));

  return client;
}
