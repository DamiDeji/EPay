import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';

import { Providers } from './providers';
import './globals.css';

const locales = ['en', 'fr', 'es'] as const;

function hasLocale(locale: string): boolean {
  return locales.includes(locale as 'en' | 'fr' | 'es');
}

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'EPay — Decentralized Payments on Stellar',
    template: '%s | EPay',
  },
  description:
    'Enterprise-grade decentralized payment gateway on Stellar. Accept crypto payments, manage invoices, escrow, subscriptions, and more.',
  keywords: [
    'Stellar',
    'crypto payments',
    'blockchain',
    'payment gateway',
    'Web3',
    'Soroban',
    'decentralized',
  ],
  authors: [{ name: 'EPay Contributors' }],
  openGraph: {
    type: 'website',
    siteName: 'EPay',
    title: 'EPay — Decentralized Payments on Stellar',
    description:
      'Enterprise-grade decentralized payment gateway on Stellar. Accept crypto payments, manage invoices, escrow, subscriptions, and more.',
  },
  metadataBase: new URL('https://epay.dev'),
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();

  if (!hasLocale(locale)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html lang={locale} className={inter.variable} suppressHydrationWarning>
      <head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
      </head>
      <body className="min-h-screen bg-white dark:bg-slate-950 font-sans">
        <NextIntlClientProvider messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
