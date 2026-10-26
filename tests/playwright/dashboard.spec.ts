import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('RAQIB Dashboard & Cors Verification', () => {
  test('navigates dashboard pages, verifies CORS status fetch and captures screenshots', async ({ page }) => {
    const consoleLogs: string[] = [];
    const consoleErrors: string[] = [];
    const requestErrors: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      } else {
        consoleLogs.push(msg.text());
      }
    });

    page.on('requestfailed', req => {
      requestErrors.push(`${req.url()} failed: ${req.failure()?.errorText}`);
    });

    // 1. Overview page
    await page.goto('http://localhost:3000');
    await page.waitForSelector('#runtime-status-badge');

    const statusBadgeText = await page.locator('#runtime-status-badge').innerText();
    expect(statusBadgeText).toBe('OK');

    await page.screenshot({ path: 'reports/screenshots/01-overview.png' });

    // 2. Missions page
    await page.click('text=Missions');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'reports/screenshots/02-missions.png' });

    // 3. Approvals page
    await page.click('text=Approbations');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'reports/screenshots/03-approvals.png' });

    // 4. Audit page
    await page.click('text=Audit Ledger');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'reports/screenshots/04-audit.png' });

    // 5. Settings / Emergency page
    await page.click('text=Paramètres & Urgence');
    await page.waitForSelector('#btn-activate-emergency');
    await page.screenshot({ path: 'reports/screenshots/05-settings-initial.png' });

    // Trigger Emergency Stop
    await page.click('#btn-activate-emergency');
    await page.waitForSelector('#emergency-toggle-message');
    const msgText = await page.locator('#emergency-toggle-message').innerText();
    expect(msgText).toMatch(/ACTIF/);

    await page.screenshot({ path: 'reports/screenshots/06-settings-emergency-active.png' });

    // Reset Emergency Stop
    await page.click('#btn-deactivate-emergency');
    await page.waitForTimeout(500);

    expect(consoleErrors.filter(e => e.includes('ERR_CONNECTION_REFUSED'))).toHaveLength(0);
  });
});
