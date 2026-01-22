/**
 * Achievement system
 */

import type { AchievementData } from '../content/schema';
import { events } from '../core/events';
import { storage } from '../core/storage';

export interface AchievementProgress {
  id: string;
  unlocked: boolean;
  progress: number;
  target: number;
}

/**
 * Achievement definitions
 */
const ACHIEVEMENTS: AchievementData[] = [
  // Stat-based
  {
    id: 'banana_republic',
    name: 'Banana Republic',
    description: 'Throw 1,000 bananas',
    icon: '🍌',
    condition: { type: 'stat', stat: 'totalBananasThrown', target: 1000 },
  },
  {
    id: 'monkey_mayhem',
    name: 'Monkey Mayhem',
    description: 'Defeat 500 enemies',
    icon: '💀',
    condition: { type: 'stat', stat: 'totalEnemiesDefeated', target: 500 },
  },
  {
    id: 'boss_slayer',
    name: 'Boss Slayer',
    description: 'Defeat 5 bosses',
    icon: '👑',
    condition: { type: 'stat', stat: 'totalBossesDefeated', target: 5 },
  },
  {
    id: 'survivor',
    name: 'Survivor',
    description: 'Complete 10 runs',
    icon: '🏆',
    condition: { type: 'stat', stat: 'runsCompleted', target: 10 },
  },
  
  // Skill-based
  {
    id: 'calm_under_fire',
    name: 'Calm Under Fire',
    description: 'Survive for 30 seconds without taking damage',
    icon: '🧘',
    condition: { type: 'survival', target: 30 },
  },
  {
    id: 'combo_master',
    name: 'Combo Master',
    description: 'Reach a 50x combo',
    icon: '⚡',
    condition: { type: 'combo', target: 50 },
  },
  {
    id: 'no_hit_wonder',
    name: 'No Hit Wonder',
    description: 'Complete a sector without taking damage',
    icon: '🛡️',
    condition: { type: 'perfect_sector', target: 1 },
  },
  
  // Boss defeats
  {
    id: 'mk_ultra_survivor',
    name: 'MK-Ultra Survivor',
    description: 'Defeat the Cortex Auditor',
    icon: '🧠',
    condition: { type: 'boss', boss: 'cortex_auditor', target: 1 },
  },
  {
    id: 'cosmic_clearance',
    name: 'Cosmic Clearance',
    description: 'Defeat the Grey Administrator',
    icon: '👽',
    condition: { type: 'boss', boss: 'grey_administrator', target: 1 },
  },
  {
    id: 'golden_mean_breaker',
    name: 'Golden Mean Breaker',
    description: 'Defeat the Banana Pentagon',
    icon: '🍌',
    condition: { type: 'boss', boss: 'banana_pentagon', target: 1 },
  },
  {
    id: 'override_authority',
    name: 'Override Authority',
    description: 'Defeat Archon.EXE',
    icon: '⚡',
    condition: { type: 'boss', boss: 'archon_exe', target: 1 },
  },
  {
    id: 'know_thyself',
    name: 'Know Thyself',
    description: 'Defeat the Mirror Self',
    icon: '🪞',
    condition: { type: 'boss', boss: 'mirror_self', target: 1 },
  },
  
  // Sector completion
  {
    id: 'neural_escape',
    name: 'Neural Escape',
    description: 'Complete Sector 1',
    icon: '🔬',
    condition: { type: 'sector', target: 1 },
  },
  {
    id: 'reef_diver',
    name: 'Reef Diver',
    description: 'Complete Sector 2',
    icon: '🌊',
    condition: { type: 'sector', target: 2 },
  },
  {
    id: 'pantheon_pilgrim',
    name: 'Pantheon Pilgrim',
    description: 'Complete Sector 3',
    icon: '⛪',
    condition: { type: 'sector', target: 3 },
  },
  {
    id: 'clearance_level_omega',
    name: 'Clearance Level Omega',
    description: 'Complete Sector 4',
    icon: '🔺',
    condition: { type: 'sector', target: 4 },
  },
  {
    id: 'return_to_monke',
    name: 'Return to Monke',
    description: 'Complete the game and achieve freedom',
    icon: '🐵',
    condition: { type: 'sector', target: 5 },
  },
  
  // Score-based
  {
    id: 'highscore_10k',
    name: 'Ten Thousand',
    description: 'Score 10,000 points',
    icon: '🔟',
    condition: { type: 'score', target: 10000 },
  },
  {
    id: 'highscore_100k',
    name: 'Legend',
    description: 'Score 100,000 points',
    icon: '💯',
    condition: { type: 'score', target: 100000 },
  },
];

export class AchievementSystem {
  private sessionStats: {
    survivalTime: number;
    maxCombo: number;
    score: number;
    damageTime: number;
    sectorDamage: boolean; // Track if damaged this sector
  } = {
    survivalTime: 0,
    maxCombo: 0,
    score: 0,
    damageTime: 0,
    sectorDamage: false,
  };
  
  // Track defeated bosses in session
  private defeatedBosses: Set<string> = new Set();
  
  constructor() {
    this.setupListeners();
  }
  
  private setupListeners(): void {
    // Listen for relevant events
    events.on('combo:increase', ({ count }) => {
      if (count > this.sessionStats.maxCombo) {
        this.sessionStats.maxCombo = count;
        this.checkAchievements();
      }
    });
    
    events.on('score:add', ({ amount }) => {
      this.sessionStats.score += amount;
      this.checkAchievements();
    });
    
    events.on('player:damage', () => {
      this.sessionStats.damageTime = 0;
      this.sessionStats.sectorDamage = true;
    });
    
    events.on('game:over', () => {
      this.checkAchievements();
    });
    
    // Boss defeat tracking
    events.on('boss:defeated', ({ bossId }) => {
      this.defeatedBosses.add(bossId);
      storage.incrementStat('totalBossesDefeated');
      this.checkBossAchievements(bossId);
      this.checkAchievements();
    });
    
    // Enemy death tracking
    events.on('enemy:death', () => {
      storage.incrementStat('totalEnemiesDefeated');
    });
    
    // Banana throw tracking
    events.on('weapon:fire', () => {
      storage.incrementStat('totalBananasThrown');
    });
    
    // Sector complete - check no-damage
    events.on('sector:complete', () => {
      if (!this.sessionStats.sectorDamage) {
        this.tryUnlock('no_hit_wonder');
      }
      // Reset for next sector
      this.sessionStats.sectorDamage = false;
    });
  }
  
  /**
   * Check boss-specific achievements
   */
  private checkBossAchievements(bossId: string): void {
    const bossAchievements: Record<string, string> = {
      'cortex_auditor': 'mk_ultra_survivor',
      'grey_administrator': 'cosmic_clearance',
      'banana_pentagon': 'golden_mean_breaker',
      'archon_exe': 'override_authority',
      'mirror_self': 'know_thyself',
    };
    
    const achievementId = bossAchievements[bossId];
    if (achievementId) {
      this.tryUnlock(achievementId);
    }
  }
  
  /**
   * Update session tracking
   */
  update(dt: number): void {
    this.sessionStats.survivalTime += dt;
    this.sessionStats.damageTime += dt;
    
    // Check survival achievement
    if (this.sessionStats.damageTime >= 30) {
      this.tryUnlock('calm_under_fire');
    }
  }
  
  /**
   * Check all achievements
   */
  checkAchievements(): void {
    const stats = storage.stats;
    
    for (const achievement of ACHIEVEMENTS) {
      if (storage.isAchievementUnlocked(achievement.id)) continue;
      
      let unlocked = false;
      
      switch (achievement.condition.type) {
        case 'stat':
          if (achievement.condition.stat) {
            const value = stats[achievement.condition.stat as keyof typeof stats];
            if (value >= achievement.condition.target) {
              unlocked = true;
            }
          }
          break;
          
        case 'combo':
          if (this.sessionStats.maxCombo >= achievement.condition.target) {
            unlocked = true;
          }
          break;
          
        case 'score':
          const highScore = Math.max(
            storage.getHighScore('campaign'),
            storage.getHighScore('endless')
          );
          if (highScore >= achievement.condition.target) {
            unlocked = true;
          }
          break;
          
        case 'sector':
          if (storage.highestSector >= achievement.condition.target) {
            unlocked = true;
          }
          break;
          
        case 'boss':
          if (achievement.condition.boss && this.defeatedBosses.has(achievement.condition.boss)) {
            unlocked = true;
          }
          break;
          
        case 'perfect_sector':
          // Handled by event listener
          break;
      }
      
      if (unlocked) {
        this.unlock(achievement);
      }
    }
  }
  
  /**
   * Try to unlock an achievement
   */
  tryUnlock(id: string): boolean {
    if (storage.isAchievementUnlocked(id)) return false;
    
    const achievement = ACHIEVEMENTS.find(a => a.id === id);
    if (achievement) {
      return this.unlock(achievement);
    }
    return false;
  }
  
  /**
   * Unlock an achievement
   */
  private unlock(achievement: AchievementData): boolean {
    if (storage.unlockAchievement(achievement.id)) {
      events.emit('achievement:unlock', {
        id: achievement.id,
        name: achievement.name,
      });
      
      // Handle rewards
      if (achievement.reward) {
        this.grantReward(achievement.reward);
      }
      
      return true;
    }
    return false;
  }
  
  /**
   * Grant achievement reward
   */
  private grantReward(reward: { type: string; id: string }): void {
    switch (reward.type) {
      case 'cosmetic':
        storage.unlockCosmetic(reward.id);
        events.emit('cosmetic:unlock', { id: reward.id, type: 'achievement_reward' });
        break;
      case 'codex':
        storage.unlockCodex(reward.id);
        events.emit('codex:unlock', { id: reward.id, category: 'lore' });
        break;
    }
  }
  
  /**
   * Get all achievements with progress
   */
  getAllProgress(): AchievementProgress[] {
    const stats = storage.stats;
    
    return ACHIEVEMENTS.map(achievement => {
      const unlocked = storage.isAchievementUnlocked(achievement.id);
      let progress = 0;
      
      if (!unlocked) {
        switch (achievement.condition.type) {
          case 'stat':
            if (achievement.condition.stat) {
              progress = stats[achievement.condition.stat as keyof typeof stats];
            }
            break;
          case 'combo':
            progress = this.sessionStats.maxCombo;
            break;
          case 'score':
            progress = Math.max(
              storage.getHighScore('campaign'),
              storage.getHighScore('endless')
            );
            break;
          case 'sector':
            progress = storage.highestSector;
            break;
        }
      } else {
        progress = achievement.condition.target;
      }
      
      return {
        id: achievement.id,
        unlocked,
        progress,
        target: achievement.condition.target,
      };
    });
  }
  
  /**
   * Reset session stats
   */
  resetSession(): void {
    this.sessionStats = {
      survivalTime: 0,
      maxCombo: 0,
      score: 0,
      damageTime: 0,
      sectorDamage: false,
    };
    this.defeatedBosses.clear();
  }
}

// Global achievement system instance
export const achievements = new AchievementSystem();
