'use client';

import { Card, CardContent, Button, Input, Badge } from '@epay/ui';
import {
  Search,
  Filter,
  Download,
  ArrowUpDown,
  ExternalLink,
  Clock,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useState } from 'react';

const PAYMENTS = [
  { id: 'pay_7xK2m', amount: '125.50 XLM', currency: 'XLM', status: 'COMPLETED', payer: 'GAD...x9m2', date: '2026-08-05 14:22', txHash: '0xabc...123' },
  { id: 'pay_9yN3p', amount: '45.00 XLM', currency: 'XLM', status: 'PENDING', payer: 'GBD...k4h7', date: '2026-08-05 13:15', txHash: null },
  { id: 'pay_3zQ8r', amount: '10.25 XLM', currency: 'XLM', status: 'COMPLETED', payer: 'GCD...v2f1', date: '2026-08-05 11:40', txHash: '0xdef...456' },
  { id: 'pay_5wB4s', amount: '89.99 XLM', currency: 'XLM', status: 'FAILED', payer: 'GDD...n6c3', date: '2026-08-05 09:10', txHash: null },
  { id: 'pay_2vM1t', amount: '250.00 XLM', currency: 'XLM', status: 'PROCESSING', payer: 'GED...p8d9', date: '2026-08-04 22:05', txHash: '0xghi...789' },
  { id: 'pay_8kL6u', amount: '7.50 XLM', currency: 'XLM', status: 'COMPLETED', payer: 'GFD...r5j2', date: '2026-08-04 18:30', txHash: '0xjkl...012' },
  { id: 'pay_4nH9v', amount: '500.00 XLM', currency: 'XLM', status: 'COMPLETED', payer: 'GGD...t8w4', date: '2026-08-04 15:45', txHash: '0xmno...345' },
  { id: 'pay_6jR0w', amount: '1.25 XLM', currency: 'XLM', status: 'REFUNDED', payer: 'GHD...u3x6', date: '2026-08-04 12:00', txHash: '0xpqr...678' },
];

const statusStyles: Record<string, { badge: 'success' | 'warning' | 'destructive' | 'slate'; icon: React.ElementType }> = {
  COMPLETED: { badge: 'success', icon: CheckCircle2 },
  PENDING: { badge: 'warning', icon: Clock },
  FAILED: { badge: 'destructive', icon: AlertCircle },
  PROCESSING: { badge: 'slate', icon: Clock },
  REFUNDED: { badge: 'destructive', icon: AlertCircle },
};

export default function PaymentsPage() {
  const [search, setSearch] = useState('');

  const filtered = PAYMENTS.filter(
    (p) =>
      p.id.toLowerCase().includes(search.toLowerCase()) ||
      p.payer.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Payments</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Track and manage all your payments.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="w-4 h-4" />
            Filter
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="w-4 h-4" />
            Export
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search by payment ID or payer address..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); }}
            className="pl-10"
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                  <th className="text-left py-4 px-4 font-medium text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-1 cursor-pointer hover:text-slate-900 dark:hover:text-white">
                      Payment ID
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="text-left py-4 px-4 font-medium text-slate-500 dark:text-slate-400">Amount</th>
                  <th className="text-left py-4 px-4 font-medium text-slate-500 dark:text-slate-400">Payer</th>
                  <th className="text-left py-4 px-4 font-medium text-slate-500 dark:text-slate-400">Status</th>
                  <th className="text-left py-4 px-4 font-medium text-slate-500 dark:text-slate-400">Date</th>
                  <th className="text-right py-4 px-4 font-medium text-slate-500 dark:text-slate-400">Details</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((payment) => {
                  const statusConfig = statusStyles[payment.status];
                  const StatusIcon = statusConfig.icon;
                  return (
                    <tr
                      key={payment.id}
                      className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="py-4 px-4">
                        <span className="font-mono text-xs font-medium text-[#0098EA]">{payment.id}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="font-semibold text-slate-900 dark:text-white">{payment.amount}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{payment.payer}</span>
                      </td>
                      <td className="py-4 px-4">
                        <Badge variant={statusConfig.badge} className="gap-1">
                          <StatusIcon className="w-3 h-3" />
                          {payment.status}
                        </Badge>
                      </td>
                      <td className="py-4 px-4 text-slate-500 dark:text-slate-400">
                        {new Date(payment.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <Button variant="ghost" size="sm" className="gap-1">
                          <ExternalLink className="w-3 h-3" />
                          View
                        </Button>
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
