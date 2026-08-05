'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  // Basic auth guard — check for a token on mount.
  // In production, replace with a proper AuthProvider / middleware.
  useEffect(() => {
    // TODO: Replace with real token check (e.g., from cookies, localStorage, or context)
    const token = typeof window !== 'undefined' ? localStorage.getItem('epay_admin_token') : null;
    if (!token) {
      // For demo purposes, always consider authenticated.
      // In production: router.replace('/login');
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
