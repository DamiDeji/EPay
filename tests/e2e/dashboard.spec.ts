import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Load a page, trigger every scroll-revealed animation, and settle.
 *
 * Sections animate in from `opacity: 0`, and the ones below the fold only start
 * when scrolled into view (`whileInView`). Scanning without scrolling measures
 * half-faded or never-revealed text and reports contrast failures that are not
 * present on the rendered page — the results flip between runs depending on
 * which animations happened to fire. Scrolling the whole page first makes the
 * scan deterministic, and scanning content that has actually rendered.
 */
async function settle(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('body')).toBeVisible();

  await page.evaluate(async () => {
    const step = window.innerHeight;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    window.scrollTo(0, 0);
  });

  // Let the reveal transitions (0.6s) finish at full opacity.
  await page.waitForTimeout(1200);
}

/**
 * A JWT-shaped access token whose `exp` is in the future.
 *
 * The dashboard layout decides whether to render the shell or redirect to the
 * login page, and it reads `exp` from the token. Nothing here is signed: the
 * client does not verify signatures (the API does), it only checks that the
 * token exists and has not expired.
 */
function liveToken(): string {
  const encode = (value: unknown): string =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: 'e2e', exp })}.signature`;
}

function expiredToken(): string {
  const encode = (value: unknown): string =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) - 3600;
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: 'e2e', exp })}.signature`;
}

test.describe('EPay landing page', () => {
  test('loads without console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/');
    await expect(page).toHaveTitle(/EPay/);
    await page.waitForLoadState('networkidle');

    expect(errors.filter((e) => !e.includes('favicon'))).toHaveLength(0);
  });

  test('exposes the primary calls to action', async ({ page }) => {
    await page.goto('/');

    // Scoped to the navigation landmark: the hero repeats the CTA, and an
    // unscoped by-name lookup would match both.
    const nav = page.getByRole('navigation');
    const viewport = page.viewportSize();

    if ((viewport?.width ?? 0) >= 768) {
      await expect(nav.getByRole('link', { name: 'Sign In', exact: true })).toBeVisible();
      await expect(nav.getByRole('link', { name: 'Get Started', exact: true })).toBeVisible();
    } else {
      // Below the `md` breakpoint the desktop group is `display: none`, and
      // hidden elements are absent from the accessibility tree — the CTAs live
      // in a drawer behind the menu toggle instead.
      await nav.getByRole('button', { name: 'Open menu' }).click();
      await expect(nav.getByRole('link', { name: 'Sign In', exact: true })).toBeVisible();
      await expect(nav.getByRole('link', { name: 'Get Started', exact: true })).toBeVisible();
    }

    await expect(page.getByRole('link', { name: /Get Started Free/i })).toBeVisible();
  });

  test('has no accessibility violations', async ({ page }) => {
    await settle(page, '/');

    // The scan is retried rather than sampled once. Even after `settle`, a
    // background tab or a busy worker can catch a reveal transition mid-flight,
    // and axe measures the *blended* colour of a half-faded element — which
    // reports contrast failures that do not exist on the rendered page. Failing
    // on a specific instant made this test flaky under parallel load.
    //
    // A real violation is permanent, so it still fails here after the timeout.
    await expect
      .poll(async () => (await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id), {
        timeout: 20_000,
        message: 'the landing page should be violation-free once the reveal animations finish',
      })
      .toEqual([]);
  });
});

test.describe('Customer dashboard route guard', () => {
  test('sends an anonymous visitor to the login page', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/login/);
    // The dashboard heading must never be painted for a visitor with no session.
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeHidden();
  });

  test('sends a visitor with an expired token to the login page', async ({ page }) => {
    await page.addInitScript((token) => {
      localStorage.setItem('epay_access_token', token);
    }, expiredToken());

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/login/);
  });

  test('renders the dashboard for a visitor with a live session', async ({ page }) => {
    await page.addInitScript((token) => {
      localStorage.setItem('epay_access_token', token);
    }, liveToken());

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });
});
