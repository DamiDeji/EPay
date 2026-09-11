import { saveSettings } from './lib/storage';

/**
 * MV3 service worker.
 *
 * In Chrome this runs as an ephemeral service worker; in Firefox it runs as an
 * event page. It must therefore stay stateless and cheap: it only maintains the
 * toolbar badge and relays notifications. All state lives in
 * `chrome.storage.local`.
 */
interface ScanResultMessage {
  type: 'EPAY_SCAN_RESULT';
  accounts: string[];
}

function setBadge(count: number, tabId?: number): void {
  const text = count > 0 ? String(Math.min(count, 99)) : '';
  void chrome.action.setBadgeText({ text, ...(tabId !== undefined ? { tabId } : {}) });
  void chrome.action.setBadgeBackgroundColor({ color: '#0F172A' });
}

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  const msg = message as Partial<ScanResultMessage> | null;

  if (msg?.type === 'EPAY_SCAN_RESULT') {
    setBadge(msg.accounts?.length ?? 0, sender.tab?.id);
    sendResponse({ ok: true });
    return true;
  }

  if ((message as { type?: string } | null)?.type === 'EPAY_SAVE_SETTINGS') {
    const patch = (message as { patch: Record<string, unknown> }).patch;
    void saveSettings(patch as never).then((settings) => {
      sendResponse({ ok: true, settings });
    });
    return true;
  }

  return false;
});

chrome.runtime.onInstalled.addListener(() => {
  setBadge(0);
});
