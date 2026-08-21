# Command Protocols — 40K Field Companion

A mobile-first, offline-first Necron army builder, rules reference, and tabletop battle tracker for Warhammer 40,000 11th edition.

## Android installer

[**Download Command Protocols Android installer (.apk)**](https://github.com/JinkoJink/40k-field-companion/releases/download/command-protocols-26/Command-Protocols.apk)

If your browser blocks the direct download, open the [Command Protocols releases page](https://github.com/JinkoJink/40k-field-companion/releases) and select `Command-Protocols.apk` from the newest release.

Android may ask you to allow installs from your browser or file manager. The APK is built and verified from this repository by GitHub Actions and includes the Necron rules packages in the installer.

## Current features

- Offline-first normalized Necron rules database in IndexedDB
- Current unit, Detachment Point, detachment, Enhancement, Upgrade, Binding, Stratagem, ability, keyword, points, and attachment data
- Conditional rules graph for Leader, Support, Retinue, Enhancement-granted keywords, special bodyguards, transport restrictions, and host-specific Bindings
- Individually configured unit instances, including differently sized duplicate units
- Unit-size, occurrence-tier, and Enhancement-aware roster points
- Wargear and per-model loadout configuration
- Leader, Support, Cryptek Retinue, Canoptek Retinue, and conditional bodyguard attachment validation
- Army legality validation for points, Detachment Points, Characters, Warlords, Epic Heroes, datasheet limits, Enhancements/Upgrades/Bindings, attachments, unit sizes, and loadout totals
- Persistent local roster, preferences, and battle state
- Detachment selection with the 3 DP limit and local rules text
- Datasheet, weapon, ability, keyword, transport, and attachment references
- Build, Battle, Search, and Settings views
- Battle-round and phase navigation
- Command Point, primary score, secondary score, and objective-control tracking
- Frozen battle snapshots so mid-game Build edits or later rules updates cannot rewrite the active battle
- Aggregate and exact per-model wound tracking for multi-wound units
- Collapsible Battle unit cards with configured loadouts and active conditional-rule notes
- Roster-aware Stratagem availability with CP, WHEN, TARGET, EFFECT, phase, detachment, and target restrictions
- Installable PWA shell with network-first document updates and airplane-mode startup after initialization
- Optional hash-addressed GitHub rules updates; normal play never fetches BSData or community sources directly

## Development

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
npm run preview
```

Full local verification:

```bash
npm run typecheck
npm test
npm run build:data
npm run validate:data
npm run build
```

The Vite build uses relative asset paths so it can be hosted beneath a repository path, including GitHub Pages.

## Offline data architecture

The installed client owns its database. IndexedDB object stores are partitioned into:

- `system`: schema/version, package hashes, pending updates, and last-known-good metadata
- rule stores: factions, units, profiles, weapons, abilities, keywords, detachments, enhancements, stratagems, points, leader links, source metadata, and supplemental structured data
- `dependencies` / `searchIndex`: derived local indexes
- `user`: roster, selected detachments, and preferences
- `battle`: the active game and its frozen/mutable tabletop state
- `staging`: validated update packages before atomic installation

Rules are published under `public/data/necrons/` as independently hashed packages. First initialization loads those packaged files into IndexedDB; thereafter the app reads IndexedDB immediately and never waits on a network request. The service worker caches the application shell but deliberately does not cache `/data/`, so IndexedDB remains the single validated rules source.

`data/version.json` is the small package manifest. Update checks compare hashes first; unchanged packages are not downloaded. Downloads are hash-checked and schema/referentially validated before the active tree is replaced. Partial updates rebuild only the dependent indexes they need, and an active battle defers rules installation until that battle ends.

## Publishing rules data

`scripts/build-necron-data.mjs` is a development/publishing-only importer. It reads the configured 11e Necron sources, normalizes stable internal IDs and relationships, writes package-level JSON, and calculates manifest hashes. It never runs inside the installed app.

```bash
npm run build:data
npm run validate:data
```

CI regenerates and validates the rules graph, rejects stale substantive generated packages, typechecks, runs unit tests, syntax-checks the service worker, and production-builds the app. Pages and Android publishing repeat the critical verification steps before deployment.

## Scope

Only Necrons are supported. This is intentional: the smaller dataset lets the app provide deeper unit configuration and a faction-specific tabletop companion without carrying every faction's rules on the device.
