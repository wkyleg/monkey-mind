/**
 * Seeded random number generator (Mulberry32)
 * Useful for deterministic procedural generation
 */

export class SeededRNG {
  private state: number;

  constructor(seed: number = Date.now()) {
    this.state = seed;
  }

  /** Get the current seed state */
  getSeed(): number {
    return this.state;
  }

  /** Reset with a new seed */
  setSeed(seed: number): void {
    this.state = seed;
  }

  /** Generate a random float between 0 and 1 */
  random(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Generate a random float in range [min, max) */
  range(min: number, max: number): number {
    return this.random() * (max - min) + min;
  }

  /** Generate a random integer in range [min, max] inclusive */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  /** Generate a random boolean with optional probability */
  bool(probability: number = 0.5): boolean {
    return this.random() < probability;
  }

  /** Pick a random element from an array */
  pick<T>(array: T[]): T {
    return array[Math.floor(this.random() * array.length)];
  }

  /** Shuffle an array in place */
  shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /** Generate a random point in a circle */
  inCircle(radius: number = 1): { x: number; y: number } {
    const angle = this.random() * Math.PI * 2;
    const r = Math.sqrt(this.random()) * radius;
    return {
      x: Math.cos(angle) * r,
      y: Math.sin(angle) * r,
    };
  }

  /** Generate a random point on a circle's edge */
  onCircle(radius: number = 1): { x: number; y: number } {
    const angle = this.random() * Math.PI * 2;
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    };
  }

  /** Weighted random selection */
  weighted<T>(items: { item: T; weight: number }[]): T {
    const totalWeight = items.reduce((sum, { weight }) => sum + weight, 0);
    let random = this.random() * totalWeight;

    for (const { item, weight } of items) {
      random -= weight;
      if (random <= 0) {
        return item;
      }
    }

    return items[items.length - 1].item;
  }
}

// Global RNG instance for convenience
export const rng = new SeededRNG();
