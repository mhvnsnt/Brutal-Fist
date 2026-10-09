import type { FacePaintLayer, FacePaintPattern } from './types';
import { getRegion } from './regions';

/**
 * FacePaintPainter — renders a layer stack onto a 2D canvas in DECAL-UV space.
 * The canvas maps 1:1 to face space (0..1, y 0 = forehead top). Patterns are
 * authored in face space, tinted per layer, clipped to the layer's region.
 * 'erase' layers punch transparency (revealing the real skin mesh beneath).
 *
 * The painter is DOM-canvas based (game runtime). The Python QC script mirrors
 * this exact math with PIL against the same regions.json + pattern PNGs.
 */
export class FacePaintPainter {
  readonly canvas: HTMLCanvasElement;
  private maskCanvas: HTMLCanvasElement;
  private tintCanvas: HTMLCanvasElement;
  private patternCache = new Map<string, HTMLImageElement>();
  readonly size: number;

  constructor(size = 1024) {
    this.size = size;
    this.canvas = document.createElement('canvas');
    this.canvas.width = size; this.canvas.height = size;
    this.maskCanvas = document.createElement('canvas');
    this.maskCanvas.width = size; this.maskCanvas.height = size;
    this.tintCanvas = document.createElement('canvas');
    this.tintCanvas.width = size; this.tintCanvas.height = size;
    this.clear();
  }

  clear(): void {
    const ctx = this.canvas.getContext('2d')!;
    ctx.clearRect(0, 0, this.size, this.size);
  }

  /**
   * Paint a layer stack. Patterns load on demand (cached). Resolves when done.
   * Layers apply in array order; each may target its own region/color/opacity.
   */
  async paint(
    layers: FacePaintLayer[],
    patternDefs: FacePaintPattern[],
    publicBase = '',
  ): Promise<HTMLCanvasElement> {
    this.clear();
    for (const layer of layers) {
      const def = patternDefs.find((p) => p.id === layer.pattern);
      if (!def) throw new Error(`Unknown face-paint pattern: ${layer.pattern}`);
      const img = await this.loadPattern(def.file, publicBase);
      this.drawLayer(layer, img);
    }
    return this.canvas;
  }

  private loadPattern(file: string, publicBase: string): Promise<HTMLImageElement> {
    const key = publicBase + file;
    const hit = this.patternCache.get(key);
    if (hit) return Promise.resolve(hit);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => { this.patternCache.set(key, img); resolve(img); };
      img.onerror = () => reject(new Error(`Failed to load face-paint pattern: ${key}`));
      img.src = (publicBase ? publicBase.replace(/\/$/, '') + '/' : '') + file;
    });
  }

  private drawLayer(layer: FacePaintLayer, patternImg: HTMLImageElement): void {
    const S = this.size;
    const region = getRegion(layer.region);
    const fx = (x: number) => x * S;
    const fy = (y: number) => y * S;

    // 1. Region mask (white shapes, feathered).
    const mctx = this.maskCanvas.getContext('2d')!;
    mctx.clearRect(0, 0, S, S);
    mctx.fillStyle = '#fff';
    for (const s of region.shapes) {
      const cx = fx(s.cx), cy = fy(s.cy);
      const rx = s.rx * S, ry = s.ry * S;
      const featherPx = Math.max(1, (s.feather ?? 0.25) * Math.min(rx, ry));
      mctx.save();
      mctx.filter = `blur(${featherPx.toFixed(1)}px)`;
      mctx.beginPath();
      if (s.kind === 'ellipse') mctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      else mctx.rect(cx - rx, cy - ry, rx * 2, ry * 2);
      mctx.fill();
      mctx.restore();
    }

    // 2. Tinted pattern sprite (face-space: full canvas), with layer transform.
    const tctx = this.tintCanvas.getContext('2d')!;
    tctx.clearRect(0, 0, S, S);
    const scale = layer.scale ?? 1;
    const dw = S * scale, dh = S * scale;
    const sprite = document.createElement('canvas');
    sprite.width = Math.max(1, Math.round(dw));
    sprite.height = Math.max(1, Math.round(dh));
    const sctx = sprite.getContext('2d')!;
    sctx.fillStyle = layer.color;
    sctx.fillRect(0, 0, sprite.width, sprite.height);
    sctx.globalCompositeOperation = 'destination-in';
    sctx.drawImage(patternImg, 0, 0, sprite.width, sprite.height);
    tctx.save();
    tctx.translate(S / 2 + (layer.dx ?? 0) * S, S / 2 + (layer.dy ?? 0) * S);
    if (layer.rotation) tctx.rotate(layer.rotation);
    tctx.globalAlpha = Math.max(0, Math.min(1, layer.opacity));
    tctx.drawImage(sprite, -dw / 2, -dh / 2, dw, dh);
    tctx.restore();

    // 3. Clip tinted pattern to region, stamp onto the paint canvas.
    tctx.save();
    tctx.globalCompositeOperation = 'destination-in';
    tctx.drawImage(this.maskCanvas, 0, 0);
    tctx.restore();

    const pctx = this.canvas.getContext('2d')!;
    pctx.save();
    pctx.globalCompositeOperation = layer.blend === 'erase' ? 'destination-out' : 'source-over';
    pctx.drawImage(this.tintCanvas, 0, 0);
    pctx.restore();
  }
}
