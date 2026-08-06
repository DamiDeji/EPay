import type { ParsedEvent } from '../blockchain/contracts';
import { createChildLogger } from '../logger';

const log = createChildLogger('handler:treasury');

export async function handleTreasuryEvent(
  event: ParsedEvent,
  prisma: {
    treasuryTransaction: { create: (args: any) => Promise<any> };
  },
): Promise<void> {
  const { eventName, data } = event;

  switch (eventName) {
    case 'Deposit': {
      const d = data as { address: string; amount: string };
      await prisma.treasuryTransaction.create({
        data: {
          txType: 'DEPOSIT',
          amount: BigInt(d.amount),
          currency: 'TON',
          fromAddress: d.address,
          txHash: event.txHash,
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });
      log.info({ amount: d.amount }, 'Treasury deposit recorded');
      break;
    }

    case 'Withdrawal': {
      const d = data as { address: string; amount: string; txId: number };
      await prisma.treasuryTransaction.create({
        data: {
          txType: 'WITHDRAWAL',
          amount: BigInt(d.amount),
          currency: 'TON',
          toAddress: d.address,
          txHash: event.txHash,
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });
      break;
    }

    case 'FeeCollected': {
      const d = data as { amount: string; source: string };
      await prisma.treasuryTransaction.create({
        data: {
          txType: 'FEE_COLLECTION',
          amount: BigInt(d.amount),
          currency: 'TON',
          txHash: event.txHash,
          status: 'COMPLETED',
          completedAt: new Date(),
          referenceId: d.source,
          referenceType: 'PAYMENT',
        },
      });
      break;
    }

    case 'EscrowHeld': {
      const d = data as { address: string; amount: string; escrowId: number };
      await prisma.treasuryTransaction.create({
        data: {
          txType: 'ESCROW_HOLD',
          amount: BigInt(d.amount),
          currency: 'TON',
          fromAddress: d.address,
          txHash: event.txHash,
          status: 'COMPLETED',
          referenceId: `esc_${d.escrowId}`,
          referenceType: 'ESCROW',
          completedAt: new Date(),
        },
      });
      break;
    }

    case 'EscrowReleased': {
      const d = data as { address: string; amount: string; escrowId: number };
      await prisma.treasuryTransaction.create({
        data: {
          txType: 'ESCROW_RELEASE',
          amount: BigInt(d.amount),
          currency: 'TON',
          toAddress: d.address,
          txHash: event.txHash,
          status: 'COMPLETED',
          referenceId: `esc_${d.escrowId}`,
          referenceType: 'ESCROW',
          completedAt: new Date(),
        },
      });
      break;
    }

    default:
      log.debug({ eventName }, 'Unhandled treasury event');
  }
}
