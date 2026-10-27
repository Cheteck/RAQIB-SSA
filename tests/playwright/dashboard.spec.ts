import { test, expect } from '@playwright/test';

test.describe('RAQIB Dashboard Visual Verification', () => {
  test('captures screenshots of dashboard pages', async ({ page }) => {
    // 1. Overview page
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'reports/screenshots/01-overview.png' });

    // 2. Missions page
    await page.goto('http://localhost:3000/missions', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'reports/screenshots/02-missions.png' });

    // 3. Approvals page
    await page.goto('http://localhost:3000/approvals', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'reports/screenshots/03-approvals.png' });

    // 4. Audit page
    await page.goto('http://localhost:3000/audit', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'reports/screenshots/04-audit.png' });

    // 5. Settings / Emergency page
    await page.goto('http://localhost:3000/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'reports/screenshots/05-settings-initial.png' });
  });
});
