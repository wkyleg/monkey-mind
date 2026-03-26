# Monkey Mind: Inner Invaders

[![CI](https://github.com/wkyleg/monkey-mind/actions/workflows/deploy.yml/badge.svg)](https://github.com/wkyleg/monkey-mind/actions/workflows/deploy.yml)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue?logo=typescript)](tsconfig.json)

**[Play Now](https://wkyleg.github.io/monkey-mind/)** | [Elata Biosciences](https://elata.io)

A mind-bending arcade game powered by **real-time neurotech** — EEG headbands and webcam heart rate detection. Escape the confines of your own mind while your brain state shapes the gameplay. A monkey escaped an experiment — the headband isn't a crown, it's a shackle turned instrument.

## Features

- **Real-time EEG integration** via Muse headband (Web Bluetooth) using the [Elata SDK](https://docs.elata.bio/sdk/overview)
- **Webcam heart rate (rPPG)** — no wearables needed, just your camera
- **Brain-reactive gameplay** — alpha waves trigger score bonuses, theta power affects enemy spawns, gamma boosts damage
- **Neuro performance reports** — end-of-level charts showing brain waves, heart rate, calm/arousal over time
- **Procedural music** — 30+ scales, 8 chord styles, 7 time signatures, heart-rate-synced tempo
- **140+ levels** across 8 acts and 12 expansion packs
- **Internationalization** — 14 languages supported

## Tech Stack

- **Vite** + **TypeScript** (strict mode) — fast dev, zero-config bundling
- **Canvas 2D** — all rendering is procedural or SVG-based, no framework
- **Vitest** + **jsdom** — comprehensive test suite
- **Biome** — formatting and linting
- **Elata SDK** — `@elata-biosciences/eeg-web`, `eeg-web-ble`, `rppg-web`

## Quick Start

```bash
pnpm install
pnpm dev          # dev server on http://localhost:3000
pnpm build        # tsc + vite build → dist/
pnpm preview      # serve production build
pnpm test         # vitest (watch mode)
pnpm typecheck    # tsc --noEmit
pnpm lint         # biome check (read-only)
pnpm format       # biome format --write
```

## Neurotech Devices

| Device | Protocol | Browser Support |
|--------|----------|----------------|
| Webcam (rPPG heart rate) | getUserMedia | All modern browsers |
| Muse S headband (EEG) | Web Bluetooth | Chrome, Edge, Brave (`chrome://flags/#enable-web-bluetooth`) |

## Repository Structure

```
src/
├── main.ts              # Entry point, loading screen, Game bootstrap
├── config.ts            # All game constants (canvas, lanes, colors, difficulty)
├── engine/              # Core engine systems
│   ├── game.ts          # Main game loop, scene/audio/input wiring
│   ├── scene.ts         # Stack-based scene manager
│   ├── renderer.ts      # Canvas 2D rendering abstraction
│   ├── input.ts         # Keyboard / gamepad / touch + neuro provider interface
│   ├── audio.ts         # SFX playback
│   ├── music.ts         # Procedural music generator (scales, modes, cultural styles)
│   ├── neuroManager.ts  # Orchestrates EEG + rPPG providers
│   ├── eegProvider.ts   # Elata EEG SDK integration
│   ├── rppgProvider.ts  # Elata rPPG SDK integration
│   ├── collision.ts     # AABB and circle collision detection
│   ├── entity.ts        # ECS-lite entity base
│   ├── camera.ts        # Viewport, shake, coordinate transforms
│   └── svgAssets.ts     # SVG manifest loader and preloader
├── gameplay/            # Game logic
│   ├── player.ts        # Player ship, health, state machine
│   ├── weapons.ts       # Projectile types, firing patterns
│   ├── enemies.ts       # Enemy types, behaviors (12 archetypes)
│   ├── bosses.ts        # Boss system with phases, attacks, transitions
│   ├── spawnerV2.ts     # Level Bible v2 spawner (archetypes + modifiers)
│   ├── hud.ts           # Heads-up display with neuro metrics
│   ├── sessionRecorder.ts # Time-series neuro data recording per level
│   ├── neuroAbilities.ts  # Brain-state-triggered abilities
│   └── ...              # powerups, drops, dialogue, meters, scoring, etc.
├── scenes/              # Game screens (17 scenes)
│   ├── campaignScene.ts # Campaign gameplay (Act + Expansion modes)
│   ├── levelReportScene.ts # End-of-level neuro performance report
│   ├── deviceGateScene.ts  # Neuro device connection flow
│   ├── neuroSettingsScene.ts # Neuro device settings
│   └── ...              # menu, pause, settings, codex, victory, etc.
├── content/             # Content loading and schemas
├── core/                # Events, storage, clock
├── graphics/            # Backgrounds, particles, effects
└── util/                # Math, RNG, color, easing, report storage

public/
├── content/             # Game content JSON
│   ├── acts/            # 8 acts × 5 levels = 40 canon levels
│   ├── expansions/      # 12 packs × ~8 levels = 100 expansion levels
│   ├── strings/         # Localization strings (14 languages)
│   └── ...              # bosses, enemies, powerups, waves
├── assets/svg/          # SVG sprite assets
└── favicon.svg
```

## Content Architecture

**Level Bible v2 (primary)** — 8 Acts with 5 levels each (40 canon campaign levels) plus 12 Expansion packs (~100 additional levels). Each level defines an enemy deck (archetypes + modifiers), background layers, rule cards, music seeds, and narrative copy.

**Neuro Integration** — The `NeuroManager` orchestrates EEG and rPPG providers. `NeuroState` exposes calm, arousal, band powers (alpha/beta/theta/delta/gamma), heart rate, HRV, and calmness state. The `SessionRecorder` captures time-series neuro data during gameplay for end-of-level reports.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

[ISC](LICENSE) — Copyright (c) 2024-2026 Elata Biosciences
