// capture.mjs — pure ESM, no TypeScript transpiler quirks
import { chromium } from 'playwright';
import { join, dirname } from 'path';
import { mkdirSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '../screenshots');
mkdirSync(OUT, { recursive: true });

const DASHBOARD = 'http://localhost:3000';
const TEMPLATE  = join(__dirname, '../RAQIB-Interface.html').replace(/\\/g, '/');

const ROUTES = [
  { name: 'home',      url: DASHBOARD + '/' },
  { name: 'missions',  url: DASHBOARD + '/missions' },
  { name: 'approvals', url: DASHBOARD + '/approvals' },
  { name: 'audit',     url: DASHBOARD + '/audit' },
  { name: 'settings',  url: DASHBOARD + '/settings' },
];

// Measure positions of key elements
const MEASURE_SCRIPT = `
(function() {
  function r(sel) {
    var el = document.querySelector(sel);
    if (!el) return null;
    var b = el.getBoundingClientRect();
    return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
  }
  return {
    header:    r('header.top'),
    leftRail:  r('.rail.l'),
    rightRail: r('.rail.r'),
    mid:       r('.mid') || r('.workspace-mid'),
    dock:      r('.dock'),
    cmdBar:    r('.cmd'),
    titleH1:   r('h1'),
    statusSl:  r('#sl'),
    workZone:  r('.workspace-zone'),
    shellCore: r('.shell-core'),
    stGrid:    r('.st'),
  };
})();
`;

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  // ── Template ────────────────────────────────────────────────────────
  const tpl = await ctx.newPage();
  await tpl.goto('file:///' + TEMPLATE, { waitUntil: 'networkidle' });
  await tpl.waitForTimeout(3500); // boot sequence
  await tpl.screenshot({ path: join(OUT, '0-template.png') });
  const tplLayout = await tpl.evaluate(MEASURE_SCRIPT);
  writeFileSync(join(OUT, '0-template-layout.json'), JSON.stringify(tplLayout, null, 2));
  console.log('\n── TEMPLATE ──');
  console.log(JSON.stringify(tplLayout, null, 2));
  await tpl.close();

  // ── Dashboard routes ────────────────────────────────────────────────
  for (const route of ROUTES) {
    const page = await ctx.newPage();
    await page.goto(route.url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: join(OUT, `1-${route.name}.png`) });
    const layout = await page.evaluate(MEASURE_SCRIPT);
    writeFileSync(join(OUT, `1-${route.name}-layout.json`), JSON.stringify(layout, null, 2));
    console.log(`\n── ${route.name.toUpperCase()} ──`);
    console.log(JSON.stringify(layout, null, 2));
    await page.close();
  }

  await browser.close();
  console.log('\n✓ Screenshots saved to:', OUT);
}

main().catch(e => { console.error(e); process.exit(1); });
