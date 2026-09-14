import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { catchError, tap, throwError, type Observable } from 'rxjs';

import { ErrorReporterService } from './error-reporter.service';
import { MetricsService } from './metrics.service';

interface HttpRequestLike {
  method?: string;
  url?: string;
  /** Fastify's matched route pattern, e.g. `/payments/:id`. */
  routerPath?: string;
  routeOptions?: { url?: string };
}

interface HttpResponseLike {
  statusCode?: number;
}

/**
 * Records `epay_http_requests_total` and `epay_http_request_duration_seconds`
 * for every request, and forwards failed requests to the error reporter.
 *
 * The `route` label uses Fastify's matched pattern rather than the raw URL: label
 * values become time series, and `/payments/:id` keeps cardinality bounded where
 * `/payments/abc123` would create one series per payment.
 */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(
    private readonly metrics: MetricsService,
    private readonly reporter: ErrorReporterService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<HttpRequestLike>();
    const response = http.getResponse<HttpResponseLike>();

    const method = request.method ?? 'GET';
    const route = resolveRoute(request);
    const startedAt = process.hrtime.bigint();

    const finish = (status: number): void => {
      const seconds = Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
      this.metrics.recordHttpRequest(method, route, status, seconds);
    };

    return next.handle().pipe(
      tap(() => {
        finish(response.statusCode ?? 200);
      }),
      catchError((error: unknown) => {
        // Exception filters may not have written the status yet, so a failed
        // handler is recorded as 5xx unless the response already says otherwise.
        const status =
          typeof response.statusCode === 'number' && response.statusCode >= 400
            ? response.statusCode
            : 500;
        finish(status);
        this.reporter.report(error, { method, route });
        return throwError(() => error);
      }),
    );
  }
}

function resolveRoute(request: HttpRequestLike): string {
  const matched = request.routerPath ?? request.routeOptions?.url;
  if (matched && matched.length > 0) {
    return matched;
  }
  // Unmatched routes (404/405) would otherwise leak raw paths into labels.
  return 'unmatched';
}
