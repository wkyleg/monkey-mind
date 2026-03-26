/**
 * Weapons System Tests
 *
 * Tests for projectile creation, movement, and damage systems.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CONFIG } from '../config';
import { events } from '../core/events';
import { Banana, Beam, WeaponSystem } from './weapons';

// Mock events
vi.mock('../core/events', () => ({
  events: {
    emit: vi.fn(),
    on: vi.fn(() => () => {}),
    off: vi.fn(),
  },
}));

describe('Banana Projectile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Construction', () => {
    it('should create banana at specified position', () => {
      const banana = new Banana({ x: 100, y: 200 });

      expect(banana.transform.x).toBe(100);
      expect(banana.transform.y).toBe(200);
    });

    it('should have default speed', () => {
      const banana = new Banana({ x: 0, y: 0 });

      expect(banana.transform.vy).toBe(-CONFIG.BANANA_SPEED);
    });

    it('should accept custom speed', () => {
      const banana = new Banana({ x: 0, y: 0, speed: 500 });

      expect(banana.transform.vy).toBe(-500);
    });

    it('should have default damage of 1', () => {
      const banana = new Banana({ x: 0, y: 0 });

      expect(banana.damage).toBe(1);
    });

    it('should accept custom damage', () => {
      const banana = new Banana({ x: 0, y: 0, damage: 5 });

      expect(banana.damage).toBe(5);
    });

    it('should have projectile faction', () => {
      const banana = new Banana({ x: 0, y: 0 });

      expect(banana.faction).toBe('projectile');
    });

    it('should have banana and projectile tags', () => {
      const banana = new Banana({ x: 0, y: 0 });

      expect(banana.hasTag('projectile')).toBe(true);
      expect(banana.hasTag('banana')).toBe(true);
    });

    it('should have collider', () => {
      const banana = new Banana({ x: 0, y: 0 });

      expect(banana.collider).toBeDefined();
      expect(banana.collider!.type).toBe('circle');
    });

    it('should emit projectile:fire event', () => {
      new Banana({ x: 0, y: 0 });

      expect(events.emit).toHaveBeenCalledWith('projectile:fire', { type: 'banana' });
    });
  });

  describe('Update', () => {
    it('should move upward over time', () => {
      const banana = new Banana({ x: 100, y: 500 });
      const initialY = banana.transform.y;

      banana.update(1 / 60);

      expect(banana.transform.y).toBeLessThan(initialY);
    });

    it('should rotate over time', () => {
      const banana = new Banana({ x: 0, y: 0 });
      const initialRotation = banana.transform.rotation;

      banana.update(0.5);

      expect(banana.transform.rotation).not.toBe(initialRotation);
    });

    it('should destroy when off screen', () => {
      const banana = new Banana({ x: 0, y: 0 });

      // Move above screen
      banana.transform.y = -100;
      banana.update(0.1);

      expect(banana.active).toBe(false);
    });
  });

  describe('Hit Handling', () => {
    it('should destroy normal banana on hit', () => {
      const banana = new Banana({ x: 0, y: 0 });

      banana.onHit();

      expect(banana.active).toBe(false);
      expect(events.emit).toHaveBeenCalledWith('projectile:hit', { targetType: 'enemy' });
    });

    it('should not destroy explosive banana on hit', () => {
      const banana = new Banana({ x: 0, y: 0, type: 'explosive' });

      banana.onHit();

      expect(banana.active).toBe(true);
    });
  });

  describe('Explosive Banana', () => {
    it('should have explosive flag', () => {
      const banana = new Banana({ x: 0, y: 0, type: 'explosive' });

      expect(banana.hasTag('banana')).toBe(true);
    });

    it('should have higher default damage for explosive', () => {
      const explosive = new Banana({ x: 0, y: 0, type: 'explosive', damage: 2 });

      expect(explosive.damage).toBe(2);
    });
  });
});

describe('Beam Projectile', () => {
  describe('Construction', () => {
    it('should create beam at position', () => {
      const beam = new Beam(100, 500, 600);

      expect(beam.transform.x).toBe(100);
      expect(beam.transform.y).toBe(500);
    });

    it('should have projectile faction', () => {
      const beam = new Beam(0, 0, 600);

      expect(beam.faction).toBe('projectile');
    });

    it('should have beam tag', () => {
      const beam = new Beam(0, 0, 600);

      expect(beam.hasTag('beam')).toBe(true);
    });

    it('should have AABB collider', () => {
      const beam = new Beam(0, 0, 600);

      expect(beam.collider).toBeDefined();
      expect(beam.collider!.type).toBe('aabb');
    });
  });

  describe('Update', () => {
    it('should destroy after lifetime expires', () => {
      const beam = new Beam(0, 0, 600);

      // Update past lifetime
      beam.update(0.4);

      expect(beam.active).toBe(false);
    });

    it('should remain active during lifetime', () => {
      const beam = new Beam(0, 0, 600);

      beam.update(0.1);

      expect(beam.active).toBe(true);
    });
  });

  describe('Hit Tracking', () => {
    it('should track hit enemies', () => {
      const beam = new Beam(0, 0, 600);

      expect(beam.hasHitEnemy(1)).toBe(false);

      beam.markEnemyHit(1);
      expect(beam.hasHitEnemy(1)).toBe(true);
      expect(beam.hasHitEnemy(2)).toBe(false);
    });

    it('should track multiple enemies', () => {
      const beam = new Beam(0, 0, 600);

      beam.markEnemyHit(1);
      beam.markEnemyHit(2);
      beam.markEnemyHit(3);

      expect(beam.hasHitEnemy(1)).toBe(true);
      expect(beam.hasHitEnemy(2)).toBe(true);
      expect(beam.hasHitEnemy(3)).toBe(true);
    });
  });
});

describe('WeaponSystem', () => {
  let weapons: WeaponSystem;

  beforeEach(() => {
    vi.clearAllMocks();
    weapons = new WeaponSystem(600); // Only takes screen height
  });

  describe('Construction', () => {
    it('should start with empty projectiles', () => {
      expect(weapons.getProjectiles().length).toBe(0);
    });

    it('should not have powerups active initially', () => {
      expect(weapons.hasPrecisionBeam()).toBe(false);
      expect(weapons.hasExplosiveBananas()).toBe(false);
      expect(weapons.hasRapidFire()).toBe(false);
    });
  });

  describe('Firing', () => {
    it('should create banana projectile', () => {
      weapons.fire(400, 500);

      const projectiles = weapons.getProjectiles();
      expect(projectiles.length).toBe(1);
    });

    it('should create beam when precision beam active', () => {
      weapons.setPrecisionBeam(true);
      weapons.fire(400, 500);

      const projectiles = weapons.getProjectiles();
      expect(projectiles.length).toBe(1);
      expect(projectiles[0].hasTag('beam')).toBe(true);
    });

    it('should create explosive banana when enabled', () => {
      weapons.setExplosiveBananas(true);
      weapons.fire(400, 500);

      // Verify event was emitted with explosive type
      expect(events.emit).toHaveBeenCalledWith('projectile:fire', { type: 'explosive' });
    });
  });

  describe('Powerups', () => {
    it('should toggle precision beam', () => {
      expect(weapons.hasPrecisionBeam()).toBe(false);

      weapons.setPrecisionBeam(true);
      expect(weapons.hasPrecisionBeam()).toBe(true);

      weapons.setPrecisionBeam(false);
      expect(weapons.hasPrecisionBeam()).toBe(false);
    });

    it('should toggle explosive bananas', () => {
      weapons.setExplosiveBananas(true);
      expect(weapons.hasExplosiveBananas()).toBe(true);
    });

    it('should toggle rapid fire', () => {
      weapons.setRapidFire(true);
      expect(weapons.hasRapidFire()).toBe(true);
    });

    it('rapid fire should affect fire rate modifier', () => {
      expect(weapons.getFireRateModifier()).toBe(1);

      // Rapid fire triggers spray mode (0.4) × rapid fire powerup (0.5) = 0.2
      weapons.setRapidFire(true);
      expect(weapons.getFireRateModifier()).toBe(0.2);
    });
  });

  describe('Damage Multiplier', () => {
    it('should start with default multiplier', () => {
      expect(weapons.getDamageMultiplier()).toBe(1);
    });

    it('should update damage multiplier', () => {
      weapons.setDamageMultiplier(1.5);
      expect(weapons.getDamageMultiplier()).toBe(1.5);
    });

    it('should apply damage multiplier to projectiles', () => {
      weapons.setDamageMultiplier(2);
      weapons.fire(400, 500);

      const projectiles = weapons.getProjectiles();
      const banana = projectiles[0] as Banana;
      expect(banana.damage).toBe(2);
    });
  });

  describe('Fire Rate Multiplier', () => {
    it('should start with default multiplier', () => {
      expect(weapons.getFireRateMultiplier()).toBe(1);
    });

    it('should update fire rate multiplier', () => {
      weapons.setFireRateMultiplier(0.8);
      expect(weapons.getFireRateMultiplier()).toBe(0.8);
    });

    it('should combine with rapid fire', () => {
      weapons.setRapidFire(true);
      weapons.setFireRateMultiplier(0.8);

      // spray mode (0.4) × rapid fire (0.5) × fire rate multiplier (0.8) = 0.16
      expect(weapons.getFireRateModifier()).toBeCloseTo(0.16);
    });
  });

  describe('Update', () => {
    it('should update all projectiles', () => {
      weapons.fire(400, 500);
      weapons.fire(300, 500);

      const initialY = weapons.getProjectiles()[0].transform.y;
      weapons.update(1 / 60);

      // Projectiles should have moved
      expect(weapons.getProjectiles()[0].transform.y).not.toBe(initialY);
    });

    it('should remove destroyed projectiles', () => {
      weapons.fire(400, 0);

      // Move projectile off screen
      const projectile = weapons.getProjectiles()[0];
      projectile.transform.y = -100;

      weapons.update(0.1);

      // After cleanup, should be empty
      expect(weapons.getProjectiles().length).toBe(0);
    });
  });

  describe('Clear', () => {
    it('should remove all projectiles', () => {
      weapons.fire(100, 500);
      weapons.fire(200, 500);
      weapons.fire(300, 500);

      expect(weapons.getProjectiles().length).toBe(3);

      weapons.clear();

      expect(weapons.getProjectiles().length).toBe(0);
    });

    it('should reset powerups', () => {
      weapons.setPrecisionBeam(true);
      weapons.setExplosiveBananas(true);
      weapons.setRapidFire(true);

      weapons.clear();

      expect(weapons.hasPrecisionBeam()).toBe(false);
      expect(weapons.hasExplosiveBananas()).toBe(false);
      expect(weapons.hasRapidFire()).toBe(false);
    });
  });

  describe('Neuro Weapon Modes', () => {
    it('should default to balanced mode', () => {
      expect(weapons.getWeaponMode()).toBe('balanced');
    });

    it('should switch to beam mode on high calm', () => {
      weapons.setNeuroState(0.8, 0.3);
      weapons.update(1);
      expect(weapons.getWeaponMode()).toBe('beam');
    });

    it('should switch to spray mode on high arousal', () => {
      weapons.setNeuroState(0.3, 0.8);
      weapons.update(1);
      expect(weapons.getWeaponMode()).toBe('spray');
    });

    it('should switch to flow mode when both calm and arousal are high', () => {
      weapons.setNeuroState(0.7, 0.7);
      weapons.update(1);
      expect(weapons.getWeaponMode()).toBe('flow');
    });

    it('should remain balanced when both signals are moderate', () => {
      weapons.setNeuroState(0.5, 0.5);
      weapons.update(1);
      expect(weapons.getWeaponMode()).toBe('balanced');
    });

    it('should fire beam projectile in beam mode', () => {
      weapons.setNeuroState(0.8, 0.3);
      weapons.update(1);
      weapons.fire(400, 500);

      const projectiles = weapons.getProjectiles();
      expect(projectiles.length).toBe(1);
      expect(projectiles[0].hasTag('beam')).toBe(true);
    });

    it('should fire spread projectiles in spray mode', () => {
      weapons.setNeuroState(0.3, 0.8);
      weapons.update(1);
      weapons.fire(400, 500);

      const projectiles = weapons.getProjectiles();
      expect(projectiles.length).toBe(3);
    });

    it('should fire homing projectile in flow mode', () => {
      weapons.setNeuroState(0.7, 0.7);
      weapons.update(1);
      weapons.setEnemyPositions([{ x: 300, y: 200 }]);
      weapons.fire(400, 500);

      const projectiles = weapons.getProjectiles();
      expect(projectiles.length).toBe(1);
      expect((projectiles[0] as any)._homing).toBe(true);
    });

    it('should return slower fire rate for beam mode', () => {
      weapons.setNeuroState(0.8, 0.3);
      weapons.update(1);
      expect(weapons.getFireRateModifier()).toBe(2.5);
    });

    it('should return faster fire rate for spray mode', () => {
      weapons.setNeuroState(0.3, 0.8);
      weapons.update(1);
      expect(weapons.getFireRateModifier()).toBe(0.4);
    });

    it('should return slightly faster fire rate for flow mode', () => {
      weapons.setNeuroState(0.7, 0.7);
      weapons.update(1);
      expect(weapons.getFireRateModifier()).toBe(0.8);
    });

    it('powerup modes should override neuro modes', () => {
      weapons.setNeuroState(0.8, 0.3); // would be beam
      weapons.update(1);
      weapons.setPrecisionBeam(true);
      expect(weapons.getWeaponMode()).toBe('beam');

      weapons.setPrecisionBeam(false);
      weapons.setRapidFire(true);
      expect(weapons.getWeaponMode()).toBe('spray');
    });

    it('should accept enemy positions for flow mode homing', () => {
      const positions = [
        { x: 100, y: 200 },
        { x: 300, y: 100 },
      ];
      expect(() => weapons.setEnemyPositions(positions)).not.toThrow();
    });
  });
});
