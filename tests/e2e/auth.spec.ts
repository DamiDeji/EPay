import { expect, test } from '@playwright/test';

/**
 * Smoke tests for the customer authentication pages.
 *
 * Fields are located by placeholder rather than by label on purpose: the pages
 * render `<label>` text as a sibling of the input without `htmlFor`/`id`, so the
 * inputs have no accessible name and `getByLabel` cannot find them. Associating
 * those labels is tracked as a separate accessibility fix; asserting on the
 * placeholder keeps these tests honest about the markup that exists today
 * instead of encoding a selector that never matched.
 */
test.describe('Authentication pages', () => {
  test('sign in page loads', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByText(/Email Address/i).first()).toBeVisible();
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible();
    await expect(page.getByPlaceholder('••••••••')).toBeVisible();
  });

  test('sign up page loads', async ({ page }) => {
    await page.goto('/register');

    await expect(page.getByText(/Display Name/i).first()).toBeVisible();
    await expect(page.getByPlaceholder('John Doe')).toBeVisible();
  });

  test('sign in page reports a missing email instead of failing silently', async ({ page }) => {
    await page.goto('/login');

    // The form is client-side validated: submitting empty must not navigate.
    await page
      .getByRole('button', { name: /sign in/i })
      .first()
      .click();

    await expect(page).toHaveURL(/\/login/);
  });
});
