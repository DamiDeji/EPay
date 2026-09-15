import { describe, expect, it } from 'vitest';

import { dispatchEvent } from './handlers/dispatcher';
import { readCheckpoint, reconcile } from './reconciliation';
import { fakePrisma, parsedEvent } from './testing/doubles';

describe('readCheckpoint', () => {
  it('returns zero when no checkpoint has been written', async () => {
    const prisma = fakePrisma();
    await expect(readCheckpoint(prisma.client)).resolves.toBe(0);
  });

  it('returns the stored ledger', async () => {
    const prisma = fakePrisma();
    prisma.state.set('last_indexed_block', '800');

    await expect(readCheckpoint(prisma.client)).resolves.toBe(800);
  });

  it('returns zero for a corrupted value rather than NaN', async () => {
    const prisma = fakePrisma();
    prisma.state.set('last_indexed_block', 'garbage');

    await expect(readCheckpoint(prisma.client)).resolves.toBe(0);
  });
});

describe('reconcile', () => {
  it('reports no outstanding work after a clean run', async () => {
    const prisma = fakePrisma();
    prisma.state.set('last_indexed_block', '500');
    await dispatchEvent(parsedEvent({ eventId: 'e1' }), prisma.client);
    await dispatchEvent(parsedEvent({ eventId: 'e2' }), prisma.client);

    const report = await reconcile(prisma.client);

    expect(report).toEqual({
      lastIndexedBlock: 500,
      unappliedEvents: 0,
      unappliedLedgers: 0,
      oldestUnappliedLedger: null,
      totalEvents: 2,
    });
  });

  it('surfaces work left behind by a crash', async () => {
    const prisma = fakePrisma();
    await dispatchEvent(parsedEvent({ eventId: 'e1', ledgerSequence: 10 }), prisma.client);
    await dispatchEvent(parsedEvent({ eventId: 'e2', ledgerSequence: 12 }), prisma.client);
    await dispatchEvent(parsedEvent({ eventId: 'e3', ledgerSequence: 12 }), prisma.client);

    // Imitate a batch that died between writing events and checkpointing.
    if (prisma.events[1]) prisma.events[1].appliedAt = null;
    if (prisma.events[2]) prisma.events[2].appliedAt = null;

    const report = await reconcile(prisma.client);

    expect(report.unappliedEvents).toBe(2);
    expect(report.unappliedLedgers).toBe(1);
    expect(report.oldestUnappliedLedger).toBe(12);
  });

  it('is stable when there is nothing at all', async () => {
    const prisma = fakePrisma();

    await expect(reconcile(prisma.client)).resolves.toEqual({
      lastIndexedBlock: 0,
      unappliedEvents: 0,
      unappliedLedgers: 0,
      oldestUnappliedLedger: null,
      totalEvents: 0,
    });
  });
});
