import type { FighterMotionState } from './AnimationController';

const aliases: Record<string, FighterMotionState> = {
  idle:'idle', stance:'idle', neutral:'idle',
  walk:'walkForward', walkforward:'walkForward', forwardwalk:'walkForward',
  walkback:'walkBackward', walkbackward:'walkBackward', backwalk:'walkBackward',
  strafeleft:'strafeLeft', sidestep_left:'strafeLeft', sidestepleft:'strafeLeft',
  straferight:'strafeRight', sidestep_right:'strafeRight', sidestepright:'strafeRight',
  crouch:'crouch', guard:'guard', block:'guard',
  jab:'lightAttack', punch:'lightAttack', lightattack:'lightAttack',
  heavyattack:'heavyAttack', heavy:'heavyAttack', kick:'heavyAttack',
  hit:'hit', hitreaction:'hit', knockdown:'knockdown', wake:'wake', wakeup:'wake'
};

export function normalizeClipState(name: string): FighterMotionState | null {
  const key=name.toLowerCase().replace(/[^a-z0-9_]/g,'');
  return aliases[key] ?? null;
}

export function mapAnimationClips<T extends { name: string }>(clips: T[]) {
  const mapped = new Map<FighterMotionState,T>();
  for (const clip of clips) {
    const state=normalizeClipState(clip.name);
    if (state && !mapped.has(state)) mapped.set(state,clip);
  }
  return mapped;
}
