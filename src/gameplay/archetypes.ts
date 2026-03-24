/**
 * Enemy Archetypes System
 *
 * 12 Archetypes with distinct behaviors:
 * - drifter: Slow, predictable descent
 * - chaser: Homes toward player lane
 * - sniper: Stationary, fires aimed shots
 * - swarm: Small units, overwhelm
 * - splitter: Breaks into 2+ on death
 * - shieldbearer: Front shield, must flank
 * - mimic: Copies player shot pattern
 * - anchor: Creates hazard field
 * - courier: Drops power-ups/traps on death
 * - phaser: Blinks, ignores some bullets
 * - weaver: Draws SVG spline hazards
 * - boss_chassis: Modular boss component
 */

import type { ArchetypeBehavior, EnemyArchetype } from '../content/schema';
import { ARCHETYPE_BEHAVIORS } from '../content/schema';
import { events } from '../core/events';

/**
 * All 12 archetypes
 */
export const ALL_ARCHETYPES: EnemyArchetype[] = [
  'drifter',
  'chaser',
  'sniper',
  'swarm',
  'splitter',
  'shieldbearer',
  'mimic',
  'anchor',
  'courier',
  'phaser',
  'weaver',
  'boss_chassis',
];

/**
 * Get behavior definition for an archetype
 */
export function getArchetypeBehavior(archetype: EnemyArchetype): ArchetypeBehavior {
  return ARCHETYPE_BEHAVIORS[archetype];
}

/**
 * Projectile fired by archetype entities
 */
export interface ArchetypeProjectile {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  radius: number;
  targetX?: number;
  targetY?: number;
}

/**
 * Hazard created by archetype entities
 */
export interface ArchetypeHazard {
  id: number;
  x: number;
  y: number;
  radius: number;
  damage: number;
  duration: number;
  elapsed: number;
}

/**
 * Player shot info for mimic
 */
export interface PlayerShotInfo {
  x: number;
  y: number;
  angle: number;
}

/**
 * Death callback type
 */
type DeathCallback = (effect: string | undefined, data: { x: number; y: number }) => void;

/**
 * Archetype Entity - An enemy with archetype-based behavior
 */
export class ArchetypeEntity {
  private static nextId = 0;

  readonly id: number;
  readonly archetype: EnemyArchetype;
  readonly visualHint: string;
  readonly maxHp: number;

  x: number;
  y: number;
  hp: number;
  speed: number;
  radius: number;

  // State
  isDead: boolean = false;
  isPhased: boolean = false;

  // Timing
  private time: number = 0;
  private attackCooldown: number = 0;
  private phaseCooldown: number = 0;

  // Combat
  private projectiles: ArchetypeProjectile[] = [];
  private hazards: ArchetypeHazard[] = [];
  private playerShots: PlayerShotInfo[] = [];
  private deathCallback: DeathCallback | null = null;

  // Behavior
  private behavior: ArchetypeBehavior;
  private weaverTrail: { x: number; y: number }[] = [];

  constructor(archetype: EnemyArchetype, x: number, y: number, overrides?: { hp?: number; speed?: number }) {
    this.id = ArchetypeEntity.nextId++;
    this.archetype = archetype;
    this.x = x;
    this.y = y;

    this.behavior = getArchetypeBehavior(archetype);
    this.visualHint = this.behavior.visualHint;

    // Apply base stats
    const baseHp = Math.max(1, Math.round(this.behavior.baseHp * 3)); // Scale HP
    const baseSpeed = this.behavior.baseSpeed * 100; // Scale speed

    this.hp = overrides?.hp ?? baseHp;
    this.maxHp = this.hp;
    this.speed = overrides?.speed ?? baseSpeed;

    // Set radius based on archetype
    this.radius = this.getRadiusForArchetype();
  }

  private getRadiusForArchetype(): number {
    switch (this.archetype) {
      case 'swarm':
        return 10;
      case 'boss_chassis':
        return 60;
      case 'anchor':
        return 30;
      case 'shieldbearer':
        return 25;
      default:
        return 18;
    }
  }

  /**
   * Register death callback
   */
  onDeath(callback: DeathCallback): void {
    this.deathCallback = callback;
  }

  /**
   * Update entity state
   */
  update(dt: number, playerX: number, playerY: number, options?: { screenWidth?: number }): void {
    if (this.isDead) return;

    this.time += dt;
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.phaseCooldown = Math.max(0, this.phaseCooldown - dt);

    // Update movement based on pattern
    this.updateMovement(dt, playerX, playerY, options?.screenWidth ?? 800);

    // Update attacks
    this.updateAttacks(dt, playerX, playerY);

    // Update hazards
    this.updateHazards(dt);

    // Update phase state for phaser
    if (this.archetype === 'phaser') {
      this.updatePhaseState(dt);
    }

    // Update weaver trail
    if (this.archetype === 'weaver') {
      this.updateWeaverTrail();
    }
  }

  private updateMovement(dt: number, playerX: number, _playerY: number, screenWidth: number): void {
    const pattern = this.behavior.movementPattern;

    switch (pattern) {
      case 'straight_descend':
        this.y += this.speed * dt;
        break;

      case 'slow_descend':
        this.y += this.speed * 0.5 * dt;
        break;

      case 'chase_player': {
        // Move toward player X
        const dx = playerX - this.x;
        const moveX = Math.sign(dx) * Math.min(Math.abs(dx), this.speed * dt);
        this.x += moveX;
        this.y += this.speed * 0.5 * dt;
        break;
      }

      case 'stationary':
        // Don't move
        break;

      case 'swarm_cluster':
        // Fast descent with slight randomness
        this.x += Math.sin(this.time * 5) * 20 * dt;
        this.y += this.speed * dt;
        break;

      case 'mirror_player': {
        // Mirror player position around screen center
        const center = screenWidth / 2;
        const targetX = center + (center - playerX);
        const mirrorDx = targetX - this.x;
        this.x += Math.sign(mirrorDx) * Math.min(Math.abs(mirrorDx), this.speed * dt);
        this.y += this.speed * 0.3 * dt;
        break;
      }

      case 'phase_shift':
        // Move with occasional teleport-like jumps
        if (!this.isPhased) {
          this.y += this.speed * dt;
          this.x += Math.sin(this.time * 3) * 30 * dt;
        }
        break;

      case 'weave_pattern':
        // Sinusoidal weaving
        this.x += Math.sin(this.time * 2) * 100 * dt;
        this.y += this.speed * dt;
        break;

      case 'boss_pattern':
        // Slow, deliberate movement
        this.y += this.speed * dt;
        break;

      case 'zigzag':
        // Zigzag pattern for courier
        this.x += Math.sin(this.time * 4) * 150 * dt;
        this.y += this.speed * dt;
        break;
    }
  }

  private updateAttacks(dt: number, playerX: number, playerY: number): void {
    if (!this.behavior.attackPattern || this.attackCooldown > 0) return;

    switch (this.behavior.attackPattern) {
      case 'aimed_shot':
        this.fireAimedShot(playerX, playerY);
        this.attackCooldown = 2; // 2 second cooldown
        break;

      case 'copy_player':
        this.fireCopiedShots();
        this.attackCooldown = 0.5;
        break;

      case 'hazard_field':
        this.createHazardField();
        this.attackCooldown = 3;
        break;

      case 'draw_hazard':
        // Handled in weaver trail update
        break;
    }

    // Update projectiles
    this.projectiles = this.projectiles.filter((p) => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      // Remove if off screen
      return p.y < 700 && p.y > -50 && p.x > -50 && p.x < 850;
    });
  }

  private fireAimedShot(playerX: number, playerY: number): void {
    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const speed = 200;

    this.projectiles.push({
      id: Date.now(),
      x: this.x,
      y: this.y,
      vx: (dx / dist) * speed,
      vy: (dy / dist) * speed,
      damage: 1,
      radius: 8,
      targetX: playerX,
      targetY: playerY,
    });
  }

  private fireCopiedShots(): void {
    if (this.playerShots.length === 0) return;

    // Fire back with similar pattern but reversed
    const shot = this.playerShots.shift()!;
    this.projectiles.push({
      id: Date.now(),
      x: this.x,
      y: this.y,
      vx: Math.cos(shot.angle + Math.PI) * 150,
      vy: Math.sin(shot.angle + Math.PI) * 150,
      damage: 1,
      radius: 6,
    });
  }

  private createHazardField(): void {
    this.hazards.push({
      id: Date.now(),
      x: this.x,
      y: this.y,
      radius: 80,
      damage: 1,
      duration: 5,
      elapsed: 0,
    });
  }

  private updateHazards(dt: number): void {
    this.hazards = this.hazards.filter((h) => {
      h.elapsed += dt;
      return h.elapsed < h.duration;
    });
  }

  private updatePhaseState(_dt: number): void {
    // Toggle phase every ~1.5 seconds
    if (this.phaseCooldown <= 0) {
      this.isPhased = !this.isPhased;
      this.phaseCooldown = 1.5;
    }
  }

  private updateWeaverTrail(): void {
    // Add current position to trail
    this.weaverTrail.push({ x: this.x, y: this.y });

    // Keep trail limited
    if (this.weaverTrail.length > 20) {
      this.weaverTrail.shift();
    }

    // Create hazard from trail periodically
    if (this.weaverTrail.length >= 10 && this.time > 1) {
      const midPoint = this.weaverTrail[Math.floor(this.weaverTrail.length / 2)];
      if (!this.hazards.some((h) => Math.abs(h.x - midPoint.x) < 20 && Math.abs(h.y - midPoint.y) < 20)) {
        this.hazards.push({
          id: Date.now(),
          x: midPoint.x,
          y: midPoint.y,
          radius: 30,
          damage: 1,
          duration: 3,
          elapsed: 0,
        });
      }
    }
  }

  /**
   * Register a player shot for mimic to copy
   */
  registerPlayerShot(shot: PlayerShotInfo): void {
    if (this.archetype === 'mimic') {
      this.playerShots.push(shot);
      // Keep limited
      if (this.playerShots.length > 5) {
        this.playerShots.shift();
      }
    }
  }

  /**
   * Set phased state (for phaser)
   */
  setPhased(phased: boolean): void {
    this.isPhased = phased;
  }

  /**
   * Take damage
   */
  takeDamage(amount: number): void {
    // Phaser ignores damage when phased
    if (this.archetype === 'phaser' && this.isPhased) {
      return;
    }

    this.hp = Math.max(0, this.hp - amount);

    if (this.hp <= 0) {
      this.die();
    }
  }

  /**
   * Take damage from a specific direction (for shieldbearer)
   */
  takeDamageFrom(amount: number, source: { x: number; y: number }): boolean {
    if (this.archetype === 'shieldbearer') {
      // Shield blocks attacks from below (front)
      const dy = source.y - this.y;
      if (dy > 0) {
        // Attack from front - blocked
        return true;
      }
    }

    this.takeDamage(amount);
    return false;
  }

  private die(): void {
    this.isDead = true;

    const effect = this.behavior.onDeathEffect;
    if (this.deathCallback) {
      this.deathCallback(effect, { x: this.x, y: this.y });
    }

    events.emit('enemy:death', {
      id: this.id.toString(),
      type: this.archetype,
      position: { x: this.x, y: this.y },
    });
  }

  /**
   * Get projectiles fired by this entity
   */
  getProjectiles(): ArchetypeProjectile[] {
    return [...this.projectiles];
  }

  /**
   * Get hazards created by this entity
   */
  getHazards(): ArchetypeHazard[] {
    return [...this.hazards];
  }
}

/**
 * Create an archetype entity
 */
export function createArchetypeEntity(
  archetype: EnemyArchetype,
  x: number,
  y: number,
  overrides?: { hp?: number; speed?: number },
): ArchetypeEntity {
  return new ArchetypeEntity(archetype, x, y, overrides);
}

/**
 * Archetype System - Manages all archetype entities
 */
export class ArchetypeSystem {
  private entities: ArchetypeEntity[] = [];
  private pendingSpawns: ArchetypeEntity[] = [];
  private totalSpawned: number = 0;
  private totalKilled: number = 0;
  private spawnedByArchetype: Map<EnemyArchetype, number> = new Map();

  /**
   * Spawn a single entity
   */
  spawn(archetype: EnemyArchetype, x: number, y: number, overrides?: { hp?: number; speed?: number }): ArchetypeEntity {
    const entity = createArchetypeEntity(archetype, x, y, overrides);

    // Set up splitter death handler
    if (archetype === 'splitter') {
      entity.onDeath((effect, data) => {
        if (effect === 'split_spawn') {
          // Queue child spawns
          const childHp = Math.max(1, Math.floor(entity.maxHp / 2));
          this.pendingSpawns.push(
            createArchetypeEntity('drifter', data.x - 20, data.y, { hp: childHp }),
            createArchetypeEntity('drifter', data.x + 20, data.y, { hp: childHp }),
          );
        }
      });
    }

    this.entities.push(entity);
    this.totalSpawned++;
    this.spawnedByArchetype.set(archetype, (this.spawnedByArchetype.get(archetype) ?? 0) + 1);

    events.emit('enemy:spawn', {
      type: archetype,
      x,
      y,
    });

    return entity;
  }

  /**
   * Spawn a line of entities
   */
  spawnLine(archetype: EnemyArchetype, count: number, startX: number, y: number, spacing: number): ArchetypeEntity[] {
    const entities: ArchetypeEntity[] = [];
    for (let i = 0; i < count; i++) {
      entities.push(this.spawn(archetype, startX + i * spacing, y));
    }
    return entities;
  }

  /**
   * Spawn a grid of entities
   */
  spawnGrid(
    archetype: EnemyArchetype,
    rows: number,
    cols: number,
    startX: number,
    startY: number,
    spacingX: number,
    spacingY: number,
  ): ArchetypeEntity[] {
    const entities: ArchetypeEntity[] = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        entities.push(this.spawn(archetype, startX + col * spacingX, startY + row * spacingY));
      }
    }
    return entities;
  }

  /**
   * Spawn a V formation
   */
  spawnVFormation(
    archetype: EnemyArchetype,
    count: number,
    centerX: number,
    y: number,
    spacing: number,
  ): ArchetypeEntity[] {
    const entities: ArchetypeEntity[] = [];
    const half = Math.floor(count / 2);

    for (let i = 0; i < count; i++) {
      const offset = i - half;
      const xOffset = offset * spacing;
      const yOffset = Math.abs(offset) * spacing * 0.5;
      entities.push(this.spawn(archetype, centerX + xOffset, y + yOffset));
    }

    return entities;
  }

  /**
   * Update all entities
   */
  update(dt: number, playerX: number, playerY: number, options?: { screenWidth?: number }): void {
    // Process pending spawns from splitters
    for (const spawn of this.pendingSpawns) {
      this.entities.push(spawn);
      this.totalSpawned++;
    }
    this.pendingSpawns = [];

    // Update all entities
    for (const entity of this.entities) {
      entity.update(dt, playerX, playerY, options);
    }

    // Remove dead entities and count kills
    const deadCount = this.entities.filter((e) => e.isDead).length;
    this.totalKilled += deadCount;
    this.entities = this.entities.filter((e) => !e.isDead);
  }

  /**
   * Get all entities
   */
  getEntities(): ArchetypeEntity[] {
    return [...this.entities];
  }

  /**
   * Get all projectiles from all entities
   */
  getAllProjectiles(): ArchetypeProjectile[] {
    return this.entities.flatMap((e) => e.getProjectiles());
  }

  /**
   * Get all hazards from all entities
   */
  getAllHazards(): ArchetypeHazard[] {
    return this.entities.flatMap((e) => e.getHazards());
  }

  /**
   * Check collision with player
   */
  checkPlayerCollision(playerX: number, playerY: number, playerRadius: number): ArchetypeEntity | null {
    for (const entity of this.entities) {
      const dx = entity.x - playerX;
      const dy = entity.y - playerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < entity.radius + playerRadius) {
        return entity;
      }
    }
    return null;
  }

  /**
   * Clear all entities
   */
  clear(): void {
    this.entities = [];
    this.pendingSpawns = [];
  }

  /**
   * Get total spawned count
   */
  getTotalSpawned(): number {
    return this.totalSpawned;
  }

  /**
   * Get total killed count
   */
  getTotalKilled(): number {
    return this.totalKilled;
  }

  /**
   * Get spawned count by archetype
   */
  getSpawnedByArchetype(archetype: EnemyArchetype): number {
    return this.spawnedByArchetype.get(archetype) ?? 0;
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.totalSpawned = 0;
    this.totalKilled = 0;
    this.spawnedByArchetype.clear();
  }
}

// Global archetype system instance
export const archetypeSystem = new ArchetypeSystem();
