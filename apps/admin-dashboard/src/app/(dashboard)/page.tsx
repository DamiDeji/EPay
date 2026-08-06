'use client';

import { motion } from 'framer-motion';
import {
  Building2, Users,
  AlertTriangle, ArrowUpRight, ArrowDownRight,
  DollarSign, Activity, ShieldCheck, Clock,
} from 'lucide-react';

const stats = [
  {
    label: 'Total Merchants', value: '1,284', change: '+12.5%',
    icon: Building2, trend: 'up', color: 'from-blue-500 to-blue-600',
  },
  {
    label: 'Total Payments', value: '$8.2M', change: '+23.1%',
    icon: DollarSign, trend: 'up', color: 'from-emerald-500 to-emerald-600',
  },
  {
    label: 'Active Users', value: '45.2K', change: '+8.3%',
    icon: Users, trend: 'up', color: 'from-violet-500 to-violet-600',
  },
  {
    label: 'Success Rate', value: '98.7%', change: '+1.2%',
    icon: ShieldCheck, trend: 'up', color: 'from-amber-500 to-amber-600',
  },
];

const recentPayments = [
  { id: 'pay_001', merchant: 'Acme Corp', amount: '1,500 TON', status: 'completed', time: '2 min ago' },
  { id: 'pay_002', merchant: 'CryptoShop', amount: '250 USDT', status: 'pending', time: '5 min ago' },
  { id: 'pay_003', merchant: 'DeFi Hub', amount: '5,000 TON', status: 'completed', time: '8 min ago' },
  { id: 'pay_004', merchant: 'NFT Market', amount: '800 TON', status: 'failed', time: '12 min ago' },
  { id: 'pay_005', merchant: 'TokenPay', amount: '3,200 USDC', status: 'completed', time: '15 min ago' },
];

const pendingActions = [
  { type: 'verification', merchant: 'NewStore Inc', time: '1 hour ago' },
  { type: 'dispute', merchant: 'TechGoods Ltd', time: '3 hours ago' },
  { type: 'verification', merchant: 'QuickPay', time: '5 hours ago' },
];

const statusColors: Record<string, string> = {
  completed: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  pending: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  failed: 'bg-red-500/10 text-red-500 border-red-500/20',
};

export default function AdminOverview() {
  return (
    <div className="space-y-6">
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Platform Overview</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Monitor the health and activity of the EPay platform</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-2xl p-5 hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-black/20 transition-all group"
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-md`}>
                <stat.icon className="w-5 h-5 text-white" />
              </div>
              <span className={`flex items-center gap-0.5 text-xs font-medium ${
                stat.trend === 'up' ? 'text-emerald-500' : 'text-red-500'
              }`}>
                {stat.trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {stat.change}
              </span>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{stat.value}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Recent payments */}
        <div className="xl:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-white/5">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-accent-500" />
              <h2 className="font-semibold text-slate-900 dark:text-white">Recent Payments</h2>
            </div>
            <button className="text-xs text-accent-500 hover:text-accent-400 font-medium transition-colors">View all</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-white/5">
                  <th className="text-left font-medium px-5 py-3">ID</th>
                  <th className="text-left font-medium px-5 py-3">Merchant</th>
                  <th className="text-left font-medium px-5 py-3">Amount</th>
                  <th className="text-left font-medium px-5 py-3">Status</th>
                  <th className="text-left font-medium px-5 py-3">Time</th>
                </tr>
              </thead>
              <tbody>
                {recentPayments.map((p) => (
                  <tr key={p.id} className="border-b border-slate-50 dark:border-white/[0.02] hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3 text-sm font-mono text-slate-600 dark:text-slate-400">{p.id}</td>
                    <td className="px-5 py-3 text-sm text-slate-900 dark:text-white font-medium">{p.merchant}</td>
                    <td className="px-5 py-3 text-sm text-slate-700 dark:text-slate-300">{p.amount}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusColors[p.status]}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {p.time}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pending actions */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h2 className="font-semibold text-slate-900 dark:text-white">Pending Actions</h2>
          </div>
          <div className="space-y-3">
            {pendingActions.map((action, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-white/5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  action.type === 'verification'
                    ? 'bg-blue-500/10 text-blue-500'
                    : 'bg-amber-500/10 text-amber-500'
                }`}>
                  {action.type === 'verification' ? <ShieldCheck className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    {action.type === 'verification' ? 'Verify merchant' : 'Resolve dispute'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{action.merchant}</p>
                </div>
                <span className="text-xs text-slate-400 flex-shrink-0">{action.time}</span>
              </div>
            ))}
          </div>

          {/* Quick stats */}
          <div className="mt-5 pt-4 border-t border-slate-200 dark:border-white/5">
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Platform Health</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">API Uptime</span>
                <span className="text-emerald-500 font-medium">99.99%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">Avg Response</span>
                <span className="text-slate-900 dark:text-white font-medium">124ms</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">Webhook Delivery</span>
                <span className="text-emerald-500 font-medium">99.2%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">Indexer Lag</span>
                <span className="text-slate-900 dark:text-white font-medium">3 blocks</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
