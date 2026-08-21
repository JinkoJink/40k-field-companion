import fs from 'node:fs';

const path='src/App.tsx';
let source=fs.readFileSync(path,'utf8');

const replacements=[
  ["<div className='eyebrow'>CONDITIONAL RULE CONNECTIONS</div>","<div className='eyebrow'>ATTACHMENT RULES</div>"],
  ["murdermind?'Murdermind Destroyer Cult bodyguard':retinue?`${retinue.label} bodyguard (optional)`:role==='support'?'Support bodyguard (required)':'Leader bodyguard'","murdermind?'Bodyguard unit (Murdermind)':retinue?`${retinue.label} bodyguard (optional)`:role==='support'?'Support bodyguard (required)':'Leader bodyguard'"],
  ["murdermind?'Choose eligible Destroyer Cult unit…':retinue||role==='leader'?'Not attached':'Select bodyguard'","murdermind?'Choose a Destroyer Cult unit…':retinue||role==='leader'?'Not attached':'Select bodyguard'"],
  ["{targetUnit?.name}{murdermind?' · Murdermind connection':''}","{targetUnit?.name}"],
  ["<strong>Active connections</strong>","<strong>Attachment rules</strong>"],
  ["<strong>Active rule connections</strong>","<strong>Attachment rules</strong>"],
  ["const attachments=enhancement.attachmentBodyguardIds?.length?'Adds conditional bodyguard options.':'';","const attachments=enhancement.attachmentBodyguardIds?.length?'Unlocks additional legal Bodyguard choices.':'';"],
  ["[ability.rule.behavior,ruleMetaLine(ability.rule.usage),ruleMetaLine(ability.rule.scope),ability.rule.quality]","[ruleMetaLine(ability.rule.behavior),ruleMetaLine(ability.rule.usage),ruleMetaLine(ability.rule.scope),ruleMetaLine(ability.rule.quality)]"],
  ["if(!loading&&settings.automatic&&!settings.manualOnly&&navigator.onLine&&!battle&&!wifiBlocked){","if(false&& !loading&&settings.automatic&&!settings.manualOnly&&navigator.onLine&&!battle&&!wifiBlocked){"],
  ["<label className='checkLabel'><input type='checkbox' checked={settings.automatic}","<label className='checkLabel'><input disabled type='checkbox' checked={false}"],
  ["<label className='checkLabel'><input type='checkbox' checked={settings.manualOnly}","<label className='checkLabel'><input disabled type='checkbox' checked={true}"],
  ["<label className='checkLabel'><input type='checkbox' checked={settings.wifiOnly}","<label className='checkLabel'><input disabled type='checkbox' checked={false}"],
  ["<button className='addButton' onClick={()=>void onCheck()}>Check for updates now</button>","<div className='rulePanel'><strong>Rules updates quarantined</strong><p>This release uses only the validated rules dataset bundled inside the installer. Network rules updates remain disabled until development resumes.</p></div>"],
  ["Rules, rosters and active battles live on this phone. Network checks only fetch a tiny manifest, then only changed packages.","Rules, rosters and active battles live on this phone. This release uses the frozen rules dataset bundled with the installer."],
  ["const[selected,setSelected]=useState<string[]>(['Cursed Legion']);","const[selected,setSelected]=useState<string[]>(['Annihilation Legion','Hand of The Dynasty']);"],
  ["readUser<string[]>('detachments',['Cursed Legion']),","readUser<string[]>('detachments',['Annihilation Legion','Hand of The Dynasty']),"],
  ["readUser<RosterUnit[]>('roster',[]),","readUser<RosterUnit[]|null>('roster',null),"],
  ["const currentRoster=refreshRosterSnapshots(applyRequiredBindings(storedRoster,data.index,activeEnhancements),data.index,data.detailMap);","const initialRoster=storedRoster??buildNarcosTestRoster(data.index,data.detailMap);\n        const currentRoster=refreshRosterSnapshots(applyRequiredBindings(initialRoster,data.index,activeEnhancements),data.index,data.detailMap);"],
  ["    <section className='panel'><div className='eyebrow'>OBJECTIVE CONTROL</div><div className='objectiveGrid'>{battle.objectives.map(objective=><div className='objective' key={objective.id}><strong>{objective.name}</strong><div>{(['you','opponent','contested'] as const).map(controller=><button className={objective.controller===controller?controller:''} aria-pressed={objective.controller===controller} onClick={()=>patch({objectives:battle.objectives.map(item=>item.id===objective.id?{...item,controller}:item)})} key={controller}>{controller==='you'?'You':controller==='opponent'?'Opponent':'Contested'}</button>)}</div></div>)}</div></section>\n\n",""]
];

for(const [from,to] of replacements){
  if(source.includes(from))source=source.replaceAll(from,to);
}

// Stratagem records in the frozen dataset are incomplete. Never silently hide a selected
// detachment's records merely because provisional phase/target metadata says they are unavailable.
source=source.replace(
  "const available=useMemo(()=>stratagems.filter(stratagem=>stratagemAvailable(stratagem,phase,selectedDetachments,roster,units)),[stratagems,phase,selectedDetachments,roster,units]);",
  "const selectedIds=new Set(selectedDetachments.map(detachment=>detachment.id));\n  const detachmentStratagems=useMemo(()=>stratagems.filter(stratagem=>!stratagem.detachmentId||selectedIds.has(stratagem.detachmentId)),[stratagems,selectedDetachments]);\n  const available=useMemo(()=>detachmentStratagems.filter(stratagem=>stratagemAvailable(stratagem,phase,selectedDetachments,roster,units)),[detachmentStratagems,phase,selectedDetachments,roster,units]);"
);
source=source.replace(
  "</div>{!available.length?<p className='muted'>No Stratagems match this phase, selected detachments and your roster’s eligible targets.</p>:<div className='stratagemList'>{available.map",
  "</div>{available.length!==detachmentStratagems.length&&<p className='muted'>{available.length} usable in this phase · {detachmentStratagems.length} total from selected detachments</p>}{!detachmentStratagems.length?<p className='muted'>No Stratagem records are bundled for the selected detachments.</p>:<div className='stratagemList'>{detachmentStratagems.map"
);
source=source.replace(
  "{stratagem.description&&<p className='muted'>{stratagem.description}</p>}",
  "{stratagem.description?<p className='muted'>{stratagem.description}</p>:(!stratagem.when&&!stratagem.target&&!stratagem.effect)&&<div className='rulePanel'><strong>RULE TEXT</strong><p>Full rule text is missing from the bundled dataset. This Stratagem is retained so it is not silently omitted.</p></div>}"
);

if(!source.includes('function buildNarcosTestRoster(')){
  const helper=`function buildNarcosTestRoster(units:UnitIndex[],details:Map<string,UnitDetail>):RosterUnit[]{
  const normalize=(value:string)=>value.toLowerCase().replace(/[’‘]/g,"'").replace(/[^a-z0-9]+/g,' ').trim();
  const byName=(name:string)=>{const unit=units.find(candidate=>normalize(candidate.name)===normalize(name));if(!unit)throw new Error(\`Default Narcos roster unit missing from dataset: \${name}\`);return unit;};
  const make=(name:string,models?:number,extra:Partial<RosterUnit>={})=>{const unit=byName(name);const entry=createRosterUnit(unit,details.get(unit.id));const count=models??entry.models;return{...entry,models:count,wargear:defaultWargear(details.get(unit.id),count),...extra};};

  const nightbringer=make("C'tan Shard of The Nightbringer");
  const ammentar=make('Nekrosor Ammentar');
  const wraiths=make('Canoptek Wraiths',3);
  const technomancer=make('Technomancer',undefined,{attachedTo:wraiths.instanceId});
  const warriors=make('Necron Warriors',20);
  const chronomancer=make('Chronomancer',undefined,{attachedTo:warriors.instanceId});
  const royalWarden=make('Royal Warden',undefined,{attachedTo:warriors.instanceId});
  const immortals=make('Immortals',10);
  const overlord=make('Overlord',undefined,{attachedTo:immortals.instanceId,warlord:true,enhancement:'Eternal Madness'});
  const plasmancer=make('Plasmancer',undefined,{attachedTo:immortals.instanceId});
  const lokhustDestroyers=make('Lokhust Destroyers',4);
  const lokhustLord=make('Lokhust Lord',undefined,{attachedTo:lokhustDestroyers.instanceId,enhancement:'Ingrained Superiority'});
  const scarabsA=make('Canoptek Scarab Swarms',6);
  const scarabsB=make('Canoptek Scarab Swarms',6);
  const flayedOnes=make('Flayed Ones',10);
  const ophydians=make('Ophydian Destroyers',3);

  return[nightbringer,ammentar,technomancer,wraiths,chronomancer,royalWarden,warriors,overlord,plasmancer,immortals,lokhustLord,lokhustDestroyers,scarabsA,scarabsB,flayedOnes,ophydians];
}

`;
  source=source.replace('export function App(){',helper+'export function App(){');
}

const forbidden=[
  'CONDITIONAL RULE CONNECTIONS',
  'Murdermind Destroyer Cult bodyguard',
  'Murdermind connection',
  '<strong>Active connections</strong>',
  '<strong>Active rule connections</strong>',
  "[ability.rule.behavior,ruleMetaLine(ability.rule.usage),ruleMetaLine(ability.rule.scope),ability.rule.quality]",
];
for(const value of forbidden){
  if(source.includes(value))throw new Error(`Production UI still exposes internal text: ${value}`);
}
if(source.includes("<div className='eyebrow'>OBJECTIVE CONTROL</div>"))throw new Error('Objective tracker was not removed.');
if(!source.includes('Full rule text is missing from the bundled dataset.'))throw new Error('Stratagem missing-rule-text fallback was not applied.');
if(!source.includes('Rules updates quarantined'))throw new Error('Rules updater quarantine banner was not applied.');
if(!source.includes('buildNarcosTestRoster'))throw new Error('Narcos fresh-install test roster was not applied.');
if(!source.includes("['Annihilation Legion','Hand of The Dynasty']"))throw new Error('Narcos detachments were not applied.');

fs.writeFileSync(path,source);
console.log('Applied production UI polish, objective removal, stratagem visibility, rules-updater quarantine, and Narcos fresh-install test roster');
