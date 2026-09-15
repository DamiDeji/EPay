'use client';

import { ADMIN_SESSION, resolveAuthRedirect } from '@epay/shared';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { Header } from '@/components/header';
import { Sidebar } from '@/components/sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  /**
   * Send signed-out visitors to the login page.
   *
   * This previously read `epay_admin_token` and then ignored it, so the admin
   * shell rendered for anyone. The decision itself lives in `@epay/shared` so it
   * is unit-tested; this effect only applies it.
   *
   * `authChecked` stays false while redirecting, so the admin shell is never
   * painted for a session that is about to be rejected.
   */
  useEffect(() => {
    const redirect = resolveAuthRedirect(localStorage, ADMIN_SESSION, window.location.pathname);
    if (redirect) {
      router.replace(redirect);
      return;
    }
    setAuthChecked(true);
  }, [router]);

  const handleToggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => !prev);
  }, []);

  if (!authChecked) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white dark:bg-slate-950">
        <div className="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar collapsed={sidebarCollapsed} onToggle={handleToggleSidebar} />
      <div
        className={`flex-1 transition-all duration-300 ${
          sidebarCollapsed ? 'ml-[64px]' : 'ml-[64px] lg:ml-[240px]'
        }`}
      >
        <Header />
        <main className="p-4 sm:p-6 animate-fade-in">{children}</main>
      </div>
    </div>
  );
}
