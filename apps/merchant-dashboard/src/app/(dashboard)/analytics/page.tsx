'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@epay/ui';
import { motion } from 'framer-motion';
import { DollarSign, TrendingUp, Wallet, Percent } from 'lucide-react';
import { useState, useEffect } from 'react';
import {
  LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer,
} from 'recharts';

import { RevenueChart } from '@/components/charts/revenue-chart';
import { SuccessRateChart } from '@/components/charts/success-rate-chart';
import { StatCard } from '@/components/stat-card';


const PIE_DATA = [
  { name: 'TON', value: 65, color: '#0098EA' },
  { name: 'USDT', value: 20, color: '#10B981' },
  { name: 'USDC', value: 10, color: '#1E3A8A' },
  { name: 'Other', value: 5, color: '#94a3b8' },
];

const TREND_DATA = [
  { date: 'Week 1', revenue: 420 },
  { date: 'Week 2', revenue: 380 },
  { date: 'Week 3', revenue: 510 },
  { date: 'Week 4', revenue: 620 },
  { date: 'Week 5', revenue: 580 },
  { date: 'Week 6', revenue: 720 },
  { date: 'Week 7', revenue: 850 },
  { date: 'Week 8', revenue: 920 },
];

export default function AnalyticsPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Analytics</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Deep insights into your payment activity and revenue trends.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Revenue', value: '3,450 TON', change: '+12.3%', trend: 'up' as const, icon: DollarSign, iconBg: 'bg-blue-100 dark:bg-blue-900/30', iconColor: 'text-blue-600' },
          { label: 'Avg. Ticket Size', value: '2.69 TON', change: '+5.7%', trend: 'up' as const, icon: Wallet, iconBg: 'bg-emerald-100 dark:bg-emerald-900/30', iconColor: 'text-emerald-600' },
          { label: 'Success Rate', value: '98.5%', change: '-0.3%', trend: 'down' as const, icon: Percent, iconBg: 'bg-purple-100 dark:bg-purple-900/30', iconColor: 'text-purple-600' },
          { label: 'Conversion', value: '24.8%', change: '+3.2%', trend: 'up' as const, icon: TrendingUp, iconBg: 'bg-amber-100 dark:bg-amber-900/30', iconColor: 'text-amber-600' },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: i * 0.1 }}>
            <StatCard {...stat} icon={stat.icon} />
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Revenue Trend</CardTitle></CardHeader>
          <CardContent>
            {mounted && (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={TREND_DATA}>
                  <Line type="monotone" dataKey="revenue" stroke="#0098EA" strokeWidth={2.5} dot={{ fill: '#0098EA', r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Currency Breakdown</CardTitle></CardHeader>
          <CardContent>
            {mounted && (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={PIE_DATA} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}>
                    {PIE_DATA.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            )}
            <div className="flex flex-wrap justify-center gap-4 mt-2">
              {PIE_DATA.map((item) => (
                <div key={item.name} className="flex items-center gap-1.5 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-slate-600 dark:text-slate-400">{item.name}</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{item.value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card><CardHeader><CardTitle>Revenue & Volume</CardTitle></CardHeader><CardContent><RevenueChart /></CardContent></Card>
        <Card><CardHeader><CardTitle>Success Rate</CardTitle></CardHeader><CardContent><SuccessRateChart /></CardContent></Card>
      </div>
    </div>
  );
}
