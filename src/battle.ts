import type {BattleState,BattleUnitState,Phase,RosterUnit,UnitIndex} from './types';

export const phases:Phase[]=['command','movement','shooting','charge','fight'];

function woundsFromStats(stats:Record<string,string>|undefined){
  const parsed=Number.parseInt(stats?.W||'1',10);
  return Number.isFinite(parsed)&&parsed>0?parsed:1;
}

function initialBattleUnit(entry:RosterUnit):BattleUnitState{
  const woundsPerModel=woundsFromStats(entry.stats);
  return {
    modelsRemaining:entry.models,
    woundsLost:0,
    woundsRemaining:entry.models*woundsPerModel,
    destroyed:false,
    modelWounds:Array.from({length:entry.models},()=>woundsPerModel),
    stats:entry.stats?{...entry.stats}:undefined,
    weapons:entry.weapons?.map(profile=>({...profile,characteristics:{...profile.characteristics}})),
    abilities:entry.abilities?.map(profile=>({...profile,characteristics:{...profile.characteristics}})),
    startingModels:entry.models,
    woundsPerModel,
  };
}

export function createBattleState(roster:RosterUnit[]):BattleState{
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
    units:Object.fromEntries(roster.map(entry=>[entry.instanceId,initialBattleUnit(entry)])),
    notes:'',
  };
}

export function syncBattleUnits(state:BattleState,roster:RosterUnit[]){
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

export function totalUnitWounds(models:number,woundsPerModel:number){return Math.max(0,models*woundsPerModel);}

function exactModelWounds(models:number,woundsPerModel:number,woundsRemaining:number){
  let remaining=Math.max(0,Math.min(totalUnitWounds(models,woundsPerModel),woundsRemaining));
  return Array.from({length:models},()=>{
    const value=Math.min(woundsPerModel,remaining);
    remaining-=value;
    return value;
  });
}

/** Converts previous aggregate wound trackers into the exact per-model tracker on first edit. */
export function remainingUnitWounds(state:{modelsRemaining:number;woundsLost:number;woundsRemaining?:number;modelWounds?:number[];destroyed:boolean},models:number,woundsPerModel:number){
  const maximum=totalUnitWounds(models,woundsPerModel);
  if(state.modelWounds?.length)return Math.max(0,Math.min(maximum,state.modelWounds.reduce((sum,value)=>sum+Math.max(0,Math.min(woundsPerModel,value)),0)));
  if(typeof state.woundsRemaining==='number')return Math.max(0,Math.min(maximum,state.woundsRemaining));
  if(state.destroyed||state.modelsRemaining<=0)return 0;
  return Math.max(0,Math.min(maximum,(state.modelsRemaining-1)*woundsPerModel+(woundsPerModel-Math.min(woundsPerModel-1,state.woundsLost))));
}

export function stateForRemainingWounds(state:{modelsRemaining:number;woundsLost:number;woundsRemaining?:number;modelWounds?:number[];destroyed:boolean},models:number,woundsPerModel:number,woundsRemaining:number){
  const maximum=totalUnitWounds(models,woundsPerModel);
  const remaining=Math.max(0,Math.min(maximum,woundsRemaining));
  const modelWounds=exactModelWounds(models,woundsPerModel,remaining);
  return {
    ...state,
    woundsRemaining:remaining,
    woundsLost:maximum-remaining,
    modelWounds,
    modelsRemaining:modelWounds.filter(value=>value>0).length,
    destroyed:remaining===0,
  };
}
