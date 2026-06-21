import { PrismaClient } from "@prisma/client";
import type {
  IDeviceRepository,
} from "../../../domain/entities/repositories.js";
import { Device } from "../../../domain/entities/device.js";
import type { DeviceProps } from "../../../domain/entities/device.js";
import { getLogger } from "../../../shared/logger.js";

const log = getLogger("PrismaDeviceRepository");

export class PrismaDeviceRepository implements IDeviceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Device | null> {
    const record = await this.prisma.device.findUnique({ where: { id } });
    if (!record) return null;
    return Device.fromPersistence({
      id: record.id,
      externalId: record.externalId,
      name: record.name,
      type: record.type as DeviceProps["type"],
      firmware: record.firmware,
      isActive: record.isActive,
      lastSeenAt: record.lastSeenAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  async findByExternalId(externalId: string): Promise<Device | null> {
    const record = await this.prisma.device.findUnique({ where: { externalId } });
    if (!record) return null;
    return Device.fromPersistence({
      id: record.id,
      externalId: record.externalId,
      name: record.name,
      type: record.type as DeviceProps["type"],
      firmware: record.firmware,
      isActive: record.isActive,
      lastSeenAt: record.lastSeenAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  async save(device: Device): Promise<Device> {
    const props = device.toPersistence();
    const record = await this.prisma.device.create({
      data: {
        id: props.id,
        externalId: props.externalId,
        name: props.name,
        type: props.type,
        firmware: props.firmware,
        isActive: props.isActive,
        lastSeenAt: props.lastSeenAt,
      },
    });
    log.info({ deviceId: record.id }, "Device created");
    return Device.fromPersistence({
      id: record.id,
      externalId: record.externalId,
      name: record.name,
      type: record.type as DeviceProps["type"],
      firmware: record.firmware,
      isActive: record.isActive,
      lastSeenAt: record.lastSeenAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  async update(device: Device): Promise<void> {
    const props = device.toPersistence();
    await this.prisma.device.update({
      where: { id: props.id },
      data: {
        name: props.name,
        firmware: props.firmware,
        isActive: props.isActive,
        lastSeenAt: props.lastSeenAt,
      },
    });
  }
}
