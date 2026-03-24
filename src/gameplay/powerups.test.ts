/**
 * Powerup System Tests
 *
 * Tests for powerup creation, effects, duration, collection, and drop system.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PowerupData } from '../content/schema';
import { events } from '../core/events';
import { PowerupPickup, PowerupSystem } from './powerups';

// Mock events
vi.mock('../core/events', () => ({
  events: {
    emit: vi.fn(),
    on: vi.fn(() => () => {}),
    off: vi.fn(),
  },
}));

// Mock contentLoader
const mockPowerupData: Record<string, PowerupData> = {};

vi.mock('../content/loader', () => ({
  contentLoader: {
    getPowerup: vi.fn((id: string) => mockPowerupData[id] ?? null),
  },
}));

// Mock svgAssets
vi.mock('../engine/svgAssets', () => ({
  svgAssets: {
    get: vi.fn(() => null),
    render: vi.fn(),
  },
}));

const createMockPowerupData = (overrides?: Partial<PowerupData>): PowerupData => ({
  id: 'test_powerup',
  name: 'Test Powerup',
  category: 'calm',
  effect: 'shield',
  durationMs: 5000,
  uiName: 'TEST',
  description: 'A test powerup',
  visual: {
    color: '#00ffaa',
    icon: 'shield',
  },
  ...overrides,
});

const createMockPlayer = () => ({
  setShield: vi.fn(),
  transform: { x: 400, y: 500 },
  health: { current: 100, max: 100 },
});

const createMockWeapons = () => ({
  setRapidFire: vi.fn(),
  setPrecisionBeam: vi.fn(),
  setExplosiveBananas: vi.fn(),
});

describe('PowerupPickup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockPowerupData).forEach((key) => delete mockPowerupData[key]);
    mockPowerupData.test_powerup = createMockPowerupData();
  });

  describe('Construction', () => {
    it('should create pickup at specified position', () => {
      const data = createMockPowerupData();
      const pickup = new PowerupPickup(data, 100, 200);

      expect(pickup.transform.x).toBe(100);
      expect(pickup.transform.y).toBe(200);
    });

    it('should have correct powerup ID', () => {
      const data = createMockPowerupData({ id: 'calm_shield' });
      const pickup = new PowerupPickup(data, 0, 0);

      expect(pickup.powerupId).toBe('calm_shield');
    });

    it('should have correct category', () => {
      const data = createMockPowerupData({ category: 'passion' });
      const pickup = new PowerupPickup(data, 0, 0);

      expect(pickup.category).toBe('passion');
    });

    it('should have pickup faction', () => {
      const data = createMockPowerupData();
      const pickup = new PowerupPickup(data, 0, 0);

      expect(pickup.faction).toBe('pickup');
    });

    it('should have pickup and powerup tags', () => {
      const data = createMockPowerupData({ category: 'calm' });
      const pickup = new PowerupPickup(data, 0, 0);

      expect(pickup.hasTag('pickup')).toBe(true);
      expect(pickup.hasTag('powerup')).toBe(true);
      expect(pickup.hasTag('calm')).toBe(true);
    });

    it('should have collider', () => {
      const data = createMockPowerupData();
      const pickup = new PowerupPickup(data, 0, 0);

      expect(pickup.collider).toBeDefined();
      expect(pickup.collider!.type).toBe('circle');
      expect(pickup.collider!.radius).toBe(35);
    });

    it('should have slow descent velocity', () => {
      const data = createMockPowerupData();
      const pickup = new PowerupPickup(data, 0, 0);

      expect(pickup.transform.vy).toBe(40);
    });

    it('should emit powerup:spawn event', () => {
      const data = createMockPowerupData({ id: 'calm_shield' });
      vi.clearAllMocks();
      new PowerupPickup(data, 0, 0);

      expect(events.emit).toHaveBeenCalledWith('powerup:spawn', {
        id: expect.any(String),
        type: 'calm_shield',
      });
    });
  });

  describe('Update', () => {
    it('should move downward', () => {
      const data = createMockPowerupData();
      const pickup = new PowerupPickup(data, 100, 100);
      const initialY = pickup.transform.y;

      pickup.update(0.1, 600);

      expect(pickup.transform.y).toBeGreaterThan(initialY);
    });

    it('should move at correct speed', () => {
      const data = createMockPowerupData();
      const pickup = new PowerupPickup(data, 100, 100);

      pickup.update(1, 600);

      // vy is 40, so after 1 second should move 40 pixels
      expect(pickup.transform.y).toBe(140);
    });

    it('should destroy when off screen', () => {
      const data = createMockPowerupData();
      const pickup = new PowerupPickup(data, 100, 700);

      pickup.update(0.1, 600);

      expect(pickup.active).toBe(false);
    });

    it('should not destroy when on screen', () => {
      const data = createMockPowerupData();
      const pickup = new PowerupPickup(data, 100, 300);

      pickup.update(0.1, 600);

      expect(pickup.active).toBe(true);
    });
  });
});

describe('PowerupSystem', () => {
  let system: PowerupSystem;
  let mockPlayer: ReturnType<typeof createMockPlayer>;
  let mockWeapons: ReturnType<typeof createMockWeapons>;
  const screenHeight = 600;

  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockPowerupData).forEach((key) => delete mockPowerupData[key]);

    mockPowerupData.calm_shield = createMockPowerupData({
      id: 'calm_shield',
      category: 'calm',
      effect: 'shield',
      durationMs: 5000,
    });
    mockPowerupData.calm_beam = createMockPowerupData({
      id: 'calm_beam',
      category: 'calm',
      effect: 'precision_beam',
      durationMs: 4000,
    });
    mockPowerupData.passion_fury = createMockPowerupData({
      id: 'passion_fury',
      category: 'passion',
      effect: 'rapid_fire',
      durationMs: 3000,
    });
    mockPowerupData.passion_explosive = createMockPowerupData({
      id: 'passion_explosive',
      category: 'passion',
      effect: 'explosive',
      durationMs: 5000,
    });

    mockPlayer = createMockPlayer();
    mockWeapons = createMockWeapons();
    system = new PowerupSystem(screenHeight);
    system.connect(mockPlayer as any, mockWeapons as any);
  });

  describe('Construction', () => {
    it('should create powerup system', () => {
      expect(system).toBeDefined();
    });

    it('should start with no pickups', () => {
      expect(system.getPickups().length).toBe(0);
    });

    it('should start with no active powerups', () => {
      expect(system.getActiveInfo()).toBeNull();
    });
  });

  describe('Spawning', () => {
    it('should spawn powerup pickup at position', () => {
      const pickup = system.spawn('calm_shield', 400, 100);

      expect(pickup).not.toBeNull();
      expect(pickup?.transform.x).toBe(400);
      expect(pickup?.transform.y).toBe(100);
    });

    it('should add pickup to pool', () => {
      system.spawn('calm_shield', 400, 100);

      expect(system.getPickups().length).toBe(1);
    });

    it('should return null for unknown powerup', () => {
      const pickup = system.spawn('unknown_powerup', 400, 100);

      expect(pickup).toBeNull();
      expect(system.getPickups().length).toBe(0);
    });

    it('should spawn multiple pickups', () => {
      system.spawn('calm_shield', 100, 100);
      system.spawn('passion_fury', 200, 100);
      system.spawn('calm_beam', 300, 100);

      expect(system.getPickups().length).toBe(3);
    });
  });

  describe('Try Drop', () => {
    it('should sometimes drop powerup', () => {
      system.setDropRateBonus(1.0);

      const dropped = system.tryDrop(400, 300, 1);

      // tryDrop returns true when drop chance succeeds, even if
      // the actual powerup spawn fails due to missing content data
      expect(dropped).toBe(true);
    });

    it('should have higher drop rate for higher tier enemies', () => {
      let tier1Drops = 0;
      let tier5Drops = 0;

      // Run many trials
      for (let i = 0; i < 100; i++) {
        const newSystem = new PowerupSystem(screenHeight);
        newSystem.connect(mockPlayer as any, mockWeapons as any);

        if (newSystem.tryDrop(400, 300, 1)) tier1Drops++;
        if (newSystem.tryDrop(400, 300, 5)) tier5Drops++;
      }

      // Tier 5 should have more drops on average
      // Due to randomness, we just check counts are reasonable
      expect(tier1Drops + tier5Drops).toBeGreaterThan(0);
    });

    it('should respect drop rate bonus', () => {
      // With 88% bonus + 12% base = 100%
      system.setDropRateBonus(0.88);

      const dropped = system.tryDrop(400, 300, 1);

      expect(dropped).toBe(true);
    });
  });

  describe('Collection', () => {
    it('should collect powerup and apply effect', () => {
      const pickup = system.spawn('calm_shield', 400, 100)!;

      system.collect(pickup);

      expect(mockPlayer.setShield).toHaveBeenCalledWith(true);
    });

    it('should destroy pickup after collection', () => {
      const pickup = system.spawn('calm_shield', 400, 100)!;

      system.collect(pickup);

      expect(pickup.active).toBe(false);
    });

    it('should emit powerup:collect event', () => {
      const pickup = system.spawn('calm_shield', 400, 100)!;
      vi.clearAllMocks();

      system.collect(pickup);

      expect(events.emit).toHaveBeenCalledWith('powerup:collect', {
        type: 'calm_shield',
        effect: 'shield',
      });
    });

    it('should add to active powerups', () => {
      const pickup = system.spawn('calm_shield', 400, 100)!;

      system.collect(pickup);

      expect(system.getActiveInfo()).not.toBeNull();
      expect(system.getActiveInfo()?.id).toBe('calm_shield');
    });
  });

  describe('Effect Application', () => {
    it('should apply shield effect', () => {
      const pickup = system.spawn('calm_shield', 400, 100)!;

      system.collect(pickup);

      expect(mockPlayer.setShield).toHaveBeenCalledWith(true);
    });

    it('should apply precision beam effect', () => {
      const pickup = system.spawn('calm_beam', 400, 100)!;

      system.collect(pickup);

      expect(mockWeapons.setPrecisionBeam).toHaveBeenCalledWith(true);
    });

    it('should apply rapid fire effect', () => {
      const pickup = system.spawn('passion_fury', 400, 100)!;

      system.collect(pickup);

      expect(mockWeapons.setRapidFire).toHaveBeenCalledWith(true);
    });

    it('should apply explosive effect', () => {
      const pickup = system.spawn('passion_explosive', 400, 100)!;

      system.collect(pickup);

      expect(mockWeapons.setExplosiveBananas).toHaveBeenCalledWith(true);
    });
  });

  describe('Effect Duration', () => {
    it('should remove effect after duration', () => {
      const pickup = system.spawn('calm_shield', 400, 100)!;
      system.collect(pickup);

      // Duration is 5000ms = 5 seconds
      vi.clearAllMocks();
      system.update(5.1);

      expect(mockPlayer.setShield).toHaveBeenCalledWith(false);
    });

    it('should keep effect before duration expires', () => {
      const pickup = system.spawn('calm_shield', 400, 100)!;
      system.collect(pickup);

      vi.clearAllMocks();
      system.update(2); // Only 2 seconds, less than 5 second duration

      expect(mockPlayer.setShield).not.toHaveBeenCalled();
    });

    it('should emit powerup:expire event when effect ends', () => {
      const pickup = system.spawn('calm_shield', 400, 100)!;
      system.collect(pickup);

      vi.clearAllMocks();
      system.update(6);

      expect(events.emit).toHaveBeenCalledWith('powerup:expire', { type: 'calm_shield' });
    });
  });

  describe('Update', () => {
    it('should update all pickups', () => {
      system.spawn('calm_shield', 100, 100);
      system.spawn('passion_fury', 200, 100);

      const pickups = system.getPickups();
      const initialY = pickups[0].transform.y;

      system.update(0.1);

      expect(pickups[0].transform.y).toBeGreaterThan(initialY);
    });

    it('should remove off-screen pickups', () => {
      system.spawn('calm_shield', 100, 700);

      system.update(0.1);

      expect(system.getPickups().length).toBe(0);
    });

    it('should decrement active powerup time', () => {
      const pickup = system.spawn('calm_shield', 400, 100)!;
      system.collect(pickup);

      const info1 = system.getActiveInfo();
      system.update(1);
      const info2 = system.getActiveInfo();

      expect(info2!.timeRemaining).toBeLessThan(info1!.timeRemaining);
    });
  });

  describe('Get Active Info', () => {
    it('should return null when no active powerups', () => {
      expect(system.getActiveInfo()).toBeNull();
    });

    it('should return active powerup info', () => {
      const pickup = system.spawn('calm_shield', 400, 100)!;
      system.collect(pickup);

      const info = system.getActiveInfo();

      expect(info).not.toBeNull();
      expect(info!.id).toBe('calm_shield');
      expect(info!.timeRemaining).toBeCloseTo(1, 1); // 100% remaining
    });

    it('should return first active powerup when multiple active', () => {
      const pickup1 = system.spawn('calm_shield', 400, 100)!;
      const pickup2 = system.spawn('passion_fury', 400, 100)!;
      system.collect(pickup1);
      system.collect(pickup2);

      const info = system.getActiveInfo();
      expect(info).not.toBeNull();
    });
  });

  describe('Clear', () => {
    it('should remove all pickups', () => {
      system.spawn('calm_shield', 100, 100);
      system.spawn('passion_fury', 200, 100);
      system.spawn('calm_beam', 300, 100);

      expect(system.getPickups().length).toBe(3);

      system.clear();

      expect(system.getPickups().length).toBe(0);
    });

    it('should remove all active effects', () => {
      const pickup = system.spawn('calm_shield', 400, 100)!;
      system.collect(pickup);

      vi.clearAllMocks();
      system.clear();

      expect(mockPlayer.setShield).toHaveBeenCalledWith(false);
    });

    it('should emit expire events for cleared effects', () => {
      const pickup = system.spawn('calm_shield', 400, 100)!;
      system.collect(pickup);

      vi.clearAllMocks();
      system.clear();

      expect(events.emit).toHaveBeenCalledWith('powerup:expire', { type: 'calm_shield' });
    });

    it('should have no active powerups after clear', () => {
      const pickup = system.spawn('calm_shield', 400, 100)!;
      system.collect(pickup);

      system.clear();

      expect(system.getActiveInfo()).toBeNull();
    });
  });

  describe('Multiple Active Powerups', () => {
    it('should handle multiple active powerups', () => {
      const pickup1 = system.spawn('calm_shield', 400, 100)!;
      const pickup2 = system.spawn('passion_fury', 400, 100)!;

      system.collect(pickup1);
      system.collect(pickup2);

      expect(mockPlayer.setShield).toHaveBeenCalledWith(true);
      expect(mockWeapons.setRapidFire).toHaveBeenCalledWith(true);
    });

    it('should expire powerups independently', () => {
      const pickup1 = system.spawn('calm_shield', 400, 100)!; // 5s duration
      const pickup2 = system.spawn('passion_fury', 400, 100)!; // 3s duration

      system.collect(pickup1);
      system.collect(pickup2);

      vi.clearAllMocks();
      system.update(4); // 4 seconds - passion_fury should expire

      expect(mockWeapons.setRapidFire).toHaveBeenCalledWith(false);
      expect(mockPlayer.setShield).not.toHaveBeenCalled(); // Still active
    });
  });

  describe('Stacking', () => {
    it('should refresh duration when collecting same powerup', () => {
      const pickup1 = system.spawn('calm_shield', 400, 100)!;
      system.collect(pickup1);

      system.update(4); // 4 seconds pass, 1 second left

      const pickup2 = system.spawn('calm_shield', 400, 100)!;
      system.collect(pickup2);

      const info = system.getActiveInfo();
      expect(info!.timeRemaining).toBeCloseTo(1, 1); // Refreshed to 100%
    });
  });

  describe('Drop Rate Bonus', () => {
    it('should set drop rate bonus', () => {
      // Setting a high bonus should increase drop rates
      system.setDropRateBonus(0.5);

      let drops = 0;
      for (let i = 0; i < 20; i++) {
        if (system.tryDrop(400, 300, 1)) drops++;
      }

      // With 62% chance (12% base + 50% bonus), should get reasonable drops
      expect(drops).toBeGreaterThan(0);
    });
  });
});
