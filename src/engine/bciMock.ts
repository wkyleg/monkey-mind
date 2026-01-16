/**
 * Mock BCI Provider for Testing and Development
 * 
 * This module provides a mock implementation of the InputProvider interface
 * that simulates BCI (Brain-Computer Interface) signals. Use this for:
 * 
 * 1. Development without BCI hardware
 * 2. Unit/integration testing of BCI-dependent features
 * 3. Demonstrating BCI integration patterns
 * 
 * When real BCI hardware is integrated, create a similar provider that
 * reads from the actual EEG device and normalizes signals to 0-1 range.
 * 
 * @example
 * ```typescript
 * const bciMock = new MockBCIProvider();
 * game.getInput().addProvider(bciMock);
 * 
 * // Simulate meditation state
 * bciMock.setCalm(0.8);
 * bciMock.setArousal(0.2);
 * 
 * // Simulate excitement
 * bciMock.setCalm(0.2);
 * bciMock.setArousal(0.9);
 * ```
 */

import type { InputProvider, PlayerIntent } from './input';

/**
 * Signal smoothing configuration
 */
interface SmoothingConfig {
  /** Time constant for exponential smoothing (seconds) */
  timeConstant: number;
  /** Minimum change threshold to update value */
  threshold: number;
}

/**
 * Preset emotional states for quick testing
 */
export const BCI_PRESETS = {
  /** Deep meditation: high calm, low arousal */
  MEDITATION: { calm: 0.9, arousal: 0.1 },
  /** Focused attention: balanced state */
  FOCUSED: { calm: 0.6, arousal: 0.4 },
  /** Neutral baseline */
  NEUTRAL: { calm: 0.5, arousal: 0.5 },
  /** Alert and engaged */
  ALERT: { calm: 0.4, arousal: 0.7 },
  /** High excitement/stress */
  EXCITED: { calm: 0.2, arousal: 0.9 },
  /** Drowsy/fatigued */
  DROWSY: { calm: 0.7, arousal: 0.2 },
} as const;

/**
 * Mock BCI Provider
 * 
 * Simulates BCI signals for testing and development.
 * Implements the InputProvider interface for seamless integration.
 */
export class MockBCIProvider implements InputProvider {
  // Raw target values (what we're simulating toward)
  private targetCalm: number = 0.5;
  private targetArousal: number = 0.5;
  
  // Smoothed current values (what we report)
  private currentCalm: number = 0.5;
  private currentArousal: number = 0.5;
  
  // Noise simulation
  private noiseEnabled: boolean = true;
  private noiseAmplitude: number = 0.05;
  
  // Smoothing configuration
  private smoothing: SmoothingConfig = {
    timeConstant: 0.3, // 300ms smoothing
    threshold: 0.001,
  };
  
  // SSVEP simulation (gaze-based movement)
  private ssvepEnabled: boolean = false;
  private ssvepMoveAxis: number = 0;
  
  // State tracking
  private connected: boolean = false;
  
  /**
   * Initialize the mock BCI provider
   */
  init(): void {
    this.connected = true;
    console.log('[MockBCI] Initialized - simulating BCI signals');
  }
  
  /**
   * Clean up resources
   */
  destroy(): void {
    this.connected = false;
    console.log('[MockBCI] Destroyed');
  }
  
  /**
   * Update signal values with smoothing and noise
   */
  update(dt: number): void {
    if (!this.connected) return;
    
    // Exponential smoothing toward target values
    const alpha = 1 - Math.exp(-dt / this.smoothing.timeConstant);
    
    this.currentCalm = this.lerp(this.currentCalm, this.targetCalm, alpha);
    this.currentArousal = this.lerp(this.currentArousal, this.targetArousal, alpha);
    
    // Add noise for realism
    if (this.noiseEnabled) {
      this.currentCalm = this.clamp(
        this.currentCalm + this.noise() * this.noiseAmplitude,
        0, 1
      );
      this.currentArousal = this.clamp(
        this.currentArousal + this.noise() * this.noiseAmplitude,
        0, 1
      );
    }
  }
  
  /**
   * Get the current simulated intent
   */
  getIntent(): Partial<PlayerIntent> {
    if (!this.connected) {
      return {};
    }
    
    const intent: Partial<PlayerIntent> = {
      calm: this.currentCalm,
      arousal: this.currentArousal,
    };
    
    // Include SSVEP-based movement if enabled
    if (this.ssvepEnabled && this.ssvepMoveAxis !== 0) {
      intent.moveAxis = this.ssvepMoveAxis;
    }
    
    return intent;
  }
  
  // --- Configuration Methods ---
  
  /**
   * Set the target calm level (0-1)
   * 
   * In real BCI, this would come from alpha wave analysis.
   * High calm = relaxed, meditative state
   * Low calm = agitated, stressed state
   */
  setCalm(value: number): void {
    this.targetCalm = this.clamp(value, 0, 1);
  }
  
  /**
   * Set the target arousal level (0-1)
   * 
   * In real BCI, this would come from beta wave analysis.
   * High arousal = excited, alert state
   * Low arousal = drowsy, unfocused state
   */
  setArousal(value: number): void {
    this.targetArousal = this.clamp(value, 0, 1);
  }
  
  /**
   * Apply a preset emotional state
   */
  applyPreset(preset: keyof typeof BCI_PRESETS): void {
    const state = BCI_PRESETS[preset];
    this.targetCalm = state.calm;
    this.targetArousal = state.arousal;
  }
  
  /**
   * Enable/disable signal noise simulation
   */
  setNoiseEnabled(enabled: boolean): void {
    this.noiseEnabled = enabled;
  }
  
  /**
   * Set noise amplitude (0-1, default 0.05)
   */
  setNoiseAmplitude(amplitude: number): void {
    this.noiseAmplitude = this.clamp(amplitude, 0, 1);
  }
  
  /**
   * Set smoothing time constant (seconds)
   * Lower = faster response, higher = smoother
   */
  setSmoothingTimeConstant(seconds: number): void {
    this.smoothing.timeConstant = Math.max(0.01, seconds);
  }
  
  /**
   * Enable SSVEP (Steady State Visual Evoked Potential) mode
   * This allows the BCI to control movement via gaze direction
   */
  enableSSVEP(enabled: boolean): void {
    this.ssvepEnabled = enabled;
  }
  
  /**
   * Set SSVEP-based movement axis (-1 to 1)
   * In real BCI, this would be determined by which frequency
   * the user is focusing on (left target vs right target)
   */
  setSSVEPMoveAxis(value: number): void {
    this.ssvepMoveAxis = this.clamp(value, -1, 1);
  }
  
  /**
   * Simulate connection/disconnection
   */
  setConnected(connected: boolean): void {
    this.connected = connected;
  }
  
  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.connected;
  }
  
  /**
   * Get current (smoothed) calm value
   */
  getCurrentCalm(): number {
    return this.currentCalm;
  }
  
  /**
   * Get current (smoothed) arousal value
   */
  getCurrentArousal(): number {
    return this.currentArousal;
  }
  
  /**
   * Reset to neutral state
   */
  reset(): void {
    this.targetCalm = 0.5;
    this.targetArousal = 0.5;
    this.currentCalm = 0.5;
    this.currentArousal = 0.5;
    this.ssvepMoveAxis = 0;
  }
  
  // --- Private Helpers ---
  
  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }
  
  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
  
  private noise(): number {
    // Box-Muller transform for Gaussian noise
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
}

/**
 * Create a simple automated BCI simulator that varies signals over time
 * Useful for demos and automated testing
 */
export class AutomatedBCISimulator {
  private provider: MockBCIProvider;
  private time: number = 0;
  private pattern: 'sine' | 'random' | 'preset-cycle' = 'sine';
  private presetIndex: number = 0;
  private presetList = Object.keys(BCI_PRESETS) as (keyof typeof BCI_PRESETS)[];
  private presetDuration: number = 5; // seconds per preset
  
  constructor(provider: MockBCIProvider) {
    this.provider = provider;
  }
  
  /**
   * Set the simulation pattern
   */
  setPattern(pattern: 'sine' | 'random' | 'preset-cycle'): void {
    this.pattern = pattern;
  }
  
  /**
   * Update the automated simulation
   */
  update(dt: number): void {
    this.time += dt;
    
    switch (this.pattern) {
      case 'sine':
        // Gentle sine wave oscillation
        this.provider.setCalm(0.5 + 0.3 * Math.sin(this.time * 0.5));
        this.provider.setArousal(0.5 + 0.3 * Math.cos(this.time * 0.3));
        break;
        
      case 'random':
        // Random walk with bounds
        if (Math.random() < dt) {
          const calmDelta = (Math.random() - 0.5) * 0.2;
          const arousalDelta = (Math.random() - 0.5) * 0.2;
          this.provider.setCalm(this.provider.getCurrentCalm() + calmDelta);
          this.provider.setArousal(this.provider.getCurrentArousal() + arousalDelta);
        }
        break;
        
      case 'preset-cycle':
        // Cycle through presets
        const presetTime = this.time % (this.presetDuration * this.presetList.length);
        const newIndex = Math.floor(presetTime / this.presetDuration);
        if (newIndex !== this.presetIndex) {
          this.presetIndex = newIndex;
          this.provider.applyPreset(this.presetList[this.presetIndex]);
          console.log(`[AutoBCI] Preset: ${this.presetList[this.presetIndex]}`);
        }
        break;
    }
  }
  
  /**
   * Reset time counter
   */
  reset(): void {
    this.time = 0;
    this.presetIndex = 0;
  }
}
