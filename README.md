# Monkey Mind: Inner Invaders

A psychedelic arcade shooter where you escape the confines of your own mind. A monkey escaped an unethical experiment — the headband isn't a crown, it's a shackle turned instrument. Pilot a craft through inner space, where mental habits congeal into adversaries and environments.

Built for the [Elata](https://elata.io) App Store with future BCI/EEG integration hooks.

## Tech Stack

- **Vite** + **TypeScript** — fast dev server, strict mode, bundler module resolution
- **Canvas 2D** — all rendering is procedural or SVG-based, no framework
- **Vitest** + **jsdom** — 2200+ unit and integration tests
- **Biome** — formatting and linting

## Quick Start

```bash
npm install
npm run dev       # dev server on http://localhost:3000
npm run build     # tsc + vite build → dist/
npm run preview   # serve production build
npm test          # vitest (watch mode)
npm run check     # biome lint + format check
```

## Repository Structure

```
src/
├── main.ts              # Entry point, loading screen, Game bootstrap
├── config.ts            # All game constants (canvas, lanes, colors, difficulty)
├── engine/              # Core engine systems
│   ├── game.ts          # Main game loop, scene/audio/input wiring
│   ├── scene.ts         # Stack-based scene manager
│   ├── renderer.ts      # Canvas 2D rendering abstraction
│   ├── input.ts         # Keyboard / gamepad / touch + BCI provider interface
│   ├── audio.ts         # SFX playback
│   ├── music.ts         # Procedural music generator (scales, modes, cultural styles)
│   ├── collision.ts     # AABB and circle collision detection
│   ├── entity.ts        # ECS-lite entity base + pool
│   ├── camera.ts        # Viewport, shake, coordinate transforms
│   ├── svgAssets.ts     # SVG manifest loader and preloader
│   └── bciMock.ts       # Mock BCI provider for development
├── gameplay/            # Game logic
│   ├── player.ts        # Player ship, health, state machine
│   ├── weapons.ts       # Projectile types, firing patterns
│   ├── enemies.ts       # Enemy types, behaviors (12 archetypes)
│   ├── bosses.ts        # Boss system with phases, attacks, transitions
│   ├── spawner.ts       # Legacy sector-based wave spawner
│   ├── spawnerV2.ts     # Level Bible v2 spawner (archetypes + modifiers)
│   ├── powerups.ts      # Calm / Passion power-up system
│   ├── drops.ts         # Health and upgrade drop system
│   ├── dialogue.ts      # Enemy spawn/death text popups
│   ├── hud.ts           # Heads-up display
│   ├── difficulty.ts    # Adaptive difficulty scaling
│   ├── scoring.ts       # Score + combo system
│   ├── meters.ts        # Meta-progression meters (noise, focus, stillness)
│   ├── archetypes.ts    # Archetype behavior definitions
│   ├── modifiers.ts     # AI modifier effect definitions
│   ├── ruleCards.ts     # One-new-mechanic-per-level rule cards
│   ├── achievements.ts  # Achievement tracking
│   └── codex.ts         # In-game lore codex
├── scenes/              # Game screens
│   ├── menuScene.ts     # Main menu
│   ├── campaignScene.ts # Campaign gameplay (Act + Sector dual path)
│   ├── endlessScene.ts  # Endless/survival mode
│   ├── bossScene.ts     # Boss encounters
│   ├── levelSelectScene.ts # Act/expansion/sector selection
│   ├── levelStoryScene.ts  # Inter-level narrative
│   ├── introScene.ts    # Opening sequence
│   ├── transitionScene.ts  # Sector transition
│   ├── victoryScene.ts  # Win screen
│   ├── pauseScene.ts    # Pause overlay
│   ├── settingsScene.ts # Settings menu
│   └── codexScene.ts    # Codex browser
├── graphics/            # Visual systems
│   ├── backgrounds.ts   # Parallax backgrounds (procedural + SVG)
│   ├── particles.ts     # Particle effects
│   ├── effects.ts       # Screen effects (flash, warp, etc.)
│   └── procedural.ts    # Procedural shape generation
├── content/             # Content loading and schemas
│   ├── schema.ts        # Level Bible v2 types (archetypes, modifiers, acts, etc.)
│   └── loader.ts        # Runtime JSON content loader
├── core/                # Infrastructure
│   ├── events.ts        # Typed event bus
│   ├── storage.ts       # localStorage save/load
│   ├── clock.ts         # Fixed-timestep game clock
│   └── assetLoader.ts   # Generic asset loading
└── util/                # Math, RNG, color, easing helpers

public/
├── content/             # Authoritative game content (served at /content/)
│   ├── index.json       # Content manifest
│   ├── acts/            # 8 acts × 5 levels = 40 canon levels
│   ├── expansions/      # 12 packs × ~8 levels = 100 expansion levels
│   ├── sectors/         # Legacy 5-sector content
│   ├── bosses/          # 13 boss definitions
│   ├── enemies/         # Enemy tier packs
│   ├── powerups/        # Power-up definitions
│   ├── waves/           # Legacy wave data
│   └── strings/         # Localization strings
├── assets/svg/          # SVG sprite assets
│   ├── acts/            # Per-act enemy and background SVGs
│   ├── expansions/      # Per-expansion enemy and background SVGs
│   ├── bosses/          # Boss SVGs
│   └── ...              # Player, UI, and other SVGs
└── favicon.svg
```

## Content Architecture

The game has two parallel content systems:

**Level Bible v2 (primary)** — 8 Acts with 5 levels each (40 canon campaign levels) plus 12 Expansion packs (~100 additional levels). Each level defines an enemy deck (archetypes + modifiers), background layers, rule cards, music seeds, and narrative copy layers.

**Legacy Sectors** — 5 original sectors with wave-based spawning. The campaign scene supports both systems via a `campaignMode` toggle (`'act'` | `'expansion'` | `'sector'`).

## BCI / Neuro Hooks

The input system has a provider interface for future BCI integration. A `MockBCIProvider` exists for development. The `InputManager` exposes `calm` and `arousal` signals that gameplay systems can read. The `NeuroHook` schema in `LevelDataV2` defines per-level BCI triggers that are specced but not wired to real hardware.

## License

ISC
