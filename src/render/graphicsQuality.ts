import { RENDER_PROFILES, type RenderQualityMode, type PsxRenderOptions } from './psx';

const STORAGE_KEY = 'bf-graphics-quality';

/** PS1 (Maime ~18k tris, nearest, vertex snap) is the default. 8-bit and high-res are options. */
export const GRAPHICS_LABELS: Record<RenderQualityMode, string> = {
  ps1: 'PS1 3D (default · Maime)',
  retro8: '8-BIT',
  native: 'HIGH RES',
};

export function getGraphicsQuality(): RenderQualityMode {
  if (typeof window === 'undefined') return 'ps1';
  const v = window.localStorage.getItem(STORAGE_KEY);
  if (v === 'retro8' || v === 'native' || v === 'ps1') return v;
  return 'ps1';
}

export function setGraphicsQuality(mode: RenderQualityMode): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, mode);
}

export function getActiveRenderProfile(): PsxRenderOptions {
  return RENDER_PROFILES[getGraphicsQuality()];
}

export function shouldApplyPsxShader(): boolean {
  return getGraphicsQuality() !== 'native';
}
