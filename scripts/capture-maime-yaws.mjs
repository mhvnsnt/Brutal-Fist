import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const BASE = 'http://127.0.0.1:8080';
const yaws = [
  ['0', 0],
  ['p45', Math.PI / 4],
  ['m45', -Math.PI / 4],
  ['p90', Math.PI / 2],
  ['m90', -Math.PI / 2],
  ['p135', 3 * Math.PI / 4],
  ['m135', -3 * Math.PI / 4],
  ['180', Math.PI],
];

const browser = await chromium.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 512, height: 640 } });

for (const [name, yaw] of yaws) {
  const url = `${BASE}/capture-bust.html?model=${encodeURIComponent('MAIME_skinned.glb')}&yaw=${yaw}`;
  console.log('capturing', name, yaw);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForFunction(() => window.__BF_CAPTURE_READY === true, { timeout: 25000 });
  await page.waitForTimeout(400);
  const buf = await page.locator('canvas').first().screenshot({ type: 'png' });
  writeFileSync(`/tmp/maime-yaw/${name}.png`, buf);
  console.log('wrote', name, buf.length);
}

await browser.close();
console.log('done');
