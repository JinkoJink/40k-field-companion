# Command Protocols — 40K Field Companion

A mobile-first, offline-first Necron army builder, rules reference, and tabletop battle tracker for Warhammer 40,000 11th edition.

## Current features

- Offline-first normalized Necron rules database in IndexedDB
- Bundled Necron unit, Detachment Point, detachment, Enhancement, Upgrade, Binding, Stratagem, ability, keyword, points, and attachment data
- Conditional rules graph for Leader, Support, Retinue, Enhancement-granted keywords, special bodyguards, transport restrictions, and host-specific Bindings
- Individually configured unit instances, including differently sized duplicate units
- Unit-size, occurrence-tier, and Enhancement-aware roster points
- Wargear and per-model loadout configuration
- Leader, Support, Cryptek Retinue, Canoptek Retinue, Murdermind, and conditional bodyguard attachment validation
- Army legality validation for points, Detachment Points, Characters, Warlords, Epic Heroes, datasheet limits, Enhancements/Upgrades/Bindings, attachments, unit sizes, and loadout totals
- Persistent local roster, preferences, and battle state
- Detachment selection with the 3 DP limit and local rules text
- Datasheet, weapon, ability, keyword, transport, and attachment references
- Build, Battle, Search, and Settings views
- Battle-round and phase navigation
- Command Point, primary score, secondary score, and objective-control tracking
- Frozen battle snapshots so Build edits cannot rewrite an active battle
- Aggregate and exact per-model wound tracking for multi-wound units
- Collapsible Battle unit cards with configured loadouts and attachment-rule notes
- Roster-aware Stratagem availability with CP, WHEN, TARGET, EFFECT, phase, detachment, and target restrictions
- Installable Android package and PWA shell with the validated rules dataset included locally

## Current release mode

Automatic 11e data publishing and client-side network rules updates are quarantined. Production builds use the checked-in, validated rules dataset in `public/data/` and do not regenerate or install a different rules tree during release. The quarantined updater/publisher implementation is preserved on the `quarantine/automatic-rules-updates` branch until development on it is explicitly resumed.

## Development

```bash
npm install
npm run dev
```

Production verification:

```bash
npm run typecheck
npm test
npm run validate:data
npm run build
```

`npm run build:data` intentionally does not regenerate rules while the publisher is quarantined.

The Vite build uses relative asset paths so it can be hosted beneath a repository path, including GitHub Pages.

## Offline data architecture

The installed client owns its database. IndexedDB object stores are partitioned into:

- `system`: schema/version and last-known-good metadata
- rule stores: factions, units, profiles, weapons, abilities, keywords, detachments, enhancements, stratagems, points, leader links, source metadata, and supplemental structured data
- `dependencies` / `searchIndex`: derived local indexes
- `user`: roster, selected detachments, and preferences
- `battle`: the active game and its frozen/mutable tabletop state
- `staging`: retained for validated package handling when updater development resumes

Rules are bundled under `public/data/necrons/`. First initialization loads those packaged files into IndexedDB; thereafter normal play reads the validated local database. Active battles keep their own roster, detachment, datasheet, weapon, ability, and wound-state snapshots.

## Rules data publishing

The live publisher is not present on `main` while quarantined. Its implementation is preserved on `quarantine/automatic-rules-updates`. The checked-in data can still be validated with:

```bash
npm run validate:data
```

## Scope

Only Necrons are supported. This is intentional: the smaller dataset lets the app provide deeper unit configuration and a faction-specific tabletop companion without carrying every faction's rules on the device.
