/**
 * Game configuration constants
 */

export const CONFIG = {
  // Display
  CANVAS_WIDTH: 1280,
  CANVAS_HEIGHT: 720,
  ASPECT_RATIO: 16 / 9,
  TARGET_FPS: 60,
  
  // Gameplay
  LANES: 5,
  LANE_SWITCH_SPEED: 0.15, // seconds to switch lanes
  PLAYER_Y_POSITION: 0.85, // percentage from top
  
  // Weapons
  BANANA_FIRE_RATE: 0.2, // seconds between shots
  BANANA_SPEED: 600, // pixels per second
  BANANA_SIZE: 12,
  
  // Enemies
  ENEMY_BASE_SPEED: 100,
  ENEMY_SPAWN_Y: -50,
  
  // Difficulty
  DIFFICULTY_RAMP_TIME: 60, // seconds to reach max difficulty
  MIN_SPAWN_INTERVAL: 0.5,
  MAX_SPAWN_INTERVAL: 2.0,
  
  // Audio
  MASTER_VOLUME: 0.7,
  MUSIC_VOLUME: 0.5,
  SFX_VOLUME: 0.8,
  
  // Powerups
  POWERUP_DURATION: 6000, // ms
  CALM_THRESHOLD: 0.6,
  AROUSAL_THRESHOLD: 0.6,
  
  // Save
  SAVE_KEY: 'monkeymind.save.v1',
  
  // Colors (brutalist industrial palette)
  COLORS: {
    PRIMARY: '#00cccc',      // Cold cyan instead of warm green
    SECONDARY: '#cc0066',    // Harsh magenta
    ACCENT: '#ff3300',       // Industrial orange-red
    CALM: '#0088cc',         // Cold blue
    PASSION: '#ff2200',      // Aggressive red
    BACKGROUND: '#080810',   // Near black with cold tinge
    BACKGROUND_LIGHT: '#12141e', // Dark slate
    TEXT: '#e0e8f0',         // Cold white
    TEXT_DIM: '#5a6070',     // Slate grey
    TEXT_LIGHT: '#b0b8c0',   // Light grey
    DANGER: '#ff2222',       // Harsh red
    SUCCESS: '#00ccaa',      // Industrial teal
    WARNING: '#cc6600',      // Burnt orange
    NEURAL: '#00cccc',       // Clinical cyan
    HELMET: '#1a1a28',       // Dark metal
  },
  
  // Debug
  DEBUG: false,
  SHOW_HITBOXES: false,
  SHOW_FPS: false,
} as const;

export type Config = typeof CONFIG;
