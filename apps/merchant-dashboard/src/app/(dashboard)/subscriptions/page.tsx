'use client';

import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '@epay/ui';
import { CalendarClock, Plus, CheckCircle2, Clock, XCircle, Pause, AlertCircle } from 'lucide-react';

const SUBS = [
  { id: 'sub_a1B2c', plan: 'Premium Plan', customer: 'Acme Corp', amount: '100 TON/mo', interval: 'MONTHLY', status: 'ACTIVE', nextBilling: '2026-09-05', payments: 8, maxPayments: 12 },
  { id: 'sub_d3E4f', plan: 'Basic Plan', customer: 'Globex Inc', amount: '25 TON/mo', interval: 'MONTHLY', status: 'ACTIVE', nextBilling: '2026-09-01', payments: 3, maxPayments: null },
  { id: 'sub_g5H6i', plan: 'Enterprise', customer: 'Initech LLC', amount: '500 TON/mo', interval: 'MONTHLY', status: 'PAUSED', nextBilling: null, payments: 12, maxPayments: 24 },
  { id: 'sub_j7K8l', plan: 'Trial User', customer: 'Wayne Ent.', amount: '50 TON/mo', interval: 'WEEKLY', status: 'TRIAL', nextBilling: '2026-08-12', payments: 0, maxPayments: null },
  { id: 'sub_m9N0p', plan: 'Starter', customer: 'Stark Ind.', amount: '10 TON/mo', interval: 'DAILY', status: 'CANCELLED', nextBilling: null, payments: 30, maxPayments: 30 },
];

const statusConfig: Record<string, { badge: 'success' | 'warning' | 'destructive' | 'slate'; icon: React.ElementType }> = {
  ACTIVE: { badge: 'success', icon: CheckCircle2 },
  PAUSED: { badge: 'warning', icon: Pause },
  TRIAL: { badge: 'slate', icon: Clock },
  CANCELLED: { badge: 'destructive', icon: XCircle },
  EXPIRED: { badge: 'destructive', icon: AlertCircle },
  PAYMENT_FAILED: { badge: 'destructive', icon: AlertCircle },
};

export default function SubscriptionsPage() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Subscriptions</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage recurring billing plans and customer subscriptions.</p>
        </div>
        <Button className="gap-2"><Plus className="w-4 h-4" />Create Plan</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {SUBS.map((sub) => {
          const config = statusConfig[sub.status];
          const Icon = config.icon;
          return (
            <Card key={sub.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <Badge variant={config.badge} className="gap-1"><Icon className="w-3 h-3" />{sub.status}</Badge>
                  <span className="font-mono text-xs text-slate-400">{sub.id}</span>
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white text-lg mb-1">{sub.plan}</h3>
                <p className="text-sm text-slate-500 mb-4">{sub.customer}</p>
                <div className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{sub.amount}</div>
                <div className="text-xs text-slate-400 mb-4">{sub.interval} billing</div>
                <div className="flex items-center justify-between text-xs text-slate-500 py-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-1"><CalendarClock className="w-3 h-3" />{sub.nextBilling ? `Next: ${new Date(sub.nextBilling).toLocaleDateString()}` : 'Not scheduled'}</div>
                  <span>{sub.payments}{sub.maxPayments ? `/${sub.maxPayments}` : ''} payments</span>
                </div>
                <div className="flex gap-2 mt-3">
                  {sub.status === 'ACTIVE' && <Button variant="outline" size="sm" className="flex-1">Pause</Button>}
                  {sub.status === 'PAUSED' && <Button variant="outline" size="sm" className="flex-1">Resume</Button>}
                  {sub.status !== 'CANCELLED' && <Button variant="ghost" size="sm" className="flex-1 text-red-600 hover:text-red-700">Cancel</Button>}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
