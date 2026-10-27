import { chromium } from 'playwright';
import { join, dirname } from 'path';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(__dirname, '../screenshots'), { recursive: true });

const MEAS = function() {
  function r(s) {
    var e = document.querySelector(s);
    if (!e) return null;
    var b = e.getBoundingClientRect();
    return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
  }
  return {
    leftRail:  r('.rail.l'),
    mid:       r('.mid'),
    rightRail: r('.rail.r'),
    dock:      r('.dock'),
    tl:        r('.tl'),
    h1:        r('h1'),
    out:       r('#out'),
    canvas:    r('canvas'),
    overlay:   r('.module-overlay'),
  };
};

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  // Template reference
  const tpl = await ctx.newPage();
  const tplPath = join(__dirname, '../RAQIB-Interface.html').replace(/\\/g, '/');
  await tpl.goto('file:///' + tplPath, { waitUntil: 'networkidle' });
  await tpl.waitForTimeout(3500);
  await tpl.screenshot({ path: join(__dirname, '../screenshots/ref-template.png') });
  const tM = await tpl.evaluate(MEAS);
  console.log('\n── TEMPLATE ──');
  for (const [k, v] of Object.entries(tM)) console.log(`  ${k.padEnd(12)}`, v ? `x=${v.x} y=${v.y} w=${v.w} h=${v.h}` : 'null');
  await tpl.close();

  // Dashboard home
  const home = await ctx.newPage();
  await home.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await home.waitForTimeout(2000);
  await home.screenshot({ path: join(__dirname, '../screenshots/next-home.png') });
  const hM = await home.evaluate(MEAS);
  console.log('\n── NEXT HOME ──');
  for (const [k, v] of Object.entries(hM)) console.log(`  ${k.padEnd(12)}`, v ? `x=${v.x} y=${v.y} w=${v.w} h=${v.h}` : 'null');
  await home.close();

  // Dashboard missions
  const miss = await ctx.newPage();
  await miss.goto('http://localhost:3000/missions', { waitUntil: 'networkidle' });
  await miss.waitForTimeout(2000);
  await miss.screenshot({ path: join(__dirname, '../screenshots/next-missions.png') });
  const mM = await miss.evaluate(MEAS);
  console.log('\n── NEXT MISSIONS ──');
  for (const [k, v] of Object.entries(mM)) console.log(`  ${k.padEnd(12)}`, v ? `x=${v.x} y=${v.y} w=${v.w} h=${v.h}` : 'null');
  await miss.close();

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
