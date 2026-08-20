# 40K Field Companion

A mobile-first Progressive Web App for building and playing Warhammer 40,000 armies at the table. Necrons are the initial supported faction, with room to add Orks and other factions later.

## Current features

- Live Necron unit profiles sourced from BSData
- Current unit, detachment, enhancement, and Detachment Point data
- Unit-size and tier-aware roster points
- Persistent local roster
- Detachment selection with the 3 DP limit
- Datasheet, weapon, ability, and leader references
- Build, Battle, and Search views
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

The Vite build uses relative asset paths so it can be hosted beneath a repository path, including GitHub Pages.

## Data

The app currently reads:

- `BSData/wh40k-11e` for Necron datasheet profiles
- `BSData/wh40k-11e-mfm` for points, detachments, roles, and leader relationships

These community-maintained sources are cached in the browser for 24 hours. The first load requires a network connection.

## Known limitations

- The builder does not yet validate complete army legality, wargear, leader attachments, or enhancement assignments.
- Duplicate units currently share one selected model count.
- Battle Mode is a roster reference; command points, scoring, objectives, and wounds still need dedicated trackers.
- Only Necrons are supported.
