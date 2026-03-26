/**
 * Weapon and projectile systems
 */

import { CONFIG } from '../config';
import { events } from '../core/events';
import { Entity, EntityPool } from '../engine/entity';
import type { Renderer } from '../engine/renderer';
import { svgAssets } from '../engine/svgAssets';
import { oscillate } from '../util/math';

export interface ProjectileOptions {
  x: number;
  y: number;
  speed?: number;
  damage?: number;
  type?: 'banana' | 'beam' | 'explosive';
  color?: string;
}

/**
 * Banana projectile entity
 */
export class Banana extends Entity {
  private rotationSpeed: number;
  private time: number = 0;
  private type: string;
  private explosive: boolean;
  damage: number;

  constructor(options: ProjectileOptions) {
    super(options.x, options.y, 'projectile', ['projectile', 'banana']);

    this.type = options.type ?? 'banana';
    this.damage = options.damage ?? 1;
    this.explosive = options.type === 'explosive';

    this.transform.vy = -(options.speed ?? CONFIG.BANANA_SPEED);
    this.rotationSpeed = 10 + Math.random() * 5;

    this.setRenderable({
      type: 'custom',
      color: options.color ?? CONFIG.COLORS.ACCENT,
      draw: (renderer, entity) => this.draw(renderer, entity as Banana),
    });

    this.setCollider({
      type: 'circle',
      radius: CONFIG.BANANA_SIZE,
    });

    events.emit('projectile:fire', { type: this.type });
  }

  /**
   * Update projectile
   */
  update(dt: number): void {
    this.time += dt;
    this.transform.y += this.transform.vy * dt;
    // Support horizontal velocity for multi-shot spread
    if (this.transform.vx) {
      this.transform.x += this.transform.vx * dt;
    }
    this.transform.rotation += this.rotationSpeed * dt;

    // Destroy if off screen
    if (this.transform.y < -50 || this.transform.x < -50 || this.transform.x > CONFIG.CANVAS_WIDTH + 50) {
      this.destroy();
    }
  }

  /**
   * Called when hitting an enemy
   */
  onHit(): void {
    events.emit('projectile:hit', { targetType: 'enemy' });

    if (!this.explosive) {
      this.destroy();
    }
  }

  /**
   * Custom draw function - uses SVG assets
   */
  private draw(renderer: Renderer, _banana: Banana): void {
    const { x, y, rotation } = this.transform;
    const ctx = renderer.context;

    // Determine which SVG to use
    const svgId = this.explosive ? 'projectiles/banana_explosive' : 'projectiles/banana';
    const color = this.explosive ? CONFIG.COLORS.PASSION : CONFIG.COLORS.ACCENT;
    const bananaSize = 30;

    // Try to render SVG
    const svgAsset = svgAssets.get(svgId);

    if (svgAsset) {
      svgAssets.render(ctx, svgId, {
        x,
        y,
        width: bananaSize,
        height: bananaSize,
        rotation,
        glow: this.explosive ? 15 : 10,
        glowColor: color,
      });

      // Explosive indicator ring
      if (this.explosive) {
        const pulse = oscillate(this.time, 4, 2);
        renderer.strokeCircle(x, y, 18 + pulse, CONFIG.COLORS.PASSION, 1);
      }
    } else {
      // Fallback to procedural rendering
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);

      ctx.shadowColor = color;
      ctx.shadowBlur = this.explosive ? 15 : 10;

      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.arc(0, 0, 10, Math.PI * 0.2, Math.PI * 0.8);
      ctx.stroke();

      ctx.fillStyle = '#8B4513';
      ctx.beginPath();
      ctx.arc(-6, 8, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(6, 8, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.restore();

      if (this.explosive) {
        const pulse = oscillate(this.time, 4, 2);
        renderer.strokeCircle(x, y, 15 + pulse, CONFIG.COLORS.PASSION, 1);
      }
    }
  }
}

/**
 * Beam projectile (calm mode)
 */
export class Beam extends Entity {
  private lifetime: number = 0.3;
  private time: number = 0;
  private hitEnemies: Set<number> = new Set(); // Track which enemies we've hit
  damage: number = 2;

  constructor(x: number, y: number, screenHeight: number) {
    super(x, y, 'projectile', ['projectile', 'beam']);

    this.setRenderable({
      type: 'custom',
      color: CONFIG.COLORS.CALM,
      draw: (renderer, entity) => this.draw(renderer, entity as Beam),
    });

    // Use a more reasonable collider height
    this.setCollider({
      type: 'aabb',
      width: 20,
      height: screenHeight,
      offsetX: -10,
      offsetY: -screenHeight,
    });
  }

  /**
   * Check if we've already hit this enemy
   */
  hasHitEnemy(enemyId: number): boolean {
    return this.hitEnemies.has(enemyId);
  }

  /**
   * Mark enemy as hit
   */
  markEnemyHit(enemyId: number): void {
    this.hitEnemies.add(enemyId);
  }

  update(dt: number): void {
    this.time += dt;
    if (this.time >= this.lifetime) {
      this.destroy();
    }
  }

  private draw(renderer: Renderer, _beam: Beam): void {
    const { x, y } = this.transform;
    const alpha = 1 - this.time / this.lifetime;
    const ctx = renderer.context;

    renderer.save();
    renderer.setAlpha(alpha);

    // Try to render beam SVG at the origin point
    const svgAsset = svgAssets.get('projectiles/beam');
    if (svgAsset) {
      // Render beam icon at firing point
      svgAssets.render(ctx, 'projectiles/beam', {
        x,
        y: y - 20,
        width: 40,
        height: 40,
        glow: 15,
        glowColor: CONFIG.COLORS.CALM,
        alpha,
      });
    }

    // Always render the beam line effect
    renderer.neonLine(x, y, x, 0, CONFIG.COLORS.CALM, 4);

    // Glow gradient
    const gradient = ctx.createLinearGradient(x, y, x, 0);
    gradient.addColorStop(0, `rgba(0, 170, 255, ${alpha * 0.5})`);
    gradient.addColorStop(1, `rgba(0, 170, 255, 0)`);

    ctx.fillStyle = gradient;
    ctx.fillRect(x - 20, 0, 40, y);

    renderer.restore();
  }
}

/**
 * Weapon manager
 */
export type WeaponMode = 'beam' | 'spray' | 'balanced' | 'flow';

export class WeaponSystem {
  private projectiles: EntityPool = new EntityPool();
  private screenHeight: number;

  // Weapon modes (powerup-driven, override neuro)
  private rapidFire: boolean = false;
  private precisionBeam: boolean = false;
  private explosiveBananas: boolean = false;
  private multiShot: boolean = false;

  // Neuro-driven weapon mode
  private currentMode: WeaponMode = 'balanced';
  private modeBlend = 0;
  private targetMode: WeaponMode = 'balanced';

  // Beam cooldown to prevent freeze
  private beamCooldown: number = 0;

  // Upgrade multipliers (from drops)
  private damageMultiplier: number = 1;
  private fireRateMultiplier: number = 1;

  // Enemies reference for flow mode homing
  private enemyPositions: Array<{ x: number; y: number }> = [];

  constructor(screenHeight: number) {
    this.screenHeight = screenHeight;
  }

  setNeuroState(calm: number, arousal: number): void {
    if (calm > 0.6 && arousal > 0.6) {
      this.targetMode = 'flow';
    } else if (calm > 0.7) {
      this.targetMode = 'beam';
    } else if (arousal > 0.7) {
      this.targetMode = 'spray';
    } else {
      this.targetMode = 'balanced';
    }
  }

  setEnemyPositions(positions: Array<{ x: number; y: number }>): void {
    this.enemyPositions = positions;
  }

  getWeaponMode(): WeaponMode {
    if (this.precisionBeam) return 'beam';
    if (this.rapidFire || this.multiShot) return 'spray';
    return this.currentMode;
  }

  private getEffectiveMode(): WeaponMode {
    if (this.precisionBeam) return 'beam';
    if (this.rapidFire || this.multiShot) return 'spray';
    return this.currentMode;
  }

  /**
   * Fire a projectile from player position
   */
  fire(x: number, y: number): void {
    const mode = this.getEffectiveMode();

    switch (mode) {
      case 'beam': {
        if (this.beamCooldown <= 0) {
          const beam = new Beam(x, y, this.screenHeight);
          beam.damage = 3 * this.damageMultiplier;
          this.projectiles.add(beam);
          this.beamCooldown = 0.4;
        }
        break;
      }
      case 'spray': {
        const baseDamage = this.explosiveBananas ? 2 : 1;
        const projectileType = this.explosiveBananas ? 'explosive' : 'banana';
        const spreadAngles = [-0.25, 0, 0.25];
        for (const angle of spreadAngles) {
          const banana = new Banana({
            x,
            y: y - 30,
            type: projectileType,
            damage: baseDamage * this.damageMultiplier * 0.6,
            color: '#ff6644',
          });
          banana.transform.vx = Math.sin(angle) * 120;
          this.projectiles.add(banana);
        }
        break;
      }
      case 'flow': {
        const banana = new Banana({
          x,
          y: y - 30,
          type: 'banana',
          damage: 2 * this.damageMultiplier,
          color: '#ffdd44',
        });
        (banana as any)._homing = true;
        (banana as any)._enemies = this.enemyPositions;
        this.projectiles.add(banana);
        break;
      }
      default: {
        const baseDamage = this.explosiveBananas ? 2 : 1;
        const projectileType = this.explosiveBananas ? 'explosive' : 'banana';
        const banana = new Banana({
          x,
          y: y - 30,
          type: projectileType,
          damage: baseDamage * this.damageMultiplier,
        });
        this.projectiles.add(banana);
        break;
      }
    }
  }

  /**
   * Update all projectiles
   */
  update(dt: number): void {
    // Update beam cooldown
    if (this.beamCooldown > 0) {
      this.beamCooldown -= dt;
    }

    // Smooth mode transitions
    if (this.currentMode !== this.targetMode) {
      this.modeBlend += dt * 2;
      if (this.modeBlend >= 1) {
        this.currentMode = this.targetMode;
        this.modeBlend = 0;
      }
    }

    for (const entity of this.projectiles.getActive()) {
      if (entity instanceof Banana) {
        // Flow mode homing
        if ((entity as any)._homing && (entity as any)._enemies) {
          const enemies = (entity as any)._enemies as Array<{ x: number; y: number }>;
          if (enemies.length > 0) {
            let nearest = enemies[0];
            let bestDist = Infinity;
            for (const e of enemies) {
              const dx = e.x - entity.transform.x;
              const dy = e.y - entity.transform.y;
              const dist = dx * dx + dy * dy;
              if (dist < bestDist) {
                bestDist = dist;
                nearest = e;
              }
            }
            const dx = nearest.x - entity.transform.x;
            const homingStrength = 150;
            entity.transform.vx = (entity.transform.vx || 0) + Math.sign(dx) * homingStrength * dt;
          }
        }
        entity.update(dt);
      } else if (entity instanceof Beam) {
        entity.update(dt);
      }
    }

    // Cleanup destroyed projectiles
    this.projectiles.cleanup();
  }

  /**
   * Render all projectiles
   */
  render(renderer: Renderer): void {
    for (const entity of this.projectiles.getActive()) {
      if (entity.renderable?.draw) {
        entity.renderable.draw(renderer, entity);
      }
    }
  }

  /**
   * Get all active projectiles
   */
  getProjectiles(): Entity[] {
    return this.projectiles.getActive();
  }

  /**
   * Set rapid fire mode
   */
  setRapidFire(active: boolean): void {
    this.rapidFire = active;
  }

  /**
   * Set precision beam mode
   */
  setPrecisionBeam(active: boolean): void {
    this.precisionBeam = active;
  }

  /**
   * Set explosive bananas mode
   */
  setExplosiveBananas(active: boolean): void {
    this.explosiveBananas = active;
  }

  /**
   * Set multi-shot mode (fire 3 projectiles at once)
   */
  setMultiShot(active: boolean): void {
    this.multiShot = active;
  }

  /**
   * Get fire rate modifier (lower = faster)
   */
  getFireRateModifier(): number {
    const mode = this.getEffectiveMode();
    let modeModifier = 1;
    if (mode === 'spray') modeModifier = 0.4;
    else if (mode === 'beam') modeModifier = 2.5;
    else if (mode === 'flow') modeModifier = 0.8;

    const powerupModifier = this.rapidFire ? 0.5 : 1;
    return modeModifier * powerupModifier * this.fireRateMultiplier;
  }

  /**
   * Set damage multiplier (from drops)
   */
  setDamageMultiplier(multiplier: number): void {
    this.damageMultiplier = multiplier;
  }

  /**
   * Set fire rate multiplier (from drops)
   */
  setFireRateMultiplier(multiplier: number): void {
    this.fireRateMultiplier = multiplier;
  }

  /**
   * Get current damage multiplier
   */
  getDamageMultiplier(): number {
    return this.damageMultiplier;
  }

  /**
   * Get current fire rate multiplier
   */
  getFireRateMultiplier(): number {
    return this.fireRateMultiplier;
  }

  /**
   * Check if precision beam is active
   */
  hasPrecisionBeam(): boolean {
    return this.precisionBeam;
  }

  /**
   * Check if explosive bananas are active
   */
  hasExplosiveBananas(): boolean {
    return this.explosiveBananas;
  }

  /**
   * Check if rapid fire is active
   */
  hasRapidFire(): boolean {
    return this.rapidFire;
  }

  /**
   * Clear all projectiles and reset powerups
   */
  clear(): void {
    this.projectiles.clear();
    this.rapidFire = false;
    this.precisionBeam = false;
    this.explosiveBananas = false;
    this.damageMultiplier = 1;
    this.fireRateMultiplier = 1;
  }
}
