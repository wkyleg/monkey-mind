/**
 * Tests for Meta-Progression Meters System — Raw SDK Metrics
 *
 * 5 Meters: CALM, AROUSAL, ALPHA, BETA, THETA
 * Driven directly from neuro SDK state with no derivation.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MetersSystem } from './meters';
import { createMetersSystem, MeterType } from './meters';

describe('Meters System', () => {
  describe('MeterType enum', () => {
    it('should have all five raw SDK meter types', () => {
      expect(MeterType.CALM).toBeDefined();
      expect(MeterType.AROUSAL).toBeDefined();
      expect(MeterType.ALPHA).toBeDefined();
      expect(MeterType.BETA).toBeDefined();
      expect(MeterType.THETA).toBeDefined();
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
  });

  describe('MetersSystem', () => {
    let meters: MetersSystem;

    beforeEach(() => {
      meters = createMetersSystem();
    });

    describe('Basic Operations', () => {
      it('should get all meters (legacy compat)', () => {
        const all = meters.getAll();
        expect(all).toEqual({ noise: 0, focus: 0, stillness: 0 });
      });

      it('should set meter values via legacy setters', () => {
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

    describe('Raw SDK update()', () => {
      it('should store calm directly from neuro state', () => {
        meters.update(1, { enemyCount: 0, projectileCount: 0, playerDamaged: false, calm: 0.75 });
        expect(meters.getCalm()).toBe(75);
      });

      it('should store arousal directly from neuro state', () => {
        meters.update(1, { enemyCount: 0, projectileCount: 0, playerDamaged: false, arousal: 0.6 });
        expect(meters.getArousal()).toBe(60);
      });

      it('should store alpha/beta/theta when provided', () => {
        meters.update(1, {
          enemyCount: 0,
          projectileCount: 0,
          playerDamaged: false,
          alpha: 0.34,
          beta: 0.18,
          theta: 0.52,
        });
        expect(meters.getAlpha()).toBe(34);
        expect(meters.getBeta()).toBe(18);
        expect(meters.getTheta()).toBe(52);
      });

      it('should default missing values to 0', () => {
        meters.update(1, { enemyCount: 0, projectileCount: 0, playerDamaged: false });
        expect(meters.getCalm()).toBe(0);
        expect(meters.getArousal()).toBe(0);
        expect(meters.getAlpha()).toBe(0);
      });
    });

    describe('Focus streak', () => {
      it('should track focus streak when not damaged', () => {
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

    describe('Stillness duration', () => {
      it('should track stillness duration when not moving', () => {
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
        expect(rewards.some((r) => r.meter === MeterType.CALM)).toBe(true);
      });

      it('should return defensive miracles for calm', () => {
        meters.setFocus(50);
        const rewards = meters.getAvailableRewards();
        const calmRewards = rewards.filter((r) => r.meter === MeterType.CALM);
        expect(calmRewards.some((r) => r.type === 'defensive_miracle')).toBe(true);
      });

      it('should return reactive enemies for high arousal', () => {
        meters.setNoise(80);
        const rewards = meters.getAvailableRewards();
        const arousalRewards = rewards.filter((r) => r.meter === MeterType.AROUSAL);
        expect(arousalRewards.some((r) => r.type === 'reactive_enemy')).toBe(true);
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

    describe('Persistence', () => {
      it('should serialize to JSON', () => {
        meters.setNoise(50);
        meters.setFocus(30);
        meters.setStillness(20);

        const json = meters.toJSON();
        expect(json.arousal).toBe(50);
        expect(json.calm).toBe(30);
        expect(json.alpha).toBe(20);
        expect(json.noise).toBe(50);
        expect(json.focus).toBe(30);
        expect(json.stillness).toBe(20);
      });

      it('should deserialize from JSON', () => {
        const json = {
          calm: 30,
          arousal: 50,
          alpha: 20,
          beta: 10,
          theta: 5,
          noise: 50,
          focus: 30,
          stillness: 20,
          focusStreak: 5,
          stillnessDuration: 10,
        };

        meters.fromJSON(json);

        expect(meters.getCalm()).toBe(30);
        expect(meters.getArousal()).toBe(50);
        expect(meters.getAlpha()).toBe(20);
        expect(meters.getFocusStreak()).toBe(5);
        expect(meters.getStillnessDuration()).toBe(10);
      });
    });

    describe('Events', () => {
      it('should emit milestone event on threshold cross', () => {
        const callback = vi.fn();
        meters.on('calm:milestone', callback);
        meters.onFocusThreshold(25, () => {});
        meters.setFocus(30);
        expect(callback).toHaveBeenCalled();
      });
    });
  });
});
