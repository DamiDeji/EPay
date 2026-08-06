'use client';

import { useTheme } from 'next-themes';
import { useState, useEffect } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

const DATA = [
  { day: 'Mon', rate: 96 }, { day: 'Tue', rate: 98 }, { day: 'Wed', rate: 94 },
  { day: 'Thu', rate: 99 }, { day: 'Fri', rate: 97 }, { day: 'Sat', rate: 100 },
  { day: 'Sun', rate: 98 },
];

export function SuccessRateChart() {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return <div className="h-64" />;

  const isDark = theme === 'dark';

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={DATA}>
        <defs>
          <linearGradient id="successGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10B981" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} vertical={false} />
        <XAxis dataKey="day" tick={{ fontSize: 12, fill: isDark ? '#94a3b8' : '#64748b' }} axisLine={false} tickLine={false} />
        <YAxis domain={[90, 100]} tick={{ fontSize: 12, fill: isDark ? '#94a3b8' : '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
        <Tooltip
          contentStyle={{
            backgroundColor: isDark ? '#1e293b' : '#fff',
            border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
            borderRadius: '12px',
          }}
          formatter={(value: number) => [`${value}%`, 'Success Rate']}
        />
        <Area type="monotone" dataKey="rate" stroke="#10B981" strokeWidth={2} fill="url(#successGrad)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
