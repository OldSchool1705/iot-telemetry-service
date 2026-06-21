export interface TelemetryMetricProps {
  id: string;
  deviceId: string;
  name: string;
  value: number;
  unit: string | null;
  timestamp: Date;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export class TelemetryMetric {
  private constructor(private readonly props: TelemetryMetricProps) {}

  static create(
    props: Omit<TelemetryMetricProps, "id" | "createdAt">,
  ): TelemetryMetric {
    return new TelemetryMetric({
      ...props,
      id: crypto.randomUUID(),
      createdAt: new Date(),
    });
  }

  static fromPersistence(props: TelemetryMetricProps): TelemetryMetric {
    return new TelemetryMetric(props);
  }

  get id(): string {
    return this.props.id;
  }

  get deviceId(): string {
    return this.props.deviceId;
  }

  get name(): string {
    return this.props.name;
  }

  get value(): number {
    return this.props.value;
  }

  get unit(): string | null {
    return this.props.unit;
  }

  get timestamp(): Date {
    return this.props.timestamp;
  }

  get metadata(): Record<string, unknown> | null {
    return this.props.metadata;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  toPersistence(): TelemetryMetricProps {
    return { ...this.props };
  }
}
