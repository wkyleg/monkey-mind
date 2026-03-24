/**
 * AI Modifiers System
 *
 * 12 AI Modifiers that can be applied to archetypes:
 * - observed: Wakes only when player looks at it (eye-tracking ready)
 * - unseen: Vulnerable only when NOT looked at (eye-tracking ready)
 * - recursive: Respawns weaker copy on death
 * - bureaucratic: Must be shot in sequence (symbols)
 * - mythic: Fate shield, prophecy condition
 * - simulacrum: Fake enemy, vanishes on hit
 * - apophenic: Spawns trap patterns that look meaningful
 * - entropy: Shots accelerate over time
 * - koan: Defeated by "wrong" action
 * - labyrinthine: Emerges from maze walls
 * - liturgical: Wave timing follows rhythm
 * - incompleteness: Cannot be fully defeated, must escape
 */

import type { AIModifier, EnemyArchetype, ModifierEffect } from '../content/schema';
import { MODIFIER_EFFECTS } from '../content/schema';
import { events } from '../core/events';
import { type ArchetypeEntity, type ArchetypeProjectile, createArchetypeEntity } from './archetypes';

/**
 * All 12 modifiers
 */
export const ALL_MODIFIERS: AIModifier[] = [
  'observed',
  'unseen',
  'recursive',
  'bureaucratic',
  'mythic',
  'simulacrum',
  'apophenic',
  'entropy',
  'koan',
  'labyrinthine',
  'liturgical',
  'incompleteness',
];

/**
 * Get modifier effect definition
 */
export function getModifierEffect(modifier: AIModifier): ModifierEffect {
  return MODIFIER_EFFECTS[modifier];
}

/**
 * Trap pattern for apophenic modifier
 */
export interface TrapPattern {
  x: number;
  y: number;
  radius: number;
  patternType: string;
  damage: number;
}

/**
 * Visual state for rendering
 */
export interface VisualState {
  dormant?: boolean;
  faded?: boolean;
  translucent?: boolean;
  decaying?: boolean;
  zenCircle?: boolean;
  mazePattern?: boolean;
  musicalNotation?: boolean;
  infiniteSymbol?: boolean;
}

/**
 * Prophecy condition for mythic modifier
 */
export interface ProphecyCondition {
  type: 'time' | 'hits' | 'position';
  value: number;
  description: string;
}

/**
 * Recursive spawn callback
 */
type RecursiveSpawnCallback = (hp: number, x: number, y: number) => void;

/**
 * Modified Entity - An archetype entity with modifiers applied
 */
export class ModifiedEntity {
  private baseEntity: ArchetypeEntity;
  readonly modifiers: AIModifier[];
  readonly archetype: EnemyArchetype;

  // State
  private isObserved: boolean = false;
  private fateShieldActive: boolean = false;
  private sequenceSymbols: string[] = [];
  private currentSymbolIndex: number = 0;
  private rhythmBPM: number = 120;
  private beatTime: number = 0;
  private trapPatterns: TrapPattern[] = [];
  private prophecyCondition: ProphecyCondition | null = null;
  private isRecursiveSpawn: boolean = false;
  private recursiveSpawnCallback: RecursiveSpawnCallback | null = null;
  private wallPosition: { x: number; y: number } | null = null;
  private emergeProgress: number = 0;

  // Modified stats
  hp: number;
  maxHp: number;
  speed: number;

  constructor(
    archetype: EnemyArchetype,
    modifiers: AIModifier[],
    x: number,
    y: number,
    options?: { isRecursiveSpawn?: boolean },
  ) {
    this.baseEntity = createArchetypeEntity(archetype, x, y);
    this.archetype = archetype;
    this.modifiers = [...modifiers];
    this.isRecursiveSpawn = options?.isRecursiveSpawn ?? false;

    // Apply modifier stat changes
    let hpMod = 1;
    let speedMod = 1;

    for (const modifier of modifiers) {
      const effect = getModifierEffect(modifier);
      hpMod *= effect.hpMod;
      speedMod *= effect.speedMod;

      // Initialize modifier-specific state
      if (modifier === 'mythic') {
        this.fateShieldActive = true;
        this.prophecyCondition = this.generateProphecy();
      }
      if (modifier === 'bureaucratic') {
        this.sequenceSymbols = this.generateSequence();
      }
    }

    this.hp = Math.max(1, Math.round(this.baseEntity.hp * hpMod));
    this.maxHp = this.hp;
    this.speed = this.baseEntity.speed * speedMod;
  }

  private generateProphecy(): ProphecyCondition {
    const types: ProphecyCondition['type'][] = ['time', 'hits', 'position'];
    const type = types[Math.floor(Math.random() * types.length)];
    switch (type) {
      case 'time':
        return { type: 'time', value: 5, description: 'Survive 5 seconds' };
      case 'hits':
        return { type: 'hits', value: 3, description: 'Hit 3 times' };
      case 'position':
        return { type: 'position', value: 400, description: 'Reach y=400' };
    }
  }

  private generateSequence(): string[] {
    const symbols = ['α', 'β', 'γ', 'δ', 'ε'];
    const length = 2 + Math.floor(Math.random() * 2);
    return Array.from({ length }, () => symbols[Math.floor(Math.random() * symbols.length)]);
  }

  // Position getters/setters
  get x(): number {
    return this.baseEntity.x;
  }
  set x(value: number) {
    this.baseEntity.x = value;
  }

  get y(): number {
    return this.baseEntity.y;
  }
  set y(value: number) {
    this.baseEntity.y = value;
  }

  get radius(): number {
    return this.baseEntity.radius;
  }
  get isDead(): boolean {
    return this.baseEntity.isDead;
  }
  get id(): number {
    return this.baseEntity.id;
  }

  /**
   * Set gaze state (for observed/unseen modifiers)
   */
  setGazeState(observed: boolean): void {
    this.isObserved = observed;
  }

  /**
   * Check if being observed
   */
  isBeingObserved(): boolean {
    return this.isObserved;
  }

  /**
   * Update entity
   */
  update(dt: number, playerX: number, playerY: number): void {
    // Handle observed modifier - dormant when not observed
    if (this.modifiers.includes('observed') && !this.isObserved) {
      return; // Don't update when dormant
    }

    // Handle labyrinthine modifier - emerge from wall
    if (this.modifiers.includes('labyrinthine') && this.wallPosition) {
      this.emergeProgress += dt * 0.5;
      if (this.emergeProgress < 1) {
        const targetX = this.wallPosition.x < 400 ? 100 : 700;
        this.baseEntity.x = this.wallPosition.x + (targetX - this.wallPosition.x) * this.emergeProgress;
        return;
      }
      this.wallPosition = null;
    }

    // Handle liturgical modifier - move on beat
    if (this.modifiers.includes('liturgical')) {
      this.beatTime += dt;
      const beatInterval = 60 / this.rhythmBPM;
      const beatPhase = (this.beatTime % beatInterval) / beatInterval;

      // Only move significantly near the beat (phase close to 0 or 1)
      if (beatPhase > 0.1 && beatPhase < 0.9) {
        // Off beat - minimal movement
        this.baseEntity.update(dt * 0.1, playerX, playerY);
        return;
      }
    }

    // Normal update
    this.baseEntity.update(dt, playerX, playerY);

    // Handle entropy modifier - accelerate projectiles
    if (this.modifiers.includes('entropy')) {
      const projectiles = this.baseEntity.getProjectiles();
      for (const p of projectiles) {
        const acceleration = 1.5;
        p.vx *= 1 + (acceleration - 1) * dt;
        p.vy *= 1 + (acceleration - 1) * dt;
      }
    }

    // Handle apophenic modifier - spawn trap patterns
    if (this.modifiers.includes('apophenic')) {
      this.updateTrapPatterns(dt);
    }
  }

  private updateTrapPatterns(dt: number): void {
    // Spawn new trap patterns periodically
    if (Math.random() < dt * 0.5) {
      const patterns = ['spiral', 'grid', 'constellation', 'sigil'];
      this.trapPatterns.push({
        x: this.x + (Math.random() - 0.5) * 100,
        y: this.y + (Math.random() - 0.5) * 100,
        radius: 30,
        patternType: patterns[Math.floor(Math.random() * patterns.length)],
        damage: 1,
      });
    }

    // Limit trap count
    if (this.trapPatterns.length > 5) {
      this.trapPatterns.shift();
    }
  }

  /**
   * Take damage
   */
  takeDamage(amount: number): void {
    // Handle unseen modifier - invulnerable when observed
    if (this.modifiers.includes('unseen') && this.isObserved) {
      return;
    }

    // Handle koan modifier - normal attacks don't work
    if (this.modifiers.includes('koan')) {
      return;
    }

    // Handle incompleteness modifier - can't be killed
    if (this.modifiers.includes('incompleteness')) {
      this.hp = Math.max(1, this.hp - amount);
      return;
    }

    // Handle simulacrum modifier - vanish on any hit
    if (this.modifiers.includes('simulacrum')) {
      this.die();
      return;
    }

    // Handle mythic modifier - fate shield
    if (this.modifiers.includes('mythic') && this.fateShieldActive) {
      this.fateShieldActive = false;
      return;
    }

    this.hp = Math.max(0, this.hp - amount);
    if (this.hp <= 0) {
      this.die();
    }
  }

  /**
   * Take damage with symbol (for bureaucratic modifier)
   */
  takeDamageWithSymbol(amount: number, symbol: string): void {
    if (this.modifiers.includes('bureaucratic')) {
      if (this.sequenceSymbols[this.currentSymbolIndex] === symbol) {
        this.currentSymbolIndex++;
        this.hp = Math.max(0, this.hp - amount);
        if (this.hp <= 0) {
          this.die();
        }
      }
      return;
    }

    this.takeDamage(amount);
  }

  /**
   * Perform "wrong" action (for koan modifier)
   */
  performWrongAction(): void {
    if (this.modifiers.includes('koan')) {
      this.die();
    }
  }

  private die(): void {
    // Handle recursive modifier - spawn weaker copy
    if (this.modifiers.includes('recursive') && !this.isRecursiveSpawn) {
      const spawnHp = Math.max(1, Math.floor(this.maxHp * 0.5));
      if (this.recursiveSpawnCallback) {
        this.recursiveSpawnCallback(spawnHp, this.x, this.y);
      }
    }

    this.baseEntity.takeDamage(this.baseEntity.hp);

    events.emit('enemy:death', {
      id: this.id.toString(),
      type: this.archetype,
      position: { x: this.x, y: this.y },
    });
  }

  /**
   * Register recursive spawn callback
   */
  onRecursiveSpawn(callback: RecursiveSpawnCallback): void {
    this.recursiveSpawnCallback = callback;
  }

  /**
   * Get sequence symbols (for bureaucratic)
   */
  getSequenceSymbols(): string[] {
    return [...this.sequenceSymbols];
  }

  /**
   * Get current symbol index (for bureaucratic)
   */
  getCurrentSymbolIndex(): number {
    return this.currentSymbolIndex;
  }

  /**
   * Check if has fate shield (for mythic)
   */
  hasFateShield(): boolean {
    return this.fateShieldActive;
  }

  /**
   * Get prophecy condition (for mythic)
   */
  getProphecyCondition(): ProphecyCondition | null {
    return this.prophecyCondition;
  }

  /**
   * Check if gives score (simulacrum doesn't)
   */
  givesScore(): boolean {
    return !this.modifiers.includes('simulacrum');
  }

  /**
   * Get trap patterns (for apophenic)
   */
  getTrapPatterns(): TrapPattern[] {
    return [...this.trapPatterns];
  }

  /**
   * Get projectiles
   */
  getProjectiles(): ArchetypeProjectile[] {
    return this.baseEntity.getProjectiles();
  }

  /**
   * Check if requires escape (for incompleteness)
   */
  requiresEscape(): boolean {
    return this.modifiers.includes('incompleteness');
  }

  /**
   * Set wall position (for labyrinthine)
   */
  setWallPosition(x: number, y: number): void {
    this.wallPosition = { x, y };
    this.baseEntity.x = x;
    this.baseEntity.y = y;
    this.emergeProgress = 0;
  }

  /**
   * Set rhythm BPM (for liturgical)
   */
  setRhythm(bpm: number): void {
    this.rhythmBPM = bpm;
  }

  /**
   * Get rhythm BPM
   */
  getRhythmBPM(): number {
    return this.rhythmBPM;
  }

  /**
   * Get visual state for rendering
   */
  getVisualState(): VisualState {
    const state: VisualState = {};

    if (this.modifiers.includes('observed') && !this.isObserved) {
      state.dormant = true;
    }
    if (this.modifiers.includes('unseen') && this.isObserved) {
      state.faded = true;
    }
    if (this.modifiers.includes('simulacrum')) {
      state.translucent = true;
    }
    if (this.modifiers.includes('entropy')) {
      state.decaying = true;
    }
    if (this.modifiers.includes('koan')) {
      state.zenCircle = true;
    }
    if (this.modifiers.includes('labyrinthine')) {
      state.mazePattern = true;
    }
    if (this.modifiers.includes('liturgical')) {
      state.musicalNotation = true;
    }
    if (this.modifiers.includes('incompleteness')) {
      state.infiniteSymbol = true;
    }

    return state;
  }
}

/**
 * Apply a modifier to an entity
 */
export function applyModifier(entity: ArchetypeEntity | ModifiedEntity, modifier: AIModifier): ModifiedEntity {
  if (entity instanceof ModifiedEntity) {
    // Add modifier to existing modified entity
    const newModifiers = [...entity.modifiers, modifier];
    return new ModifiedEntity(entity.archetype, newModifiers, entity.x, entity.y);
  } else {
    // Create new modified entity from archetype entity
    return new ModifiedEntity(entity.archetype, [modifier], entity.x, entity.y);
  }
}

/**
 * Create a modified entity with archetype and modifiers
 */
export function createModifiedEntity(
  archetype: EnemyArchetype,
  modifiers: AIModifier[],
  x: number,
  y: number,
  options?: { isRecursiveSpawn?: boolean },
): ModifiedEntity {
  return new ModifiedEntity(archetype, modifiers, x, y, options);
}

/**
 * Modifier System - Manages all modified entities
 */
export class ModifierSystem {
  private entities: ModifiedEntity[] = [];
  private pendingSpawns: { archetype: EnemyArchetype; modifiers: AIModifier[]; x: number; y: number; hp: number }[] =
    [];
  private globalRhythm: number = 120;

  /**
   * Spawn a modified entity
   */
  spawn(
    archetype: EnemyArchetype,
    modifiers: AIModifier[],
    x: number,
    y: number,
    options?: { isRecursiveSpawn?: boolean },
  ): ModifiedEntity {
    const entity = createModifiedEntity(archetype, modifiers, x, y, options);

    // Set up recursive spawn handler
    if (modifiers.includes('recursive')) {
      entity.onRecursiveSpawn((hp, spawnX, spawnY) => {
        this.pendingSpawns.push({
          archetype,
          modifiers: modifiers.filter((m) => m !== 'recursive'), // Don't pass recursive to child
          x: spawnX,
          y: spawnY,
          hp,
        });
      });
    }

    // Apply global rhythm to liturgical entities
    if (modifiers.includes('liturgical')) {
      entity.setRhythm(this.globalRhythm);
    }

    this.entities.push(entity);

    events.emit('enemy:spawn', {
      type: archetype,
      x,
      y,
    });

    return entity;
  }

  /**
   * Update all entities
   */
  update(dt: number, playerX: number, playerY: number): void {
    // Process pending recursive spawns
    for (const spawn of this.pendingSpawns) {
      const entity = createModifiedEntity(spawn.archetype, spawn.modifiers, spawn.x, spawn.y, {
        isRecursiveSpawn: true,
      });
      entity.hp = spawn.hp;
      this.entities.push(entity);
    }
    this.pendingSpawns = [];

    // Update all entities
    for (const entity of this.entities) {
      entity.update(dt, playerX, playerY);
    }

    // Remove dead entities
    this.entities = this.entities.filter((e) => !e.isDead);
  }

  /**
   * Get all entities
   */
  getEntities(): ModifiedEntity[] {
    return [...this.entities];
  }

  /**
   * Set gaze position for observed/unseen modifiers
   */
  setGazePosition(gazeX: number, gazeY: number, gazeRadius: number): void {
    for (const entity of this.entities) {
      const dx = entity.x - gazeX;
      const dy = entity.y - gazeY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      entity.setGazeState(dist < gazeRadius);
    }
  }

  /**
   * Set global rhythm for liturgical entities
   */
  setGlobalRhythm(bpm: number): void {
    this.globalRhythm = bpm;
    for (const entity of this.entities) {
      if (entity.modifiers.includes('liturgical')) {
        entity.setRhythm(bpm);
      }
    }
  }

  /**
   * Get count of entities with a specific modifier
   */
  getCountByModifier(modifier: AIModifier): number {
    return this.entities.filter((e) => e.modifiers.includes(modifier)).length;
  }

  /**
   * Clear all entities
   */
  clear(): void {
    this.entities = [];
    this.pendingSpawns = [];
  }
}

// Global modifier system instance
export const modifierSystem = new ModifierSystem();
