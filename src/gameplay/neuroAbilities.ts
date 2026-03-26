import { events } from '../core/events';
import type { Player } from './player';
import type { WeaponSystem } from './weapons';

const CALM_THRESHOLD = 0.7;
const AROUSAL_THRESHOLD = 0.7;
const SUSTAIN_TIME = 3;
const CHARGE_RATE = 0.2;
const CHARGE_DECAY = 0.05;
const RESET_THRESHOLD = 0.5;
const ABILITY_DURATION = 3;
const HRV_REGEN_THRESHOLD = 30;
const HRV_REGEN_RATE = 0.15;
const HRV_REGEN_INTERVAL = 5;

export class NeuroAbilities {
  private shieldCharge = 0;
  private overdriveCharge = 0;
  private calmSustainTimer = 0;
  private arousalSustainTimer = 0;

  private shieldActive = false;
  private shieldTimer = 0;
  private overdriveActive = false;
  private overdriveTimer = 0;

  private hrvRegenTimer = 0;

  update(
    dt: number,
    calm: number,
    arousal: number,
    player?: Player,
    weapons?: WeaponSystem,
    hrvRmssd?: number | null,
  ): void {
    // Calm sustain tracking
    if (calm > CALM_THRESHOLD) {
      this.calmSustainTimer += dt;
    } else if (calm < RESET_THRESHOLD) {
      this.calmSustainTimer = 0;
    }

    // Arousal sustain tracking
    if (arousal > AROUSAL_THRESHOLD) {
      this.arousalSustainTimer += dt;
    } else if (arousal < RESET_THRESHOLD) {
      this.arousalSustainTimer = 0;
    }

    // Shield charging
    if (this.calmSustainTimer >= SUSTAIN_TIME) {
      this.shieldCharge = Math.min(1, this.shieldCharge + CHARGE_RATE * dt);
    } else {
      this.shieldCharge = Math.max(0, this.shieldCharge - CHARGE_DECAY * dt);
    }

    // Overdrive charging
    if (this.arousalSustainTimer >= SUSTAIN_TIME) {
      this.overdriveCharge = Math.min(1, this.overdriveCharge + CHARGE_RATE * dt);
    } else {
      this.overdriveCharge = Math.max(0, this.overdriveCharge - CHARGE_DECAY * dt);
    }

    // Auto-activate shield at full charge
    if (this.shieldCharge >= 1 && !this.shieldActive && player) {
      this.activateShield(player);
    }

    // Auto-activate overdrive at full charge
    if (this.overdriveCharge >= 1 && !this.overdriveActive && weapons) {
      this.activateOverdrive(weapons);
    }

    // Update active ability timers
    if (this.shieldActive) {
      this.shieldTimer -= dt;
      if (this.shieldTimer <= 0) {
        this.shieldActive = false;
        player?.setShield(false);
      }
    }

    if (this.overdriveActive) {
      this.overdriveTimer -= dt;
      if (this.overdriveTimer <= 0) {
        this.overdriveActive = false;
        weapons?.setRapidFire(false);
        weapons?.setDamageMultiplier(1);
        events.emit('neuro:overdrive', { active: false, duration: 0 });
      }
    }

    // HRV-based health regen: high HRV = parasympathetic activation = slow heal
    if (hrvRmssd != null && hrvRmssd > HRV_REGEN_THRESHOLD && player) {
      this.hrvRegenTimer += dt;
      if (this.hrvRegenTimer >= HRV_REGEN_INTERVAL) {
        this.hrvRegenTimer = 0;
        player.heal(HRV_REGEN_RATE);
      }
    } else {
      this.hrvRegenTimer = Math.max(0, this.hrvRegenTimer - dt * 0.5);
    }
  }

  private activateShield(player: Player): void {
    this.shieldActive = true;
    this.shieldTimer = ABILITY_DURATION;
    this.shieldCharge = 0;
    this.calmSustainTimer = 0;
    player.setShield(true);
  }

  private activateOverdrive(weapons: WeaponSystem): void {
    this.overdriveActive = true;
    this.overdriveTimer = ABILITY_DURATION;
    this.overdriveCharge = 0;
    this.arousalSustainTimer = 0;
    weapons.setRapidFire(true);
    weapons.setDamageMultiplier(2);
    events.emit('neuro:overdrive', { active: true, duration: ABILITY_DURATION });
  }

  getShieldCharge(): number {
    return this.shieldCharge;
  }

  getOverdriveCharge(): number {
    return this.overdriveCharge;
  }

  isShieldActive(): boolean {
    return this.shieldActive;
  }

  isOverdriveActive(): boolean {
    return this.overdriveActive;
  }

  reset(): void {
    this.shieldCharge = 0;
    this.overdriveCharge = 0;
    this.calmSustainTimer = 0;
    this.arousalSustainTimer = 0;
    this.shieldActive = false;
    this.overdriveActive = false;
  }
}
