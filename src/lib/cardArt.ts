export type CardArtStyle = "likeness" | "painted" | "concept" | "pixel";

const KEY = "bf-card-art-style-v2";

export const CARD_ART_LABELS: Record<CardArtStyle, string> = {
  likeness: "GLB LIKENESS",
  painted: "PAINTED CARD",
  concept: "CONCEPT ART",
  pixel: "8-BIT SPRITE",
};

function readMap(): Record<string, CardArtStyle> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Record<string, CardArtStyle>;
  } catch {
    return {};
  }
}

export function getCardArtStyle(fighterId: string): CardArtStyle {
  const value = readMap()[fighterId];
  if (value === "likeness" || value === "painted" || value === "concept" || value === "pixel") {
    return value;
  }
  return "concept";
}

export function setCardArtStyle(fighterId: string, style: CardArtStyle) {
  if (typeof window === "undefined") return;
  const map = readMap();
  map[fighterId] = style;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent("bf-card-art", { detail: { fighterId, style } }));
}

export function cardArtUrlFor(
  fighterId: string,
  urls: {
    likenessUrl?: string;
    paintedUrl?: string;
    conceptArtUrl?: string;
    pixelPortrait?: string;
    selectMugUrl?: string;
    gridPortrait?: string;
  },
  style = getCardArtStyle(fighterId),
): string {
  const concept = urls.conceptArtUrl ?? `/portraits/concept/${fighterId}.jpg?v=ai3`;
  const likeness = urls.likenessUrl ?? `/portraits/likeness/${fighterId}.png?v=glb1`;
  const painted = urls.paintedUrl ?? concept;
  const pixel = urls.pixelPortrait ?? `/portraits/pixel/${fighterId}.png`;
  switch (style) {
    case "likeness":
      return likeness;
    case "painted":
      return painted;
    case "concept":
      return concept;
    case "pixel":
      return pixel;
    default:
      return concept;
  }
}
