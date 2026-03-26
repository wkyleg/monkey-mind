/**
 * LocalStorage wrapper with versioning and migration
 */

import { CONFIG } from '../config';

export interface SaveData {
  version: number;
  highestSectorCompleted: number;
  highScore: {
    campaign: number;
    endless: number;
  };
  codexUnlocked: string[];
  achievementsUnlocked: string[];
  cosmeticsUnlocked: string[];
  selectedCosmetics: {
    monkeySkin: string;
    bananaType: string;
    trail: string;
  };
  settings: {
    masterVolume: number;
    musicVolume: number;
    sfxVolume: number;
    screenShake: boolean;
    showFps: boolean;
    locale: string;
  };
  stats: {
    totalPlayTime: number;
    totalBananasThrown: number;
    totalEnemiesDefeated: number;
    totalBossesDefeated: number;
    totalDeaths: number;
    runsCompleted: number;
  };
  lastPlayed: number;
}

const CURRENT_VERSION = 1;

const DEFAULT_SAVE: SaveData = {
  version: CURRENT_VERSION,
  highestSectorCompleted: 0,
  highScore: {
    campaign: 0,
    endless: 0,
  },
  codexUnlocked: [],
  achievementsUnlocked: [],
  cosmeticsUnlocked: ['monkey_default', 'banana_default'],
  selectedCosmetics: {
    monkeySkin: 'monkey_default',
    bananaType: 'banana_default',
    trail: 'none',
  },
  settings: {
    masterVolume: CONFIG.MASTER_VOLUME,
    musicVolume: CONFIG.MUSIC_VOLUME,
    sfxVolume: CONFIG.SFX_VOLUME,
    screenShake: true,
    showFps: CONFIG.SHOW_FPS,
    locale: 'en',
  },
  stats: {
    totalPlayTime: 0,
    totalBananasThrown: 0,
    totalEnemiesDefeated: 0,
    totalBossesDefeated: 0,
    totalDeaths: 0,
    runsCompleted: 0,
  },
  lastPlayed: Date.now(),
};

class Storage {
  private data: SaveData;
  private dirty: boolean = false;
  private autoSaveInterval: number | null = null;

  constructor() {
    this.data = this.load();
  }

  /**
   * Load save data from localStorage
   */
  private load(): SaveData {
    try {
      const raw = localStorage.getItem(CONFIG.SAVE_KEY);
      if (!raw) {
        return { ...DEFAULT_SAVE };
      }

      const parsed = JSON.parse(raw) as SaveData;

      // Handle version migration
      if (parsed.version < CURRENT_VERSION) {
        return this.migrate(parsed);
      }

      // Merge with defaults to handle new fields
      return this.mergeWithDefaults(parsed);
    } catch (error) {
      console.error('Failed to load save data:', error);
      return { ...DEFAULT_SAVE };
    }
  }

  /**
   * Migrate old save data to current version
   */
  private migrate(data: SaveData): SaveData {
    const migrated = { ...data };

    // Version migrations would go here
    // Example:
    // if (migrated.version < 2) {
    //   migrated.newField = defaultValue;
    //   migrated.version = 2;
    // }

    migrated.version = CURRENT_VERSION;
    return this.mergeWithDefaults(migrated);
  }

  /**
   * Merge loaded data with defaults to handle new fields
   */
  private mergeWithDefaults(data: Partial<SaveData>): SaveData {
    return {
      ...DEFAULT_SAVE,
      ...data,
      highScore: { ...DEFAULT_SAVE.highScore, ...data.highScore },
      selectedCosmetics: { ...DEFAULT_SAVE.selectedCosmetics, ...data.selectedCosmetics },
      settings: { ...DEFAULT_SAVE.settings, ...data.settings },
      stats: { ...DEFAULT_SAVE.stats, ...data.stats },
    };
  }

  /**
   * Save data to localStorage
   */
  save(): void {
    try {
      this.data.lastPlayed = Date.now();
      localStorage.setItem(CONFIG.SAVE_KEY, JSON.stringify(this.data));
      this.dirty = false;
    } catch (error) {
      console.error('Failed to save data:', error);
    }
  }

  /**
   * Mark data as dirty (needs saving)
   */
  private markDirty(): void {
    this.dirty = true;
  }

  /**
   * Start auto-save interval
   */
  startAutoSave(intervalMs: number = 30000): void {
    this.stopAutoSave();
    this.autoSaveInterval = window.setInterval(() => {
      if (this.dirty) {
        this.save();
      }
    }, intervalMs);
  }

  /**
   * Stop auto-save interval
   */
  stopAutoSave(): void {
    if (this.autoSaveInterval !== null) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
  }

  /**
   * Reset all save data
   */
  reset(): void {
    // Deep copy to avoid mutating DEFAULT_SAVE
    this.data = {
      version: DEFAULT_SAVE.version,
      highestSectorCompleted: DEFAULT_SAVE.highestSectorCompleted,
      highScore: { ...DEFAULT_SAVE.highScore },
      codexUnlocked: [],
      achievementsUnlocked: [],
      cosmeticsUnlocked: [...DEFAULT_SAVE.cosmeticsUnlocked],
      selectedCosmetics: { ...DEFAULT_SAVE.selectedCosmetics },
      settings: { ...DEFAULT_SAVE.settings },
      stats: { ...DEFAULT_SAVE.stats },
      lastPlayed: Date.now(),
    };
    this.save();
  }

  /**
   * Get all save data
   */
  getData(): Readonly<SaveData> {
    return this.data;
  }

  // Convenience getters/setters

  get highestSector(): number {
    return this.data.highestSectorCompleted;
  }

  set highestSector(value: number) {
    if (value > this.data.highestSectorCompleted) {
      this.data.highestSectorCompleted = value;
      this.markDirty();
    }
  }

  getHighScore(mode: 'campaign' | 'endless'): number {
    return this.data.highScore[mode];
  }

  setHighScore(mode: 'campaign' | 'endless', score: number): boolean {
    if (score > this.data.highScore[mode]) {
      this.data.highScore[mode] = score;
      this.markDirty();
      return true;
    }
    return false;
  }

  get settings(): SaveData['settings'] {
    return this.data.settings;
  }

  updateSettings(updates: Partial<SaveData['settings']>): void {
    this.data.settings = { ...this.data.settings, ...updates };
    this.markDirty();
  }

  get stats(): SaveData['stats'] {
    return this.data.stats;
  }

  incrementStat(stat: keyof SaveData['stats'], amount: number = 1): void {
    this.data.stats[stat] += amount;
    this.markDirty();
  }

  // Unlock tracking

  isCodexUnlocked(id: string): boolean {
    return this.data.codexUnlocked.includes(id);
  }

  unlockCodex(id: string): boolean {
    if (!this.isCodexUnlocked(id)) {
      this.data.codexUnlocked.push(id);
      this.markDirty();
      return true;
    }
    return false;
  }

  isAchievementUnlocked(id: string): boolean {
    return this.data.achievementsUnlocked.includes(id);
  }

  unlockAchievement(id: string): boolean {
    if (!this.isAchievementUnlocked(id)) {
      this.data.achievementsUnlocked.push(id);
      this.markDirty();
      return true;
    }
    return false;
  }

  isCosmeticUnlocked(id: string): boolean {
    return this.data.cosmeticsUnlocked.includes(id);
  }

  unlockCosmetic(id: string): boolean {
    if (!this.isCosmeticUnlocked(id)) {
      this.data.cosmeticsUnlocked.push(id);
      this.markDirty();
      return true;
    }
    return false;
  }

  /**
   * Unlock a sector (by number, 1-indexed)
   */
  unlockSector(sectorNum: number): boolean {
    if (sectorNum > this.data.highestSectorCompleted + 1) {
      this.data.highestSectorCompleted = sectorNum - 1;
      this.markDirty();
      return true;
    }
    return false;
  }

  /**
   * Check if sector is unlocked
   */
  isSectorUnlocked(sectorNum: number): boolean {
    return sectorNum <= this.data.highestSectorCompleted + 1;
  }

  /**
   * Unlock a codex entry
   */
  unlockCodexEntry(id: string): boolean {
    return this.unlockCodex(id);
  }

  get selectedCosmetics(): SaveData['selectedCosmetics'] {
    return this.data.selectedCosmetics;
  }

  selectCosmetic(type: keyof SaveData['selectedCosmetics'], id: string): void {
    if (this.isCosmeticUnlocked(id) || id === 'none') {
      this.data.selectedCosmetics[type] = id;
      this.markDirty();
    }
  }
}

// Global storage instance
export const storage = new Storage();
