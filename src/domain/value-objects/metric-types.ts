import { z } from "zod";

export const MetricNameSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9._-]+$/);

export const MetricValueSchema = z.number().finite();

export const IngestTelemetryDTOSchema = z.object({
  deviceId: z.string().uuid(),
  metrics: z.array(
    z.object({
      name: MetricNameSchema,
      value: MetricValueSchema,
      unit: z.string().max(32).optional(),
      timestamp: z.string().datetime().optional(),
      metadata: z.record(z.unknown()).optional(),
    }),
  ).min(1).max(100),
});

export type IngestTelemetryDTO = z.infer<typeof IngestTelemetryDTOSchema>;

export const SingleMetricDTOSchema = z.object({
  deviceId: z.string().uuid(),
  name: MetricNameSchema,
  value: MetricValueSchema,
  unit: z.string().max(32).optional(),
  timestamp: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type SingleMetricDTO = z.infer<typeof SingleMetricDTOSchema>;
