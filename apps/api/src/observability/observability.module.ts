import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { ErrorReporterService } from './error-reporter.service';
import { MetricsController } from './metrics.controller';
import { MetricsInterceptor } from './metrics.interceptor';
import { MetricsService } from './metrics.service';

/**
 * Observability for the API: Prometheus metrics, request-id correlation, and
 * Sentry-compatible error reporting. Imported once by `AppModule`; the
 * interceptor is global so every route is instrumented without per-controller
 * decoration.
 */
@Module({
  controllers: [MetricsController],
  providers: [
    MetricsService,
    ErrorReporterService,
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
  ],
  exports: [MetricsService],
})
export class ObservabilityModule {}
