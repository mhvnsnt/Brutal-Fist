#!/usr/bin/env node
// repro_crash.cjs — Brutal-Fist fight-scene crash reproduction.
// Boot -> PRESS START -> ARCADE -> pick P1/P2 -> FIGHT -> CONFIRM STAGE -> fight.
// Captures ALL console text + pageerrors + crash events, screenshots each stage.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const outdir = '/home/hatch/workspace/brutalfist-fix/repro-shots';
fs.mkdirSync(outdir, { recursive: true });
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const exe = fs.existsSync(CHROME) ? CHROME : undefined;

(async () => {
  const browser = await chromium.launch({ executablePath: exe,
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const logs = [];
  page.on('pageerror', e => logs.push('PAGEERROR: ' + String(e).slice(0, 300)));
  page.on('crash', () => logs.push('*** PAGE CRASHED ***'));
  page.on('console', m => {
    const t = m.text();
    if (m.type() === 'error' || /shader|VALIDATE|WebGLProgram|tripo/i.test(t))
      logs.push(`CONSOLE-${m.type()}: ` + t.slice(0, 300));
  });
  const shot = async (n) => { try { await page.screenshot({ path: path.join(outdir, n) }); console.log('SHOT', n); } catch(e){ console.log('SHOT-FAIL', n, String(e).slice(0,80)); } };
  const clickBtn = async (re, label) => {
    const ok = await page.evaluate((rs) => {
      const b = [...document.querySelectorAll('button')].find(x => new RegExp(rs, 'i').test((x.textContent || '').trim()));
      if (b) { b.click(); return (b.textContent || '').trim().slice(0, 30); } return null;
    }, re.source);
    console.log(label, '->', ok); return !!ok;
  };
  try {
    await page.goto('http://127.0.0.1:8080/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(25000);
    await shot('r1-boot.png');
    await clickBtn(/press start/, 'press-start');
    await page.waitForTimeout(3000);
    await clickBtn(/^arcade/, 'arcade');
    await page.waitForTimeout(9000);
    await shot('r2-select.png');
    // pick two fighters by clicking cards (coords from argv or default STATIC/VIPER)
    const c1 = (process.argv[2] || '180,550').split(',').map(Number);
    const c2 = (process.argv[3] || '290,550').split(',').map(Number);
    await page.mouse.click(c1[0], c1[1]); await page.waitForTimeout(1200);
    await page.mouse.click(c2[0], c2[1]); await page.waitForTimeout(1200);
    await shot('r3-picked.png');
    await clickBtn(/fight/, 'fight-btn');
    await page.waitForTimeout(6000);
    await shot('r4-stage.png');
    await clickBtn(/confirm stage/, 'confirm-stage');
    await page.waitForTimeout(12000);
    await shot('r5-fight.png');
    await page.waitForTimeout(10000);
    await shot('r6-fight-late.png');
    const st = await page.evaluate(() => ({ canvases: document.querySelectorAll('canvas').length,
      closed: false,
      txt: (document.body.innerText || '').slice(0, 200).replace(/\n+/g, ' | ') })).catch(() => ({ closed: true }));
    console.log('STATE:', JSON.stringify(st));
  } catch (e) { console.log('FATAL:', String(e).slice(0, 200)); logs.push('FATAL: ' + String(e).slice(0,200)); }
  console.log('=== LOGS (' + logs.length + ') ===');
  logs.slice(0, 40).forEach(l => console.log(l));
  fs.writeFileSync(path.join(outdir, 'repro-logs.json'), JSON.stringify(logs, null, 1));
  await browser.close();
})();
