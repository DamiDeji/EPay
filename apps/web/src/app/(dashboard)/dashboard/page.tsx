'use client';

import { Card, CardHeader, CardTitle, CardContent, Badge } from '@epay/ui';
import { motion } from 'framer-motion';
import {
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  CreditCard,
  Users,
  TrendingUp,
  Clock,
} from 'lucide-react';

const STATS = [
  {
    label: 'Total Volume',
    value: '1,234.56 TON',
    change: '+12.3%',
    trend: 'up' as const,
    icon: DollarSign,
    gradient: 'from-blue-500/10 to-blue-600/5',
    iconBg: 'bg-blue-100 dark:bg-blue-900/30',
    iconColor: 'text-blue-600 dark:text-blue-400',
  },
  {
    label: 'Transactions',
    value: '156',
    change: '+8.1%',
    trend: 'up' as const,
    icon: CreditCard,
    gradient: 'from-emerald-500/10 to-emerald-600/5',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    label: 'Success Rate',
    value: '98.5%',
    change: '-0.3%',
    trend: 'down' as const,
    icon: TrendingUp,
    gradient: 'from-purple-500/10 to-purple-600/5',
    iconBg: 'bg-purple-100 dark:bg-purple-900/30',
    iconColor: 'text-purple-600 dark:text-purple-400',
  },
  {
    label: 'Active Customers',
    value: '42',
    change: '+18.2%',
    trend: 'up' as const,
    icon: Users,
    gradient: 'from-amber-500/10 to-amber-600/5',
    iconBg: 'bg-amber-100 dark:bg-amber-900/30',
    iconColor: 'text-amber-600 dark:text-amber-400',
  },
];

const RECENT_PAYMENTS = [
  { id: 'pay_001', amount: '12.5 TON', customer: '0x1234...abcd', status: 'COMPLETED', date: '2 min ago' },
  { id: 'pay_002', amount: '45.0 TON', customer: '0x5678...efgh', status: 'COMPLETED', date: '15 min ago' },
  { id: 'pay_003', amount: '8.2 TON', customer: '0x9012...ijkl', status: 'PENDING', date: '1 hour ago' },
  { id: 'pay_004', amount: '100.0 TON', customer: '0x3456...mnop', status: 'FAILED', date: '2 hours ago' },
  { id: 'pay_005', amount: '3.7 TON', customer: '0x7890...qrst', status: 'COMPLETED', date: '3 hours ago' },
];

const statusColors: Record<string, 'success' | 'warning' | 'destructive' | 'slate'> = {
  COMPLETED: 'success',
  PENDING: 'warning',
  FAILED: 'destructive',
  PROCESSING: 'slate',
};

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Welcome back! Here&apos;s your payment overview.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.1 }}
          >
            <Card className="overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-2 rounded-lg ${stat.iconBg}`}>
                    <stat.icon className={`w-5 h-5 ${stat.iconColor}`} />
                  </div>
                  <div
                    className={`flex items-center gap-1 text-xs font-medium ${
                      stat.trend === 'up' ? 'text-emerald-600' : 'text-red-600'
                    }`}
                  >
                    {stat.trend === 'up' ? (
                      <ArrowUpRight className="w-3 h-3" />
                    ) : (
                      <ArrowDownRight className="w-3 h-3" />
                    )}
                    {stat.change}
                  </div>
                </div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{stat.value}</div>
                <div className="text-sm text-slate-500 dark:text-slate-400">{stat.label}</div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Chart Area (Mock) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Volume Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-end gap-2 px-4">
              {[35, 45, 30, 60, 75, 50, 65, 80, 55, 70, 90, 85].map((h, i) => (
                <motion.div
                  key={i}
                  className="flex-1 bg-gradient-to-t from-[#0098EA]/20 to-[#0098EA]/60 rounded-t-lg"
                  initial={{ height: 0 }}
                  animate={{ height: `${String(h)}%` }}
                  transition={{ duration: 0.8, delay: i * 0.05 }}
                />
              ))}
            </div>
            <div className="flex justify-between mt-2 px-4 text-xs text-slate-400">
              {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m) => (
                <span key={m}>{m}</span>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: 'Completed', value: 142, color: 'bg-emerald-500' },
              { label: 'Pending', value: 8, color: 'bg-amber-500' },
              { label: 'Failed', value: 4, color: 'bg-red-500' },
              { label: 'Refunded', value: 2, color: 'bg-slate-500' },
            ].map((item) => (
              <div key={item.label} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">{item.label}</span>
                  <span className="font-medium text-slate-900 dark:text-white">{item.value}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${item.color} transition-all duration-500`}
                    style={{ width: `${String((item.value / 156) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Recent Payments */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Payments</CardTitle>
          <Badge variant="slate" className="cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-600">
            View All
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-3 px-2 font-medium text-slate-500 dark:text-slate-400">Payment ID</th>
                  <th className="text-left py-3 px-2 font-medium text-slate-500 dark:text-slate-400">Amount</th>
                  <th className="text-left py-3 px-2 font-medium text-slate-500 dark:text-slate-400">Customer</th>
                  <th className="text-left py-3 px-2 font-medium text-slate-500 dark:text-slate-400">Status</th>
                  <th className="text-right py-3 px-2 font-medium text-slate-500 dark:text-slate-400">Date</th>
                </tr>
              </thead>
              <tbody>
                {RECENT_PAYMENTS.map((payment) => (
                  <tr
                    key={payment.id}
                    className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="py-3 px-2">
                      <span className="font-mono text-xs text-[#0098EA]">{payment.id}</span>
                    </td>
                    <td className="py-3 px-2 font-medium text-slate-900 dark:text-white">{payment.amount}</td>
                    <td className="py-3 px-2 font-mono text-xs text-slate-500">{payment.customer}</td>
                    <td className="py-3 px-2">
                      <Badge variant={statusColors[payment.status]}>{payment.status}</Badge>
                    </td>
                    <td className="py-3 px-2 text-right text-slate-500 flex items-center justify-end gap-1">
                      <Clock className="w-3 h-3" />
                      {payment.date}
                    </td>
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
