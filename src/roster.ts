import {availableSizes,isCategory,normalizeUnitName,pointsFor} from './data';
import type {Detachment,OptionNode,RosterUnit,UnitDetail,UnitIndex,ValidationIssue,WargearConfig} from './types';

export type ChoiceGroup={id:string;name:string;options:OptionNode[]};
export type ModelGroup={id:string;name:string;options:OptionNode[]};

export function configurationGroups(detail:UnitDetail|undefined){
  const choices:ChoiceGroup[]=[];
  const modelGroups:ModelGroup[]=[];
  function walk(nodes:OptionNode[]){
    for(const node of nodes){
      const visible=node.options.filter(option=>!option.hidden);
      if(node.kind==='group'&&visible.length>1){
        if(visible.every(option=>option.type==='model'))modelGroups.push({id:node.id,name:node.name,options:visible});
        else if(!visible.some(option=>option.type==='model'))choices.push({id:node.id,name:node.name,options:visible});
      }
      walk(visible);
    }
  }
  walk(detail?.options||[]);
  return {choices,modelGroups};
}

export function defaultWargear(detail:UnitDetail|undefined,models:number):WargearConfig{
  const{choices,modelGroups}=configurationGroups(detail);
  const config:WargearConfig={choices:{},modelCounts:{}};
  for(const group of choices)config.choices[group.id]=group.options[0]?.id||'';
  for(const group of modelGroups){
    group.options.forEach((option,index)=>{
      config.modelCounts[option.id]=index===0?models:0;
    });
  }
  return config;
}

export function createRosterUnit(unit:UnitIndex,detail:UnitDetail|undefined):RosterUnit{
  const models=availableSizes(unit)[0]||1;
  return {
    instanceId:crypto.randomUUID(),
    unitId:unit.id,
    models,
    wargear:defaultWargear(detail,models),
    stats:{...(detail?.stats||unit.stats)},
    weapons:(detail?.weapons||[]).map(profile=>({...profile,characteristics:{...profile.characteristics}})),
    abilities:(detail?.abilities||[]).map(profile=>({...profile,characteristics:{...profile.characteristics}})),
  };
}

export function rosterPoints(roster:RosterUnit[],units:UnitIndex[],detachments:Detachment[]){
  const occurrences=new Map<string,number>();
  const enhancementPoints=new Map(
    detachments.flatMap(detachment=>detachment.enhancements||[]).map(enhancement=>[enhancement.name,enhancement.points]),
  );
  return roster.reduce((total,entry)=>{
    const unit=units.find(candidate=>candidate.id===entry.unitId);
    if(!unit)return total;
    const occurrence=(occurrences.get(unit.id)||0)+1;
    occurrences.set(unit.id,occurrence);
    return total+pointsFor(unit,entry.models,occurrence)+(entry.enhancement?enhancementPoints.get(entry.enhancement)||0:0);
  },0);
}

/** Keeps a roster from retaining an Enhancement after its owning detachment is deselected. */
export function removeUnavailableEnhancements(roster:RosterUnit[],detachments:Detachment[]){
  const available=new Set(detachments.flatMap(detachment=>detachment.enhancements||[]).map(enhancement=>enhancement.name));
  return roster.map(entry=>entry.enhancement&&!available.has(entry.enhancement)?{...entry,enhancement:undefined}:entry);
}

export function validateRoster(args:{
  roster:RosterUnit[];
  units:UnitIndex[];
  details:Map<string,UnitDetail>;
  detachments:Detachment[];
  selectedDetachments:string[];
  pointsLimit:number;
}):ValidationIssue[]{
  const{roster,units,details,detachments,selectedDetachments,pointsLimit}=args;
  const issues:ValidationIssue[]=[];
  const unitFor=(entry:RosterUnit)=>units.find(unit=>unit.id===entry.unitId);
  const selected=detachments.filter(detachment=>selectedDetachments.includes(detachment.name));
  const totalDP=selected.reduce((sum,detachment)=>sum+detachment.dp,0);
  const points=rosterPoints(roster,units,selected);

  if(!roster.length)issues.push({level:'error',message:'Add at least one unit.'});
  if(!selected.length)issues.push({level:'error',message:'Select at least one detachment.'});
  if(totalDP>3)issues.push({level:'error',message:'Selected detachments exceed the 3 DP limit.'});
  const uniquePackages=selected.map(detachment=>detachment.unique).filter(Boolean) as string[];
  const duplicatePackages=uniquePackages.filter((name,index,array)=>array.indexOf(name)!==index);
  if(duplicatePackages.length)issues.push({level:'error',message:`Only one ${duplicatePackages[0]} detachment package can be selected.`});
  if(points>pointsLimit)issues.push({level:'error',message:`Army is ${points-pointsLimit} points over the ${pointsLimit}-point limit.`});

  const characters=roster.filter(entry=>{
    const unit=unitFor(entry);
    return Boolean(unit&&isCategory(unit,'character'));
  });
  if(!characters.length)issues.push({level:'error',message:'The army must include at least one Character.'});
  const warlords=roster.filter(entry=>entry.warlord);
  if(warlords.length!==1)issues.push({level:'error',message:'Select exactly one Character as your Warlord.'});
  for(const warlord of warlords){
    const unit=unitFor(warlord);
    if(!unit||!isCategory(unit,'character'))issues.push({level:'error',message:'The Warlord must be a Character.',unitInstanceId:warlord.instanceId});
  }

  const copies=new Map<string,RosterUnit[]>();
  for(const entry of roster)copies.set(entry.unitId,[...(copies.get(entry.unitId)||[]),entry]);
  for(const[unitId,entries]of copies){
    const unit=units.find(candidate=>candidate.id===unitId);
    if(!unit)continue;
    const limit=isCategory(unit,'battleline')||isCategory(unit,'dedicated transport')?6:3;
    if(entries.length>limit)issues.push({level:'error',message:`${unit.name} exceeds its ${limit}-unit datasheet limit.`});
    if(isCategory(unit,'epic hero')&&entries.length>1)issues.push({level:'error',message:`Only one ${unit.name} Epic Hero can be included.`});
  }

  const selectedEnhancements=selected.flatMap(detachment=>detachment.enhancements||[]);
  const enhancementNames=new Set(selectedEnhancements.map(enhancement=>enhancement.name));
  const assigned=roster.filter(entry=>entry.enhancement);
  if(assigned.length>3)issues.push({level:'error',message:'An army can include no more than three Enhancements.'});
  const duplicates=assigned.map(entry=>entry.enhancement!).filter((name,index,array)=>array.indexOf(name)!==index);
  if(duplicates.length)issues.push({level:'error',message:'Each Enhancement can only be included once.'});
  for(const entry of assigned){
    const unit=unitFor(entry);
    if(!enhancementNames.has(entry.enhancement!))issues.push({level:'error',message:'Assigned Enhancement is not from a selected detachment.',unitInstanceId:entry.instanceId});
    if(!unit||!isCategory(unit,'character')||isCategory(unit,'epic hero'))issues.push({level:'error',message:'Enhancements can only be assigned to non-Epic-Hero Characters.',unitInstanceId:entry.instanceId});
  }

  const attachmentTargets=new Set<string>();
  for(const entry of roster.filter(candidate=>candidate.attachedTo)){
    const leader=unitFor(entry);
    const target=roster.find(candidate=>candidate.instanceId===entry.attachedTo);
    const targetUnit=target&&unitFor(target);
    const allowed=(leader?.attachTo||[]).map(normalizeUnitName);
    if(!leader||!targetUnit||!allowed.includes(normalizeUnitName(targetUnit.name))){
      issues.push({level:'error',message:'Leader is attached to an incompatible bodyguard unit.',unitInstanceId:entry.instanceId});
    }
    if(attachmentTargets.has(entry.attachedTo!))issues.push({level:'error',message:'Only one Leader is assigned to this bodyguard unit.',unitInstanceId:entry.instanceId});
    attachmentTargets.add(entry.attachedTo!);
  }

  for(const entry of roster){
    const unit=unitFor(entry);
    if(!unit)continue;
    if(!availableSizes(unit).includes(entry.models))issues.push({level:'error',message:`Choose a valid unit size for ${unit.name}.`,unitInstanceId:entry.instanceId});
    const groups=configurationGroups(details.get(entry.unitId));
    for(const group of groups.choices){
      if(!group.options.some(option=>option.id===entry.wargear.choices[group.id])){
        issues.push({level:'error',message:`Choose an option for ${group.name}.`,unitInstanceId:entry.instanceId});
      }
    }
    for(const group of groups.modelGroups){
      const counts=group.options.map(option=>entry.wargear.modelCounts[option.id]||0);
      if(counts.some(count=>count<0)||counts.reduce((sum,count)=>sum+count,0)!==entry.models){
        issues.push({level:'error',message:`${group.name} loadout counts must equal the ${entry.models}-model unit size.`,unitInstanceId:entry.instanceId});
      }
    }
  }
  return issues;
}

export function compatibleBodyguards(leader:UnitIndex,roster:RosterUnit[],units:UnitIndex[]){
  const allowed=(leader.attachTo||[]).map(normalizeUnitName);
  return roster.filter(entry=>{
    const unit=units.find(candidate=>candidate.id===entry.unitId);
    return Boolean(unit&&allowed.includes(normalizeUnitName(unit.name)));
  });
}