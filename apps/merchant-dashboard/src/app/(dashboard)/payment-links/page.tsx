'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button, Badge, Input } from '@epay/ui';
import { LinkIcon, Plus, Copy, QrCode, ExternalLink, Search, Trash2 } from 'lucide-react';

const LINKS = [
  { id: 'link_a1B2c', code: 'pay-demo-store', url: 'https://epay.dev/pay/pay-demo-store', amount: '50 TON', currency: 'TON', description: 'Demo Store Payment', maxPayments: null, current: 15, status: 'ACTIVE', createdAt: '2026-07-15' },
  { id: 'link_d3E4f', code: 'summer-sale', url: 'https://epay.dev/pay/summer-sale', amount: '25 TON', currency: 'TON', description: 'Summer Sale 2026', maxPayments: 100, current: 42, status: 'ACTIVE', createdAt: '2026-07-01' },
  { id: 'link_g5H6i', code: 'consulting', url: 'https://epay.dev/pay/consulting', amount: '200 TON', currency: 'TON', description: 'Consulting Services', maxPayments: null, current: 3, status: 'ACTIVE', createdAt: '2026-06-20' },
  { id: 'link_j7K8l', code: 'old-campaign', url: 'https://epay.dev/pay/old-campaign', amount: '10 TON', currency: 'TON', description: 'Spring Campaign', maxPayments: 50, current: 50, status: 'EXPIRED', createdAt: '2026-03-01' },
];

export default function PaymentLinksPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Payment Links</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Create shareable payment links for your customers.</p>
        </div>
        <Button className="gap-2"><Plus className="w-4 h-4" />Create Link</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {LINKS.map((link) => (
          <Card key={link.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <Badge variant={link.status === 'ACTIVE' ? 'success' : 'slate'}>{link.status}</Badge>
                <span className="font-mono text-xs text-slate-400">{link.id}</span>
              </div>

              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0098EA]/10 to-[#1E3A8A]/10 flex items-center justify-center">
                  <LinkIcon className="w-5 h-5 text-[#0098EA]" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">{link.description}</h3>
                  <p className="text-xs text-slate-400 font-mono">{link.code}</p>
                </div>
              </div>

              <div className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{link.amount}</div>
              <div className="text-xs text-slate-500 mb-4">
                {link.current} payments{link.maxPayments ? ` / ${link.maxPayments} max` : ''}
              </div>

              <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 flex items-center justify-between mb-3">
                <code className="text-xs font-mono text-slate-600 dark:text-slate-300 truncate max-w-[240px]">{link.url}</code>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7"><Copy className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7"><QrCode className="w-3.5 h-3.5" /></Button>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 gap-1"><ExternalLink className="w-3 h-3" />Open</Button>
                <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700"><Trash2 className="w-3 h-3" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
