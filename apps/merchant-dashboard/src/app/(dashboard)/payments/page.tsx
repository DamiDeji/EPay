'use client';

import { Card, CardContent, Button, Input, Badge } from '@epay/ui';
import { Search, Filter, Download, ExternalLink, Clock, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import { useState } from 'react';

const PAYMENTS = [
  { id: 'pay_7xK2m', amount: '125.50 TON', currency: 'TON', status: 'COMPLETED', payer: 'EQD...x9m2', date: '2026-08-05 14:22', txHash: '0xabc...123', fee: '0.63 TON' },
  { id: 'pay_9yN3p', amount: '45.00 TON', currency: 'TON', status: 'PENDING', payer: 'EQD...k4h7', date: '2026-08-05 13:15', txHash: null, fee: '0.23 TON' },
  { id: 'pay_3zQ8r', amount: '10.25 TON', currency: 'TON', status: 'COMPLETED', payer: 'EQD...v2f1', date: '2026-08-05 11:40', txHash: '0xdef...456', fee: '0.05 TON' },
  { id: 'pay_5wB4s', amount: '89.99 TON', currency: 'TON', status: 'FAILED', payer: 'EQD...n6c3', date: '2026-08-05 09:10', txHash: null, fee: '-' },
  { id: 'pay_2vM1t', amount: '250.00 TON', currency: 'TON', status: 'PROCESSING', payer: 'EQD...p8d9', date: '2026-08-04 22:05', txHash: '0xghi...789', fee: '1.25 TON' },
  { id: 'pay_8kL6u', amount: '7.50 TON', currency: 'TON', status: 'COMPLETED', payer: 'EQD...r5j2', date: '2026-08-04 18:30', txHash: '0xjkl...012', fee: '0.04 TON' },
  { id: 'pay_4nH9v', amount: '500.00 TON', currency: 'TON', status: 'COMPLETED', payer: 'EQD...t8w4', date: '2026-08-04 15:45', txHash: '0xmno...345', fee: '2.50 TON' },
  { id: 'pay_6jR0w', amount: '1.25 TON', currency: 'TON', status: 'REFUNDED', payer: 'EQD...u3x6', date: '2026-08-04 12:00', txHash: '0xpqr...678', fee: '-' },
];

const statusConfig: Record<string, { badge: 'success' | 'warning' | 'destructive' | 'slate'; icon: React.ElementType }> = {
  COMPLETED: { badge: 'success', icon: CheckCircle2 },
  PENDING: { badge: 'warning', icon: Clock },
  FAILED: { badge: 'destructive', icon: XCircle },
  PROCESSING: { badge: 'slate', icon: Clock },
  REFUNDED: { badge: 'destructive', icon: AlertCircle },
};

export default function PaymentsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const filtered = PAYMENTS.filter((p) => {
    const matchesSearch = p.id.toLowerCase().includes(search.toLowerCase()) || p.payer.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Payments</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Track and manage all incoming payments.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2"><Filter className="w-4 h-4" />Filter</Button>
          <Button variant="outline" size="sm" className="gap-2"><Download className="w-4 h-4" />Export</Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Search by ID or payer address..." value={search} onChange={(e) => { setSearch(e.target.value); }} className="pl-10" />
        </div>
        <div className="flex gap-1">
          {['ALL', 'COMPLETED', 'PENDING', 'FAILED', 'PROCESSING', 'REFUNDED'].map((s) => (
            <Badge
              key={s}
              variant={statusFilter === s ? 'primary' : 'slate'}
              className="cursor-pointer"
              onClick={() => { setStatusFilter(s); }}
            >
              {s}
            </Badge>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                  <th className="text-left py-4 px-4 font-medium text-slate-500 dark:text-slate-400">Payment ID</th>
                  <th className="text-left py-4 px-4 font-medium text-slate-500 dark:text-slate-400">Amount</th>
                  <th className="text-left py-4 px-4 font-medium text-slate-500 dark:text-slate-400">Fee</th>
                  <th className="text-left py-4 px-4 font-medium text-slate-500 dark:text-slate-400">Payer</th>
                  <th className="text-left py-4 px-4 font-medium text-slate-500 dark:text-slate-400">Status</th>
                  <th className="text-left py-4 px-4 font-medium text-slate-500 dark:text-slate-400">Date</th>
                  <th className="text-right py-4 px-4 font-medium text-slate-500 dark:text-slate-400">TX</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const config = statusConfig[p.status];
                  const Icon = config.icon;
                  return (
                    <tr key={p.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-4 px-4"><span className="font-mono text-xs font-medium text-[#0098EA]">{p.id}</span></td>
                      <td className="py-4 px-4"><span className="font-semibold text-slate-900 dark:text-white">{p.amount}</span></td>
                      <td className="py-4 px-4 text-slate-500 dark:text-slate-400">{p.fee}</td>
                      <td className="py-4 px-4"><span className="font-mono text-xs text-slate-500 dark:text-slate-400">{p.payer}</span></td>
                      <td className="py-4 px-4"><Badge variant={config.badge} className="gap-1"><Icon className="w-3 h-3" />{p.status}</Badge></td>
                      <td className="py-4 px-4 text-slate-500 dark:text-slate-400 text-xs">{p.date}</td>
                      <td className="py-4 px-4 text-right">
                        {p.txHash ? (
                          <a href={`https://tonscan.org/tx/${p.txHash}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#0098EA] hover:underline text-xs">
                            <ExternalLink className="w-3 h-3" />View
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
