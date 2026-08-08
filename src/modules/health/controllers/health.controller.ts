import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { HealthStatusDto } from '../dto/health-status.dto';
import { HealthService } from '../services/health.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Get application and infrastructure health status' })
  @ApiResponse({
    status: 200,
    description: 'Service status retrieved successfully',
    type: HealthStatusDto,
  })
  check(): HealthStatusDto {
    return this.healthService.getHealth();
  }
}
