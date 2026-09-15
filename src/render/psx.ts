export type RenderQualityMode = 'retro8' | 'ps1' | 'native';

export interface PsxRenderOptions {
  mode: RenderQualityMode;
  enabled: boolean;
  renderWidth: number;
  renderHeight: number;
  vertexGrid: number;
  textureFilter: 'nearest' | 'linear';
  textureSize: number;
  quantizeScreenSpace: boolean;
}

export const RENDER_PROFILES: Record<RenderQualityMode, PsxRenderOptions> = {
  // Preserve the current deliberately chunky look as an optional mode.
  retro8: {
    mode: 'retro8', enabled: true, renderWidth: 160, renderHeight: 120,
    vertexGrid: 1 / 512, textureFilter: 'nearest', textureSize: 128,
    quantizeScreenSpace: true
  },
  // Target: low-poly late-90s 3D fighter, not NES/pixel-art.
  ps1: {
    mode: 'ps1', enabled: true, renderWidth: 320, renderHeight: 240,
    vertexGrid: 1 / 2048, textureFilter: 'nearest', textureSize: 256,
    quantizeScreenSpace: true
  },
  // Future higher-quality character presentation.
  native: {
    mode: 'native', enabled: false, renderWidth: 1280, renderHeight: 720,
    vertexGrid: 1 / 8192, textureFilter: 'linear', textureSize: 1024,
    quantizeScreenSpace: false
  }
};

export const DEFAULT_PSX_RENDER = RENDER_PROFILES.ps1;

export function psxVertexSnap(
  position: { x: number; y: number; z: number },
  grid = DEFAULT_PSX_RENDER.vertexGrid
) {
  return {
    x: Math.round(position.x / grid) * grid,
    y: Math.round(position.y / grid) * grid,
    z: Math.round(position.z / grid) * grid
  };
}

export function getRenderProfile(mode: RenderQualityMode): PsxRenderOptions {
  return RENDER_PROFILES[mode];
}
