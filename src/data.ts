import YAML from 'yaml';
import type {Constraint,Detachment,OptionNode,PriceTier,Profile,UnitDetail,UnitIndex} from './types';

const BS_URL='https://raw.githubusercontent.com/BSData/wh40k-11e/main/Necrons.json';
const MFM_URL='https://raw.githubusercontent.com/BSData/wh40k-11e-mfm/main/data/necrons.yaml';
const CACHE_MS=24*60*60*1000;

const normName=(value:string)=>value.toLowerCase()
  .replace(/[’‘]/g,"'")
  .replace(/\[legends\]/g,'')
  .replace(/[^a-z0-9]+/g,' ')
  .trim();

function textMap(chars:any[]|undefined){
  const out:Record<string,string>={};
  for(const char of chars||[])out[char.name||'']=char.$text??'';
  return out;
}

function compactProfile(profile:any):Profile{
  return {
    id:profile.id,
    name:profile.name,
    type:profile.typeName,
    characteristics:textMap(profile.characteristics),
  };
}

function walkProfiles(node:any,out:Profile[]){
  for(const profile of node.profiles||[])out.push(compactProfile(profile));
  for(const child of node.selectionEntries||[])walkProfiles(child,out);
  for(const group of node.selectionEntryGroups||[])walkProfiles(group,out);
}

function compactConstraints(node:any):Constraint[]{
  return (node.constraints||[]).map((constraint:any)=>({
    type:constraint.type,
    value:Number(constraint.value),
    scope:constraint.scope,
    childId:constraint.childId,
  }));
}

function compactOptions(node:any,depth=0):OptionNode[]{
  if(depth>8)return[];
  const children=[
    ...(node.selectionEntries||[]).map((entry:any)=>({...entry,_kind:'entry'})),
    ...(node.selectionEntryGroups||[]).map((group:any)=>({...group,_kind:'group'})),
  ];
  return children
    .filter((child:any)=>!child.hidden)
    .map((child:any)=>({
      id:child.id,
      name:child.name,
      kind:child._kind,
      type:child.type,
      hidden:Boolean(child.hidden),
      costs:(child.costs||[]).map((cost:any)=>({
        name:cost.name,
        type:cost.typeId,
        value:Number(cost.value),
      })),
      constraints:compactConstraints(child),
      profiles:(child.profiles||[]).map(compactProfile),
      options:compactOptions(child,depth+1),
    }));
}

function dedupeProfiles(profiles:Profile[]){
  return Array.from(new Map(profiles.map(profile=>[
    profile.id||`${profile.type}:${profile.name}:${JSON.stringify(profile.characteristics)}`,
    profile,
  ])).values());
}

function normalizeBS(raw:any):UnitDetail[]{
  const catalogue=raw.catalogue||{};
  return (catalogue.sharedSelectionEntries||[])
    .filter((entry:any)=>{
      const categories=(entry.categoryLinks||[]).map((category:any)=>category.name);
      return categories.includes('Faction: Necrons')
        && (entry.profiles||[]).some((profile:any)=>profile.typeName==='Unit');
    })
    .map((entry:any)=>{
      const profiles:Profile[]=[];
      walkProfiles(entry,profiles);
      const unitProfile=profiles.find(profile=>profile.type==='Unit'&&profile.name===entry.name)
        ||profiles.find(profile=>profile.type==='Unit');
      return {
        id:entry.id,
        name:entry.name,
        legends:/\[Legends\]/i.test(entry.name),
        categories:(entry.categoryLinks||[]).map((category:any)=>category.name).filter(Boolean),
        stats:unitProfile?.characteristics||{},
        pricing:null,
        role:null,
        attachTo:[],
        weaponCount:profiles.filter(profile=>profile.type==='Ranged Weapons'||profile.type==='Melee Weapons').length,
        abilityCount:profiles.filter(profile=>profile.type==='Abilities').length,
        abilities:dedupeProfiles(profiles.filter(profile=>profile.type==='Abilities')),
        weapons:dedupeProfiles(profiles.filter(profile=>profile.type==='Ranged Weapons'||profile.type==='Melee Weapons')),
        rules:(entry.infoLinks||[]).map((link:any)=>({
          name:link.name,
          type:link.type,
          targetId:link.targetId,
        })),
        options:compactOptions(entry),
      };
    });
}

async function getCachedText(key:string,url:string){
  const cached=localStorage.getItem(key);
  if(cached){
    try{
      const parsed=JSON.parse(cached);
      if(Date.now()-parsed.ts<CACHE_MS)return parsed.payload as string;
    }catch{/* fetch a clean copy */}
  }
  const response=await fetch(url,{cache:'no-cache'});
  if(!response.ok)throw new Error(`Failed to fetch rules data: ${response.status}`);
  const payload=await response.text();
  try{localStorage.setItem(key,JSON.stringify({ts:Date.now(),payload}))}catch{/* service worker still caches it */}
  return payload;
}

const summaries:Record<string,{ruleName:string;summary:string}>={
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
  "The Phaeron'S Armoury":{ruleName:'Armoury Protocols',summary:'Titanic, Fly and Hypercrypt-oriented elements receive the detachment-specific mobility and support package.'},
};

export async function loadNecrons(){
  const[bsText,mfmText]=await Promise.all([
    getCachedText('necrons-bs-v2',BS_URL),
    getCachedText('necrons-mfm-v2',MFM_URL),
  ]);
  const details=normalizeBS(JSON.parse(bsText));
  const mfm=YAML.parse(mfmText);
  const mfmMap=new Map((mfm.units||[]).map((unit:any)=>[normName(unit.name),unit]));
  const detailMap=new Map<string,UnitDetail>();
  const index:UnitIndex[]=details.map(detail=>{
    const points:any=mfmMap.get(normName(detail.name));
    const enriched:UnitDetail={
      ...detail,
      pricing:points?.pricing||null,
      role:points?.role||null,
      attachTo:points?.attachTo||[],
    };
    detailMap.set(detail.id,enriched);
    const{abilities,weapons,rules,options,...summary}=enriched;
    return summary;
  });
  const detachments:Detachment[]=(mfm.detachments||[]).map((detachment:any)=>({
    ...detachment,
    ruleName:summaries[detachment.name]?.ruleName||'Detachment Rule',
    summary:summaries[detachment.name]?.summary||'Detachment-specific rules from the current Necron repository set.',
  }));
  return {index,detailMap,detachments,version:mfm.version||null};
}

function occurrenceMatches(range:string|undefined,occurrence:number){
  if(!range)return false;
  const exact=range.match(/^\[(\d+),(\d+)\]$/);
  if(exact)return occurrence>=Number(exact[1])&&occurrence<=Number(exact[2]);
  const open=range.match(/^\[(\d+),\)$/);
  return Boolean(open&&occurrence>=Number(open[1]));
}

export function tierForOccurrence(unit:UnitIndex,occurrence:number):PriceTier|undefined{
  return unit.pricing?.find(tier=>occurrenceMatches(tier.range,occurrence))||unit.pricing?.[0];
}

export function availableSizes(unit:UnitIndex){
  return Array.from(new Set((unit.pricing||[]).flatMap(tier=>tier.costs||[]).map(cost=>cost.models))).sort((a,b)=>a-b);
}

export function defaultSize(unit:UnitIndex){
  return availableSizes(unit)[0]||1;
}

export function pointsFor(unit:UnitIndex,models=defaultSize(unit),occurrence=1){
  const costs=tierForOccurrence(unit,occurrence)?.costs||[];
  return costs.find(cost=>cost.models===models)?.points??costs[0]?.points??0;
}

export function normalizeUnitName(value:string){return normName(value)}

export function isCategory(unit:UnitIndex,category:string){
  const target=category.toLowerCase();
  return unit.categories.some(value=>value.toLowerCase().includes(target));
}

export function synergy(detachmentNames:string[],unit:UnitIndex){
  const categories=unit.categories.map(value=>value.toLowerCase());
  const name=unit.name.toLowerCase();
  const output:string[]=[];
  for(const detachment of detachmentNames){
    const value=detachment.toLowerCase();
    if(value.includes('cursed')&&categories.some(category=>category.includes('destroyer cult')))output.push(`${detachment}: Destroyer Cult`);
    else if(value.includes('cryptek')&&categories.some(category=>category.includes('cryptek')))output.push(`${detachment}: Cryptek`);
    else if(value.includes('canoptek')&&categories.some(category=>category.includes('canoptek')))output.push(`${detachment}: Canoptek`);
    else if(value.includes('pantheon')&&categories.some(category=>category.includes('monster')))output.push(`${detachment}: Monster`);
    else if(value.includes('obeisance')&&categories.some(category=>/noble|lychguard|triarch/.test(category)))output.push(`${detachment}: Noble/Lychguard/Triarch`);
    else if(value.includes('skyshroud')&&name.includes('tomb blade'))output.push(`${detachment}: Tomb Blade`);
    else if(value.includes('hand of the dynasty')&&(name.includes('immortal')||name.includes('necron warrior')))output.push(`${detachment}: Battleline shooter`);
    else if(value.includes('starshatter'))output.push(`${detachment}: conditional objective benefit`);
    else if(value.includes('awakened')&&(unit.attachTo?.length||unit.role==='leader'||unit.role==='support'))output.push(`${detachment}: leader synergy`);
  }
  return output;
}
