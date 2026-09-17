/**
 * Bake GLB-accurate select-grid plates from the live capture-bust page.
 * Writes public/portraits/likeness/{id}.png and a painted grade of the same bust.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.BF_CAPTURE_BASE ?? 'http://127.0.0.1:8080';
const OUT_LIKE = join(process.cwd(), 'public/portraits/likeness');
const OUT_PAINT = join(process.cwd(), 'public/portraits/painted');
mkdirSync(OUT_LIKE, { recursive: true });
mkdirSync(OUT_PAINT, { recursive: true });

const ROSTER = [
  ['bannon', 'BANNON_rigged.glb'],
  ['maime', 'MAIME_skinned.glb'],
  ['onyx', 'ONYX_street.glb'],
  ['cain_elias', 'CAIN_ELIAS_ring.glb'],
  ['cipher', 'CIPHER.glb'],
  ['stick_up', 'STICKUP.glb'],
  ['echo', 'ECHO.glb'],
  ['cody', 'CODY_sober.glb'],
  ['hall_nighter', 'HALL_NIGHTER.glb'],
  ['static', 'STATIC.glb'],
  ['viper', 'VIPER.glb'],
  ['kobra', 'KOBRA.glb'],
  ['aaron_ruben', 'AARON_RUBEN.glb'],
  ['hollow', 'HOLLOW.glb'],
  ['edwin_kennedy', 'EDWIN_KENNEDY.glb'],
  ['pablo', 'PABLO.glb'],
  ['tyneshia', 'TYNESHIA.glb'],
  ['triple_xxx', 'TRIPLE_XXX.glb'],
  ['el_toro_de_oro', 'EL_TORO_DE_ORO.glb'],
  ['stan_combs', 'STAN_COMBS_gear.glb'],
  ['brutus', 'BRUTUS.glb'],
  ['titan', 'TITAN.glb'],
  ['master_sensei', 'MASTER_SENSEI.glb'],
  ['wreck_patterson', 'WRECK_PATTERSON.glb'],
  ['jager', 'JAGER.glb'],
  ['finxsse', 'NPC_FINXSSE.glb'],
  ['tarzanian_devil', 'TARZANIAN_DEVIL_skinned.glb'],
];

function paintFromPng(pngBuf) {
  // Keep the GLB pixels; wrap as JPEG so the painted slot is the same likeness,
  // not a regenerated face. Stylize at runtime with CSS if needed.
  return pngBuf;
}

const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-gpu'] });
const page = await browser.newPage({ viewport: { width: 512, height: 640 } });
const results = [];

for (const [id, model] of ROSTER) {
  const url = `${BASE}/capture-bust.html?model=${encodeURIComponent(model)}&yaw=${Math.PI}`;
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForFunction(() => window.__BF_CAPTURE_READY === true, { timeout: 25000 });
    await page.waitForTimeout(250);
    const buf = await page.locator('canvas').first().screenshot({ type: 'png' });
    const likePath = join(OUT_LIKE, `${id}.png`);
    writeFileSync(likePath, buf);
    const paintPath = join(OUT_PAINT, `${id}.jpg`);
    // Also write PNG bytes as the painted plate source; convert via canvas in-page.
    const jpg = await page.evaluate(async () => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return null;
      const off = document.createElement('canvas');
      off.width = 512;
      off.height = 640;
      const ctx = off.getContext('2d');
      ctx.filter = 'contrast(1.12) saturate(1.18) brightness(1.02)';
      ctx.drawImage(canvas, 0, 0);
      const g = ctx.createRadialGradient(256, 280, 80, 256, 320, 420);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(8,6,4,0.45)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 512, 640);
      ctx.filter = 'none';
      ctx.fillStyle = 'rgba(250, 204, 21, 0.08)';
      ctx.fillRect(0, 600, 512, 40);
      return off.toDataURL('image/jpeg', 0.88);
    });
    if (jpg) {
      const b64 = jpg.split(',')[1];
      writeFileSync(paintPath, Buffer.from(b64, 'base64'));
    }
    results.push({ id, model, ok: true, bytes: buf.length });
    console.log('captured', id, buf.length);
  } catch (err) {
    results.push({ id, model, ok: false, error: String(err) });
    console.error('FAIL', id, err);
  }
}

writeFileSync('/tmp/likeness-capture.json', JSON.stringify(results, null, 2));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`done ${results.length - failed.length}/${results.length}  failed=${failed.length}`);
if (failed.length) process.exitCode = 1;
