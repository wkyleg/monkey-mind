/**
 * Collision System Tests
 *
 * Tests for collision detection between entities.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  aabbVsAabb,
  CollisionSystem,
  checkEntityCollision,
  circleVsAabb,
  circleVsCircle,
  pointInAabb,
  pointInCircle,
} from './collision';
import { Entity } from './entity';

describe('Primitive Collision Functions', () => {
  describe('circleVsCircle', () => {
    it('should detect overlapping circles', () => {
      const result = circleVsCircle(0, 0, 10, 15, 0, 10);
      expect(result).toBe(true);
    });

    it('should detect touching circles', () => {
      // Circles with radii 10 and 10, centers 19 apart (slightly overlapping)
      const result = circleVsCircle(0, 0, 10, 19, 0, 10);
      expect(result).toBe(true);
    });

    it('should not detect non-overlapping circles', () => {
      const result = circleVsCircle(0, 0, 10, 25, 0, 10);
      expect(result).toBe(false);
    });

    it('should detect concentric circles', () => {
      const result = circleVsCircle(50, 50, 20, 50, 50, 10);
      expect(result).toBe(true);
    });
  });

  describe('aabbVsAabb', () => {
    it('should detect overlapping boxes', () => {
      const result = aabbVsAabb(0, 0, 20, 20, 10, 10, 20, 20);
      expect(result).toBe(true);
    });

    it('should detect touching boxes', () => {
      // Box 1: 0,0 to 20,20. Box 2: 19,0 to 39,20 (slight overlap)
      const result = aabbVsAabb(0, 0, 20, 20, 19, 0, 20, 20);
      expect(result).toBe(true);
    });

    it('should not detect non-overlapping boxes (horizontal gap)', () => {
      const result = aabbVsAabb(0, 0, 20, 20, 30, 0, 20, 20);
      expect(result).toBe(false);
    });

    it('should not detect non-overlapping boxes (vertical gap)', () => {
      const result = aabbVsAabb(0, 0, 20, 20, 0, 30, 20, 20);
      expect(result).toBe(false);
    });

    it('should detect contained boxes', () => {
      const result = aabbVsAabb(0, 0, 100, 100, 10, 10, 20, 20);
      expect(result).toBe(true);
    });
  });

  describe('circleVsAabb', () => {
    it('should detect circle overlapping box', () => {
      // Circle at (0,0) r=10, box at (5, 5) 20x20
      const result = circleVsAabb(0, 0, 10, 5, 5, 20, 20);
      expect(result).toBe(true);
    });

    it('should detect circle inside box', () => {
      const result = circleVsAabb(50, 50, 10, 0, 0, 100, 100);
      expect(result).toBe(true);
    });

    it('should detect circle touching box edge', () => {
      // Circle at (0, 15) r=10, box at (9, 0) 20x30
      const result = circleVsAabb(0, 15, 10, 9, 0, 20, 30);
      expect(result).toBe(true);
    });

    it('should not detect when circle is far from box', () => {
      const result = circleVsAabb(0, 0, 10, 50, 50, 20, 20);
      expect(result).toBe(false);
    });

    it('should handle circle near corner', () => {
      // Circle near corner but not touching
      const result = circleVsAabb(0, 0, 5, 10, 10, 20, 20);
      expect(result).toBe(false);

      // Circle near corner and touching
      const result2 = circleVsAabb(5, 5, 10, 10, 10, 20, 20);
      expect(result2).toBe(true);
    });
  });

  describe('pointInCircle', () => {
    it('should detect point inside circle', () => {
      const result = pointInCircle(5, 5, 0, 0, 10);
      expect(result).toBe(true);
    });

    it('should detect point at center', () => {
      const result = pointInCircle(0, 0, 0, 0, 10);
      expect(result).toBe(true);
    });

    it('should not detect point outside circle', () => {
      const result = pointInCircle(20, 0, 0, 0, 10);
      expect(result).toBe(false);
    });

    it('should not detect point on edge (exclusive)', () => {
      // Point exactly at radius distance
      const result = pointInCircle(10, 0, 0, 0, 10);
      expect(result).toBe(false);
    });
  });

  describe('pointInAabb', () => {
    it('should detect point inside box', () => {
      const result = pointInAabb(15, 15, 10, 10, 20, 20);
      expect(result).toBe(true);
    });

    it('should detect point on edge', () => {
      const result = pointInAabb(10, 15, 10, 10, 20, 20);
      expect(result).toBe(true);
    });

    it('should detect point at corner', () => {
      const result = pointInAabb(10, 10, 10, 10, 20, 20);
      expect(result).toBe(true);
    });

    it('should not detect point outside box', () => {
      const result = pointInAabb(5, 15, 10, 10, 20, 20);
      expect(result).toBe(false);
    });
  });
});

describe('Entity Collision', () => {
  let entityA: Entity;
  let entityB: Entity;

  beforeEach(() => {
    entityA = new Entity(0, 0);
    entityB = new Entity(15, 0);
  });

  describe('checkEntityCollision', () => {
    it('should return false if entity has no collider', () => {
      expect(checkEntityCollision(entityA, entityB)).toBe(false);
    });

    it('should detect circle-circle collision', () => {
      entityA.setCollider({ type: 'circle', radius: 10 });
      entityB.setCollider({ type: 'circle', radius: 10 });

      expect(checkEntityCollision(entityA, entityB)).toBe(true);
    });

    it('should detect AABB-AABB collision', () => {
      entityA.setCollider({ type: 'aabb', width: 20, height: 20 });
      entityB.setCollider({ type: 'aabb', width: 20, height: 20 });

      expect(checkEntityCollision(entityA, entityB)).toBe(true);
    });

    it('should detect circle-AABB collision', () => {
      // entityA at (0, 0), entityB at (15, 0)
      // Circle radius 10, AABB starts at (15, 0) - they need to overlap
      entityA.setCollider({ type: 'circle', radius: 10 });
      entityB.transform.x = 5; // Move AABB closer so they overlap
      entityB.setCollider({ type: 'aabb', width: 20, height: 20 });

      expect(checkEntityCollision(entityA, entityB)).toBe(true);
    });

    it('should detect AABB-circle collision', () => {
      entityA.setCollider({ type: 'aabb', width: 20, height: 20 });
      entityB.setCollider({ type: 'circle', radius: 10 });

      expect(checkEntityCollision(entityA, entityB)).toBe(true);
    });

    it('should respect collider offset', () => {
      entityA.setCollider({ type: 'circle', radius: 5, offsetX: 0, offsetY: 0 });
      entityB.setCollider({ type: 'circle', radius: 5, offsetX: -10, offsetY: 0 });

      // entityB at (15, 0) with offset (-10, 0) means effective position (5, 0)
      // entityA at (0, 0) with radius 5, entityB effective at (5, 0) with radius 5
      // Distance = 5, combined radii = 10, so they should overlap
      expect(checkEntityCollision(entityA, entityB)).toBe(true);
    });
  });
});

describe('CollisionSystem', () => {
  let system: CollisionSystem;

  beforeEach(() => {
    system = new CollisionSystem();
  });

  describe('checkGroups', () => {
    it('should call callback for each collision', () => {
      const players = [new Entity(0, 0, 'player').setCollider({ type: 'circle', radius: 10 })];
      const enemies = [
        new Entity(5, 0, 'enemy').setCollider({ type: 'circle', radius: 10 }),
        new Entity(100, 0, 'enemy').setCollider({ type: 'circle', radius: 10 }),
      ];

      const callback = vi.fn();
      system.checkGroups(players, enemies, callback);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(players[0], enemies[0]);
    });

    it('should not call callback for non-collisions', () => {
      const groupA = [new Entity(0, 0, 'player').setCollider({ type: 'circle', radius: 10 })];
      const groupB = [new Entity(100, 100, 'enemy').setCollider({ type: 'circle', radius: 10 })];

      const callback = vi.fn();
      system.checkGroups(groupA, groupB, callback);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should skip inactive entities', () => {
      const active = new Entity(0, 0).setCollider({ type: 'circle', radius: 10 });
      const inactive = new Entity(5, 0).setCollider({ type: 'circle', radius: 10 });
      inactive.destroy();

      const callback = vi.fn();
      system.checkGroups([active], [inactive], callback);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should skip entities without colliders', () => {
      const withCollider = new Entity(0, 0).setCollider({ type: 'circle', radius: 10 });
      const withoutCollider = new Entity(5, 0); // No collider

      const callback = vi.fn();
      system.checkGroups([withCollider], [withoutCollider], callback);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should not collide entity with itself', () => {
      const entity = new Entity(0, 0).setCollider({ type: 'circle', radius: 10 });

      const callback = vi.fn();
      system.checkGroups([entity], [entity], callback);

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('checkGroup', () => {
    it('should check all pairs within group', () => {
      const entities = [
        new Entity(0, 0).setCollider({ type: 'circle', radius: 10 }),
        new Entity(5, 0).setCollider({ type: 'circle', radius: 10 }),
        new Entity(10, 0).setCollider({ type: 'circle', radius: 10 }),
      ];

      const callback = vi.fn();
      system.checkGroup(entities, callback);

      // All three should collide with each other
      expect(callback).toHaveBeenCalledTimes(3);
    });

    it('should not check same pair twice', () => {
      const e1 = new Entity(0, 0).setCollider({ type: 'circle', radius: 20 });
      const e2 = new Entity(5, 0).setCollider({ type: 'circle', radius: 20 });

      const pairs: [Entity, Entity][] = [];
      system.checkGroup([e1, e2], (a, b) => {
        pairs.push([a, b]);
      });

      // Should only be called once, not twice
      expect(pairs.length).toBe(1);
    });
  });

  describe('getAllCollisions', () => {
    it('should return array of collision pairs', () => {
      const entities = [
        new Entity(0, 0).setCollider({ type: 'circle', radius: 10 }),
        new Entity(5, 0).setCollider({ type: 'circle', radius: 10 }),
        new Entity(100, 100).setCollider({ type: 'circle', radius: 10 }),
      ];

      const pairs = system.getAllCollisions(entities);

      expect(pairs.length).toBe(1);
      expect(pairs[0].a).toBe(entities[0]);
      expect(pairs[0].b).toBe(entities[1]);
    });

    it('should return empty array for no collisions', () => {
      const entities = [
        new Entity(0, 0).setCollider({ type: 'circle', radius: 10 }),
        new Entity(100, 100).setCollider({ type: 'circle', radius: 10 }),
      ];

      const pairs = system.getAllCollisions(entities);

      expect(pairs.length).toBe(0);
    });
  });
});

describe('Game Scenario Tests', () => {
  let system: CollisionSystem;

  beforeEach(() => {
    system = new CollisionSystem();
  });

  it('should detect projectile hitting enemy', () => {
    const projectile = new Entity(100, 200, 'projectile').setCollider({ type: 'circle', radius: 5 });

    const enemy = new Entity(102, 200, 'enemy').setCollider({ type: 'circle', radius: 20 });

    let hit = false;
    system.checkGroups([projectile], [enemy], () => {
      hit = true;
    });

    expect(hit).toBe(true);
  });

  it('should detect player collecting powerup', () => {
    const player = new Entity(200, 500, 'player').setCollider({ type: 'aabb', width: 40, height: 50 });

    const powerup = new Entity(210, 510, 'pickup').setCollider({ type: 'circle', radius: 15 });

    let collected = false;
    system.checkGroups([player], [powerup], () => {
      collected = true;
    });

    expect(collected).toBe(true);
  });

  it('should handle multiple simultaneous collisions', () => {
    const player = new Entity(200, 200, 'player').setCollider({ type: 'circle', radius: 20 });

    const enemies = [
      new Entity(210, 200, 'enemy').setCollider({ type: 'circle', radius: 15 }),
      new Entity(200, 210, 'enemy').setCollider({ type: 'circle', radius: 15 }),
      new Entity(205, 205, 'enemy').setCollider({ type: 'circle', radius: 15 }),
    ];

    let collisionCount = 0;
    system.checkGroups([player], enemies, () => {
      collisionCount++;
    });

    expect(collisionCount).toBe(3);
  });
});
