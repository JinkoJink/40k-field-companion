#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const root=new URL('../public/data/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('gsc-version.json',root),'utf8'));
if(manifest.schemaVersion!==2)throw new Error('GSC dataset must use schema v2.');
if(manifest.scope?.factions?.join(',')!=='genestealer_cults')throw new Error('GSC manifest scope is incorrect.');
const packages=manifest.factions?.genestealer_cults?.packages;
if(!packages)throw new Error('GSC package map missing.');

const rows={};
for(const [name,info] of Object.entries(packages)){
  const body=await readFile(new URL(String(info.file).replace(/^data\//,''),root),'utf8');
  const hash=createHash('sha256').update(body.trimEnd()).digest('hex');
  if(hash!==info.hash)throw new Error(`${name}: manifest hash mismatch`);
  const payload=JSON.parse(body);
  if(payload.schemaVersion!==2||payload.faction!=='genestealer_cults'||payload.package!==name||!Array.isArray(payload.records))throw new Error(`${name}: malformed GSC package`);
  rows[name]=payload.records;
}
const unitIds=new Set(rows.units.map(row=>row.id));
for(const name of ['profiles','weapons','abilities','points']){
  for(const row of rows[name]||[])if(!unitIds.has(row.unitId))throw new Error(`${name}: orphan ${row.id}`);
}
for(const row of rows.leaders||[]){
  if(!unitIds.has(row.leaderUnitId))throw new Error(`leaders: missing leader ${row.leaderUnitId}`);
  for(const id of row.targetUnitIds||[])if(!unitIds.has(id))throw new Error(`leaders: missing target ${id}`);
  if(!['leader','support'].includes(row.attachmentRole))throw new Error(`leaders: invalid attachment role ${row.id}`);
}
for(const unit of rows.units){
  if(!unit.stats||!Object.keys(unit.stats).length)throw new Error(`units: missing stats for ${unit.name}`);
  if(!Array.isArray(unit.pricing)||!unit.pricing.length)throw new Error(`units: missing pricing for ${unit.name}`);
  if(!unit.pricing.every(tier=>Array.isArray(tier.costs)&&tier.costs.every(cost=>Number(cost.models)>0&&Number.isFinite(Number(cost.points)))))throw new Error(`units: malformed pricing for ${unit.name}`);
}
console.log(`Validated Broodmind draft bundle: ${rows.units.length} units, ${rows.detachments.length} detachments, ${rows.weapons.length} weapons, ${rows.abilities.length} abilities and ${rows.leaders.length} grouped attachment records.`);
