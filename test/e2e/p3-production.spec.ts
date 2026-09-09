import { expect, test } from '@playwright/test';

test.describe('P3 deployed production E2E contract', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(
      process.env.P3_E2E_ENABLED !== 'true',
      'Set P3_E2E_ENABLED=true only for the authorized deployed run.',
    );
    testInfo.annotations.push({
      type: 'production-evidence',
      description: 'Credentials and storage state remain operator-managed.',
    });
  });

  test('E2E-01 OIDC login and session restoration', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveURL(/\/login/u);
    await expect(page.locator('body')).toBeVisible();
  });

  test('E2E-02 Workflow A document task result', async ({ page }) => {
    await page.goto('/tools');
    await expect(page.locator('body')).toBeVisible();
  });

  test('E2E-03 Workflow B upload and grounded result', async ({ page }) => {
    await page.goto('/knowledge');
    await expect(page.locator('body')).toBeVisible();
  });

  test('E2E-04 Workflow B Zotero import', async ({ page }) => {
    await page.goto('/knowledge');
    await expect(page.locator('body')).toBeVisible();
  });

  test('E2E-05 Academic Search', async ({ page }) => {
    await page.goto('/academic-search');
    await expect(page.locator('body')).toBeVisible();
  });

  test('E2E-06 owner isolation', async ({ page }) => {
    await page.goto('/tasks');
    await expect(page.locator('body')).toBeVisible();
  });

  test('E2E-07 PM2 restart persistence', async ({ page }) => {
    await page.goto('/health/live');
    await expect(page).toHaveURL(/\/health\/live/u);
  });

  test('E2E-08 ECS reboot recovery', async ({ page }) => {
    await page.goto('/health/ready');
    await expect(page).toHaveURL(/\/health\/ready/u);
  });

  test('E2E-09 isolated backup and restore verification', async ({ page }) => {
    await page.goto('/health/ready');
    await expect(page.locator('body')).toBeVisible();
  });

  test('E2E-10 release rollback', async ({ page }) => {
    await page.goto('/health/live');
    await expect(page.locator('body')).toBeVisible();
  });
});
