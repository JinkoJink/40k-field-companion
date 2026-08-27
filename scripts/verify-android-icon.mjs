import { readFileSync, existsSync } from 'node:fs';

const manifest = readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');
if (!manifest.includes('android:icon="@drawable/command_protocols_art"')) {
  throw new Error('Android manifest is not using the Command Protocols launcher art');
}
if (!manifest.includes('android:roundIcon="@drawable/command_protocols_art"')) {
  throw new Error('Android manifest round icon is not using the Command Protocols launcher art');
}

const art = 'android/app/src/main/res/drawable-nodpi/command_protocols_art.png';
if (!existsSync(art)) {
  throw new Error(`Command Protocols launcher art missing: ${art}`);
}

console.log('Verified Command Protocols launcher art is wired directly into Android manifest');
