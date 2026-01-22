/**
 * Enemy entities and behaviors
 */

import { Entity, EntityPool } from '../engine/entity';
import type { Renderer } from '../engine/renderer';
import type { EnemyData } from '../content/schema';
import { CONFIG } from '../config';
import { events } from '../core/events';
import { oscillate } from '../util/math';
import { contentLoader } from '../content/loader';
import { svgAssets } from '../engine/svgAssets';

export type BehaviorType = 'straight_descend' | 'zigzag' | 'orbit' | 'dive' | 'swarm';

export interface EnemyBehavior {
  update(enemy: Enemy, dt: number): void;
}

/**
 * Behavior implementations
 */
const behaviors: Record<BehaviorType, EnemyBehavior> = {
  straight_descend: {
    update(enemy: Enemy, dt: number): void {
      enemy.transform.y += enemy.speed * dt;
    },
  },
  
  zigzag: {
    update(enemy: Enemy, dt: number): void {
      enemy.transform.y += enemy.speed * dt;
      enemy.transform.x += Math.sin(enemy.getData<number>('time', 0)! * 3) * 100 * dt;
      enemy.setData('time', (enemy.getData<number>('time', 0) ?? 0) + dt);
    },
  },
  
  orbit: {
    update(enemy: Enemy, dt: number): void {
      const time = (enemy.getData<number>('time', 0) ?? 0) + dt;
      const startX = enemy.getData<number>('startX', enemy.transform.x) ?? enemy.transform.x;
      const radius = 50;
      
      enemy.transform.y += enemy.speed * 0.5 * dt;
      enemy.transform.x = startX + Math.sin(time * 2) * radius;
      enemy.setData('time', time);
    },
  },
  
  dive: {
    update(enemy: Enemy, dt: number): void {
      const time = (enemy.getData<number>('time', 0) ?? 0) + dt;
      const diveTime = 2;
      
      if (time < diveTime) {
        enemy.transform.y += enemy.speed * 0.3 * dt;
      } else {
        enemy.transform.y += enemy.speed * 3 * dt;
      }
      enemy.setData('time', time);
    },
  },
  
  swarm: {
    update(enemy: Enemy, dt: number): void {
      const time = (enemy.getData<number>('time', 0) ?? 0) + dt;
      enemy.transform.y += enemy.speed * dt;
      enemy.transform.x += Math.sin(time * 5 + enemy.id) * 50 * dt;
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
  readonly behavior: BehaviorType;
  readonly scoreValue: number;
  readonly speed: number;
  
  private time: number = 0;
  private pulsePhase: number;
  
  constructor(data: EnemyData, x: number, y: number) {
    super(x, y, 'enemy', ['enemy', `tier${data.tier}`]);
    
    this.enemyType = data.id;
    this.tier = data.tier;
    this.behavior = data.behavior as BehaviorType;
    this.scoreValue = data.scoreValue;
    this.speed = data.speed * CONFIG.ENEMY_BASE_SPEED;
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
    events.emit('enemy:damage', { id: this.id.toString(), amount });
    
    const killed = this.takeDamage(amount);
    
    if (killed) {
      events.emit('enemy:death', {
        id: this.id.toString(),
        type: this.enemyType,
        position: { x: this.transform.x, y: this.transform.y },
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
   * Custom draw - uses SVG assets when available
   */
  private draw(renderer: Renderer, _enemy: Enemy, data: EnemyData): void {
    const { x, y } = this.transform;
    const size = data.visual.size;
    const color = data.visual.color;
    
    // Pulse effect
    const pulse = oscillate(this.time + this.pulsePhase, 2, 2);
    const drawSize = size + pulse;
    
    // Health indicator (flash when damaged)
    const damageFlash = this.health && this.health.current < this.health.max;
    
    if (damageFlash && Math.sin(this.time * 20) > 0) {
      renderer.glowCircle(x, y, drawSize + 5, '#ffffff', 8);
    }
    
    // Try to render SVG asset first
    const svgId = `enemies/tier${this.tier}/${this.enemyType}`;
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
        case 3:
          const nodeCount = 3;
          for (let i = 0; i < nodeCount; i++) {
            const angle = (i / nodeCount) * Math.PI * 2 + this.time;
            const nodeX = x + Math.cos(angle) * drawSize * 0.5;
            const nodeY = y + Math.sin(angle) * drawSize * 0.5;
            renderer.fillCircle(nodeX, nodeY, 4, '#ffffff');
          }
          break;
        case 4:
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
