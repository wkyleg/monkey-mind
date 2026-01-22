/**
 * Content loading and management
 */

import type {
  ContentIndex,
  GameContent,
  SectorData,
  EnemyData,
  EnemyPackData,
  BossData,
  PowerupData,
  WaveData,
  CodexEntry,
  StringsData,
} from './schema';

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
  };
  
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
    
    defaultEnemies.forEach(e => this.content.enemies.set(e.id, e));
    
    // Default waves
    const defaultWaves: WaveData[] = [
      { id: 'wave_basic_1', pattern: 'line', enemy: 'synapse_drone', count: 5, entryDelayMs: 300 },
      { id: 'wave_basic_2', pattern: 'line', enemy: 'synapse_drone', count: 7, entryDelayMs: 250 },
      { id: 'wave_basic_3', pattern: 'grid', enemy: 'neuron_cluster', rows: 2, cols: 4, entryDelayMs: 200 },
      { id: 'wave_glitch_1', pattern: 'line', enemy: 'glitch_sprite', count: 4, entryDelayMs: 400 },
      { id: 'wave_mixed_1', pattern: 'mixed', enemy: 'synapse_drone', count: 10, entryDelayMs: 350 },
    ];
    
    defaultWaves.forEach(w => this.content.waves.set(w.id, w));
    
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
          attacks: [
            { type: 'spread', cooldown: 2000, damage: 1, params: { count: 3 } },
          ],
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
    
    defaultPowerups.forEach(p => this.content.powerups.set(p.id, p));
    
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
  
  isLoaded(): boolean {
    return this.loaded;
  }
}

// Global content loader instance
export const contentLoader = new ContentLoader();
