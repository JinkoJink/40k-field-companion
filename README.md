# 40K Field Companion

## Android installer

[**Download and install Command Protocols for Android (.apk)**](https://github.com/JinkoJink/40k-field-companion/releases/latest/download/Command-Protocols.apk)

Android may ask you to allow installs from your browser or file manager. The installer is built from this repository by GitHub Actions.

A mobile-first Progressive Web App for building and playing a Necron army at the table. Its deliberately narrow faction scope supports deeper roster configuration and battle tracking.

## Current features

- Offline-first normalized Necron rules database in IndexedDB
- Current unit, detachment, enhancement, and Detachment Point data
- Individually configured unit instances, including differently sized duplicate units
- Unit-size, occurrence-tier, and Enhancement-aware roster points
- Wargear and per-model loadout configuration
- Leader-to-bodyguard attachment and Enhancement assignment
- Army legality validation for points, Detachment Points, Characters, Warlords, Epic Heroes, datasheet limits, Enhancements, leaders, unit sizes, and loadout totals
- Persistent local roster, preferences, and battle state (not localStorage or a remote service)
- Detachment selection with the 3 DP limit
- Datasheet, weapon, ability, and leader references
- Build, Battle, and Search views
- Battle-round and phase navigation
- Command Point, primary score, secondary score, and objective-control tracking
- Models, wounds, destroyed-unit, and Reanimation Protocol tracking
- Installable Android PWA with cached app shell and airplane-mode startup after initialization
- Optional hash-addressed GitHub rules updates; normal play never fetches BSData or GitHub

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

Verification:

```bash
npm test
npm run typecheck
npm run validate:data
```

The Vite build uses relative asset paths so it can be hosted beneath a repository path, including GitHub Pages.

## Offline data architecture

The installed client owns its database. IndexedDB object stores are partitioned into:

- `system`: schema/version, package hashes, update settings, last-known-good metadata
- `rules`: factions, units, profiles, weapons, abilities, keywords, detachments, enhancements, stratagems, points, leader links, source metadata
- `indexes`: search and dependency entries
- `user`: rosters, selections, preferences, and notes
- `battle`: the active game and its mutable tabletop state
- `staging`: validated update packages before atomic installation

Rules are published under `public/data/necrons/` as independently hashed packages. First initialization loads those packaged files into IndexedDB; thereafter the app reads IndexedDB immediately and never waits on a network request. The service worker caches the application shell, but it is not the rules database.

`data/version.json` is the tiny package manifest. A check compares hashes first; unchanged manifests download no packages, and a points-only update downloads/replaces only `points.json`. Downloads are hash-checked and schema/referentially validated in staging. The active rules tree is updated in one IndexedDB transaction; failures leave the last known-good tree untouched. Updates are deferred while an active battle exists, preserving that battle’s rules snapshot.

## Publishing rules data

`scripts/build-necron-data.mjs` is a development/publishing-only importer. It reads the Necron catalogue and MFM source, normalizes stable internal IDs and relationships, writes package-level JSON, and calculates manifest hashes. It never ships into or runs in the installed PWA.

```bash
npm run build:data
npm run validate:data
```

The importer requires network access to its listed sources. The installed PWA does not. Add another faction by adding a parallel package directory and manifest entry; the local schema is faction-neutral.

## Scope

Only Necrons are supported. This is intentional: the smaller dataset lets the app provide deeper unit configuration and a faction-specific tabletop companion without carrying every faction's rules on the device.
