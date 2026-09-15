import { describe, expect, it, vi } from 'vitest';

import { CheckpointManager, createCheckpointManager } from './checkpoint';
import { fakePrisma } from './testing/doubles';

function store(initial = 0) {
  let value = initial;
  const setLastIndexedBlock = vi.fn(async (block: number) => {
    value = block;
  });
  return {
    getLastIndexedBlock: vi.fn(async () => value),
    setLastIndexedBlock,
    current: () => value,
  };
}

describe('CheckpointManager.load', () => {
  it('adopts the persisted checkpoint', async () => {
    const db = store(500);
    const checkpoint = new CheckpointManager(db, 10);

    await expect(checkpoint.load()).resolves.toBe(500);
    expect(checkpoint.getCurrentBlock()).toBe(500);
    expect(checkpoint.getLastFinalizedBlock()).toBe(500);
  });

  it('falls back to the configured start when there is no checkpoint', async () => {
    const checkpoint = new CheckpointManager(store(0), 0);
    await expect(checkpoint.load()).resolves.toBe(0);
  });

  it('recovers from a corrupted value instead of poisoning arithmetic', async () => {
    const db = {
      // A non-numeric value would make every ledger calculation NaN.
      getLastIndexedBlock: vi.fn(async () => Number('not-a-number')),
      setLastIndexedBlock: vi.fn(async () => undefined),
    };
    const checkpoint = new CheckpointManager(db, 42);

    await expect(checkpoint.load()).resolves.toBe(42);
    expect(checkpoint.getCurrentBlock()).toBe(42);
    expect(checkpoint.getLag(100)).toBe(58);
  });

  it('recovers from a negative value', async () => {
    const db = {
      getLastIndexedBlock: vi.fn(async () => -5),
      setLastIndexedBlock: vi.fn(async () => undefined),
    };
    const checkpoint = new CheckpointManager(db, 7);

    await expect(checkpoint.load()).resolves.toBe(7);
  });
});

describe('CheckpointManager.finalize', () => {
  it('persists the ledger and marks it committed', async () => {
    const db = store(0);
    const checkpoint = new CheckpointManager(db);

    await checkpoint.finalize(120);

    expect(db.setLastIndexedBlock).toHaveBeenCalledWith(120);
    expect(checkpoint.getLastFinalizedBlock()).toBe(120);
    expect(checkpoint.getCurrentBlock()).toBe(120);
  });

  it('refuses to move backwards, which would re-project applied ledgers', async () => {
    const db = store(0);
    const checkpoint = new CheckpointManager(db);
    await checkpoint.finalize(200);

    await expect(checkpoint.finalize(150)).rejects.toThrow(/backwards/);
    expect(db.current()).toBe(200);
    expect(checkpoint.getLastFinalizedBlock()).toBe(200);
  });

  it('allows a deliberate rewind when told to', async () => {
    const db = store(0);
    const checkpoint = new CheckpointManager(db);
    await checkpoint.finalize(200);

    await checkpoint.finalize(150, { allowRewind: true });

    expect(db.current()).toBe(150);
    expect(checkpoint.getLastFinalizedBlock()).toBe(150);
  });

  it('accepts the same ledger twice', async () => {
    const db = store(0);
    const checkpoint = new CheckpointManager(db);

    await checkpoint.finalize(10);
    await expect(checkpoint.finalize(10)).resolves.toBeUndefined();
  });
});

describe('CheckpointManager.advance and getLag', () => {
  it('tracks progress ahead of the committed checkpoint without committing', async () => {
    const db = store(0);
    const checkpoint = new CheckpointManager(db);

    checkpoint.advance(75);

    expect(checkpoint.getCurrentBlock()).toBe(75);
    expect(checkpoint.getLastFinalizedBlock()).toBe(0);
    expect(db.setLastIndexedBlock).not.toHaveBeenCalled();
  });

  it('never reports negative lag when the tip trails the index', async () => {
    const checkpoint = new CheckpointManager(store(0));
    checkpoint.advance(100);

    expect(checkpoint.getLag(100)).toBe(0);
    expect(checkpoint.getLag(90)).toBe(0);
    expect(checkpoint.getLag(130)).toBe(30);
  });
});

describe('createCheckpointManager', () => {
  it('reads and writes the last_indexed_block row', async () => {
    const prisma = fakePrisma();
    const checkpoint = createCheckpointManager(prisma.client, 0);

    await checkpoint.load();
    await checkpoint.finalize(321);

    expect(prisma.state.get('last_indexed_block')).toBe('321');

    // A second manager resumes from the persisted value.
    const resumed = createCheckpointManager(prisma.client, 0);
    await expect(resumed.load()).resolves.toBe(321);
  });

  it('uses the fallback when the row is absent', async () => {
    const prisma = fakePrisma();
    const checkpoint = createCheckpointManager(prisma.client, 99);

    await expect(checkpoint.load()).resolves.toBe(99);
  });
});
