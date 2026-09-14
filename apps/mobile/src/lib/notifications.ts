import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { config } from './config';

export interface ReceiptNotification {
  type: 'payment' | 'settlement' | 'refund';
  /** Payment or settlement id, used to deep-link into the app. */
  id: string;
  title: string;
  body: string;
  /** Amount in stroops/string form, matching the API representation. */
  amount?: string;
  assetCode?: string;
}

/**
 * Render receipts as banners while the app is foregrounded. Without this,
 * iOS/Android suppress notifications for the active app.
 */
export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: () =>
      Promise.resolve({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
  });
}

/**
 * Request permission and return the Expo push token, or `null` when the user
 * declines or no project id is configured (dev builds without EAS).
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('receipts', {
      name: 'Payment receipts',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let status: Notifications.PermissionStatus = existing.status;
  if (status !== Notifications.PermissionStatus.GRANTED) {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== Notifications.PermissionStatus.GRANTED) return null;

  if (!config.pushProjectId) return null;

  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId: config.pushProjectId });
    return token.data;
  } catch {
    // Simulators and devices without Play Services cannot mint push tokens.
    return null;
  }
}

/** Normalize an incoming notification payload into a receipt. */
export function parseReceipt(data: Record<string, unknown>): ReceiptNotification | null {
  const type = data.type;
  if (type !== 'payment' && type !== 'settlement' && type !== 'refund') return null;
  const id = data.id;
  if (typeof id !== 'string') return null;

  return {
    type,
    id,
    title: typeof data.title === 'string' ? data.title : 'EPay',
    body: typeof data.body === 'string' ? data.body : '',
    amount: typeof data.amount === 'string' ? data.amount : undefined,
    assetCode: typeof data.assetCode === 'string' ? data.assetCode : undefined,
  };
}

/** Deep-link path for a tapped receipt. */
export function receiptLink(receipt: ReceiptNotification): string {
  return receipt.type === 'settlement' ? `/settlements/${receipt.id}` : `/payments/${receipt.id}`;
}
