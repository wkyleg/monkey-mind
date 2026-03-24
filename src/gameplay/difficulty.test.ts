import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config', () => ({
  CONFIG: {
    DIFFICULTY_RAMP_TIME: 120,
    MAX_SPAWN_INTERVAL: 3,
    MIN_SPAWN_INTERVAL: 0.5,
  },
}));

vi.mock('../util/math', () => ({
  clamp: (val: number, min: number, max: number) => Math.min(Math.max(val, min), max),
  lerp: (a: number, b: number, t: number) => a + (b - a) * t,
}));

import { DifficultySystem } from './difficulty';

describe('DifficultySystem', () => {
  let system: DifficultySystem;

  beforeEach(() => {
    system = new DifficultySystem();
  });

  describe('construction', () => {
    it('has reasonable defaults: level ~1 and tension 0.5', () => {
      const state = system.getState();
      expect(state.level).toBeCloseTo(1, 5);
      expect(state.tension).toBe(0.5);
    });
  });

  describe('setBaseDifficulty', () => {
    it('affects getState().level (scaled by time progression)', () => {
      system.setBaseDifficulty(2);
      expect(system.getState().level).toBeCloseTo(2, 5);

      system.update(60);
      const halfRamp = Math.min(1, 60 / 120);
      const timeDifficulty = 1 + halfRamp * 3;
      expect(system.getState().level).toBeCloseTo(2 * timeDifficulty, 5);
    });
  });

  describe('recordHit / recordMiss', () => {
    it('tracking hits vs misses changes adaptive outcome after update', () => {
      const mostlyHits = new DifficultySystem();
      for (let i = 0; i < 20; i++) mostlyHits.recordHit();
      mostlyHits.update(1);

      const halfHalf = new DifficultySystem();
      for (let i = 0; i < 10; i++) halfHalf.recordHit();
      for (let i = 0; i < 10; i++) halfHalf.recordMiss();
      halfHalf.update(1);

      expect(mostlyHits.getState().speedMultiplier).not.toBeCloseTo(halfHalf.getState().speedMultiplier, 4);
    });

    it('recordHit with reaction time influences stress path via average reaction', () => {
      const fast = new DifficultySystem();
      fast.recordHit(0.2);
      fast.update(1);

      const slow = new DifficultySystem();
      slow.recordHit(0.9);
      slow.update(1);

      expect(fast.getTension()).not.toBe(slow.getTension());
    });
  });

  describe('update', () => {
    it('changes performance-driven state over time', () => {
      const before = system.getState().speedMultiplier;
      system.recordHit();
      system.update(2);
      const after = system.getState().speedMultiplier;
      expect(after).not.toBe(before);
    });
  });

  describe('time ramp', () => {
    it('increases effective level as playTime advances toward ramp', () => {
      const a = system.getState().level;
      system.update(120);
      const b = system.getState().level;
      expect(b).toBeGreaterThan(a);
      expect(b).toBeCloseTo(4, 5);
    });
  });

  describe('getSpawnInterval', () => {
    it('returns values within CONFIG min and max spawn interval', () => {
      for (let t = 0; t <= 120; t += 15) {
        const s = new DifficultySystem();
        s.update(t);
        const interval = s.getSpawnInterval();
        expect(interval).toBeGreaterThanOrEqual(0.5);
        expect(interval).toBeLessThanOrEqual(3);
      }
    });
  });

  describe('getTension', () => {
    it('matches player stress used in getState().tension', () => {
      expect(system.getTension()).toBe(system.getState().tension);
      system.update(0.5);
      expect(system.getTension()).toBe(system.getState().tension);
    });
  });

  describe('reset', () => {
    it('restores defaults after mutations', () => {
      system.setBaseDifficulty(5);
      system.recordHit(0.4);
      system.recordMiss();
      system.update(30);

      const dirty = system.getState();
      expect(dirty.level).not.toBeCloseTo(1, 2);

      system.reset();

      const clean = system.getState();
      expect(clean.level).toBeCloseTo(1, 5);
      expect(clean.tension).toBe(0.5);
      expect(system.getTension()).toBe(0.5);
      expect(system.getSpeedMultiplier()).toBe(clean.speedMultiplier);

      system.setBaseDifficulty(2);
      system.update(10);
      expect(system.getState().level).toBeGreaterThan(1);
    });
  });

  describe('getSpeedMultiplier', () => {
    it('matches getState().speedMultiplier', () => {
      expect(system.getSpeedMultiplier()).toBe(system.getState().speedMultiplier);
    });
  });
});
