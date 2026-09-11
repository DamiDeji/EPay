import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('sign in page loads', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel(/Email Address/i)).toBeVisible();
    await expect(page.getByLabel(/Password/i)).toBeVisible();
  });

  test('sign up page loads', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByLabel(/Display Name/i)).toBeVisible();
    await expect(page.getByLabel(/Email Address/i)).toBeVisible();
  });
});
