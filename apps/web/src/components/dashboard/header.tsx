'use client';

import { Button, Avatar, AvatarFallback } from '@epay/ui';
import {
  Bell,
  Sun,
  Moon,
  Search,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useState, useEffect } from 'react';

export function DashboardHeader() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 lg:px-8 border-b border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg">
      {/* Search */}
      <div className="hidden sm:flex items-center gap-2 flex-1 max-w-md">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          type="search"
          placeholder="Search payments, invoices..."
          className="w-full bg-transparent border-none outline-none text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
        />
      </div>

      {/* Right Side */}
      <div className="flex items-center gap-2 ml-auto">
        {mounted && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => { setTheme(theme === 'dark' ? 'light' : 'dark'); }}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
        )}

        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-4 h-4" />
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500" />
        </Button>

        <Avatar className="w-8 h-8 ml-2">
          <AvatarFallback className="bg-[#0098EA] text-white text-xs font-bold">
            EP
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
