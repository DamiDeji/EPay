'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Input, Badge } from '@epay/ui';
import {
  Building2, Globe, Key, Bell, Shield, Save, Copy, Eye, EyeOff, Wallet, Trash2,
} from 'lucide-react';
import { useState } from 'react';

export default function SettingsPage() {
  const [showApiKey, setShowApiKey] = useState(false);

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Settings</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Manage your merchant account and preferences.</p>
      </div>

      {/* Business Profile */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30"><Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" /></div>
            <div><CardTitle>Business Profile</CardTitle><CardDescription>Your merchant information displayed to customers.</CardDescription></div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2"><label className="text-sm font-medium">Business Name</label><Input defaultValue="Acme Store" /></div>
            <div className="space-y-2"><label className="text-sm font-medium">Business Email</label><Input type="email" defaultValue="merchant@acme.com" /></div>
            <div className="space-y-2 sm:col-span-2"><label className="text-sm font-medium">Business URL</label><Input placeholder="https://your-store.com" defaultValue="https://acme-store.com" /></div>
            <div className="space-y-2 sm:col-span-2"><label className="text-sm font-medium">Description</label><Input placeholder="Brief description of your business" defaultValue="Online retail store specializing in premium goods." /></div>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30"><Shield className="w-4 h-4 text-emerald-600" /></div>
              <div><div className="text-sm font-medium text-slate-900 dark:text-white">Verification Status</div><div className="text-xs text-slate-500">Verified merchant since June 2026</div></div>
            </div>
            <Badge variant="success">VERIFIED</Badge>
          </div>
          <Button className="gap-2"><Save className="w-4 h-4" />Save Changes</Button>
        </CardContent>
      </Card>

      {/* Settlement Wallet */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30"><Wallet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /></div>
            <div><CardTitle>Settlement Address</CardTitle><CardDescription>The TON wallet where funds are settled.</CardDescription></div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">TON Wallet Address</label>
            <Input defaultValue="EQD2kR...Bx9Yp8mQwL_fVn3" />
          </div>
          <Button variant="outline" size="sm" className="gap-2 text-red-600 hover:text-red-700">
            <Trash2 className="w-4 h-4" />Disconnect Wallet
          </Button>
        </CardContent>
      </Card>

      {/* API Keys */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30"><Key className="w-5 h-5 text-purple-600 dark:text-purple-400" /></div>
            <div><CardTitle>API Keys</CardTitle><CardDescription>Manage API keys for programmatic access to your merchant account.</CardDescription></div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { name: 'Production Key', prefix: 'epay_live', active: true },
            { name: 'Development Key', prefix: 'epay_test', active: true },
          ].map((key) => (
            <div key={key.name} className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-900 dark:text-white mb-1">{key.name}</div>
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono text-slate-500">
                    {showApiKey ? `${key.prefix}_7xK2mP9yN3pQ8rB4sV1t...` : `${key.prefix}_••••••••••••••••••••`}
                  </code>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setShowApiKey(!showApiKey); }}>
                    {showApiKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6"><Copy className="w-3 h-3" /></Button>
                </div>
              </div>
              <Badge variant={key.active ? 'success' : 'slate'}>{key.active ? 'Active' : 'Inactive'}</Badge>
            </div>
          ))}
          <Button variant="outline" size="sm" className="gap-2"><Key className="w-4 h-4" />Generate New Key</Button>
        </CardContent>
      </Card>

      {/* Webhooks */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-100 dark:bg-cyan-900/30"><Globe className="w-5 h-5 text-cyan-600 dark:text-cyan-400" /></div>
            <div><CardTitle>Webhooks</CardTitle><CardDescription>Receive real-time event notifications at your endpoint.</CardDescription></div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2"><label className="text-sm font-medium">Webhook URL</label><Input placeholder="https://your-app.com/webhooks/epay" defaultValue="https://acme-store.com/webhooks/epay" /></div>
          <div className="space-y-2"><label className="text-sm font-medium">Webhook Secret</label><Input type="password" defaultValue="whsec_••••••••••••••••" /></div>
          <div className="flex gap-4 text-xs text-slate-500">
            <span>Events: payment.*, invoice.*, settlement.*, refund.*</span>
          </div>
          <Button className="gap-2"><Save className="w-4 h-4" />Save Webhook Config</Button>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30"><Bell className="w-5 h-5 text-amber-600 dark:text-amber-400" /></div>
            <div><CardTitle>Notifications</CardTitle><CardDescription>Configure which events trigger notifications.</CardDescription></div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { label: 'Payment Received', enabled: true },
              { label: 'Payment Failed', enabled: true },
              { label: 'Invoice Paid', enabled: true },
              { label: 'Refund Requested', enabled: true },
              { label: 'Settlement Processed', enabled: true },
              { label: 'Subscription Renewed', enabled: false },
              { label: 'Weekly Analytics Report', enabled: false },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-2">
                <span className="text-sm text-slate-700 dark:text-slate-300">{item.label}</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked={item.enabled} />
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
