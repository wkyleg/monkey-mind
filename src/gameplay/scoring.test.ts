import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../core/events', () => ({
  events: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
}));

import { events } from '../core/events';
import { ScoringSystem } from './scoring';

describe('ScoringSystem', () => {
  beforeEach(() => {
    vi.mocked(events.emit).mockClear();
  });

  describe('construction', () => {
    it('initial state is zeroed with default multipliers', () => {
      const scoring = new ScoringSystem();

      expect(scoring.getScore()).toBe(0);
      expect(scoring.getCombo()).toBe(0);
      expect(scoring.getState()).toEqual({
        score: 0,
        combo: 0,
        maxCombo: 0,
        multiplier: 1,
      });
    });
  });

  describe('addScore', () => {
    it('adds floored score for different base amounts with default multipliers', () => {
      const scoring = new ScoringSystem();

      expect(scoring.addScore(10)).toBe(10);
      expect(scoring.addScore(7)).toBe(7);
      expect(scoring.addScore(0)).toBe(0);
      expect(scoring.getScore()).toBe(17);
    });

    it('passes reason through to score:add event', () => {
      const scoring = new ScoringSystem();
      scoring.addScore(5, 'pickup');

      expect(events.emit).toHaveBeenCalledWith('score:add', { amount: 5, reason: 'pickup' });
    });
  });

  describe('combo', () => {
    it('incrementCombo raises combo and resets combo timer', () => {
      const scoring = new ScoringSystem();

      scoring.incrementCombo();
      expect(scoring.getCombo()).toBe(1);
      scoring.incrementCombo();
      expect(scoring.getCombo()).toBe(2);
    });

    it('breakCombo resets combo to 0', () => {
      const scoring = new ScoringSystem();
      scoring.incrementCombo();
      scoring.incrementCombo();
      scoring.breakCombo();

      expect(scoring.getCombo()).toBe(0);
    });

    it('maxCombo tracks the highest combo reached', () => {
      const scoring = new ScoringSystem();

      scoring.incrementCombo();
      scoring.incrementCombo();
      scoring.incrementCombo();
      expect(scoring.getState().maxCombo).toBe(3);

      scoring.breakCombo();
      expect(scoring.getCombo()).toBe(0);
      expect(scoring.getState().maxCombo).toBe(3);

      scoring.incrementCombo();
      expect(scoring.getState().maxCombo).toBe(3);

      scoring.incrementCombo();
      scoring.incrementCombo();
      scoring.incrementCombo();
      expect(scoring.getState().maxCombo).toBe(4);
    });
  });

  describe('score multiplier from combo', () => {
    it('uses combo multiplier 1 + combo * 0.1 for addScore and getState', () => {
      const scoring = new ScoringSystem();

      // combo 0 -> 1.0
      expect(scoring.addScore(100)).toBe(100);
      expect(scoring.getState().multiplier).toBe(1);

      scoring.incrementCombo(); // combo 1 -> 1.1
      expect(scoring.getState().multiplier).toBeCloseTo(1.1, 5);
      expect(scoring.addScore(100)).toBe(110);

      scoring.incrementCombo(); // combo 2 -> 1.2
      expect(scoring.getState().multiplier).toBeCloseTo(1.2, 5);
      expect(scoring.addScore(100)).toBe(120);

      expect(scoring.getScore()).toBe(330);
    });
  });

  describe('update', () => {
    it('decrements combo timer and breaks combo when timer reaches 0 (comboTimeout = 2s)', () => {
      const scoring = new ScoringSystem();
      scoring.incrementCombo();
      expect(scoring.getCombo()).toBe(1);

      scoring.update(1);
      expect(scoring.getCombo()).toBe(1);

      scoring.update(1);
      expect(scoring.getCombo()).toBe(0);
    });

    it('does not break combo when timer still positive', () => {
      const scoring = new ScoringSystem();
      scoring.incrementCombo();
      scoring.update(1.99);

      expect(scoring.getCombo()).toBe(1);
    });
  });

  describe('setDifficultyMultiplier and setBaseMultiplier', () => {
    it('affect score and reported multiplier in getState', () => {
      const scoring = new ScoringSystem();
      scoring.setBaseMultiplier(2);
      scoring.setDifficultyMultiplier(1.5);

      // 10 * 2 * 1.5 * 1 (combo 0) = 30
      expect(scoring.addScore(10)).toBe(30);
      expect(scoring.getState().multiplier).toBe(3);

      scoring.incrementCombo(); // combo mult 1.1
      // 10 * 2 * 1.5 * 1.1 = 33
      expect(scoring.addScore(10)).toBe(33);
      expect(scoring.getState().multiplier).toBeCloseTo(3.3, 5);
    });
  });

  describe('reset', () => {
    it('clears score, combo, maxCombo, timers, and multipliers', () => {
      const scoring = new ScoringSystem();
      scoring.setBaseMultiplier(2);
      scoring.setDifficultyMultiplier(2);
      scoring.incrementCombo();
      scoring.incrementCombo();
      scoring.addScore(50);
      scoring.update(0.5);

      scoring.reset();

      expect(scoring.getState()).toEqual({
        score: 0,
        combo: 0,
        maxCombo: 0,
        multiplier: 1,
      });
      expect(scoring.getScore()).toBe(0);
      expect(scoring.getCombo()).toBe(0);

      expect(scoring.addScore(10)).toBe(10);
    });
  });

  describe('events', () => {
    it('emits score:add with amount and reason', () => {
      const scoring = new ScoringSystem();
      scoring.addScore(42, 'enemy');

      expect(events.emit).toHaveBeenCalledWith('score:add', { amount: 42, reason: 'enemy' });
    });

    it('emits combo:increase with count on incrementCombo', () => {
      const scoring = new ScoringSystem();
      scoring.incrementCombo();
      scoring.incrementCombo();

      expect(events.emit).toHaveBeenCalledWith('combo:increase', { count: 1 });
      expect(events.emit).toHaveBeenCalledWith('combo:increase', { count: 2 });
    });

    it('emits combo:break with finalCount when combo was > 0', () => {
      const scoring = new ScoringSystem();
      scoring.incrementCombo();
      scoring.incrementCombo();
      vi.mocked(events.emit).mockClear();

      scoring.breakCombo();

      expect(events.emit).toHaveBeenCalledTimes(1);
      expect(events.emit).toHaveBeenCalledWith('combo:break', { finalCount: 2 });
    });

    it('does not emit combo:break when combo is already 0', () => {
      const scoring = new ScoringSystem();
      scoring.breakCombo();

      expect(events.emit).not.toHaveBeenCalledWith('combo:break', expect.anything());
    });

    it('emits combo:break when combo expires via update', () => {
      const scoring = new ScoringSystem();
      scoring.incrementCombo();
      vi.mocked(events.emit).mockClear();

      scoring.update(2);

      expect(events.emit).toHaveBeenCalledWith('combo:break', { finalCount: 1 });
    });
  });
});
