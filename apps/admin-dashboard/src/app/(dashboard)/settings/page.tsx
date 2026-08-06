'use client';

import { motion } from 'framer-motion';
import {
  User, Key, Settings, Shield, Globe,
  Copy, Check, Eye, EyeOff, Save, RefreshCw,
  Bell, Smartphone, Mail, AlertTriangle,
  Server, Database, Activity,
} from 'lucide-react';
import { useState } from 'react';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('profile');
  const [copied, setCopied] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'api', label: 'API Keys', icon: Key },
    { id: 'system', label: 'System Config', icon: Settings },
    { id: 'health', label: 'System Health', icon: Activity },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Settings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage admin account, API keys, and platform configuration</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-white/5 pb-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-slate-900 text-accent-500 border border-b-transparent border-slate-200 dark:border-white/5 -mb-[1px]'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-2xl p-6"
      >
        {/* ── Profile Tab ──────────────────────────────────────────── */}
        {activeTab === 'profile' && (
          <div className="max-w-xl space-y-5">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Admin Profile</h2>

            <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-white text-xl font-bold shadow-lg">
                A
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">Admin User</p>
                <p className="text-sm text-slate-500">Platform Administrator</p>
                <p className="text-xs text-slate-400">admin@epay.dev</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Display Name</label>
              <input type="text" defaultValue="Admin User" className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Email</label>
              <input type="email" defaultValue="admin@epay.dev" className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">New Password</label>
              <input type="password" placeholder="Leave blank to keep current" className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500" />
            </div>

            <button className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary-500 to-accent-500 text-white font-semibold rounded-xl hover:from-primary-600 hover:to-accent-600 transition-all shadow-lg shadow-accent-500/20">
              <Save className="w-4 h-4" /> Save Changes
            </button>
          </div>
        )}

        {/* ── API Keys Tab ─────────────────────────────────────────── */}
        {activeTab === 'api' && (
          <div className="max-w-2xl space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Admin API Keys</h2>
              <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent-500 text-white text-sm font-medium hover:bg-accent-600 transition-all shadow-md">
                <Key className="w-4 h-4" /> Generate New Key
              </button>
            </div>

            <p className="text-sm text-slate-500">Use these keys to authenticate with the EPay Admin API for programmatic access.</p>

            {/* Key 1 */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-accent-500" />
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">Admin Production Key</span>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-medium">Active</span>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm font-mono bg-slate-50 dark:bg-slate-950 py-2 px-3 rounded-lg text-slate-600 dark:text-slate-400 select-all">
                  {showKey ? 'ep_admin_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6' : 'ep_admin_••••••••••••••••••••••••••••••••'}
                </code>
                <button onClick={() => setShowKey(!showKey)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400">
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => copyToClipboard('ep_admin_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6')}
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400"
                >
                  {copied === 'ep_admin_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex gap-4 text-xs text-slate-500">
                <span>Created: 2024-01-15</span>
                <span>Last used: 2 hours ago</span>
                <span>Permissions: admin</span>
              </div>
            </div>

            {/* Key 2 (revoked) */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-white/5 space-y-3 opacity-60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-slate-400" />
                  <span className="text-sm font-semibold text-slate-500">Old Development Key</span>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-500 font-medium">Revoked</span>
              </div>
              <code className="block text-sm font-mono bg-slate-50 dark:bg-slate-950 py-2 px-3 rounded-lg text-slate-400">
                ep_admin_••••••••••••••••••••••••••••••••
              </code>
            </div>
          </div>
        )}

        {/* ── System Config Tab ────────────────────────────────────── */}
        {activeTab === 'system' && (
          <div className="max-w-xl space-y-5">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Platform Configuration</h2>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Default Fee Rate (basis points)</label>
              <div className="flex items-center gap-3">
                <input type="range" min="0" max="500" defaultValue="50" className="flex-1 accent-accent-500" />
                <span className="text-sm font-mono font-bold text-slate-900 dark:text-white w-12 text-right">50 bps</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">50 bps = 0.5% fee per transaction</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Maximum Payment Amount (TON)</label>
              <input type="number" defaultValue="100000" className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Payment Expiry (seconds)</label>
              <input type="number" defaultValue="3600" className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500" />
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Emergency Pause</p>
                <p className="text-xs text-slate-500">Pause all new payment processing across the platform</p>
              </div>
              <button className="px-4 py-2 rounded-xl bg-red-500/10 text-red-500 text-sm font-medium border border-red-500/20 hover:bg-red-500 hover:text-white transition-all">
                <AlertTriangle className="w-4 h-4 inline mr-1.5" />
                Pause Platform
              </button>
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Maintenance Mode</p>
                <p className="text-xs text-slate-500">Show maintenance page to users during upgrades</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" />
                <div className="w-10 h-5 bg-slate-300 dark:bg-slate-700 rounded-full peer-checked:bg-accent-500 peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
              </label>
            </div>

            <button className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary-500 to-accent-500 text-white font-semibold rounded-xl hover:from-primary-600 hover:to-accent-600 transition-all shadow-lg shadow-accent-500/20">
              <Save className="w-4 h-4" /> Save Configuration
            </button>
          </div>
        )}

        {/* ── System Health Tab ─────────────────────────────────────── */}
        {activeTab === 'health' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">System Health</h2>
              <button className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-all">
                <RefreshCw className="w-4 h-4" /> Refresh
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'API Server', status: 'healthy', icon: Server, uptime: '99.99%' },
                { label: 'Database', status: 'healthy', icon: Database, uptime: '99.97%' },
                { label: 'Redis Cache', status: 'degraded', icon: Activity, uptime: '99.5%' },
                { label: 'Blockchain Indexer', status: 'healthy', icon: Globe, uptime: '99.8%' },
              ].map((svc) => (
                <div key={svc.label} className="p-4 rounded-xl border border-slate-200 dark:border-white/5">
                  <svc.icon className={`w-5 h-5 mb-2 ${
                    svc.status === 'healthy' ? 'text-emerald-500' : 'text-amber-500'
                  }`} />
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{svc.label}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`w-2 h-2 rounded-full ${
                      svc.status === 'healthy' ? 'bg-emerald-500' : 'bg-amber-500'
                    }`} />
                    <span className="text-xs capitalize text-slate-500">{svc.status}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">Uptime: {svc.uptime}</p>
                </div>
              ))}
            </div>

            {/* Recent Incidents */}
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Recent Incidents</h3>
              <div className="space-y-2">
                {[
                  { date: '2026-08-03', title: 'Redis connection blip', severity: 'minor', status: 'resolved' },
                  { date: '2026-07-28', title: 'Elevated API latency', severity: 'major', status: 'resolved' },
                  { date: '2026-07-15', title: 'Indexer lag spike', severity: 'minor', status: 'resolved' },
                ].map((inc) => (
                  <div key={inc.title} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{inc.title}</p>
                      <p className="text-xs text-slate-500">{inc.date}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        inc.severity === 'major' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'
                      }`}>{inc.severity}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-medium">{inc.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Notification Preferences */}
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-white/5">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Alert Preferences</h3>
              <div className="space-y-3">
                {[
                  { icon: Mail, label: 'Email alerts', desc: 'Critical incidents and security events' },
                  { icon: Smartphone, label: 'Push notifications', desc: 'Merchant verification requests' },
                  { icon: Bell, label: 'In-app alerts', desc: 'System status changes' },
                ].map((pref) => {
                  const Icon = pref.icon;
                  return (
                    <div key={pref.label} className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-3">
                        <Icon className="w-4 h-4 text-slate-400" />
                        <div>
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{pref.label}</p>
                          <p className="text-xs text-slate-500">{pref.desc}</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" defaultChecked className="sr-only peer" />
                        <div className="w-10 h-5 bg-slate-300 dark:bg-slate-700 rounded-full peer-checked:bg-accent-500 peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
