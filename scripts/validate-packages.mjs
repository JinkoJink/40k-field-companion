#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const root=new URL('../public/data/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('version.json',root),'utf8'));
if(manifest.edition&&manifest.edition!=='11th')throw new Error(`unexpected edition ${manifest.edition}`);
if(manifest.scope?.factions&&(manifest.scope.factions.length!==1||manifest.scope.factions[0]!=='necrons'))throw new Error('dataset scope must be Necrons-only');
const packages=manifest.factions.necrons.packages,rows={};
for(const[name,info]of Object.entries(packages)){
  const body=await readFile(new URL(info.file.replace('data/',''),root),'utf8'),hash=createHash('sha256').update(body.trimEnd()).digest('hex');
  if(hash!==info.hash)throw new Error(`${name}: manifest hash mismatch`);
  const payload=JSON.parse(body);if(![1,2].includes(payload.schemaVersion)||payload.package!==name||!Array.isArray(payload.records))throw new Error(`${name}: malformed package`);if(payload.edition&&payload.edition!=='11th')throw new Error(`${name}: non-11e package`);if(payload.faction&&payload.faction!=='necrons')throw new Error(`${name}: non-Necron package`);
  const ids=new Set;for(const row of payload.records){if(!row.id||ids.has(row.id))throw new Error(`${name}: duplicate stable ID`);ids.add(row.id);}rows[name]=payload.records;
}
const units=new Set(rows.units.map(x=>x.id)),externalUnits=new Set(rows.units.flatMap(x=>[x.externalId,x.id.split(':').pop()]).filter(Boolean));
for(const name of ['profiles','weapons','abilities','points'])for(const row of rows[name])if(!units.has(row.unitId))throw new Error(`${name}: orphan ${row.id}`);
for(const row of rows.profiles)if(!row.characteristics||!Object.keys(row.characteristics).length)throw new Error(`profiles: malformed ${row.id}`);
for(const row of rows.leaders){if(!units.has(row.leaderUnitId)||row.targetUnitIds.some(id=>!units.has(id)))throw new Error(`leaders: missing target ${row.id}`);if(row.attachmentRole&&!['leader','support'].includes(row.attachmentRole))throw new Error(`leaders: invalid attachment role ${row.id}`);}
const detachments=new Set(rows.detachments.map(x=>x.id));
for(const row of rows.enhancements){
  if(!detachments.has(row.detachmentId))throw new Error('enhancements: broken detachment reference');
  if(row.keywordRestrictionGroups&&!row.keywordRestrictionGroups.every(group=>Array.isArray(group)&&group.length))throw new Error(`enhancements: malformed restriction groups ${row.id}`);
  if(row.attachmentBodyguardIds)for(const id of row.attachmentBodyguardIds)if(!externalUnits.has(id))throw new Error(`enhancements: missing conditional bodyguard ${row.id} -> ${id}`);
  if(row.kind==='binding'&&(!row.mandatory||row.countsTowardLimit!==false||!row.allowedHosts?.length))throw new Error(`enhancements: malformed binding ${row.id}`);
}
for(const row of rows.units){if(row.attachmentRole&&!['leader','support'].includes(row.attachmentRole))throw new Error(`units: invalid attachmentRole ${row.id}`);if(row.attachmentRole==='support'&&!row.attachTo?.length)throw new Error(`units: Support has no bodyguard targets ${row.id}`);}
if(rows['core-rules']?.some(x=>x.edition!=='11th'||x.scope!=='shared-core'))throw new Error('core-rules: invalid scope or edition');
const community=rows['community-40kdc']?.[0];if(community){if(community.faction!=='necrons'||community.edition!=='11th')throw new Error('community-40kdc: invalid scope');for(const unit of community.data?.units||[])if(unit.faction_id!=='necrons'||unit.game_version?.edition!=='11th')throw new Error(`community-40kdc: leaked non-Necron/non-11e unit ${unit.id}`);}
console.log(`Validated ${Object.keys(packages).length} packages, ${units.size} Necron units and ${rows.enhancements.length} conditional enhancements/upgrades/bindings.`);
