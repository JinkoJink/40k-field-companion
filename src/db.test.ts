import {describe,expect,it} from 'vitest';
import {changedPackageNames,validatePackagePayload} from './db';
import type {RulesManifest} from './types';

const manifest=(points='a'):RulesManifest=>({datasetVersion:'test',schemaVersion:2,factions:{necrons:{packages:{units:{file:'units.json',hash:'u'},points:{file:'points.json',hash:points}}}}});
describe('offline rules package guards',()=>{
  it('plans a points-only update without touching units',()=>expect(changedPackageNames(manifest('a'),manifest('b'))).toEqual(['points']));
  it('accepts supported package schemas and rejects corrupt/duplicate records',()=>{
    expect(()=>validatePackagePayload('units',{schemaVersion:2,package:'units',records:[{id:'x'}]})).not.toThrow();
    expect(()=>validatePackagePayload('units',{schemaVersion:2,package:'units',records:[{id:'x'},{id:'x'}]})).toThrow('Duplicate');
    expect(()=>validatePackagePayload('units',{schemaVersion:3,package:'units',records:[]})).toThrow('Invalid');
  });
});
