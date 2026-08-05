import { createChildLogger } from '../logger';
import type { ParsedEvent } from '../blockchain/contracts';

const log = createChildLogger('handler:payment');

/**
 * Handle payment-related blockchain events and sync to database.
 */
export async function handlePaymentEvent(
  event: ParsedEvent,
  prisma: {
    payment: { upsert: (args: any) => Promise<any>; update: (args: any) => Promise<any> };
  },
): Promise<void> {
  const { eventName, data } = event;

  switch (eventName) {
    case 'PaymentCreated': {
      const paymentData = data as {
        paymentId: number;
        merchant: string;
        payer: string;
        amount: string;
      };

      await prisma.payment.upsert({
        where: { paymentId: `pay_${paymentData.paymentId}` },
        update: {
          amount: BigInt(paymentData.amount),
          payerAddress: paymentData.payer,
          recipientAddress: paymentData.merchant,
          status: 'PENDING',
        },
        create: {
          paymentId: `pay_${paymentData.paymentId}`,
          merchantId: paymentData.merchant,
          amount: BigInt(paymentData.amount),
          currency: 'TON',
          status: 'PENDING',
          payerAddress: paymentData.payer,
          recipientAddress: paymentData.merchant,
          txHash: event.txHash,
          blockHeight: event.blockHeight,
          expiresAt: new Date(Date.now() + 3600_000),
        },
      });

      log.info({ paymentId: paymentData.paymentId }, 'Payment created');
      break;
    }

    case 'PaymentConfirmed': {
      const confirmData = data as { paymentId: number };
      await prisma.payment.update({
        where: { paymentId: `pay_${confirmData.paymentId}` },
        data: {
          status: 'CONFIRMED',
          txHash: event.txHash,
          confirmedAt: new Date(event.timestamp * 1000),
        },
      });
      log.info({ paymentId: confirmData.paymentId }, 'Payment confirmed');
      break;
    }

    case 'PaymentCompleted': {
      const completeData = data as { paymentId: number };
      await prisma.payment.update({
        where: { paymentId: `pay_${completeData.paymentId}` },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(event.timestamp * 1000),
        },
      });
      log.info({ paymentId: completeData.paymentId }, 'Payment completed');
      break;
    }

    case 'PaymentFailed': {
      const failData = data as { paymentId: number; reason?: string };
      await prisma.payment.update({
        where: { paymentId: `pay_${failData.paymentId}` },
        data: { status: 'FAILED' },
      });
      log.info({ paymentId: failData.paymentId }, 'Payment failed');
      break;
    }

    case 'PaymentRefunded': {
      const refundData = data as { paymentId: number; refundAmount: string };
      await prisma.payment.update({
        where: { paymentId: `pay_${refundData.paymentId}` },
        data: { status: 'REFUNDED' },
      });
      log.info({ paymentId: refundData.paymentId }, 'Payment refunded');
      break;
    }

    default:
      log.debug({ eventName }, 'Unhandled payment event');
  }
}
