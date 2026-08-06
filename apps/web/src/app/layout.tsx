import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

import { Providers } from './providers';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'EPay — Decentralized Payments on TON',
    template: '%s | EPay',
  },
  description:
    'Enterprise-grade decentralized payment gateway on The Open Network. Accept crypto payments, manage invoices, escrow, subscriptions, and more.',
  keywords: ['TON', 'crypto payments', 'blockchain', 'payment gateway', 'Web3', 'decentralized'],
  authors: [{ name: 'EPay Contributors' }],
  openGraph: {
    type: 'website',
    siteName: 'EPay',
    title: 'EPay — Decentralized Payments on TON',
    description:
      'Enterprise-grade decentralized payment gateway on The Open Network. Accept crypto payments, manage invoices, escrow, subscriptions, and more.',
  },
  metadataBase: new URL('https://epay.dev'),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
      </head>
      <body className="min-h-screen bg-white dark:bg-slate-950 font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
