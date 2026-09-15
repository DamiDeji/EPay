import { createServer, type Server } from 'node:http';

import { createChildLogger } from './logger';
import { collectRuntimeMetrics, registry } from './metrics';

const log = createChildLogger('http');

export interface HealthSnapshot {
  /** `false` while the indexer is still doing its initial historical catch-up. */
  ready: boolean;
  currentBlock: number;
  chainTip: number;
  lag: number;
  lastProcessedLedger: number;
  consecutiveErrors: number;
}

export interface IndexerHttpServerOptions {
  port: number;
  /** Reads the current state; called per health probe so it is never stale. */
  health: () => HealthSnapshot;
}

/**
 * The indexer's operational HTTP surface.
 *
 * The deployed manifests already require this: the indexer container's
 * liveness probe targets `/health` on the `metrics` port (4100) and Prometheus
 * scrapes `/metrics` on the same port. Without it the pod's probe fails
 * forever and the scrape target reports the indexer as down.
 */
export class IndexerHttpServer {
  private readonly port: number;
  private readonly health: () => HealthSnapshot;
  private server: Server | null = null;

  constructor(options: IndexerHttpServerOptions) {
    this.port = options.port;
    this.health = options.health;
  }

  /** Start listening. Resolves once the socket is bound. */
  async start(): Promise<void> {
    this.server = createServer((req, res) => {
      // The probe and the scraper are both on the pod network.
      const path = (req.url ?? '/').split('?')[0];

      if (path === '/metrics') {
        collectRuntimeMetrics();
        res.writeHead(200, { 'content-type': 'text/plain; version=0.0.4; charset=utf-8' });
        res.end(registry.expose());
        return;
      }

      if (path === '/health' || path === '/healthz') {
        const snapshot = this.health();
        // Liveness means "the process is up and not wedged", not "caught up":
        // returning 503 during the initial historical sync would make Kubernetes
        // kill a healthy pod that is simply still backfilling.
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', ...snapshot }));
        return;
      }

      if (path === '/ready' || path === '/readyz') {
        const snapshot = this.health();
        const status = snapshot.ready ? 200 : 503;
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ status: snapshot.ready ? 'ready' : 'catching_up', ...snapshot }));
        return;
      }

      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'not found' }));
    });

    await new Promise<void>((resolve, reject) => {
      this.server?.once('error', reject);
      this.server?.listen(this.port, () => {
        log.info({ port: this.port }, 'Indexer HTTP server listening');
        resolve();
      });
    });
  }

  /** The bound port, which differs from the configured one when that is 0. */
  address(): number | null {
    const address = this.server?.address();
    return address && typeof address === 'object' ? address.port : null;
  }

  async stop(): Promise<void> {
    const server = this.server;
    if (!server) return;
    this.server = null;
    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
    });
  }
}
