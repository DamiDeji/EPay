import { getRequestConfig } from 'next-intl/server';
import type { RequestConfig } from 'next-intl/server';

/**
 * next-intl request configuration.
 *
 * This app runs next-intl in "without i18n routing" mode: the routes live at the
 * application root (`/login`, `/dashboard`, …) rather than under an
 * `app/[locale]/` segment, so the locale is fixed here instead of being derived
 * from the URL.
 *
 * The previous setup combined locale-prefixed routing (`localePrefix:
 * 'as-needed'` with a `middleware.ts` matcher) with a root-level route tree.
 * That combination cannot work: the middleware rewrote `/` to `/en`, which has
 * no route, and every other path failed the root layout's `hasLocale()` check
 * and called `notFound()`. The result was a 404 on **every** page of the
 * customer app.
 *
 * `messages/{en,fr,es}.json` are kept so that adding real localized routing
 * later is a matter of moving the routes under `app/[locale]/`, not of
 * re-authoring the copy.
 */
export const locales = ['en', 'fr', 'es'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

export default getRequestConfig(async (): Promise<RequestConfig> => ({
  locale: defaultLocale,
  messages: (await import(`../messages/${defaultLocale}.json`)).default,
}));
