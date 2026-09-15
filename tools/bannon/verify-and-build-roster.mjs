#!/usr/bin/env node
/**
 * Strict Bannon roster gate for Brutal Fist.
 * Only real, existing GLBs are eligible. Procedural-only roster entries are excluded.
 * This script intentionally fails closed rather than substituting a procedural body.
 */
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(process.env.BANNON_SOURCE ?? 'BannonSource');
const roster=JSON.parse(fs.readFileSync(path.join(root,'roster.json'),'utf8'));
const modelRoot=path.join(root,'assets','models');

function walk(d,out=[]){
  if(!fs.existsSync(d)) return out;
  for(const e of fs.readdirSync(d,{withFileTypes:true})){
    const p=path.join(d,e.name);
    if(e.isDirectory()) walk(p,out);
    else if(/\.glb$/i.test(e.name)) out.push(p);
  }
  return out;
}
const files=walk(modelRoot);
const normalize=s=>String(s??'').toLowerCase().replace(/[^a-z0-9]/g,'');
const models=new Map();
for(const file of files){
  const stem=path.basename(file,'.glb');
  const key=normalize(stem.replace(/_rigged$/i,''));
  const score=/_rigged\.glb$/i.test(file)?2:1;
  const old=models.get(key);
  if(!old || score>old.score) models.set(key,{file,score});
}

const rows=roster.map(c=>{
  const keys=[c.id,c.name].map(normalize);
  const hit=keys.map(k=>models.get(k)).find(Boolean);
  return {
    id:c.id,name:c.name,bio:c.bio,
    eligible:!!hit,
    model:hit?.file.replace(root+path.sep,'BannonSource/'),
    modelPolicy:'REAL_GLB_ONLY'
  };
});

const eligible=rows.filter(x=>x.eligible);
const excluded=rows.filter(x=>!x.eligible);
const out={schema:2,policy:{realGlbOnly:true,noProceduralFallback:true},eligible,excluded,scannedGlbs:files.length};

fs.mkdirSync('src/data',{recursive:true});
fs.writeFileSync('src/data/bannonCharacterManifest.json',JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({scannedGlbs:files.length,eligible:eligible.length,excluded:excluded.length},null,2));
