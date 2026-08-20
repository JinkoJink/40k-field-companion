import {describe,expect,it} from 'vitest';
import {changedPackageNames,installStoreNamesForPackages,normalizeEnhancementRuntime,normalizeUnitConnections,validatePackagePayload} from './db';
import type {RulesManifest} from './types';

const manifest=(points='a'):RulesManifest=>({datasetVersion:'test',schemaVersion:2,factions:{necrons:{packages:{units:{file:'units.json',hash:'u'},points:{file:'points.json',hash:points}}}}});

describe('offline rules package guards',()=>{
  it('plans a points-only update without touching units',()=>expect(changedPackageNames(manifest('a'),manifest('b'))).toEqual(['points']));

  it('includes the units store whenever a dependent package rebuilds unit indexes',()=>{
    expect(installStoreNamesForPackages({abilities:{records:[]}})).toContain('units');
    expect(installStoreNamesForPackages({weapons:{records:[]}})).toContain('units');
    expect(installStoreNamesForPackages({points:{records:[]}})).not.toContain('units');
  });

  it('accepts supported package schemas and rejects corrupt/duplicate records',()=>{
    expect(()=>validatePackagePayload('units',{schemaVersion:2,package:'units',records:[{id:'x'}]})).not.toThrow();
    expect(()=>validatePackagePayload('units',{schemaVersion:2,package:'units',records:[{id:'x'},{id:'x'}]})).toThrow('Duplicate');
    expect(()=>validatePackagePayload('units',{schemaVersion:3,package:'units',records:[]})).toThrow('Invalid');
  });
});

describe('legacy conditional data compatibility',()=>{
  it('hydrates Murdermind connections from nested community data',()=>{
    const enhancement=normalizeEnhancementRuntime({name:'Murdermind',points:15,community11e:{keyword_restrictions:['Cryptek'],keyword_restriction_groups:[['Cryptek']],exclusion_keywords:['Epic Hero'],attachment_bodyguard_ids:['lokhust-destroyers']}});
    expect(enhancement.keywordRestrictions).toEqual(['Cryptek']);
    expect(enhancement.keywordRestrictionGroups).toEqual([['Cryptek']]);
    expect(enhancement.exclusionKeywords).toEqual(['Epic Hero']);
    expect(enhancement.attachmentBodyguardIds).toEqual(['lokhust-destroyers']);
    expect(enhancement.grantKeywords).toEqual(['Destroyer Cult']);
  });

  it('reconstructs mandatory Pantheon bindings from the older package shape',()=>{
    const enhancement=normalizeEnhancementRuntime({name:'Quantum Goad',points:45,community11e:{keyword_restrictions:['DNU','Necrons']}});
    expect(enhancement.kind).toBe('binding');
    expect(enhancement.allowedHosts).toEqual(["C’tan Shard of the Nightbringer"]);
    expect(enhancement.mandatory).toBe(true);
    expect(enhancement.countsTowardLimit).toBe(false);
  });

  it('normalizes binding names case-insensitively',()=>{
    const enhancement=normalizeEnhancementRuntime({name:'QUANTUM GOAD',points:45,community11e:{keyword_restrictions:['DNU','Necrons']}});
    expect(enhancement.kind).toBe('binding');
    expect(enhancement.allowedHosts).toEqual(["C’tan Shard of the Nightbringer"]);
  });

  it('keeps ordinary host-limited Enhancements out of the Binding class',()=>{
    const enhancement=normalizeEnhancementRuntime({name:'Dread Majesty',points:30,allowedHosts:['Overlord','Catacomb Command Barge']},{});
    expect(enhancement.kind).toBe('enhancement');
    expect(enhancement.mandatory).toBe(false);
    expect(enhancement.countsTowardLimit).toBe(true);
  });

  it('normalizes Support, conditional-keyword and transport fields from snake_case community records',()=>{
    const connections=normalizeUnitConnections({}, {
      id:'technomancer',
      attachment_role:'support',
      conditional_keywords:[{keyword:'Test Keyword',required_detachment_id:'test-detachment'}],
      transport_capacity:{capacity:1,keyword_restrictions:['Infantry'],exclusion_keywords:['C’tan']},
    }, null, ['Necron Warriors']);
    expect(connections.externalId).toBe('technomancer');
    expect(connections.attachmentRole).toBe('support');
    expect(connections.attachTo).toEqual(['Necron Warriors']);
    expect(connections.conditionalKeywords).toEqual([{keyword:'Test Keyword',requiredDetachmentId:'test-detachment',requiredFactionKeyword:null}]);
    expect(connections.transportCapacity).toEqual({capacity:1,keywordRestrictions:['Infantry'],exclusionKeywords:['C’tan']});
  });
});
