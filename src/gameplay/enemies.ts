/**
 * Enemy entities and behaviors
 */

import { CONFIG } from '../config';
import { contentLoader } from '../content/loader';
import type { EnemyData } from '../content/schema';
import { events } from '../core/events';
import { Entity, EntityPool } from '../engine/entity';
import type { Renderer } from '../engine/renderer';
import { svgAssets } from '../engine/svgAssets';
import { oscillate } from '../util/math';

export type BehaviorType =
  | 'straight_descend'
  | 'zigzag'
  | 'orbit'
  | 'dive'
  | 'swarm'
  | 'chase_player'
  | 'stationary'
  | 'swarm_cluster'
  | 'slow_descend'
  | 'phase_shift'
  | 'weave_pattern'
  | 'mirror_player'
  | 'boss_pattern';

export interface EnemyBehavior {
  update(enemy: Enemy, dt: number): void;
}

/**
 * Enhanced behavior implementations for all 12 archetypes
 * Each behavior is visually and mechanically distinct
 */
const behaviors: Record<BehaviorType, EnemyBehavior> = {
  // DRIFTER: Slow, meandering, peaceful-looking until provoked
  straight_descend: {
    update(enemy: Enemy, dt: number): void {
      const time = (enemy.getData<number>('time', 0) ?? 0) + dt;
      // Gentle drift with slight sway
      enemy.transform.y += enemy.speed * dt;
      enemy.transform.x += Math.sin(time * 0.5) * 15 * dt;
      enemy.setData('time', time);
    },
  },

  // CHASER: Aggressive pursuit of player
  chase_player: {
    update(enemy: Enemy, dt: number): void {
      const targetX = enemy.getData<number>('targetX', enemy.transform.x) ?? enemy.transform.x;
      const time = (enemy.getData<number>('time', 0) ?? 0) + dt;

      // Fast horizontal pursuit, slower vertical descent
      enemy.transform.y += enemy.speed * 0.5 * dt;

      // Aggressive tracking with acceleration
      const diff = targetX - enemy.transform.x;
      const chaseSpeed = 200 + Math.abs(diff) * 0.5; // Faster when far
      enemy.transform.x += Math.sign(diff) * Math.min(Math.abs(diff), chaseSpeed * dt);

      // Slight jitter for aggressive appearance
      enemy.transform.x += (Math.random() - 0.5) * 10 * dt;
      enemy.setData('time', time);
    },
  },

  // SNIPER: Stays at top, lines up shots (stationary with aiming)
  stationary: {
    update(enemy: Enemy, dt: number): void {
      const time = (enemy.getData<number>('time', 0) ?? 0) + dt;
      const targetX = enemy.getData<number>('targetX', enemy.transform.x) ?? enemy.transform.x;

      // Very slow descent, hover in place
      if (enemy.transform.y < 150) {
        enemy.transform.y += enemy.speed * 0.15 * dt;
      } else {
        // Hover with slight movement
        enemy.transform.y += Math.sin(time * 2) * 3 * dt;
      }

      // Slow tracking - "aiming"
      const diff = targetX - enemy.transform.x;
      enemy.transform.x += diff * 0.3 * dt;

      enemy.setData('time', time);
    },
  },

  // SWARM: Fast, erratic group movement
  swarm: {
    update(enemy: Enemy, dt: number): void {
      const time = (enemy.getData<number>('time', 0) ?? 0) + dt;
      const swarmOffset = enemy.id * 1.7; // Unique per swarm member

      // Fast descent with chaotic movement
      enemy.transform.y += enemy.speed * 1.3 * dt;
      enemy.transform.x += Math.sin(time * 6 + swarmOffset) * 60 * dt;
      enemy.transform.x += Math.cos(time * 4 + swarmOffset * 0.5) * 30 * dt;

      enemy.setData('time', time);
    },
  },

  // SWARM_CLUSTER: Tighter swarm, moves as unit
  swarm_cluster: {
    update(enemy: Enemy, dt: number): void {
      const time = (enemy.getData<number>('time', 0) ?? 0) + dt;
      const clusterOffset = enemy.id * 0.3;

      // Coordinated cluster movement
      enemy.transform.y += enemy.speed * 1.1 * dt;
      enemy.transform.x += Math.sin(time * 4 + clusterOffset) * 25 * dt;

      enemy.setData('time', time);
    },
  },

  // SPLITTER: Zigzag pattern, readying to split
  zigzag: {
    update(enemy: Enemy, dt: number): void {
      const time = (enemy.getData<number>('time', 0) ?? 0) + dt;

      // Sharp zigzag movement
      enemy.transform.y += enemy.speed * 0.8 * dt;

      // Sharp direction changes
      const zigPhase = Math.floor(time * 2) % 2;
      const zigDirection = zigPhase === 0 ? 1 : -1;
      enemy.transform.x += zigDirection * 120 * dt;

      enemy.setData('time', time);
    },
  },

  // SHIELDBEARER: Slow, deliberate, tank-like
  slow_descend: {
    update(enemy: Enemy, dt: number): void {
      const time = (enemy.getData<number>('time', 0) ?? 0) + dt;

      // Very slow, steady advance
      enemy.transform.y += enemy.speed * 0.35 * dt;

      // Minor lateral drift - "formation keeping"
      enemy.transform.x += Math.sin(time * 0.8) * 8 * dt;

      enemy.setData('time', time);
    },
  },

  // MIMIC: Mirrors player movement closely
  mirror_player: {
    update(enemy: Enemy, dt: number): void {
      const targetX = enemy.getData<number>('targetX', enemy.transform.x) ?? enemy.transform.x;
      const time = (enemy.getData<number>('time', 0) ?? 0) + dt;
      const screenWidth = enemy.getData<number>('screenWidth', 600) ?? 600;

      // Calculate mirrored position (opposite side of screen)
      const mirroredX = screenWidth - targetX;

      // Slow descent
      enemy.transform.y += enemy.speed * 0.4 * dt;

      // Smooth tracking to mirrored position
      const diff = mirroredX - enemy.transform.x;
      enemy.transform.x += diff * 3 * dt;

      enemy.setData('time', time);
    },
  },

  // ANCHOR: Orbits a fixed point, hard to hit
  orbit: {
    update(enemy: Enemy, dt: number): void {
      const time = (enemy.getData<number>('time', 0) ?? 0) + dt;
      const startX = enemy.getData<number>('startX', enemy.transform.x) ?? enemy.transform.x;
      const radius = 60 + Math.sin(time * 0.5) * 20; // Varying orbit radius

      // Slow vertical progress
      enemy.transform.y += enemy.speed * 0.3 * dt;

      // Smooth orbital motion
      enemy.transform.x = startX + Math.sin(time * 1.5) * radius;

      enemy.setData('time', time);
    },
  },

  // COURIER: Fast dive-bomb attacks
  dive: {
    update(enemy: Enemy, dt: number): void {
      const time = (enemy.getData<number>('time', 0) ?? 0) + dt;
      const divePhase = Math.floor(time / 2.5) % 2; // 2.5 second cycles
      const phaseTime = time % 2.5;

      if (divePhase === 0) {
        // Hover phase - slow descent, lateral movement
        enemy.transform.y += enemy.speed * 0.2 * dt;
        enemy.transform.x += Math.sin(time * 3) * 40 * dt;
      } else {
        // Dive phase - accelerating descent
        const diveAccel = 1 + phaseTime * 2;
        enemy.transform.y += enemy.speed * diveAccel * dt;
      }

      enemy.setData('time', time);
    },
  },

  // PHASER: Phases in and out of visibility/collision
  phase_shift: {
    update(enemy: Enemy, dt: number): void {
      const time = (enemy.getData<number>('time', 0) ?? 0) + dt;
      const cycleTime = 2.5; // Seconds per phase cycle
      const phaseTime = time % cycleTime;

      // Phase states: visible -> fading -> invisible -> appearing
      const isPhased = phaseTime > 0.8 && phaseTime < 1.8;
      const isFading = phaseTime > 0.6 && phaseTime <= 0.8;
      const isAppearing = phaseTime > 1.8 && phaseTime < 2.0;

      enemy.setData('phased', isPhased);
      enemy.setData('fading', isFading);
      enemy.setData('appearing', isAppearing);
      enemy.setData('phaseAlpha', isPhased ? 0.2 : isFading || isAppearing ? 0.5 : 1.0);

      // Movement when visible
      if (!isPhased) {
        enemy.transform.y += enemy.speed * dt;
        // Teleport-like horizontal movement when re-appearing
        if (isAppearing && phaseTime < 1.85) {
          enemy.transform.x += (Math.random() - 0.5) * 100;
        }
      }

      enemy.setData('time', time);
    },
  },

  // WEAVER: Complex figure-8/infinity pattern
  weave_pattern: {
    update(enemy: Enemy, dt: number): void {
      const time = (enemy.getData<number>('time', 0) ?? 0) + dt;
      const startX = enemy.getData<number>('startX', enemy.transform.x) ?? enemy.transform.x;

      // Slow vertical descent
      enemy.transform.y += enemy.speed * 0.5 * dt;

      // Figure-8 / infinity pattern
      const figureX = Math.sin(time * 1.2) * 80;
      const figureY = Math.sin(time * 2.4) * 20;

      enemy.transform.x = startX + figureX;
      enemy.transform.y += figureY * dt;

      enemy.setData('time', time);
    },
  },

  // BOSS: Imposing, slow, pattern-based
  boss_pattern: {
    update(enemy: Enemy, dt: number): void {
      const time = (enemy.getData<number>('time', 0) ?? 0) + dt;
      const phase = Math.floor(time / 5) % 3; // 5-second phases

      switch (phase) {
        case 0:
          // Sweep left to right
          enemy.transform.x += enemy.speed * 0.8 * dt;
          enemy.transform.y += enemy.speed * 0.1 * dt;
          break;
        case 1:
          // Sweep right to left
          enemy.transform.x -= enemy.speed * 0.8 * dt;
          enemy.transform.y += enemy.speed * 0.1 * dt;
          break;
        case 2:
          // Advance with menacing hover
          enemy.transform.y += enemy.speed * 0.3 * dt;
          enemy.transform.x += Math.sin(time * 2) * 20 * dt;
          break;
      }

      enemy.setData('time', time);
    },
  },
};

/**
 * Enemy entity
 */
export class Enemy extends Entity {
  readonly enemyType: string;
  readonly tier: number;
  private currentBehavior: BehaviorType;
  readonly scoreValue: number;
  readonly baseSpeed: number;

  // Modifiable properties for archetype system
  speedMod: number = 1.0;
  private modifiers: Set<string> = new Set();

  // Neuro-reactive states
  dormant = false;
  neuroInvulnerable = false;

  // Custom SVG ID for Act-specific visuals
  private customSvgId: string | null = null;

  // Dialogue enemy ID for level-specific dialogue lookup (simple ID like "zookeeper")
  private dialogueEnemyId: string | null = null;

  private time: number = 0;
  private pulsePhase: number;

  get behavior(): BehaviorType {
    return this.currentBehavior;
  }

  get speed(): number {
    return this.baseSpeed * this.speedMod;
  }

  constructor(data: EnemyData, x: number, y: number) {
    super(x, y, 'enemy', ['enemy', `tier${data.tier}`]);

    this.enemyType = data.id;
    this.tier = data.tier;
    this.currentBehavior = data.behavior as BehaviorType;
    this.scoreValue = data.scoreValue;
    this.baseSpeed = data.speed * CONFIG.ENEMY_BASE_SPEED;
    this.pulsePhase = Math.random() * Math.PI * 2;

    this.setData('startX', x);

    this.setRenderable({
      type: data.visual.type,
      color: data.visual.color,
      radius: data.visual.size,
      glow: data.visual.glow,
      draw: (renderer, entity) => this.draw(renderer, entity as Enemy, data),
    });

    this.setCollider({
      type: 'circle',
      radius: data.visual.size,
    });

    this.setHealth(data.hp);
    // Note: spawn event is emitted by Spawner with position data
  }

  /**
   * Update enemy
   */
  update(dt: number): void {
    this.time += dt;

    // Dormant enemies float in place
    if (this.dormant) {
      this.transform.y += 5 * dt;
      return;
    }

    // Apply behavior
    const behaviorImpl = behaviors[this.behavior];
    if (behaviorImpl) {
      behaviorImpl.update(this, dt);
    }
  }

  /**
   * Handle taking damage
   */
  onDamage(amount: number): boolean {
    if (this.neuroInvulnerable) return false;

    events.emit('enemy:damage', { id: this.id.toString(), amount });

    const killed = this.takeDamage(amount);

    if (killed) {
      events.emit('enemy:death', {
        id: this.id.toString(),
        type: this.enemyType,
        position: { x: this.transform.x, y: this.transform.y },
        actVisual: this.dialogueEnemyId || this.customSvgId || undefined,
      });
      this.destroy();
    }

    return killed;
  }

  /**
   * Check if enemy is off screen
   */
  isOffScreen(screenHeight: number): boolean {
    return this.transform.y > screenHeight + 50;
  }

  /**
   * Set the behavior pattern (used by SpawnerV2 for archetypes)
   */
  setBehavior(pattern: string): void {
    if (pattern in behaviors) {
      this.currentBehavior = pattern as BehaviorType;
    }
  }

  /**
   * Add a modifier to this enemy (used by SpawnerV2)
   */
  addModifier(modifierId: string): void {
    this.modifiers.add(modifierId);
  }

  /**
   * Check if enemy has a specific modifier
   */
  hasModifier(modifierId: string): boolean {
    return this.modifiers.has(modifierId);
  }

  /**
   * Set target X position for chase behaviors
   */
  setTargetX(x: number): void {
    this.setData('targetX', x);
  }

  /**
   * Set custom SVG ID for Act-specific visuals
   */
  setCustomSvgId(svgId: string): void {
    this.customSvgId = svgId;
  }

  /**
   * Set dialogue enemy ID for level-specific dialogue lookup
   * This is the simple ID (e.g., "zookeeper") not the full SVG path
   */
  setDialogueEnemyId(dialogueId: string): void {
    this.dialogueEnemyId = dialogueId;
  }

  /**
   * Get the dialogue enemy ID for dialogue lookup
   */
  getDialogueEnemyId(): string | null {
    return this.dialogueEnemyId;
  }

  /**
   * Get the SVG ID to use for rendering
   */
  getSvgId(): string {
    return this.customSvgId || `enemies/tier${this.tier}/${this.enemyType}`;
  }

  /**
   * Custom draw - uses SVG assets when available
   */
  private draw(renderer: Renderer, _enemy: Enemy, data: EnemyData): void {
    const { x, y } = this.transform;
    const size = data.visual.size;
    const color = data.visual.color;
    const ctx = renderer.context;

    // Dormant visual: 40% opacity with shimmer
    if (this.dormant) {
      ctx.save();
      ctx.globalAlpha = 0.35 + Math.sin(this.time * 3) * 0.1;
    }

    // Pulse effect
    const pulse = oscillate(this.time + this.pulsePhase, 2, 2);
    const drawSize = size + pulse;

    // Health indicator (flash when damaged)
    const damageFlash = this.health && this.health.current < this.health.max;

    if (damageFlash && Math.sin(this.time * 20) > 0) {
      renderer.glowCircle(x, y, drawSize + 5, '#ffffff', 8);
    }

    // Try to render SVG asset first (custom Act-specific or tier-based)
    const svgId = this.getSvgId();
    const svgAsset = svgAssets.get(svgId);

    if (svgAsset) {
      // Render SVG with glow effect
      const ctx = renderer.context;
      ctx.save();

      // Apply glow if specified
      if (data.visual.glow) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;
      }

      // Slight rotation animation for visual interest
      const rotationOffset = this.tier === 2 ? this.time * 0.5 : 0;

      svgAssets.render(ctx, svgId, {
        x,
        y,
        width: drawSize * 2.5,
        height: drawSize * 2.5,
        rotation: rotationOffset,
        glow: data.visual.glow ? 10 : 0,
        glowColor: color,
      });

      ctx.restore();
    } else {
      // Fallback to procedural rendering
      if (data.visual.glow) {
        renderer.glowCircle(x, y, drawSize, color, 12);
      } else {
        renderer.fillCircle(x, y, drawSize, color);
      }

      // Tier-specific details (fallback only)
      switch (this.tier) {
        case 1:
          renderer.fillCircle(x, y, drawSize * 0.5, '#ffffff');
          break;
        case 2:
          renderer.fillCircle(x, y, drawSize * 0.6, '#000000');
          renderer.fillCircle(x, y, drawSize * 0.3, '#ffffff');
          break;
        case 3: {
          const nodeCount = 3;
          for (let i = 0; i < nodeCount; i++) {
            const angle = (i / nodeCount) * Math.PI * 2 + this.time;
            const nodeX = x + Math.cos(angle) * drawSize * 0.5;
            const nodeY = y + Math.sin(angle) * drawSize * 0.5;
            renderer.fillCircle(nodeX, nodeY, 4, '#ffffff');
          }
          break;
        }
        case 4: {
          renderer.strokeCircle(x, y, drawSize * 0.7, '#ffffff', 2);
          const rayCount = 6;
          for (let i = 0; i < rayCount; i++) {
            const angle = (i / rayCount) * Math.PI * 2 + this.time * 0.5;
            const endX = x + Math.cos(angle) * drawSize * 1.5;
            const endY = y + Math.sin(angle) * drawSize * 1.5;
            renderer.neonLine(x, y, endX, endY, color, 1);
          }
          break;
        }
      }
    }

    // Health bar (if damaged)
    if (this.health && this.health.current < this.health.max) {
      const barWidth = size * 2;
      const barHeight = 4;
      const barX = x - barWidth / 2;
      const barY = y - size - 12;
      const healthPercent = this.health.current / this.health.max;

      renderer.fillRect(barX, barY, barWidth, barHeight, '#1a1a2e');
      renderer.fillRect(barX, barY, barWidth * healthPercent, barHeight, CONFIG.COLORS.DANGER);
      renderer.strokeRect(barX, barY, barWidth, barHeight, CONFIG.COLORS.DANGER, 1);
    }

    // Invulnerable shield overlay
    if (this.neuroInvulnerable) {
      ctx.save();
      ctx.strokeStyle = '#44aaff';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.5 + Math.sin(this.time * 4) * 0.2;
      ctx.shadowColor = '#44aaff';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(x, y, drawSize + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Close dormant alpha save
    if (this.dormant) {
      ctx.restore();
    }
  }
}

/**
 * Enemy manager
 */
export class EnemySystem {
  private enemies: EntityPool = new EntityPool();
  private readonly screenWidth: number;
  private readonly screenHeight: number;

  constructor(screenWidth: number, screenHeight: number) {
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;
  }

  /**
   * Spawn an enemy
   */
  spawn(enemyId: string, x: number, y: number = CONFIG.ENEMY_SPAWN_Y): Enemy | null {
    const data = contentLoader.getEnemy(enemyId);
    if (!data) {
      console.warn(`Enemy not found: ${enemyId}`);
      return null;
    }

    const enemy = new Enemy(data, x, y);
    this.enemies.add(enemy);
    return enemy;
  }

  /**
   * Spawn enemies in a line pattern
   */
  spawnLine(enemyId: string, count: number, spacing: number = 100, centerX?: number): Enemy[] {
    const cx = centerX ?? this.screenWidth / 2;
    const startX = cx - ((count - 1) * spacing) / 2;
    const spawned: Enemy[] = [];

    for (let i = 0; i < count; i++) {
      const enemy = this.spawn(enemyId, startX + i * spacing);
      if (enemy) spawned.push(enemy);
    }

    return spawned;
  }

  /**
   * Spawn enemies in a grid pattern
   */
  spawnGrid(enemyId: string, rows: number, cols: number, spacingX: number = 80, spacingY: number = 60): Enemy[] {
    const startX = (this.screenWidth - (cols - 1) * spacingX) / 2;
    const spawned: Enemy[] = [];

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = startX + col * spacingX;
        const y = CONFIG.ENEMY_SPAWN_Y - row * spacingY;
        const enemy = this.spawn(enemyId, x, y);
        if (enemy) spawned.push(enemy);
      }
    }

    return spawned;
  }

  /**
   * Update all enemies
   */
  update(dt: number): void {
    for (const entity of this.enemies.getActive()) {
      const enemy = entity as Enemy;
      enemy.update(dt);

      // Remove if off screen
      if (enemy.isOffScreen(this.screenHeight)) {
        enemy.destroy();
      }
    }

    this.enemies.cleanup();
  }

  /**
   * Render all enemies
   */
  render(renderer: Renderer): void {
    for (const entity of this.enemies.getActive()) {
      if (entity.renderable?.draw) {
        entity.renderable.draw(renderer, entity);
      }
    }
  }

  /**
   * Get all active enemies
   */
  getEnemies(): Entity[] {
    return this.enemies.getActive();
  }

  /**
   * Get enemy count
   */
  count(): number {
    return this.enemies.activeCount();
  }

  /**
   * Clear all enemies
   */
  clear(): void {
    this.enemies.clear();
  }
}
