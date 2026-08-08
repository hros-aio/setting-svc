import { Injectable } from '@nestjs/common';
import { HealthStatusDto, SubsystemHealth } from '../dto/health-status.dto';

@Injectable()
export class HealthService {
  getHealth(): HealthStatusDto {
    const info: Record<string, SubsystemHealth> = {
      app: { status: 'up' },
    };

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      info,
      details: info,
    };
  }
}
