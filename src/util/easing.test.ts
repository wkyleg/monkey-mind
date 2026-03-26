/**
 * Easing functions tests
 */

import { describe, expect, it } from 'vitest';
import { easing } from './easing';

const EPS = 1e-6;

describe('easing', () => {
  const names = Object.keys(easing) as (keyof typeof easing)[];

  describe('endpoints [0, 1]', () => {
    it.each(names)('%s returns 0 at t=0', (name) => {
      expect(easing[name](0)).toBeCloseTo(0, 10);
    });

    it.each(names)('%s returns 1 at t=1', (name) => {
      expect(easing[name](1)).toBeCloseTo(1, 10);
    });
  });

  describe('known midpoint values (t=0.5)', () => {
    it('linear', () => {
      expect(easing.linear(0.5)).toBeCloseTo(0.5);
    });

    it('quadratic', () => {
      expect(easing.easeInQuad(0.5)).toBeCloseTo(0.25);
      expect(easing.easeOutQuad(0.5)).toBeCloseTo(0.75);
      expect(easing.easeInOutQuad(0.5)).toBeCloseTo(0.5);
    });

    it('cubic', () => {
      expect(easing.easeInCubic(0.5)).toBeCloseTo(0.125);
      expect(easing.easeOutCubic(0.5)).toBeCloseTo(0.875);
      expect(easing.easeInOutCubic(0.5)).toBeCloseTo(0.5);
    });

    it('quartic', () => {
      expect(easing.easeInQuart(0.5)).toBeCloseTo(0.0625);
      expect(easing.easeOutQuart(0.5)).toBeCloseTo(0.9375);
      expect(easing.easeInOutQuart(0.5)).toBeCloseTo(0.5);
    });

    it('quintic', () => {
      expect(easing.easeInQuint(0.5)).toBeCloseTo(0.03125);
      expect(easing.easeOutQuint(0.5)).toBeCloseTo(0.96875);
      expect(easing.easeInOutQuint(0.5)).toBeCloseTo(0.5);
    });

    it('sine', () => {
      expect(easing.easeInSine(0.5)).toBeCloseTo(1 - Math.cos(Math.PI / 4));
      expect(easing.easeOutSine(0.5)).toBeCloseTo(Math.sin(Math.PI / 4));
      expect(easing.easeInOutSine(0.5)).toBeCloseTo(0.5);
    });

    it('exponential', () => {
      expect(easing.easeInExpo(0.5)).toBeCloseTo(2 ** -5);
      expect(easing.easeOutExpo(0.5)).toBeCloseTo(1 - 2 ** -5);
      expect(easing.easeInOutExpo(0.5)).toBeCloseTo(0.5);
    });

    it('circular', () => {
      expect(easing.easeInCirc(0.5)).toBeCloseTo(1 - Math.sqrt(0.75));
      expect(easing.easeOutCirc(0.5)).toBeCloseTo(Math.sqrt(0.75));
      expect(easing.easeInOutCirc(0.5)).toBeCloseTo(0.5);
    });

    it('elastic midpoints (easeInOutElastic hits 0.5 at t=0.5)', () => {
      const sin = Math.sin;
      const expectedIn = -(2 ** -5) * sin((5 - 10.75) * ((2 * Math.PI) / 3));
      expect(easing.easeInElastic(0.5)).toBeCloseTo(expectedIn);
      const expectedOut = 2 ** -5 * sin((5 - 0.75) * ((2 * Math.PI) / 3)) + 1;
      expect(easing.easeOutElastic(0.5)).toBeCloseTo(expectedOut);
      expect(easing.easeInOutElastic(0.5)).toBeCloseTo(0.5);
    });

    it('back', () => {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      const expectedIn = c3 * 0.5 ** 3 - c1 * 0.5 ** 2;
      expect(easing.easeInBack(0.5)).toBeCloseTo(expectedIn);
      expect(easing.easeOutBack(0.5)).toBeCloseTo(1 + c3 * (-0.5) ** 3 + c1 * (-0.5) ** 2);
      // t=0.5 uses the t >= 0.5 branch (not t < 0.5)
      expect(easing.easeInOutBack(0.5)).toBeCloseTo(0.5);
    });

    it('bounce', () => {
      const n1 = 7.5625;
      const t = 0.25;
      expect(easing.easeOutBounce(t)).toBeCloseTo(n1 * t * t);
      expect(easing.easeInBounce(0.5)).toBeCloseTo(1 - easing.easeOutBounce(0.5));
      expect(easing.easeInOutBounce(0.5)).toBeCloseTo(0.5);
    });
  });

  describe('edge cases outside [0, 1]', () => {
    it('linear extrapolates', () => {
      expect(easing.linear(-0.5)).toBe(-0.5);
      expect(easing.linear(1.5)).toBe(1.5);
    });

    it('easeInQuad grows for t > 1', () => {
      expect(easing.easeInQuad(2)).toBe(4);
    });

    it('easeInExpo at t=0 is exactly 0 (branch)', () => {
      expect(easing.easeInExpo(0)).toBe(0);
    });

    it('easeOutExpo at t=1 is exactly 1 (branch)', () => {
      expect(easing.easeOutExpo(1)).toBe(1);
    });

    it('elastic short-circuits at t=0 and t=1 only', () => {
      expect(easing.easeInElastic(0)).toBe(0);
      expect(easing.easeInElastic(1)).toBe(1);
      expect(easing.easeOutElastic(-1)).not.toBeCloseTo(0, EPS);
    });

    it('easeInCirc is even in t (t² inside sqrt)', () => {
      expect(easing.easeInCirc(-0.5)).toBeCloseTo(easing.easeInCirc(0.5));
      expect(easing.easeInCirc(-0.5)).toBeCloseTo(1 - Math.sqrt(0.75));
    });
  });
});
