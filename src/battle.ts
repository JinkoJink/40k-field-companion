import type {BattleState,Phase,RosterUnit,UnitIndex} from './types';

export const phases:Phase[]=['command','movement','shooting','charge','fight'];

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
    units:Object.fromEntries(roster.map(entry=>[entry.instanceId,{
      modelsRemaining:entry.models,
      woundsLost:0,
      destroyed:false,
    }])),
    notes:'',
  };
}

export function syncBattleUnits(state:BattleState,roster:RosterUnit[]){
  const next={...state,units:{...state.units}};
  const activeIds=new Set(roster.map(entry=>entry.instanceId));
  for(const entry of roster){
    if(!next.units[entry.instanceId])next.units[entry.instanceId]={
      modelsRemaining:entry.models,
      woundsLost:0,
      destroyed:false,
    };
  }
  for(const id of Object.keys(next.units))if(!activeIds.has(id))delete next.units[id];
  return next;
}

export function totalScore(state:BattleState){
  return Object.values(state.score).reduce((total,round)=>total+round.primary+round.secondary,0);
}

export function unitWounds(unit:UnitIndex|undefined){
  const parsed=Number.parseInt(unit?.stats.W||'1',10);
  return Number.isFinite(parsed)&&parsed>0?parsed:1;
}

export function totalUnitWounds(models:number,woundsPerModel:number){return Math.max(0,models*woundsPerModel);}

/** Converts the previous per-model wound tracker to a total-wounds tracker once. */
export function remainingUnitWounds(state:{modelsRemaining:number;woundsLost:number;woundsRemaining?:number;destroyed:boolean},models:number,woundsPerModel:number){
  const maximum=totalUnitWounds(models,woundsPerModel);
  if(typeof state.woundsRemaining==='number')return Math.max(0,Math.min(maximum,state.woundsRemaining));
  if(state.destroyed||state.modelsRemaining<=0)return 0;
  return Math.max(0,Math.min(maximum,(state.modelsRemaining-1)*woundsPerModel+(woundsPerModel-Math.min(woundsPerModel-1,state.woundsLost))));
}

export function stateForRemainingWounds(state:{modelsRemaining:number;woundsLost:number;woundsRemaining?:number;destroyed:boolean},models:number,woundsPerModel:number,woundsRemaining:number){
  const remaining=Math.max(0,Math.min(totalUnitWounds(models,woundsPerModel),woundsRemaining));
  return {...state,woundsRemaining:remaining,woundsLost:totalUnitWounds(models,woundsPerModel)-remaining,modelsRemaining:Math.ceil(remaining/woundsPerModel),destroyed:remaining===0};
}
