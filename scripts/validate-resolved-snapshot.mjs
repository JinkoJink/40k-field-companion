#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import path from 'node:path';

const inputRoot=process.argv[2]||'public/data';
const root=path.resolve(inputRoot);
const readJson=async relative=>JSON.parse(await readFile(path.join(root,relative),'utf8'));

const manifest=await readJson('version.json');
if(Number(manifest.schemaVersion)!==2)throw new Error(`Expected schema 2, got ${manifest.schemaVersion}`);

const resolved=manifest.resolved||{};
for(const key of ['runtimeGraph','units','detachments','relationships','coreRules']){
  if(!resolved[key])throw new Error(`Manifest missing resolved.${key}`);
}

const stripData=value=>String(value).replace(/^data\//,'');
const runtime=await readJson(stripData(resolved.runtimeGraph));
const units=await readJson(stripData(resolved.units));
const detachments=await readJson(stripData(resolved.detachments));
const relationships=await readJson(stripData(resolved.relationships));
const coreRules=await readJson(stripData(resolved.coreRules));

const graph=runtime.graph||{};
const graphUnits=Array.isArray(graph.units)?graph.units:[];
const graphDetachments=Array.isArray(graph.detachments)?graph.detachments:[];
const graphRelationships=Array.isArray(graph.relationships)?graph.relationships:[];
const graphCoreRules=Array.isArray(graph.coreRules)?graph.coreRules:[];

const snapshots=[
  ['units',units.records,graphUnits],
  ['detachments',detachments.records,graphDetachments],
  ['relationships',relationships.records,graphRelationships],
  ['coreRules',coreRules.records,graphCoreRules],
];
for(const [name,records,graphRecords] of snapshots){
  if(!Array.isArray(records))throw new Error(`Resolved ${name} snapshot has no records array`);
  if(records.length!==graphRecords.length)throw new Error(`Resolved ${name} count mismatch: snapshot ${records.length}, runtime graph ${graphRecords.length}`);
}

const counts=manifest.resolvedCounts||{};
for(const [key,records] of [['units',graphUnits],['detachments',graphDetachments],['relationships',graphRelationships],['coreRules',graphCoreRules]]){
  if(Number(counts[key])!==records.length)throw new Error(`Manifest resolvedCounts.${key} mismatch: ${counts[key]} != ${records.length}`);
}

const packageInfo=manifest?.factions?.necrons?.packages?.detachments;
if(!packageInfo?.file)throw new Error('Manifest missing Necron detachments package');
const packageDetachments=(await readJson(stripData(packageInfo.file))).records||[];
const modesFor=det=>det?.metadata?.gameModes||det?.metadata?.community11e?.game_modes||det?.gameModes||[];
const combatPatrolOnly=det=>{
  const modes=modesFor(det);
  return Array.isArray(modes)&&modes.length>0&&modes.every(mode=>String(mode).toLowerCase()==='combat-patrol');
};
const matchedPlayResolved=graphDetachments.filter(det=>!combatPatrolOnly(det));
const packageIds=new Set(packageDetachments.map(det=>det.id));
const resolvedIds=new Set(matchedPlayResolved.map(det=>det.id));
const missing=[...resolvedIds].filter(id=>!packageIds.has(id));
const extra=[...packageIds].filter(id=>!resolvedIds.has(id));
if(missing.length||extra.length)throw new Error(`Matched-play detachment package differs from resolved graph. Missing: ${missing.join(', ')||'none'}; extra: ${extra.join(', ')||'none'}`);

const excluded=graphDetachments.filter(combatPatrolOnly);
if(Number(counts.matchedPlayDetachments)!==matchedPlayResolved.length)throw new Error(`Manifest matched-play detachment count mismatch: ${counts.matchedPlayDetachments} != ${matchedPlayResolved.length}`);
if(Number(counts.combatPatrolOnlyDetachments)!==excluded.length)throw new Error(`Manifest Combat Patrol-only detachment count mismatch: ${counts.combatPatrolOnlyDetachments} != ${excluded.length}`);

console.log(`Validated resolved graph: ${graphUnits.length} units, ${graphDetachments.length} total detachments (${matchedPlayResolved.length} matched-play + ${excluded.length} Combat Patrol-only), ${graphRelationships.length} relationships, ${graphCoreRules.length} core rules.`);
