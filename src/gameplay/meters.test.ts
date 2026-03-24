/**
 * Tests for Meta-Progression Meters System
 * TDD: Tests written FIRST before implementation
 *
 * 3 Meters:
 * - Noise: Screen chaos level (0-100), high noise spawns reactive enemies
 * - Focus: Earned by clean play (no damage), unlocks precision tools
 * - Stillness: Earned by calm survival, unlocks defensive miracles
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MetersSystem } from './meters';
import { createMetersSystem, MeterType } from './meters';

describe('Meters System', () => {
  describe('MeterType enum', () => {
    it('should have all three meter types', () => {
      expect(MeterType.NOISE).toBeDefined();
      expect(MeterType.FOCUS).toBeDefined();
      expect(MeterType.STILLNESS).toBeDefined();
    });
  });

  describe('createMetersSystem', () => {
    it('should create a meters system with default values', () => {
      const meters = createMetersSystem();
      expect(meters).toBeDefined();
      expect(meters.getNoise()).toBe(0);
      expect(meters.getFocus()).toBe(0);
      expect(meters.getStillness()).toBe(0);
    });

    it('should create a meters system with custom initial values', () => {
      const meters = createMetersSystem({ noise: 50, focus: 30, stillness: 20 });
      expect(meters.getNoise()).toBe(50);
      expect(meters.getFocus()).toBe(30);
      expect(meters.getStillness()).toBe(20);
    });
  });

  describe('MetersSystem', () => {
    let meters: MetersSystem;

    beforeEach(() => {
      meters = createMetersSystem();
    });

    describe('Basic Operations', () => {
      it('should get all meters', () => {
        const all = meters.getAll();
        expect(all).toEqual({ noise: 0, focus: 0, stillness: 0 });
      });

      it('should set meter values', () => {
        meters.setNoise(50);
        meters.setFocus(30);
        meters.setStillness(20);
        expect(meters.getNoise()).toBe(50);
        expect(meters.getFocus()).toBe(30);
        expect(meters.getStillness()).toBe(20);
      });

      it('should clamp values to 0-100 range', () => {
        meters.setNoise(150);
        expect(meters.getNoise()).toBe(100);

        meters.setFocus(-50);
        expect(meters.getFocus()).toBe(0);
      });

      it('should add to meter values', () => {
        meters.addNoise(30);
        meters.addFocus(20);
        meters.addStillness(10);
        expect(meters.getNoise()).toBe(30);
        expect(meters.getFocus()).toBe(20);
        expect(meters.getStillness()).toBe(10);
      });

      it('should subtract from meter values', () => {
        meters.setNoise(50);
        meters.addNoise(-20);
        expect(meters.getNoise()).toBe(30);
      });

      it('should reset all meters', () => {
        meters.setNoise(50);
        meters.setFocus(30);
        meters.setStillness(20);
        meters.reset();
        expect(meters.getAll()).toEqual({ noise: 0, focus: 0, stillness: 0 });
      });
    });

    describe('Noise Meter', () => {
      it('should increase with enemy spawns', () => {
        meters.onEnemySpawn(5); // 5 enemies spawned
        expect(meters.getNoise()).toBeGreaterThan(0);
      });

      it('should increase with projectiles on screen', () => {
        meters.onProjectilesUpdate(20); // 20 projectiles
        expect(meters.getNoise()).toBeGreaterThan(0);
      });

      it('should increase with player damage', () => {
        meters.onPlayerDamage(1);
        expect(meters.getNoise()).toBeGreaterThan(0);
      });

      it('should decrease over time when calm', () => {
        meters.setNoise(50);
        meters.update(1, { enemyCount: 0, projectileCount: 0, playerDamaged: false });
        expect(meters.getNoise()).toBeLessThan(50);
      });

      it('should trigger reactive enemy spawn at high noise', () => {
        const callback = vi.fn();
        meters.onNoiseThreshold(80, callback);
        meters.setNoise(85);
        expect(callback).toHaveBeenCalled();
      });

      it('should not trigger below threshold', () => {
        const callback = vi.fn();
        meters.onNoiseThreshold(80, callback);
        meters.setNoise(50);
        expect(callback).not.toHaveBeenCalled();
      });
    });

    describe('Focus Meter', () => {
      it('should increase with clean play (no damage)', () => {
        meters.update(5, { enemyCount: 10, projectileCount: 5, playerDamaged: false });
        expect(meters.getFocus()).toBeGreaterThan(0);
      });

      it('should not increase when player takes damage', () => {
        meters.update(5, { enemyCount: 10, projectileCount: 5, playerDamaged: true });
        expect(meters.getFocus()).toBe(0);
      });

      it('should reset on player damage', () => {
        meters.setFocus(50);
        meters.onPlayerDamage(1);
        expect(meters.getFocus()).toBe(0);
      });

      it('should increase faster with enemy kills', () => {
        meters.onEnemyKill();
        const focusAfterKill = meters.getFocus();
        expect(focusAfterKill).toBeGreaterThan(0);
      });

      it('should unlock precision tools at thresholds', () => {
        const callback = vi.fn();
        meters.onFocusThreshold(50, callback);
        meters.setFocus(55);
        expect(callback).toHaveBeenCalled();
      });

      it('should track focus streak', () => {
        meters.update(1, { enemyCount: 5, projectileCount: 0, playerDamaged: false });
        meters.update(1, { enemyCount: 5, projectileCount: 0, playerDamaged: false });
        meters.update(1, { enemyCount: 5, projectileCount: 0, playerDamaged: false });
        expect(meters.getFocusStreak()).toBe(3);
      });

      it('should reset focus streak on damage', () => {
        meters.update(3, { enemyCount: 5, projectileCount: 0, playerDamaged: false });
        meters.onPlayerDamage(1);
        expect(meters.getFocusStreak()).toBe(0);
      });
    });

    describe('Stillness Meter', () => {
      it('should increase with calm survival', () => {
        meters.update(5, { enemyCount: 5, projectileCount: 2, playerDamaged: false, playerMoving: false });
        expect(meters.getStillness()).toBeGreaterThan(0);
      });

      it('should increase slower when player is moving', () => {
        const metersStill = createMetersSystem();
        const metersMoving = createMetersSystem();

        metersStill.update(5, { enemyCount: 5, projectileCount: 2, playerDamaged: false, playerMoving: false });
        metersMoving.update(5, { enemyCount: 5, projectileCount: 2, playerDamaged: false, playerMoving: true });

        expect(metersStill.getStillness()).toBeGreaterThan(metersMoving.getStillness());
      });

      it('should decrease with panic actions', () => {
        meters.setStillness(50);
        meters.onPanicAction(); // Rapid movement, spam shooting
        expect(meters.getStillness()).toBeLessThan(50);
      });

      it('should unlock defensive miracles at thresholds', () => {
        const callback = vi.fn();
        meters.onStillnessThreshold(70, callback);
        meters.setStillness(75);
        expect(callback).toHaveBeenCalled();
      });

      it('should track stillness duration', () => {
        meters.update(5, { enemyCount: 5, projectileCount: 2, playerDamaged: false, playerMoving: false });
        expect(meters.getStillnessDuration()).toBe(5);
      });

      it('should reset stillness duration on panic', () => {
        meters.update(5, { enemyCount: 5, projectileCount: 2, playerDamaged: false, playerMoving: false });
        meters.onPanicAction();
        expect(meters.getStillnessDuration()).toBe(0);
      });
    });

    describe('Threshold Callbacks', () => {
      it('should support multiple thresholds per meter', () => {
        const callback1 = vi.fn();
        const callback2 = vi.fn();

        meters.onNoiseThreshold(50, callback1);
        meters.onNoiseThreshold(80, callback2);

        meters.setNoise(60);
        expect(callback1).toHaveBeenCalled();
        expect(callback2).not.toHaveBeenCalled();

        meters.setNoise(85);
        expect(callback2).toHaveBeenCalled();
      });

      it('should only trigger threshold once until reset', () => {
        const callback = vi.fn();
        meters.onNoiseThreshold(50, callback);

        meters.setNoise(60);
        meters.setNoise(70);
        meters.setNoise(80);

        expect(callback).toHaveBeenCalledTimes(1);
      });

      it('should re-trigger threshold after reset', () => {
        const callback = vi.fn();
        meters.onNoiseThreshold(50, callback);

        meters.setNoise(60);
        meters.reset();
        meters.setNoise(60);

        expect(callback).toHaveBeenCalledTimes(2);
      });

      it('should remove threshold callback', () => {
        const callback = vi.fn();
        const id = meters.onNoiseThreshold(50, callback);

        meters.removeThreshold(id);
        meters.setNoise(60);

        expect(callback).not.toHaveBeenCalled();
      });
    });

    describe('Rewards', () => {
      it('should return available rewards based on meter levels', () => {
        meters.setFocus(60);
        const rewards = meters.getAvailableRewards();
        expect(rewards.length).toBeGreaterThan(0);
        expect(rewards.some((r) => r.meter === MeterType.FOCUS)).toBe(true);
      });

      it('should return precision tools for focus', () => {
        meters.setFocus(50);
        const rewards = meters.getAvailableRewards();
        const focusRewards = rewards.filter((r) => r.meter === MeterType.FOCUS);
        expect(focusRewards.some((r) => r.type === 'precision_tool')).toBe(true);
      });

      it('should return defensive miracles for stillness', () => {
        meters.setStillness(70);
        const rewards = meters.getAvailableRewards();
        const stillnessRewards = rewards.filter((r) => r.meter === MeterType.STILLNESS);
        expect(stillnessRewards.some((r) => r.type === 'defensive_miracle')).toBe(true);
      });

      it('should return reactive enemies for high noise', () => {
        meters.setNoise(80);
        const rewards = meters.getAvailableRewards();
        const noiseRewards = rewards.filter((r) => r.meter === MeterType.NOISE);
        expect(noiseRewards.some((r) => r.type === 'reactive_enemy')).toBe(true);
      });

      it('should claim reward and mark as used', () => {
        meters.setFocus(50);
        const rewards = meters.getAvailableRewards();
        const reward = rewards[0];

        meters.claimReward(reward.id);

        const newRewards = meters.getAvailableRewards();
        expect(newRewards.find((r) => r.id === reward.id)).toBeUndefined();
      });
    });

    describe('Meter Interactions', () => {
      it('should have inverse relationship between noise and stillness', () => {
        meters.setNoise(80);
        meters.update(1, { enemyCount: 10, projectileCount: 20, playerDamaged: false, playerMoving: false });
        // High noise should make it harder to gain stillness
        expect(meters.getStillness()).toBeLessThan(10);
      });

      it('should have synergy between focus and stillness', () => {
        meters.setFocus(50);
        meters.update(1, { enemyCount: 5, projectileCount: 2, playerDamaged: false, playerMoving: false });
        // High focus should boost stillness gain
        const stillnessWithFocus = meters.getStillness();

        const meters2 = createMetersSystem();
        meters2.update(1, { enemyCount: 5, projectileCount: 2, playerDamaged: false, playerMoving: false });

        expect(stillnessWithFocus).toBeGreaterThan(meters2.getStillness());
      });
    });

    describe('Persistence', () => {
      it('should serialize to JSON', () => {
        meters.setNoise(50);
        meters.setFocus(30);
        meters.setStillness(20);

        const json = meters.toJSON();
        expect(json).toEqual({
          noise: 50,
          focus: 30,
          stillness: 20,
          focusStreak: 0,
          stillnessDuration: 0,
        });
      });

      it('should deserialize from JSON', () => {
        const json = {
          noise: 50,
          focus: 30,
          stillness: 20,
          focusStreak: 5,
          stillnessDuration: 10,
        };

        meters.fromJSON(json);

        expect(meters.getNoise()).toBe(50);
        expect(meters.getFocus()).toBe(30);
        expect(meters.getStillness()).toBe(20);
        expect(meters.getFocusStreak()).toBe(5);
        expect(meters.getStillnessDuration()).toBe(10);
      });
    });

    describe('Events', () => {
      it('should emit event when noise reaches critical level', () => {
        const callback = vi.fn();
        meters.on('noise:critical', callback);
        meters.setNoise(90);
        expect(callback).toHaveBeenCalledWith({ level: 90 });
      });

      it('should emit event when focus milestone reached', () => {
        const callback = vi.fn();
        meters.on('focus:milestone', callback);
        meters.setFocus(50);
        // When jumping from 0 to 50, the first milestone (25) is crossed
        expect(callback).toHaveBeenCalledWith({ level: 50, milestone: 25 });
      });

      it('should emit event when stillness milestone reached', () => {
        const callback = vi.fn();
        meters.on('stillness:milestone', callback);
        meters.setStillness(70);
        // When jumping from 0 to 70, the first milestone (30) is crossed
        expect(callback).toHaveBeenCalledWith({ level: 70, milestone: 30 });
      });
    });
  });
});
