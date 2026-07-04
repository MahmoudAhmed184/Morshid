import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';

import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly healthCheck: HealthCheckService,
    private readonly healthService: HealthService,
  ) {}

  @Get('live')
  @HealthCheck()
  @ApiOperation({ summary: 'Process liveness check' })
  live() {
    return this.healthCheck.check([
      () => ({
        process: {
          status: 'up',
        },
      }),
    ]);
  }

  @Get('ready')
  @HealthCheck()
  @ApiOperation({ summary: 'Dependency readiness check' })
  ready() {
    return this.healthCheck.check([
      () => this.healthService.checkDatabase(),
      () => this.healthService.checkRedis(),
      () => this.healthService.checkPgVector(),
    ]);
  }
}
