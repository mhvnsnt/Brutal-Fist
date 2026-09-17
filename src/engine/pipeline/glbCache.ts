import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

THREE.Cache.enabled = true;

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

const inflight = new Map<string, Promise<GLTF>>();

/** Shared GLB fetch — second portrait / fight reuse the same parse. */
export function loadGLTF(url: string): Promise<GLTF> {
  const hit = inflight.get(url);
  if (hit) return hit;
  const p = new Promise<GLTF>((resolve, reject) => {
    loader.load(url, resolve, undefined, reject);
  });
  inflight.set(url, p);
  p.catch(() => inflight.delete(url));
  return p;
}

export function warmupGLTF(url: string) {
  void loadGLTF(url);
}

export function warmupImages(urls: string[]) {
  if (typeof window === 'undefined') return;
  for (const url of urls) {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
  }
}
