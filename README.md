# 40K Field Companion

A mobile-first Progressive Web App for building and playing a Necron army at the table. Its deliberately narrow faction scope supports deeper roster configuration and battle tracking.

## Current features

- Live Necron unit profiles sourced from BSData
- Current unit, detachment, enhancement, and Detachment Point data
- Individually configured unit instances, including differently sized duplicate units
- Unit-size, occurrence-tier, and Enhancement-aware roster points
- Wargear and per-model loadout configuration
- Leader-to-bodyguard attachment and Enhancement assignment
- Army legality validation for points, Detachment Points, Characters, Warlords, Epic Heroes, datasheet limits, Enhancements, leaders, unit sizes, and loadout totals
- Persistent local roster and battle state
- Detachment selection with the 3 DP limit
- Datasheet, weapon, ability, and leader references
- Build, Battle, and Search views
- Battle-round and phase navigation
- Command Point, primary score, secondary score, and objective-control tracking
- Models, wounds, destroyed-unit, and Reanimation Protocol tracking
- Installable app shell with offline caching after the first successful data load

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
```

The Vite build uses relative asset paths so it can be hosted beneath a repository path, including GitHub Pages.

## Data

The app currently reads:

- `BSData/wh40k-11e` for Necron datasheet profiles
- `BSData/wh40k-11e-mfm` for points, detachments, roles, and leader relationships

These community-maintained sources are cached in the browser for 24 hours. The first load requires a network connection.

## Scope

Only Necrons are supported. This is intentional: the smaller dataset lets the app provide deeper unit configuration and a faction-specific tabletop companion without carrying every faction's rules on the device.
