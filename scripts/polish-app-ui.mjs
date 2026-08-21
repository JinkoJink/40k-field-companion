import fs from 'node:fs';

const path='src/App.tsx';
let source=fs.readFileSync(path,'utf8');
const replacements=[
  ["<div className='eyebrow'>CONDITIONAL RULE CONNECTIONS</div>","<div className='eyebrow'>ATTACHMENT RULES</div>"],
  ["murdermind?'Murdermind Destroyer Cult bodyguard':retinue?`${retinue.label} bodyguard (optional)`:role==='support'?'Support bodyguard (required)':'Leader bodyguard'","murdermind?'Bodyguard unit (Murdermind)':retinue?`${retinue.label} bodyguard (optional)`:role==='support'?'Support bodyguard (required)':'Leader bodyguard'"],
  ["murdermind?'Choose eligible Destroyer Cult unit…':retinue||role==='leader'?'Not attached':'Select bodyguard'","murdermind?'Choose a Destroyer Cult unit…':retinue||role==='leader'?'Not attached':'Select bodyguard'"],
  ["{targetUnit?.name}{murdermind?' · Murdermind connection':''}","{targetUnit?.name}"],
  ["<strong>Active connections</strong>","<strong>Attachment rules</strong>"],
];
for(const [from,to] of replacements){
  if(!source.includes(from))throw new Error(`UI polish target not found: ${from}`);
  source=source.replaceAll(from,to);
}
fs.writeFileSync(path,source);
console.log('Applied production UI polish');
