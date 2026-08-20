import {describe,expect,it} from 'vitest';
import {remainingUnitWounds,stateForRemainingWounds,totalUnitWounds} from './battle';

describe('total unit wounds',()=>{
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
  it('converts the legacy damaged-model state without deleting battle progress',()=>{
    expect(remainingUnitWounds({modelsRemaining:3,woundsLost:1,destroyed:false},5,2)).toBe(5);
  });
});
