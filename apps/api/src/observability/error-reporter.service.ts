import { randomUUID } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';

import { currentRequestId } from './request-context.middleware';

interface ErrorContext {
  method?: string;
  route?: string;
  [key: string]: string | undefined;
}

interface SentryTarget {
  storeUrl: string;
  authHeader: string;
}

/**
 * Error tracing for the API.
 *
 * This speaks Sentry's store API directly rather than importing `@sentry/node`.
 * The SDK adds ~30 transitive packages to the lockfile for what amounts to one
 * HTTP POST; using the wire protocol keeps the dependency surface at zero and
 * means reporting degrades to structured logging (not a crash) when the DSN is
 * absent. Switch to the SDK if we ever need breadcrumbs, release tracking, or
 * performance spans.
 *
 * Enable by setting `SENTRY_DSN`. Nothing is sent when it is unset.
 */
@Injectable()
export class ErrorReporterService {
  private readonly logger = new Logger(ErrorReporterService.name);
  private readonly target = parseDsn(process.env.SENTRY_DSN);

  constructor() {
    if (this.target) {
      this.logger.log('Sentry error reporting enabled');
    }
  }

  /** True when a DSN is configured, so callers can cheaply skip building context. */
  get enabled(): boolean {
    return this.target !== undefined;
  }

  report(error: unknown, context: ErrorContext = {}): void {
    const normalized = error instanceof Error ? error : new Error(String(error));
    const requestId = currentRequestId();

    this.logger.error(
      `${context.route ?? 'unknown'} failed${requestId ? ` (request ${requestId})` : ''}: ${normalized.message}`,
      normalized.stack,
    );

    if (!this.target) {
      return;
    }

    // Fire-and-forget: reporting must never delay or fail the request.
    void this.send(normalized, context, requestId);
  }

  private async send(
    error: Error,
    context: ErrorContext,
    requestId: string | undefined,
  ): Promise<void> {
    const target = this.target;
    if (!target) {
      return;
    }

    const event = {
      event_id: randomUUID().replace(/-/g, ''),
      timestamp: new Date().toISOString(),
      platform: 'node',
      level: 'error',
      logger: 'epay-api',
      message: error.message,
      server_name: process.env.HOSTNAME ?? 'epay-api',
      release: process.env.EPAY_VERSION,
      environment: process.env.NODE_ENV ?? 'development',
      request_id: requestId,
      tags: { method: context.method, route: context.route },
      extra: context,
      exception: {
        values: [
          {
            type: error.name,
            value: error.message,
            stacktrace: { frames: parseStack(error.stack) },
          },
        ],
      },
    };

    try {
      const response = await fetch(target.storeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Sentry-Auth': target.authHeader,
        },
        body: JSON.stringify(event),
      });

      if (!response.ok) {
        this.logger.warn(`Sentry rejected the event with status ${String(response.status)}`);
      }
    } catch (sendError) {
      // Never let the reporter take the process down.
      this.logger.warn(
        `Failed to deliver error event: ${sendError instanceof Error ? sendError.message : String(sendError)}`,
      );
    }
  }
}

/**
 * Parse a Sentry DSN of the form `https://<key>@<host>/<projectId>` into the
 * store endpoint and the `X-Sentry-Auth` header. Returns `undefined` for an
 * absent or malformed DSN rather than throwing at boot.
 */
export function parseDsn(dsn: string | undefined): SentryTarget | undefined {
  if (!dsn) {
    return undefined;
  }

  try {
    const url = new URL(dsn);
    const projectId = url.pathname.replace(/^\//, '');
    if (!url.username || !url.host || !projectId) {
      return undefined;
    }

    const protocol = url.protocol === 'http:' ? 'http' : 'https';
    return {
      storeUrl: `${protocol}://${url.host}/api/${projectId}/store/`,
      authHeader: [
        'Sentry sentry_version=7',
        `sentry_client=${'epay-api/1.0'}`,
        `sentry_key=${url.username}`,
      ].join(', '),
    };
  } catch {
    return undefined;
  }
}

/** Turn a V8 stack string into Sentry frames, innermost last. */
function parseStack(stack: string | undefined): { filename: string; function: string }[] {
  if (!stack) {
    return [];
  }

  return stack
    .split('\n')
    .slice(1)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('at '))
    .slice(0, 50)
    .map((line) => ({ function: line.replace(/^at\s+/, ''), filename: 'unknown' }));
}
