import { AsyncLocalStorage } from "node:async_hooks";
import pino from "pino";

export interface LogContext {
  traceId?: string;
  deviceId?: string;
  [key: string]: unknown;
}

const asyncStorage = new AsyncLocalStorage<LogContext>();

const baseLogger = pino({
  level: process.env["LOG_LEVEL"] ?? "info",
  transport:
    process.env["NODE_ENV"] !== "production"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
});

export function getLogger(name: string) {
  return baseLogger.child({ service: name });
}

export function getTraceLogger(): pino.Logger {
  const store = asyncStorage.getStore();
  return baseLogger.child({ ...store, service: "app" });
}

export function runWithTraceId<T>(traceId: string, fn: () => T): T {
  const context: LogContext = { traceId };
  return asyncStorage.run(context, fn);
}

export function getTraceId(): string | undefined {
  return asyncStorage.getStore()?.traceId;
}

export function setTraceId(traceId: string): void {
  const store = asyncStorage.getStore();
  if (store) {
    store.traceId = traceId;
  }
}

export function setDeviceId(deviceId: string): void {
  const store = asyncStorage.getStore();
  if (store) {
    store.deviceId = deviceId;
  }
}

export function getLogContext(): LogContext {
  return asyncStorage.getStore() ?? {};
}
