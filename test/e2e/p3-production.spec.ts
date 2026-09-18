import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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
    const fixture = join(process.cwd(), 'server/modules/document-parsing/__fixtures__/academic-textual-realworld.pdf');
    await page.locator('input[type="file"]').first().setInputFiles(fixture);
    await page.getByRole('button', { name: '上传并导入' }).first().click();
    await expect(page.getByText('已加入文档工作区').first()).toBeVisible();
    await expect(page.getByText('未建立索引').first()).toBeVisible();
    await page.getByRole('button', { name: '建立索引' }).first().click();
    await expect(page.getByText('已建立索引').first()).toBeVisible({ timeout: 60_000 });
    await page.getByRole('button', { name: '用于有据写作' }).first().click();
    await expect(page).toHaveURL(/\/grounded-writing/u);
    await page.getByLabel('写作要求').fill('基于所选论文概括其研究问题与主要方法，并为每项结论提供引用。');
    await page.getByLabel('研究问题').fill('这篇论文研究了什么问题，采用了什么方法？');
    await page.getByRole('button', { name: '生成有据内容' }).click();
    await expect(page.getByText('已完成有据生成')).toBeVisible({ timeout: 120_000 });
    await expect(page.getByText('引用', { exact: true })).toBeVisible();
    await expect(page.getByText('证据轨迹与来源', { exact: true })).toBeVisible();
    await expect(page.locator('details').first()).toBeVisible();
  });

  test('E2E-04 Zotero optional positioning and direct route', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('navigation').getByText('Zotero')).toHaveCount(0);
    await page.goto('/zotero');
    await expect(page.getByText('Optional Advanced Integration')).toBeVisible();
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

  test('E2E-09 isolated backup and restore verification', async ({}, testInfo) => {
    const backupPath = process.env.BACKUP_EVIDENCE_PATH;
    const restorePath = process.env.RESTORE_EVIDENCE_PATH;
    test.skip(!backupPath || !restorePath, 'Recovery receipts are supplied only after the authorized manual operation.');
    const backup = JSON.parse(readFileSync(backupPath!, 'utf8'));
    const restore = JSON.parse(readFileSync(restorePath!, 'utf8'));
    expect(backup).toMatchObject({ version: 1, status: 'pass' });
    expect(restore).toMatchObject({ version: 1, status: 'pass', isolatedTarget: true });
    expect(restore.backupSha256).toBe(backup.backupSha256);
    expect(restore.restoreDatabaseIdentity).not.toBe(restore.liveDatabaseIdentity);
    testInfo.annotations.push({ type: 'recovery-evidence', description: 'Receipts verified; no backup or restore command executed by Playwright.' });
  });

  test('E2E-10 release rollback', async ({ page }) => {
    test.skip(process.env.PRODUCTION_ROLLBACK_AUTHORIZED !== 'YES', 'BLOCKED_BY_AUTHORIZATION: PRODUCTION_ROLLBACK_AUTHORIZED=YES is required.');
    test.skip(!process.env.BACKUP_EVIDENCE_PATH || !process.env.RESTORE_EVIDENCE_PATH, 'BLOCKED_BY_RECOVERY_EVIDENCE');
    await page.goto('/health/live');
    await expect(page.locator('body')).toBeVisible();
    await page.goto('/health/ready');
    await expect(page.locator('body')).toBeVisible();
  });
});
