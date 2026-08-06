import type { ParsedEvent } from '../blockchain/contracts';
import { createChildLogger } from '../logger';

const log = createChildLogger('handler:subscription');

export async function handleSubscriptionEvent(
  event: ParsedEvent,
  prisma: {
    subscription: { upsert: (args: any) => Promise<any>; update: (args: any) => Promise<any> };
  },
): Promise<void> {
  const { eventName, data } = event;

  switch (eventName) {
    case 'SubscriptionCreated': {
      const d = data as {
        subscriptionId: number; merchant: string; customer: string; planName: string;
        amount: string; interval: string;
      };
      await prisma.subscription.upsert({
        where: { subscriptionId: `sub_${d.subscriptionId}` },
        update: { amount: BigInt(d.amount), planName: d.planName },
        create: {
          subscriptionId: `sub_${d.subscriptionId}`,
          merchantId: d.merchant,
          customerId: d.customer,
          planName: d.planName,
          amount: BigInt(d.amount),
          currency: 'TON',
          interval: 'MONTHLY',
          status: 'ACTIVE',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 86400_000),
          nextBillingDate: new Date(Date.now() + 30 * 86400_000),
        },
      });
      log.info({ subscriptionId: d.subscriptionId }, 'Subscription created');
      break;
    }

    case 'SubscriptionRenewed': {
      const d = data as { subscriptionId: number };
      await prisma.subscription.update({
        where: { subscriptionId: `sub_${d.subscriptionId}` },
        data: {
          paymentsMade: { increment: 1 },
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 86400_000),
          nextBillingDate: new Date(Date.now() + 30 * 86400_000),
        },
      });
      break;
    }

    case 'SubscriptionPaused': {
      const d = data as { subscriptionId: number };
      await prisma.subscription.update({
        where: { subscriptionId: `sub_${d.subscriptionId}` },
        data: { status: 'PAUSED' },
      });
      break;
    }

    case 'SubscriptionCancelled': {
      const d = data as { subscriptionId: number };
      await prisma.subscription.update({
        where: { subscriptionId: `sub_${d.subscriptionId}` },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      });
      break;
    }

    default:
      log.debug({ eventName }, 'Unhandled subscription event');
  }
}
