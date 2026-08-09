'use client';

import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '@epay/ui';
import { Receipt, ExternalLink, CheckCircle2, Clock, XCircle } from 'lucide-react';

const SETTLEMENTS = [
  { id: 'set_a1B2c', amount: '890.25 XLM', fee: '4.45 XLM', net: '885.80 XLM', status: 'COMPLETED', payments: 45, period: 'Jul 28 - Aug 4', txHash: '0xSET...001', date: '2026-08-04' },
  { id: 'set_d3E4f', amount: '720.50 XLM', fee: '3.60 XLM', net: '716.90 XLM', status: 'COMPLETED', payments: 38, period: 'Jul 21 - Jul 28', txHash: '0xSET...002', date: '2026-07-28' },
  { id: 'set_g5H6i', amount: '945.80 XLM', fee: '4.73 XLM', net: '941.07 XLM', status: 'COMPLETED', payments: 52, period: 'Jul 14 - Jul 21', txHash: '0xSET...003', date: '2026-07-21' },
  { id: 'set_j7K8l', amount: '320.00 XLM', fee: '1.60 XLM', net: '318.40 XLM', status: 'PROCESSING', payments: 18, period: 'Aug 4 - Aug 11', txHash: null, date: '2026-08-05' },
  { id: 'set_m9N0p', amount: '145.25 XLM', fee: '0.73 XLM', net: '144.52 XLM', status: 'FAILED', payments: 8, period: 'Aug 4 - Aug 11', txHash: null, date: '2026-08-05' },
];

const statusConfig: Record<string, { badge: 'success' | 'warning' | 'destructive' | 'slate'; icon: React.ElementType }> = {
  COMPLETED: { badge: 'success', icon: CheckCircle2 },
  PROCESSING: { badge: 'warning', icon: Clock },
  FAILED: { badge: 'destructive', icon: XCircle },
  PENDING: { badge: 'slate', icon: Clock },
};

export default function SettlementsPage() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Settlements</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Periodic settlement of accumulated payments to your wallet.</p>
        </div>
        <Button className="gap-2"><Receipt className="w-4 h-4" />Request Settlement</Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Pending Balance', value: '320.00 XLM', sub: 'Next settlement: Aug 11' },
          { label: 'Total Settled', value: '2,556.55 XLM', sub: 'Lifetime settlements' },
          { label: 'Total Fees', value: '12.78 XLM', sub: '0.5% effective rate' },
        ].map((s) => (
          <Card key={s.label}><CardContent className="p-5 text-center"><div className="text-2xl font-bold text-slate-900 dark:text-white">{s.value}</div><div className="text-sm text-slate-500 mt-1">{s.label}</div><div className="text-xs text-slate-400 mt-1">{s.sub}</div></CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Settlement History</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                  <th className="text-left py-4 px-4 font-medium text-slate-500">Settlement ID</th>
                  <th className="text-left py-4 px-4 font-medium text-slate-500">Period</th>
                  <th className="text-left py-4 px-4 font-medium text-slate-500">Gross</th>
                  <th className="text-left py-4 px-4 font-medium text-slate-500">Fee</th>
                  <th className="text-left py-4 px-4 font-medium text-slate-500">Net</th>
                  <th className="text-left py-4 px-4 font-medium text-slate-500">Payments</th>
                  <th className="text-left py-4 px-4 font-medium text-slate-500">Status</th>
                  <th className="text-right py-4 px-4 font-medium text-slate-500">TX</th>
                </tr>
              </thead>
              <tbody>
                {SETTLEMENTS.map((s) => {
                  const config = statusConfig[s.status];
                  const Icon = config.icon;
                  return (
                    <tr key={s.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-4 px-4"><span className="font-mono text-xs text-[#0098EA]">{s.id}</span></td>
                      <td className="py-4 px-4 text-xs text-slate-500">{s.period}</td>
                      <td className="py-4 px-4 font-medium text-slate-900 dark:text-white">{s.amount}</td>
                      <td className="py-4 px-4 text-slate-500">{s.fee}</td>
                      <td className="py-4 px-4 font-semibold text-emerald-600 dark:text-emerald-400">{s.net}</td>
                      <td className="py-4 px-4 text-slate-500">{s.payments}</td>
                      <td className="py-4 px-4"><Badge variant={config.badge} className="gap-1"><Icon className="w-3 h-3" />{s.status}</Badge></td>
                      <td className="py-4 px-4 text-right">
                        {s.txHash ? <a href={`https://stellar.expert/explorer/public/tx/${s.txHash}`} target="_blank" className="text-[#0098EA] hover:underline text-xs flex items-center gap-1 justify-end"><ExternalLink className="w-3 h-3" />View</a> : <span className="text-xs text-slate-400">-</span>}
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
