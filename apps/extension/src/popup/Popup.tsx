import { useWallet } from '@epay/hooks';
import React, { useCallback, useEffect, useState } from 'react';

import { buildPaymentUri, isStellarAccount, truncateAccount } from '../lib/detect';
import { getSettings, type ExtensionSettings } from '../lib/storage';

interface ScanResponse {
  accounts: string[];
  url: string;
}

export function Popup(): React.ReactElement {
  const wallet = useWallet();
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [accounts, setAccounts] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [asset, setAsset] = useState('XLM');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setSettings(await getSettings());

      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) return;
        const response = (await chrome.tabs.sendMessage(tab.id, {
          type: 'EPAY_GET_ACCOUNTS',
        })) as ScanResponse | undefined;
        const found = response?.accounts ?? [];
        setAccounts(found);
        setSelected(found[0] ?? null);
      } catch {
        // chrome:// and extension pages have no content script; that's fine.
        setAccounts([]);
      }
    })();
  }, []);

  const onPay = useCallback(() => {
    if (!settings) return;
    if (!selected || !isStellarAccount(selected)) {
      setError('No Stellar address selected.');
      return;
    }
    if (amount && (!Number.isFinite(Number(amount)) || Number(amount) <= 0)) {
      setError('Enter a positive amount.');
      return;
    }

    const uri = buildPaymentUri(selected, amount || undefined, asset || undefined);
    const params = uri.slice(uri.indexOf('?') + 1);
    void chrome.tabs.create({ url: `${settings.webUrl}/pay?${params}` });
    window.close();
  }, [settings, selected, amount, asset]);

  return (
    <div className="popup">
      <div className="header">
        <h1 className="title">Pay with EPay</h1>
        <span className="muted">
          {wallet.connected && wallet.publicKey
            ? truncateAccount(wallet.publicKey)
            : 'Not connected'}
        </span>
      </div>

      {wallet.connected ? (
        <button className="secondary" type="button" onClick={wallet.disconnect}>
          Disconnect wallet
        </button>
      ) : (
        <button type="button" onClick={() => void wallet.connect('freighter')}>
          {wallet.connecting ? 'Connecting…' : 'Connect Freighter'}
        </button>
      )}
      {wallet.error ? <span className="error">{wallet.error}</span> : null}

      <div>
        <span className="muted">
          {accounts.length === 0
            ? 'No Stellar addresses found on this page.'
            : `${accounts.length} address${accounts.length === 1 ? '' : 'es'} found`}
        </span>
        {accounts.map((account) => (
          <div className="account" key={account}>
            <label>
              <input
                type="radio"
                name="account"
                checked={selected === account}
                onChange={() => setSelected(account)}
              />{' '}
              {truncateAccount(account)}
            </label>
            <button
              type="button"
              className="secondary"
              onClick={() => void navigator.clipboard.writeText(account)}
            >
              Copy
            </button>
          </div>
        ))}
      </div>

      <div className="row">
        <div className="field">
          <label htmlFor="amount">Amount</label>
          <input
            id="amount"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="asset">Asset</label>
          <select id="asset" value={asset} onChange={(e) => setAsset(e.target.value)}>
            <option value="XLM">XLM</option>
            <option value="USDC">USDC</option>
          </select>
        </div>
      </div>

      {error ? <span className="error">{error}</span> : null}

      <button type="button" disabled={!selected} onClick={onPay}>
        Pay with EPay
      </button>
    </div>
  );
}
