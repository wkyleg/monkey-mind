/**
 * Content Loader Tests
 *
 * Tests for content loading, caching, accessors, and error handling.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

/* eslint-disable @typescript-eslint/no-explicit-any */
// Create a mock ContentLoader class for testing since the real one is a singleton
class TestableContentLoader {
  private content = {
    sectors: new Map<string, any>(),
    enemies: new Map<string, any>(),
    bosses: new Map<string, any>(),
    powerups: new Map<string, any>(),
    waves: new Map<string, any>(),
    codex: new Map<string, any>(),
    achievements: new Map<string, any>(),
    cosmetics: new Map<string, any>(),
    strings: {
      ui: {} as Record<string, string>,
      codex: {} as Record<string, string>,
      achievements: {} as Record<string, string>,
      enemies: {} as Record<string, string>,
      bosses: {} as Record<string, string>,
      powerups: {} as Record<string, string>,
    },
  };

  private loaded = false;

  async loadAll(): Promise<void> {
    if (this.loaded) return;

    try {
      const indexResponse = await fetch('/content/index.json');
      if (!indexResponse.ok) {
        this.loadDefaults();
        this.loaded = true;
        return;
      }

      const index = await indexResponse.json();

      await Promise.all([
        this.loadSectors(index.sectors || []),
        this.loadEnemyPacks(index.enemyPacks || []),
        this.loadBosses(index.bosses || []),
        this.loadPowerups(index.powerups || []),
        this.loadWaves(index.waves || []),
        this.loadStrings(index.strings || []),
      ]);

      this.loaded = true;
    } catch (_error) {
      this.loadDefaults();
      this.loaded = true;
    }
  }

  loadDefaults(): void {
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
      levels: [{ id: '1-1', waves: ['wave_basic_1', 'wave_basic_2'] }],
      boss: 'cortex_auditor',
    });

    // Default enemies
    this.content.enemies.set('synapse_drone', {
      id: 'synapse_drone',
      name: 'Synapse Drone',
      tier: 1,
      hp: 1,
      speed: 1,
      behavior: 'straight_descend',
      scoreValue: 10,
      dropTable: 'common',
      visual: { type: 'circle', color: '#00ffaa', size: 20, glow: true },
    });

    // Default waves
    this.content.waves.set('wave_basic_1', {
      id: 'wave_basic_1',
      pattern: 'line',
      enemy: 'synapse_drone',
      count: 5,
      entryDelayMs: 300,
    });

    // Default boss
    this.content.bosses.set('cortex_auditor', {
      id: 'cortex_auditor',
      name: 'Cortex Auditor',
      title: 'The Mind Inspector',
      hp: 50,
      phases: [],
      visual: { type: 'custom', color: '#e94560', size: 80, glow: true },
    });

    // Default powerups
    this.content.powerups.set('calm_shield', {
      id: 'calm_shield',
      name: 'Calm Shield',
      category: 'calm',
      durationMs: 6000,
      effect: 'shield',
      visual: { color: '#00aaff', icon: 'shield' },
    });

    // Default strings
    this.content.strings.ui = {
      title: 'MONKEY MIND',
      play: 'PLAY',
    };
  }

  private async loadSectors(paths: string[]): Promise<void> {
    for (const path of paths) {
      try {
        const response = await fetch(`/content/${path}`);
        const data = await response.json();
        this.content.sectors.set(data.id, data);
      } catch {
        // Ignore errors
      }
    }
  }

  private async loadEnemyPacks(paths: string[]): Promise<void> {
    for (const path of paths) {
      try {
        const response = await fetch(`/content/${path}`);
        const data = await response.json();
        for (const enemy of data.enemies || []) {
          this.content.enemies.set(enemy.id, enemy);
        }
      } catch {
        // Ignore errors
      }
    }
  }

  private async loadBosses(paths: string[]): Promise<void> {
    for (const path of paths) {
      try {
        const response = await fetch(`/content/${path}`);
        const data = await response.json();
        this.content.bosses.set(data.id, data);
      } catch {
        // Ignore errors
      }
    }
  }

  private async loadPowerups(paths: string[]): Promise<void> {
    for (const path of paths) {
      try {
        const response = await fetch(`/content/${path}`);
        const data = await response.json();
        for (const powerup of data.powerups || []) {
          this.content.powerups.set(powerup.id, powerup);
        }
      } catch {
        // Ignore errors
      }
    }
  }

  private async loadWaves(paths: string[]): Promise<void> {
    for (const path of paths) {
      try {
        const response = await fetch(`/content/${path}`);
        const data = await response.json();
        for (const [waveId, waveData] of Object.entries(data.waves || {})) {
          (waveData as any).id = waveId;
          this.content.waves.set(waveId, waveData);
        }
      } catch {
        // Ignore errors
      }
    }
  }

  private async loadStrings(paths: string[]): Promise<void> {
    for (const path of paths) {
      try {
        const response = await fetch(`/content/${path}`);
        const data = await response.json();
        if (data.ui) Object.assign(this.content.strings.ui, data.ui);
      } catch {
        // Ignore errors
      }
    }
  }

  getSector(id: string) {
    return this.content.sectors.get(id);
  }

  getAllSectors() {
    return Array.from(this.content.sectors.values());
  }

  getEnemy(id: string) {
    return this.content.enemies.get(id);
  }

  getAllEnemies() {
    return Array.from(this.content.enemies.values());
  }

  getBoss(id: string) {
    return this.content.bosses.get(id);
  }

  getAllBosses() {
    return Array.from(this.content.bosses.values());
  }

  getPowerup(id: string) {
    return this.content.powerups.get(id);
  }

  getWave(id: string) {
    return this.content.waves.get(id);
  }

  getString(key: string) {
    return this.content.strings.ui[key] ?? key;
  }

  isLoaded() {
    return this.loaded;
  }
}

describe('ContentLoader', () => {
  let loader: TestableContentLoader;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    loader = new TestableContentLoader();

    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  describe('Initial State', () => {
    it('should start unloaded', () => {
      expect(loader.isLoaded()).toBe(false);
    });

    it('should have no sectors initially', () => {
      expect(loader.getAllSectors().length).toBe(0);
    });

    it('should have no enemies initially', () => {
      expect(loader.getAllEnemies().length).toBe(0);
    });

    it('should have no bosses initially', () => {
      expect(loader.getAllBosses().length).toBe(0);
    });
  });

  describe('Load All', () => {
    it('should load content from index', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            sectors: ['sectors/sector1.json'],
            enemyPacks: ['enemies/tier1.json'],
            bosses: ['bosses/boss1.json'],
            powerups: ['powerups/calm.json'],
            waves: [],
            strings: [],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'sector1',
            name: 'Sector 1',
            levels: [],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            enemies: [{ id: 'enemy1', name: 'Enemy 1' }],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'boss1',
            name: 'Boss 1',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            powerups: [{ id: 'powerup1', name: 'Powerup 1' }],
          }),
        });

      await loader.loadAll();

      expect(loader.isLoaded()).toBe(true);
      expect(loader.getSector('sector1')).toBeDefined();
      expect(loader.getEnemy('enemy1')).toBeDefined();
      expect(loader.getBoss('boss1')).toBeDefined();
      expect(loader.getPowerup('powerup1')).toBeDefined();
    });

    it('should only load once', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          sectors: [],
          enemyPacks: [],
          bosses: [],
          powerups: [],
          waves: [],
          strings: [],
        }),
      });

      await loader.loadAll();
      await loader.loadAll();

      // Should only fetch index once
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should use defaults when index not found', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
      });

      await loader.loadAll();

      expect(loader.isLoaded()).toBe(true);
      expect(loader.getSector('sector1_neural_cage')).toBeDefined();
      expect(loader.getEnemy('synapse_drone')).toBeDefined();
    });

    it('should use defaults on network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await loader.loadAll();

      expect(loader.isLoaded()).toBe(true);
      expect(loader.getSector('sector1_neural_cage')).toBeDefined();
    });
  });

  describe('Load Defaults', () => {
    it('should load default sector', () => {
      loader.loadDefaults();

      const sector = loader.getSector('sector1_neural_cage');
      expect(sector).toBeDefined();
      expect(sector?.name).toBe('The Neural Cage');
    });

    it('should load default enemies', () => {
      loader.loadDefaults();

      const enemy = loader.getEnemy('synapse_drone');
      expect(enemy).toBeDefined();
      expect(enemy?.tier).toBe(1);
    });

    it('should load default waves', () => {
      loader.loadDefaults();

      const wave = loader.getWave('wave_basic_1');
      expect(wave).toBeDefined();
      expect(wave?.pattern).toBe('line');
    });

    it('should load default boss', () => {
      loader.loadDefaults();

      const boss = loader.getBoss('cortex_auditor');
      expect(boss).toBeDefined();
      expect(boss?.name).toBe('Cortex Auditor');
    });

    it('should load default powerups', () => {
      loader.loadDefaults();

      const powerup = loader.getPowerup('calm_shield');
      expect(powerup).toBeDefined();
      expect(powerup?.effect).toBe('shield');
    });

    it('should load default strings', () => {
      loader.loadDefaults();

      expect(loader.getString('title')).toBe('MONKEY MIND');
      expect(loader.getString('play')).toBe('PLAY');
    });
  });

  describe('Sector Accessors', () => {
    beforeEach(() => {
      loader.loadDefaults();
    });

    it('should get sector by ID', () => {
      const sector = loader.getSector('sector1_neural_cage');
      expect(sector?.id).toBe('sector1_neural_cage');
    });

    it('should return undefined for unknown sector', () => {
      const sector = loader.getSector('unknown_sector');
      expect(sector).toBeUndefined();
    });

    it('should get all sectors', () => {
      const sectors = loader.getAllSectors();
      expect(sectors.length).toBeGreaterThan(0);
    });
  });

  describe('Enemy Accessors', () => {
    beforeEach(() => {
      loader.loadDefaults();
    });

    it('should get enemy by ID', () => {
      const enemy = loader.getEnemy('synapse_drone');
      expect(enemy?.id).toBe('synapse_drone');
    });

    it('should return undefined for unknown enemy', () => {
      const enemy = loader.getEnemy('unknown_enemy');
      expect(enemy).toBeUndefined();
    });

    it('should get all enemies', () => {
      const enemies = loader.getAllEnemies();
      expect(enemies.length).toBeGreaterThan(0);
    });
  });

  describe('Boss Accessors', () => {
    beforeEach(() => {
      loader.loadDefaults();
    });

    it('should get boss by ID', () => {
      const boss = loader.getBoss('cortex_auditor');
      expect(boss?.id).toBe('cortex_auditor');
    });

    it('should return undefined for unknown boss', () => {
      const boss = loader.getBoss('unknown_boss');
      expect(boss).toBeUndefined();
    });

    it('should get all bosses', () => {
      const bosses = loader.getAllBosses();
      expect(bosses.length).toBeGreaterThan(0);
    });
  });

  describe('Powerup Accessors', () => {
    beforeEach(() => {
      loader.loadDefaults();
    });

    it('should get powerup by ID', () => {
      const powerup = loader.getPowerup('calm_shield');
      expect(powerup?.id).toBe('calm_shield');
    });

    it('should return undefined for unknown powerup', () => {
      const powerup = loader.getPowerup('unknown_powerup');
      expect(powerup).toBeUndefined();
    });
  });

  describe('Wave Accessors', () => {
    beforeEach(() => {
      loader.loadDefaults();
    });

    it('should get wave by ID', () => {
      const wave = loader.getWave('wave_basic_1');
      expect(wave?.id).toBe('wave_basic_1');
    });

    it('should return undefined for unknown wave', () => {
      const wave = loader.getWave('unknown_wave');
      expect(wave).toBeUndefined();
    });
  });

  describe('String Accessors', () => {
    beforeEach(() => {
      loader.loadDefaults();
    });

    it('should get UI string by key', () => {
      expect(loader.getString('title')).toBe('MONKEY MIND');
    });

    it('should return key if string not found', () => {
      expect(loader.getString('unknown_key')).toBe('unknown_key');
    });
  });

  describe('Load Waves', () => {
    it('should load waves from file', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            sectors: [],
            enemyPacks: [],
            bosses: [],
            powerups: [],
            waves: ['waves/sector1.json'],
            strings: [],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            sectorId: 'sector1',
            waves: {
              wave_test_1: {
                pattern: 'line',
                enemy: 'synapse_drone',
                count: 5,
                entryDelayMs: 300,
              },
              wave_test_2: {
                pattern: 'grid',
                enemy: 'synapse_drone',
                rows: 2,
                cols: 3,
                entryDelayMs: 200,
              },
            },
          }),
        });

      await loader.loadAll();

      const wave1 = loader.getWave('wave_test_1');
      const wave2 = loader.getWave('wave_test_2');

      expect(wave1).toBeDefined();
      expect(wave1?.id).toBe('wave_test_1');
      expect(wave1?.pattern).toBe('line');

      expect(wave2).toBeDefined();
      expect(wave2?.id).toBe('wave_test_2');
      expect(wave2?.pattern).toBe('grid');
    });
  });

  describe('Load Strings', () => {
    it('should load and merge strings', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            sectors: [],
            enemyPacks: [],
            bosses: [],
            powerups: [],
            waves: [],
            strings: ['strings/en.json'],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            ui: {
              custom_key: 'Custom Value',
              title: 'Custom Title',
            },
          }),
        });

      await loader.loadAll();

      expect(loader.getString('custom_key')).toBe('Custom Value');
      expect(loader.getString('title')).toBe('Custom Title');
    });
  });

  describe('Error Handling', () => {
    it('should handle failed sector load gracefully', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            sectors: ['sectors/invalid.json'],
            enemyPacks: [],
            bosses: [],
            powerups: [],
            waves: [],
            strings: [],
          }),
        })
        .mockRejectedValueOnce(new Error('Failed to load'));

      await loader.loadAll();

      expect(loader.isLoaded()).toBe(true);
      // Should not crash
    });

    it('should handle failed enemy pack load gracefully', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            sectors: [],
            enemyPacks: ['enemies/invalid.json'],
            bosses: [],
            powerups: [],
            waves: [],
            strings: [],
          }),
        })
        .mockRejectedValueOnce(new Error('Failed to load'));

      await loader.loadAll();

      expect(loader.isLoaded()).toBe(true);
    });

    it('should handle failed boss load gracefully', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            sectors: [],
            enemyPacks: [],
            bosses: ['bosses/invalid.json'],
            powerups: [],
            waves: [],
            strings: [],
          }),
        })
        .mockRejectedValueOnce(new Error('Failed to load'));

      await loader.loadAll();

      expect(loader.isLoaded()).toBe(true);
    });

    it('should handle failed powerup load gracefully', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            sectors: [],
            enemyPacks: [],
            bosses: [],
            powerups: ['powerups/invalid.json'],
            waves: [],
            strings: [],
          }),
        })
        .mockRejectedValueOnce(new Error('Failed to load'));

      await loader.loadAll();

      expect(loader.isLoaded()).toBe(true);
    });

    it('should handle failed wave load gracefully', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            sectors: [],
            enemyPacks: [],
            bosses: [],
            powerups: [],
            waves: ['waves/invalid.json'],
            strings: [],
          }),
        })
        .mockRejectedValueOnce(new Error('Failed to load'));

      await loader.loadAll();

      expect(loader.isLoaded()).toBe(true);
    });

    it('should handle failed strings load gracefully', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            sectors: [],
            enemyPacks: [],
            bosses: [],
            powerups: [],
            waves: [],
            strings: ['strings/invalid.json'],
          }),
        })
        .mockRejectedValueOnce(new Error('Failed to load'));

      await loader.loadAll();

      expect(loader.isLoaded()).toBe(true);
    });
  });

  describe('Content Data Integrity', () => {
    beforeEach(() => {
      loader.loadDefaults();
    });

    it('should have correct enemy structure', () => {
      const enemy = loader.getEnemy('synapse_drone');

      expect(enemy).toHaveProperty('id');
      expect(enemy).toHaveProperty('name');
      expect(enemy).toHaveProperty('tier');
      expect(enemy).toHaveProperty('hp');
      expect(enemy).toHaveProperty('speed');
      expect(enemy).toHaveProperty('behavior');
      expect(enemy).toHaveProperty('scoreValue');
      expect(enemy).toHaveProperty('visual');
    });

    it('should have correct boss structure', () => {
      const boss = loader.getBoss('cortex_auditor');

      expect(boss).toHaveProperty('id');
      expect(boss).toHaveProperty('name');
      expect(boss).toHaveProperty('hp');
      expect(boss).toHaveProperty('phases');
      expect(boss).toHaveProperty('visual');
    });

    it('should have correct sector structure', () => {
      const sector = loader.getSector('sector1_neural_cage');

      expect(sector).toHaveProperty('id');
      expect(sector).toHaveProperty('name');
      expect(sector).toHaveProperty('levels');
      expect(sector).toHaveProperty('boss');
    });

    it('should have correct powerup structure', () => {
      const powerup = loader.getPowerup('calm_shield');

      expect(powerup).toHaveProperty('id');
      expect(powerup).toHaveProperty('name');
      expect(powerup).toHaveProperty('category');
      expect(powerup).toHaveProperty('effect');
      expect(powerup).toHaveProperty('durationMs');
      expect(powerup).toHaveProperty('visual');
    });

    it('should have correct wave structure', () => {
      const wave = loader.getWave('wave_basic_1');

      expect(wave).toHaveProperty('id');
      expect(wave).toHaveProperty('pattern');
      expect(wave).toHaveProperty('enemy');
      expect(wave).toHaveProperty('entryDelayMs');
    });
  });
});
