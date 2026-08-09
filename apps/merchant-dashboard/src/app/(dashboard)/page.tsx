'use client';

import { Card, CardHeader, CardTitle, CardContent, Badge } from '@epay/ui';
import { motion } from 'framer-motion';
import {
  DollarSign, CreditCard, TrendingUp, Users, Clock, ArrowUpRight,
} from 'lucide-react';

import { RevenueChart } from '@/components/charts/revenue-chart';
import { SuccessRateChart } from '@/components/charts/success-rate-chart';
import { StatCard } from '@/components/stat-card';

const RECENT = [
  { id: 'pay_7xK2m', amount: '125.50 XLM', payer: 'GAD...x9m2', status: 'COMPLETED', date: '2 min ago' },
  { id: 'pay_9yN3p', amount: '45.00 XLM', payer: 'GBD...k4h7', status: 'PENDING', date: '15 min ago' },
  { id: 'pay_3zQ8r', amount: '10.25 XLM', payer: 'GCD...v2f1', status: 'COMPLETED', date: '1 hour ago' },
  { id: 'pay_5wB4s', amount: '89.99 XLM', payer: 'GDD...n6c3', status: 'FAILED', date: '2 hours ago' },
  { id: 'pay_8kL6u', amount: '250.00 XLM', payer: 'GED...p8d9', status: 'COMPLETED', date: '3 hours ago' },
];

const statusColors: Record<string, 'success' | 'warning' | 'destructive' | 'slate'> = {
  COMPLETED: 'success', PENDING: 'warning', FAILED: 'destructive', PROCESSING: 'slate',
};

export default function MerchantDashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Welcome back, <span className="font-medium text-slate-900 dark:text-white">Acme Store</span> — here&apos;s your business overview.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Revenue', value: '3,450.25 XLM', change: '+12.3%', trend: 'up' as const, icon: DollarSign, iconBg: 'bg-blue-100 dark:bg-blue-900/30', iconColor: 'text-blue-600 dark:text-blue-400', sub: '≈ $8,625.63 USD' },
          { label: 'Transactions', value: '1,284', change: '+8.1%', trend: 'up' as const, icon: CreditCard, iconBg: 'bg-emerald-100 dark:bg-emerald-900/30', iconColor: 'text-emerald-600 dark:text-emerald-400', sub: '156 this week' },
          { label: 'Success Rate', value: '98.5%', change: '-0.3%', trend: 'down' as const, icon: TrendingUp, iconBg: 'bg-purple-100 dark:bg-purple-900/30', iconColor: 'text-purple-600 dark:text-purple-400', sub: 'Last 30 days' },
          { label: 'Active Customers', value: '247', change: '+18.2%', trend: 'up' as const, icon: Users, iconBg: 'bg-amber-100 dark:bg-amber-900/30', iconColor: 'text-amber-600 dark:text-amber-400', sub: '42 new this month' },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: i * 0.1 }}>
            <StatCard {...stat} icon={stat.icon} />
          </motion.div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Revenue & Volume</CardTitle>
            <Badge variant="slate" className="cursor-pointer">Monthly</Badge>
          </CardHeader>
          <CardContent>
            <RevenueChart />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <SuccessRateChart />
            <div className="grid grid-cols-2 gap-3 mt-4">
              {[
                { label: 'Completed', value: '1,264', color: 'bg-emerald-500' },
                { label: 'Failed', value: '12', color: 'bg-red-500' },
                { label: 'Pending', value: '5', color: 'bg-amber-500' },
                { label: 'Refunded', value: '3', color: 'bg-slate-500' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                  <div className="text-xs text-slate-500 dark:text-slate-400">{item.label}</div>
                  <div className="text-xs font-semibold ml-auto text-slate-900 dark:text-white">{item.value}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Payments */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Payments</CardTitle>
          <a href="/dashboard/payments" className="text-sm text-[#0098EA] hover:underline flex items-center gap-1">
            View All <ArrowUpRight className="w-3 h-3" />
          </a>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-3 px-2 font-medium text-slate-500 dark:text-slate-400">ID</th>
                  <th className="text-left py-3 px-2 font-medium text-slate-500 dark:text-slate-400">Amount</th>
                  <th className="text-left py-3 px-2 font-medium text-slate-500 dark:text-slate-400">Payer</th>
                  <th className="text-left py-3 px-2 font-medium text-slate-500 dark:text-slate-400">Status</th>
                  <th className="text-right py-3 px-2 font-medium text-slate-500 dark:text-slate-400">Date</th>
                </tr>
              </thead>
              <tbody>
                {RECENT.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-3 px-2"><span className="font-mono text-xs text-[#0098EA]">{p.id}</span></td>
                    <td className="py-3 px-2 font-medium text-slate-900 dark:text-white">{p.amount}</td>
                    <td className="py-3 px-2 font-mono text-xs text-slate-500">{p.payer}</td>
                    <td className="py-3 px-2"><Badge variant={statusColors[p.status]} className="text-xs">{p.status}</Badge></td>
                    <td className="py-3 px-2 text-right text-slate-500 flex items-center justify-end gap-1"><Clock className="w-3 h-3" />{p.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
