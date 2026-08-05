'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@epay/ui';
import {
  LayoutDashboard,
  ArrowLeftRight,
  FileText,
  Wallet,
  Settings,
  ShieldCheck,
  LogOut,
  Zap,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@epay/ui';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/payments', label: 'Payments', icon: ArrowLeftRight },
  { href: '/dashboard/invoices', label: 'Invoices', icon: FileText },
  { href: '/dashboard/wallet', label: 'Wallet', icon: Wallet },
  { href: '/dashboard/escrow', label: 'Escrow', icon: ShieldCheck },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col h-screen fixed left-0 top-0 z-40 border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 transition-all duration-300',
        collapsed ? 'w-20' : 'w-64',
      )}
    >
      {/* Logo */}
      <div className={cn('flex items-center h-16 px-4 border-b border-slate-200 dark:border-slate-700', collapsed ? 'justify-center' : 'gap-3')}>
        <Link href="/dashboard" className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0098EA] to-[#1E3A8A] flex items-center justify-center flex-shrink-0">
            <Zap className="w-4 h-4 text-white" />
          </div>
          {!collapsed && (
            <span className="font-bold text-lg whitespace-nowrap">
              <span className="text-[#0098EA]">E</span>Pay
            </span>
          )}
        </Link>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group',
                isActive
                  ? 'bg-[#0098EA]/10 text-[#0098EA] dark:bg-[#0098EA]/20'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200',
                collapsed && 'justify-center px-2',
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className={cn('w-5 h-5 flex-shrink-0', isActive && 'text-[#0098EA]')} />
              {!collapsed && <span>{item.label}</span>}
              {!collapsed && isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#0098EA]" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className={cn('p-3 border-t border-slate-200 dark:border-slate-700', collapsed && 'flex flex-col items-center')}>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center gap-2 mb-2"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          {!collapsed && <span className="text-xs">Collapse</span>}
        </Button>
        <Link
          href="/login"
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-all',
            collapsed && 'justify-center px-2',
          )}
          onClick={() => {
            localStorage.removeItem('epay_access_token');
            localStorage.removeItem('epay_refresh_token');
          }}
          title={collapsed ? 'Sign Out' : undefined}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </Link>
      </div>
    </aside>
  );
}
