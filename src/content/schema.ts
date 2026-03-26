/**
 * Content schema types for data-driven game content
 * Level Bible v2 - 8 Acts, 40 Canon Levels, 60+ Expansion Levels
 */

// ============================================================================
// LEVEL BIBLE V2 - NEW TYPES
// ============================================================================

/**
 * 12 Enemy Archetypes - Base behaviors that can be combined with modifiers
 */
export type EnemyArchetype =
  | 'drifter' // Slow, predictable descent
  | 'chaser' // Homes toward player lane
  | 'sniper' // Stationary, fires aimed shots
  | 'swarm' // Small units, overwhelm
  | 'splitter' // Breaks into 2+ on death
  | 'shieldbearer' // Front shield, must flank
  | 'mimic' // Copies player shot pattern
  | 'anchor' // Creates hazard field
  | 'courier' // Drops power-ups/traps on death
  | 'phaser' // Blinks, ignores some bullets
  | 'weaver' // Draws SVG spline hazards
  | 'boss_chassis'; // Modular boss component

/**
 * 12 AI Modifiers - Applied to archetypes for combinatorial variety
 */
export type AIModifier =
  | 'observed' // Wakes only when player looks at it (eye-tracking ready)
  | 'unseen' // Vulnerable only when NOT looked at (eye-tracking ready)
  | 'recursive' // Respawns weaker copy on death
  | 'bureaucratic' // Must be shot in sequence (symbols)
  | 'mythic' // Fate shield, prophecy condition
  | 'simulacrum' // Fake enemy, vanishes on hit
  | 'apophenic' // Spawns trap patterns that look meaningful
  | 'entropy' // Shots accelerate over time
  | 'koan' // Defeated by "wrong" action
  | 'labyrinthine' // Emerges from maze walls
  | 'liturgical' // Wave timing follows rhythm
  | 'incompleteness'; // Cannot be fully defeated, must escape

/**
 * Meta-progression meters - Track player mental state
 */
export interface MetaMeters {
  noise: number; // 0-100: Screen chaos level, high noise spawns reactive enemies
  focus: number; // 0-100: Earned by clean play (no damage), unlocks precision tools
  stillness: number; // 0-100: Earned by calm survival, unlocks defensive miracles
}

/**
 * Rule Card - One new mechanic introduced per level
 */
export interface RuleCard {
  icon: string; // SVG icon ID for the rule
  hint: string; // One-line hint shown to player
  mechanic: string; // Internal mechanic ID
  params?: Record<string, unknown>; // Mechanic-specific parameters
}

/**
 * Copy layers for narrative content
 */
export interface CopyLayers {
  ruleCard: string; // Mandatory, short gameplay hint
  codexSnippet?: string; // Optional, 2-4 lines high-brow reference
  radioWhisper?: string; // Optional, 1 line Art Bell mood humor
}

/**
 * Background layer for parallax effects
 */
export interface BackgroundLayer {
  svgId: string; // SVG asset ID
  parallaxSpeed: number; // 0-1, how fast it scrolls relative to game
  opacity?: number; // 0-1
  tint?: string; // Color tint to apply
  animation?: string; // Animation type (pulse, drift, flicker)
}

/**
 * Hazard configuration for level hazards
 */
export interface HazardConfig {
  type: string; // Hazard type ID
  lanes?: number[]; // Which lanes it affects
  timing?: number; // Timing in ms
  damage?: number; // Damage dealt
  visual?: string; // SVG asset ID
}

/**
 * Enemy deck entry - Weighted enemy spawn configuration
 */
export interface EnemyDeckEntry {
  archetype: EnemyArchetype;
  modifiers?: AIModifier[];
  weight: number; // Spawn weight (higher = more common)
  params?: Record<string, unknown>; // Override default params
  visualId?: string; // Custom visual ID for this enemy type
}

/**
 * Neuro hook for future BCI integration
 */
export interface NeuroHook {
  trigger: 'calm' | 'arousal' | 'focus' | 'gaze';
  threshold: number; // 0-1 activation threshold
  effect: string; // Effect to trigger
  params?: Record<string, unknown>;
}

/**
 * Music seed for procedural music generation
 */
export interface MusicSeedConfig {
  seed: string; // Seed string for deterministic generation
  mode: string; // Musical mode (dorian, phrygian, etc.)
  tempoRange: [number, number]; // Min/max BPM
  intensity?: number; // 0-1 base intensity
  scale?: string; // Explicit scale name (e.g. 'harmonic_minor')
  style?: string; // Chord progression style (e.g. 'dark', 'dreamy')
  culturalStyle?: string; // Cultural preset (e.g. 'japanese', 'arabic')
  timeSignature?: string; // Explicit time signature (e.g. '7/8')
}

/**
 * Level-specific enemy dialogue
 */
export interface LevelEnemyDialogue {
  spawn: string[]; // Lines when spawning
  death: string[]; // Lines when dying
}

/**
 * Level-specific enemy configuration
 */
export interface LevelEnemyConfig {
  visualId: string; // SVG asset ID for this enemy
  dialogue?: LevelEnemyDialogue; // Dialogue for this specific enemy
}

/**
 * Act visual style configuration
 */
export interface ActVisualStyle {
  palette: string[]; // Color palette for the act
  bgPattern: string; // Background pattern type
  enemyStyle: string; // Enemy visual style
  particleStyle: string; // Particle effect style
  uiTheme: string; // UI color theme
}

/**
 * Level data for Level Bible v2 (enhanced version)
 */
export interface LevelDataV2 {
  id: string;
  act?: number; // 1-8 for canon, 0 or undefined for expansion
  expansion?: string; // Expansion ID for expansion levels (e.g., "art", "cosmic")
  index: number; // Level index within act or expansion
  title: string;
  subtitle?: string;
  themeTags: string[]; // Tags for theming (e.g., ["myth", "ocean"])
  ruleCard: RuleCard;
  enemyDeck: EnemyDeckEntry[];
  hazards: HazardConfig[];
  bgLayers: BackgroundLayer[];
  boss?: string | { id: string; introText?: string; outroText?: string }; // Boss ID or config
  copyLayers: CopyLayers;
  musicSeed: MusicSeedConfig;
  neuroHooks?: NeuroHook[];
  breatheGate?: boolean;
  duration?: number;
  unlockCondition?: string; // Condition to unlock this level
  levelEnemies?: Record<string, LevelEnemyConfig>; // Level-specific enemy visuals and dialogue
}

/**
 * Act data - Groups 5 levels into a thematic act
 */
export interface ActData {
  id: string;
  number: number; // 1-8
  name: string;
  thesis: string; // Thematic statement for the act
  storyBeat: string; // How the origin story manifests
  visualCallbacks: string[]; // Visual elements that reference the origin
  levels: LevelDataV2[];
  visualStyle: ActVisualStyle;
  bossId: string; // Boss for this act
  unlocks: {
    powerups?: string[];
    codex?: string[];
    cosmetics?: string[];
  };
  musicParams?: MusicParamsData;
}

/**
 * Expansion category for bonus levels
 */
export interface ExpansionCategory {
  id: string;
  name: string;
  description: string;
  levels: LevelDataV2[];
  unlockCondition?: string; // When this category becomes available
}

// ============================================================================
// ORIGINAL TYPES (preserved for backwards compatibility)
// ============================================================================

// Music parameters for data-driven music system
export interface MusicParamsData {
  tempo?: number;
  intensity?: number;
  filterCutoff?: number;
  detuneAmount?: number;
  useReverb?: boolean;
  distortionAmount?: number;
}

// Sector (level group) schema
export interface SectorData {
  id: string;
  name: string;
  description: string;
  theme: {
    bg: string;
    palette: string[];
    pattern: string;
  };
  lanes: number;
  levels: LevelData[];
  boss: string;
  unlocks: {
    powerups?: string[];
    codex?: string[];
    cosmetics?: string[];
  };
  // Music customization
  musicParams?: MusicParamsData;
  // Ambient visual effects
  ambientEffects?: string[];
}

export interface LevelData {
  id: string;
  waves: string[];
  miniboss?: string;
  duration?: number;
  // Music overrides per level
  musicOverrides?: MusicParamsData;
  // Wave intro text
  introText?: string;
}

// Enemy schema
export interface EnemyData {
  id: string;
  name: string;
  tier: 1 | 2 | 3 | 4 | 5;
  hp: number;
  speed: number;
  behavior: string;
  scoreValue: number;
  dropTable: string;
  visual: {
    type: 'circle' | 'rect' | 'custom';
    color: string;
    size: number;
    glow?: boolean;
  };
  codexEntry?: string;
  // Dialogue system
  spawnText?: string[]; // Text when spawning (random selection)
  deathText?: string[]; // Text when dying (random selection)
  dialogue?: string[]; // General quotes (random selection)
}

export interface EnemyPackData {
  id: string;
  name: string;
  enemies: EnemyData[];
}

// Wave schema
export interface WaveEnemyGroup {
  type: string; // enemy ID
  count?: number;
  behavior?: string; // override default behavior
  spawnDelayMs?: number; // delay between spawns in this group
}

export interface WaveData {
  id: string;
  pattern: string;
  enemy: string; // Legacy: single enemy type
  enemies?: WaveEnemyGroup[]; // New: array of enemy groups
  count?: number;
  rows?: number;
  cols?: number;
  entryDelayMs: number;
  spawnDelayMs?: number; // Delay between groups
  laneDrift?: number;
  speedMod?: number;
}

// Boss schema
export interface BossData {
  id: string;
  name: string;
  title: string;
  hp: number;
  phases: BossPhase[];
  visual: {
    type: string;
    color: string;
    size: number;
    glow?: boolean;
  };
  codexEntry: string;
  defeatUnlocks: string[];
}

export interface BossPhase {
  hpThreshold: number;
  pattern: string;
  duration?: number;
  speedMod: number;
  attacks: BossAttack[];
}

export interface BossAttack {
  type: string;
  cooldown: number;
  damage: number;
  params: Record<string, unknown>;
}

// Powerup schema
export interface PowerupData {
  id: string;
  name: string;
  category: 'calm' | 'passion' | 'neutral';
  durationMs: number;
  effect: string;
  uiName: string;
  description: string;
  visual: {
    color: string;
    icon: string;
  };
}

// Codex entry schema
export interface CodexEntry {
  id: string;
  category: 'enemy' | 'boss' | 'lore' | 'file';
  name: string;
  text: string;
  observedBehavior?: string;
  unlockCondition?: string;
}

// Achievement schema
export interface AchievementData {
  id: string;
  name: string;
  description: string;
  icon: string;
  condition: {
    type: string;
    target: number;
    stat?: string;
    boss?: string; // For boss-specific achievements
  };
  reward?: {
    type: string;
    id: string;
  };
}

// Cosmetic schema
export interface CosmeticData {
  id: string;
  type: 'monkeySkin' | 'bananaType' | 'trail';
  name: string;
  description: string;
  unlockCondition?: string;
  visual: Record<string, unknown>;
}

// Strings (localization)
export interface StringsData {
  ui: Record<string, string>;
  codex: Record<string, CodexEntry>;
  achievements: Record<string, { name: string; description: string }>;
  enemies: Record<string, { name: string; description: string }>;
  bosses: Record<string, { name: string; title: string; description: string }>;
  powerups: Record<string, { name: string; description: string }>;
}

// Content index
export interface ContentIndex {
  sectors: string[];
  enemyPacks: string[];
  bosses: string[];
  powerups: string[];
  waves: string[];
  strings: string[];
  // Level Bible v2 additions
  acts?: string[]; // Act JSON files
  expansionCategories?: string[]; // Expansion category JSON files
}

// Complete content store
export interface GameContent {
  sectors: Map<string, SectorData>;
  enemies: Map<string, EnemyData>;
  bosses: Map<string, BossData>;
  powerups: Map<string, PowerupData>;
  waves: Map<string, WaveData>;
  codex: Map<string, CodexEntry>;
  achievements: Map<string, AchievementData>;
  cosmetics: Map<string, CosmeticData>;
  strings: StringsData;
  // Level Bible v2 additions
  acts: Map<string, ActData>;
  expansionCategories: Map<string, ExpansionCategory>;
  levelsV2: Map<string, LevelDataV2>;
  metaMeters: MetaMeters;
}

// ============================================================================
// ARCHETYPE AND MODIFIER DEFINITIONS
// ============================================================================

/**
 * Archetype behavior definition - How each archetype moves and acts
 */
export interface ArchetypeBehavior {
  id: EnemyArchetype;
  name: string;
  description: string;
  baseSpeed: number; // Base movement speed multiplier
  baseHp: number; // Base HP multiplier
  movementPattern: string; // Movement pattern ID
  attackPattern?: string; // Attack pattern ID (if any)
  onDeathEffect?: string; // Effect triggered on death
  visualHint: string; // Visual style hint for SVG generation
}

/**
 * Modifier effect definition - How each modifier changes behavior
 */
export interface ModifierEffect {
  id: AIModifier;
  name: string;
  description: string;
  eyeTrackingReady: boolean; // Whether this works with eye tracking
  speedMod: number; // Speed multiplier
  hpMod: number; // HP multiplier
  behaviorOverride?: string; // Override movement behavior
  specialEffect: string; // Special effect ID
  visualOverlay?: string; // Visual overlay for the enemy
}

/**
 * Default archetype behaviors
 */
export const ARCHETYPE_BEHAVIORS: Record<EnemyArchetype, ArchetypeBehavior> = {
  drifter: {
    id: 'drifter',
    name: 'Drifter',
    description: 'Slow, predictable descent',
    baseSpeed: 0.5,
    baseHp: 1,
    movementPattern: 'straight_descend',
    visualHint: 'simple_shape',
  },
  chaser: {
    id: 'chaser',
    name: 'Chaser',
    description: 'Homes toward player lane',
    baseSpeed: 0.8,
    baseHp: 1,
    movementPattern: 'chase_player',
    visualHint: 'arrow_eye_motif',
  },
  sniper: {
    id: 'sniper',
    name: 'Sniper',
    description: 'Stationary, fires aimed shots',
    baseSpeed: 0,
    baseHp: 2,
    movementPattern: 'stationary',
    attackPattern: 'aimed_shot',
    visualHint: 'crosshair_glow',
  },
  swarm: {
    id: 'swarm',
    name: 'Swarm',
    description: 'Small units, overwhelm',
    baseSpeed: 1.2,
    baseHp: 0.5,
    movementPattern: 'swarm_cluster',
    visualHint: 'particle_cluster',
  },
  splitter: {
    id: 'splitter',
    name: 'Splitter',
    description: 'Breaks into 2+ on death',
    baseSpeed: 0.6,
    baseHp: 2,
    movementPattern: 'straight_descend',
    onDeathEffect: 'split_spawn',
    visualHint: 'fractal_core',
  },
  shieldbearer: {
    id: 'shieldbearer',
    name: 'Shieldbearer',
    description: 'Front shield, must flank',
    baseSpeed: 0.4,
    baseHp: 3,
    movementPattern: 'straight_descend',
    visualHint: 'barrier_aura',
  },
  mimic: {
    id: 'mimic',
    name: 'Mimic',
    description: 'Copies player shot pattern',
    baseSpeed: 0.7,
    baseHp: 1.5,
    movementPattern: 'mirror_player',
    attackPattern: 'copy_player',
    visualHint: 'mirror_surface',
  },
  anchor: {
    id: 'anchor',
    name: 'Anchor',
    description: 'Creates hazard field',
    baseSpeed: 0.3,
    baseHp: 4,
    movementPattern: 'slow_descend',
    attackPattern: 'hazard_field',
    visualHint: 'radial_lines',
  },
  courier: {
    id: 'courier',
    name: 'Courier',
    description: 'Drops power-ups/traps on death',
    baseSpeed: 1.0,
    baseHp: 1,
    movementPattern: 'zigzag',
    onDeathEffect: 'drop_item',
    visualHint: 'cargo_glow',
  },
  phaser: {
    id: 'phaser',
    name: 'Phaser',
    description: 'Blinks, ignores some bullets',
    baseSpeed: 0.9,
    baseHp: 1.5,
    movementPattern: 'phase_shift',
    visualHint: 'flickering_opacity',
  },
  weaver: {
    id: 'weaver',
    name: 'Weaver',
    description: 'Draws SVG spline hazards',
    baseSpeed: 0.5,
    baseHp: 2,
    movementPattern: 'weave_pattern',
    attackPattern: 'draw_hazard',
    visualHint: 'thread_trails',
  },
  boss_chassis: {
    id: 'boss_chassis',
    name: 'Boss Chassis',
    description: 'Modular boss component',
    baseSpeed: 0.2,
    baseHp: 10,
    movementPattern: 'boss_pattern',
    visualHint: 'complex_geometry',
  },
};

/**
 * Default modifier effects
 */
export const MODIFIER_EFFECTS: Record<AIModifier, ModifierEffect> = {
  observed: {
    id: 'observed',
    name: 'Observed',
    description: 'Wakes only when player looks at it',
    eyeTrackingReady: true,
    speedMod: 1.0,
    hpMod: 1.0,
    specialEffect: 'gaze_activate',
    visualOverlay: 'dormant_until_seen',
  },
  unseen: {
    id: 'unseen',
    name: 'Unseen',
    description: 'Vulnerable only when NOT looked at',
    eyeTrackingReady: true,
    speedMod: 1.0,
    hpMod: 1.0,
    specialEffect: 'gaze_invulnerable',
    visualOverlay: 'fade_when_watched',
  },
  recursive: {
    id: 'recursive',
    name: 'Recursive',
    description: 'Respawns weaker copy on death',
    eyeTrackingReady: false,
    speedMod: 0.9,
    hpMod: 1.2,
    specialEffect: 'death_respawn',
    visualOverlay: 'echo_effect',
  },
  bureaucratic: {
    id: 'bureaucratic',
    name: 'Bureaucratic',
    description: 'Must be shot in sequence (symbols)',
    eyeTrackingReady: false,
    speedMod: 0.7,
    hpMod: 1.5,
    specialEffect: 'sequence_required',
    visualOverlay: 'symbol_display',
  },
  mythic: {
    id: 'mythic',
    name: 'Mythic',
    description: 'Fate shield, prophecy condition',
    eyeTrackingReady: false,
    speedMod: 0.8,
    hpMod: 2.0,
    specialEffect: 'fate_shield',
    visualOverlay: 'mythic_aura',
  },
  simulacrum: {
    id: 'simulacrum',
    name: 'Simulacrum',
    description: 'Fake enemy, vanishes on hit',
    eyeTrackingReady: false,
    speedMod: 1.0,
    hpMod: 0.1,
    specialEffect: 'vanish_on_hit',
    visualOverlay: 'translucent',
  },
  apophenic: {
    id: 'apophenic',
    name: 'Apophenic',
    description: 'Spawns trap patterns that look meaningful',
    eyeTrackingReady: false,
    speedMod: 0.8,
    hpMod: 1.0,
    specialEffect: 'pattern_trap',
    visualOverlay: 'meaningful_pattern',
  },
  entropy: {
    id: 'entropy',
    name: 'Entropy',
    description: 'Shots accelerate over time',
    eyeTrackingReady: false,
    speedMod: 1.0,
    hpMod: 1.0,
    specialEffect: 'accelerating_shots',
    visualOverlay: 'decay_effect',
  },
  koan: {
    id: 'koan',
    name: 'Koan',
    description: 'Defeated by "wrong" action',
    eyeTrackingReady: false,
    speedMod: 0.6,
    hpMod: 1.0,
    specialEffect: 'paradox_defeat',
    visualOverlay: 'zen_circle',
  },
  labyrinthine: {
    id: 'labyrinthine',
    name: 'Labyrinthine',
    description: 'Emerges from maze walls',
    eyeTrackingReady: false,
    speedMod: 0.7,
    hpMod: 1.3,
    specialEffect: 'wall_emerge',
    visualOverlay: 'maze_pattern',
  },
  liturgical: {
    id: 'liturgical',
    name: 'Liturgical',
    description: 'Wave timing follows rhythm',
    eyeTrackingReady: false,
    speedMod: 1.0,
    hpMod: 1.0,
    specialEffect: 'rhythm_sync',
    visualOverlay: 'musical_notation',
  },
  incompleteness: {
    id: 'incompleteness',
    name: 'Incompleteness',
    description: 'Cannot be fully defeated, must escape',
    eyeTrackingReady: false,
    speedMod: 0.5,
    hpMod: 999,
    specialEffect: 'unkillable',
    visualOverlay: 'infinite_symbol',
  },
};
