'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Bell, ChevronDown, LogOut, Moon, Search, Settings, Sun, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useCallback, useState } from 'react';

export function Header() {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSignOut = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('epay_admin_token');
    }
    router.push('/login');
  }, [router]);

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement global search — navigate to search results page
    if (searchQuery.trim()) {
      console.log('Search:', searchQuery);
    }
  }, [searchQuery]);

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200 dark:border-white/5 flex items-center justify-between px-6">
      {/* Search */}
      <form onSubmit={handleSearch} className="relative hidden sm:block">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search merchants, payments, audit logs..."
          className="w-80 pl-10 pr-4 py-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent transition-all"
        />
      </form>

      <div className="flex-1 sm:flex-none" />

      {/* Right actions */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <button className="relative p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-all">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-950" />
        </button>

        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-all"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-all ml-1"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-white text-xs font-bold ring-2 ring-white dark:ring-slate-900">
              A
            </div>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 hidden sm:block">Admin</span>
            <ChevronDown className="w-3 h-3 text-slate-400 hidden sm:block" />
          </button>

          <AnimatePresence>
            {showUserMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl shadow-xl z-50 overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-slate-200 dark:border-white/10">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">Admin User</p>
                    <p className="text-xs text-slate-500">admin@epay.dev</p>
                  </div>
                  <div className="p-1.5">
                    <button className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all">
                      <User className="w-4 h-4" /> Profile
                    </button>
                    <button className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all">
                      <Settings className="w-4 h-4" /> Settings
                    </button>
                    <button
                      onClick={handleSignOut}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all"
                    >
                      <LogOut className="w-4 h-4" /> Sign out
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
