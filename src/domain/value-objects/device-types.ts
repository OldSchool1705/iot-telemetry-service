import { z } from "zod";

export const DeviceTypeSchema = z.enum([
  "temperature",
  "humidity",
  "pressure",
  "motion",
  "light",
  "custom",
]);

export type DeviceType = z.infer<typeof DeviceTypeSchema>;

export const CreateDeviceSchema = z.object({
  externalId: z.string().min(1).max(128),
  name: z.string().min(1).max(256),
  type: DeviceTypeSchema,
  firmware: z.string().max(64).optional(),
});

export type CreateDeviceDTO = z.infer<typeof CreateDeviceSchema>;
