'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Input, Badge } from '@epay/ui';
import { motion } from 'framer-motion';
import {
  Settings,
  User,
  Bell,
  Globe,
  Shield,
  Key,
  Save,
  Copy,
  Eye,
  EyeOff,
} from 'lucide-react';

export default function SettingsPage() {
  const [showApiKey, setShowApiKey] = useState(false);

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Settings</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Manage your account and preferences.</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Update your personal information.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Display Name</label>
              <Input defaultValue="John Doe" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input type="email" defaultValue="john@example.com" />
            </div>
          </div>
          <Button className="gap-2">
            <Save className="w-4 h-4" />
            Save Changes
          </Button>
        </CardContent>
      </Card>

      {/* API Keys */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
              <Key className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>Manage your API keys for programmatic access.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
            <div className="flex-1">
              <div className="text-sm font-medium text-slate-900 dark:text-white mb-1">
                Production Key
              </div>
              <div className="flex items-center gap-2">
                <code className="text-sm font-mono text-slate-500 dark:text-slate-400">
                  {showApiKey ? 'epay_7xK2mP9yN3pQ8rB4sV1t...' : 'epay_••••••••••••••••••••••••'}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            </div>
            <Badge variant="success">Active</Badge>
          </div>
          <Button variant="outline" size="sm" className="gap-2">
            <Key className="w-4 h-4" />
            Generate New Key
          </Button>
        </CardContent>
      </Card>

      {/* Webhook */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
              <Globe className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <CardTitle>Webhooks</CardTitle>
              <CardDescription>Configure webhook endpoints for real-time event notifications.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Webhook URL</label>
            <Input placeholder="https://your-app.com/webhooks/epay" defaultValue="https://example.com/webhooks/epay" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Webhook Secret</label>
            <Input type="password" defaultValue="whsec_••••••••••••••••" />
          </div>
          <Button className="gap-2">
            <Save className="w-4 h-4" />
            Save Webhook Config
          </Button>
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <Bell className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>Choose which notifications you want to receive.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { label: 'Payment Received', enabled: true },
              { label: 'Payment Failed', enabled: true },
              { label: 'Invoice Paid', enabled: true },
              { label: 'Escrow Milestone Completed', enabled: false },
              { label: 'Settlement Processed', enabled: true },
              { label: 'Weekly Analytics Report', enabled: false },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-2">
                <span className="text-sm text-slate-700 dark:text-slate-300">{item.label}</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    defaultChecked={item.enabled}
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#0098EA]" />
                </label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
