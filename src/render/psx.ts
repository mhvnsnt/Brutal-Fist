export interface PsxRenderOptions {
  enabled: boolean;
  renderWidth: number;
  renderHeight: number;
  vertexGrid: number;
  textureFilter: 'nearest';
}

export const DEFAULT_PSX_RENDER: PsxRenderOptions = {
  enabled: true,
  renderWidth: 320,
  renderHeight: 240,
  vertexGrid: 1 / 1024,
  textureFilter: 'nearest'
};

export function psxVertexSnap(position: { x: number; y: number; z: number }, grid = DEFAULT_PSX_RENDER.vertexGrid) {
  return {
    x: Math.round(position.x / grid) * grid,
    y: Math.round(position.y / grid) * grid,
    z: Math.round(position.z / grid) * grid
  };
}
