import type { ParsedEvent } from '../blockchain/contracts';
import { createChildLogger } from '../logger';

const log = createChildLogger('handler:refund');

export async function handleRefundEvent(
  event: ParsedEvent,
  prisma: {
    refund: { upsert: (args: any) => Promise<any>; update: (args: any) => Promise<any> };
  },
): Promise<void> {
  const { eventName, data } = event;

  switch (eventName) {
    case 'RefundRequested': {
      const d = data as {
        refundId: number; paymentId: number; amount: string; reason: string;
      };
      await prisma.refund.upsert({
        where: { refundId: `ref_${d.refundId}` },
        update: { amount: BigInt(d.amount), reason: d.reason },
        create: {
          refundId: `ref_${d.refundId}`,
          paymentId: `pay_${d.paymentId}`,
          merchantId: '',
          amount: BigInt(d.amount),
          originalAmount: BigInt(d.amount),
          currency: 'TON',
          status: 'REQUESTED',
          reason: d.reason,
          isPartial: false,
        },
      });
      log.info({ refundId: d.refundId }, 'Refund requested');
      break;
    }

    case 'RefundApproved': {
      const d = data as { refundId: number };
      await prisma.refund.update({
        where: { refundId: `ref_${d.refundId}` },
        data: { status: 'APPROVED' },
      });
      break;
    }

    case 'RefundCompleted': {
      const d = data as { refundId: number; txHash: string };
      await prisma.refund.update({
        where: { refundId: `ref_${d.refundId}` },
        data: {
          status: 'COMPLETED',
          txHash: d.txHash ?? event.txHash,
          processedAt: new Date(),
        },
      });
      break;
    }

    case 'RefundRejected': {
      const d = data as { refundId: number };
      await prisma.refund.update({
        where: { refundId: `ref_${d.refundId}` },
        data: { status: 'REJECTED' },
      });
      break;
    }

    default:
      log.debug({ eventName }, 'Unhandled refund event');
  }
}
