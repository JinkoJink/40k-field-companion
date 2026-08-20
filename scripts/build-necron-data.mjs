#!/usr/bin/env node
/* Build-time publisher. This never runs in the installed PWA. */
import {mkdir, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import YAML from 'yaml';

const BS_URL='https://raw.githubusercontent.com/BSData/wh40k-11e/main/Necrons.json';
const CORE_URL='https://raw.githubusercontent.com/BSData/wh40k-11e/main/Warhammer%2040,000.json';
const MFM_URL='https://raw.githubusercontent.com/BSData/wh40k-11e-mfm/main/data/necrons.yaml';
const DC_ROOT='https://raw.githubusercontent.com/wn-mitch/40kdc-data/main/data';
const DC_URLS={
  units:`${DC_ROOT}/core/necrons/units.json`,
  weapons:`${DC_ROOT}/core/necrons/weapons.json`,
  abilities:`${DC_ROOT}/enrichment/necrons/abilities.json`,
  detachments:`${DC_ROOT}/core/necrons/detachments.json`,
  enhancements:`${DC_ROOT}/core/necrons/enhancements.json`,
  stratagems:`${DC_ROOT}/core/necrons/stratagems.json`,
  'unit-compositions':`${DC_ROOT}/core/necrons/unit-compositions.json`,
  'leader-attachments':`${DC_ROOT}/core/necrons/leader-attachments.json`,
  wargear:`${DC_ROOT}/core/necrons/wargear.json`,
  'wargear-options':`${DC_ROOT}/core/necrons/wargear-options.json`,
  factions:`${DC_ROOT}/core/necrons/factions.json`,
};
const OUT=new URL('../public/data/necrons/',import.meta.url);
const version=process.env.DATASET_VERSION || new Date().toISOString().slice(0,10)+'.1';
const key=value=>String(value).toLowerCase().replace(/[’‘]/g,"'").replace(/\[legends\]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const unitId=name=>'necrons:unit:'+key(name);
const sha=value=>createHash('sha256').update(value).digest('hex');
const textMap=chars=>Object.fromEntries((chars||[]).map(c=>[c.name||'',String(c.$text??'')]));
const profile=(raw, owner, type, index)=>({id:`${owner}:${type}:${key(raw.name)}:${index}`,name:raw.name,type:raw.typeName,characteristics:textMap(raw.characteristics)});
async function getJson(url){const response=await fetch(url);if(!response.ok)throw new Error(`HTTP ${response.status} for ${url}`);return response.json();}
async function getText(url){const response=await fetch(url);if(!response.ok)throw new Error(`HTTP ${response.status} for ${url}`);return response.text();}
function walk(node,out){for(const item of node.profiles||[])out.push(item);for(const item of node.selectionEntries||[])walk(item,out);for(const item of node.selectionEntryGroups||[])walk(item,out);}
function options(node, depth=0){
  if(depth>8)return [];
  const children=[...(node.selectionEntries||[]).map(x=>({...x,_kind:'entry'})),...(node.selectionEntryGroups||[]).map(x=>({...x,_kind:'group'}))];
  return children.filter(x=>!x.hidden).map(x=>({id:x.id,name:x.name,kind:x._kind,type:x.type,hidden:Boolean(x.hidden),costs:(x.costs||[]).map(c=>({name:c.name,type:c.typeId,value:Number(c.value)})),constraints:(x.constraints||[]).map(c=>({type:c.type,value:Number(c.value),scope:c.scope,childId:c.childId})),profiles:(x.profiles||[]).map((p,i)=>profile(p,'option:'+x.id,'profile',i)),options:options(x,depth+1)}));
}
const summaries={
  'Awakened Dynasty':['Command Protocols','Codex rules required.'],'Annihilation Legion':['Annihilation Protocol','Codex rules required.'],'Canoptek Court':['Power Matrix','Codex rules required.'],'Obeisance Phalanx':['Worthy Foes','Codex rules required.'],'Hypercrypt Legion':['Hyperphasing','Codex rules required.'],'Starshatter Arsenal':['Relentless Onslaught','Codex rules required.'],'Cryptek Conclave':['Technosorcerous Augmentations','Codex rules required.'],'Cursed Legion':['Cold Fervour','Codex rules required.'],'Pantheon Of Woe':['Cosmic Distortion','Codex rules required.'],'Pantheon of Woe':['Cosmic Distortion','Codex rules required.'],'Hand Of The Dynasty':['Dynastic Advance','Codex rules required.'],
};
const [bs,core,mfmText,dcEntries]=await Promise.all([
  getJson(BS_URL),getJson(CORE_URL),getText(MFM_URL),
  Promise.all(Object.entries(DC_URLS).map(async ([name,url])=>[name,await getJson(url)])),
]);
const mfm=YAML.parse(mfmText);
const dc=Object.fromEntries(dcEntries);
const dcUnits=(dc.units||[]).filter(unit=>unit.faction_id==='necrons'&&unit.game_version?.edition==='11th');
if(!dcUnits.length)throw new Error('40kdc returned no 11th-edition Necron units.');
if(dcUnits.length!==(dc.units||[]).length)console.warn(`40kdc: filtered ${(dc.units||[]).length-dcUnits.length} non-Necron/non-11e unit records.`);
dc.units=dcUnits;
const mfmByName=new Map((mfm.units||[]).map(x=>[key(x.name),x]));
const dcDetachByName=new Map((dc.detachments||[]).map(x=>[key(x.name),x]));
const dcEnhByName=new Map((dc.enhancements||[]).map(x=>[key(x.name),x]));
const units=[],profiles=[],weapons=[],abilities=[],keywords=[],leaders=[];
for(const entry of (bs.catalogue?.sharedSelectionEntries||[])){
  const categories=(entry.categoryLinks||[]).map(x=>x.name).filter(Boolean);if(!categories.includes('Faction: Necrons'))continue;
  const raw=[];walk(entry,raw);const unitRaw=raw.find(x=>x.typeName==='Unit'&&x.name===entry.name)||raw.find(x=>x.typeName==='Unit');if(!unitRaw)continue;
  const id=unitId(entry.name),all=raw.map((x,i)=>profile(x,id,'profile',i)),current=mfmByName.get(key(entry.name));
  units.push({id,name:entry.name,legends:/\[Legends\]/i.test(entry.name),categories,role:current?.role||null,weaponCount:all.filter(x=>/Weapons$/.test(x.type||'')).length,abilityCount:all.filter(x=>x.type==='Abilities').length,options:options(entry),rules:(entry.infoLinks||[]).map(x=>({name:x.name,type:x.type,targetId:x.targetId}))});
  profiles.push({id:unitRaw.id,unitId:id,characteristics:unitRaw.characteristics});
  weapons.push(...all.filter(x=>x.type==='Ranged Weapons'||x.type==='Melee Weapons').map(x=>({...x,unitId:id})));
  abilities.push(...all.filter(x=>x.type==='Abilities').map(x=>({...x,unitId:id})));
  keywords.push(...categories.map(name=>({id:`necrons:keyword:${key(name)}:${key(entry.name)}`,keywordId:`necrons:keyword:${key(name)}`,name,unitId:id})));
  if(current?.attachTo?.length)leaders.push({id:`necrons:leader:${key(entry.name)}`,leaderUnitId:id,targetNames:current.attachTo,targetUnitIds:current.attachTo.map(unitId)});
}
const detachmentRows=(mfm.detachments||[]).map(d=>{const [ruleName,summary]=summaries[d.name]||['Detachment rule','Codex rules required.'];const supplemental=dcDetachByName.get(key(d.name));return {...d,...(supplemental?{community11e:supplemental}:{}),id:`necrons:detachment:${key(d.name)}`,ruleName,summary};});
const enhancements=detachmentRows.flatMap(d=>(d.enhancements||[]).map(e=>{const supplemental=dcEnhByName.get(key(e.name));return {...e,...(supplemental?{community11e:supplemental}:{}),id:`${d.id}:enhancement:${key(e.name)}`,detachmentId:d.id};}));
const points=units.map(unit=>{const m=mfmByName.get(key(unit.name));return {id:`necrons:points:${key(unit.name)}`,unitId:unit.id,pricing:m?.pricing||null,role:m?.role||null};});
const stratagems=(dc.stratagems||[]).map(s=>({...s,id:s.id||`necrons:stratagem:${key(s.name)}`}));
const coreRoot=core.gameSystem||core;
const coreRules=(coreRoot.sharedRules||[]).map(rule=>({id:rule.id||`core11e:rule:${key(rule.name)}`,name:rule.name,description:rule.description||'',profiles:rule.profiles||[],infoLinks:rule.infoLinks||[],edition:'11th',scope:'shared-core'}));
if(!coreRules.length)throw new Error('BSData core file returned no shared 11e rules.');
const community40kdc=[{id:'necrons:community:40kdc',edition:'11th',faction:'necrons',upstream:DC_ROOT,data:dc}];
const packages={units,profiles,weapons,abilities,keywords,detachments:detachmentRows,enhancements,stratagems,points,leaders,'core-rules':coreRules,'community-40kdc':community40kdc,source:[{id:'necrons:source:current',edition:'11th',faction:'necrons',bsdata:BS_URL,coreRules:CORE_URL,mfm:MFM_URL,community40kdc:DC_ROOT,precedence:['BSData/wh40k-11e roster + core rules','BSData/wh40k-11e-mfm points','wn-mitch/40kdc-data supplemental rules/validation'],generatedAt:new Date().toISOString()}]};
await mkdir(OUT,{recursive:true});
const manifest={datasetVersion:version,schemaVersion:2,edition:'11th',scope:{factions:['necrons'],includesSharedCoreRules:true},factions:{necrons:{packages:{}}}};
for(const [name,payload] of Object.entries(packages)){const body=JSON.stringify({schemaVersion:2,package:name,edition:'11th',faction:name==='core-rules'?null:'necrons',records:payload});await writeFile(new URL(`${name}.json`,OUT),body+'\n');manifest.factions.necrons.packages[name]={file:`data/necrons/${name}.json`,hash:sha(body)};}
await writeFile(new URL('../version.json',OUT),JSON.stringify(manifest,null,2)+'\n');
console.log(`Published ${units.length} Necron units, ${stratagems.length} stratagems and ${coreRules.length} shared 11e rules (${version}).`);
