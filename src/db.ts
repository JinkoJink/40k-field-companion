import type {
  BattleState,
  Detachment,
  Enhancement,
  InstalledRulesMeta,
  PackageManifest,
  Profile,
  RosterUnit,
  RulesManifest,
  Stratagem,
  UnitDetail,
  UnitIndex,
} from './types';
import {canon} from './rules';
import {appConfig} from './appConfig';

const DB=appConfig.dbName;
const VERSION=2;
const RULE_STORES=['factions','units','profiles','weapons','abilities','keywords','detachments','enhancements','stratagems','points','leaders','source','coreRules','community40kdc','dependencies','searchIndex'] as const;
type RuleStore=typeof RULE_STORES[number];
const PACKAGE_STORE:Record<string,RuleStore>={
  units:'units',profiles:'profiles',weapons:'weapons',abilities:'abilities',keywords:'keywords',detachments:'detachments',enhancements:'enhancements',stratagems:'stratagems',points:'points',leaders:'leaders',source:'source','core-rules':'coreRules','community-40kdc':'community40kdc',
};

let databasePromise:Promise<IDBDatabase>|null=null;

function open(){
  if(databasePromise)return databasePromise;
  databasePromise=new Promise<IDBDatabase>((resolve,reject)=>{
    const request=indexedDB.open(DB,VERSION);
    request.onupgradeneeded=event=>{
      const db=request.result;
      for(const name of ['system',...RULE_STORES,'user','battle','staging']){
        if(!db.objectStoreNames.contains(name))db.createObjectStore(name,{keyPath:'id'});
      }
      if(event.oldVersion<1){/* initial durable local tree */}
    };
    request.onsuccess=()=>{
      const db=request.result;
      db.onversionchange=()=>{
        db.close();
        databasePromise=null;
      };
      resolve(db);
    };
    request.onerror=()=>{
      databasePromise=null;
      reject(request.error);
    };
  });
  return databasePromise;
}

function done(tx:IDBTransaction){
  return new Promise<void>((resolve,reject)=>{
    tx.oncomplete=()=>resolve();
    tx.onabort=()=>reject(tx.error);
    tx.onerror=()=>reject(tx.error);
  });
}

function request<T>(value:IDBRequest<T>){
  return new Promise<T>((resolve,reject)=>{
    value.onsuccess=()=>resolve(value.result);
    value.onerror=()=>reject(value.error);
  });
}

const json=(value:unknown)=>JSON.stringify(value);

async function digest(value:string){
  const bytes=new TextEncoder().encode(value);
  const hash=await crypto.subtle.digest('SHA-256',bytes);
  return Array.from(new Uint8Array(hash)).map(byte=>byte.toString(16).padStart(2,'0')).join('');
}

function packageUrl(file:string,remote:boolean){
  return remote?`https://raw.githubusercontent.com/JinkoJink/40k-field-companion/main/public/${file}`:`./${file}`;
}

function factionPackages(manifest:RulesManifest){
  const faction=manifest.factions?.[appConfig.factionId];
  if(!faction?.packages)throw new Error(`Rules manifest does not contain ${appConfig.factionName} packages.`);
  return faction.packages;
}

export async function system<T>(id:string,fallback:T):Promise<T>{
  const db=await open();
  const tx=db.transaction('system','readonly');
  const record=await request<any>(tx.objectStore('system').get(id));
  await done(tx);
  return record?.value??fallback;
}

export async function putSystem(id:string,value:unknown){
  const db=await open();
  const tx=db.transaction('system','readwrite');
  tx.objectStore('system').put({id,value});
  await done(tx);
}

async function getAll<T>(store:string):Promise<T[]>{
  const db=await open();
  const tx=db.transaction(store,'readonly');
  const rows=await request<T[]>(tx.objectStore(store).getAll());
  await done(tx);
  return rows;
}

async function countStore(store:string){
  const db=await open();
  const tx=db.transaction(store,'readonly');
  const count=await request(tx.objectStore(store).count());
  await done(tx);
  return count;
}

function normalizeRecord(packageName:string,row:any,index:number){
  if(row.id)return row;
  if(packageName==='points')return{...row,id:`points:${row.unitId}`};
  if(packageName==='profiles')return{...row,id:`profile:${row.unitId}`};
  if(packageName==='leaders')return{...row,id:`leader:${row.leaderUnitId}`};
  if(packageName==='source')return{...row,id:`source:${index}`};
  return{...row,id:`${packageName}:${index}`};
}

export function validatePackagePayload(name:string,payload:any){
  if(![1,2].includes(payload?.schemaVersion)||payload?.package!==name||!Array.isArray(payload.records)){
    throw new Error(`Invalid ${name} package schema.`);
  }
  const seen=new Set<string>();
  for(const[index,raw]of payload.records.entries()){
    const row=normalizeRecord(name,raw,index);
    if(!row.id||seen.has(row.id))throw new Error(`Duplicate or missing stable ID in ${name}.`);
    seen.add(row.id);
  }
}

export function changedPackageNames(local:RulesManifest,remote:RulesManifest){
  const localPackages=factionPackages(local),remotePackages=factionPackages(remote);
  return Object.entries(remotePackages)
    .filter(([name,info])=>localPackages[name]?.hash!==info.hash)
    .map(([name])=>name);
}

async function fetchPackage(info:PackageManifest,remote:boolean){
  const response=await fetch(packageUrl(info.file,remote),{cache:remote?'no-store':'force-cache'});
  if(!response.ok)throw new Error(`Could not download ${info.file}.`);
  const body=await response.text();
  if(await digest(body.trimEnd())!==info.hash)throw new Error(`Hash mismatch for ${info.file}.`);
  const parsed=JSON.parse(body);
  validatePackagePayload(parsed.package,parsed);
  return parsed;
}

async function fetchPackages(entries:[string,PackageManifest][],remote:boolean){
  const rows=await Promise.all(entries.map(async([name,info])=>[name,await fetchPackage(info,remote)] as const));
  return Object.fromEntries(rows) as Record<string,any>;
}

async function validationContext(changed:Record<string,any>){
  const [storedUnits,storedDetachments,storedEnhancements]=await Promise.all([
    changed.units?.records?Promise.resolve(changed.units.records):getAll<any>('units'),
    changed.detachments?.records?Promise.resolve(changed.detachments.records):getAll<any>('detachments'),
    changed.enhancements?.records?Promise.resolve(changed.enhancements.records):getAll<any>('enhancements'),
  ]);
  const units=storedUnits.map((row:any,index:number)=>normalizeRecord('units',row,index));
  const unitIds=new Set(units.map((row:any)=>row.id));
  if(!unitIds.size)throw new Error('Rules update has no units.');

  const detachments=storedDetachments.map((row:any,index:number)=>normalizeRecord('detachments',row,index));
  const detachmentIds=new Set(detachments.map((row:any)=>row.id));
  const enhancements=storedEnhancements.map((row:any,index:number)=>normalizeRecord('enhancements',row,index));
  for(const row of enhancements){
    if(row.detachmentId&&!detachmentIds.has(row.detachmentId))throw new Error(`Invalid detachment reference: ${row.detachmentId}.`);
  }

  const relatedNames=['profiles','weapons','abilities','points','leaders'] as const;
  const related=await Promise.all(relatedNames.map(async name=>{
    const rows=changed[name]?.records||await getAll<any>(PACKAGE_STORE[name]);
    return[name,rows] as const;
  }));
  for(const[name,rows]of related){
    for(const[index,raw]of rows.entries()){
      const row=normalizeRecord(name,raw,index);
      if(name==='profiles'&&(!row.characteristics||typeof row.characteristics!=='object'||!Object.keys(row.characteristics).length)){
        throw new Error(`Malformed stat profile: ${row.id}.`);
      }
      if(row.unitId&&!unitIds.has(row.unitId))throw new Error(`Broken ${name} reference: ${row.unitId}.`);
      if(row.leaderUnitId&&!unitIds.has(row.leaderUnitId))throw new Error(`Broken leader reference: ${row.leaderUnitId}.`);
      for(const id of row.targetUnitIds||[])if(!unitIds.has(id))throw new Error(`Missing leader target: ${id}.`);
    }
  }
}

function rebuildsUnitIndexes(packages:Record<string,any>){
  return['units','keywords','weapons','abilities'].some(name=>Boolean(packages[name]));
}

export function installStoreNamesForPackages(packages:Record<string,any>){
  const stores=['system','staging',...Object.keys(packages).map(name=>PACKAGE_STORE[name]).filter(Boolean)];
  if(rebuildsUnitIndexes(packages))stores.push('dependencies','searchIndex','units');
  return Array.from(new Set(stores));
}

async function install(manifest:RulesManifest,packages:Record<string,any>,mode:'bootstrap'|'update'){
  await validationContext(packages);
  const db=await open();
  const tx=db.transaction(installStoreNamesForPackages(packages),'readwrite');
  const staging=tx.objectStore('staging');
  for(const[name,payload]of Object.entries(packages)){
    staging.put({id:`${manifest.datasetVersion}:${name}`,payload});
  }

  for(const[name,payload]of Object.entries(packages)){
    const mappedStore=PACKAGE_STORE[name];
    if(!mappedStore)continue;
    const store=tx.objectStore(mappedStore);
    store.clear();
    payload.records.forEach((row:any,index:number)=>store.put(normalizeRecord(name,row,index)));
  }

  if(rebuildsUnitIndexes(packages)){
    const dependencies=tx.objectStore('dependencies');
    const search=tx.objectStore('searchIndex');
    dependencies.clear();
    search.clear();
    const allUnits=packages.units?.records||await request<any[]>(tx.objectStore('units').getAll());
    for(const unit of allUnits){
      dependencies.put({id:unit.id,package:'units',dependsOn:['profiles','weapons','abilities','points','leaders','keywords']});
      search.put({id:unit.id,text:json(unit).toLowerCase()});
    }
  }

  const installed:InstalledRulesMeta={
    datasetVersion:manifest.datasetVersion,
    schemaVersion:manifest.schemaVersion,
    packages:factionPackages(manifest),
    lastSuccessfulUpdate:new Date().toISOString(),
    lastKnownGood:manifest.datasetVersion,
    mode,
  };
  const systemStore=tx.objectStore('system');
  systemStore.put({id:'installed',value:installed});
  systemStore.delete('pending-update');
  for(const name of Object.keys(packages))staging.delete(`${manifest.datasetVersion}:${name}`);
  await done(tx);
}

async function bundledManifest(){
  const response=await fetch(appConfig.manifestPath,{cache:'no-store'});
  if(!response.ok)throw new Error('Bundled rules manifest unavailable.');
  const manifest=await response.json() as RulesManifest;
  if(manifest.schemaVersion>VERSION)throw new Error('Bundled rules need a newer app database schema.');
  return manifest;
}

function isSameOrNewerDataset(candidate:string,current:string){
  return candidate===current||candidate.localeCompare(current,undefined,{numeric:true,sensitivity:'base'})>0;
}

export async function initializeRules(){
  const installed=await system<InstalledRulesMeta|null>('installed',null);
  const hasUnits=await countStore('units')>0;

  if(installed&&hasUnits){
    // Keep an active battle on the exact installed rules tree it started with. Its snapshot is upgraded separately.
    const active=await readBattle();
    if(active?.active)return installed;
    try{
      const manifest=await bundledManifest();
      if(isSameOrNewerDataset(manifest.datasetVersion,installed.datasetVersion)){
        const changed=Object.entries(factionPackages(manifest))
          .filter(([name,info])=>installed.packages?.[name]?.hash!==info.hash) as [string,PackageManifest][];
        if(changed.length){
          const packages=await fetchPackages(changed,false);
          await install(manifest,packages,'update');
          return system<InstalledRulesMeta|null>('installed',null);
        }
      }
    }catch{
      // Existing validated IndexedDB data remains the last-known-good source when the PWA is offline.
    }
    return installed;
  }

  const manifest=await bundledManifest();
  const entries=Object.entries(factionPackages(manifest)) as [string,PackageManifest][];
  const packages=await fetchPackages(entries,false);
  await install(manifest,packages,'bootstrap');
  return system<InstalledRulesMeta|null>('installed',null);
}

export async function checkForUpdates(force=false){
  const installed=await system<InstalledRulesMeta|null>('installed',null);
  if(!installed)throw new Error('Initialize local rules first.');
  if(!force&&!navigator.onLine)return{status:'offline' as const,changed:[] as string[]};

  const response=await fetch(appConfig.remoteManifestUrl,{cache:'no-store'});
  if(!response.ok)throw new Error('Update manifest unavailable.');
  const manifest=await response.json() as RulesManifest;
  if(manifest.schemaVersion>VERSION)throw new Error('This update needs a newer app database schema.');

  const changed=Object.entries(factionPackages(manifest))
    .filter(([name,info])=>installed.packages?.[name]?.hash!==info.hash) as [string,PackageManifest][];
  if(!changed.length)return{status:'current' as const,changed:[] as string[]};

  const active=await readBattle();
  if(active?.active){
    await putSystem('pending-update',{manifest,changed:changed.map(([name])=>name),detectedAt:new Date().toISOString()});
    return{status:'deferred' as const,changed:changed.map(([name])=>name)};
  }

  const packages=await fetchPackages(changed,true);
  await install(manifest,packages,'update');
  return{status:'updated' as const,changed:changed.map(([name])=>name)};
}

const asStrings=(values:any[]|undefined|null)=>(values||[]).map(value=>String(value)).filter(Boolean);

function readableEffect(effect:any):string{
  if(!effect)return'';
  if(typeof effect==='string')return effect;
  if(Array.isArray(effect))return effect.map(readableEffect).filter(Boolean).join('; ');
  if(effect.type==='sequence')return readableEffect(effect.steps);
  if(effect.type==='conditional')return[readableEffect(effect.condition),readableEffect(effect.effect)].filter(Boolean).join(' → ');
  const bits=[
    effect.type,
    effect.target,
    effect.dice,
    effect.threshold!==undefined?`on ${effect.threshold}+`:null,
    effect.modifier?Object.entries(effect.modifier).map(([key,value])=>`${key} ${Array.isArray(value)?value.join('/'):String(value)}`).join(', '):null,
  ].filter(Boolean);
  return bits.join(' · ').replace(/-/g,' ');
}

function profileText(profile:any){
  return Object.values(profile?.characteristics||{}).filter(Boolean).join(' ');
}

function pricingFromDc(raw:any){
  const rows=raw?.points||[];
  if(!rows.length)return null;
  return[{range:'[1,)',costs:rows.map((row:any)=>({models:Number(row.models||1),points:Number(row.cost||0)}))}];
}

function dcStats(raw:any){
  const profile=raw?.profiles?.[0]||{};
  const output:Record<string,string>={};
  for(const key of ['M','T','W','Sv','Ld','OC']){
    if(profile[key]!==undefined&&profile[key]!==null)output[key]=String(profile[key]);
  }
  if(profile.invuln_sv)output.InSv=String(profile.invuln_sv);
  return output;
}

function mergeAbility(profile:any,dcUnit:any,dc:any):Profile{
  const structured=(dc.abilities||[]).find((ability:any)=>canon(ability.name)===canon(profile.name)&&(!ability.unit_ids?.length||ability.unit_ids.includes(dcUnit?.id)));
  const description=profileText(profile)||structured?.community_notes||readableEffect(structured?.effect);
  return{
    ...profile,
    description:description||undefined,
    rule:structured?{
      source:'40kdc',
      quality:structured.game_version?.dataslate==='launch'?'structured':'provisional',
      behavior:structured.behavior,
      scope:structured.scope,
      usage:structured.usage,
      effect:structured.effect,
      gameVersion:structured.game_version,
    }:profile.rule,
  };
}

function dcWeaponProfile(row:any,index:number):Profile{
  return{
    id:`dc:weapon:${row.id||index}`,
    name:row.name||row.id,
    type:row.type||'Weapon',
    characteristics:Object.fromEntries(Object.entries(row.profile||row.characteristics||{}).map(([key,value])=>[key,String(value??'')])),
  };
}

const BINDING_HOSTS:Record<string,string[]>={
  'singularity matrix':["C’tan Shard of the Deceiver"],
  'quantum goad':["C’tan Shard of the Nightbringer"],
  'animus damper':["C’tan Shard of the Void Dragon"],
  'reletavistic tether':["Transcendent C’tan"],
};
const GRANTED_KEYWORDS:Record<string,string[]>={
  'murdermind':['Destroyer Cult'],
  'destroyer ankh':['Destroyer Cult'],
};

export function normalizeTransportCapacityRuntime(raw:any){
  if(!raw)return null;
  const capacity=Number(raw.capacity||0);
  if(!capacity)return null;
  return{
    capacity,
    keywordRestrictions:raw.keywordRestrictions??raw.keyword_restrictions??null,
    exclusionKeywords:raw.exclusionKeywords??raw.exclusion_keywords??null,
  };
}

function normalizeConditionalKeywords(raw:any){
  return(raw||[]).map((entry:any)=>({
    keyword:String(entry.keyword||''),
    requiredDetachmentId:entry.requiredDetachmentId??entry.required_detachment_id??null,
    requiredFactionKeyword:entry.requiredFactionKeyword??entry.required_faction_keyword??null,
  })).filter((entry:any)=>entry.keyword);
}

export function normalizeUnitConnections(raw:any,dcUnit:any,leader:any,structuredTargetNames:string[]=[]){
  const leaderTargets=leader?.targetNames||[];
  const rawTargets=raw?.attachTo||[];
  return{
    externalId:raw?.externalId||dcUnit?.id,
    attachmentRole:raw?.attachmentRole??leader?.attachmentRole??dcUnit?.attachment_role??null,
    attachTo:leaderTargets.length?leaderTargets:rawTargets.length?rawTargets:structuredTargetNames,
    conditionalKeywords:normalizeConditionalKeywords(raw?.conditionalKeywords??dcUnit?.conditional_keywords),
    transportCapacity:normalizeTransportCapacityRuntime(raw?.transportCapacity??dcUnit?.transport_capacity),
    sourceVersion:raw?.sourceVersion||dcUnit?.game_version,
  };
}

export function normalizeEnhancementRuntime(row:any,supplemental:any=row?.community11e||{},mappedDetachmentId?:string):Enhancement{
  const fallbackHosts=BINDING_HOSTS[canon(row?.name)]||[];
  const allowedHosts=row?.allowedHosts?.length?row.allowedHosts:fallbackHosts;
  const upgrade=Boolean(row?.upgrade??row?.nonCharacterOnly??supplemental?.upgrade_tag);
  const kind=row?.kind||(fallbackHosts.length?'binding':upgrade?'upgrade':'enhancement');
  return{
    ...row,
    points:Number(row?.points??row?.cost??supplemental?.cost??0),
    detachmentId:row?.detachmentId||mappedDetachmentId||row?.detachment_id||supplemental?.detachment_id,
    keywordRestrictions:row?.keywordRestrictions||row?.requiredKeywords||supplemental?.keyword_restrictions||[],
    keywordRestrictionGroups:row?.keywordRestrictionGroups||supplemental?.keyword_restriction_groups||[],
    exclusionKeywords:row?.exclusionKeywords||supplemental?.exclusion_keywords||[],
    allowedHosts,
    attachmentBodyguardIds:row?.attachmentBodyguardIds||supplemental?.attachment_bodyguard_ids||[],
    grantKeywords:row?.grantKeywords||GRANTED_KEYWORDS[canon(row?.name)]||[],
    upgrade,
    kind,
    countsTowardLimit:row?.countsTowardLimit??(kind!=='binding'),
    mandatory:row?.mandatory??(kind==='binding'),
    maxTargets:Number(row?.maxTargets??row?.limit??supplemental?.max_targets??0)||undefined,
    abilityId:row?.abilityId??supplemental?.ability_id,
    gameModes:row?.gameModes||supplemental?.game_modes||[],
    gameVersion:row?.gameVersion||supplemental?.game_version,
  };
}

function groupByUnit(rows:any[]){
  const grouped=new Map<string,any[]>();
  for(const row of rows){
    if(!row.unitId)continue;
    grouped.set(row.unitId,[...(grouped.get(row.unitId)||[]),row]);
  }
  return grouped;
}

export async function loadRules(){
  await initializeRules();
  const [units,profiles,weapons,abilities,points,leaders,detachments,enhancements,stratagems,community]=await Promise.all(
    ['units','profiles','weapons','abilities','points','leaders','detachments','enhancements','stratagems','community40kdc'].map(getAll),
  );

  const communityRecord=(community as any[])[0]||{};
  const dc=communityRecord.data||{};
  const dcUnitByName=new Map<string,any>((dc.units||[]).map((row:any)=>[canon(row.name),row]));
  const dcUnitById=new Map<string,any>((dc.units||[]).map((row:any)=>[row.id,row]));
  const dcAttachmentByLeader=new Map<string,any>((dc['leader-attachments']||[]).map((row:any)=>[row.leader_id,row]));
  const pointMap=new Map((points as any[]).map(row=>[row.unitId,row]));
  const leaderMap=new Map((leaders as any[]).map(row=>[row.leaderUnitId,row]));
  const profileMap=new Map((profiles as any[]).map(row=>[row.unitId,row]));
  const weaponsByUnit=groupByUnit(weapons as any[]);
  const abilitiesByUnit=groupByUnit(abilities as any[]);
  const structuredTargets=(dcUnit:any)=>(dcAttachmentByLeader.get(dcUnit?.id)?.eligible_bodyguard_ids||[])
    .map((id:string)=>dcUnitById.get(id)?.name)
    .filter(Boolean) as string[];

  const details=new Map<string,UnitDetail>();
  const index:UnitIndex[]=[];
  for(const raw of units as any[]){
    const dcUnit=dcUnitByName.get(canon(raw.name));
    const pointRow:any=pointMap.get(raw.id);
    const statProfile:any=profileMap.get(raw.id);
    const leader:any=leaderMap.get(raw.id);
    const categories=Array.from(new Set([
      ...(raw.categories||[]),
      ...asStrings(dcUnit?.keywords),
      ...asStrings(dcUnit?.faction_keywords).map(value=>`Faction: ${value}`),
    ]));
    const stats={...dcStats(dcUnit),...(statProfile?.characteristics||{})};
    const connections=normalizeUnitConnections(raw,dcUnit,leader,structuredTargets(dcUnit));
    const unit:UnitDetail={
      ...raw,
      ...connections,
      categories,
      stats,
      pricing:pointRow?.pricing||pricingFromDc(dcUnit)||raw.pricing||null,
      role:pointRow?.role||raw.role||dcUnit?.role||null,
      weapons:weaponsByUnit.get(raw.id)||[],
      abilities:(abilitiesByUnit.get(raw.id)||[]).map(profile=>mergeAbility(profile,dcUnit,dc)),
    };
    details.set(unit.id,unit);
    const{weapons:_weapons,abilities:_abilities,options:_options,rules:_rules,...summary}=unit;
    index.push(summary);
  }

  const known=new Set(index.map(unit=>canon(unit.name)));
  for(const raw of dc.units||[]){
    if(known.has(canon(raw.name))||raw.is_legend)continue;
    const id=`necrons:unit:${canon(raw.name).replace(/\s+/g,'-')}`;
    const categories=[
      ...asStrings(raw.keywords),
      ...asStrings(raw.faction_keywords).map(value=>`Faction: ${value}`),
    ];
    const dcWeapons=(dc.weapons||[])
      .filter((weapon:any)=>(raw.weapon_ids||[]).includes(weapon.id))
      .map(dcWeaponProfile);
    const dcAbilities=(dc.abilities||[])
      .filter((ability:any)=>(raw.ability_ids||[]).includes(ability.ability_id))
      .map((ability:any)=>({
        id:`dc:ability:${ability.ability_id}`,
        name:ability.name,
        type:'Abilities',
        characteristics:{Rule:ability.community_notes||readableEffect(ability.effect)},
        description:ability.community_notes||readableEffect(ability.effect),
        rule:{
          source:'40kdc' as const,
          quality:ability.game_version?.dataslate==='launch'?'structured' as const:'provisional' as const,
          behavior:ability.behavior,
          scope:ability.scope,
          usage:ability.usage,
          effect:ability.effect,
          gameVersion:ability.game_version,
        },
      }));
    const connections=normalizeUnitConnections({},raw,null,structuredTargets(raw));
    const unit:UnitDetail={
      id,
      ...connections,
      name:raw.name,
      legends:Boolean(raw.is_legend),
      categories,
      stats:dcStats(raw),
      pricing:pricingFromDc(raw),
      role:raw.role||null,
      weaponCount:dcWeapons.length,
      abilityCount:dcAbilities.length,
      weapons:dcWeapons,
      abilities:dcAbilities,
      options:[],
    };
    details.set(id,unit);
    const{weapons:_weapons,abilities:_abilities,options:_options,...summary}=unit;
    index.push(summary);
  }

  const rawDetachments=detachments as any[];
  const detachmentIdByDc=new Map<string,string>();
  for(const detachment of rawDetachments){
    const supplemental=detachment.community11e||(dc.detachments||[]).find((row:any)=>canon(row.name)===canon(detachment.name));
    if(supplemental?.id)detachmentIdByDc.set(supplemental.id,detachment.id);
  }

  const normalizedEnhancements=(enhancements as any[]).map((row:any)=>{
    const supplemental=row.community11e||(dc.enhancements||[]).find((candidate:any)=>canon(candidate.name)===canon(row.name));
    const ability=supplemental?.ability_id&&(dc.abilities||[]).find((candidate:any)=>candidate.ability_id===supplemental.ability_id);
    const enhancement=normalizeEnhancementRuntime(row,supplemental,detachmentIdByDc.get(supplemental?.detachment_id));
    return{
      ...enhancement,
      description:row.description||profileText(row.ruleProfile)||ability?.community_notes||readableEffect(ability?.effect)||undefined,
    };
  });

  const normalizedDetachments=rawDetachments.map(detachment=>{
    const supplemental=detachment.community11e||(dc.detachments||[]).find((row:any)=>canon(row.name)===canon(detachment.name));
    const ruleAbility=supplemental?.detachment_rule_id&&(dc.abilities||[]).find((ability:any)=>ability.ability_id===supplemental.detachment_rule_id);
    const ruleText=detachment.ruleText||(!/codex rules required/i.test(detachment.summary||'')?detachment.summary:'')||ruleAbility?.community_notes||readableEffect(ruleAbility?.effect)||'';
    return{
      ...detachment,
      dp:Number(detachment.dp??supplemental?.detachment_points??0),
      objective:detachment.objective||supplemental?.force_dispositions?.[0]||'',
      tags:detachment.tags||supplemental?.tags||[],
      ruleText,
      summary:ruleText||detachment.summary,
      enhancements:normalizedEnhancements.filter(enhancement=>enhancement.detachmentId===detachment.id),
      stratagemIds:detachment.stratagemIds||supplemental?.stratagem_ids||[],
    };
  }) as Detachment[];

  const normalizedStratagems=(stratagems as any[]).map((row:any)=>{
    const supplemental=(dc.stratagems||[]).find((candidate:any)=>candidate.id===row.id||canon(candidate.name)===canon(row.name))||row;
    const ability=(supplemental.ability_id&&(dc.abilities||[]).find((candidate:any)=>candidate.ability_id===supplemental.ability_id))
      ||(dc.abilities||[]).find((candidate:any)=>canon(candidate.name)===canon(row.name));
    const detachmentId=row.detachmentId||detachmentIdByDc.get(row.detachment_id||supplemental.detachment_id);
    const description=row.description||ability?.community_notes||readableEffect(ability?.effect)||undefined;
    const targetRestrictions=row.targetRestrictions||row.target_restrictions||supplemental.target_restrictions||null;
    return{
      ...row,
      id:row.id||supplemental.id,
      name:row.name||supplemental.name,
      cp:Number(row.cp??row.cp_cost??supplemental.cp_cost),
      type:row.type||supplemental.type,
      phases:row.phases||supplemental.phases||['any'],
      playerTurn:row.playerTurn||row.player_turn||supplemental.player_turn,
      timing:row.timing||supplemental.timing,
      when:row.when||supplemental.when,
      target:row.target||supplemental.target,
      effect:row.effect||supplemental.effect_text,
      description,
      detachmentId,
      targetRestrictions,
      restrictionConfidence:row.restrictionConfidence||(targetRestrictions?'structured':'unknown'),
      gameVersion:row.gameVersion||supplemental.game_version,
    } as Stratagem;
  });

  return{
    index,
    detailMap:details,
    detachments:normalizedDetachments,
    stratagems:normalizedStratagems,
    version:(await system<InstalledRulesMeta|null>('installed',null))?.datasetVersion,
  };
}

export async function readUser<T>(id:string,fallback:T):Promise<T>{
  const db=await open();
  const tx=db.transaction('user','readonly');
  const row=await request<any>(tx.objectStore('user').get(id));
  await done(tx);
  return row?.value??fallback;
}

export async function writeUser(id:string,value:unknown){
  const db=await open();
  const tx=db.transaction('user','readwrite');
  tx.objectStore('user').put({id,value});
  await done(tx);
}

export async function readBattle(){
  const db=await open();
  const tx=db.transaction('battle','readonly');
  const row=await request<any>(tx.objectStore('battle').get('active'));
  await done(tx);
  return row?.value as BattleState|null||null;
}

export async function writeBattle(value:BattleState|null){
  const db=await open();
  const tx=db.transaction('battle','readwrite');
  if(value)tx.objectStore('battle').put({id:'active',value});
  else tx.objectStore('battle').delete('active');
  await done(tx);
}

export async function migrateLegacy(){
  if(await system('legacy-migrated',false))return;
  for(const[key,id]of [['field-companion-roster-v2','roster'],['field-companion-detachments-v1','detachments']] as const){
    try{
      const existing=await readUser<unknown|null>(id,null);
      const value=localStorage.getItem(key);
      if(existing===null&&value)await writeUser(id,JSON.parse(value));
      localStorage.removeItem(key);
    }catch{}
  }
  try{
    const existing=await readBattle();
    const value=localStorage.getItem('field-companion-battle-v1');
    if(!existing&&value)await writeBattle(JSON.parse(value));
    localStorage.removeItem('field-companion-battle-v1');
  }catch{}
  await putSystem('legacy-migrated',true);
}
