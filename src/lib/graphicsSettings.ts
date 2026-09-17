import type { RenderQualityMode } from "@/render/psx";
import { RENDER_PROFILES, type PsxRenderOptions } from "@/render/psx";

const KEY = "bf-graphics-quality-v1";

export type GraphicsQuality = RenderQualityMode;

const DEFAULT_QUALITY: GraphicsQuality = "ps1";

function readStored(): GraphicsQuality {
  if (typeof window === "undefined") return DEFAULT_QUALITY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw === "ps1" || raw === "retro8" || raw === "native") return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_QUALITY;
}

let current: GraphicsQuality = DEFAULT_QUALITY;
const listeners = new Set<(q: GraphicsQuality) => void>();

if (typeof window !== "undefined") {
  current = readStored();
}

export function getGraphicsQuality(): GraphicsQuality {
  return current;
}

export function getActiveRenderProfile(): PsxRenderOptions {
  return RENDER_PROFILES[current];
}

export function setGraphicsQuality(next: GraphicsQuality) {
  current = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new CustomEvent("bf-graphics-quality", { detail: next }));
  }
  listeners.forEach((fn) => fn(next));
}

export function subscribeGraphicsQuality(fn: (q: GraphicsQuality) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export const GRAPHICS_QUALITY_LABELS: Record<GraphicsQuality, string> = {
  ps1: "PS1 DEFAULT",
  retro8: "8-BIT",
  native: "HIGH RES",
};

export const GRAPHICS_QUALITY_HELP: Record<GraphicsQuality, string> = {
  ps1: "Maime-style low-poly, vertex snap, nearest textures. Default Brutal Fist look.",
  retro8: "Chunkier 160×120 snap and 8-bit texture crunch on the same meshes.",
  native: "Full authored GLB, linear filtering, no vertex snap.",
};
