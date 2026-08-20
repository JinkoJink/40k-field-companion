export type Phase='all'|'command'|'movement'|'shooting'|'charge'|'fight';
export type Pricing={models:number;points:number};
export type PriceTier={range?:string;label?:string;costs:Pricing[]};
export type MfmUnit={name:string;pricing?:PriceTier[];role?:string;attachTo?:string[];legends?:boolean};
export type Detachment={name:string;dp:number;objective:string;unique?:string;enhancements?:{name:string;points:number}[];ruleName?:string;summary?:string};
export type UnitIndex={id:string;name:string;legends:boolean;categories:string[];stats:Record<string,string>;pricing?:MfmUnit['pricing']|null;role?:string|null;attachTo?:string[];weaponCount:number;abilityCount:number};
export type UnitDetail=UnitIndex&{abilities?:{id?:string;name:string;type?:string;characteristics:Record<string,string>}[];weapons?:{id?:string;name:string;type?:string;characteristics:Record<string,string>}[];rules?:{name:string;type:string;targetId?:string}[];options?:unknown[]};
export type RosterEntry={quantity:number;models:number};
