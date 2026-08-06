import type { ParsedEvent } from '../blockchain/contracts';
import { createChildLogger } from '../logger';

import { handleEscrowEvent } from './escrow';
import { handlePaymentEvent } from './payment';
import { handleRefundEvent } from './refund';
import { handleSubscriptionEvent } from './subscription';
import { handleTreasuryEvent } from './treasury';

const log = createChildLogger('dispatcher');

/**
 * Route a parsed blockchain event to the correct handler based on
 * which contract emitted it.
 */
export async function dispatchEvent(
  event: ParsedEvent,
  prisma: any,
): Promise<void> {
  const { contractName } = event;

  try {
    switch (contractName) {
      case 'PaymentRouter':
        await handlePaymentEvent(event, prisma);
        break;
      case 'EscrowManager':
        await handleEscrowEvent(event, prisma);
        break;
      case 'RefundManager':
        await handleRefundEvent(event, prisma);
        break;
      case 'SubscriptionManager':
        await handleSubscriptionEvent(event, prisma);
        break;
      case 'TreasuryVault':
        await handleTreasuryEvent(event, prisma);
        break;
      case 'InvoiceManager':
        log.debug({ eventName: event.eventName }, 'Invoice event received');
        break;
      case 'MerchantRegistry':
        log.debug({ eventName: event.eventName }, 'Merchant event received');
        break;
      default:
        log.debug({ contractName }, 'Unknown contract event');
    }
  } catch (error) {
    log.error({ contractName, eventName: event.eventName, error }, 'Failed to dispatch event');
    throw error;
  }
}
