import { timingSafeEqual } from 'node:crypto';

import { Controller, Get, Header, Headers, UnauthorizedException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { MetricsService } from './metrics.service';

/**
 * `GET /metrics` in Prometheus text exposition format.
 *
 * Prometheus scrapes this endpoint (see
 * `monitoring/prometheus/prometheus.yml`). In production it is gated on the
 * `METRICS_TOKEN` bearer token so metric names and traffic volumes are not
 * public; in development it is open so a local scrape needs no secrets.
 */
@ApiTags('Observability')
@Controller()
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Prometheus metrics (bearer-token gated in production)' })
  scrape(@Headers('authorization') authorization?: string): string {
    const isProduction = (process.env.NODE_ENV ?? 'development') === 'production';

    if (isProduction) {
      const token = process.env.METRICS_TOKEN;
      if (!token) {
        // Fail closed: an unconfigured token must not expose metrics publicly.
        throw new UnauthorizedException('METRICS_TOKEN is not configured');
      }
      if (!authorized(authorization, `Bearer ${token}`)) {
        throw new UnauthorizedException('Invalid metrics token');
      }
    }

    return this.metrics.expose();
  }
}

/** Constant-time comparison so the token cannot be recovered by timing. */
function authorized(provided: string | undefined, expected: string): boolean {
  if (!provided) {
    return false;
  }
  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expected);
  if (providedBuf.length !== expectedBuf.length) {
    return false;
  }
  return timingSafeEqual(providedBuf, expectedBuf);
}
