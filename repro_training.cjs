#!/usr/bin/env node
// repro_training.cjs — Brutal-Fist TRAINING mode crash reproduction.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const outdir = '/home/hatch/workspace/brutalfist-fix/repro-shots-training';
fs.mkdirSync(outdir, { recursive: true });
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const exe = fs.existsSync(CHROME) ? CHROME : undefined;
(async () => {
  const browser = await chromium.launch({ executablePath: exe,
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--max-old-space-size=4096'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const logs = [];
  page.on('pageerror', e => logs.push('PAGEERROR: ' + String(e).slice(0, 300)));
  page.on('crash', () => logs.push('*** PAGE CRASHED ***'));
  page.on('console', m => {
    const t = m.text();
    if (m.type() === 'error' || /shader|VALIDATE|WebGLProgram|tripo/i.test(t))
      logs.push(`CONSOLE-${m.type()}: ` + t.slice(0, 300));
  });
  page.on('response', r => { if (r.status() === 404) logs.push('HTTP404: ' + r.url().slice(0, 120)); });
  const shot = async (n) => { try { await page.screenshot({ path: path.join(outdir, n), timeout: 90000 }); console.log('SHOT', n); } catch(e){ console.log('SHOT-FAIL', n, String(e).slice(0,80)); } };
  const clickText = async (re, label) => {
    const ok = await page.evaluate((rs) => {
      const b = [...document.querySelectorAll('button')].find(x => new RegExp(rs, 'i').test((x.textContent || '').trim()));
      if (b) { b.click(); return (b.textContent || '').trim().slice(0, 40); } return null;
    }, re.source);
    console.log(label, '->', ok); return !!ok;
  };
  try {
    await page.goto('http://127.0.0.1:8080/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(25000);
    await shot('t1-boot.png');
    await clickText(/press start/i, 'press-start');
    await page.waitForTimeout(3000);
    await clickText(/^training/i, 'training');
    await page.waitForTimeout(9000);
    await shot('t2-training-select.png');
    // click first character card
    await page.evaluate(() => {
      const cards = [...document.querySelectorAll('button')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 60 && r.width < 300 && r.height > 60 && r.y > 300; });
      if (cards[0]) cards[0].click();
    });
    await page.waitForTimeout(2000);
    await shot('t3-picked.png');
    // scroll to bottom to find the start button
    const startBtn = await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
      const btns = [...document.querySelectorAll('button')];
      const b = btns.find(x => /start|begin|fight|enter/i.test((x.textContent || '').trim()) && (x.textContent || '').trim().length < 40);
      if (b) { b.scrollIntoView({block:'center'}); return (b.textContent || '').trim().slice(0, 40); }
      return 'NOT-FOUND:' + btns.map(x => (x.textContent||'').trim().slice(0,20)).join('|').slice(0,200);
    });
    console.log('start-btn:', startBtn);
    await page.waitForTimeout(1000);
    await shot('t3b-scrolled.png');
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => /start|begin|fight|enter/i.test((x.textContent || '').trim()) && (x.textContent || '').trim().length < 40);
      if (b) b.click();
    });
    console.log('clicked start');
    await page.waitForTimeout(15000);
    await shot('t4-fight.png');
    for (const k of ['a', 'd', 'j', 'k']) { try { await page.keyboard.press(k); } catch(e){} await page.waitForTimeout(800); }
    await shot('t5-inputs.png');
    const st = await page.evaluate(() => ({ canvases: document.querySelectorAll('canvas').length,
      txt: (document.body.innerText || '').slice(0, 200).replace(/\n+/g, ' | ') })).catch(() => ({ closed: true }));
    console.log('STATE:', JSON.stringify(st));
  } catch (e) { console.log('FATAL:', String(e).slice(0, 200)); logs.push('FATAL: ' + String(e).slice(0,200)); }
  console.log('=== LOGS (' + logs.length + ') ===');
  logs.slice(0, 40).forEach(l => console.log(l));
  fs.writeFileSync(path.join(outdir, 'repro-logs.json'), JSON.stringify(logs, null, 1));
  await browser.close();
})();
