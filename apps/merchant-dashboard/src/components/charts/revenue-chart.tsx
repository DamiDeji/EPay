'use client';

import { useTheme } from 'next-themes';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useState, useEffect } from 'react';

const DATA = [
  { month: 'Jan', revenue: 420, volume: 520, fees: 21 },
  { month: 'Feb', revenue: 380, volume: 490, fees: 19 },
  { month: 'Mar', revenue: 510, volume: 620, fees: 25 },
  { month: 'Apr', revenue: 460, volume: 550, fees: 23 },
  { month: 'May', revenue: 580, volume: 680, fees: 29 },
  { month: 'Jun', revenue: 640, volume: 750, fees: 32 },
  { month: 'Jul', revenue: 720, volume: 840, fees: 36 },
  { month: 'Aug', revenue: 850, volume: 960, fees: 42 },
];

export function RevenueChart() {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="h-80" />;

  const isDark = theme === 'dark';

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={DATA} barGap={4}>
        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 12, fill: isDark ? '#94a3b8' : '#64748b' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: isDark ? '#94a3b8' : '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}`} />
        <Tooltip
          contentStyle={{
            backgroundColor: isDark ? '#1e293b' : '#fff',
            border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          }}
          labelStyle={{ color: isDark ? '#f1f5f9' : '#0f172a', fontWeight: 600 }}
        />
        <Bar dataKey="volume" fill="#0098EA" radius={[6, 6, 0, 0]} name="Volume" />
        <Bar dataKey="revenue" fill="#1E3A8A" radius={[6, 6, 0, 0]} name="Revenue" />
      </BarChart>
    </ResponsiveContainer>
  );
}
