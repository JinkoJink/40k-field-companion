import {battleSnapshotFor} from './data';
import type {BattleState,BattleUnitState,Detachment,Phase,RosterUnit,UnitIndex} from './types';

export const phases:Phase[]=['command','movement','shooting','charge','fight'];

type MutableWoundState={
  modelsRemaining:number;
  woundsLost:number;
  woundsRemaining?:number;
  modelWounds?:number[];
  destroyed:boolean;
};

function woundsFromStats(stats:Record<string,string>|undefined){
  const parsed=Number.parseInt(stats?.W||'1',10);
  return Number.isFinite(parsed)&&parsed>0?parsed:1;
}

function clonePlain<T>(value:T):T{
  return JSON.parse(JSON.stringify(value)) as T;
}

function initialBattleUnit(entry:RosterUnit):BattleUnitState{
  const fallback=battleSnapshotFor(entry.unitId);
  const stats=entry.stats||fallback?.stats;
  const weapons=entry.weapons||fallback?.weapons;
  const abilities=entry.abilities||fallback?.abilities;
  const woundsPerModel=woundsFromStats(stats);
  return {
    modelsRemaining:entry.models,
    woundsLost:0,
    woundsRemaining:entry.models*woundsPerModel,
    destroyed:false,
    modelWounds:Array.from({length:entry.models},()=>woundsPerModel),
    stats:stats?{...stats}:undefined,
    weapons:weapons?.map(profile=>({...profile,characteristics:{...profile.characteristics}})),
    abilities:abilities?.map(profile=>({...profile,characteristics:{...profile.characteristics}})),
    startingModels:entry.models,
    woundsPerModel,
  };
}

export function createBattleState(roster:RosterUnit[],detachments:Detachment[]=[]):BattleState{
  const rosterSnapshot=clonePlain(roster);
  return {
    active:true,
    round:1,
    phase:'command',
    cp:0,
    score:Object.fromEntries(Array.from({length:5},(_,index)=>[index+1,{primary:0,secondary:0}])),
    objectives:Array.from({length:6},(_,index)=>({
      id:`objective-${index+1}`,
      name:`Objective ${index+1}`,
      controller:'contested' as const,
    })),
    units:Object.fromEntries(rosterSnapshot.map(entry=>[entry.instanceId,initialBattleUnit(entry)])),
    notes:'',
    rosterSnapshot,
    detachmentSnapshot:clonePlain(detachments),
  };
}

/** Adds immutable roster/detachment context to a battle saved by an older app without resetting its progress. */
export function ensureBattleSnapshots(state:BattleState|null,roster:RosterUnit[],detachments:Detachment[]){
  if(!state)return state;
  if(state.rosterSnapshot?.length&&state.detachmentSnapshot)return state;
  return{
    ...state,
    rosterSnapshot:state.rosterSnapshot?.length?state.rosterSnapshot:clonePlain(roster),
    detachmentSnapshot:state.detachmentSnapshot||clonePlain(detachments),
  };
}

/**
 * Legacy helper for battles created before roster snapshots existed.
 * Snapshot-backed battles intentionally ignore later Build changes.
 */
export function syncBattleUnits(state:BattleState,roster:RosterUnit[]){
  if(state.rosterSnapshot?.length)return state;
  const next={...state,units:{...state.units}};
  const activeIds=new Set(roster.map(entry=>entry.instanceId));
  for(const entry of roster){
    if(!next.units[entry.instanceId])next.units[entry.instanceId]=initialBattleUnit(entry);
  }
  for(const id of Object.keys(next.units))if(!activeIds.has(id))delete next.units[id];
  return next;
}

export function totalScore(state:BattleState){
  return Object.values(state.score).reduce((total,round)=>total+round.primary+round.secondary,0);
}

export function unitWounds(unit:UnitIndex|undefined){
  return woundsFromStats(unit?.stats);
}

export function totalUnitWounds(models:number,woundsPerModel:number){
  return Math.max(0,models*woundsPerModel);
}

function exactModelWounds(models:number,woundsPerModel:number,woundsRemaining:number){
  let remaining=Math.max(0,Math.min(totalUnitWounds(models,woundsPerModel),woundsRemaining));
  return Array.from({length:models},()=>{
    const value=Math.min(woundsPerModel,remaining);
    remaining-=value;
    return value;
  });
}

function normalizeModelWounds(values:number[],models:number,woundsPerModel:number){
  return Array.from({length:models},(_,index)=>{
    const value=Number(values[index]??0);
    return Math.max(0,Math.min(woundsPerModel,Number.isFinite(value)?value:0));
  });
}

/**
 * Move an aggregate total while preserving model identity where exact per-model data already exists.
 * Damage continues on an already-damaged model before selecting a fresh model; restoration does the same in reverse.
 */
function adjustExistingModelWounds(values:number[],models:number,woundsPerModel:number,woundsRemaining:number){
  const modelWounds=normalizeModelWounds(values,models,woundsPerModel);
  const target=Math.max(0,Math.min(totalUnitWounds(models,woundsPerModel),woundsRemaining));
  let current=modelWounds.reduce((sum,value)=>sum+value,0);

  while(current>target){
    let index=modelWounds.findIndex(value=>value>0&&value<woundsPerModel);
    if(index<0)index=modelWounds.findIndex(value=>value>0);
    if(index<0)break;
    const loss=Math.min(modelWounds[index],current-target);
    modelWounds[index]-=loss;
    current-=loss;
  }

  while(current<target){
    let index=modelWounds.findIndex(value=>value>0&&value<woundsPerModel);
    if(index<0)index=modelWounds.findIndex(value=>value===0);
    if(index<0)break;
    const gain=Math.min(woundsPerModel-modelWounds[index],target-current);
    modelWounds[index]+=gain;
    current+=gain;
  }

  return modelWounds;
}

/** Converts previous aggregate wound trackers into the exact per-model tracker on first edit. */
export function remainingUnitWounds(state:MutableWoundState,models:number,woundsPerModel:number){
  const maximum=totalUnitWounds(models,woundsPerModel);
  if(state.modelWounds?.length){
    return Math.max(0,Math.min(maximum,state.modelWounds.reduce((sum,value)=>sum+Math.max(0,Math.min(woundsPerModel,value)),0)));
  }
  if(typeof state.woundsRemaining==='number')return Math.max(0,Math.min(maximum,state.woundsRemaining));
  if(state.destroyed||state.modelsRemaining<=0)return 0;
  return Math.max(0,Math.min(maximum,(state.modelsRemaining-1)*woundsPerModel+(woundsPerModel-Math.min(woundsPerModel-1,state.woundsLost))));
}

export function stateForRemainingWounds(state:MutableWoundState,models:number,woundsPerModel:number,woundsRemaining:number){
  const maximum=totalUnitWounds(models,woundsPerModel);
  const remaining=Math.max(0,Math.min(maximum,woundsRemaining));
  const modelWounds=state.modelWounds?.length===models
    ?adjustExistingModelWounds(state.modelWounds,models,woundsPerModel,remaining)
    :exactModelWounds(models,woundsPerModel,remaining);
  return {
    ...state,
    woundsRemaining:remaining,
    woundsLost:maximum-remaining,
    modelWounds,
    modelsRemaining:modelWounds.filter(value=>value>0).length,
    destroyed:remaining===0,
  };
}

/** Updates one or more exact model wound values while keeping every aggregate tracker consistent. */
export function stateForModelWounds(state:MutableWoundState,models:number,woundsPerModel:number,nextModelWounds:number[]){
  const modelWounds=normalizeModelWounds(nextModelWounds,models,woundsPerModel);
  const maximum=totalUnitWounds(models,woundsPerModel);
  const remaining=modelWounds.reduce((sum,value)=>sum+value,0);
  return {
    ...state,
    woundsRemaining:remaining,
    woundsLost:maximum-remaining,
    modelWounds,
    modelsRemaining:modelWounds.filter(value=>value>0).length,
    destroyed:remaining===0,
  };
}
