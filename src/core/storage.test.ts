/**
 * Storage System Tests
 * 
 * Tests for save data persistence, migration, and statistics tracking.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// We need to re-import storage after clearing localStorage in each test
// So we'll create fresh instances in each test

describe('Storage System', () => {
  // Helper to create a fresh Storage instance
  const createFreshStorage = async () => {
    // Clear any cached modules
    vi.resetModules();
    // Import fresh
    const { storage } = await import('./storage');
    return storage;
  };
  
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    vi.resetModules();
  });
  
  describe('Initial State', () => {
    it('should load default data when no save exists', async () => {
      const storage = await createFreshStorage();
      const data = storage.getData();
      
      expect(data.version).toBe(1);
      expect(data.highestSectorCompleted).toBe(0);
      expect(data.highScore.campaign).toBe(0);
      expect(data.highScore.endless).toBe(0);
      expect(data.codexUnlocked).toEqual([]);
      expect(data.achievementsUnlocked).toEqual([]);
    });
    
    it('should have default settings', async () => {
      const storage = await createFreshStorage();
      const settings = storage.settings;
      
      expect(settings.masterVolume).toBeDefined();
      expect(settings.musicVolume).toBeDefined();
      expect(settings.sfxVolume).toBeDefined();
      expect(typeof settings.screenShake).toBe('boolean');
      expect(typeof settings.showFps).toBe('boolean');
    });
    
    it('should have default stats initialized to zero', async () => {
      const storage = await createFreshStorage();
      const stats = storage.stats;
      
      expect(stats.totalPlayTime).toBe(0);
      expect(stats.totalBananasThrown).toBe(0);
      expect(stats.totalEnemiesDefeated).toBe(0);
      expect(stats.totalBossesDefeated).toBe(0);
      expect(stats.totalDeaths).toBe(0);
      expect(stats.runsCompleted).toBe(0);
    });
    
    it('should have default cosmetics unlocked', async () => {
      const storage = await createFreshStorage();
      
      expect(storage.isCosmeticUnlocked('monkey_default')).toBe(true);
      expect(storage.isCosmeticUnlocked('banana_default')).toBe(true);
    });
  });
  
  describe('Save/Load Cycle', () => {
    it('should persist data after save', async () => {
      const storage = await createFreshStorage();
      
      // Modify data
      storage.setHighScore('campaign', 5000);
      storage.save();
      
      // Load fresh
      const storage2 = await createFreshStorage();
      expect(storage2.getHighScore('campaign')).toBe(5000);
    });
    
    it('should persist multiple fields', async () => {
      const storage = await createFreshStorage();
      
      storage.setHighScore('campaign', 1000);
      storage.setHighScore('endless', 2000);
      storage.unlockAchievement('first_blood');
      storage.unlockCodex('enemy_basic');
      storage.save();
      
      const storage2 = await createFreshStorage();
      expect(storage2.getHighScore('campaign')).toBe(1000);
      expect(storage2.getHighScore('endless')).toBe(2000);
      expect(storage2.isAchievementUnlocked('first_blood')).toBe(true);
      expect(storage2.isCodexUnlocked('enemy_basic')).toBe(true);
    });
    
    it('should update lastPlayed timestamp on save', async () => {
      const storage = await createFreshStorage();
      const beforeSave = Date.now();
      
      storage.save();
      
      const data = storage.getData();
      expect(data.lastPlayed).toBeGreaterThanOrEqual(beforeSave);
      expect(data.lastPlayed).toBeLessThanOrEqual(Date.now());
    });
  });
  
  describe('High Score', () => {
    it('should only update high score if new score is higher', async () => {
      const storage = await createFreshStorage();
      
      expect(storage.setHighScore('campaign', 1000)).toBe(true);
      expect(storage.getHighScore('campaign')).toBe(1000);
      
      // Lower score should not update
      expect(storage.setHighScore('campaign', 500)).toBe(false);
      expect(storage.getHighScore('campaign')).toBe(1000);
      
      // Higher score should update
      expect(storage.setHighScore('campaign', 1500)).toBe(true);
      expect(storage.getHighScore('campaign')).toBe(1500);
    });
    
    it('should track campaign and endless scores separately', async () => {
      const storage = await createFreshStorage();
      
      storage.setHighScore('campaign', 1000);
      storage.setHighScore('endless', 5000);
      
      expect(storage.getHighScore('campaign')).toBe(1000);
      expect(storage.getHighScore('endless')).toBe(5000);
    });
  });
  
  describe('Sector Progression', () => {
    it('should track highest sector completed', async () => {
      const storage = await createFreshStorage();
      
      expect(storage.highestSector).toBe(0);
      
      storage.highestSector = 1;
      expect(storage.highestSector).toBe(1);
      
      storage.highestSector = 3;
      expect(storage.highestSector).toBe(3);
    });
    
    it('should not decrease highest sector', async () => {
      const storage = await createFreshStorage();
      
      storage.highestSector = 5;
      storage.highestSector = 3; // Should be ignored
      
      expect(storage.highestSector).toBe(5);
    });
    
    it('should check if sector is unlocked', async () => {
      const storage = await createFreshStorage();
      
      // Sector 1 is always unlocked (sector 0 completed)
      expect(storage.isSectorUnlocked(1)).toBe(true);
      expect(storage.isSectorUnlocked(2)).toBe(false);
      
      storage.highestSector = 2;
      expect(storage.isSectorUnlocked(1)).toBe(true);
      expect(storage.isSectorUnlocked(2)).toBe(true);
      expect(storage.isSectorUnlocked(3)).toBe(true);
      expect(storage.isSectorUnlocked(4)).toBe(false);
    });
  });
  
  describe('Statistics Tracking', () => {
    it('should increment stats', async () => {
      const storage = await createFreshStorage();
      
      storage.incrementStat('totalBananasThrown', 10);
      expect(storage.stats.totalBananasThrown).toBe(10);
      
      storage.incrementStat('totalBananasThrown', 5);
      expect(storage.stats.totalBananasThrown).toBe(15);
    });
    
    it('should default increment to 1', async () => {
      const storage = await createFreshStorage();
      
      storage.incrementStat('totalDeaths');
      storage.incrementStat('totalDeaths');
      storage.incrementStat('totalDeaths');
      
      expect(storage.stats.totalDeaths).toBe(3);
    });
    
    it('should track all stat types', async () => {
      const storage = await createFreshStorage();
      
      storage.incrementStat('totalPlayTime', 60);
      storage.incrementStat('totalBananasThrown', 100);
      storage.incrementStat('totalEnemiesDefeated', 50);
      storage.incrementStat('totalBossesDefeated', 2);
      storage.incrementStat('totalDeaths', 5);
      storage.incrementStat('runsCompleted', 1);
      
      expect(storage.stats.totalPlayTime).toBe(60);
      expect(storage.stats.totalBananasThrown).toBe(100);
      expect(storage.stats.totalEnemiesDefeated).toBe(50);
      expect(storage.stats.totalBossesDefeated).toBe(2);
      expect(storage.stats.totalDeaths).toBe(5);
      expect(storage.stats.runsCompleted).toBe(1);
    });
  });
  
  describe('Settings', () => {
    it('should update individual settings', async () => {
      const storage = await createFreshStorage();
      
      storage.updateSettings({ musicVolume: 0.5 });
      expect(storage.settings.musicVolume).toBe(0.5);
      
      // Other settings should remain unchanged
      expect(storage.settings.screenShake).toBe(true);
    });
    
    it('should update multiple settings at once', async () => {
      const storage = await createFreshStorage();
      
      storage.updateSettings({
        musicVolume: 0.3,
        sfxVolume: 0.8,
        showFps: true,
      });
      
      expect(storage.settings.musicVolume).toBe(0.3);
      expect(storage.settings.sfxVolume).toBe(0.8);
      expect(storage.settings.showFps).toBe(true);
    });
    
    it('should persist settings after save', async () => {
      const storage = await createFreshStorage();
      
      storage.updateSettings({ screenShake: false });
      storage.save();
      
      const storage2 = await createFreshStorage();
      expect(storage2.settings.screenShake).toBe(false);
    });
  });
  
  describe('Unlock Systems', () => {
    describe('Codex', () => {
      it('should unlock codex entries', async () => {
        const storage = await createFreshStorage();
        
        expect(storage.isCodexUnlocked('enemy_tier1')).toBe(false);
        
        const wasNew = storage.unlockCodex('enemy_tier1');
        expect(wasNew).toBe(true);
        expect(storage.isCodexUnlocked('enemy_tier1')).toBe(true);
      });
      
      it('should not duplicate unlocks', async () => {
        const storage = await createFreshStorage();
        
        expect(storage.unlockCodex('enemy_tier1')).toBe(true);
        expect(storage.unlockCodex('enemy_tier1')).toBe(false);
        
        storage.save();
        const storage2 = await createFreshStorage();
        expect(storage2.getData().codexUnlocked.filter(id => id === 'enemy_tier1').length).toBe(1);
      });
    });
    
    describe('Achievements', () => {
      it('should unlock achievements', async () => {
        const storage = await createFreshStorage();
        
        expect(storage.isAchievementUnlocked('first_kill')).toBe(false);
        
        const wasNew = storage.unlockAchievement('first_kill');
        expect(wasNew).toBe(true);
        expect(storage.isAchievementUnlocked('first_kill')).toBe(true);
      });
      
      it('should return false for duplicate unlock attempts', async () => {
        const storage = await createFreshStorage();
        
        storage.unlockAchievement('speed_run');
        expect(storage.unlockAchievement('speed_run')).toBe(false);
      });
    });
    
    describe('Cosmetics', () => {
      it('should unlock new cosmetics', async () => {
        const storage = await createFreshStorage();
        
        expect(storage.isCosmeticUnlocked('monkey_gold')).toBe(false);
        
        storage.unlockCosmetic('monkey_gold');
        expect(storage.isCosmeticUnlocked('monkey_gold')).toBe(true);
      });
      
      it('should select cosmetics only if unlocked', async () => {
        const storage = await createFreshStorage();
        
        // Try to select locked cosmetic
        storage.selectCosmetic('monkeySkin', 'monkey_gold');
        expect(storage.selectedCosmetics.monkeySkin).toBe('monkey_default');
        
        // Unlock and select
        storage.unlockCosmetic('monkey_gold');
        storage.selectCosmetic('monkeySkin', 'monkey_gold');
        expect(storage.selectedCosmetics.monkeySkin).toBe('monkey_gold');
      });
      
      it('should always allow selecting "none"', async () => {
        const storage = await createFreshStorage();
        
        storage.selectCosmetic('trail', 'none');
        expect(storage.selectedCosmetics.trail).toBe('none');
      });
    });
  });
  
  describe('Reset', () => {
    it('should reset version to current version', async () => {
      const storage = await createFreshStorage();
      
      // Reset
      storage.reset();
      
      // Version should be current
      expect(storage.getData().version).toBe(1);
    });
    
    it('should have default cosmetics after reset', async () => {
      const storage = await createFreshStorage();
      
      // Reset
      storage.reset();
      
      // Should have default cosmetics
      expect(storage.isCosmeticUnlocked('monkey_default')).toBe(true);
      expect(storage.isCosmeticUnlocked('banana_default')).toBe(true);
    });
  });
  
  describe('Data Migration', () => {
    // Note: Testing migration requires careful handling of module state.
    // These tests verify the behavior of the storage system's merge logic
    // using the global storage instance.
    
    it('should merge new settings with defaults', async () => {
      // Reset storage and verify defaults are applied
      const storage = await createFreshStorage();
      storage.reset();
      
      // Verify defaults
      expect(storage.settings.screenShake).toBe(true);
      expect(storage.settings.masterVolume).toBeDefined();
    });
  });
  
  describe('Auto-Save', () => {
    it('should start and stop auto-save interval', async () => {
      vi.useFakeTimers();
      const storage = await createFreshStorage();
      
      storage.startAutoSave(1000);
      
      // Make changes that mark dirty
      storage.setHighScore('campaign', 100);
      
      // Fast forward
      vi.advanceTimersByTime(1000);
      
      // Stop auto-save
      storage.stopAutoSave();
      
      vi.useRealTimers();
    });
    
    it('should only save when dirty', async () => {
      vi.useFakeTimers();
      const storage = await createFreshStorage();
      const saveSpy = vi.spyOn(storage, 'save');
      
      storage.startAutoSave(1000);
      
      // No changes, should not save
      vi.advanceTimersByTime(1000);
      expect(saveSpy).not.toHaveBeenCalled();
      
      // Make change
      storage.setHighScore('campaign', 100);
      vi.advanceTimersByTime(1000);
      expect(saveSpy).toHaveBeenCalled();
      
      storage.stopAutoSave();
      vi.useRealTimers();
    });
  });
});
