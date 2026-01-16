/**
 * Adaptive difficulty system
 */

import { CONFIG } from '../config';
import { clamp, lerp } from '../util/math';

export interface DifficultyState {
  level: number;
  speedMultiplier: number;
  spawnMultiplier: number;
  healthMultiplier: number;
  tension: number;
}

export class DifficultySystem {
  // Base difficulty (from sector/level)
  private baseDifficulty: number = 1;
  
  // Adaptive modifiers
  private playerStress: number = 0.5; // 0 = relaxed, 1 = stressed
  private performanceScore: number = 0.5; // 0 = struggling, 1 = dominating
  
  // Tracking metrics
  private recentHits: number = 0;
  private recentMisses: number = 0;
  private timeSinceLastHit: number = 0;
  private averageReactionTime: number = 0;
  private reactionSamples: number[] = [];
  
  // Time-based progression
  private playTime: number = 0;
  private readonly rampTime: number = CONFIG.DIFFICULTY_RAMP_TIME;
  
  // Bounds
  private readonly minMultiplier: number = 0.8;
  private readonly maxMultiplier: number = 1.2;
  
  /**
   * Set base difficulty from sector/level
   */
  setBaseDifficulty(level: number): void {
    this.baseDifficulty = level;
  }
  
  /**
   * Update difficulty based on player performance
   */
  update(dt: number): void {
    this.playTime += dt;
    this.timeSinceLastHit += dt;
    
    // Calculate performance score
    const hitRate = this.recentHits + this.recentMisses > 0
      ? this.recentHits / (this.recentHits + this.recentMisses)
      : 0.5;
    
    // Player is stressed if they've been hit recently
    const stressFromHits = clamp(1 - this.timeSinceLastHit / 5, 0, 1);
    
    // Player is stressed if reaction times are getting slower
    const avgReaction = this.averageReactionTime;
    const stressFromReaction = avgReaction > 0.5 ? 0.7 : 0.3;
    
    // Combine stress factors
    this.playerStress = lerp(
      this.playerStress,
      stressFromHits * 0.6 + stressFromReaction * 0.4,
      dt * 0.5
    );
    
    // Performance score based on hit rate and survival
    const survivalBonus = Math.min(1, this.playTime / 60);
    this.performanceScore = lerp(
      this.performanceScore,
      hitRate * 0.7 + survivalBonus * 0.3,
      dt * 0.3
    );
    
    // Decay hit/miss counters slowly
    this.recentHits *= 0.99;
    this.recentMisses *= 0.99;
  }
  
  /**
   * Record a successful hit (player hit enemy)
   */
  recordHit(reactionTime?: number): void {
    this.recentHits++;
    this.timeSinceLastHit = 0;
    
    if (reactionTime !== undefined) {
      this.reactionSamples.push(reactionTime);
      if (this.reactionSamples.length > 20) {
        this.reactionSamples.shift();
      }
      this.averageReactionTime = this.reactionSamples.reduce((a, b) => a + b, 0) / this.reactionSamples.length;
    }
  }
  
  /**
   * Record a miss (player took damage)
   */
  recordMiss(): void {
    this.recentMisses++;
  }
  
  /**
   * Get current difficulty state
   */
  getState(): DifficultyState {
    // Time-based progression
    const timeProgression = Math.min(1, this.playTime / this.rampTime);
    const timeDifficulty = 1 + timeProgression * 3; // 1x to 4x over ramp time
    
    // Combine base and time difficulty
    const effectiveDifficulty = this.baseDifficulty * timeDifficulty;
    
    // Calculate adaptive modifier based on performance
    // If player is doing well, increase difficulty slightly
    // If player is struggling, decrease difficulty slightly
    const adaptiveModifier = lerp(
      1 + (0.5 - this.performanceScore) * 0.2, // Performance adjustment
      1 - (this.playerStress - 0.5) * 0.1,      // Stress adjustment
      0.5
    );
    
    // Clamp adaptive modifier
    const clampedModifier = clamp(adaptiveModifier, this.minMultiplier, this.maxMultiplier);
    
    return {
      level: effectiveDifficulty,
      speedMultiplier: effectiveDifficulty * clampedModifier,
      spawnMultiplier: effectiveDifficulty * clampedModifier,
      healthMultiplier: 1 + (effectiveDifficulty - 1) * 0.3,
      tension: this.playerStress,
    };
  }
  
  /**
   * Get spawn interval based on current difficulty
   */
  getSpawnInterval(): number {
    const state = this.getState();
    return clamp(
      CONFIG.MAX_SPAWN_INTERVAL / state.spawnMultiplier,
      CONFIG.MIN_SPAWN_INTERVAL,
      CONFIG.MAX_SPAWN_INTERVAL
    );
  }
  
  /**
   * Get enemy speed multiplier
   */
  getSpeedMultiplier(): number {
    return this.getState().speedMultiplier;
  }
  
  /**
   * Get tension level (for audio mixing, etc.)
   */
  getTension(): number {
    return this.playerStress;
  }
  
  /**
   * Reset difficulty system
   */
  reset(): void {
    this.baseDifficulty = 1;
    this.playerStress = 0.5;
    this.performanceScore = 0.5;
    this.recentHits = 0;
    this.recentMisses = 0;
    this.timeSinceLastHit = 0;
    this.averageReactionTime = 0;
    this.reactionSamples = [];
    this.playTime = 0;
  }
}
