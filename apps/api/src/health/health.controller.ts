import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { HealthCheckService, PrismaHealthIndicator, HealthCheck } from '@nestjs/terminus';

import { PrismaService } from '../database/prisma.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Health check endpoint' })
  check() {
    return this.health.check([
      () => this.db.pingCheck('database', this.prisma),
      () => ({
        http: {
          status: 'up',
          uptime: process.uptime(),
          timestamp: new Date().toISOString(),
        },
      }),
    ]);
  }

  /**
   * Liveness probe.
   *
   * Deliberately dependency-free: a database outage must not cause Kubernetes to
   * restart otherwise-healthy API pods. Point `livenessProbe` here.
   */
  @Get('live')
  @ApiOperation({ summary: 'Liveness probe (no dependency checks)' })
  live() {
    return {
      status: 'up',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Readiness probe.
   *
   * Checks the database, so an instance that cannot serve requests is removed
   * from the Service endpoints without being killed. Point `readinessProbe` here.
   */
  @Get('ready')
  @HealthCheck()
  @ApiOperation({ summary: 'Readiness probe (checks database connectivity)' })
  ready() {
    return this.health.check([() => this.db.pingCheck('database', this.prisma)]);
  }
}
