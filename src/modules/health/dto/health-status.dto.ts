export interface SubsystemHealth {
  status: 'up' | 'down';
  message?: string;
}

export class HealthStatusDto {
  readonly status!: 'ok' | 'error';
  readonly timestamp!: string;
  readonly info!: Record<string, SubsystemHealth>;
  readonly details!: Record<string, SubsystemHealth>;
}
