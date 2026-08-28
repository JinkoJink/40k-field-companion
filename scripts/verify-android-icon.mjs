import { readFileSync, existsSync } from 'node:fs';

const manifest = readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');
if (!manifest.includes('android:icon="@mipmap/ic_launcher"')) {
  throw new Error('Android manifest must use @mipmap/ic_launcher');
}
if (!manifest.includes('android:roundIcon="@mipmap/ic_launcher_round"')) {
  throw new Error('Android manifest must use @mipmap/ic_launcher_round');
}

const source = 'assets/icon.png';
if (!existsSync(source)) {
  throw new Error(`Launcher source art missing: ${source}`);
}

const required = [
  'android/app/src/main/res/mipmap-mdpi/ic_launcher.png',
  'android/app/src/main/res/mipmap-hdpi/ic_launcher.png',
  'android/app/src/main/res/mipmap-xhdpi/ic_launcher.png',
  'android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png',
  'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png',
  'android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml',
  'android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml',
];
for (const file of required) {
  if (!existsSync(file)) throw new Error(`Generated Android launcher resource missing: ${file}`);
}

if (manifest.includes('@drawable/command_protocols_art')) {
  throw new Error('Legacy direct drawable launcher reference is still present');
}

console.log('Verified launcher source -> generated mipmaps -> Android manifest chain');
