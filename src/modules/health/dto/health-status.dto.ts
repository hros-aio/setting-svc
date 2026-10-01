import { ApiProperty } from '@nestjs/swagger';

export interface SubsystemHealth {
  status: 'up' | 'down';
  message?: string;
}

export class HealthStatusDto {
  @ApiProperty({ example: 'ok', enum: ['ok', 'error'] })
  readonly status!: 'ok' | 'error';

  @ApiProperty({ example: '2026-09-20T04:00:00.000Z' })
  readonly timestamp!: string;

  @ApiProperty({
    example: { database: { status: 'up' }, redis: { status: 'up' } },
  })
  readonly info!: Record<string, SubsystemHealth>;

  @ApiProperty({
    example: { database: { status: 'up' }, redis: { status: 'up' } },
  })
  readonly details!: Record<string, SubsystemHealth>;
}
