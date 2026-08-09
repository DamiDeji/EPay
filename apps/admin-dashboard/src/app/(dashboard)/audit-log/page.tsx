'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Calendar, ChevronDown, ChevronRight,
  User, CreditCard, Settings, Shield, Key, Copy, Check,
} from 'lucide-react';
import { useState } from 'react';

const auditLogs = [
  { id: 'log_001', action: 'merchant.verified', resource: 'Merchant', resourceId: 'merch_003', userId: 'admin_001', userName: 'Admin User', details: 'Approved merchant verification for Acme Corp', changes: { status: 'pending → active', verification: 'basic → verified' }, ip: '192.168.1.100', timestamp: '2026-08-05T14:32:00Z' },
  { id: 'log_002', action: 'payment.refunded', resource: 'Payment', resourceId: 'pay_k1l2', userId: 'admin_001', userName: 'Admin User', details: 'Processed manual refund for payment pay_k1l2', changes: { status: 'completed → refunded', amount: '100 XLM' }, ip: '192.168.1.100', timestamp: '2026-08-05T13:45:00Z' },
  { id: 'log_003', action: 'api_key.created', resource: 'ApiKey', resourceId: 'key_789', userId: 'merch_001', userName: 'Acme Corp', details: 'Created new production API key', changes: { permissions: 'read:payments, write:payments' }, ip: '10.0.0.55', timestamp: '2026-08-05T12:10:00Z' },
  { id: 'log_004', action: 'merchant.suspended', resource: 'Merchant', resourceId: 'merch_005', userId: 'admin_001', userName: 'Admin User', details: 'Suspended TokenPay for policy violation', changes: { status: 'active → suspended', reason: 'Policy violation - unauthorized transactions' }, ip: '192.168.1.100', timestamp: '2026-08-05T11:00:00Z' },
  { id: 'log_005', action: 'system.config_updated', resource: 'Configuration', resourceId: 'fee_rate', userId: 'admin_001', userName: 'Admin User', details: 'Updated default fee rate to 0.5%', changes: { feeBps: '30 → 50' }, ip: '192.168.1.100', timestamp: '2026-08-04T09:30:00Z' },
  { id: 'log_006', action: 'user.login', resource: 'User', resourceId: 'admin_001', userId: 'admin_001', userName: 'Admin User', details: 'Successful login from admin dashboard', changes: null, ip: '192.168.1.100', timestamp: '2026-08-05T08:00:00Z' },
  { id: 'log_007', action: 'webhook.failed', resource: 'Webhook', resourceId: 'wh_012', userId: null, userName: 'System', details: 'Webhook delivery failed for merchant CryptoShop after 5 retries', changes: { statusCode: '500', attempts: '5/5' }, ip: null, timestamp: '2026-08-04T22:15:00Z' },
];

const actionIcons: Record<string, React.ElementType> = {
  'merchant.verified': Shield,
  'merchant.suspended': Shield,
  'payment.refunded': CreditCard,
  'api_key.created': Key,
  'user.login': User,
  'system.config_updated': Settings,
  'webhook.failed': CreditCard,
};

const actionColors: Record<string, string> = {
  'merchant.verified': 'text-emerald-500 bg-emerald-500/10',
  'merchant.suspended': 'text-red-500 bg-red-500/10',
  'payment.refunded': 'text-amber-500 bg-amber-500/10',
  'api_key.created': 'text-blue-500 bg-blue-500/10',
  'user.login': 'text-slate-500 bg-slate-500/10',
  'system.config_updated': 'text-violet-500 bg-violet-500/10',
  'webhook.failed': 'text-orange-500 bg-orange-500/10',
};

export default function AuditLogPage() {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const filtered = auditLogs.filter((log) => {
    const matchSearch = log.action.includes(search.toLowerCase()) ||
      log.userName.toLowerCase().includes(search.toLowerCase()) ||
      log.details.toLowerCase().includes(search.toLowerCase());
    const matchAction = actionFilter === 'all' || log.action === actionFilter;
    return matchSearch && matchAction;
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Audit Log</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Immutable record of all platform actions and changes</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search audit logs..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['all', 'merchant.verified', 'merchant.suspended', 'payment.refunded', 'api_key.created', 'system.config_updated'].map((a) => (
            <button
              key={a}
              onClick={() => setActionFilter(a)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                actionFilter === a
                  ? 'bg-accent-500 text-white shadow-md'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'
              }`}
            >
              {a === 'all' ? 'All' : a.replace('_', '.').replace('.', ' · ')}
            </button>
          ))}
        </div>
      </div>

      {/* Log list */}
      <div className="space-y-2">
        {filtered.map((log, i) => {
          const ActionIcon = actionIcons[log.action] || Settings;
          const colorClass = actionColors[log.action] || 'text-slate-500 bg-slate-500/10';
          const isExpanded = expanded === log.id;
          const time = new Date(log.timestamp).toLocaleString();

          return (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-xl overflow-hidden hover:border-slate-300 dark:hover:border-white/10 transition-all"
            >
              <button
                onClick={() => setExpanded(isExpanded ? null : log.id)}
                className="w-full flex items-center gap-4 px-5 py-4 text-left"
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                  <ActionIcon className="w-4 h-4" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">
                      {log.action.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 text-slate-500 font-mono">
                      {log.resourceId}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                    by {log.userName} · {time}
                  </p>
                </div>

                {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-4 pt-1 border-t border-slate-100 dark:border-white/5 mx-5 space-y-3">
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Details</p>
                        <p className="text-sm text-slate-700 dark:text-slate-300">{log.details}</p>
                      </div>

                      {log.changes && (
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Changes</p>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(log.changes).map(([key, value]) => (
                              <span key={key} className="text-xs px-2 py-1 rounded-lg bg-slate-100 dark:bg-white/5 font-mono">
                                <span className="text-slate-500">{key}:</span>{' '}
                                <span className="text-slate-900 dark:text-white">{value}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" /> User ID: <span className="font-mono text-slate-700 dark:text-slate-300">{log.userId ?? 'N/A'}</span>
                        </span>
                        {log.ip && (
                          <span className="flex items-center gap-1">
                            IP: <span className="font-mono text-slate-700 dark:text-slate-300">{log.ip}</span>
                            <button onClick={() => copyToClipboard(log.ip!)} className="ml-1 text-slate-400 hover:text-accent-500">
                              {copied === log.ip ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {time}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      <div className="flex justify-center">
        <button className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 transition-all">
          Load more logs
        </button>
      </div>
    </div>
  );
}
