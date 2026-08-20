import YAML from 'yaml';
import type {Detachment,UnitDetail,UnitIndex} from './types';
const BS_URL='https://raw.githubusercontent.com/BSData/wh40k-11e/main/Necrons.json';
const MFM_URL='https://raw.githubusercontent.com/BSData/wh40k-11e-mfm/main/data/necrons.yaml';
const CACHE_MS=24*60*60*1000;
function normName(s:string){return s.toLowerCase().replace(/[’‘]/g,"'").replace(/\[legends\]/g,'').replace(/[^a-z0-9]+/g,' ').trim()}
function textMap(chars:any[]|undefined){const out:Record<string,string>={};for(const c of chars||[])out[c.name||'']=c.$text??'';return out}
function compactProfile(p:any){return{id:p.id,name:p.name,type:p.typeName,characteristics:textMap(p.characteristics)}}
function walkProfiles(node:any,out:any[]){for(const p of node.profiles||[])out.push(compactProfile(p));for(const x of node.selectionEntries||[])walkProfiles(x,out);for(const g of node.selectionEntryGroups||[])walkProfiles(g,out)}
function compactOptions(node:any,depth=0):any[]{if(depth>5)return[];const children=[...(node.selectionEntries||[]).map((x:any)=>({...x,_kind:'entry'})),...(node.selectionEntryGroups||[]).map((x:any)=>({...x,_kind:'group'}))];return children.map((c:any)=>({id:c.id,name:c.name,kind:c._kind,type:c.type,hidden:!!c.hidden,costs:(c.costs||[]).map((x:any)=>({name:x.name,type:x.typeId,value:x.value})),profiles:(c.profiles||[]).map(compactProfile),options:compactOptions(c,depth+1)}))}
function normalizeBS(raw:any){const cat=raw.catalogue||{};const units=(cat.sharedSelectionEntries||[]).filter((e:any)=>{const cats=(e.categoryLinks||[]).map((c:any)=>c.name);return cats.includes('Faction: Necrons')&&(e.profiles||[]).some((p:any)=>p.typeName==='Unit')}).map((e:any)=>{const ps:any[]=[];walkProfiles(e,ps);const up=ps.find(p=>p.type==='Unit'&&p.name===e.name)||ps.find(p=>p.type==='Unit');const dedupe=(arr:any[])=>Array.from(new Map(arr.map(x=>[x.id||`${x.type}:${x.name}:${JSON.stringify(x.characteristics)}`,x])).values());return{id:e.id,name:e.name,legends:/\[Legends\]/i.test(e.name),categories:(e.categoryLinks||[]).map((c:any)=>c.name).filter(Boolean),stats:up?.characteristics||{},abilities:dedupe(ps.filter(p=>p.type==='Abilities')),weapons:dedupe(ps.filter(p=>p.type==='Ranged Weapons'||p.type==='Melee Weapons')),rules:(e.infoLinks||[]).map((l:any)=>({name:l.name,type:l.type,targetId:l.targetId})),options:compactOptions(e)}});return{revision:cat.revision,units}}
async function getCachedText(key:string,url:string){const cached=localStorage.getItem(key);if(cached){try{const p=JSON.parse(cached);if(Date.now()-p.ts<CACHE_MS)return p.payload}catch{}}const res=await fetch(url,{cache:'no-cache'});if(!res.ok)throw new Error(`Failed to fetch ${url}: ${res.status}`);const text=await res.text();localStorage.setItem(key,JSON.stringify({ts:Date.now(),payload:text}));return text}
export async function loadNecrons(){const[bsText,mfmText]=await Promise.all([getCachedText('necrons-bs-v1',BS_URL),getCachedText('necrons-mfm-v1',MFM_URL)]);const bs=normalizeBS(JSON.parse(bsText));const mfm=YAML.parse(mfmText);const mfmMap=new Map((mfm.units||[]).map((u:any)=>[normName(u.name),u]));const index:UnitIndex[]=bs.units.map((u:any)=>{const mu:any=mfmMap.get(normName(u.name));return{id:u.id,name:u.name,legends:u.legends,categories:u.categories,stats:u.stats,pricing:mu?.pricing||null,role:mu?.role||null,attachTo:mu?.attachTo||[],weaponCount:u.weapons.length,abilityCount:u.abilities.length}});const detailMap=new Map<string,UnitDetail>(bs.units.map((u:any)=>{const mu:any=mfmMap.get(normName(u.name));return[u.id,{...u,pricing:mu?.pricing||null,role:mu?.role||null,attachTo:mu?.attachTo||[]}]}));const summaries:Record<string,{ruleName:string;summary:string}>={
'Awakened Dynasty':{ruleName:'Command Protocols',summary:'Led units become more accurate while a Necrons Character remains attached.'},
'Annihilation Legion':{ruleName:'Annihilation Protocol',summary:'Destroyer Cult and Flayed Ones gain stronger charge pressure, while Destroyer Cult shooting rewards firing at the closest eligible target.'},
'Canoptek Court':{ruleName:'Power Matrix',summary:'Cryptek and Canoptek units gain offensive benefits while fighting inside your Power Matrix.'},
'Obeisance Phalanx':{ruleName:'Worthy Foes',summary:'Nominate an enemy target each Command phase; Noble, Lychguard and Triarch units become better at wounding it.'},
'Hypercrypt Legion':{ruleName:'Hyperphasing',summary:'Eligible units can phase into Strategic Reserves at the end of the opponent turn, scaling with battle size.'},
'Starshatter Arsenal':{ruleName:'Relentless Onslaught',summary:'Necrons gain better accuracy into objective targets; eligible Vehicle and Mounted ranged weapons gain Assault.'},
'Cryptek Conclave':{ruleName:'Technosorcerous Augmentations',summary:'Cryptek shooting gains Assault and flexible situational weapon abilities.'},
'Cursed Legion':{ruleName:'Cold Fervour',summary:'Destroyer Cult weapons gain Strength and can spread a temporary Strength bonus after destroying or heavily damaging enemy units.'},
'Pantheon Of Woe':{ruleName:'Cosmic Distortion',summary:'Necron Monsters project distortion fields that make nearby enemies easier to penetrate.'},
'Pantheon of Woe':{ruleName:'Cosmic Distortion',summary:'Necron Monsters project distortion fields that make nearby enemies easier to penetrate.'},
'Hand Of The Dynasty':{ruleName:'Dynastic Advance',summary:'Immortals and Necron Warriors gain stronger mobile-shooting and action flexibility.'},
'Skyshroud Spearhead':{ruleName:'Skyshroud Assault',summary:'Tomb Blade-focused forces gain improved reserve and ingress pressure.'},
"The Phaeron'S Armoury":{ruleName:'Armoury Protocols',summary:'Titanic/Fly and Hypercrypt-oriented elements receive the detachment-specific mobility and support package.'}};const detachments:Detachment[]=(mfm.detachments||[]).map((d:any)=>({...d,ruleName:summaries[d.name]?.ruleName||'Detachment Rule',summary:summaries[d.name]?.summary||'Detachment-specific rules from the current Necron repository set.'}));return{index,detailMap,detachments,version:mfm.version||null}}
function tierForOccurrence(u:UnitIndex,occurrence:number){
  const tiers=u.pricing||[];
  return tiers.find(t=>{
    const match=t.range?.match(/^\[(\d+),(\d*)\]?$|^\[(\d+),\)$/);
    if(!match)return false;
    const min=Number(match[1]||match[3]);
    const max=match[2]?Number(match[2]):Infinity;
    return occurrence>=min&&occurrence<=max;
  })||tiers[0];
}
export function availableSizes(u:UnitIndex){
  return Array.from(new Set((u.pricing||[]).flatMap(t=>t.costs||[]).map(c=>c.models))).sort((a,b)=>a-b);
}
export function defaultSize(u:UnitIndex){return availableSizes(u)[0]||1}
export function pointsFor(u:UnitIndex,models=defaultSize(u),occurrence=1){
  const costs=tierForOccurrence(u,occurrence)?.costs||[];
  return costs.find(c=>c.models===models)?.points??costs[0]?.points??0;
}
export function synergy(detachmentNames:string[],u:UnitIndex){const cats=u.categories.map(x=>x.toLowerCase()),name=u.name.toLowerCase(),out:string[]=[];for(const det of detachmentNames){const d=det.toLowerCase();if(d.includes('cursed')&&cats.some(c=>c.includes('destroyer cult')))out.push(`${det}: Destroyer Cult`);else if(d.includes('cryptek')&&cats.some(c=>c.includes('cryptek')))out.push(`${det}: Cryptek`);else if(d.includes('canoptek')&&cats.some(c=>c.includes('canoptek')))out.push(`${det}: Canoptek`);else if(d.includes('pantheon')&&cats.some(c=>c.includes('monster')))out.push(`${det}: Monster`);else if(d.includes('obeisance')&&cats.some(c=>/noble|lychguard|triarch/.test(c)))out.push(`${det}: Noble/Lychguard/Triarch`);else if(d.includes('skyshroud')&&name.includes('tomb blade'))out.push(`${det}: Tomb Blade`);else if(d.includes('hand of the dynasty')&&(name.includes('immortal')||name.includes('necron warrior')))out.push(`${det}: Battleline shooter`);else if(d.includes('starshatter'))out.push(`${det}: conditional objective benefit`);else if(d.includes('awakened')&&(u.attachTo?.length||u.role==='leader'||u.role==='support'))out.push(`${det}: leader synergy`)}return out}
