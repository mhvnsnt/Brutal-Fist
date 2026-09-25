declare module 'culori' {
  export type Oklch = { mode: 'oklch'; l?: number; c?: number; h?: number };
  export type Rgb = { mode: 'rgb'; r: number; g: number; b: number };
  export type Color = { mode: string; r?: number; g?: number; b?: number; l?: number; c?: number; h?: number };

  export function parse(color: string): Color | undefined;
  export function converter(mode: 'oklch'): (color: Color) => Oklch | undefined;
  export function converter(mode: 'rgb'): (color: Color | Oklch) => Rgb | undefined;
}
