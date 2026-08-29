import {loadRules} from './db';
import type {PriceTier,UnitDetail,UnitIndex} from './types';

const battleSnapshotCache=new Map<string,UnitDetail>();

/** Reads only the installed IndexedDB rule tree. No BSData request is made at runtime. */
export async function loadFaction(){
  const data=await loadRules();
  battleSnapshotCache.clear();
  for(const [id,detail] of data.detailMap)battleSnapshotCache.set(id,detail);
  return data;
}

export const loadNecrons=loadFaction;

/** Fallback for rosters saved before build-time datasheet snapshots were added. */
export function battleSnapshotFor(unitId:string){return battleSnapshotCache.get(unitId);}

function occurrenceMatches(range:string|undefined,occurrence:number){if(!range)return false;const exact=range.match(/^\[(\d+),(\d+)\]$/);if(exact)return occurrence>=Number(exact[1])&&occurrence<=Number(exact[2]);const open=range.match(/^\[(\d+),\)$/);return Boolean(open&&occurrence>=Number(open[1]));}
export function tierForOccurrence(unit:UnitIndex,occurrence:number):PriceTier|undefined{return unit.pricing?.find(tier=>occurrenceMatches(tier.range,occurrence))||unit.pricing?.[0];}
export function availableSizes(unit:UnitIndex){return Array.from(new Set((unit.pricing||[]).flatMap(tier=>tier.costs||[]).map(cost=>cost.models))).sort((a,b)=>a-b);}
export function defaultSize(unit:UnitIndex){return availableSizes(unit)[0]||1;}
export function pointsFor(unit:UnitIndex,models=defaultSize(unit),occurrence=1){const costs=tierForOccurrence(unit,occurrence)?.costs||[];return costs.find(cost=>cost.models===models)?.points??costs[0]?.points??0;}
export function normalizeUnitName(value:string){return value.toLowerCase().replace(/[’‘]/g,"'").replace(/\[legends\]/g,'').replace(/[^a-z0-9]+/g,' ').trim();}
export function isCategory(unit:UnitIndex,category:string){return unit.categories.some(value=>value.toLowerCase().includes(category.toLowerCase()));}
/** Uses an explicit unit keyword only; never guesses a Dynasty from a character's lore. */
export function subfactionKeyword(unit:UnitIndex){
  const preferred=['Destroyer Cult','Canoptek','Triarch','Cryptek'];
  return preferred.find(keyword=>unit.categories.some(category=>category.toLowerCase()===keyword.toLowerCase()))
    ||(unit.categories.some(category=>category.toLowerCase().startsWith("c'tan shard"))?"C'tan":undefined);
}
export function synergy(detachmentNames:string[],unit:UnitIndex){const categories=unit.categories.map(value=>value.toLowerCase()),name=unit.name.toLowerCase(),output:string[]=[];for(const detachment of detachmentNames){const value=detachment.toLowerCase();if(value.includes('cursed')&&categories.some(c=>c.includes('destroyer cult')))output.push(`${detachment}: Destroyer Cult`);else if(value.includes('cryptek')&&categories.some(c=>c.includes('cryptek')))output.push(`${detachment}: Cryptek`);else if(value.includes('canoptek')&&categories.some(c=>c.includes('canoptek')))output.push(`${detachment}: Canoptek`);else if(value.includes('pantheon')&&categories.some(c=>c.includes('monster')))output.push(`${detachment}: Monster`);else if(value.includes('skyshroud')&&name.includes('tomb blade'))output.push(`${detachment}: Tomb Blade`);else if(value.includes('hand of the dynasty')&&(name.includes('immortal')||name.includes('necron warrior')))output.push(`${detachment}: Battleline shooter`);else if(value.includes('starshatter'))output.push(`${detachment}: conditional objective benefit`);else if(value.includes('awakened')&&(unit.attachTo?.length||unit.role==='leader'||unit.role==='support'))output.push(`${detachment}: leader synergy`);}return output;}
