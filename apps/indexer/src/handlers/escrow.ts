import type { ParsedEvent } from '../blockchain/contracts';
import { createChildLogger } from '../logger';

const log = createChildLogger('handler:escrow');

/**
 * Handle escrow-related blockchain events and sync to database.
 */
export async function handleEscrowEvent(
  event: ParsedEvent,
  prisma: {
    escrow: { upsert: (args: any) => Promise<any>; update: (args: any) => Promise<any> };
    milestone: { upsert: (args: any) => Promise<any>; update: (args: any) => Promise<any> };
  },
): Promise<void> {
  const { eventName, data } = event;

  switch (eventName) {
    case 'EscrowCreated': {
      const d = data as { escrowId: number; merchant: string; customer: string; amount: string };
      await prisma.escrow.upsert({
        where: { escrowId: `esc_${d.escrowId}` },
        update: {
          amount: BigInt(d.amount),
          status: 'CREATED',
        },
        create: {
          escrowId: `esc_${d.escrowId}`,
          merchantId: d.merchant,
          customerId: d.customer,
          amount: BigInt(d.amount),
          currency: 'TON',
          status: 'CREATED',
          contractAddress: event.data.contractAddress as string,
          txHash: event.txHash,
        },
      });
      log.info({ escrowId: d.escrowId }, 'Escrow created');
      break;
    }

    case 'EscrowFunded': {
      const d = data as { escrowId: number };
      await prisma.escrow.update({
        where: { escrowId: `esc_${d.escrowId}` },
        data: { status: 'FUNDED' },
      });
      log.info({ escrowId: d.escrowId }, 'Escrow funded');
      break;
    }

    case 'MilestoneCompleted': {
      const d = data as { escrowId: number; milestoneIndex: number };
      await prisma.milestone.upsert({
        where: { id: `mil_${d.escrowId}_${d.milestoneIndex}` },
        update: { status: 'COMPLETED', completedAt: new Date() },
        create: {
          id: `mil_${d.escrowId}_${d.milestoneIndex}`,
          escrowId: `esc_${d.escrowId}`,
          index: d.milestoneIndex,
          description: `Milestone ${d.milestoneIndex}`,
          amount: BigInt(0),
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });
      log.info({ escrowId: d.escrowId, milestone: d.milestoneIndex }, 'Milestone completed');
      break;
    }

    case 'EscrowCompleted': {
      const d = data as { escrowId: number };
      await prisma.escrow.update({
        where: { escrowId: `esc_${d.escrowId}` },
        data: { status: 'COMPLETED' },
      });
      log.info({ escrowId: d.escrowId }, 'Escrow completed');
      break;
    }

    case 'EscrowDisputed': {
      const d = data as { escrowId: number };
      await prisma.escrow.update({
        where: { escrowId: `esc_${d.escrowId}` },
        data: { status: 'DISPUTED', disputedAt: new Date() },
      });
      log.info({ escrowId: d.escrowId }, 'Escrow disputed');
      break;
    }

    case 'EscrowResolved': {
      const d = data as { escrowId: number };
      await prisma.escrow.update({
        where: { escrowId: `esc_${d.escrowId}` },
        data: { status: 'RESOLVED', resolvedAt: new Date() },
      });
      break;
    }

    case 'EscrowCancelled': {
      const d = data as { escrowId: number };
      await prisma.escrow.update({
        where: { escrowId: `esc_${d.escrowId}` },
        data: { status: 'CANCELLED' },
      });
      break;
    }

    default:
      log.debug({ eventName }, 'Unhandled escrow event');
  }
}
