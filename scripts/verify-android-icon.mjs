import { readFileSync, existsSync } from 'node:fs';

const manifest = readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');
if (!manifest.includes('android:icon="@mipmap/ic_launcher"')) {
  throw new Error('Android manifest must use @mipmap/ic_launcher');
}
if (!manifest.includes('android:roundIcon="@mipmap/ic_launcher_round"')) {
  throw new Error('Android manifest must use @mipmap/ic_launcher_round');
}

const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const canonical = 'assets/icon.png';
const approvedArtCopies = [
  'android/app/src/main/res/drawable-nodpi/command_protocols_icon.png',
  'android/app/src/main/res/drawable-nodpi/command_protocols_art.png',
];

function readPng(path) {
  if (!existsSync(path)) throw new Error(`Android launcher resource missing: ${path}`);
  const bytes = readFileSync(path);
  if (bytes.length < 24 || !bytes.subarray(0, pngMagic.length).equals(pngMagic)) {
    throw new Error(`Android launcher resource is not a valid PNG: ${path}`);
  }
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (!width || !height) throw new Error(`Android launcher PNG has invalid dimensions: ${path}`);
  return { bytes, width, height };
}

const canonicalPng = readPng(canonical);
if (canonicalPng.width !== canonicalPng.height) {
  throw new Error(`Canonical launcher artwork must be square: ${canonicalPng.width}x${canonicalPng.height}`);
}
if (canonicalPng.width < 256) {
  throw new Error(`Canonical launcher artwork is too small: ${canonicalPng.width}x${canonicalPng.height}`);
}

for (const path of approvedArtCopies) {
  const png = readPng(path);
  if (!png.bytes.equals(canonicalPng.bytes)) {
    throw new Error(`Approved launcher artwork drifted from ${canonical}: ${path}`);
  }
}

const legacyLaunchers = [
  'android/app/src/main/res/mipmap-nodpi/ic_launcher.png',
  'android/app/src/main/res/mipmap-nodpi/ic_launcher_round.png',
  'android/app/src/main/res/mipmap-mdpi/ic_launcher.png',
  'android/app/src/main/res/mipmap-mdpi/ic_launcher_round.png',
  'android/app/src/main/res/mipmap-hdpi/ic_launcher.png',
  'android/app/src/main/res/mipmap-hdpi/ic_launcher_round.png',
  'android/app/src/main/res/mipmap-xhdpi/ic_launcher.png',
  'android/app/src/main/res/mipmap-xhdpi/ic_launcher_round.png',
  'android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png',
  'android/app/src/main/res/mipmap-xxhdpi/ic_launcher_round.png',
  'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png',
  'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png',
];
for (const path of legacyLaunchers) readPng(path);

const foreground = 'android/app/src/main/res/drawable/command_protocols_foreground.xml';
if (!existsSync(foreground)) throw new Error(`Adaptive launcher foreground missing: ${foreground}`);
const foregroundXml = readFileSync(foreground, 'utf8');
if (!foregroundXml.includes('@drawable/command_protocols_art')) {
  throw new Error('Adaptive launcher foreground must use @drawable/command_protocols_art');
}
if (!foregroundXml.includes('android:scaleWidth="72%"') || !foregroundXml.includes('android:scaleHeight="72%"')) {
  throw new Error('Adaptive launcher foreground must preserve the approved safe-zone scaling');
}

for (const path of [
  'android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml',
  'android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml',
  'android/app/src/main/res/mipmap-anydpi-v33/ic_launcher.xml',
  'android/app/src/main/res/mipmap-anydpi-v33/ic_launcher_round.xml',
]) {
  if (!existsSync(path)) throw new Error(`Adaptive launcher resource missing: ${path}`);
  const xml = readFileSync(path, 'utf8');
  if (!xml.includes('@drawable/command_protocols_foreground')) {
    throw new Error(`Adaptive launcher resource is not using the safe-zone foreground: ${path}`);
  }
}

console.log(`Verified Command Protocols launcher artwork (${canonicalPng.width}x${canonicalPng.height}) and adaptive icon safe zone`);
