'use client';

import { CUSTOMER_SESSION, resolveAuthRedirect } from '@epay/shared';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { DashboardHeader } from '@/components/dashboard/header';
import { Sidebar } from '@/components/dashboard/sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);

  /**
   * The customer dashboard previously rendered for every visitor. The guard is a
   * navigation control: the API is what actually scopes data to the caller.
   */
  useEffect(() => {
    const redirect = resolveAuthRedirect(localStorage, CUSTOMER_SESSION, window.location.pathname);
    if (redirect) {
      router.replace(redirect);
      return;
    }
    setAuthChecked(true);
  }, [router]);

  if (!authChecked) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="w-8 h-8 border-2 border-[#0098EA] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Sidebar />
      <div className="md:pl-64">
        <DashboardHeader />
        <main className="p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
