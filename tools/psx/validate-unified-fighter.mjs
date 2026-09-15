#!/usr/bin/env node
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import fs from 'node:fs';

const file=process.argv[2];
if(!file) throw new Error('usage: node tools/psx/validate-unified-fighter.mjs <fighter.glb>');
if(!fs.existsSync(file)) throw new Error(`Missing GLB: ${file}`);

const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc=await io.read(file);
const root=doc.getRoot();
const meshes=root.listMeshes();
const skins=root.listSkins();
const animations=root.listAnimations();

let primitives=0, skinnedPrimitives=0;
for(const mesh of meshes) for(const prim of mesh.listPrimitives()){
  primitives++;
  if(prim.getAttribute('JOINTS_0') && prim.getAttribute('WEIGHTS_0')) skinnedPrimitives++;
}

const report={
  file,
  meshes:meshes.length,
  primitives,
  skinnedPrimitives,
  skins:skins.length,
  joints:skins[0]?.getJoints().length ?? 0,
  animations:animations.length,
  animationNames:animations.map(a=>a.getName()).filter(Boolean)
};

if(!skins.length) throw new Error('FAIL: unified fighter has no skin');
if(!skinnedPrimitives) throw new Error('FAIL: no skinned primitive');
if(skins.length>1) throw new Error('FAIL: multiple skins; resolve skeleton ownership before promotion');
console.log(JSON.stringify(report,null,2));
