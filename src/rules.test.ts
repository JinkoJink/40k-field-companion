import {describe,expect,it} from 'vitest';
import {eligibleStratagemTargets,enhancementCountContribution,enhancementEligible,enhancementLimit,stratagemAvailable} from './rules';
import type {Detachment,Enhancement,RosterUnit,Stratagem,UnitIndex} from './types';

const unit=(name:string,categories:string[]):UnitIndex=>({
  id:`unit:${name.toLowerCase().replace(/\s+/g,'-')}`,
  name,
  legends:false,
  categories:['Faction: Necrons',...categories],
  stats:{W:'3'},
  pricing:[{range:'[1,)',costs:[{models:1,points:100}]}],
  role:null,
  attachTo:[],
  weaponCount:0,
  abilityCount:0,
});

const rosterEntry=(unitId:string,instanceId='entry'):RosterUnit=>({
  instanceId,
  unitId,
  models:1,
  wargear:{choices:{},modelCounts:{}},
});

describe('11e Enhancement eligibility',()=>{
  it('allows Quantum Goad only on the Nightbringer explicit host',()=>{
    const enhancement:Enhancement={
      name:'Quantum Goad',points:45,keywordRestrictions:['DNU','Necrons'],
      allowedHosts:["C’tan Shard of the Nightbringer"],
    };
    expect(enhancementEligible(enhancement,unit("C’tan Shard of the Nightbringer",['Epic Hero','Monster']))).toBe(true);
    expect(enhancementEligible(enhancement,unit("C’tan Shard of the Deceiver",['Epic Hero','Monster']))).toBe(false);
  });

  it('allows non-character Upgrades only on units matching all required keywords',()=>{
    const upgrade:Enhancement={name:'Deepening Madness',points:20,upgrade:true,maxTargets:3,keywordRestrictions:['Destroyer Cult','Mounted']};
    expect(enhancementEligible(upgrade,unit('Lokhust Destroyers',['Destroyer Cult','Mounted']))).toBe(true);
    expect(enhancementEligible(upgrade,unit('Skorpekh Destroyers',['Destroyer Cult','Infantry']))).toBe(false);
    expect(enhancementLimit(upgrade)).toBe(3);
    expect([1,2,3].map(n=>enhancementCountContribution(upgrade,n))).toEqual([1,0,0]);
  });

  it('keeps ordinary Enhancements on eligible non-Epic-Hero Characters',()=>{
    const enhancement:Enhancement={name:'Murdermind',points:15,keywordRestrictions:['Cryptek']};
    expect(enhancementEligible(enhancement,unit('Technomancer',['Character','Cryptek']))).toBe(true);
    expect(enhancementEligible(enhancement,unit('Necron Warriors',['Battleline','Infantry']))).toBe(false);
  });
});

describe('battle Stratagem availability',()=>{
  const cursed:Detachment={id:'necrons:detachment:cursed-legion',name:'Cursed Legion',dp:2,objective:'PURGE THE FOE'};
  const destroyer=unit('Lokhust Destroyers',['Destroyer Cult','Mounted']);
  const warriors=unit('Necron Warriors',['Battleline','Infantry']);
  const stratagem:Stratagem={
    id:'methodical-murder-cursed-legion',name:'Methodical Murder',cp:1,
    phases:['shooting'],detachmentId:cursed.id,
    targetRestrictions:{requiredKeywords:['Destroyer Cult']},
  };

  it('lists a Stratagem only when an actual roster unit can satisfy its target restriction',()=>{
    expect(stratagemAvailable(stratagem,'shooting',[cursed],[rosterEntry(warriors.id)],[warriors])).toBe(false);
    expect(stratagemAvailable(stratagem,'shooting',[cursed],[rosterEntry(destroyer.id)],[destroyer])).toBe(true);
    expect(eligibleStratagemTargets(stratagem,[rosterEntry(destroyer.id)],[destroyer]).map(({unit})=>unit.name)).toEqual(['Lokhust Destroyers']);
  });

  it('also enforces phase and selected detachment',()=>{
    expect(stratagemAvailable(stratagem,'movement',[cursed],[rosterEntry(destroyer.id)],[destroyer])).toBe(false);
    expect(stratagemAvailable(stratagem,'shooting',[],[rosterEntry(destroyer.id)],[destroyer])).toBe(false);
  });
});
