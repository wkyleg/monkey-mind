# Monkey Mind: Inner Invaders

[![CI](https://github.com/wkyleg/monkey-mind/actions/workflows/deploy.yml/badge.svg)](https://github.com/wkyleg/monkey-mind/actions/workflows/deploy.yml)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue?logo=typescript)](tsconfig.json)

**[Play Now](https://wkyleg.github.io/monkey-mind/)** | [Elata Biosciences](https://elata.bio) | [Elata SDK Docs](https://docs.elata.bio/sdk/overview)

A brain-reactive arcade game powered by real-time neurotech. EEG headbands and webcam heart rate detection shape the gameplay as you fight through waves of enemies spawned from the depths of consciousness itself. A monkey escaped an experiment -- the headband isn't a crown, it's a shackle turned instrument.

## Features

- **Brain-reactive gameplay** -- alpha waves trigger score bonuses, theta power affects enemy spawns, gamma boosts damage
- **Real-time EEG integration** via Muse headband (Web Bluetooth) using the [Elata SDK](https://docs.elata.bio/sdk/overview)
- **Webcam heart rate (rPPG)** -- no wearables needed, just your camera
- **140+ levels** across 8 acts and 12 expansion packs
- **Neuro performance reports** -- end-of-level charts showing brain waves, heart rate, calm/arousal over time
- **Procedural music** -- 30+ scales, 8 chord styles, 7 time signatures, heart-rate-synced tempo
- **12 enemy archetypes** with unique behaviors, plus multi-phase boss fights
- **Brain-state abilities** -- special powers triggered by sustained neural states
- **Internationalization** -- 14 languages supported

## Expansion Packs

12 themed expansion packs with 100+ additional levels unlock after the main campaign:

| Pack | Levels | Theme |
|------|--------|-------|
| Literature & Philosophy | 20 | Gilgamesh through Wittgenstein |
| Myth & Religion | 15 | Vedic hymns to shamanic journeys |
| Paranoia & Folk Gothic | 11 | MK Ultra, Mothman, The Backrooms |
| Science & Mind | 10 | Schrodinger's Cat to the Hard Problem |
| Art History | 9 | Great works and visual consciousness |
| State & Surveillance | 7 | Orwell, Kafka, the Panopticon |
| The Final Ascent | 7 | Ultimate challenges, final transformation |
| Monkey Variations | 6 | Lab Memories, Hanuman, Sun Wukong |
| Lost Worlds | 5 | Atlantis, Lemuria, Shambhala |
| Cosmic Horror | 4 | The vast indifference of the cosmos |
| Way of the Warrior | 3 | Bushido, Musashi, Hagakure |
| Journeys | 3 | Odyssey, Divine Comedy, Pilgrim's Progress |

## How It Works

1. **Connect** -- Pair an EEG headband or webcam for biofeedback (optional)
2. **Play** -- Defend against waves of enemies while your brain state shapes difficulty and abilities
3. **Review** -- End-of-level neuro performance report with brain wave, heart rate, and calm/arousal data

No sensors required to play. The neuro features activate when you connect a device.

## Tech Stack

- **Canvas 2D** -- all rendering is procedural or SVG-based, no framework
- **Vite** + **TypeScript** (strict mode) -- fast dev, zero-config bundling
- **Vitest** + **jsdom** -- comprehensive test suite
- **Biome** -- formatting and linting
- **Elata SDK** -- `@elata-biosciences/eeg-web`, `eeg-web-ble`, `rppg-web`

## Quick Start

```bash
pnpm install
pnpm dev          # dev server on http://localhost:3000
pnpm build        # tsc + vite build -> dist/
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
│   ├── acts/            # 8 acts x 5 levels = 40 canon levels
│   ├── expansions/      # 12 packs x ~8 levels = 100 expansion levels
│   ├── strings/         # Localization strings (14 languages)
│   └── ...              # bosses, enemies, powerups, waves
├── assets/svg/          # SVG sprite assets
└── favicon.svg
```

## Content Architecture

**Level Bible v2 (primary)** -- 8 Acts with 5 levels each (40 canon campaign levels) plus 12 Expansion packs (~100 additional levels). Each level defines an enemy deck (archetypes + modifiers), background layers, rule cards, music seeds, and narrative copy.

**Neuro Integration** -- The `NeuroManager` orchestrates EEG and rPPG providers. `NeuroState` exposes calm, arousal, band powers (alpha/beta/theta/delta/gamma), heart rate, HRV, and calmness state. The `SessionRecorder` captures time-series neuro data during gameplay for end-of-level reports.

## Deployment

Pushes to `main` trigger the CI/CD pipeline which runs lint, typecheck, and tests, then deploys to GitHub Pages.

## App store listing assets

Marketing copy and image exports for store listings (icon, banner, desktop/mobile previews, expansion art) live in [`docs/store-assets/`](docs/store-assets/). Start with `listing.json`. The PNG icon is also at [`public/favicon.png`](public/favicon.png) alongside the SVG favicon.

## Related Projects

Monkey Mind is part of the [Elata Biosciences](https://elata.bio) neurotech app ecosystem. Other apps in the series:

- **[Neuro Chess](https://github.com/wkyleg/neuro-chess)** -- Chess vs Stockfish with real-time neural composure tracking
- **[NeuroFlight](https://github.com/wkyleg/neuroflight)** -- 3D flight sim with AI dogfighting and EEG/rPPG biofeedback
- **[Reaction Trainer](https://github.com/wkyleg/reaction-trainer)** -- Stress-modulated reaction speed game with biometric difficulty scaling
- **[Breathwork Trainer](https://github.com/wkyleg/breathwork-trainer)** -- Guided breathing with live EEG and heart rate biofeedback

All apps use the [Elata Bio SDK](https://github.com/Elata-Biosciences/elata-bio-sdk) for EEG and rPPG integration.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

[ISC](LICENSE) -- Copyright (c) 2024-2026 Elata Biosciences
