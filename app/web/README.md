# Stellar

> "A bit of madness is key to give us new colors to see."

Stellar was inspired by a remarkable person — the kind you meet once and suddenly the world has more color in it. This app exists because some connections deserve to be explored, understood, and celebrated.

## What it does

A cosmic birth chart generator with personalized astrological interpretations. Compare charts in romantic or friendship mode, track compatibility quests, and explore daily transit outlooks — all wrapped in a starfield you could stare at for hours.

## Features

- Single and compatibility (synastry) chart generation
- Chart settings panel (house system, orb profile, minor-aspect toggle)
- Adapter-based astro engine (`SwissEphemerisAdapter` default, astronomy fallback)
- Bilingual: English and Carioca Portuguese
- RPG-style relationship quests with XP progression
- Multi-area navigation: Chart, Transits, Timing, Relationships, Atlas, Library
- Daily transit outlook, exact-hit transit feed, and compatibility timeline
- Timing modules: secondary progression, solar/lunar return, annual profection, Saturn return tracker
- Relationship modules: synastry + composite + Davison charts
- Astrocartography line generation
- Full accessibility and responsive design
- All calculations run locally — no data leaves your device

## Stack

React 19 + TypeScript 5.9 + Vite 7 — astronomy-engine for planetary math, Nominatim for geocoding, tz-lookup for timezones.

## Run

```bash
cd app/web && npm install && npm run dev
```

---

*"Here's to the ones who dream, foolish as they may seem."*
