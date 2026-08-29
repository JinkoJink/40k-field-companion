export type FieldCompanionFaction='necrons'|'genestealer_cults';

const requested=(import.meta.env.VITE_APP_FACTION||'necrons') as FieldCompanionFaction;

const configs={
  necrons:{
    factionId:'necrons' as const,
    factionName:'Necrons',
    appName:'Command Protocols',
    appId:'com.jinkojink.commandprotocols.v2',
    dbName:'field-companion',
    manifestPath:'./data/version.json',
    remoteManifestUrl:'https://raw.githubusercontent.com/JinkoJink/40k-field-companion/main/public/data/version.json',
    defaultDetachment:'Cursed Legion',
    contentLabel:'Published rules bundle',
  },
  genestealer_cults:{
    factionId:'genestealer_cults' as const,
    factionName:'Genestealer Cults',
    appName:'Broodmind',
    appId:'com.jinkojink.broodmind',
    dbName:'field-companion-genestealer-cults',
    manifestPath:'./data/gsc-version.json',
    remoteManifestUrl:'https://raw.githubusercontent.com/JinkoJink/40k-field-companion/main/public/data/gsc-version.json',
    defaultDetachment:'Biosanctic Broodsurge',
    contentLabel:'Supabase draft rules bundle',
  },
};

export const appConfig=configs[requested]||configs.necrons;
