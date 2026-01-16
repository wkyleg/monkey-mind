/**
 * Math Utilities Tests
 * 
 * Tests for common math functions used throughout the game.
 */

import { describe, it, expect } from 'vitest';
import {
  vec2,
  vec2Add,
  vec2Sub,
  vec2Scale,
  vec2Length,
  vec2Normalize,
  vec2Distance,
  vec2Dot,
  vec2Lerp,
  clamp,
  lerp,
  inverseLerp,
  remap,
  degToRad,
  radToDeg,
  wrap,
  smoothstep,
  smootherstep,
  approach,
  oscillate,
  randomRange,
  randomInt,
  pick,
  shuffle,
} from './math';

describe('Vector2 Operations', () => {
  describe('vec2', () => {
    it('should create a vector', () => {
      const v = vec2(3, 4);
      expect(v.x).toBe(3);
      expect(v.y).toBe(4);
    });
  });
  
  describe('vec2Add', () => {
    it('should add two vectors', () => {
      const result = vec2Add(vec2(1, 2), vec2(3, 4));
      expect(result).toEqual({ x: 4, y: 6 });
    });
    
    it('should handle negative values', () => {
      const result = vec2Add(vec2(-1, -2), vec2(3, 4));
      expect(result).toEqual({ x: 2, y: 2 });
    });
  });
  
  describe('vec2Sub', () => {
    it('should subtract two vectors', () => {
      const result = vec2Sub(vec2(5, 7), vec2(2, 3));
      expect(result).toEqual({ x: 3, y: 4 });
    });
  });
  
  describe('vec2Scale', () => {
    it('should scale a vector', () => {
      const result = vec2Scale(vec2(2, 3), 2);
      expect(result).toEqual({ x: 4, y: 6 });
    });
    
    it('should handle negative scale', () => {
      const result = vec2Scale(vec2(2, 3), -1);
      expect(result).toEqual({ x: -2, y: -3 });
    });
    
    it('should handle zero scale', () => {
      const result = vec2Scale(vec2(2, 3), 0);
      expect(result).toEqual({ x: 0, y: 0 });
    });
  });
  
  describe('vec2Length', () => {
    it('should calculate vector length', () => {
      const result = vec2Length(vec2(3, 4)); // 3-4-5 triangle
      expect(result).toBe(5);
    });
    
    it('should return 0 for zero vector', () => {
      const result = vec2Length(vec2(0, 0));
      expect(result).toBe(0);
    });
  });
  
  describe('vec2Normalize', () => {
    it('should normalize a vector', () => {
      const result = vec2Normalize(vec2(3, 4));
      expect(result.x).toBeCloseTo(0.6);
      expect(result.y).toBeCloseTo(0.8);
    });
    
    it('should return zero vector for zero input', () => {
      const result = vec2Normalize(vec2(0, 0));
      expect(result).toEqual({ x: 0, y: 0 });
    });
    
    it('normalized vector should have length 1', () => {
      const result = vec2Normalize(vec2(10, 20));
      expect(vec2Length(result)).toBeCloseTo(1);
    });
  });
  
  describe('vec2Distance', () => {
    it('should calculate distance between vectors', () => {
      const result = vec2Distance(vec2(0, 0), vec2(3, 4));
      expect(result).toBe(5);
    });
    
    it('should return 0 for same point', () => {
      const result = vec2Distance(vec2(5, 5), vec2(5, 5));
      expect(result).toBe(0);
    });
  });
  
  describe('vec2Dot', () => {
    it('should calculate dot product', () => {
      const result = vec2Dot(vec2(1, 2), vec2(3, 4));
      expect(result).toBe(11); // 1*3 + 2*4
    });
    
    it('should return 0 for perpendicular vectors', () => {
      const result = vec2Dot(vec2(1, 0), vec2(0, 1));
      expect(result).toBe(0);
    });
  });
  
  describe('vec2Lerp', () => {
    it('should interpolate between vectors', () => {
      const result = vec2Lerp(vec2(0, 0), vec2(10, 20), 0.5);
      expect(result).toEqual({ x: 5, y: 10 });
    });
    
    it('should return start at t=0', () => {
      const result = vec2Lerp(vec2(0, 0), vec2(10, 20), 0);
      expect(result).toEqual({ x: 0, y: 0 });
    });
    
    it('should return end at t=1', () => {
      const result = vec2Lerp(vec2(0, 0), vec2(10, 20), 1);
      expect(result).toEqual({ x: 10, y: 20 });
    });
  });
});

describe('Scalar Functions', () => {
  describe('clamp', () => {
    it('should clamp value within range', () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-5, 0, 10)).toBe(0);
      expect(clamp(15, 0, 10)).toBe(10);
    });
    
    it('should handle edge cases', () => {
      expect(clamp(0, 0, 10)).toBe(0);
      expect(clamp(10, 0, 10)).toBe(10);
    });
  });
  
  describe('lerp', () => {
    it('should interpolate between values', () => {
      expect(lerp(0, 100, 0.5)).toBe(50);
      expect(lerp(0, 100, 0)).toBe(0);
      expect(lerp(0, 100, 1)).toBe(100);
    });
    
    it('should handle extrapolation', () => {
      expect(lerp(0, 100, 1.5)).toBe(150);
      expect(lerp(0, 100, -0.5)).toBe(-50);
    });
  });
  
  describe('inverseLerp', () => {
    it('should calculate inverse lerp', () => {
      expect(inverseLerp(0, 100, 50)).toBe(0.5);
      expect(inverseLerp(0, 100, 0)).toBe(0);
      expect(inverseLerp(0, 100, 100)).toBe(1);
    });
    
    it('should return 0 when a equals b', () => {
      expect(inverseLerp(50, 50, 50)).toBe(0);
    });
  });
  
  describe('remap', () => {
    it('should remap value from one range to another', () => {
      expect(remap(50, 0, 100, 0, 1)).toBe(0.5);
      expect(remap(0, 0, 100, 0, 1)).toBe(0);
      expect(remap(100, 0, 100, 0, 1)).toBe(1);
    });
    
    it('should handle different output ranges', () => {
      expect(remap(50, 0, 100, 200, 300)).toBe(250);
    });
  });
  
  describe('degToRad / radToDeg', () => {
    it('should convert degrees to radians', () => {
      expect(degToRad(180)).toBeCloseTo(Math.PI);
      expect(degToRad(90)).toBeCloseTo(Math.PI / 2);
      expect(degToRad(0)).toBe(0);
    });
    
    it('should convert radians to degrees', () => {
      expect(radToDeg(Math.PI)).toBeCloseTo(180);
      expect(radToDeg(Math.PI / 2)).toBeCloseTo(90);
      expect(radToDeg(0)).toBe(0);
    });
    
    it('should be inverse operations', () => {
      expect(radToDeg(degToRad(45))).toBeCloseTo(45);
      expect(degToRad(radToDeg(1))).toBeCloseTo(1);
    });
  });
  
  describe('wrap', () => {
    it('should wrap values within range', () => {
      expect(wrap(5, 0, 10)).toBe(5);
      expect(wrap(15, 0, 10)).toBe(5);
      expect(wrap(-5, 0, 10)).toBe(5);
    });
    
    it('should handle angles', () => {
      expect(wrap(370, 0, 360)).toBe(10);
      expect(wrap(-10, 0, 360)).toBe(350);
    });
  });
  
  describe('smoothstep', () => {
    it('should return 0 at edge0', () => {
      expect(smoothstep(0, 1, 0)).toBe(0);
    });
    
    it('should return 1 at edge1', () => {
      expect(smoothstep(0, 1, 1)).toBe(1);
    });
    
    it('should return 0.5 at midpoint', () => {
      expect(smoothstep(0, 1, 0.5)).toBe(0.5);
    });
    
    it('should clamp outside range', () => {
      expect(smoothstep(0, 1, -1)).toBe(0);
      expect(smoothstep(0, 1, 2)).toBe(1);
    });
  });
  
  describe('smootherstep', () => {
    it('should return 0 at edge0', () => {
      expect(smootherstep(0, 1, 0)).toBe(0);
    });
    
    it('should return 1 at edge1', () => {
      expect(smootherstep(0, 1, 1)).toBe(1);
    });
    
    it('should be smoother than smoothstep', () => {
      // At midpoint, smootherstep should be 0.5 exactly
      expect(smootherstep(0, 1, 0.5)).toBe(0.5);
    });
  });
  
  describe('approach', () => {
    it('should move toward target from below', () => {
      expect(approach(0, 10, 5)).toBe(5);
    });
    
    it('should move toward target from above', () => {
      expect(approach(20, 10, 5)).toBe(15);
    });
    
    it('should not overshoot target', () => {
      expect(approach(9, 10, 5)).toBe(10);
      expect(approach(11, 10, 5)).toBe(10);
    });
    
    it('should stay at target if already there', () => {
      expect(approach(10, 10, 5)).toBe(10);
    });
  });
  
  describe('oscillate', () => {
    it('should oscillate based on time and frequency', () => {
      // At time=0, sin(0) = 0
      expect(oscillate(0, 1, 1)).toBeCloseTo(0);
      
      // At time=0.25 (quarter cycle at frequency 1), sin(π/2) = 1
      expect(oscillate(0.25, 1, 1)).toBeCloseTo(1);
    });
    
    it('should respect amplitude', () => {
      expect(oscillate(0.25, 1, 5)).toBeCloseTo(5);
    });
    
    it('should oscillate symmetrically', () => {
      const v1 = oscillate(0.25, 1, 1);
      const v2 = oscillate(0.75, 1, 1);
      expect(v1 + v2).toBeCloseTo(0);
    });
  });
});

describe('Random Functions', () => {
  describe('randomRange', () => {
    it('should return value within range', () => {
      for (let i = 0; i < 100; i++) {
        const result = randomRange(10, 20);
        expect(result).toBeGreaterThanOrEqual(10);
        expect(result).toBeLessThan(20);
      }
    });
    
    it('should handle negative ranges', () => {
      for (let i = 0; i < 100; i++) {
        const result = randomRange(-20, -10);
        expect(result).toBeGreaterThanOrEqual(-20);
        expect(result).toBeLessThan(-10);
      }
    });
  });
  
  describe('randomInt', () => {
    it('should return integer within range', () => {
      for (let i = 0; i < 100; i++) {
        const result = randomInt(1, 5);
        expect(Number.isInteger(result)).toBe(true);
        expect(result).toBeGreaterThanOrEqual(1);
        expect(result).toBeLessThanOrEqual(5);
      }
    });
    
    it('should include both endpoints', () => {
      const results = new Set<number>();
      for (let i = 0; i < 1000; i++) {
        results.add(randomInt(1, 3));
      }
      expect(results.has(1)).toBe(true);
      expect(results.has(3)).toBe(true);
    });
  });
  
  describe('pick', () => {
    it('should pick an element from array', () => {
      const array = [1, 2, 3, 4, 5];
      for (let i = 0; i < 100; i++) {
        const result = pick(array);
        expect(array).toContain(result);
      }
    });
    
    it('should return the only element for single-element array', () => {
      expect(pick([42])).toBe(42);
    });
  });
  
  describe('shuffle', () => {
    it('should contain same elements', () => {
      const original = [1, 2, 3, 4, 5];
      const shuffled = shuffle([...original]);
      
      expect(shuffled.sort()).toEqual(original.sort());
    });
    
    it('should return new array', () => {
      const original = [1, 2, 3];
      const shuffled = shuffle(original);
      
      expect(shuffled).not.toBe(original);
    });
    
    it('should shuffle (statistically)', () => {
      // Run many shuffles and check that at least one differs from original
      const original = [1, 2, 3, 4, 5];
      let foundDifferent = false;
      
      for (let i = 0; i < 100; i++) {
        const shuffled = shuffle([...original]);
        if (JSON.stringify(shuffled) !== JSON.stringify(original)) {
          foundDifferent = true;
          break;
        }
      }
      
      expect(foundDifferent).toBe(true);
    });
  });
});
