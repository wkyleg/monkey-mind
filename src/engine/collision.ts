/**
 * Collision detection system
 */

import type { Entity } from './entity';

export interface CollisionPair {
  a: Entity;
  b: Entity;
}

/**
 * Check if two circles collide
 */
export function circleVsCircle(x1: number, y1: number, r1: number, x2: number, y2: number, r2: number): boolean {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance < r1 + r2;
}

/**
 * Check if two AABBs collide
 */
export function aabbVsAabb(
  x1: number,
  y1: number,
  w1: number,
  h1: number,
  x2: number,
  y2: number,
  w2: number,
  h2: number,
): boolean {
  return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
}

/**
 * Check if circle and AABB collide
 */
export function circleVsAabb(
  cx: number,
  cy: number,
  radius: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
): boolean {
  // Find closest point on rectangle to circle center
  const closestX = Math.max(rx, Math.min(cx, rx + rw));
  const closestY = Math.max(ry, Math.min(cy, ry + rh));

  // Calculate distance between closest point and circle center
  const dx = cx - closestX;
  const dy = cy - closestY;

  return dx * dx + dy * dy < radius * radius;
}

/**
 * Check if point is inside circle
 */
export function pointInCircle(px: number, py: number, cx: number, cy: number, radius: number): boolean {
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy < radius * radius;
}

/**
 * Check if point is inside AABB
 */
export function pointInAabb(px: number, py: number, rx: number, ry: number, rw: number, rh: number): boolean {
  return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}

/**
 * Check collision between two entities
 */
export function checkEntityCollision(a: Entity, b: Entity): boolean {
  if (!a.collider || !b.collider) return false;

  const ax = a.transform.x + (a.collider.offsetX ?? 0);
  const ay = a.transform.y + (a.collider.offsetY ?? 0);
  const bx = b.transform.x + (b.collider.offsetX ?? 0);
  const by = b.transform.y + (b.collider.offsetY ?? 0);

  // Circle vs Circle
  if (a.collider.type === 'circle' && b.collider.type === 'circle') {
    return circleVsCircle(ax, ay, a.collider.radius!, bx, by, b.collider.radius!);
  }

  // AABB vs AABB
  if (a.collider.type === 'aabb' && b.collider.type === 'aabb') {
    return aabbVsAabb(ax, ay, a.collider.width!, a.collider.height!, bx, by, b.collider.width!, b.collider.height!);
  }

  // Circle vs AABB
  if (a.collider.type === 'circle' && b.collider.type === 'aabb') {
    return circleVsAabb(ax, ay, a.collider.radius!, bx, by, b.collider.width!, b.collider.height!);
  }

  // AABB vs Circle
  if (a.collider.type === 'aabb' && b.collider.type === 'circle') {
    return circleVsAabb(bx, by, b.collider.radius!, ax, ay, a.collider.width!, a.collider.height!);
  }

  return false;
}

/**
 * Collision system for checking entity pairs
 */
export class CollisionSystem {
  /**
   * Check collisions between two groups of entities
   */
  checkGroups(groupA: Entity[], groupB: Entity[], callback: (a: Entity, b: Entity) => void): void {
    for (const a of groupA) {
      if (!a.active || !a.collider) continue;

      for (const b of groupB) {
        if (!b.active || !b.collider) continue;
        if (a === b) continue;

        if (checkEntityCollision(a, b)) {
          callback(a, b);
        }
      }
    }
  }

  /**
   * Check collisions within a single group
   */
  checkGroup(entities: Entity[], callback: (a: Entity, b: Entity) => void): void {
    for (let i = 0; i < entities.length; i++) {
      const a = entities[i];
      if (!a.active || !a.collider) continue;

      for (let j = i + 1; j < entities.length; j++) {
        const b = entities[j];
        if (!b.active || !b.collider) continue;

        if (checkEntityCollision(a, b)) {
          callback(a, b);
        }
      }
    }
  }

  /**
   * Get all collision pairs from a group
   */
  getAllCollisions(entities: Entity[]): CollisionPair[] {
    const pairs: CollisionPair[] = [];

    for (let i = 0; i < entities.length; i++) {
      const a = entities[i];
      if (!a.active || !a.collider) continue;

      for (let j = i + 1; j < entities.length; j++) {
        const b = entities[j];
        if (!b.active || !b.collider) continue;

        if (checkEntityCollision(a, b)) {
          pairs.push({ a, b });
        }
      }
    }

    return pairs;
  }
}

// Global collision system instance
export const collisionSystem = new CollisionSystem();
