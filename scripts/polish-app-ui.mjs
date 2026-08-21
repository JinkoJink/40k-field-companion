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
];

for(const [from,to] of replacements){
  if(source.includes(from))source=source.replaceAll(from,to);
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
if(!source.includes('Rules updates quarantined'))throw new Error('Rules updater quarantine banner was not applied.');

fs.writeFileSync(path,source);
console.log('Applied production UI polish and rules-updater quarantine');
