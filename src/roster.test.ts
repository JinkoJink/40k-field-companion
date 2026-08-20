import {describe,expect,it} from 'vitest';
import {removeUnavailableEnhancements,rosterPoints,validateRoster} from './roster';
import type {Detachment,RosterUnit,UnitDetail,UnitIndex} from './types';

const unit=(overrides:Partial<UnitIndex>):UnitIndex=>({
  id:'unit',
  name:'Test Unit',
  legends:false,
  categories:['Faction: Necrons'],
  stats:{W:'2'},
  pricing:[{range:'[1,)',costs:[{models:1,points:100}]}],
  role:null,
  attachTo:[],
  weaponCount:0,
  abilityCount:0,
  ...overrides,
});

const entry=(overrides:Partial<RosterUnit>):RosterUnit=>({
  instanceId:'entry',
  unitId:'unit',
  models:1,
  wargear:{choices:{},modelCounts:{}},
  ...overrides,
});

describe('roster pricing',()=>{
  it('prices duplicate unit instances by their individual sizes and occurrence tiers',()=>{
    const wraiths=unit({
      id:'wraiths',
      name:'Canoptek Wraiths',
      pricing:[
        {range:'[1,1]',costs:[{models:3,points:95},{models:6,points:220}]},
        {range:'[2,)',costs:[{models:3,points:115},{models:6,points:240}]},
      ],
    });
    const roster=[
      entry({instanceId:'first',unitId:'wraiths',models:3}),
      entry({instanceId:'second',unitId:'wraiths',models:6}),
    ];
    expect(rosterPoints(roster,[wraiths],[])).toBe(335);
  });

  it('adds assigned Enhancement points',()=>{
    const character=unit({categories:['Faction: Necrons','Character']});
    const detachment:Detachment={name:'Test',dp:3,objective:'TAKE AND HOLD',enhancements:[{name:'Relic',points:25}]};
    expect(rosterPoints([entry({enhancement:'Relic'})],[character],[detachment])).toBe(125);
  });

  it('removes an Enhancement when its detachment is no longer selected',()=>{
    const roster=[entry({enhancement:'Relic'})];
    expect(removeUnavailableEnhancements(roster,[])[0].enhancement).toBeUndefined();
    expect(removeUnavailableEnhancements(roster,[{name:'Test',dp:3,objective:'TAKE AND HOLD',enhancements:[{name:'Relic',points:25}]}])[0].enhancement).toBe('Relic');
  });
});

describe('army validation',()=>{
  it('accepts a configured Character Warlord',()=>{
    const character=unit({categories:['Faction: Necrons','Character']});
    const roster=[entry({warlord:true})];
    const detail=new Map<string,UnitDetail>([['unit',{...character,abilities:[],weapons:[],options:[]}]]);
    const detachment:Detachment={name:'Test',dp:3,objective:'TAKE AND HOLD'};
    const issues=validateRoster({
      roster,
      units:[character],
      details:detail,
      detachments:[detachment],
      selectedDetachments:['Test'],
      pointsLimit:2000,
    });
    expect(issues).toEqual([]);
  });

  it('rejects duplicate Epic Heroes and missing Warlords',()=>{
    const hero=unit({categories:['Faction: Necrons','Character','Epic Hero']});
    const roster=[entry({instanceId:'one'}),entry({instanceId:'two'})];
    const issues=validateRoster({
      roster,
      units:[hero],
      details:new Map(),
      detachments:[{name:'Test',dp:3,objective:'TAKE AND HOLD'}],
      selectedDetachments:['Test'],
      pointsLimit:2000,
    });
    expect(issues.some(issue=>issue.message.includes('Only one'))).toBe(true);
    expect(issues.some(issue=>issue.message.includes('Warlord'))).toBe(true);
  });
});
