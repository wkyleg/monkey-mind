/**
 * Entity component system (lightweight ECS)
 */

import type { Renderer } from './renderer';

// Component types

export interface Transform {
  x: number;
  y: number;
  vx: number;
  vy: number;
  lane: number;
  rotation: number;
}

export interface Renderable {
  type: 'circle' | 'rect' | 'custom';
  color: string;
  width?: number;
  height?: number;
  radius?: number;
  glow?: boolean;
  glowSize?: number;
  draw?: (renderer: Renderer, entity: Entity) => void;
}

export interface Collider {
  type: 'circle' | 'aabb';
  radius?: number;
  width?: number;
  height?: number;
  offsetX?: number;
  offsetY?: number;
}

export interface Health {
  current: number;
  max: number;
  invulnerable: boolean;
  invulnerableTime: number;
}

export type Faction = 'player' | 'enemy' | 'neutral' | 'projectile' | 'pickup';

// Entity class

let nextEntityId = 0;

export class Entity {
  readonly id: number;
  active: boolean = true;

  transform: Transform;
  renderable?: Renderable;
  collider?: Collider;
  health?: Health;
  faction: Faction;
  tags: Set<string>;

  // Custom data storage
  data: Record<string, unknown> = {};

  constructor(x: number, y: number, faction: Faction = 'neutral', tags: string[] = []) {
    this.id = nextEntityId++;
    this.transform = {
      x,
      y,
      vx: 0,
      vy: 0,
      lane: 0,
      rotation: 0,
    };
    this.faction = faction;
    this.tags = new Set(tags);
  }

  // Component helpers

  setRenderable(renderable: Renderable): this {
    this.renderable = renderable;
    return this;
  }

  setCollider(collider: Collider): this {
    this.collider = collider;
    return this;
  }

  setHealth(max: number, current?: number): this {
    this.health = {
      current: current ?? max,
      max,
      invulnerable: false,
      invulnerableTime: 0,
    };
    return this;
  }

  setVelocity(vx: number, vy: number): this {
    this.transform.vx = vx;
    this.transform.vy = vy;
    return this;
  }

  setLane(lane: number): this {
    this.transform.lane = lane;
    return this;
  }

  addTag(tag: string): this {
    this.tags.add(tag);
    return this;
  }

  hasTag(tag: string): boolean {
    return this.tags.has(tag);
  }

  removeTag(tag: string): this {
    this.tags.delete(tag);
    return this;
  }

  // Data helpers

  setData<T>(key: string, value: T): this {
    this.data[key] = value;
    return this;
  }

  getData<T>(key: string, defaultValue?: T): T | undefined {
    return (this.data[key] as T) ?? defaultValue;
  }

  // Lifecycle

  destroy(): void {
    this.active = false;
  }

  isAlive(): boolean {
    if (!this.health) return this.active;
    return this.active && this.health.current > 0;
  }

  // Damage handling

  takeDamage(amount: number): boolean {
    if (!this.health || this.health.invulnerable) return false;

    this.health.current = Math.max(0, this.health.current - amount);
    return this.health.current <= 0;
  }

  heal(amount: number): void {
    if (!this.health) return;
    this.health.current = Math.min(this.health.max, this.health.current + amount);
  }

  setInvulnerable(duration: number): void {
    if (!this.health) return;
    this.health.invulnerable = true;
    this.health.invulnerableTime = duration;
  }

  // Position helpers

  getCenter(): { x: number; y: number } {
    if (this.renderable) {
      if (this.renderable.type === 'rect' && this.renderable.width && this.renderable.height) {
        return {
          x: this.transform.x + this.renderable.width / 2,
          y: this.transform.y + this.renderable.height / 2,
        };
      }
    }
    return { x: this.transform.x, y: this.transform.y };
  }

  distanceTo(other: Entity): number {
    const a = this.getCenter();
    const b = other.getCenter();
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
}

// Entity pool for performance

export class EntityPool {
  private entities: Entity[] = [];

  add(entity: Entity): void {
    this.entities.push(entity);
  }

  remove(entity: Entity): void {
    const index = this.entities.indexOf(entity);
    if (index !== -1) {
      this.entities.splice(index, 1);
    }
  }

  getAll(): Entity[] {
    return this.entities;
  }

  getActive(): Entity[] {
    return this.entities.filter((e) => e.active);
  }

  getByFaction(faction: Faction): Entity[] {
    return this.entities.filter((e) => e.active && e.faction === faction);
  }

  getByTag(tag: string): Entity[] {
    return this.entities.filter((e) => e.active && e.hasTag(tag));
  }

  getById(id: number): Entity | undefined {
    return this.entities.find((e) => e.id === id);
  }

  clear(): void {
    this.entities = [];
  }

  cleanup(): void {
    this.entities = this.entities.filter((e) => e.active);
  }

  count(): number {
    return this.entities.length;
  }

  activeCount(): number {
    return this.entities.filter((e) => e.active).length;
  }
}
