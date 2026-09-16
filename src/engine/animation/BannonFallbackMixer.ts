import * as THREE from 'three';
import { loadBannonAnimation } from './BannonClipRuntime';

interface FallbackState {
  loading: boolean;
  ready: boolean;
  actions: Map<string, THREE.AnimationAction>;
  current: string | null;
  previousPosition: THREE.Vector3;
  initializedPosition: boolean;
}

const states = new WeakMap<THREE.AnimationMixer, FallbackState>();
let installed = false;

const CLIPS = ['BOX_IDLE', 'DRUNK_WALK', 'COMBO_PUNCH', 'BIG_BODY_BLOW', 'CENTER_BLOCK', 'BIG_RIB_HIT'];

function hasNativeActions(mixer: THREE.AnimationMixer): boolean {
  const internal = mixer as unknown as { _actions?: THREE.AnimationAction[] };
  return (internal._actions?.length ?? 0) > 0;
}

async function loadFallbackActions(mixer: THREE.AnimationMixer, root: THREE.Object3D, state: FallbackState) {
  if (state.loading || state.ready) return;
  state.loading = true;

  try {
    const loaded = await Promise.all(CLIPS.map(async name => [name, await loadBannonAnimation(root, name)] as const));
    for (const [name, clip] of loaded) {
      if (!clip) continue;
      const action = mixer.clipAction(clip);
      action.enabled = true;
      state.actions.set(name, action);
    }
    state.ready = state.actions.size > 0;
    if (state.ready) {
      console.log(`[BannonAnimation] fallback-ready root=${root.name || root.uuid} clips=${state.actions.size}`);
    }
  } finally {
    state.loading = false;
  }
}

function selectFallbackAction(mixer: THREE.AnimationMixer, state: FallbackState, root: THREE.Object3D): void {
  if (!state.ready || hasNativeActions(mixer)) return;

  const parent = root.parent;
  const scale = parent?.scale.x ?? 1;
  const p = parent?.position;
  let speed = 0;
  if (p) {
    if (state.initializedPosition) speed = p.distanceTo(state.previousPosition);
    state.previousPosition.copy(p);
    state.initializedPosition = true;
  }

  // FighterMesh's existing attack presentation scale is deliberately used only
  // as a fallback signal. Native state/FrameData remains authoritative whenever
  // native GLB actions exist.
  const attacking = scale > 1.015;
  const desired = attacking
    ? 'COMBO_PUNCH'
    : speed > 0.0005
      ? 'DRUNK_WALK'
      : 'BOX_IDLE';

  const next = state.actions.get(desired) ?? state.actions.get('BOX_IDLE');
  if (!next) return;
  if (state.current === desired && next.isRunning()) return;

  const previous = state.current ? state.actions.get(state.current) : undefined;
  next.reset();
  next.enabled = true;
  next.setEffectiveWeight(1);
  next.setEffectiveTimeScale(attacking ? 1.0 : speed > 0.0005 ? 1.0 : 0.85);
  next.setLoop(attacking ? THREE.LoopOnce : THREE.LoopRepeat, attacking ? 1 : Infinity);
  next.clampWhenFinished = attacking;
  next.play();

  if (previous && previous !== next) {
    previous.crossFadeTo(next, attacking ? 0.035 : 0.10, false);
  }
  state.current = desired;
}

export function installBannonFallbackMixer(): void {
  if (installed) return;
  installed = true;

  const prototype = THREE.AnimationMixer.prototype as THREE.AnimationMixer & {
    __bfOriginalUpdate?: (delta: number) => THREE.AnimationMixer;
  };
  if (prototype.__bfOriginalUpdate) return;

  const originalUpdate = prototype.update;
  prototype.__bfOriginalUpdate = originalUpdate;

  prototype.update = function patchedBannonAnimationUpdate(delta: number) {
    const root = this.getRoot();
    let state = states.get(this);
    if (!state) {
      state = {
        loading: false,
        ready: false,
        actions: new Map(),
        current: null,
        previousPosition: new THREE.Vector3(),
        initializedPosition: false,
      };
      states.set(this, state);
    }

    if (!hasNativeActions(this)) {
      void loadFallbackActions(this, root, state);
      selectFallbackAction(this, state, root);
    }

    originalUpdate.call(this, delta);
    return this;
  };
}
