/**
 * Scoring and combo system
 */

import { events } from '../core/events';

export interface ScoreState {
  score: number;
  combo: number;
  maxCombo: number;
  multiplier: number;
}

export class ScoringSystem {
  private score: number = 0;
  private combo: number = 0;
  private maxCombo: number = 0;
  private comboTimer: number = 0;
  private readonly comboTimeout: number = 2; // seconds
  
  // Multipliers
  private baseMultiplier: number = 1;
  private difficultyMultiplier: number = 1;
  
  /**
   * Add to score
   */
  addScore(baseAmount: number, reason: string = 'generic'): number {
    const comboMultiplier = 1 + this.combo * 0.1;
    const totalMultiplier = this.baseMultiplier * this.difficultyMultiplier * comboMultiplier;
    const amount = Math.floor(baseAmount * totalMultiplier);
    
    this.score += amount;
    
    events.emit('score:add', { amount, reason });
    
    return amount;
  }
  
  /**
   * Increment combo
   */
  incrementCombo(): void {
    this.combo++;
    this.comboTimer = this.comboTimeout;
    
    if (this.combo > this.maxCombo) {
      this.maxCombo = this.combo;
    }
    
    events.emit('combo:increase', { count: this.combo });
  }
  
  /**
   * Break the combo
   */
  breakCombo(): void {
    if (this.combo > 0) {
      events.emit('combo:break', { finalCount: this.combo });
      this.combo = 0;
    }
  }
  
  /**
   * Update combo timer
   */
  update(dt: number): void {
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.breakCombo();
      }
    }
  }
  
  /**
   * Set difficulty multiplier
   */
  setDifficultyMultiplier(value: number): void {
    this.difficultyMultiplier = value;
  }
  
  /**
   * Set base multiplier
   */
  setBaseMultiplier(value: number): void {
    this.baseMultiplier = value;
  }
  
  /**
   * Get current state
   */
  getState(): ScoreState {
    return {
      score: this.score,
      combo: this.combo,
      maxCombo: this.maxCombo,
      multiplier: this.baseMultiplier * this.difficultyMultiplier * (1 + this.combo * 0.1),
    };
  }
  
  /**
   * Get score
   */
  getScore(): number {
    return this.score;
  }
  
  /**
   * Get combo
   */
  getCombo(): number {
    return this.combo;
  }
  
  /**
   * Reset scoring
   */
  reset(): void {
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.comboTimer = 0;
    this.difficultyMultiplier = 1;
    this.baseMultiplier = 1;
  }
}
