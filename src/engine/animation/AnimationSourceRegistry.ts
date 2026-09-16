/**
 * Animation source registry for the browser combat lane.
 *
 * IMPORTANT: this registry contains SOURCE DESCRIPTORS, not copied proprietary
 * animation binaries. Bannon's authored motion JSON may be consumed directly
 * when its files are present/authorized. Tekken/Schwarzerblitz/NightSky are
 * integration/tooling sources unless the project has an independently
 * redistributable animation asset.
 */

export type AnimationSourceKind = 'BANNON_JSON' | 'GLB' | 'FBX' | 'BVH' | 'TOOLING_ONLY';

export interface AnimationSourceDescriptor {
  id: string;
  kind: AnimationSourceKind;
  root: string;
  notes: string;
  permittedForRuntimeCopy: boolean;
}

export const ANIMATION_SOURCE_REGISTRY: readonly AnimationSourceDescriptor[] = [
  {
    id: 'bannon-motion-bank',
    kind: 'BANNON_JSON',
    root: 'assets/moves/clips/',
    notes: 'Bannon-authored motion JSON. Converts to Three AnimationClip through BannonClipJsonAdapter.',
    permittedForRuntimeCopy: true,
  },
  {
    id: 'bannon-rig-reference',
    kind: 'GLB',
    root: 'assets/models/BANNON_rigged.glb',
    notes: 'Reference authored 28-joint Bannon rig used for skeleton conventions and validation.',
    permittedForRuntimeCopy: true,
  },
  {
    id: 'schwarzerblitz-engine',
    kind: 'TOOLING_ONLY',
    root: 'SchwarzerblitzEngine',
    notes: 'Open-source engine/reference integration. Repository license does not grant redistribution rights for its character/stage/music assets.',
    permittedForRuntimeCopy: false,
  },
  {
    id: 'nightsky-engine',
    kind: 'TOOLING_ONLY',
    root: 'NightSkyEngine',
    notes: 'Open-source fighting-game framework/reference for animation/state/authoring integration; import only assets separately authorized for Brutal-Fist.',
    permittedForRuntimeCopy: false,
  },
  {
    id: 'tekken-animation-tools',
    kind: 'TOOLING_ONLY',
    root: 'Tekken animation tooling',
    notes: 'Use open-source importer/retargeting tooling where compatible. Do not copy proprietary Tekken animation binaries/assets unless independently licensed or supplied by the project owner.',
    permittedForRuntimeCopy: false,
  },
];

export function getRuntimeAnimationSources(): AnimationSourceDescriptor[] {
  return ANIMATION_SOURCE_REGISTRY.filter((source) => source.permittedForRuntimeCopy);
}
