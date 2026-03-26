/**
 * Meta-Progression Meters System — Raw SDK Metrics
 *
 * Exposes 5 raw neural metrics directly from the SDK:
 *   CALM, AROUSAL, ALPHA, BETA, THETA
 * Retains threshold / reward system for gameplay triggers.
 */

import type { MetaMeters } from '../content/schema';

export enum MeterType {
  CALM = 'calm',
  AROUSAL = 'arousal',
  ALPHA = 'alpha',
  BETA = 'beta',
  THETA = 'theta',
}

export interface MeterThreshold {
  id: string;
  meter: MeterType;
  value: number;
  callback: () => void;
  triggered: boolean;
}

export interface MeterReward {
  id: string;
  meter: MeterType;
  threshold: number;
  type: 'precision_tool' | 'defensive_miracle' | 'reactive_enemy';
  name: string;
  description: string;
  claimed: boolean;
}

export interface MeterUpdateState {
  enemyCount: number;
  projectileCount: number;
  playerDamaged: boolean;
  playerMoving?: boolean;
  calm?: number;
  arousal?: number;
  alpha?: number;
  beta?: number;
  theta?: number;
}

type MeterEventCallback = (data: Record<string, unknown>) => void;

export interface MeterState {
  calm: number;
  arousal: number;
  alpha: number;
  beta: number;
  theta: number;
  /** Legacy compat – mapped from calm+arousal+alpha */
  noise: number;
  focus: number;
  stillness: number;
  focusStreak: number;
  stillnessDuration: number;
}

export class MetersSystem {
  private calm: number = 0;
  private arousal: number = 0;
  private alpha: number = 0;
  private beta: number = 0;
  private theta: number = 0;

  private focusStreak: number = 0;
  private stillnessDuration: number = 0;

  private thresholds: MeterThreshold[] = [];
  private rewards: MeterReward[] = [];
  private eventListeners: Map<string, MeterEventCallback[]> = new Map();
  private nextThresholdId: number = 0;

  constructor(initial?: Partial<MetaMeters>) {
    if (initial) {
      this.calm = this.clamp(initial.noise ?? 0);
      this.arousal = this.clamp(initial.focus ?? 0);
      this.alpha = this.clamp(initial.stillness ?? 0);
    }
    this.initializeRewards();
  }

  private initializeRewards(): void {
    this.rewards.push(
      {
        id: 'calm_50',
        meter: MeterType.CALM,
        threshold: 50,
        type: 'defensive_miracle',
        name: 'Calm Shield',
        description: 'Brief invulnerability',
        claimed: false,
      },
      {
        id: 'calm_75',
        meter: MeterType.CALM,
        threshold: 75,
        type: 'defensive_miracle',
        name: 'Inner Peace',
        description: 'Slow enemy projectiles',
        claimed: false,
      },
      {
        id: 'arousal_50',
        meter: MeterType.AROUSAL,
        threshold: 50,
        type: 'reactive_enemy',
        name: 'Adrenaline',
        description: 'Faster fire rate',
        claimed: false,
      },
      {
        id: 'arousal_75',
        meter: MeterType.AROUSAL,
        threshold: 75,
        type: 'reactive_enemy',
        name: 'Overdrive',
        description: 'Bonus damage burst',
        claimed: false,
      },
      {
        id: 'alpha_60',
        meter: MeterType.ALPHA,
        threshold: 60,
        type: 'precision_tool',
        name: 'Alpha Focus',
        description: 'Highlight weak points',
        claimed: false,
      },
    );
  }

  private clamp(value: number): number {
    return Math.max(0, Math.min(100, value));
  }

  // Getters — raw metric values (0-100)
  getCalm(): number {
    return this.calm;
  }
  getArousal(): number {
    return this.arousal;
  }
  getAlpha(): number {
    return this.alpha;
  }
  getBeta(): number {
    return this.beta;
  }
  getTheta(): number {
    return this.theta;
  }

  /** Legacy compat */
  getNoise(): number {
    return this.arousal;
  }
  getFocus(): number {
    return this.calm;
  }
  getStillness(): number {
    return this.alpha;
  }
  getFocusStreak(): number {
    return this.focusStreak;
  }
  getStillnessDuration(): number {
    return this.stillnessDuration;
  }

  getAll(): MetaMeters {
    return { noise: this.arousal, focus: this.calm, stillness: this.alpha };
  }

  // Direct setters
  private setMeter(meter: MeterType, value: number): void {
    const clamped = this.clamp(value);
    let old: number;
    switch (meter) {
      case MeterType.CALM:
        old = this.calm;
        this.calm = clamped;
        break;
      case MeterType.AROUSAL:
        old = this.arousal;
        this.arousal = clamped;
        break;
      case MeterType.ALPHA:
        old = this.alpha;
        this.alpha = clamped;
        break;
      case MeterType.BETA:
        old = this.beta;
        this.beta = clamped;
        break;
      case MeterType.THETA:
        old = this.theta;
        this.theta = clamped;
        break;
      default:
        return;
    }
    this.checkThresholds(meter, old, clamped);
  }

  // Legacy setters
  setNoise(value: number): void {
    this.setMeter(MeterType.AROUSAL, value);
  }
  setFocus(value: number): void {
    this.setMeter(MeterType.CALM, value);
  }
  setStillness(value: number): void {
    this.setMeter(MeterType.ALPHA, value);
  }
  addNoise(delta: number): void {
    this.setMeter(MeterType.AROUSAL, this.arousal + delta);
  }
  addFocus(delta: number): void {
    this.setMeter(MeterType.CALM, this.calm + delta);
  }
  addStillness(delta: number): void {
    this.setMeter(MeterType.ALPHA, this.alpha + delta);
  }

  // Event handlers (legacy)
  onEnemySpawn(_count: number): void {}
  onProjectilesUpdate(_count: number): void {}
  onPlayerDamage(_amount: number): void {
    this.focusStreak = 0;
  }
  onEnemyKill(): void {}
  onPanicAction(): void {
    this.stillnessDuration = 0;
  }

  /**
   * Update from raw neuro state — stores values directly (no derivation)
   */
  update(dt: number, state: MeterUpdateState): void {
    this.setMeter(MeterType.CALM, (state.calm ?? 0) * 100);
    this.setMeter(MeterType.AROUSAL, (state.arousal ?? 0) * 100);
    this.setMeter(MeterType.ALPHA, (state.alpha ?? 0) * 100);
    this.setMeter(MeterType.BETA, (state.beta ?? 0) * 100);
    this.setMeter(MeterType.THETA, (state.theta ?? 0) * 100);

    if (!state.playerDamaged) {
      this.focusStreak += dt;
    } else {
      this.focusStreak = 0;
    }
    if (!state.playerMoving) {
      this.stillnessDuration += dt;
    }
  }

  // Threshold management
  onNoiseThreshold(value: number, callback: () => void): string {
    return this.addThreshold(MeterType.AROUSAL, value, callback);
  }
  onFocusThreshold(value: number, callback: () => void): string {
    return this.addThreshold(MeterType.CALM, value, callback);
  }
  onStillnessThreshold(value: number, callback: () => void): string {
    return this.addThreshold(MeterType.ALPHA, value, callback);
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
          this.emit(`${meter}:milestone`, { level: newValue, milestone: threshold.value });
        }
      }
    }
  }

  getAvailableRewards(): MeterReward[] {
    return this.rewards.filter((r) => {
      if (r.claimed) return false;
      switch (r.meter) {
        case MeterType.CALM:
          return this.calm >= r.threshold;
        case MeterType.AROUSAL:
          return this.arousal >= r.threshold;
        case MeterType.ALPHA:
          return this.alpha >= r.threshold;
        case MeterType.BETA:
          return this.beta >= r.threshold;
        case MeterType.THETA:
          return this.theta >= r.threshold;
      }
    });
  }

  claimReward(id: string): void {
    const reward = this.rewards.find((r) => r.id === id);
    if (reward) reward.claimed = true;
  }

  reset(): void {
    this.calm = 0;
    this.arousal = 0;
    this.alpha = 0;
    this.beta = 0;
    this.theta = 0;
    this.focusStreak = 0;
    this.stillnessDuration = 0;
    for (const t of this.thresholds) t.triggered = false;
    for (const r of this.rewards) r.claimed = false;
  }

  toJSON(): MeterState {
    return {
      calm: this.calm,
      arousal: this.arousal,
      alpha: this.alpha,
      beta: this.beta,
      theta: this.theta,
      noise: this.arousal,
      focus: this.calm,
      stillness: this.alpha,
      focusStreak: this.focusStreak,
      stillnessDuration: this.stillnessDuration,
    };
  }

  fromJSON(state: MeterState): void {
    this.calm = state.calm ?? state.focus ?? 0;
    this.arousal = state.arousal ?? state.noise ?? 0;
    this.alpha = state.alpha ?? state.stillness ?? 0;
    this.beta = state.beta ?? 0;
    this.theta = state.theta ?? 0;
    this.focusStreak = state.focusStreak;
    this.stillnessDuration = state.stillnessDuration;
  }

  on(event: string, callback: MeterEventCallback): void {
    if (!this.eventListeners.has(event)) this.eventListeners.set(event, []);
    this.eventListeners.get(event)!.push(callback);
  }

  off(event: string, callback: MeterEventCallback): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const idx = listeners.indexOf(callback);
      if (idx >= 0) listeners.splice(idx, 1);
    }
  }

  private emit(event: string, data: Record<string, unknown>): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      for (const cb of listeners) cb(data);
    }
  }
}

export function createMetersSystem(initial?: Partial<MetaMeters>): MetersSystem {
  return new MetersSystem(initial);
}

export const metersSystem = createMetersSystem();
