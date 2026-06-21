import { z } from "zod";

export const GetAnalyticsQuerySchema = z.object({
  deviceId: z.string().uuid(),
  from: z.string().datetime(),
  to: z.string().datetime(),
  aggregation: z.enum(["hourly", "daily"]).default("hourly"),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
});

export type GetAnalyticsQuery = z.infer<typeof GetAnalyticsQuerySchema>;
