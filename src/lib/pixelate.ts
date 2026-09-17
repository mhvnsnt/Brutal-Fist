export function pixelateDataUrl(src: string, cells = 64): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const small = document.createElement("canvas");
      small.width = cells;
      small.height = cells;
      const sctx = small.getContext("2d");
      if (!sctx) {
        reject(new Error("no 2d"));
        return;
      }
      sctx.imageSmoothingEnabled = false;
      sctx.drawImage(img, 0, 0, cells, cells);
      const out = document.createElement("canvas");
      out.width = 256;
      out.height = 256;
      const octx = out.getContext("2d");
      if (!octx) {
        reject(new Error("no 2d"));
        return;
      }
      octx.imageSmoothingEnabled = false;
      octx.drawImage(small, 0, 0, 256, 256);
      resolve(out.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("image load failed"));
    img.src = src;
  });
}

/** Shrink a photo to a ControlNet-sized JPEG so the booth request stays under the payload cap. */
export function downscaleDataUrl(src: string, maxEdge = 768, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d");
      if (!ctx) {
        reject(new Error("no 2d"));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => reject(new Error("image load failed"));
    img.src = src;
  });
}

const KEY = "bf-booth-gallery-v1";
const MUG_KEY = "bf-select-mugs-v1";

export interface BoothShot {
  id: string;
  createdAt: number;
  mode: "portrait" | "stage";
  prompt: string;
  concept: string;
  pixel: string;
  fighterId?: string;
}

export function loadBoothGallery(): BoothShot[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as BoothShot[];
  } catch {
    return [];
  }
}

export function saveBoothShot(shot: BoothShot) {
  const next = [shot, ...loadBoothGallery()].slice(0, 24);
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function getSelectMugOverride(fighterId: string): string | null {
  try {
    const map = JSON.parse(localStorage.getItem(MUG_KEY) ?? "{}") as Record<string, string>;
    return map[fighterId] ?? null;
  } catch {
    return null;
  }
}

export function setSelectMugOverride(fighterId: string, concept: string) {
  const map = (() => {
    try {
      return JSON.parse(localStorage.getItem(MUG_KEY) ?? "{}") as Record<string, string>;
    } catch {
      return {};
    }
  })();
  map[fighterId] = concept;
  localStorage.setItem(MUG_KEY, JSON.stringify(map));
  window.dispatchEvent(new Event("bf-select-mugs"));
}
