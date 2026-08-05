'use client';

import { motion } from 'framer-motion';
import {
  BarChart3, TrendingUp, Users, DollarSign,
  Activity, ArrowUpRight, ArrowDownRight,
  Globe, Shield, Zap,
} from 'lucide-react';

const metrics = [
  { label: 'Total Volume (30d)', value: '$24.8M', change: '+18.3%', icon: DollarSign, trend: 'up' },
  { label: 'Active Merchants', value: '892', change: '+5.7%', icon: Users, trend: 'up' },
  { label: 'Avg Tx Size', value: '$1,240', change: '+3.2%', icon: TrendingUp, trend: 'up' },
  { label: 'Platform Fees', value: '$124K', change: '+22.1%', icon: BarChart3, trend: 'up' },
];

const volumeBreakdown = [
  { currency: 'TON', volume: '$14.2M', percentage: 57, color: 'bg-accent-500' },
  { currency: 'USDT', volume: '$6.8M', percentage: 27, color: 'bg-emerald-500' },
  { currency: 'USDC', volume: '$3.1M', percentage: 13, color: 'bg-blue-500' },
  { currency: 'Other', volume: '$0.7M', percentage: 3, color: 'bg-slate-400' },
];

const topMerchants = [
  { name: 'NFT Market', volume: '$3.4M', payments: 8900, growth: '+24%' },
  { name: 'Acme Corp', volume: '$1.2M', payments: 3400, growth: '+12%' },
  { name: 'CryptoShop', volume: '$890K', payments: 2100, growth: '+8%' },
  { name: 'TokenPay', volume: '$450K', payments: 1200, growth: '-3%' },
  { name: 'DeFi Hub', volume: '$320K', payments: 850, growth: '+45%' },
];

const dailyData = [
  { day: 'Mon', volume: 3.2, payments: 1240 },
  { day: 'Tue', volume: 3.8, payments: 1480 },
  { day: 'Wed', volume: 4.1, payments: 1620 },
  { day: 'Thu', volume: 3.5, payments: 1380 },
  { day: 'Fri', volume: 4.5, payments: 1780 },
  { day: 'Sat', volume: 2.8, payments: 1050 },
  { day: 'Sun', volume: 2.9, payments: 1120 },
];

const maxVolume = Math.max(...dailyData.map((d) => d.volume));

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Platform Analytics</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Comprehensive view of EPay platform performance and trends</p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {metrics.map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-2xl p-5"
          >
            <div className="flex items-center gap-2 mb-3">
              <m.icon className="w-4 h-4 text-accent-500" />
              <span className="text-xs font-medium text-slate-500">{m.label}</span>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{m.value}</p>
            <span className={`inline-flex items-center gap-0.5 text-xs font-medium mt-1 ${
              m.trend === 'up' ? 'text-emerald-500' : 'text-red-500'
            }`}>
              {m.trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {m.change} vs last month
            </span>
          </motion.div>
        ))}
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Daily volume bar chart */}
        <div className="xl:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-semibold text-slate-900 dark:text-white">Daily Volume (7 days)</h2>
            <span className="text-xs text-slate-500">Last week</span>
          </div>
          <div className="flex items-end gap-3 h-52">
            {dailyData.map((d) => {
              const height = Math.max((d.volume / maxVolume) * 100, 4);
              return (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-2">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">${d.volume}M</span>
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${height}%` }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    className="w-full max-w-[40px] bg-gradient-to-t from-accent-500 to-accent-400 rounded-t-lg mx-auto"
                  />
                  <span className="text-xs text-slate-500">{d.day}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Volume breakdown */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-2xl p-5">
          <h2 className="font-semibold text-slate-900 dark:text-white mb-4">Volume by Currency</h2>
          <div className="space-y-4">
            {volumeBreakdown.map((item) => (
              <div key={item.currency}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-slate-700 dark:text-slate-300 font-medium">{item.currency}</span>
                  <span className="text-slate-500">{item.volume} ({item.percentage}%)</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 dark:bg-white/5 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${item.percentage}%` }}
                    transition={{ duration: 0.8 }}
                    className={`h-full rounded-full ${item.color}`}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Platform health */}
          <div className="mt-6 pt-4 border-t border-slate-200 dark:border-white/5">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Network Stats</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <Globe className="w-4 h-4 text-accent-500 mb-1" />
                <p className="text-sm font-bold text-slate-900 dark:text-white">Mainnet</p>
                <p className="text-xs text-slate-500">74% volume</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <Zap className="w-4 h-4 text-amber-500 mb-1" />
                <p className="text-sm font-bold text-slate-900 dark:text-white">Testnet</p>
                <p className="text-xs text-slate-500">26% volume</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top merchants */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-white/5">
          <h2 className="font-semibold text-slate-900 dark:text-white">Top Merchants by Volume</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-white/5">
                <th className="text-left font-medium px-5 py-3 w-10">#</th>
                <th className="text-left font-medium px-5 py-3">Merchant</th>
                <th className="text-left font-medium px-5 py-3">Volume</th>
                <th className="text-left font-medium px-5 py-3">Payments</th>
                <th className="text-left font-medium px-5 py-3">Growth</th>
              </tr>
            </thead>
            <tbody>
              {topMerchants.map((m, i) => (
                <tr key={m.name} className="border-b border-slate-50 dark:border-white/[0.02] hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3 text-sm font-bold text-slate-400">{i + 1}</td>
                  <td className="px-5 py-3 text-sm font-medium text-slate-900 dark:text-white">{m.name}</td>
                  <td className="px-5 py-3 text-sm text-slate-700 dark:text-slate-300 font-mono">{m.volume}</td>
                  <td className="px-5 py-3 text-sm text-slate-600 dark:text-slate-400">{m.payments.toLocaleString()}</td>
                  <td className="px-5 py-3">
                    <span className={`text-sm font-medium ${m.growth.startsWith('+') ? 'text-emerald-500' : 'text-red-500'}`}>
                      {m.growth}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
