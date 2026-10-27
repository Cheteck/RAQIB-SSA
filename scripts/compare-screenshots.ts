import { chromium } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

const OUT = path.join(__dirname, '../screenshots');
fs.mkdirSync(OUT, { recursive: true });

const DASHBOARD_BASE = 'http://localhost:3000';
const TEMPLATE_PATH  = path.join(__dirname, '../RAQIB-Interface.html');

const ROUTES = [
  { name: 'home',      url: DASHBOARD_BASE + '/' },
  { name: 'missions',  url: DASHBOARD_BASE + '/missions' },
  { name: 'approvals', url: DASHBOARD_BASE + '/approvals' },
  { name: 'audit',     url: DASHBOARD_BASE + '/audit' },
  { name: 'settings',  url: DASHBOARD_BASE + '/settings' },
];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  // 1. HTML template
  const tpl = await ctx.newPage();
  await tpl.goto('file://' + TEMPLATE_PATH, { waitUntil: 'networkidle' });
  await tpl.waitForTimeout(3200);
  await tpl.screenshot({ path: path.join(OUT, '0-template.png') });
  console.log('✓ template');

  // Measure key element positions in the template
  const tplLayout = await tpl.evaluate(() => {
    function r(sel: string) {
      const el = document.querySelector(sel);
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
    }
    return {
      header:    r('header.top'),
      leftRail:  r('.rail.l'),
      rightRail: r('.rail.r'),
      mid:       r('.mid'),
      dock:      r('.dock'),
      cmdBar:    r('.cmd'),
      titleH1:   r('h1'),
      statusSl:  r('#sl'),
    };
  });
  fs.writeFileSync(path.join(OUT, '0-template-layout.json'), JSON.stringify(tplLayout, null, 2));
  console.log('✓ template layout:', JSON.stringify(tplLayout, null, 2));
  await tpl.close();

  // 2. Dashboard routes
  for (const route of ROUTES) {
    const page = await ctx.newPage();
    await page.goto(route.url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1800);
    await page.screenshot({ path: path.join(OUT, `1-${route.name}.png`) });

    const layout = await page.evaluate(() => {
      function r(sel: string) {
        const el = document.querySelector(sel);
        if (!el) return null;
        const b = el.getBoundingClientRect();
        return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
      }
      return {
        header:       r('header.top'),
        leftRail:     r('.rail.l'),
        rightRail:    r('.rail.r'),
        mid:          r('.workspace-mid'),
        dock:         r('.dock'),
        cmdBar:       r('.cmd'),
        titleH1:      r('h1'),
        statusSl:     r('#sl'),
        workZone:     r('.workspace-zone'),
        shellCore:    r('.shell-core'),
      };
    });
    fs.writeFileSync(path.join(OUT, `1-${route.name}-layout.json`), JSON.stringify(layout, null, 2));
    console.log(`✓ ${route.name}:`, JSON.stringify(layout, null, 2));
    await page.close();
  }

  await browser.close();
  console.log('\nDone →', OUT);
}

main().catch(e => { console.error(e); process.exit(1); });
