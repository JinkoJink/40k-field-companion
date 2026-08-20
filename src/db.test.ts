import {describe,expect,it} from 'vitest';
import {changedPackageNames,validatePackagePayload} from './db';
import type {RulesManifest} from './types';

const manifest=(points='a'):RulesManifest=>({datasetVersion:'test',schemaVersion:1,factions:{necrons:{packages:{units:{file:'units.json',hash:'u'},points:{file:'points.json',hash:points}}}}});
describe('offline rules package guards',()=>{
  it('plans a points-only update without touching units',()=>expect(changedPackageNames(manifest('a'),manifest('b'))).toEqual(['points']));
  it('rejects corrupt and duplicate package records before install',()=>{
    expect(()=>validatePackagePayload('units',{schemaVersion:1,package:'units',records:[{id:'x'},{id:'x'}]})).toThrow('Duplicate');
    expect(()=>validatePackagePayload('units',{schemaVersion:2,package:'units',records:[]})).toThrow('Invalid');
  });
});
