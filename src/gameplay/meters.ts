/**
 * Meta-Progression Meters System
 *
 * 3 Meters that track player mental state:
 * - Noise: Screen chaos level (0-100), high noise spawns reactive enemies
 * - Focus: Earned by clean play (no damage), unlocks precision tools
 * - Stillness: Earned by calm survival, unlocks defensive miracles
 */

import type { MetaMeters } from '../content/schema';

/**
 * Meter types
 */
export enum MeterType {
  NOISE = 'noise',
  FOCUS = 'focus',
  STILLNESS = 'stillness',
}

/**
 * Threshold configuration
 */
export interface MeterThreshold {
  id: string;
  meter: MeterType;
  value: number;
  callback: () => void;
  triggered: boolean;
}

/**
 * Reward configuration
 */
export interface MeterReward {
  id: string;
  meter: MeterType;
  threshold: number;
  type: 'precision_tool' | 'defensive_miracle' | 'reactive_enemy';
  name: string;
  description: string;
  claimed: boolean;
}

/**
 * Update state for meters
 */
export interface MeterUpdateState {
  enemyCount: number;
  projectileCount: number;
  playerDamaged: boolean;
  playerMoving?: boolean;
}

/**
 * Event callback type
 */
type MeterEventCallback = (data: Record<string, unknown>) => void;

/**
 * Serialized meter state
 */
export interface MeterState {
  noise: number;
  focus: number;
  stillness: number;
  focusStreak: number;
  stillnessDuration: number;
}

/**
 * Meters System - Manages meta-progression meters
 */
export class MetersSystem {
  private noise: number = 0;
  private focus: number = 0;
  private stillness: number = 0;

  private focusStreak: number = 0;
  private stillnessDuration: number = 0;

  private thresholds: MeterThreshold[] = [];
  private rewards: MeterReward[] = [];
  private eventListeners: Map<string, MeterEventCallback[]> = new Map();

  private nextThresholdId: number = 0;

  constructor(initial?: Partial<MetaMeters>) {
    if (initial) {
      this.noise = this.clamp(initial.noise ?? 0);
      this.focus = this.clamp(initial.focus ?? 0);
      this.stillness = this.clamp(initial.stillness ?? 0);
    }

    this.initializeRewards();
  }

  private initializeRewards(): void {
    // Focus rewards (precision tools)
    this.rewards.push(
      {
        id: 'focus_25',
        meter: MeterType.FOCUS,
        threshold: 25,
        type: 'precision_tool',
        name: 'Steady Aim',
        description: 'Reduced projectile spread',
        claimed: false,
      },
      {
        id: 'focus_50',
        meter: MeterType.FOCUS,
        threshold: 50,
        type: 'precision_tool',
        name: 'Eagle Eye',
        description: 'Highlight weak points',
        claimed: false,
      },
      {
        id: 'focus_75',
        meter: MeterType.FOCUS,
        threshold: 75,
        type: 'precision_tool',
        name: 'Perfect Shot',
        description: 'Critical hit chance',
        claimed: false,
      },
    );

    // Stillness rewards (defensive miracles)
    this.rewards.push(
      {
        id: 'stillness_30',
        meter: MeterType.STILLNESS,
        threshold: 30,
        type: 'defensive_miracle',
        name: 'Calm Shield',
        description: 'Brief invulnerability',
        claimed: false,
      },
      {
        id: 'stillness_50',
        meter: MeterType.STILLNESS,
        threshold: 50,
        type: 'defensive_miracle',
        name: 'Inner Peace',
        description: 'Slow enemy projectiles',
        claimed: false,
      },
      {
        id: 'stillness_70',
        meter: MeterType.STILLNESS,
        threshold: 70,
        type: 'defensive_miracle',
        name: 'Zen State',
        description: 'Auto-dodge one attack',
        claimed: false,
      },
    );

    // Noise penalties (reactive enemies)
    this.rewards.push(
      {
        id: 'noise_60',
        meter: MeterType.NOISE,
        threshold: 60,
        type: 'reactive_enemy',
        name: 'Chaos Spawn',
        description: 'Extra enemy wave',
        claimed: false,
      },
      {
        id: 'noise_80',
        meter: MeterType.NOISE,
        threshold: 80,
        type: 'reactive_enemy',
        name: 'Panic Attack',
        description: 'Aggressive enemy behavior',
        claimed: false,
      },
    );
  }

  private clamp(value: number): number {
    return Math.max(0, Math.min(100, value));
  }

  // Getters
  getNoise(): number {
    return this.noise;
  }
  getFocus(): number {
    return this.focus;
  }
  getStillness(): number {
    return this.stillness;
  }
  getFocusStreak(): number {
    return this.focusStreak;
  }
  getStillnessDuration(): number {
    return this.stillnessDuration;
  }

  getAll(): MetaMeters {
    return { noise: this.noise, focus: this.focus, stillness: this.stillness };
  }

  // Setters
  setNoise(value: number): void {
    const oldValue = this.noise;
    this.noise = this.clamp(value);
    this.checkThresholds(MeterType.NOISE, oldValue, this.noise);

    if (this.noise >= 90 && oldValue < 90) {
      this.emit('noise:critical', { level: this.noise });
    }
  }

  setFocus(value: number): void {
    const oldValue = this.focus;
    this.focus = this.clamp(value);
    this.checkThresholds(MeterType.FOCUS, oldValue, this.focus);

    // Check milestones
    const milestones = [25, 50, 75, 100];
    for (const milestone of milestones) {
      if (this.focus >= milestone && oldValue < milestone) {
        this.emit('focus:milestone', { level: this.focus, milestone });
        break;
      }
    }
  }

  setStillness(value: number): void {
    const oldValue = this.stillness;
    this.stillness = this.clamp(value);
    this.checkThresholds(MeterType.STILLNESS, oldValue, this.stillness);

    // Check milestones
    const milestones = [30, 50, 70, 100];
    for (const milestone of milestones) {
      if (this.stillness >= milestone && oldValue < milestone) {
        this.emit('stillness:milestone', { level: this.stillness, milestone });
        break;
      }
    }
  }

  // Modifiers
  addNoise(delta: number): void {
    this.setNoise(this.noise + delta);
  }
  addFocus(delta: number): void {
    this.setFocus(this.focus + delta);
  }
  addStillness(delta: number): void {
    this.setStillness(this.stillness + delta);
  }

  // Event handlers
  onEnemySpawn(count: number): void {
    this.addNoise(count * 2);
  }

  onProjectilesUpdate(count: number): void {
    this.addNoise(count * 0.5);
  }

  onPlayerDamage(_amount: number): void {
    this.addNoise(15);
    this.setFocus(0);
    this.focusStreak = 0;
  }

  onEnemyKill(): void {
    this.addFocus(5);
  }

  onPanicAction(): void {
    this.addStillness(-20);
    this.stillnessDuration = 0;
  }

  // Update
  update(dt: number, state: MeterUpdateState): void {
    // Noise decay when calm
    if (state.enemyCount === 0 && state.projectileCount === 0 && !state.playerDamaged) {
      this.addNoise(-5 * dt);
    }

    // Focus gain with clean play
    if (!state.playerDamaged) {
      const focusGain = 2 * dt;
      this.addFocus(focusGain);
      this.focusStreak += dt;
    }

    // Stillness gain
    if (!state.playerDamaged) {
      let stillnessGain = 3 * dt;

      // Bonus for not moving
      if (!state.playerMoving) {
        stillnessGain *= 2;
        this.stillnessDuration += dt;
      }

      // Penalty for high noise
      if (this.noise > 50) {
        stillnessGain *= 0.5;
      }

      // Synergy with focus
      if (this.focus > 30) {
        stillnessGain *= 1.5;
      }

      this.addStillness(stillnessGain);
    }
  }

  // Threshold management
  onNoiseThreshold(value: number, callback: () => void): string {
    return this.addThreshold(MeterType.NOISE, value, callback);
  }

  onFocusThreshold(value: number, callback: () => void): string {
    return this.addThreshold(MeterType.FOCUS, value, callback);
  }

  onStillnessThreshold(value: number, callback: () => void): string {
    return this.addThreshold(MeterType.STILLNESS, value, callback);
  }

  private addThreshold(meter: MeterType, value: number, callback: () => void): string {
    const id = `threshold_${this.nextThresholdId++}`;
    this.thresholds.push({ id, meter, value, callback, triggered: false });
    return id;
  }

  removeThreshold(id: string): void {
    this.thresholds = this.thresholds.filter((t) => t.id !== id);
  }

  private checkThresholds(meter: MeterType, oldValue: number, newValue: number): void {
    for (const threshold of this.thresholds) {
      if (threshold.meter === meter && !threshold.triggered) {
        if (oldValue < threshold.value && newValue >= threshold.value) {
          threshold.triggered = true;
          threshold.callback();
        }
      }
    }
  }

  // Rewards
  getAvailableRewards(): MeterReward[] {
    return this.rewards.filter((r) => {
      if (r.claimed) return false;

      switch (r.meter) {
        case MeterType.NOISE:
          return this.noise >= r.threshold;
        case MeterType.FOCUS:
          return this.focus >= r.threshold;
        case MeterType.STILLNESS:
          return this.stillness >= r.threshold;
      }
    });
  }

  claimReward(id: string): void {
    const reward = this.rewards.find((r) => r.id === id);
    if (reward) {
      reward.claimed = true;
    }
  }

  // Reset
  reset(): void {
    this.noise = 0;
    this.focus = 0;
    this.stillness = 0;
    this.focusStreak = 0;
    this.stillnessDuration = 0;

    // Reset thresholds
    for (const threshold of this.thresholds) {
      threshold.triggered = false;
    }

    // Reset rewards
    for (const reward of this.rewards) {
      reward.claimed = false;
    }
  }

  // Serialization
  toJSON(): MeterState {
    return {
      noise: this.noise,
      focus: this.focus,
      stillness: this.stillness,
      focusStreak: this.focusStreak,
      stillnessDuration: this.stillnessDuration,
    };
  }

  fromJSON(state: MeterState): void {
    this.noise = state.noise;
    this.focus = state.focus;
    this.stillness = state.stillness;
    this.focusStreak = state.focusStreak;
    this.stillnessDuration = state.stillnessDuration;
  }

  // Event system
  on(event: string, callback: MeterEventCallback): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  off(event: string, callback: MeterEventCallback): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index >= 0) {
        listeners.splice(index, 1);
      }
    }
  }

  private emit(event: string, data: Record<string, unknown>): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      for (const callback of listeners) {
        callback(data);
      }
    }
  }
}

/**
 * Create a meters system
 */
export function createMetersSystem(initial?: Partial<MetaMeters>): MetersSystem {
  return new MetersSystem(initial);
}

// Global meters system instance
export const metersSystem = createMetersSystem();
