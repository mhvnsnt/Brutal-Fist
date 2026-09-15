#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=process.argv[2] || 'BannonSource';
const out=process.argv[3] || 'build/bannon-fighters.json';
const files=[];
function walk(dir){
  if(!fs.existsSync(dir)) return;
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,e.name);
    if(e.isDirectory()) walk(p);
    else if(/\.glb$/i.test(e.name)) files.push(p);
  }
}
walk(root);
const fighters=files.map(file=>({source:file,format:'glb',eligible:true,reason:'real GLB asset'}));
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,JSON.stringify({version:1,sourceRoot:root,fighters},null,2));
console.log(JSON.stringify({found:files.length,output:out},null,2));
