import { readFileSync, existsSync } from 'node:fs';

const manifest = readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');
if (!manifest.includes('android:icon="@mipmap/ic_launcher"')) {
  throw new Error('Android manifest must use @mipmap/ic_launcher');
}
if (!manifest.includes('android:roundIcon="@mipmap/ic_launcher_round"')) {
  throw new Error('Android manifest must use @mipmap/ic_launcher_round');
}

const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const canonical = 'android/app/src/main/res/drawable-nodpi/command_protocols_icon.png';

function readPng(path) {
  if (!existsSync(path)) throw new Error(`Android launcher resource missing: ${path}`);
  const bytes = readFileSync(path);
  if (bytes.length < pngMagic.length || !bytes.subarray(0, pngMagic.length).equals(pngMagic)) {
    throw new Error(`Android launcher resource is not a valid PNG: ${path}`);
  }
  return bytes;
}

const canonicalBytes = readPng(canonical);
const requiredCopies = [
  'assets/icon.png',
  'android/app/src/main/res/drawable-nodpi/command_protocols_art.png',
  'android/app/src/main/res/mipmap-nodpi/ic_launcher.png',
  'android/app/src/main/res/mipmap-nodpi/ic_launcher_round.png',
  'android/app/src/main/res/mipmap-mdpi/ic_launcher.png',
  'android/app/src/main/res/mipmap-mdpi/ic_launcher_foreground.png',
  'android/app/src/main/res/mipmap-mdpi/ic_launcher_round.png',
  'android/app/src/main/res/mipmap-hdpi/ic_launcher.png',
  'android/app/src/main/res/mipmap-hdpi/ic_launcher_foreground.png',
  'android/app/src/main/res/mipmap-hdpi/ic_launcher_round.png',
  'android/app/src/main/res/mipmap-xhdpi/ic_launcher.png',
  'android/app/src/main/res/mipmap-xhdpi/ic_launcher_foreground.png',
  'android/app/src/main/res/mipmap-xhdpi/ic_launcher_round.png',
  'android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png',
  'android/app/src/main/res/mipmap-xxhdpi/ic_launcher_foreground.png',
  'android/app/src/main/res/mipmap-xxhdpi/ic_launcher_round.png',
  'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png',
  'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png',
  'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png',
];

for (const path of requiredCopies) {
  const bytes = readPng(path);
  if (!bytes.equals(canonicalBytes)) {
    throw new Error(`Android launcher resource drifted from approved artwork: ${path}`);
  }
}

for (const path of [
  'android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml',
  'android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml',
  'android/app/src/main/res/mipmap-anydpi-v33/ic_launcher.xml',
  'android/app/src/main/res/mipmap-anydpi-v33/ic_launcher_round.xml',
]) {
  if (!existsSync(path)) throw new Error(`Adaptive launcher resource missing: ${path}`);
  const xml = readFileSync(path, 'utf8');
  if (!xml.includes('@mipmap/ic_launcher_foreground')) {
    throw new Error(`Adaptive launcher resource is not using the approved foreground: ${path}`);
  }
}

if (manifest.includes('@drawable/command_protocols_art')) {
  throw new Error('Legacy direct drawable launcher reference is still present');
}

console.log('Verified checked-in Command Protocols launcher PNGs and adaptive mipmap chain');
