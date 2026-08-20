import {describe,expect,it} from 'vitest';
import {createBattleState,remainingUnitWounds,stateForModelWounds,stateForRemainingWounds,totalUnitWounds} from './battle';
import type {Detachment,RosterUnit} from './types';

describe('battle wound tracking',()=>{
  it('removes a model when cumulative damage reaches its wound threshold',()=>{
    const state={modelsRemaining:5,woundsLost:0,destroyed:false};
    expect(totalUnitWounds(5,2)).toBe(10);
    expect(stateForRemainingWounds(state,5,2,8).modelsRemaining).toBe(4);
    expect(stateForRemainingWounds(state,5,2,7).modelsRemaining).toBe(4);
  });

  it('stores exact wounds for every model',()=>{
    const state=stateForRemainingWounds({modelsRemaining:5,woundsLost:0,destroyed:false},5,2,7);
    expect(state.modelWounds).toEqual([2,2,2,1,0]);
    expect(remainingUnitWounds(state,5,2)).toBe(7);
  });

  it('keeps exact model edits and aggregate values synchronized',()=>{
    const state=stateForModelWounds({modelsRemaining:3,woundsLost:0,destroyed:false},3,3,[3,1,0]);
    expect(state.modelWounds).toEqual([3,1,0]);
    expect(state.modelsRemaining).toBe(2);
    expect(state.woundsRemaining).toBe(4);
    expect(state.woundsLost).toBe(5);
    expect(state.destroyed).toBe(false);
  });

  it('preserves the damaged model when the aggregate wound counter changes',()=>{
    const state={modelsRemaining:2,woundsLost:5,woundsRemaining:4,modelWounds:[3,1,0],destroyed:false};
    expect(stateForRemainingWounds(state,3,3,3).modelWounds).toEqual([3,0,0]);
    expect(stateForRemainingWounds(state,3,3,5).modelWounds).toEqual([3,2,0]);
  });

  it('converts the legacy damaged-model state without deleting battle progress',()=>{
    expect(remainingUnitWounds({modelsRemaining:3,woundsLost:1,destroyed:false},5,2)).toBe(5);
  });
});

describe('battle snapshots',()=>{
  it('freezes the roster and selected detachments when a battle begins',()=>{
    const roster:RosterUnit[]=[{instanceId:'unit-1',unitId:'necrons:unit:test',models:3,wargear:{choices:{},modelCounts:{}},stats:{W:'2'}}];
    const detachments:Detachment[]=[{id:'det-1',name:'Test Detachment',dp:1,objective:'TAKE AND HOLD'}];
    const battle=createBattleState(roster,detachments);
    roster[0].models=1;
    detachments[0].name='Changed Later';
    expect(battle.rosterSnapshot?.[0].models).toBe(3);
    expect(battle.detachmentSnapshot?.[0].name).toBe('Test Detachment');
    expect(battle.units['unit-1'].woundsRemaining).toBe(6);
  });
});
