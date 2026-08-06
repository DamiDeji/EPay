import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

import { Providers } from './providers';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Merchant Dashboard | EPay', template: '%s | EPay Merchant' },
  description: 'Manage your EPay merchant account — payments, invoices, analytics, and more.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-screen bg-white dark:bg-slate-950 font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
