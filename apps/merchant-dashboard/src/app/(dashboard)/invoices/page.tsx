'use client';

import { useState } from 'react';
import { Card, CardContent, Button, Badge } from '@epay/ui';
import { FileText, Plus, Download, Eye, Clock, CheckCircle2, AlertCircle, Send } from 'lucide-react';
import { StatCard } from '@/components/stat-card';

const INVOICES = [
  { id: 'INV-LZ8XK2M', amount: '500.00 TON', customer: 'Acme Corp', status: 'PAID', dueDate: '2026-08-15', paidAt: '2026-08-05', items: 3 },
  { id: 'INV-M9YNP3Q', amount: '150.00 TON', customer: 'Globex Inc', status: 'SENT', dueDate: '2026-09-01', paidAt: null, items: 1 },
  { id: 'INV-K4ZQ8R7', amount: '75.50 TON', customer: 'Initech LLC', status: 'OVERDUE', dueDate: '2026-07-20', paidAt: null, items: 2 },
  { id: 'INV-J3XB4S5', amount: '1,200.00 TON', customer: 'Umbrella Co', status: 'PAID', dueDate: '2026-08-30', paidAt: '2026-08-01', items: 5 },
  { id: 'INV-H2VM1T6', amount: '320.00 TON', customer: 'Wayne Ent.', status: 'DRAFT', dueDate: '2026-09-15', paidAt: null, items: 4 },
  { id: 'INV-G1KL7U8', amount: '45.00 TON', customer: 'Stark Ind.', status: 'ISSUED', dueDate: '2026-08-20', paidAt: null, items: 1 },
];

const statusConfig: Record<string, { badge: 'success' | 'warning' | 'destructive' | 'slate'; icon: React.ElementType }> = {
  PAID: { badge: 'success', icon: CheckCircle2 },
  SENT: { badge: 'slate', icon: Send },
  OVERDUE: { badge: 'destructive', icon: AlertCircle },
  DRAFT: { badge: 'warning', icon: Clock },
  ISSUED: { badge: 'slate', icon: FileText },
};

export default function InvoicesPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Invoices</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Create and manage customer invoices.</p>
        </div>
        <Button className="gap-2"><Plus className="w-4 h-4" />Create Invoice</Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: '24', sub: '6 drafts pending' },
          { label: 'Total Value', value: '3,450 TON', sub: '$8,970 USD' },
          { label: 'Paid', value: '18', sub: '75% paid rate' },
          { label: 'Overdue', value: '2', sub: '8.3% overdue' },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 text-center">
              <div className="text-xl font-bold text-slate-900 dark:text-white">{s.value}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{s.label}</div>
              <div className="text-xs text-slate-400 mt-1">{s.sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                  <th className="text-left py-4 px-4 font-medium text-slate-500 dark:text-slate-400">Invoice #</th>
                  <th className="text-left py-4 px-4 font-medium text-slate-500 dark:text-slate-400">Customer</th>
                  <th className="text-left py-4 px-4 font-medium text-slate-500 dark:text-slate-400">Amount</th>
                  <th className="text-left py-4 px-4 font-medium text-slate-500 dark:text-slate-400">Items</th>
                  <th className="text-left py-4 px-4 font-medium text-slate-500 dark:text-slate-400">Status</th>
                  <th className="text-left py-4 px-4 font-medium text-slate-500 dark:text-slate-400">Due Date</th>
                  <th className="text-right py-4 px-4 font-medium text-slate-500 dark:text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {INVOICES.map((inv) => {
                  const config = statusConfig[inv.status];
                  const Icon = config.icon;
                  return (
                    <tr key={inv.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-4 px-4"><div className="flex items-center gap-2"><FileText className="w-4 h-4 text-slate-400" /><span className="font-mono text-xs font-medium text-[#0098EA]">{inv.id}</span></div></td>
                      <td className="py-4 px-4 font-medium text-slate-900 dark:text-white">{inv.customer}</td>
                      <td className="py-4 px-4 font-semibold text-slate-900 dark:text-white">{inv.amount}</td>
                      <td className="py-4 px-4 text-slate-500">{inv.items} items</td>
                      <td className="py-4 px-4"><Badge variant={config.badge} className="gap-1"><Icon className="w-3 h-3" />{inv.status}</Badge></td>
                      <td className="py-4 px-4 text-slate-500 text-xs">{new Date(inv.dueDate).toLocaleDateString()}</td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" className="gap-1"><Eye className="w-3 h-3" />View</Button>
                          <Button variant="ghost" size="sm" className="gap-1"><Download className="w-3 h-3" />PDF</Button>
                        </div>
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
