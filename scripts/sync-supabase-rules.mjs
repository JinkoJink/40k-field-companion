import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';

const SUPABASE_URL=process.env.SUPABASE_URL||'https://mvslxmzuecwtsbkhocpg.supabase.co';
// Publishable keys are safe in public clients; RLS and read-only grants enforce access.
const SUPABASE_PUBLISHABLE_KEY=process.env.SUPABASE_PUBLISHABLE_KEY||'sb_publishable_Vi77IxlBPmXz7MC2zolS6A_PdIz4BT6';
const FACTION='necrons';
const DATA_DIR=path.resolve('public/data');
const FACTION_DIR=path.join(DATA_DIR,FACTION);
const RESOLVED_DIR=path.join(DATA_DIR,'resolved');

async function rest(resource,query=''){
  const suffix=query?`?${query}`:'';
  const response=await fetch(`${SUPABASE_URL}/rest/v1/${resource}${suffix}`,{
    headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Accept:'application/json'},
    cache:'no-store',
  });
  if(!response.ok)throw new Error(`Supabase ${resource} request failed: ${response.status} ${await response.text()}`);
  return response.json();
}

function hash(text){
  return createHash('sha256').update(text.trimEnd()).digest('hex');
}

const releases=await rest(
  'current_published_release',
  'select=id,dataset_version,schema_version,edition,published_at&limit=1',
);
if(releases.length!==1)throw new Error('No published Supabase rules release found.');
const release=releases[0];

const [packages,resolvedUnits,resolvedDetachments,relationships]=await Promise.all([
  rest('rule_packages',`select=package_name,schema_version,payload,record_count&release_id=eq.${encodeURIComponent(release.id)}&faction_id=eq.${FACTION}&order=package_name`),
  rest('resolved_unit_rules',`select=*&faction_id=eq.${FACTION}&order=name`),
  rest('resolved_detachment_rules',`select=*&faction_id=eq.${FACTION}&order=name`),
  rest('rule_relationships','select=*&order=source_type,source_id,relationship_type,target_id'),
]);

if(!packages.some(row=>row.package_name==='units'))throw new Error('Published release has no units package.');
if(!resolvedUnits.length)throw new Error('Supabase resolved rules graph has no units.');
if(!resolvedDetachments.length)throw new Error('Supabase resolved rules graph has no detachments.');
for(const edge of relationships){
  if(!edge.source_id||!edge.target_id||!edge.relationship_type)throw new Error('Malformed Supabase rule relationship.');
}

await mkdir(FACTION_DIR,{recursive:true});
await mkdir(RESOLVED_DIR,{recursive:true});
const manifestPackages={};
for(const row of packages){
  const payload=row.payload;
  if(payload?.package!==row.package_name||!Array.isArray(payload?.records))throw new Error(`Invalid ${row.package_name} package payload in Supabase.`);
  if(Number(payload.schemaVersion)!==Number(row.schema_version))throw new Error(`Schema version mismatch for ${row.package_name}.`);
  if(payload.records.length!==Number(row.record_count))throw new Error(`Record-count mismatch for ${row.package_name}.`);
  const file=`data/${FACTION}/${row.package_name}.json`;
  const text=`${JSON.stringify(payload,null,2)}\n`;
  await writeFile(path.join('public',file),text,'utf8');
  manifestPackages[row.package_name]={file,hash:hash(text)};
}

const resolvedSnapshots={
  'units.json':{datasetVersion:release.dataset_version,records:resolvedUnits},
  'detachments.json':{datasetVersion:release.dataset_version,records:resolvedDetachments},
  'relationships.json':{datasetVersion:release.dataset_version,records:relationships},
};
for(const[file,payload]of Object.entries(resolvedSnapshots)){
  await writeFile(path.join(RESOLVED_DIR,file),`${JSON.stringify(payload,null,2)}\n`,'utf8');
}

const manifest={
  datasetVersion:release.dataset_version,
  schemaVersion:Number(release.schema_version),
  edition:release.edition||'11th',
  scope:{factions:[FACTION],includesSharedCoreRules:Boolean(manifestPackages['core-rules'])},
  resolved:{
    units:'data/resolved/units.json',
    detachments:'data/resolved/detachments.json',
    relationships:'data/resolved/relationships.json',
  },
  factions:{[FACTION]:{packages:manifestPackages}},
};
await writeFile(path.join(DATA_DIR,'version.json'),`${JSON.stringify(manifest,null,2)}\n`,'utf8');
console.log(`Mirrored Supabase release ${release.dataset_version}: ${resolvedUnits.length} resolved units, ${resolvedDetachments.length} detachments, ${relationships.length} relationships.`);
