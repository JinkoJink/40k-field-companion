#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const root=new URL('../dist/data/',import.meta.url);
const faction=process.env.APP_FACTION||'necrons';
const manifestFile=process.env.APP_MANIFEST||'version.json';
const manifest=JSON.parse(await readFile(new URL(manifestFile,root),'utf8'));
const packages=manifest?.factions?.[faction]?.packages;
if(!packages||typeof packages!=='object')throw new Error(`Built rules manifest has no ${faction} package map.`);

for(const [name,info] of Object.entries(packages)){
  if(!info?.file||!info?.hash)throw new Error(`${name}: missing file/hash in built manifest`);
  const relative=String(info.file).replace(/^data\//,'');
  const body=await readFile(new URL(relative,root),'utf8');
  const hash=createHash('sha256').update(body.trimEnd()).digest('hex');
  if(hash!==info.hash)throw new Error(`${name}: built package hash mismatch (${hash} != ${info.hash})`);
  const payload=JSON.parse(body);
  if(payload?.package!==name||!Array.isArray(payload?.records))throw new Error(`${name}: malformed built package`);
  if(payload?.faction&&payload.faction!==faction)throw new Error(`${name}: wrong faction ${payload.faction}`);
}

console.log(`Verified ${Object.keys(packages).length} built ${faction} package hashes against dist/data/${manifestFile}.`);
