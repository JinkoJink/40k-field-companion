import type {BattleState,Detachment,PackageManifest,RosterUnit,RulesManifest,Stratagem,UnitDetail,UnitIndex} from './types';

const DB='field-companion';
const VERSION=1;
const RULE_STORES=['factions','units','profiles','weapons','abilities','keywords','detachments','enhancements','stratagems','points','leaders','source','dependencies','searchIndex'] as const;
type RuleStore=typeof RULE_STORES[number];
const PACKAGE_STORE:Record<string,RuleStore>={units:'units',profiles:'profiles',weapons:'weapons',abilities:'abilities',keywords:'keywords',detachments:'detachments',enhancements:'enhancements',stratagems:'stratagems',points:'points',leaders:'leaders',source:'source'};

function open(){return new Promise<IDBDatabase>((resolve,reject)=>{
  const request=indexedDB.open(DB,VERSION);
  request.onupgradeneeded=event=>{const db=request.result;
    for(const name of ['system',...RULE_STORES,'user','battle','staging'])if(!db.objectStoreNames.contains(name))db.createObjectStore(name,{keyPath:'id'});
    // Future schema migrations are additive and run in this transaction. User and battle
    // stores are never cleared, so a rules-schema upgrade cannot wipe armies or games.
    if(event.oldVersion<1){/* initial durable local tree */}
  };
  request.onsuccess=()=>resolve(request.result); request.onerror=()=>reject(request.error);
});}
function done(tx:IDBTransaction){return new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error);});}
function request<T>(r:IDBRequest<T>){return new Promise<T>((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
const json=(value:unknown)=>JSON.stringify(value);
async function digest(value:string){const bytes=new TextEncoder().encode(value);const hash=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('');}
function packageUrl(file:string, remote:boolean){return remote?`https://raw.githubusercontent.com/JinkoJink/40k-field-companion/main/${file}`:`./${file}`;}

export async function system<T>(id:string,fallback:T):Promise<T>{const db=await open();const tx=db.transaction('system','readonly');const record=await request<any>(tx.objectStore('system').get(id));await done(tx);return record?.value??fallback;}
export async function putSystem(id:string,value:unknown){const db=await open();const tx=db.transaction('system','readwrite');tx.objectStore('system').put({id,value});await done(tx);}
async function getAll<T>(store:string):Promise<T[]>{const db=await open();const tx=db.transaction(store,'readonly');const rows=await request<T[]>(tx.objectStore(store).getAll());await done(tx);return rows;}

function normalizeRecord(packageName:string,row:any,index:number){
  if(row.id)return row;
  if(packageName==='points')return {...row,id:`points:${row.unitId}`};
  if(packageName==='profiles')return {...row,id:`profile:${row.unitId}`};
  if(packageName==='leaders')return {...row,id:`leader:${row.leaderUnitId}`};
  if(packageName==='source')return {...row,id:`source:${index}`};
  return {...row,id:`${packageName}:${index}`};
}
export function validatePackagePayload(name:string,payload:any){
  if(payload?.schemaVersion!==1||payload?.package!==name||!Array.isArray(payload.records))throw new Error(`Invalid ${name} package schema.`);
  const seen=new Set<string>();
  for(const [index,raw] of payload.records.entries()){const row=normalizeRecord(name,raw,index);if(!row.id||seen.has(row.id))throw new Error(`Duplicate or missing stable ID in ${name}.`);seen.add(row.id);}
}
export function changedPackageNames(local:RulesManifest,remote:RulesManifest){return Object.entries(remote.factions.necrons.packages).filter(([name,info])=>local.factions.necrons.packages[name]?.hash!==info.hash).map(([name])=>name);}
async function fetchPackage(info:PackageManifest, remote:boolean){
  const response=await fetch(packageUrl(info.file,remote),{cache:remote?'no-store':'force-cache'});
  if(!response.ok)throw new Error(`Could not download ${info.file}.`);
  const body=await response.text(); if(await digest(body.trimEnd())!==info.hash)throw new Error(`Hash mismatch for ${info.file}.`);
  const parsed=JSON.parse(body); validatePackagePayload(parsed.package,parsed); return parsed;
}
async function validationContext(changed:Record<string,any>){
  const units=(changed.units?.records||await getAll<any>('units')).map((x:any,i:number)=>normalizeRecord('units',x,i));
  const unitIds=new Set(units.map((x:any)=>x.id)); if(!unitIds.size)throw new Error('Rules update has no units.');
  const detachments=(changed.detachments?.records||await getAll<any>('detachments')).map((x:any,i:number)=>normalizeRecord('detachments',x,i));
  const detachmentIds=new Set(detachments.map((x:any)=>x.id));
  const enhancements=(changed.enhancements?.records||await getAll<any>('enhancements')).map((x:any,i:number)=>normalizeRecord('enhancements',x,i));
  for(const row of enhancements)if(!detachmentIds.has(row.detachmentId))throw new Error(`Invalid detachment reference: ${row.detachmentId}.`);
  for(const name of ['profiles','weapons','abilities','points','leaders']){
    const rows=(changed[name]?.records||await getAll<any>(PACKAGE_STORE[name])).map((x:any,i:number)=>normalizeRecord(name,x,i));
    for(const row of rows){if(name==='profiles'&&(!row.characteristics||typeof row.characteristics!=='object'||!Object.keys(row.characteristics).length))throw new Error(`Malformed stat profile: ${row.id}.`);if(row.unitId&&!unitIds.has(row.unitId))throw new Error(`Broken ${name} reference: ${row.unitId}.`);if(row.leaderUnitId&&!unitIds.has(row.leaderUnitId))throw new Error(`Broken leader reference: ${row.leaderUnitId}.`);for(const id of row.targetUnitIds||[])if(!unitIds.has(id))throw new Error(`Missing leader target: ${id}.`);}
  }
}
async function install(manifest:RulesManifest, packages:Record<string,any>, mode:'bootstrap'|'update'){
  await validationContext(packages);
  const db=await open(); const stores=['system','staging','dependencies','searchIndex',...new Set(Object.keys(packages).map(name=>PACKAGE_STORE[name]))]; const tx=db.transaction(stores,'readwrite');
  const staging=tx.objectStore('staging');
  for(const [name,payload] of Object.entries(packages))staging.put({id:`${manifest.datasetVersion}:${name}`,payload});
  for(const [name,payload] of Object.entries(packages)){
    const store=tx.objectStore(PACKAGE_STORE[name]); store.clear();
    payload.records.forEach((row:any,index:number)=>store.put(normalizeRecord(name,row,index)));
  }
  const dependencies=tx.objectStore('dependencies'); const search=tx.objectStore('searchIndex');
  if(packages.units||packages.keywords||packages.weapons||packages.abilities){dependencies.clear();search.clear();const allUnits=packages.units?.records||await request<any[]>(tx.objectStore('units').getAll());for(const unit of allUnits){dependencies.put({id:unit.id,package:'units',dependsOn:['profiles','weapons','abilities','points','leaders','keywords']});search.put({id:unit.id,text:json(unit).toLowerCase()});}}
  tx.objectStore('system').put({id:'installed',value:{datasetVersion:manifest.datasetVersion,schemaVersion:manifest.schemaVersion,packages:manifest.factions.necrons.packages,lastSuccessfulUpdate:new Date().toISOString(),lastKnownGood:manifest.datasetVersion,mode}});
  for(const name of Object.keys(packages))staging.delete(`${manifest.datasetVersion}:${name}`);
  await done(tx);
}

export async function initializeRules(){
  const installed=await system<any>('installed',null); if(installed)return installed;
  const manifest=await fetch('./data/version.json').then(r=>r.json()) as RulesManifest;
  const packages:Record<string,any>={}; for(const [name,info] of Object.entries(manifest.factions.necrons.packages))packages[name]=await fetchPackage(info,false);
  await install(manifest,packages,'bootstrap'); return system<any>('installed',null);
}
export async function checkForUpdates(force=false){
  const installed=await system<any>('installed',null); if(!installed)throw new Error('Initialize local rules first.');
  if(!force&&!navigator.onLine)return {status:'offline' as const,changed:[] as string[]};
  const manifest=await fetch('https://raw.githubusercontent.com/JinkoJink/40k-field-companion/main/data/version.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Update manifest unavailable.');return r.json()}) as RulesManifest;
  if(manifest.schemaVersion>VERSION)throw new Error('This update needs a newer app database schema.');
  const changed=Object.entries(manifest.factions.necrons.packages).filter(([name,info])=>installed.packages?.[name]?.hash!==info.hash);
  if(!changed.length)return {status:'current' as const,changed:[] as string[]};
  const active=await readBattle();
  if(active?.active){await putSystem('pending-update',{manifest,changed:changed.map(([name])=>name),detectedAt:new Date().toISOString()});return {status:'deferred' as const,changed:changed.map(([name])=>name)};}
  const packages:Record<string,any>={};for(const [name,info] of changed)packages[name]=await fetchPackage(info,true);
  await install(manifest,packages,'update');return {status:'updated' as const,changed:changed.map(([name])=>name)};
}

export async function loadRules(){
  await initializeRules();
  const [units,profiles,weapons,abilities,points,leaders,detachments,enhancements,stratagems]=await Promise.all(['units','profiles','weapons','abilities','points','leaders','detachments','enhancements','stratagems'].map(getAll));
  const pointMap=new Map((points as any[]).map(x=>[x.unitId,x])); const leaderMap=new Map((leaders as any[]).map(x=>[x.leaderUnitId,x]));
  const details=new Map<string,UnitDetail>(); const index=(units as any[]).map(raw=>{const p=pointMap.get(raw.id);const profile=(profiles as any[]).find(x=>x.unitId===raw.id);const leader=leaderMap.get(raw.id);const unit:UnitDetail={...raw,stats:profile?.characteristics||{},pricing:p?.pricing||null,role:p?.role||raw.role||null,attachTo:leader?.targetNames||[],weapons:(weapons as any[]).filter(x=>x.unitId===raw.id),abilities:(abilities as any[]).filter(x=>x.unitId===raw.id)};details.set(unit.id,unit);const{weapons:_w,abilities:_a,options:_o,rules:_r,...summary}=unit;return summary;}) as UnitIndex[];
  const dets=(detachments as any[]).map(d=>({...d,enhancements:(enhancements as any[]).filter(e=>e.detachmentId===d.id)})) as Detachment[];
  return {index,detailMap:details,detachments:dets,stratagems:stratagems as Stratagem[],version:(await system<any>('installed',null))?.datasetVersion};
}

export async function readUser<T>(id:string,fallback:T):Promise<T>{const db=await open();const tx=db.transaction('user','readonly');const row=await request<any>(tx.objectStore('user').get(id));await done(tx);return row?.value??fallback;}
export async function writeUser(id:string,value:unknown){const db=await open();const tx=db.transaction('user','readwrite');tx.objectStore('user').put({id,value});await done(tx);}
export async function readBattle(){const db=await open();const tx=db.transaction('battle','readonly');const row=await request<any>(tx.objectStore('battle').get('active'));await done(tx);return row?.value as BattleState|null||null;}
export async function writeBattle(value:BattleState|null){const db=await open();const tx=db.transaction('battle','readwrite');if(value)tx.objectStore('battle').put({id:'active',value});else tx.objectStore('battle').delete('active');await done(tx);}
export async function migrateLegacy(){if(await system('legacy-migrated',false))return;for(const [key,id] of [['field-companion-roster-v2','roster'],['field-companion-detachments-v1','detachments']] as const){try{const value=localStorage.getItem(key);if(value)await writeUser(id,JSON.parse(value));}catch{/* invalid legacy state is ignored */}}try{const value=localStorage.getItem('field-companion-battle-v1');if(value)await writeBattle(JSON.parse(value));}catch{}await putSystem('legacy-migrated',true);}
