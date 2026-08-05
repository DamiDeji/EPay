import { Card, CardContent } from '@epay/ui';
import { cn } from '@epay/ui';
import { ArrowUpRight, ArrowDownRight, type LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon: LucideIcon;
  iconBg?: string;
  iconColor?: string;
}

export function StatCard({
  label, value, sub, change, trend, icon: Icon,
  iconBg = 'bg-blue-100 dark:bg-blue-900/30',
  iconColor = 'text-blue-600 dark:text-blue-400',
}: StatCardProps) {
  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={cn('p-2.5 rounded-xl', iconBg)}>
            <Icon className={cn('w-5 h-5', iconColor)} />
          </div>
          {change && trend && (
            <div className={cn(
              'flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full',
              trend === 'up' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' :
              trend === 'down' ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' :
              'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
            )}>
              {trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> :
               trend === 'down' ? <ArrowDownRight className="w-3 h-3" /> : null}
              {change}
            </div>
          )}
        </div>
        <div className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{value}</div>
        <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
        {sub && <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}
