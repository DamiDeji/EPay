import type { PrismaClient } from '@epay/database';

import type { ParsedEvent } from '../blockchain/contracts';
import { createChildLogger } from '../logger';
import { eventsProcessed } from '../metrics';

const log = createChildLogger('dispatcher');

/** Outcome of handing one decoded event to the persistence layer. */
export type DispatchOutcome = 'recorded' | 'duplicate' | 'failed';

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'P2002'
  );
}

/**
 * Persist one decoded Soroban event.
 *
 * ## Why this records rather than projecting
 *
 * A projection needs a key that ties an on-chain id to an off-chain row, and
 * EPay does not currently have one: `PaymentRouter` emits `payment_created`
 * carrying a `u64` payment id, while `apps/api/src/payment/payment.service.ts`
 * mints an unrelated `pay_<random>` string via `generateId('pay')`. There is no
 * column holding the on-chain id on any of `Payment`, `Escrow`, `Refund`,
 * `Subscription`, `Invoice`, `Merchant` or `Settlement`, and nothing in the API
 * submits a Soroban transaction in the first place — the only use of
 * `@stellar/stellar-sdk` outside the contracts is `Keypair` signature
 * verification in `auth.service.ts`.
 *
 * Inventing a projection on top of that would mean writing rows whose
 * `merchantId` was guessed from an address, or marking off-chain payments
 * `CONFIRMED` by matching a random string against a ledger sequence. That is the
 * fabricated-success behaviour this repository forbids, so the indexer does the
 * honest thing instead: it decodes every event and stores it durably, exactly
 * once, in `indexer_events`, which is then the source for reconciliation and for
 * the projections that land once the submission path and a correlation column
 * exist. See `docs/INDEXER.md` for the precise gap and its fix.
 *
 * ## Idempotency
 *
 * `eventId` is unique, so replaying a ledger range, retrying a batch after a
 * crash, or two replicas scanning the same range all converge on one row. An
 * event that was recorded but never applied is left for the next pass.
 */
export async function dispatchEvent(
  event: ParsedEvent,
  prisma: PrismaClient,
): Promise<DispatchOutcome> {
  const labels = {
    contract: event.contractName,
    event: event.eventName,
    known: String(event.known),
  };

  try {
    await prisma.indexerEvent.create({
      data: {
        eventId: event.eventId,
        contractName: event.contractName,
        eventName: event.eventName,
        contractId: event.contractId,
        txHash: event.txHash,
        ledgerSequence: event.ledgerSequence,
        occurredAt: new Date(event.timestamp * 1000),
        payload: event.data as object,
        // Storing the event is the whole projection, so it is applied on write.
        appliedAt: new Date(),
      },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      // Already recorded by an earlier pass or another replica: a replay, not a
      // new fact. This is the retry-safety guarantee, so it is not an error.
      eventsProcessed.inc({ ...labels, outcome: 'duplicate' });
      log.debug({ eventId: event.eventId, event: event.eventName }, 'Duplicate event ignored');
      return 'duplicate';
    }

    eventsProcessed.inc({ ...labels, outcome: 'failed' });
    log.error(
      { eventId: event.eventId, contract: event.contractName, event: event.eventName, error },
      'Failed to record contract event',
    );
    throw error;
  }

  eventsProcessed.inc({ ...labels, outcome: 'recorded' });
  log.info(
    {
      eventId: event.eventId,
      contract: event.contractName,
      event: event.eventName,
      ledger: event.ledgerSequence,
      txHash: event.txHash,
      known: event.known,
    },
    'Recorded contract event',
  );

  return 'recorded';
}
