import { readFileSync, existsSync } from 'node:fs';

const manifest = readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');
if (!manifest.includes('android:icon="@mipmap/ic_launcher"')) {
  throw new Error('Android manifest is not using generated @mipmap/ic_launcher');
}
if (!manifest.includes('android:roundIcon="@mipmap/ic_launcher_round"')) {
  throw new Error('Android manifest is not using generated @mipmap/ic_launcher_round');
}

const required = [
  'android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml',
  'android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml',
  'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png',
  'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png',
  'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png',
];

for (const path of required) {
  if (!existsSync(path)) throw new Error(`Generated Android launcher asset missing: ${path}`);
}

const adaptive = readFileSync(required[0], 'utf8');
if (!adaptive.includes('ic_launcher_foreground')) {
  throw new Error('Generated adaptive icon does not reference ic_launcher_foreground');
}

console.log('Verified Capacitor-generated Android launcher resources');
