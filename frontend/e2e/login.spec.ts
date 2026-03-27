import { expect, test } from '@playwright/test';

test.describe('صفحة تسجيل الدخول', () => {
  test('تعرض النموذج والعناوين الأساسية', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: 'تسجيل الدخول' })).toBeVisible();
    await expect(page.locator('#login-email')).toBeVisible();
    await expect(page.locator('#login-password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'تسجيل الدخول' })).toBeVisible();
  });
});
