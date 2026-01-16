/**
 * Seeded RNG Tests
 * 
 * Tests for deterministic random number generation.
 * Seeded RNG is critical for reproducible procedural generation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SeededRNG } from './rng';

describe('SeededRNG', () => {
  describe('Determinism', () => {
    it('should produce same sequence with same seed', () => {
      const rng1 = new SeededRNG(12345);
      const rng2 = new SeededRNG(12345);
      
      for (let i = 0; i < 100; i++) {
        expect(rng1.random()).toBe(rng2.random());
      }
    });
    
    it('should produce different sequences with different seeds', () => {
      const rng1 = new SeededRNG(12345);
      const rng2 = new SeededRNG(54321);
      
      const sequence1 = Array.from({ length: 10 }, () => rng1.random());
      const sequence2 = Array.from({ length: 10 }, () => rng2.random());
      
      expect(sequence1).not.toEqual(sequence2);
    });
    
    it('should be reproducible after resetting seed', () => {
      const rng = new SeededRNG(12345);
      
      const firstValue = rng.random();
      rng.random();
      rng.random();
      
      rng.setSeed(12345);
      expect(rng.random()).toBe(firstValue);
    });
    
    it('should get current seed state', () => {
      const rng = new SeededRNG(42);
      rng.random();
      
      const savedSeed = rng.getSeed();
      const nextValue = rng.random();
      
      // New RNG starting from saved state should produce same value
      const rng2 = new SeededRNG(savedSeed);
      expect(rng2.random()).toBe(nextValue);
    });
  });
  
  describe('random()', () => {
    let rng: SeededRNG;
    
    beforeEach(() => {
      rng = new SeededRNG(12345);
    });
    
    it('should return values between 0 and 1', () => {
      for (let i = 0; i < 1000; i++) {
        const value = rng.random();
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }
    });
    
    it('should produce good distribution', () => {
      const buckets = new Array(10).fill(0);
      
      for (let i = 0; i < 10000; i++) {
        const bucket = Math.floor(rng.random() * 10);
        buckets[bucket]++;
      }
      
      // Each bucket should have roughly 1000 values (±200)
      for (const count of buckets) {
        expect(count).toBeGreaterThan(800);
        expect(count).toBeLessThan(1200);
      }
    });
  });
  
  describe('range()', () => {
    let rng: SeededRNG;
    
    beforeEach(() => {
      rng = new SeededRNG(12345);
    });
    
    it('should return values within range', () => {
      for (let i = 0; i < 100; i++) {
        const value = rng.range(10, 20);
        expect(value).toBeGreaterThanOrEqual(10);
        expect(value).toBeLessThan(20);
      }
    });
    
    it('should handle negative ranges', () => {
      for (let i = 0; i < 100; i++) {
        const value = rng.range(-20, -10);
        expect(value).toBeGreaterThanOrEqual(-20);
        expect(value).toBeLessThan(-10);
      }
    });
    
    it('should handle crossing zero', () => {
      for (let i = 0; i < 100; i++) {
        const value = rng.range(-10, 10);
        expect(value).toBeGreaterThanOrEqual(-10);
        expect(value).toBeLessThan(10);
      }
    });
  });
  
  describe('int()', () => {
    let rng: SeededRNG;
    
    beforeEach(() => {
      rng = new SeededRNG(12345);
    });
    
    it('should return integers', () => {
      for (let i = 0; i < 100; i++) {
        const value = rng.int(1, 10);
        expect(Number.isInteger(value)).toBe(true);
      }
    });
    
    it('should be inclusive of both endpoints', () => {
      const values = new Set<number>();
      
      for (let i = 0; i < 1000; i++) {
        values.add(rng.int(1, 3));
      }
      
      expect(values.has(1)).toBe(true);
      expect(values.has(2)).toBe(true);
      expect(values.has(3)).toBe(true);
      expect(values.size).toBe(3);
    });
    
    it('should return min when min equals max', () => {
      expect(rng.int(5, 5)).toBe(5);
    });
  });
  
  describe('bool()', () => {
    let rng: SeededRNG;
    
    beforeEach(() => {
      rng = new SeededRNG(12345);
    });
    
    it('should return boolean', () => {
      for (let i = 0; i < 100; i++) {
        expect(typeof rng.bool()).toBe('boolean');
      }
    });
    
    it('should respect probability 0', () => {
      for (let i = 0; i < 100; i++) {
        expect(rng.bool(0)).toBe(false);
      }
    });
    
    it('should respect probability 1', () => {
      for (let i = 0; i < 100; i++) {
        expect(rng.bool(1)).toBe(true);
      }
    });
    
    it('should roughly match probability', () => {
      let trueCount = 0;
      
      for (let i = 0; i < 10000; i++) {
        if (rng.bool(0.3)) {
          trueCount++;
        }
      }
      
      // Should be around 3000 (30%)
      expect(trueCount).toBeGreaterThan(2500);
      expect(trueCount).toBeLessThan(3500);
    });
  });
  
  describe('pick()', () => {
    let rng: SeededRNG;
    
    beforeEach(() => {
      rng = new SeededRNG(12345);
    });
    
    it('should pick from array', () => {
      const array = ['a', 'b', 'c', 'd'];
      
      for (let i = 0; i < 100; i++) {
        expect(array).toContain(rng.pick(array));
      }
    });
    
    it('should pick all elements eventually', () => {
      const array = ['a', 'b', 'c'];
      const picked = new Set<string>();
      
      for (let i = 0; i < 100; i++) {
        picked.add(rng.pick(array));
      }
      
      expect(picked.size).toBe(3);
    });
    
    it('should work with single element', () => {
      expect(rng.pick([42])).toBe(42);
    });
  });
  
  describe('shuffle()', () => {
    let rng: SeededRNG;
    
    beforeEach(() => {
      rng = new SeededRNG(12345);
    });
    
    it('should contain same elements', () => {
      const original = [1, 2, 3, 4, 5];
      const shuffled = rng.shuffle([...original]);
      
      expect(shuffled.sort()).toEqual(original.sort());
    });
    
    it('should modify in place', () => {
      const array = [1, 2, 3, 4, 5];
      const result = rng.shuffle(array);
      
      expect(result).toBe(array);
    });
    
    it('should produce deterministic shuffle with same seed', () => {
      const rng1 = new SeededRNG(42);
      const rng2 = new SeededRNG(42);
      
      const array1 = [1, 2, 3, 4, 5];
      const array2 = [1, 2, 3, 4, 5];
      
      rng1.shuffle(array1);
      rng2.shuffle(array2);
      
      expect(array1).toEqual(array2);
    });
  });
  
  describe('inCircle()', () => {
    let rng: SeededRNG;
    
    beforeEach(() => {
      rng = new SeededRNG(12345);
    });
    
    it('should return points within circle', () => {
      for (let i = 0; i < 100; i++) {
        const point = rng.inCircle(10);
        const distance = Math.sqrt(point.x * point.x + point.y * point.y);
        expect(distance).toBeLessThanOrEqual(10);
      }
    });
    
    it('should respect radius parameter', () => {
      for (let i = 0; i < 100; i++) {
        const point = rng.inCircle(5);
        const distance = Math.sqrt(point.x * point.x + point.y * point.y);
        expect(distance).toBeLessThanOrEqual(5);
      }
    });
    
    it('should default to radius 1', () => {
      for (let i = 0; i < 100; i++) {
        const point = rng.inCircle();
        const distance = Math.sqrt(point.x * point.x + point.y * point.y);
        expect(distance).toBeLessThanOrEqual(1);
      }
    });
  });
  
  describe('onCircle()', () => {
    let rng: SeededRNG;
    
    beforeEach(() => {
      rng = new SeededRNG(12345);
    });
    
    it('should return points on circle edge', () => {
      for (let i = 0; i < 100; i++) {
        const point = rng.onCircle(10);
        const distance = Math.sqrt(point.x * point.x + point.y * point.y);
        expect(distance).toBeCloseTo(10, 5);
      }
    });
    
    it('should cover all angles', () => {
      const angles: number[] = [];
      
      for (let i = 0; i < 1000; i++) {
        const point = rng.onCircle(1);
        const angle = Math.atan2(point.y, point.x);
        angles.push(angle);
      }
      
      // Check that we have angles in all quadrants
      const hasPositiveX = angles.some(a => Math.cos(a) > 0.5);
      const hasNegativeX = angles.some(a => Math.cos(a) < -0.5);
      const hasPositiveY = angles.some(a => Math.sin(a) > 0.5);
      const hasNegativeY = angles.some(a => Math.sin(a) < -0.5);
      
      expect(hasPositiveX).toBe(true);
      expect(hasNegativeX).toBe(true);
      expect(hasPositiveY).toBe(true);
      expect(hasNegativeY).toBe(true);
    });
  });
  
  describe('weighted()', () => {
    let rng: SeededRNG;
    
    beforeEach(() => {
      rng = new SeededRNG(12345);
    });
    
    it('should select based on weights', () => {
      const items = [
        { item: 'common', weight: 100 },
        { item: 'rare', weight: 10 },
        { item: 'legendary', weight: 1 },
      ];
      
      const counts = { common: 0, rare: 0, legendary: 0 };
      
      for (let i = 0; i < 10000; i++) {
        const selected = rng.weighted(items);
        counts[selected as keyof typeof counts]++;
      }
      
      // Common should be picked most often
      expect(counts.common).toBeGreaterThan(counts.rare);
      expect(counts.rare).toBeGreaterThan(counts.legendary);
      
      // Rough ratio check
      expect(counts.common / counts.rare).toBeGreaterThan(5);
    });
    
    it('should always pick item with weight 1 when others are 0', () => {
      const items = [
        { item: 'zero', weight: 0 },
        { item: 'one', weight: 1 },
      ];
      
      for (let i = 0; i < 100; i++) {
        expect(rng.weighted(items)).toBe('one');
      }
    });
    
    it('should work with equal weights', () => {
      const items = [
        { item: 'a', weight: 1 },
        { item: 'b', weight: 1 },
        { item: 'c', weight: 1 },
      ];
      
      const counts = { a: 0, b: 0, c: 0 };
      
      for (let i = 0; i < 3000; i++) {
        const selected = rng.weighted(items);
        counts[selected as keyof typeof counts]++;
      }
      
      // Each should be picked roughly 1000 times
      expect(counts.a).toBeGreaterThan(800);
      expect(counts.a).toBeLessThan(1200);
      expect(counts.b).toBeGreaterThan(800);
      expect(counts.b).toBeLessThan(1200);
      expect(counts.c).toBeGreaterThan(800);
      expect(counts.c).toBeLessThan(1200);
    });
  });
});

describe('SeededRNG Use Cases', () => {
  it('should enable reproducible level generation', () => {
    const generateLevel = (seed: number) => {
      const rng = new SeededRNG(seed);
      return {
        enemyCount: rng.int(5, 10),
        bossType: rng.pick(['A', 'B', 'C']),
        powerupLocations: Array.from({ length: 3 }, () => ({
          x: rng.range(0, 800),
          y: rng.range(0, 600),
        })),
      };
    };
    
    const level1 = generateLevel(42);
    const level2 = generateLevel(42);
    
    expect(level1).toEqual(level2);
  });
  
  it('should enable different but reproducible variations', () => {
    const generateVariation = (seed: number) => {
      const rng = new SeededRNG(seed);
      return rng.shuffle([1, 2, 3, 4, 5]);
    };
    
    // Same seed = same result
    expect(generateVariation(100)).toEqual(generateVariation(100));
    
    // Different seed = different result
    expect(generateVariation(100)).not.toEqual(generateVariation(200));
  });
});
