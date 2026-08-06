'use client';

import { Button } from '@epay/ui';
import {
  Menu,
  X,
  Sun,
  Moon,
  Zap,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { useState, useEffect } from 'react';

const NAV_LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How it Works' },
  { href: '#pricing', label: 'Pricing' },
  { href: 'https://docs.epay.dev', label: 'Docs', external: true },
];

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handleScroll = () => { setIsScrolled(window.scrollY > 10); };
    window.addEventListener('scroll', handleScroll);
    return () => { window.removeEventListener('scroll', handleScroll); };
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'glass shadow-sm py-3'
          : 'bg-transparent py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#0098EA] to-[#1E3A8A] flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight">
            <span className="text-[#0098EA]">E</span>
            <span className="text-slate-900 dark:text-white">Pay</span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link) =>
            link.external ? (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-[#0098EA] dark:hover:text-[#0098EA] transition-colors"
              >
                {link.label}
              </a>
            ) : (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-[#0098EA] dark:hover:text-[#0098EA] transition-colors"
              >
                {link.label}
              </a>
            ),
          )}
        </div>

        {/* Desktop Actions */}
        <div className="hidden md:flex items-center gap-3">
          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => { setTheme(theme === 'dark' ? 'light' : 'dark'); }}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
          )}
          <Link href="/login">
            <Button variant="ghost" size="sm">
              Sign In
            </Button>
          </Link>
          <Link href="/register">
            <Button size="sm" className="gap-2">
              <Wallet className="w-4 h-4" />
              Get Started
            </Button>
          </Link>
        </div>

        {/* Mobile Toggle */}
        <div className="md:hidden flex items-center gap-2">
          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => { setTheme(theme === 'dark' ? 'light' : 'dark'); }}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => { setIsMobileOpen(!isMobileOpen); }}>
            {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileOpen && (
        <div className="md:hidden glass mt-2 mx-4 rounded-xl p-4 animate-fade-in">
          <div className="flex flex-col gap-3">
            {NAV_LINKS.map((link) =>
              link.external ? (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                  onClick={() => { setIsMobileOpen(false); }}
                >
                  {link.label}
                </a>
              ) : (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                  onClick={() => { setIsMobileOpen(false); }}
                >
                  {link.label}
                </a>
              ),
            )}
            <hr className="border-slate-200 dark:border-slate-700" />
            <Link href="/login" onClick={() => { setIsMobileOpen(false); }}>
              <Button variant="ghost" className="w-full justify-start">
                Sign In
              </Button>
            </Link>
            <Link href="/register" onClick={() => { setIsMobileOpen(false); }}>
              <Button className="w-full gap-2">
                <Wallet className="w-4 h-4" />
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
