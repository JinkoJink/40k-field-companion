import type { CapacitorConfig } from '@capacitor/cli';

const broodmind=process.env.APP_FACTION==='genestealer_cults';

const config: CapacitorConfig = {
  appId: broodmind ? 'com.jinkojink.broodmind' : 'com.jinkojink.commandprotocols',
  appName: broodmind ? 'Broodmind' : 'Command Protocols',
  webDir: 'dist'
};

export default config;
