import {describe,expect,it} from 'vitest';
import {compatibleBodyguards,validateRoster} from './roster';
import {enhancementCountContribution,enhancementEligible,requiredBindingForUnit} from './rules';
import type {Detachment,Enhancement,RosterUnit,UnitDetail,UnitIndex} from './types';

const unit=(name:string,categories:string[],extra:Partial<UnitIndex>={}):UnitIndex=>({id:`unit:${name.toLowerCase().replace(/\s+/g,'-')}`,externalId:name.toLowerCase().replace(/\s+/g,'-'),name,legends:false,categories:['Faction: Necrons',...categories],stats:{W:'2'},pricing:[{range:'[1,)',costs:[{models:1,points:100}]}],role:null,attachTo:[],weaponCount:0,abilityCount:0,...extra});
const entry=(unitId:string,extra:Partial<RosterUnit>={}):RosterUnit=>({instanceId:`entry:${unitId}:${Math.random()}`,unitId,models:1,wargear:{choices:{},modelCounts:{}},...extra});
const details=(units:UnitIndex[])=>new Map<string,UnitDetail>(units.map(value=>[value.id,{...value,abilities:[],weapons:[],options:[]}])) as Map<string,UnitDetail>;

describe('11e Leader and Support connections',()=>{
  const warriors=unit('Necron Warriors',['Battleline','Infantry']);
  const overlord=unit('Overlord',['Character','Overlord'],{attachmentRole:'leader',attachTo:['Necron Warriors']});
  const techno=unit('Technomancer',['Character','Cryptek'],{attachmentRole:'support',attachTo:['Necron Warriors']});
  const detachment:Detachment={id:'det',name:'Test',dp:1,objective:'TAKE AND HOLD'};

  it('allows one Leader and one Support on the same bodyguard',()=>{
    const body=entry(warriors.id,{instanceId:'body'}),leader=entry(overlord.id,{instanceId:'leader',attachedTo:'body',warlord:true}),support=entry(techno.id,{instanceId:'support',attachedTo:'body'}),roster=[body,leader,support],units=[warriors,overlord,techno];
    const issues=validateRoster({roster,units,details:details(units),detachments:[detachment],selectedDetachments:['Test'],pointsLimit:2000});
    expect(issues.filter(issue=>/bodyguard|Support unit|only one Leader|only one Support/i.test(issue.message))).toEqual([]);
  });

  it('requires Support to be attached',()=>{
    const roster=[entry(techno.id,{warlord:true})],units=[techno];
    const issues=validateRoster({roster,units,details:details(units),detachments:[detachment],selectedDetachments:['Test'],pointsLimit:2000});
    expect(issues.some(issue=>issue.message.includes('Support unit')&&issue.message.includes('must be attached'))).toBe(true);
  });
});

describe('Murdermind conditional attachment',()=>{
  const destroyers=unit('Lokhust Destroyers',['Destroyer Cult','Mounted'],{externalId:'lokhust-destroyers'});
  const techno=unit('Technomancer',['Character','Cryptek'],{attachmentRole:'support',attachTo:['Necron Warriors']});
  const murdermind:Enhancement={name:'Murdermind',points:15,detachmentId:'cursed',keywordRestrictions:['Cryptek'],attachmentBodyguardIds:['lokhust-destroyers','lokhust-heavy-destroyers','ophydian-destroyers','skorpekh-destroyers'],grantKeywords:['Destroyer Cult']};
  const cursed:Detachment={id:'cursed',name:'Cursed Legion',dp:2,objective:'PURGE THE FOE',enhancements:[murdermind]};

  it('adds the four Destroyer bodyguard families to a Cryptek bearing Murdermind',()=>{
    const body=entry(destroyers.id,{instanceId:'body'}),support=entry(techno.id,{instanceId:'tech',enhancement:'Murdermind',warlord:true}),roster=[body,support];
    expect(compatibleBodyguards(support,techno,roster,[destroyers,techno],[murdermind]).map(item=>item.instanceId)).toContain('body');
  });

  it('accepts the Murdermind attachment when every model in the Attached unit is Destroyer Cult',()=>{
    const body=entry(destroyers.id,{instanceId:'body'}),support=entry(techno.id,{instanceId:'tech',enhancement:'Murdermind',attachedTo:'body',warlord:true}),roster=[body,support],units=[destroyers,techno];
    const issues=validateRoster({roster,units,details:details(units),detachments:[cursed],selectedDetachments:['Cursed Legion'],pointsLimit:2000});
    expect(issues.some(issue=>issue.message.includes('Murdermind can use'))).toBe(false);
    expect(issues.some(issue=>issue.message.includes('incompatible bodyguard'))).toBe(false);
  });

  it('rejects a conditional Murdermind Attached unit containing a non-Destroyer model',()=>{
    const outsider=unit('Test Leader',['Character'],{attachmentRole:'leader',attachTo:['Lokhust Destroyers']});
    const body=entry(destroyers.id,{instanceId:'body'}),support=entry(techno.id,{instanceId:'tech',enhancement:'Murdermind',attachedTo:'body'}),leader=entry(outsider.id,{instanceId:'leader',attachedTo:'body',warlord:true}),roster=[body,support,leader],units=[destroyers,techno,outsider];
    const issues=validateRoster({roster,units,details:details(units),detachments:[cursed],selectedDetachments:['Cursed Legion'],pointsLimit:2000});
    expect(issues.some(issue=>issue.message.includes('every model')&&issue.message.includes('DESTROYER CULT'))).toBe(true);
  });
});

describe('conditional Enhancement forms',()=>{
  it('supports OR restriction groups',()=>{
    const rule:Enhancement={name:'Dread Majesty',points:30,keywordRestrictionGroups:[['Overlord'],['Catacomb Command Barge']]};
    expect(enhancementEligible(rule,unit('Overlord',['Character','Overlord']))).toBe(true);
    expect(enhancementEligible(rule,unit('Technomancer',['Character','Cryptek']))).toBe(false);
  });

  it('treats mandatory Pantheon bindings as host-specific and outside the Enhancement count',()=>{
    const binding:Enhancement={name:'Quantum Goad',points:45,kind:'binding',mandatory:true,countsTowardLimit:false,allowedHosts:["C’tan Shard of the Nightbringer"]};
    const nightbringer=unit("C’tan Shard of the Nightbringer",['Epic Hero','Monster']);
    expect(requiredBindingForUnit(nightbringer,[binding])?.name).toBe('Quantum Goad');
    expect(enhancementCountContribution(binding,1)).toBe(0);
  });
});
