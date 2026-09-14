import { notFound } from 'next/navigation';
import { getRequestConfig } from 'next-intl/server';
import type { RequestConfig } from 'next-intl/server';

export const locales = ['en', 'fr', 'es'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

export default getRequestConfig(async ({ locale }): Promise<RequestConfig> => {
  if (!locale || !locales.includes(locale as Locale)) {
    notFound();
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
