#!/usr/bin/env node
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const root=new URL('../public/data/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('version.json',root),'utf8'));
const packages=manifest.factions.necrons.packages;
const rows={};
for(const [name,info] of Object.entries(packages)){
  const body=await readFile(new URL(info.file.replace('data/',''),root),'utf8');
  const hash=createHash('sha256').update(body.trimEnd()).digest('hex');
  if(hash!==info.hash)throw new Error(`${name}: manifest hash mismatch`);
  const payload=JSON.parse(body);if(payload.schemaVersion!==1||payload.package!==name||!Array.isArray(payload.records))throw new Error(`${name}: malformed package`);
  const ids=new Set;for(const row of payload.records){if(!row.id||ids.has(row.id))throw new Error(`${name}: duplicate stable ID`);ids.add(row.id);}rows[name]=payload.records;
}
const units=new Set(rows.units.map(x=>x.id));
for(const name of ['profiles','weapons','abilities','points'])for(const row of rows[name])if(!units.has(row.unitId))throw new Error(`${name}: orphan ${row.id}`);
for(const row of rows.profiles)if(!row.characteristics||!Object.keys(row.characteristics).length)throw new Error(`profiles: malformed ${row.id}`);
for(const row of rows.leaders){if(!units.has(row.leaderUnitId)||row.targetUnitIds.some(id=>!units.has(id)))throw new Error(`leaders: missing target ${row.id}`);}
const detachments=new Set(rows.detachments.map(x=>x.id));for(const row of rows.enhancements)if(!detachments.has(row.detachmentId))throw new Error(`enhancements: broken detachment reference`);
console.log(`Validated ${Object.keys(packages).length} packages and ${units.size} units.`);
