'use client';

import { motion } from 'framer-motion';
import {
  Search, Download, ExternalLink, Clock, CheckCircle2, XCircle, RotateCcw,
} from 'lucide-react';
import { useState } from 'react';

const payments = [
  { id: 'pay_a1b2', merchant: 'Acme Corp', amount: '1,500 TON', currency: 'TON', fiatValue: '$3,750', status: 'completed', payer: 'EQD...1a2b', txHash: '0xabc...def1', time: '2 min ago' },
  { id: 'pay_c3d4', merchant: 'CryptoShop', amount: '250 USDT', currency: 'USDT', fiatValue: '$250', status: 'pending', payer: 'UQD...3c4d', txHash: '-', time: '5 min ago' },
  { id: 'pay_e5f6', merchant: 'DeFi Hub', amount: '5,000 TON', currency: 'TON', fiatValue: '$12,500', status: 'completed', payer: 'EQD...5e6f', txHash: '0xdef...7890', time: '8 min ago' },
  { id: 'pay_g7h8', merchant: 'NFT Market', amount: '800 TON', currency: 'TON', fiatValue: '$2,000', status: 'failed', payer: 'EQD...7g8h', txHash: '-', time: '12 min ago' },
  { id: 'pay_i9j0', merchant: 'TokenPay', amount: '3,200 USDC', currency: 'USDC', fiatValue: '$3,200', status: 'completed', payer: 'UQD...9i0j', txHash: '0xghi...jkl1', time: '15 min ago' },
  { id: 'pay_k1l2', merchant: 'QuickPay', amount: '100 TON', currency: 'TON', fiatValue: '$250', status: 'refunded', payer: 'EQD...k1l2', txHash: '0xmno...pqr2', time: '32 min ago' },
];

const statusStyles: Record<string, { color: string; icon: React.ElementType }> = {
  completed: { color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle2 },
  pending: { color: 'text-amber-500 bg-amber-500/10 border-amber-500/20', icon: Clock },
  failed: { color: 'text-red-500 bg-red-500/10 border-red-500/20', icon: XCircle },
  refunded: { color: 'text-violet-500 bg-violet-500/10 border-violet-500/20', icon: RotateCcw },
};

export default function PaymentsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = payments.filter((p) => {
    const matchSearch = p.id.includes(search.toLowerCase()) ||
      p.merchant.toLowerCase().includes(search.toLowerCase()) ||
      p.payer.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Payments</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Monitor all payments across the EPay platform</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-all">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by ID, merchant, or payer..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['all', 'completed', 'pending', 'failed', 'refunded'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                statusFilter === s
                  ? 'bg-accent-500 text-white shadow-md'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-2xl overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-slate-950/50">
                <th className="text-left font-medium px-5 py-3">Payment ID</th>
                <th className="text-left font-medium px-5 py-3">Merchant</th>
                <th className="text-left font-medium px-5 py-3">Amount</th>
                <th className="text-left font-medium px-5 py-3">Fiat Value</th>
                <th className="text-left font-medium px-5 py-3">Status</th>
                <th className="text-left font-medium px-5 py-3">Payer</th>
                <th className="text-left font-medium px-5 py-3">TX Hash</th>
                <th className="text-left font-medium px-5 py-3">Time</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const status = statusStyles[p.status];
                const StatusIcon = status.icon;
                return (
                  <tr key={p.id} className="border-b border-slate-50 dark:border-white/[0.02] hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3 text-sm font-mono text-accent-500">{p.id}</td>
                    <td className="px-5 py-3 text-sm font-medium text-slate-900 dark:text-white">{p.merchant}</td>
                    <td className="px-5 py-3 text-sm text-slate-700 dark:text-slate-300 font-mono">{p.amount}</td>
                    <td className="px-5 py-3 text-sm text-slate-600 dark:text-slate-400">{p.fiatValue}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${status.color}`}>
                        <StatusIcon className="w-3 h-3" /> {p.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs font-mono text-slate-500">{p.payer}</td>
                    <td className="px-5 py-3 text-xs font-mono text-slate-500">
                      {p.txHash !== '-' ? (
                        <a href="#" className="inline-flex items-center gap-1 text-accent-500 hover:underline">
                          {p.txHash} <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-400">{p.time}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 dark:border-white/5 text-sm text-slate-500">
          <span>{filtered.length} payments</span>
          <div className="flex gap-2">
            <button className="px-3 py-1 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 transition-all" disabled>Previous</button>
            <button className="px-3 py-1 rounded-lg bg-accent-500 text-white">1</button>
            <button className="px-3 py-1 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 transition-all">Next</button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
