export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export class DeviceNotFoundError extends DomainError {
  constructor(deviceId: string) {
    super(`Device not found: ${deviceId}`, "DEVICE_NOT_FOUND");
    this.name = "DeviceNotFoundError";
  }
}

export class InvalidTelemetryError extends DomainError {
  constructor(detail: string) {
    super(`Invalid telemetry data: ${detail}`, "INVALID_TELEMETRY");
    this.name = "InvalidTelemetryError";
  }
}

export class DeviceInactiveError extends DomainError {
  constructor(deviceId: string) {
    super(`Device is inactive: ${deviceId}`, "DEVICE_INACTIVE");
    this.name = "DeviceInactiveError";
  }
}
