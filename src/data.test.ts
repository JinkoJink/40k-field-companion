import {describe,expect,it} from 'vitest';
import {subfactionKeyword,synergy} from './data';
import type {UnitIndex} from './types';

const destroyer:UnitIndex={
  id:'destroyer',name:'Lokhust Destroyers',legends:false,categories:['Faction: Necrons','Destroyer Cult'],
  stats:{},pricing:[],role:null,attachTo:[],weaponCount:0,abilityCount:0,
};

describe('detachment data-card effects',()=>{
  it('only exposes a detachment effect when that detachment is selected',()=>{
    expect(synergy([],destroyer)).toEqual([]);
    expect(synergy(['Cursed Legion'],destroyer)).toEqual(['Cursed Legion: Destroyer Cult']);
  });

  it('uses an explicit formation keyword as a subfaction without guessing a Dynasty',()=>{
    expect(subfactionKeyword(destroyer)).toBe('Destroyer Cult');
    expect(subfactionKeyword({...destroyer,categories:['Faction: Necrons','Infantry']})).toBeUndefined();
  });
});
