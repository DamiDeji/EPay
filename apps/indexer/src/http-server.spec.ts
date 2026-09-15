import { afterEach, describe, expect, it } from 'vitest';

import { IndexerHttpServer, type HealthSnapshot } from './http-server';
import { lastProcessedLedger } from './metrics';

const ready: HealthSnapshot = {
  ready: true,
  currentBlock: 100,
  chainTip: 105,
  lag: 5,
  lastProcessedLedger: 100,
  consecutiveErrors: 0,
};

let server: IndexerHttpServer | null = null;

async function start(snapshot: HealthSnapshot = ready): Promise<string> {
  server = new IndexerHttpServer({ port: 0, health: () => snapshot });
  await server.start();
  const port = server.address();
  if (port === null) throw new Error('server did not bind');
  return `http://127.0.0.1:${String(port)}`;
}

afterEach(async () => {
  await server?.stop();
  server = null;
});

describe('IndexerHttpServer', () => {
  it('binds an ephemeral port on request', async () => {
    const base = await start();
    expect(base).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    expect(server?.address()).toBeGreaterThan(0);
  });

  it('exposes the indexer metrics that the dashboards and alerts read', async () => {
    lastProcessedLedger.set({}, 4321);
    const base = await start();

    const response = await fetch(`${base}/metrics`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/plain');
    const body = await response.text();
    // `epay_indexer_ledger_lag` is the exact series plotted by
    // monitoring/grafana/dashboards/epay-queue-lag.json.
    expect(body).toContain('epay_indexer_ledger_lag');
    expect(body).toContain('epay_indexer_last_processed_ledger 4321');
  });

  it('ignores a query string on the metrics path', async () => {
    const base = await start();
    const response = await fetch(`${base}/metrics?foo=bar`);
    expect(response.status).toBe(200);
  });

  it('answers the liveness probe with 200 while still catching up', async () => {
    // A pod that is backfilling is healthy; returning 503 here would make
    // Kubernetes restart a working indexer in a loop.
    const base = await start({ ...ready, ready: false });

    const response = await fetch(`${base}/health`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: 'ok', ready: false });
  });

  it('answers the readiness probe with 503 until the catch-up completes', async () => {
    const base = await start({ ...ready, ready: false });

    const response = await fetch(`${base}/ready`);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ status: 'catching_up' });
  });

  it('answers readiness with 200 once caught up', async () => {
    const base = await start();

    const response = await fetch(`${base}/ready`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: 'ready',
      currentBlock: 100,
      lag: 5,
    });
  });

  it('reads health fresh on every request', async () => {
    let block = 1;
    server = new IndexerHttpServer({
      port: 0,
      health: () => ({ ...ready, currentBlock: block }),
    });
    await server.start();
    const base = `http://127.0.0.1:${String(server.address())}`;

    const first = await (await fetch(`${base}/health`)).json();
    block = 2;
    const second = await (await fetch(`${base}/health`)).json();

    expect(first).toMatchObject({ currentBlock: 1 });
    expect(second).toMatchObject({ currentBlock: 2 });
  });

  it('returns 404 for anything else', async () => {
    const base = await start();

    const response = await fetch(`${base}/nope`);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'not found' });
  });

  it('stops cleanly', async () => {
    const base = await start();
    await server?.stop();

    await expect(fetch(`${base}/health`)).rejects.toThrow();
  });
});
