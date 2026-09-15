import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';

import { Providers } from './providers';
import './globals.css';

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
  // The locale comes from `i18n/request.ts` (no locale-prefixed routing), so
  // there is no URL segment to validate. This previously called `notFound()`
  // whenever the locale did not come back as one of the supported values, which
  // — with no middleware matching these routes — was every request.
  const locale = await getLocale();
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
