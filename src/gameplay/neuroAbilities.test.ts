import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NeuroAbilities } from './neuroAbilities';

vi.mock('../core/events', () => ({
  events: {
    emit: vi.fn(),
    on: vi.fn(() => () => {}),
    off: vi.fn(),
  },
}));

describe('NeuroAbilities', () => {
  let abilities: NeuroAbilities;

  beforeEach(() => {
    abilities = new NeuroAbilities();
    vi.clearAllMocks();
  });

  describe('Initial state', () => {
    it('should start with zero charges', () => {
      expect(abilities.getShieldCharge()).toBe(0);
      expect(abilities.getOverdriveCharge()).toBe(0);
    });

    it('should start with no active abilities', () => {
      expect(abilities.isShieldActive()).toBe(false);
      expect(abilities.isOverdriveActive()).toBe(false);
    });
  });

  describe('Shield charging', () => {
    it('should not charge shield when calm is below threshold', () => {
      abilities.update(5, 0.5, 0.3);
      expect(abilities.getShieldCharge()).toBe(0);
    });

    it('should not charge shield immediately when calm exceeds threshold', () => {
      abilities.update(1, 0.8, 0.3);
      expect(abilities.getShieldCharge()).toBe(0);
    });

    it('should start charging shield after sustained calm', () => {
      // Sustain calm > 0.7 for 3+ seconds
      abilities.update(3.5, 0.8, 0.3);
      expect(abilities.getShieldCharge()).toBeGreaterThan(0);
    });

    it('should charge shield progressively', () => {
      abilities.update(3, 0.8, 0.3); // warmup
      abilities.update(1, 0.8, 0.3); // charging
      const charge1 = abilities.getShieldCharge();

      abilities.update(1, 0.8, 0.3); // more charging
      const charge2 = abilities.getShieldCharge();

      expect(charge2).toBeGreaterThan(charge1);
    });

    it('should reset calm sustain timer when calm drops below reset threshold', () => {
      abilities.update(2, 0.8, 0.3); // partial warmup
      abilities.update(1, 0.3, 0.3); // drop below 0.5 reset threshold
      abilities.update(2, 0.8, 0.3); // restart warmup — should not have charged
      expect(abilities.getShieldCharge()).toBe(0);
    });

    it('should decay shield charge slowly when not sustained', () => {
      // Build up some charge
      abilities.update(4, 0.8, 0.3);
      const chargeBeforeDecay = abilities.getShieldCharge();

      // Let calm drop
      abilities.update(1, 0.3, 0.3);
      expect(abilities.getShieldCharge()).toBeLessThan(chargeBeforeDecay);
    });
  });

  describe('Overdrive charging', () => {
    it('should not charge overdrive when arousal is below threshold', () => {
      abilities.update(5, 0.3, 0.5);
      expect(abilities.getOverdriveCharge()).toBe(0);
    });

    it('should start charging overdrive after sustained arousal', () => {
      abilities.update(3.5, 0.3, 0.8);
      expect(abilities.getOverdriveCharge()).toBeGreaterThan(0);
    });

    it('should reset arousal sustain timer when arousal drops below reset threshold', () => {
      abilities.update(2, 0.3, 0.8);
      abilities.update(1, 0.3, 0.3); // drop below 0.5
      abilities.update(2, 0.3, 0.8);
      expect(abilities.getOverdriveCharge()).toBe(0);
    });
  });

  describe('Shield activation', () => {
    it('should auto-activate shield at full charge', () => {
      const mockPlayer = { setShield: vi.fn() } as any;

      // 3s warmup, then 2s to reach full charge (0.6 + 0.2*2 = 1.0)
      // Use small dt so shield timer (3s) doesn't expire in same tick
      abilities.update(3, 0.9, 0.2, mockPlayer);
      abilities.update(2, 0.9, 0.2, mockPlayer);

      expect(abilities.isShieldActive()).toBe(true);
      expect(mockPlayer.setShield).toHaveBeenCalledWith(true);
    });

    it('should reset charge after activation', () => {
      const mockPlayer = { setShield: vi.fn() } as any;

      abilities.update(3, 0.9, 0.2, mockPlayer);
      abilities.update(2, 0.9, 0.2, mockPlayer);

      expect(abilities.getShieldCharge()).toBe(0);
    });

    it('should deactivate shield after duration expires', () => {
      const mockPlayer = { setShield: vi.fn() } as any;

      // Activate shield
      abilities.update(3, 0.9, 0.2, mockPlayer);
      abilities.update(2, 0.9, 0.2, mockPlayer);
      expect(abilities.isShieldActive()).toBe(true);

      // Shield lasts 3 seconds — wait for expiry
      abilities.update(4, 0.3, 0.3, mockPlayer);
      expect(abilities.isShieldActive()).toBe(false);
      expect(mockPlayer.setShield).toHaveBeenCalledWith(false);
    });
  });

  describe('Overdrive activation', () => {
    it('should auto-activate overdrive at full charge', () => {
      const mockWeapons = {
        setRapidFire: vi.fn(),
        setDamageMultiplier: vi.fn(),
      } as any;

      // 3s warmup, then 2s to reach full charge
      abilities.update(3, 0.2, 0.9, undefined, mockWeapons);
      abilities.update(2, 0.2, 0.9, undefined, mockWeapons);

      expect(abilities.isOverdriveActive()).toBe(true);
      expect(mockWeapons.setRapidFire).toHaveBeenCalledWith(true);
      expect(mockWeapons.setDamageMultiplier).toHaveBeenCalledWith(2);
    });

    it('should deactivate overdrive after duration expires', () => {
      const mockWeapons = {
        setRapidFire: vi.fn(),
        setDamageMultiplier: vi.fn(),
      } as any;

      // Activate overdrive
      abilities.update(3, 0.2, 0.9, undefined, mockWeapons);
      abilities.update(2, 0.2, 0.9, undefined, mockWeapons);
      expect(abilities.isOverdriveActive()).toBe(true);

      // Wait for expiry (duration is 3s)
      abilities.update(4, 0.3, 0.3, undefined, mockWeapons);
      expect(abilities.isOverdriveActive()).toBe(false);
      expect(mockWeapons.setRapidFire).toHaveBeenCalledWith(false);
      expect(mockWeapons.setDamageMultiplier).toHaveBeenCalledWith(1);
    });
  });

  describe('Reset', () => {
    it('should reset all state', () => {
      abilities.update(4, 0.8, 0.3);
      abilities.reset();

      expect(abilities.getShieldCharge()).toBe(0);
      expect(abilities.getOverdriveCharge()).toBe(0);
      expect(abilities.isShieldActive()).toBe(false);
      expect(abilities.isOverdriveActive()).toBe(false);
    });
  });
});
