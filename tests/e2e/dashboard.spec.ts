import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';

test.describe('EPay Dashboard Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('landing page loads without errors', async ({ page }) => {
    await expect(page).toHaveTitle(/EPay/);

    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('landing page has no accessibility violations', async ({ page }) => {
    const accessibility = new AxeBuilder({ page });
    const results = await accessibility.analyze();

    expect(results.violations).toHaveLength(0);
  });

  test('navigation menu is accessible', async ({ page }) => {
    await expect(page.getByRole('link', { name: /Get Started/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Sign In/i })).toBeVisible();
  });
});

test.describe('Customer Dashboard', () => {
  test('dashboard loads correctly', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/Welcome to EPay/i)).toBeVisible();
  });

  test('dashboard has no accessibility violations', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const accessibility = new AxeBuilder({ page });
    const results = await accessibility.analyze();

    expect(results.violations).toHaveLength(0);
  });
});
