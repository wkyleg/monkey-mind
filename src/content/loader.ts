/**
 * Content loading and management
 */

import type {
  ActData,
  BossData,
  CodexEntry,
  ContentIndex,
  EnemyData,
  EnemyPackData,
  ExpansionCategory,
  GameContent,
  LevelDataV2,
  MetaMeters,
  PowerupData,
  SectorData,
  StringsData,
  WaveData,
} from './schema';

// Enemy dialogue data structure
export interface EnemyDialogue {
  spawn: string[];
  death: string[];
}

class ContentLoader {
  private content: GameContent = {
    sectors: new Map(),
    enemies: new Map(),
    bosses: new Map(),
    powerups: new Map(),
    waves: new Map(),
    codex: new Map(),
    achievements: new Map(),
    cosmetics: new Map(),
    strings: {
      ui: {},
      codex: {},
      achievements: {},
      enemies: {},
      bosses: {},
      powerups: {},
    },
    // Level Bible v2 additions
    acts: new Map(),
    expansionCategories: new Map(),
    levelsV2: new Map(),
    metaMeters: { noise: 0, focus: 0, stillness: 0 },
  };

  // Enemy-specific dialogue loaded from act folders
  private enemyDialogue: Map<string, EnemyDialogue> = new Map();

  private loaded: boolean = false;

  /**
   * Load all content from JSON files
   */
  async loadAll(): Promise<void> {
    if (this.loaded) return;

    try {
      // Load content index
      const indexResponse = await fetch('/content/index.json');
      if (!indexResponse.ok) {
        console.warn('Content index not found, using defaults');
        this.loadDefaults();
        this.loaded = true;
        return;
      }

      const index: ContentIndex = await indexResponse.json();

      // Load all content in parallel
      await Promise.all([
        this.loadSectors(index.sectors),
        this.loadEnemyPacks(index.enemyPacks),
        this.loadBosses(index.bosses),
        this.loadPowerups(index.powerups),
        this.loadWaves(index.waves || []),
        this.loadStrings(index.strings),
        // Level Bible v2 additions
        this.loadActs(index.acts || []),
        this.loadExpansionCategories(index.expansionCategories || []),
      ]);

      this.loaded = true;
    } catch (error) {
      console.error('Failed to load content:', error);
      this.loadDefaults();
      this.loaded = true;
    }
  }

  /**
   * Load default content (fallback)
   */
  private loadDefaults(): void {
    // Default sector
    this.content.sectors.set('sector1_neural_cage', {
      id: 'sector1_neural_cage',
      name: 'The Neural Cage',
      description: 'Escape the sterile confines of the lab.',
      theme: {
        bg: 'clinical_grid',
        palette: ['#1a1a2e', '#16213e', '#0f3460'],
        pattern: 'grid',
      },
      lanes: 5,
      levels: [
        { id: '1-1', waves: ['wave_basic_1', 'wave_basic_2'] },
        { id: '1-2', waves: ['wave_basic_3', 'wave_zigzag_1'] },
        { id: '1-3', waves: ['wave_mixed_1'] },
      ],
      boss: 'cortex_auditor',
      unlocks: {
        codex: ['entry_neural_cage'],
        powerups: ['calm_shield'],
      },
    });

    // Default enemies
    const defaultEnemies: EnemyData[] = [
      {
        id: 'synapse_drone',
        name: 'Synapse Drone',
        tier: 1,
        hp: 1,
        speed: 1,
        behavior: 'straight_descend',
        scoreValue: 10,
        dropTable: 'common',
        visual: { type: 'circle', color: '#00ffaa', size: 20, glow: true },
      },
      {
        id: 'neuron_cluster',
        name: 'Neuron Cluster',
        tier: 1,
        hp: 2,
        speed: 0.8,
        behavior: 'straight_descend',
        scoreValue: 20,
        dropTable: 'common',
        visual: { type: 'circle', color: '#00aaff', size: 25, glow: true },
      },
      {
        id: 'glitch_sprite',
        name: 'Glitch Sprite',
        tier: 2,
        hp: 2,
        speed: 1.2,
        behavior: 'zigzag',
        scoreValue: 30,
        dropTable: 'uncommon',
        visual: { type: 'circle', color: '#ff00aa', size: 22, glow: true },
      },
      {
        id: 'orbital_eye',
        name: 'Orbital Eye',
        tier: 2,
        hp: 3,
        speed: 0.7,
        behavior: 'orbit',
        scoreValue: 40,
        dropTable: 'uncommon',
        visual: { type: 'circle', color: '#ffaa00', size: 18, glow: true },
      },
    ];

    defaultEnemies.forEach((e) => this.content.enemies.set(e.id, e));

    // Default waves
    const defaultWaves: WaveData[] = [
      { id: 'wave_basic_1', pattern: 'line', enemy: 'synapse_drone', count: 5, entryDelayMs: 300 },
      { id: 'wave_basic_2', pattern: 'line', enemy: 'synapse_drone', count: 7, entryDelayMs: 250 },
      { id: 'wave_basic_3', pattern: 'grid', enemy: 'neuron_cluster', rows: 2, cols: 4, entryDelayMs: 200 },
      { id: 'wave_glitch_1', pattern: 'line', enemy: 'glitch_sprite', count: 4, entryDelayMs: 400 },
      { id: 'wave_mixed_1', pattern: 'mixed', enemy: 'synapse_drone', count: 10, entryDelayMs: 350 },
    ];

    defaultWaves.forEach((w) => this.content.waves.set(w.id, w));

    // Default boss
    this.content.bosses.set('cortex_auditor', {
      id: 'cortex_auditor',
      name: 'Cortex Auditor',
      title: 'The Mind Inspector',
      hp: 50,
      phases: [
        {
          hpThreshold: 1,
          pattern: 'sweep',
          speedMod: 1,
          attacks: [{ type: 'spread', cooldown: 2000, damage: 1, params: { count: 3 } }],
        },
        {
          hpThreshold: 0.5,
          pattern: 'chase',
          speedMod: 1.5,
          attacks: [
            { type: 'spread', cooldown: 1500, damage: 1, params: { count: 5 } },
            { type: 'laser', cooldown: 4000, damage: 2, params: {} },
          ],
        },
      ],
      visual: { type: 'custom', color: '#e94560', size: 80, glow: true },
      codexEntry: 'The Cortex Auditor inspects all neural traffic for unauthorized thoughts.',
      defeatUnlocks: ['sector2_synaptic_reef'],
    });

    // Default powerups
    const defaultPowerups: PowerupData[] = [
      {
        id: 'calm_shield',
        name: 'Calm Shield',
        category: 'calm',
        durationMs: 6000,
        effect: 'shield',
        uiName: 'SHIELD',
        description: 'Hold steady; let the mind settle.',
        visual: { color: '#00aaff', icon: 'shield' },
      },
      {
        id: 'passion_fury',
        name: 'Passion Fury',
        category: 'passion',
        durationMs: 5000,
        effect: 'rapid_fire',
        uiName: 'FURY',
        description: 'Unleash your primal rage.',
        visual: { color: '#ff0066', icon: 'flame' },
      },
    ];

    defaultPowerups.forEach((p) => this.content.powerups.set(p.id, p));

    // Default strings
    this.content.strings = {
      ui: {
        title: 'MONKEY MIND',
        subtitle: 'INNER INVADERS',
        play: 'PLAY',
        campaign: 'CAMPAIGN',
        endless: 'ENDLESS',
        settings: 'SETTINGS',
        codex: 'CODEX',
        pause: 'PAUSED',
        resume: 'RESUME',
        quit: 'QUIT',
        game_over: 'NEURAL LINK SEVERED',
        score: 'SCORE',
        high_score: 'HIGH SCORE',
        new_high_score: 'NEW HIGH SCORE!',
      },
      codex: {},
      achievements: {},
      enemies: {},
      bosses: {},
      powerups: {},
    };
  }

  private async loadSectors(paths: string[]): Promise<void> {
    for (const path of paths) {
      try {
        const response = await fetch(`/content/${path}`);
        const data: SectorData = await response.json();
        this.content.sectors.set(data.id, data);

        // Extract wave references
        for (const level of data.levels) {
          for (const waveId of level.waves) {
            if (!this.content.waves.has(waveId)) {
              // Wave will be loaded from enemy packs
            }
          }
        }
      } catch (error) {
        console.warn(`Failed to load sector: ${path}`, error);
      }
    }
  }

  private async loadEnemyPacks(paths: string[]): Promise<void> {
    for (const path of paths) {
      try {
        const response = await fetch(`/content/${path}`);
        const data: EnemyPackData = await response.json();

        for (const enemy of data.enemies) {
          this.content.enemies.set(enemy.id, enemy);
        }
      } catch (error) {
        console.warn(`Failed to load enemy pack: ${path}`, error);
      }
    }
  }

  private async loadBosses(paths: string[]): Promise<void> {
    for (const path of paths) {
      try {
        const response = await fetch(`/content/${path}`);
        const data: BossData = await response.json();
        this.content.bosses.set(data.id, data);
      } catch (error) {
        console.warn(`Failed to load boss: ${path}`, error);
      }
    }
  }

  private async loadPowerups(paths: string[]): Promise<void> {
    for (const path of paths) {
      try {
        const response = await fetch(`/content/${path}`);
        const data: { powerups: PowerupData[] } = await response.json();

        for (const powerup of data.powerups) {
          this.content.powerups.set(powerup.id, powerup);
        }
      } catch (error) {
        console.warn(`Failed to load powerups: ${path}`, error);
      }
    }
  }

  private async loadWaves(paths: string[]): Promise<void> {
    for (const path of paths) {
      try {
        const response = await fetch(`/content/${path}`);
        const data: { sectorId: string; waves: Record<string, WaveData> } = await response.json();

        // Add each wave to the content store
        for (const [waveId, waveData] of Object.entries(data.waves)) {
          // Ensure the wave has an id
          waveData.id = waveId;
          this.content.waves.set(waveId, waveData);
        }
      } catch (error) {
        console.warn(`Failed to load waves: ${path}`, error);
      }
    }
  }

  private async loadStrings(paths: string[]): Promise<void> {
    for (const path of paths) {
      try {
        const response = await fetch(`/content/${path}`);
        const data: Partial<StringsData> = await response.json();

        // Merge strings
        if (data.ui) Object.assign(this.content.strings.ui, data.ui);
        if (data.codex) Object.assign(this.content.strings.codex, data.codex);
        if (data.achievements) Object.assign(this.content.strings.achievements, data.achievements);
        if (data.enemies) Object.assign(this.content.strings.enemies, data.enemies);
        if (data.bosses) Object.assign(this.content.strings.bosses, data.bosses);
        if (data.powerups) Object.assign(this.content.strings.powerups, data.powerups);
      } catch (error) {
        console.warn(`Failed to load strings: ${path}`, error);
      }
    }
  }

  /**
   * Load Acts (Level Bible v2)
   * Acts reference level IDs which need to be loaded from separate files
   */
  private async loadActs(paths: string[]): Promise<void> {
    for (const actPath of paths) {
      try {
        const response = await fetch(`/content/${actPath}`);
        const actData = await response.json();

        // Get the directory path for loading level files
        const actDir = actPath.substring(0, actPath.lastIndexOf('/'));

        // Try to load enemy dialogue for this act
        await this.loadEnemyDialogueForAct(actDir);

        // Load individual level files
        const loadedLevels: LevelDataV2[] = [];

        // Check if levels is an array of strings (IDs/paths) or objects
        if (actData.levels && actData.levels.length > 0) {
          if (typeof actData.levels[0] === 'string') {
            // Levels are IDs or paths - load from separate files
            for (let i = 0; i < actData.levels.length; i++) {
              const levelEntry = actData.levels[i] as string;
              let levelPath: string;

              // Check if this is already a full path (contains '/' or ends with '.json')
              if (levelEntry.includes('/') || levelEntry.endsWith('.json')) {
                // Full path - use directly (prepend /content/ if not absolute)
                levelPath = levelEntry.startsWith('/') ? levelEntry : `/content/${levelEntry}`;
              } else {
                // Short ID format like "act1_level1_zoo_escape"
                // Extract the level name after the "levelN_" part
                // e.g., "act1_level1_zoo_escape" -> "zoo_escape"
                const parts = levelEntry.split('_');
                // Find index of "levelN" part
                const levelPartIndex = parts.findIndex((p) => p.startsWith('level'));
                let levelName: string;
                if (levelPartIndex >= 0 && levelPartIndex < parts.length - 1) {
                  levelName = parts.slice(levelPartIndex + 1).join('_');
                } else {
                  // Fallback: use parts after index 2
                  levelName = parts.slice(2).join('_');
                }
                const levelNum = String(i + 1).padStart(2, '0');
                levelPath = `/content/${actDir}/level_${levelNum}_${levelName}.json`;
              }

              try {
                const levelResponse = await fetch(levelPath);
                if (levelResponse.ok) {
                  const levelData: LevelDataV2 = await levelResponse.json();
                  loadedLevels.push(levelData);
                  this.content.levelsV2.set(levelData.id, levelData);
                } else {
                  console.warn(`Failed to load level (${levelResponse.status}): ${levelPath}`);
                }
              } catch (levelError) {
                console.warn(`Failed to load level: ${levelPath}`, levelError);
              }
            }
          } else {
            // Levels are already full objects
            for (const level of actData.levels as LevelDataV2[]) {
              loadedLevels.push(level);
              this.content.levelsV2.set(level.id, level);
            }
          }
        }

        // Store the act with loaded levels
        const fullActData: ActData = {
          ...actData,
          levels: loadedLevels,
        };
        this.content.acts.set(fullActData.id, fullActData);
      } catch (error) {
        console.warn(`Failed to load act: ${actPath}`, error);
      }
    }
  }

  /**
   * Load enemy dialogue for a specific act
   */
  private async loadEnemyDialogueForAct(actDir: string): Promise<void> {
    try {
      const dialoguePath = `/content/${actDir}/enemies.json`;
      const response = await fetch(dialoguePath);

      if (!response.ok) {
        // No enemies.json for this act - that's okay
        return;
      }

      const dialogueData: Record<string, EnemyDialogue> = await response.json();

      // Add each enemy's dialogue to the map
      for (const [enemyId, dialogue] of Object.entries(dialogueData)) {
        this.enemyDialogue.set(enemyId, dialogue);
      }
    } catch (_error) {
      // Silently ignore - enemy dialogue is optional
    }
  }

  /**
   * Load Expansion Categories (Level Bible v2)
   * Expansion categories reference level IDs or file paths which need to be loaded
   */
  private async loadExpansionCategories(paths: string[]): Promise<void> {
    for (const expPath of paths) {
      try {
        const response = await fetch(`/content/${expPath}`);
        const expData = await response.json();

        // Get the directory path for loading level files
        const expDir = expPath.substring(0, expPath.lastIndexOf('/'));

        // Load individual level files
        const loadedLevels: LevelDataV2[] = [];

        // Check if levels is an array of strings (IDs/paths) or objects
        if (expData.levels && expData.levels.length > 0) {
          if (typeof expData.levels[0] === 'string') {
            // Levels are IDs or paths - load from separate files
            for (let i = 0; i < expData.levels.length; i++) {
              const levelEntry = expData.levels[i] as string;
              let levelPath: string;

              // Check if this is already a full path (contains '/' or ends with '.json')
              if (levelEntry.includes('/') || levelEntry.endsWith('.json')) {
                // Full path - use directly (prepend /content/ if needed)
                // Handle paths like "expansions/literature/level_01_plato_allegory.json"
                levelPath = levelEntry.startsWith('/') ? levelEntry : `/content/${levelEntry}`;
              } else {
                // Short ID format - reconstruct path
                const parts = levelEntry.split('_');
                const levelNum = String(i + 1).padStart(2, '0');
                const levelName = parts.slice(2).join('_');
                levelPath = `/content/${expDir}/level_${levelNum}_${levelName}.json`;
              }

              try {
                const levelResponse = await fetch(levelPath);
                if (levelResponse.ok) {
                  const levelData: LevelDataV2 = await levelResponse.json();
                  loadedLevels.push(levelData);
                  this.content.levelsV2.set(levelData.id, levelData);
                } else {
                  console.warn(`Failed to load expansion level (${levelResponse.status}): ${levelPath}`);
                }
              } catch (levelError) {
                console.warn(`Failed to load expansion level: ${levelPath}`, levelError);
              }
            }
          } else {
            // Levels are already full objects
            for (const level of expData.levels as LevelDataV2[]) {
              loadedLevels.push(level);
              this.content.levelsV2.set(level.id, level);
            }
          }
        }

        // Store the expansion with loaded levels
        const fullExpData: ExpansionCategory = {
          ...expData,
          levels: loadedLevels,
        };
        this.content.expansionCategories.set(fullExpData.id, fullExpData);
      } catch (error) {
        console.warn(`Failed to load expansion category: ${expPath}`, error);
      }
    }
  }

  // Accessors

  getSector(id: string): SectorData | undefined {
    return this.content.sectors.get(id);
  }

  getAllSectors(): SectorData[] {
    return Array.from(this.content.sectors.values());
  }

  getEnemy(id: string): EnemyData | undefined {
    return this.content.enemies.get(id);
  }

  getAllEnemies(): EnemyData[] {
    return Array.from(this.content.enemies.values());
  }

  getBoss(id: string): BossData | undefined {
    return this.content.bosses.get(id);
  }

  getAllBosses(): BossData[] {
    return Array.from(this.content.bosses.values());
  }

  getPowerup(id: string): PowerupData | undefined {
    return this.content.powerups.get(id);
  }

  getWave(id: string): WaveData | undefined {
    return this.content.waves.get(id);
  }

  getCodexEntry(id: string): CodexEntry | undefined {
    return this.content.codex.get(id);
  }

  getString(key: string): string {
    return this.content.strings.ui[key] ?? key;
  }

  /**
   * Get enemy-specific dialogue for spawn/death text
   * Returns null if no specific dialogue exists for this enemy
   */
  getEnemyDialogue(enemyId: string): EnemyDialogue | null {
    return this.enemyDialogue.get(enemyId) ?? null;
  }

  /**
   * Check if enemy has specific dialogue
   */
  hasEnemyDialogue(enemyId: string): boolean {
    return this.enemyDialogue.has(enemyId);
  }

  /**
   * Register level-specific enemy dialogue from levelEnemies config
   * Call this when loading a new level to add its unique dialogue
   */
  registerLevelEnemyDialogue(
    levelEnemies: Record<string, { visualId: string; dialogue?: { spawn: string[]; death: string[] } }> | undefined,
  ): void {
    if (!levelEnemies) return;

    for (const [enemyId, config] of Object.entries(levelEnemies)) {
      if (config.dialogue) {
        // Register dialogue using the enemy ID as key
        this.enemyDialogue.set(enemyId, {
          spawn: config.dialogue.spawn,
          death: config.dialogue.death,
        });
      }
    }
  }

  /**
   * Clear level-specific dialogue (call when leaving a level)
   * Pass the enemy IDs to clear
   */
  clearLevelEnemyDialogue(enemyIds: string[]): void {
    for (const id of enemyIds) {
      // Only clear if it's not an act-level dialogue (those should persist)
      // Level-specific IDs typically have level prefix
      this.enemyDialogue.delete(id);
    }
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  // Level Bible v2 Accessors

  /**
   * Get an Act by ID
   */
  getAct(id: string): ActData | undefined {
    return this.content.acts.get(id);
  }

  /**
   * Get all Acts
   */
  getAllActs(): ActData[] {
    return Array.from(this.content.acts.values());
  }

  /**
   * Get a Level (v2) by ID
   */
  getLevelV2(id: string): LevelDataV2 | undefined {
    return this.content.levelsV2.get(id);
  }

  /**
   * Get all Levels (v2)
   */
  getAllLevelsV2(): LevelDataV2[] {
    return Array.from(this.content.levelsV2.values());
  }

  /**
   * Get an Expansion Category by ID
   */
  getExpansionCategory(id: string): ExpansionCategory | undefined {
    return this.content.expansionCategories.get(id);
  }

  /**
   * Get all Expansion Categories
   */
  getAllExpansionCategories(): ExpansionCategory[] {
    return Array.from(this.content.expansionCategories.values());
  }

  /**
   * Get current meta meters
   */
  getMetaMeters(): MetaMeters {
    return { ...this.content.metaMeters };
  }

  /**
   * Update meta meters
   */
  updateMetaMeters(delta: Partial<MetaMeters>): void {
    if (delta.noise !== undefined) {
      this.content.metaMeters.noise = Math.max(0, Math.min(100, this.content.metaMeters.noise + delta.noise));
    }
    if (delta.focus !== undefined) {
      this.content.metaMeters.focus = Math.max(0, Math.min(100, this.content.metaMeters.focus + delta.focus));
    }
    if (delta.stillness !== undefined) {
      this.content.metaMeters.stillness = Math.max(
        0,
        Math.min(100, this.content.metaMeters.stillness + delta.stillness),
      );
    }
  }

  /**
   * Reset meta meters to default
   */
  resetMetaMeters(): void {
    this.content.metaMeters = { noise: 0, focus: 0, stillness: 0 };
  }
}

// Global content loader instance
export const contentLoader = new ContentLoader();
