import type { Page } from '@playwright/test';

export function requireStorageStatePath(user: 'A' | 'B'): string {
  const variable = user === 'A'
    ? 'P3_STORAGE_STATE_USER_A'
    : 'P3_STORAGE_STATE_USER_B';
  const value = process.env[variable];
  if (!value) {
    throw new Error(variable + ' must point to operator-managed storage state.');
  }
  return value;
}

export async function assertAuthenticated(page: Page): Promise<void> {
  await page.goto('/tools');
  await page.waitForLoadState('domcontentloaded');
  if (page.url().includes('/login')) {
    throw new Error('External operator-managed storage state is not authenticated.');
  }
}
