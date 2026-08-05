'use client';

import { Card, CardHeader, CardTitle, CardContent, Button, Badge, Input } from '@epay/ui';
import { Search } from 'lucide-react';
import { CheckCircle2, Clock, XCircle, AlertCircle } from 'lucide-react';

const REFUNDS = [
  { id: 'ref_a1B2c', paymentId: 'pay_8kL6u', amount: '250.00 TON', original: '250.00 TON', reason: 'Customer requested', status: 'COMPLETED', partial: false, date: '2026-08-04', txHash: '0xREF...001' },
  { id: 'ref_d3E4f', paymentId: 'pay_4nH9v', amount: '50.00 TON', original: '500.00 TON', reason: 'Partial refund - wrong item', status: 'COMPLETED', partial: true, date: '2026-08-03', txHash: '0xREF...002' },
  { id: 'ref_g5H6i', paymentId: 'pay_9yN3p', amount: '45.00 TON', original: '45.00 TON', reason: 'Service not delivered', status: 'REQUESTED', partial: false, date: '2026-08-05', txHash: null },
  { id: 'ref_j7K8l', paymentId: 'pay_3zQ8r', amount: '10.25 TON', original: '10.25 TON', reason: 'Duplicate charge', status: 'REJECTED', partial: false, date: '2026-08-02', txHash: null },
];

const statusConfig: Record<string, { badge: 'success' | 'warning' | 'destructive' | 'slate'; icon: React.ElementType }> = {
  COMPLETED: { badge: 'success', icon: CheckCircle2 },
  REQUESTED: { badge: 'warning', icon: Clock },
  APPROVED: { badge: 'slate', icon: CheckCircle2 },
  PROCESSING: { badge: 'slate', icon: Clock },
  REJECTED: { badge: 'destructive', icon: XCircle },
  FAILED: { badge: 'destructive', icon: AlertCircle },
};

export default function RefundsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Refunds</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Manage refund requests and track refund history.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Refund History</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                  <th className="text-left py-4 px-4 font-medium text-slate-500">Refund ID</th>
                  <th className="text-left py-4 px-4 font-medium text-slate-500">Payment</th>
                  <th className="text-left py-4 px-4 font-medium text-slate-500">Amount</th>
                  <th className="text-left py-4 px-4 font-medium text-slate-500">Type</th>
                  <th className="text-left py-4 px-4 font-medium text-slate-500">Reason</th>
                  <th className="text-left py-4 px-4 font-medium text-slate-500">Status</th>
                  <th className="text-left py-4 px-4 font-medium text-slate-500">Date</th>
                </tr>
              </thead>
              <tbody>
                {REFUNDS.map((r) => {
                  const config = statusConfig[r.status];
                  const Icon = config.icon;
                  return (
                    <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-4 px-4"><span className="font-mono text-xs text-[#0098EA]">{r.id}</span></td>
                      <td className="py-4 px-4 font-mono text-xs text-slate-500">{r.paymentId}</td>
                      <td className="py-4 px-4 font-medium text-slate-900 dark:text-white">{r.amount}</td>
                      <td className="py-4 px-4"><Badge variant="slate">{r.partial ? 'PARTIAL' : 'FULL'}</Badge></td>
                      <td className="py-4 px-4 text-slate-500 max-w-[200px] truncate">{r.reason}</td>
                      <td className="py-4 px-4"><Badge variant={config.badge} className="gap-1"><Icon className="w-3 h-3" />{r.status}</Badge></td>
                      <td className="py-4 px-4 text-xs text-slate-500">{r.date}</td>
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
