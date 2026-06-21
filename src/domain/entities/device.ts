import type { DeviceType } from "../value-objects/device-types.js";

export interface DeviceProps {
  id: string;
  externalId: string;
  name: string;
  type: DeviceType;
  firmware: string | null;
  isActive: boolean;
  lastSeenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Device {
  private constructor(private readonly props: DeviceProps) {}

  static create(props: Omit<DeviceProps, "createdAt" | "updatedAt">): Device {
    return new Device({
      ...props,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static fromPersistence(props: DeviceProps): Device {
    return new Device(props);
  }

  get id(): string {
    return this.props.id;
  }

  get externalId(): string {
    return this.props.externalId;
  }

  get name(): string {
    return this.props.name;
  }

  get type(): DeviceType {
    return this.props.type;
  }

  get firmware(): string | null {
    return this.props.firmware;
  }

  get isActive(): boolean {
    return this.props.isActive;
  }

  get lastSeenAt(): Date | null {
    return this.props.lastSeenAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  touch(): void {
    (this.props as { lastSeenAt: Date | null }).lastSeenAt = new Date();
    (this.props as { updatedAt: Date }).updatedAt = new Date();
  }

  deactivate(): void {
    (this.props as { isActive: boolean }).isActive = false;
    (this.props as { updatedAt: Date }).updatedAt = new Date();
  }

  activate(): void {
    (this.props as { isActive: boolean }).isActive = true;
    (this.props as { updatedAt: Date }).updatedAt = new Date();
  }

  toPersistence(): DeviceProps {
    return { ...this.props };
  }
}
