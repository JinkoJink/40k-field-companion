export type Phase = 'command'|'movement'|'shooting'|'charge'|'fight';
export type Pricing = {models:number;points:number};
export type PriceTier = {range?:string;label?:string;costs:Pricing[]};
export type Constraint = {type:'min'|'max'|string;value:number;scope?:string;childId?:string};
export type Profile = {id?:string;name:string;type?:string;characteristics:Record<string,string>};

export type OptionNode = {
  id:string;
  name:string;
  kind:'entry'|'group';
  type?:string;
  hidden:boolean;
  costs:{name:string;type:string;value:number}[];
  constraints:Constraint[];
  profiles:Profile[];
  options:OptionNode[];
};

export type Enhancement = {
  id?:string;
  name:string;
  points:number;
  description?:string;
  supportTo?:string[];
};

export type Detachment = {
  id?:string;
  name:string;
  dp:number;
  objective:string;
  unique?:string;
  enhancements?:Enhancement[];
  ruleName?:string;
  summary?:string;
};

export type Stratagem = {
  id:string;
  name:string;
  phases:('command'|'movement'|'shooting'|'charge'|'fight'|'any')[];
  cp?:number;
  timing?:string;
  description?:string;
  detachmentId?:string;
};

export type UnitIndex = {
  id:string;
  name:string;
  legends:boolean;
  categories:string[];
  stats:Record<string,string>;
  pricing?:PriceTier[]|null;
  role?:string|null;
  attachTo?:string[];
  weaponCount:number;
  abilityCount:number;
};

export type UnitDetail = UnitIndex & {
  abilities?:Profile[];
  weapons?:Profile[];
  rules?:{name:string;type:string;targetId?:string}[];
  options?:OptionNode[];
};

export type WargearConfig = {
  choices:Record<string,string>;
  modelCounts:Record<string,number>;
};

export type RosterUnit = {
  instanceId:string;
  unitId:string;
  models:number;
  enhancement?:string;
  attachedTo?:string;
  warlord?:boolean;
  wargear:WargearConfig;
};

export type ValidationIssue = {
  level:'error'|'warning';
  message:string;
  unitInstanceId?:string;
};

export type BattleUnitState = {
  modelsRemaining:number;
  woundsLost:number;
  destroyed:boolean;
};

export type RoundScore = {
  primary:number;
  secondary:number;
};

export type ObjectiveState = {
  id:string;
  name:string;
  controller:'you'|'opponent'|'contested';
};

export type BattleState = {
  active:boolean;
  round:number;
  phase:Phase;
  cp:number;
  score:Record<number,RoundScore>;
  objectives:ObjectiveState[];
  units:Record<string,BattleUnitState>;
  notes:string;
};

export type PackageManifest={file:string;hash:string};
export type RulesManifest={
  datasetVersion:string;
  schemaVersion:number;
  factions:{necrons:{packages:Record<string,PackageManifest>}};
};
