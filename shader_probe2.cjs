#!/usr/bin/env node
// shader_probe.cjs — isolate the tripo_material shader failure.
// Renders BANNON.glb through the game's CharacterPipeline in plain three.js,
// capturing the FULL shader error text.
const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  const logs = [];
  page.on('pageerror', e => logs.push('PAGEERROR: ' + String(e).slice(0, 400)));
  page.on('console', m => {
    const t = m.text();
    if (/shader|VALIDATE|WebGLProgram|tripo|error/i.test(t)) logs.push(`CONSOLE-${m.type()}: ` + t.slice(0, 500));
  });
  await page.goto('http://127.0.0.1:8080/shader-probe2.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(20000);
  await page.screenshot({ path: '/home/hatch/workspace/brutalfist-fix/shader-probe2.png' });
  const info = await page.evaluate(() => window.__probe || 'NO-PROBE').catch(() => 'EVAL-FAIL');
  console.log('PROBE:', JSON.stringify(info).slice(0, 500));
  console.log('=== LOGS (' + logs.length + ') ===');
  logs.slice(0, 30).forEach(l => console.log(l));
  await browser.close();
})();
