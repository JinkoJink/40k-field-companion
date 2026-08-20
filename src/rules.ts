import type {Detachment,Enhancement,Phase,RosterUnit,Stratagem,TargetRestrictions,UnitIndex} from './types';

export const canon=(value:unknown)=>String(value??'').toLowerCase().replace(/[’‘]/g,"'").replace(/[^a-z0-9]+/g,' ').trim();
const keywordSet=(unit:UnitIndex)=>new Set([unit.name,...unit.categories.map(value=>value.replace(/^Faction:\s*/i,''))].map(canon).filter(Boolean));
const exactOrContained=(unit:UnitIndex,term:string)=>{
  const wanted=canon(term); if(!wanted)return true;
  const values=keywordSet(unit); if(values.has(wanted))return true;
  return [...values].some(value=>value===wanted||value.endsWith(` ${wanted}`)||wanted.endsWith(` ${value}`));
};

export function enhancementEligible(enhancement:Enhancement,unit:UnitIndex){
  const required=(enhancement.keywordRestrictions||[]).filter(term=>canon(term)!=='dnu');
  const hasDnu=(enhancement.keywordRestrictions||[]).some(term=>canon(term)==='dnu');
  if(hasDnu&&!enhancement.allowedHosts?.length)return false;
  if(enhancement.allowedHosts?.length&&enhancement.allowedHosts.some(host=>canon(host)===canon(unit.name)))return true;
  if(required.length&&!required.every(term=>canon(term)==='necrons'||exactOrContained(unit,term)))return false;
  if(enhancement.upgrade)return true;
  const character=unit.categories.some(category=>canon(category)==='character');
  const epic=unit.categories.some(category=>canon(category)==='epic hero');
  return character&&!epic;
}

export function eligibleEnhancementsForUnit(unit:UnitIndex,enhancements:Enhancement[]|undefined){
  return (enhancements||[]).filter(enhancement=>enhancementEligible(enhancement,unit));
}

export function enhancementLimit(enhancement:Enhancement){
  if(enhancement.maxTargets&&enhancement.maxTargets>0)return enhancement.maxTargets;
  return enhancement.upgrade?3:1;
}

export function enhancementCountContribution(enhancement:Enhancement,occurrence:number){
  return enhancement.upgrade&&occurrence>1?0:1;
}

export function unitMatchesRestrictions(unit:UnitIndex,restrictions?:TargetRestrictions|null){
  if(!restrictions)return true;
  const required=restrictions.requiredKeywords||[];
  const any=restrictions.anyKeywords||[];
  const excluded=restrictions.excludedKeywords||[];
  const names=restrictions.unitNames||[];
  if(names.length&&!names.some(name=>canon(name)===canon(unit.name)||exactOrContained(unit,name)))return false;
  if(required.length&&!required.every(term=>canon(term)==='necrons'||exactOrContained(unit,term)))return false;
  if(any.length&&!any.some(term=>exactOrContained(unit,term)))return false;
  if(excluded.some(term=>exactOrContained(unit,term)))return false;
  return true;
}

export function eligibleStratagemTargets(stratagem:Stratagem,roster:RosterUnit[],units:UnitIndex[]){
  if(!stratagem.targetRestrictions)return [];
  return roster.flatMap(entry=>{
    const unit=units.find(candidate=>candidate.id===entry.unitId);
    return unit&&unitMatchesRestrictions(unit,stratagem.targetRestrictions)?[{entry,unit}]:[];
  });
}

export function stratagemAvailable(stratagem:Stratagem,phase:Phase,selectedDetachments:Detachment[],roster:RosterUnit[],units:UnitIndex[]){
  const selectedIds=new Set(selectedDetachments.flatMap(detachment=>[detachment.id||'',canon(detachment.name)]));
  if(stratagem.detachmentId&&!selectedIds.has(stratagem.detachmentId)&&!selectedIds.has(canon(stratagem.detachmentId)))return false;
  if(!stratagem.phases.includes('any')&&!stratagem.phases.includes(phase))return false;
  if(!stratagem.targetRestrictions)return true;
  return eligibleStratagemTargets(stratagem,roster,units).length>0;
}

export function detachmentAppliesToUnit(detachment:Detachment,unit:UnitIndex){
  const text=canon(`${detachment.ruleText||detachment.summary||''}`);
  if(!text)return false;
  const terms=[unit.name,...unit.categories.map(category=>category.replace(/^Faction:\s*/i,''))].map(canon).filter(term=>term&&term!=='necrons');
  return terms.some(term=>term.length>3&&text.includes(term));
}

export function ruleMetaLine(value:unknown){
  if(!value)return '';
  if(typeof value==='string')return value;
  try{return JSON.stringify(value).replace(/[{}\[\]"]/g,' ').replace(/[:,]/g,' ').replace(/\s+/g,' ').trim();}catch{return '';}
}
