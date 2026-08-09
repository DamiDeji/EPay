'use client';

import { Card, CardHeader, CardTitle, CardContent, Button, Badge, Skeleton } from '@epay/ui';
import { motion } from 'framer-motion';
import {
  Wallet,
  Copy,
  ExternalLink,
  ArrowDownRight,
  ArrowUpRight,
  RefreshCw,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { useState } from 'react';

const TRANSACTIONS = [
  { type: 'in', amount: '150.00 XLM', from: 'GAD...x9m2', date: '2026-08-05 14:22', txHash: '0xabc...123' },
  { type: 'out', amount: '45.00 XLM', to: 'GBD...k4h7', date: '2026-08-05 10:15', txHash: '0xdef...456' },
  { type: 'in', amount: '12.50 XLM', from: 'GCD...v2f1', date: '2026-08-04 18:40', txHash: '0xghi...789' },
  { type: 'in', amount: '89.99 XLM', from: 'GDD...n6c3', date: '2026-08-04 09:10', txHash: '0xjkl...012' },
  { type: 'out', amount: '250.00 XLM', to: 'GED...p8d9', date: '2026-08-03 22:05', txHash: '0xmno...345' },
];

export default function WalletPage() {
  const [isConnected, setIsConnected] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshBalance = async () => {
    setIsRefreshing(true);
    await new Promise((r) => setTimeout(r, 1000));
    setIsRefreshing(false);
  };

  if (!isConnected) {
    return (
      <div className="space-y-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Wallet</h1>
        <Card className="text-center">
          <CardContent className="py-16">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#0098EA]/10 to-[#1E3A8A]/10 flex items-center justify-center mx-auto mb-6">
              <Wallet className="w-10 h-10 text-[#0098EA]" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Connect Your Wallet</h2>
            <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-sm mx-auto">
              Link your Stellar wallet to send and receive payments directly on the blockchain.
            </p>
            <Button size="lg" className="gap-2" onClick={() => { setIsConnected(true); }}>
              <Wallet className="w-4 h-4" />
              Connect Stellar Wallet
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Wallet</h1>
        <Button variant="outline" size="sm" className="gap-2" onClick={refreshBalance} disabled={isRefreshing}>
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Wallet Card */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="bg-gradient-to-br from-[#1E3A8A] via-[#0098EA] to-[#10B981] text-white border-0 overflow-hidden">
          <CardContent className="p-6 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm opacity-80">Stellar Wallet</div>
                  <div className="text-xs font-mono opacity-60">Testnet</div>
                </div>
              </div>
              <Badge className="bg-white/20 text-white border-white/20 gap-1">
                <ShieldCheck className="w-3 h-3" />
                Connected
              </Badge>
            </div>

            <div className="mb-4">
              <div className="text-sm opacity-70 mb-1">Balance</div>
              <div className="text-4xl sm:text-5xl font-bold">
                {isRefreshing ? (
                  <Skeleton className="h-12 w-48 bg-white/20" />
                ) : (
                  '1,250.75 XLM'
                )}
              </div>
              <div className="text-sm opacity-60 mt-1">≈ $3,126.88 USD</div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mt-6">
              <div className="flex-1 p-3 rounded-xl bg-white/10 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                  <ArrowDownRight className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-medium">Received</div>
                  <div className="text-lg font-bold">890.25 XLM</div>
                </div>
              </div>
              <div className="flex-1 p-3 rounded-xl bg-white/10 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                  <ArrowUpRight className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-medium">Sent</div>
                  <div className="text-lg font-bold">295.00 XLM</div>
                </div>
              </div>
            </div>

            {/* Address */}
            <div className="mt-6 p-3 rounded-xl bg-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                <span className="font-mono text-sm truncate">GAD2kR...Bx9Yp8mQwL_fVn3</span>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 h-8 w-8">
                  <Copy className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 h-8 w-8">
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {TRANSACTIONS.map((tx, i) => (
              <div
                key={i}
                className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    tx.type === 'in'
                      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600'
                      : 'bg-red-100 dark:bg-red-900/30 text-red-600'
                  }`}
                >
                  {tx.type === 'in' ? (
                    <ArrowDownRight className="w-5 h-5" />
                  ) : (
                    <ArrowUpRight className="w-5 h-5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-900 dark:text-white">
                    {tx.type === 'in' ? 'Received' : 'Sent'} {tx.amount}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    {tx.type === 'in' ? `From: ${tx.from ?? ''}` : `To: ${tx.to ?? ''}`}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {new Date(tx.date).toLocaleDateString()}
                  </div>
                  <a
                    href={`https://stellar.expert/explorer/public/tx/${tx.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#0098EA] hover:underline flex items-center gap-1 justify-end"
                  >
                    <Zap className="w-3 h-3" />
                    View
                  </a>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
