'use client';

import { Card, CardContent, Button, Badge } from '@epay/ui';
import { ShieldCheck, Clock, AlertCircle, CheckCircle2, Plus } from 'lucide-react';

const ESCROWS = [
  {
    id: 'esc_k2mPx',
    description: 'Website Development',
    customer: 'Acme Corp',
    amount: '5,000 TON',
    milestones: 4,
    completed: 3,
    status: 'IN_PROGRESS',
    createdAt: '2026-07-15',
  },
  {
    id: 'esc_n3qYz',
    description: 'Smart Contract Audit',
    customer: 'Globex Inc',
    amount: '2,500 TON',
    milestones: 3,
    completed: 3,
    status: 'COMPLETED',
    createdAt: '2026-06-20',
  },
  {
    id: 'esc_q8wRk',
    description: 'Logo Design',
    customer: 'Initech LLC',
    amount: '500 TON',
    milestones: 2,
    completed: 0,
    status: 'FUNDED',
    createdAt: '2026-08-01',
  },
];

const statusConfig: Record<string, { badge: 'success' | 'warning' | 'destructive' | 'slate'; icon: React.ElementType }> = {
  IN_PROGRESS: { badge: 'slate', icon: Clock },
  COMPLETED: { badge: 'success', icon: CheckCircle2 },
  FUNDED: { badge: 'warning', icon: ShieldCheck },
  DISPUTED: { badge: 'destructive', icon: AlertCircle },
  CREATED: { badge: 'slate', icon: Clock },
};

export default function EscrowPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Escrow</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Protected transactions with milestone-based release.</p>
        </div>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          New Escrow
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {ESCROWS.map((escrow) => {
          const config = statusConfig[escrow.status];
          const StatusIcon = config.icon;
          const progress = (escrow.completed / escrow.milestones) * 100;

          return (
            <Card key={escrow.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <Badge variant={config.badge} className="gap-1">
                    <StatusIcon className="w-3 h-3" />
                    {escrow.status.replace('_', ' ')}
                  </Badge>
                  <span className="font-mono text-xs text-slate-400">{escrow.id}</span>
                </div>

                {/* Title & Amount */}
                <h3 className="font-semibold text-slate-900 dark:text-white mb-1">{escrow.description}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                  {escrow.customer} &middot; {escrow.amount}
                </p>

                {/* Progress */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Milestones</span>
                    <span>
                      {escrow.completed}/{escrow.milestones}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#0098EA] to-[#10B981] transition-all duration-500"
                      style={{ width: `${String(progress)}%` }}
                    />
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-xs text-slate-400">
                    Created {new Date(escrow.createdAt).toLocaleDateString()}
                  </span>
                  <Button variant="outline" size="sm">
                    View Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
