/**
 * Rule Card System
 *
 * Each level has ONE rule card:
 * - Displayed as: icon + one-line hint
 * - Rule is felt within 15 seconds of play
 */

import type { RuleCard } from '../content/schema';

/**
 * Rule card mechanic types
 */
export type RuleCardMechanic =
  | 'mirror_fire' // Enemies mirror player shots
  | 'attention_tax' // Score penalty for looking away
  | 'sequence_kill' // Must kill enemies in specific order
  | 'rhythm_sync' // Actions sync to beat
  | 'no_damage_bonus' // Reward for clean play
  | 'stillness_reward' // Reward for not moving
  | 'quarantine_zone' // Avoid certain areas
  | 'heat_ammo' // Limited ammo that cools down
  | 'prophecy' // Specific condition to fulfill
  | 'contract_clause' // Choice-based mechanics
  | 'compassion_bonus' // Bonus for not killing certain enemies
  | 'minimal_shots' // Score for using fewer shots
  | 'escape_required' // Must reach exit, not kill all
  | 'dont_look_back' // Penalty for looking behind
  | 'clearance_token' // Collect tokens to progress
  | 'marching_rhythm' // Enemies sync to rhythm
  | 'break_beam' // Destroy specific targets
  | 'stillness_window'; // Windows of opportunity when still

/**
 * All available mechanics
 */
export const ALL_MECHANICS: RuleCardMechanic[] = [
  'mirror_fire',
  'attention_tax',
  'sequence_kill',
  'rhythm_sync',
  'no_damage_bonus',
  'stillness_reward',
  'quarantine_zone',
  'heat_ammo',
  'prophecy',
  'contract_clause',
  'compassion_bonus',
  'minimal_shots',
  'escape_required',
  'dont_look_back',
  'clearance_token',
  'marching_rhythm',
  'break_beam',
  'stillness_window',
];

/**
 * Display info for rendering
 */
export interface RuleCardDisplayInfo {
  icon: string;
  hint: string;
}

/**
 * Event callback type
 */
type RuleCardEventCallback = (data: Record<string, unknown>) => void;

/**
 * Mechanic callback type
 */
type MechanicCallback = (params?: Record<string, unknown>) => void;

/**
 * Rule Card System
 */
export class RuleCardSystem {
  private currentCard: RuleCard | null = null;
  private displayDuration: number = 0;
  private maxDisplayDuration: number = 15; // Default 15 seconds
  private isVisible: boolean = true;

  // Mechanic state
  private sequenceIndex: number = 0;
  private sequenceComplete: boolean = false;
  private rhythmTime: number = 0;
  private noDamageDuration: number = 0;
  private stillnessProgress: number = 0;

  // Callbacks
  private mechanicActivateCallbacks: Map<string, MechanicCallback[]> = new Map();
  private mechanicDeactivateCallbacks: Map<string, MechanicCallback[]> = new Map();
  private noDamageRewardCallbacks: ((reward: string) => void)[] = [];
  private stillnessRewardCallbacks: ((reward: string) => void)[] = [];
  private eventListeners: Map<string, RuleCardEventCallback[]> = new Map();

  /**
   * Load a rule card
   */
  loadCard(card: RuleCard): void {
    // Deactivate previous mechanic
    if (this.currentCard) {
      this.deactivateMechanic(this.currentCard.mechanic);
    }

    this.currentCard = card;
    this.displayDuration = 0;
    this.isVisible = true;
    this.resetMechanicState();

    // Activate new mechanic
    this.activateMechanic(card.mechanic, card.params);

    this.emit('card:loaded', { card });
  }

  /**
   * Clear current card
   */
  clearCard(): void {
    if (this.currentCard) {
      this.deactivateMechanic(this.currentCard.mechanic);
      this.currentCard = null;
      this.emit('card:cleared', {});
    }
  }

  /**
   * Get current card
   */
  getCurrentCard(): RuleCard | null {
    return this.currentCard;
  }

  /**
   * Get display info for rendering
   */
  getDisplayInfo(): RuleCardDisplayInfo | null {
    if (!this.currentCard) return null;
    return {
      icon: this.currentCard.icon,
      hint: this.currentCard.hint,
    };
  }

  /**
   * Get display duration
   */
  getDisplayDuration(): number {
    return this.displayDuration;
  }

  /**
   * Set max display duration
   */
  setDisplayDuration(duration: number): void {
    this.maxDisplayDuration = duration;
  }

  /**
   * Check if card is visible
   */
  isCardVisible(): boolean {
    return this.isVisible && this.currentCard !== null;
  }

  /**
   * Show card
   */
  showCard(): void {
    this.isVisible = true;
  }

  /**
   * Hide card
   */
  hideCard(): void {
    this.isVisible = false;
  }

  /**
   * Update system
   */
  update(dt: number): void {
    if (this.currentCard) {
      this.displayDuration += dt;

      // Auto-hide after max duration
      if (this.displayDuration >= this.maxDisplayDuration) {
        this.isVisible = false;
      }

      // Update rhythm timing
      this.rhythmTime += dt;

      // Update no-damage duration
      if (this.isMechanicActive('no_damage_bonus')) {
        this.noDamageDuration += dt;
        const params = this.currentCard.params as { requiredDuration?: number; bonusReward?: string } | undefined;
        const required = params?.requiredDuration ?? 10;
        if (this.noDamageDuration >= required) {
          const reward = params?.bonusReward ?? 'bonus';
          for (const callback of this.noDamageRewardCallbacks) {
            callback(reward);
          }
          this.noDamageDuration = 0; // Reset for next reward
        }
      }
    }
  }

  /**
   * Update stillness tracking
   */
  updateStillness(dt: number, isMoving: boolean): void {
    if (!this.isMechanicActive('stillness_reward')) return;

    if (isMoving) {
      this.stillnessProgress = 0;
    } else {
      this.stillnessProgress += dt;

      const params = this.currentCard?.params as { requiredStillness?: number; reward?: string } | undefined;
      const required = params?.requiredStillness ?? 5;
      if (this.stillnessProgress >= required) {
        const reward = params?.reward ?? 'bonus';
        for (const callback of this.stillnessRewardCallbacks) {
          callback(reward);
        }
        this.stillnessProgress = 0; // Reset for next reward
      }
    }
  }

  /**
   * Handle player damage
   */
  onPlayerDamage(): void {
    this.noDamageDuration = 0;
  }

  // Mechanic activation

  private activateMechanic(mechanic: string, params?: Record<string, unknown>): void {
    const callbacks = this.mechanicActivateCallbacks.get(mechanic);
    if (callbacks) {
      for (const callback of callbacks) {
        callback(params);
      }
    }
  }

  private deactivateMechanic(mechanic: string): void {
    const callbacks = this.mechanicDeactivateCallbacks.get(mechanic);
    if (callbacks) {
      for (const callback of callbacks) {
        callback();
      }
    }
  }

  private resetMechanicState(): void {
    this.sequenceIndex = 0;
    this.sequenceComplete = false;
    this.rhythmTime = 0;
    this.noDamageDuration = 0;
    this.stillnessProgress = 0;
  }

  /**
   * Register mechanic activate callback
   */
  onMechanicActivate(mechanic: string, callback: MechanicCallback): void {
    if (!this.mechanicActivateCallbacks.has(mechanic)) {
      this.mechanicActivateCallbacks.set(mechanic, []);
    }
    this.mechanicActivateCallbacks.get(mechanic)!.push(callback);
  }

  /**
   * Register mechanic deactivate callback
   */
  onMechanicDeactivate(mechanic: string, callback: MechanicCallback): void {
    if (!this.mechanicDeactivateCallbacks.has(mechanic)) {
      this.mechanicDeactivateCallbacks.set(mechanic, []);
    }
    this.mechanicDeactivateCallbacks.get(mechanic)!.push(callback);
  }

  /**
   * Check if mechanic is active
   */
  isMechanicActive(mechanic: string): boolean {
    return this.currentCard?.mechanic === mechanic;
  }

  // Mechanic-specific methods

  /**
   * Check if enemies should mirror player shots
   */
  shouldEnemiesMirror(): boolean {
    return this.isMechanicActive('mirror_fire');
  }

  /**
   * Apply score modifier (for attention_tax)
   */
  applyScoreModifier(score: number): number {
    if (!this.isMechanicActive('attention_tax')) return score;

    const params = this.currentCard?.params as { taxRate?: number } | undefined;
    const taxRate = params?.taxRate ?? 0;
    return Math.round(score * (1 - taxRate));
  }

  /**
   * Get required kill sequence
   */
  getRequiredSequence(): string[] {
    if (!this.isMechanicActive('sequence_kill')) return [];

    const params = this.currentCard?.params as { sequence?: string[] } | undefined;
    return params?.sequence ?? [];
  }

  /**
   * Validate a kill in sequence
   */
  validateKill(target: string): boolean {
    if (!this.isMechanicActive('sequence_kill')) return true;

    const sequence = this.getRequiredSequence();
    if (this.sequenceIndex >= sequence.length) return true;

    if (sequence[this.sequenceIndex] === target) {
      this.sequenceIndex++;
      if (this.sequenceIndex >= sequence.length) {
        this.sequenceComplete = true;
      }
      this.emit('mechanic:triggered', { mechanic: 'sequence_kill', action: 'kill', target });
      return true;
    }

    return false;
  }

  /**
   * Check if sequence is complete
   */
  isSequenceComplete(): boolean {
    return this.sequenceComplete;
  }

  /**
   * Get rhythm BPM
   */
  getRhythmBPM(): number {
    if (!this.isMechanicActive('rhythm_sync')) return 0;

    const params = this.currentCard?.params as { bpm?: number } | undefined;
    return params?.bpm ?? 120;
  }

  /**
   * Check if current time is on beat
   */
  isOnBeat(tolerance: number = 0.1): boolean {
    if (!this.isMechanicActive('rhythm_sync')) return true;

    const bpm = this.getRhythmBPM();
    const beatInterval = 60 / bpm;
    const phase = (this.rhythmTime % beatInterval) / beatInterval;

    // On beat if phase is near 0 or 1
    return phase < tolerance || phase > 1 - tolerance;
  }

  /**
   * Get rhythm bonus multiplier
   */
  getRhythmBonus(onBeat: boolean): number {
    if (!this.isMechanicActive('rhythm_sync')) return 1;

    const params = this.currentCard?.params as { bonusMultiplier?: number } | undefined;
    const bonus = params?.bonusMultiplier ?? 1.5;

    return onBeat ? bonus : 1;
  }

  /**
   * Get no-damage duration
   */
  getNoDamageDuration(): number {
    return this.noDamageDuration;
  }

  /**
   * Register no-damage reward callback
   */
  onNoDamageReward(callback: (reward: string) => void): void {
    this.noDamageRewardCallbacks.push(callback);
  }

  /**
   * Get stillness progress
   */
  getStillnessProgress(): number {
    return this.stillnessProgress;
  }

  /**
   * Register stillness reward callback
   */
  onStillnessReward(callback: (reward: string) => void): void {
    this.stillnessRewardCallbacks.push(callback);
  }

  // Event system

  /**
   * Register event listener
   */
  on(event: string, callback: RuleCardEventCallback): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  /**
   * Remove event listener
   */
  off(event: string, callback: RuleCardEventCallback): void {
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
 * Create a rule card system
 */
export function createRuleCardSystem(): RuleCardSystem {
  return new RuleCardSystem();
}

// Global rule card system instance
export const ruleCardSystem = createRuleCardSystem();
