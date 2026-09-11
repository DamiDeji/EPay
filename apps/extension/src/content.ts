import { findStellarAccounts } from './lib/detect';

/**
 * Content script: watch the page for Stellar public keys so the popup can offer
 * a one-click "Pay with EPay" action for whatever address the user is looking at.
 *
 * The scan is O(page text) and debounced, and it only ever reports addresses it
 * finds in the rendered text — no network calls and no DOM mutation.
 */
const SCAN_DEBOUNCE_MS = 1500;

function currentAccounts(): string[] {
  const text = document.body?.innerText ?? '';
  return findStellarAccounts(text);
}

let lastSignature = '';
let timer: ReturnType<typeof setTimeout> | null = null;

function scheduleScan(): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    const accounts = currentAccounts();
    const signature = accounts.join(',');
    if (signature === lastSignature) return;
    lastSignature = signature;
    void chrome.runtime.sendMessage({
      type: 'EPAY_SCAN_RESULT',
      accounts,
      url: window.location.href,
    });
  }, SCAN_DEBOUNCE_MS);
}

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  const msg = message as { type?: string } | null;
  if (msg?.type === 'EPAY_GET_ACCOUNTS') {
    sendResponse({ accounts: currentAccounts(), url: window.location.href });
    return true;
  }
  if (msg?.type === 'EPAY_SCAN_NOW') {
    scheduleScan();
    sendResponse({ ok: true });
    return true;
  }
  return false;
});

const observer = new MutationObserver(() => {
  scheduleScan();
});

function start(): void {
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  scheduleScan();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}
