'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Search, Filter, Building2, ShieldCheck, ShieldX,
  MoreHorizontal, Download, Clock, CheckCircle2,
  XCircle, AlertCircle, Ban,
} from 'lucide-react';

const allMerchants = [
  { id: 'merch_001', name: 'Acme Corp', email: 'payments@acme.dev', status: 'active', verification: 'verified', volume: '$1.2M', payments: 3400, joined: '2024-03-15' },
  { id: 'merch_002', name: 'CryptoShop', email: 'hello@cryptoshop.io', status: 'active', verification: 'verified', volume: '$890K', payments: 2100, joined: '2024-05-02' },
  { id: 'merch_003', name: 'DeFi Hub', email: 'admin@defihub.com', status: 'pending', verification: 'basic', volume: '$0', payments: 0, joined: '2026-07-28' },
  { id: 'merch_004', name: 'NFT Market', email: 'ops@nftmarket.art', status: 'active', verification: 'verified', volume: '$3.4M', payments: 8900, joined: '2024-01-10' },
  { id: 'merch_005', name: 'TokenPay', email: 'support@tokenpay.dev', status: 'suspended', verification: 'verified', volume: '$450K', payments: 1200, joined: '2024-08-22' },
  { id: 'merch_006', name: 'NewStore Inc', email: 'biz@newstore.com', status: 'pending', verification: 'none', volume: '$0', payments: 0, joined: '2026-08-01' },
  { id: 'merch_007', name: 'QuickPay', email: 'info@quickpay.net', status: 'pending', verification: 'basic', volume: '$5K', payments: 12, joined: '2026-07-15' },
];

const statusStyles: Record<string, string> = {
  active: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  pending: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  suspended: 'bg-red-500/10 text-red-500 border-red-500/20',
};

const verificationStyles: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  verified: { icon: CheckCircle2, color: 'text-emerald-500', label: 'Verified' },
  basic: { icon: ShieldCheck, color: 'text-blue-500', label: 'Basic' },
  none: { icon: AlertCircle, color: 'text-slate-400', label: 'None' },
};

export default function MerchantsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState<string[]>([]);

  const filtered = allMerchants.filter((m) => {
    const matchSearch = m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || m.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Merchants</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage merchant accounts, verifications, and statuses</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-all">
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search merchants..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
          />
        </div>
        <div className="flex gap-2">
          {['all', 'active', 'pending', 'suspended'].map((s) => (
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
                <th className="text-left font-medium px-5 py-3 w-10">
                  <input type="checkbox" className="rounded border-slate-300 dark:border-slate-600" />
                </th>
                <th className="text-left font-medium px-5 py-3">Merchant</th>
                <th className="text-left font-medium px-5 py-3">Status</th>
                <th className="text-left font-medium px-5 py-3">Verification</th>
                <th className="text-left font-medium px-5 py-3">Volume</th>
                <th className="text-left font-medium px-5 py-3">Payments</th>
                <th className="text-left font-medium px-5 py-3">Joined</th>
                <th className="text-right font-medium px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => {
                const verif = verificationStyles[m.verification];
                const VerifIcon = verif.icon;
                return (
                  <tr key={m.id} className="border-b border-slate-50 dark:border-white/[0.02] hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3">
                      <input type="checkbox" className="rounded border-slate-300 dark:border-slate-600" />
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500/20 to-accent-500/20 flex items-center justify-center">
                          <Building2 className="w-4 h-4 text-accent-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900 dark:text-white">{m.name}</p>
                          <p className="text-xs text-slate-500">{m.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusStyles[m.status]}`}>
                        {m.status}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium ${verif.color}`}>
                        <VerifIcon className="w-3 h-3" /> {verif.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-700 dark:text-slate-300">{m.volume}</td>
                    <td className="px-5 py-3 text-sm text-slate-700 dark:text-slate-300">{m.payments.toLocaleString()}</td>
                    <td className="px-5 py-3 text-xs text-slate-400">{m.joined}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {m.status === 'pending' && (
                          <button className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-500/10 transition-all" title="Approve">
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        )}
                        {m.status === 'active' && (
                          <button className="p-1.5 rounded-lg text-amber-500 hover:bg-amber-500/10 transition-all" title="Suspend">
                            <Ban className="w-4 h-4" />
                          </button>
                        )}
                        <button className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-all" title="More">
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 dark:border-white/5 text-sm text-slate-500">
          <span>{filtered.length} merchants</span>
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
