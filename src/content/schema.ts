/**
 * Content schema types for data-driven game content
 */

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
}

export interface LevelData {
  id: string;
  waves: string[];
  miniboss?: string;
  duration?: number;
}

// Enemy schema
export interface EnemyData {
  id: string;
  name: string;
  tier: 1 | 2 | 3 | 4;
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
}

export interface EnemyPackData {
  id: string;
  name: string;
  enemies: EnemyData[];
}

// Wave schema
export interface WaveEnemyGroup {
  type: string;          // enemy ID
  count?: number;
  behavior?: string;     // override default behavior
  spawnDelayMs?: number; // delay between spawns in this group
}

export interface WaveData {
  id: string;
  pattern: string;
  enemy: string;         // Legacy: single enemy type
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
    boss?: string;  // For boss-specific achievements
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
}
