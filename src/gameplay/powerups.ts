/**
 * Powerup system
 */

import { contentLoader } from '../content/loader';
import type { PowerupData } from '../content/schema';
import { events } from '../core/events';
import { Entity, EntityPool } from '../engine/entity';
import type { Renderer } from '../engine/renderer';
import { svgAssets } from '../engine/svgAssets';
import { oscillate } from '../util/math';
import type { Player } from './player';
import type { WeaponSystem } from './weapons';

// Shape constants for powerup types - unique geometric shapes per powerup
const POWERUP_SHAPES: Record<string, { sides: number; rotation: number; scale: number }> = {
  // Calm/defensive powerups (cool colors)
  calm_shield: { sides: 6, rotation: 0, scale: 1.2 }, // Hexagon - protection
  calm_beam: { sides: 8, rotation: Math.PI / 8, scale: 1.1 }, // Octagon - precision
  calm_time_slow: { sides: 12, rotation: 0, scale: 1.0 }, // Dodecagon - time/clock
  calm_ghost: { sides: 3, rotation: 0, scale: 1.3 }, // Triangle - ethereal

  // Passion/offensive powerups (warm colors)
  passion_fury: { sides: 5, rotation: -Math.PI / 2, scale: 1.3 }, // Star/Pentagon - power
  passion_explosive: { sides: 4, rotation: Math.PI / 4, scale: 1.2 }, // Diamond - explosion
  passion_multi_shot: { sides: 7, rotation: 0, scale: 1.15 }, // Heptagon - spread
  passion_magnet: { sides: 10, rotation: 0, scale: 1.1 }, // Decagon - attraction
};

// Particle trail data
interface PowerupParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
}

/**
 * Powerup pickup entity - highly visible and distinct from enemies
 */
export class PowerupPickup extends Entity {
  readonly powerupId: string;
  readonly category: 'calm' | 'passion' | 'neutral';
  private time: number = 0;
  private particles: PowerupParticle[] = [];
  private lastParticleSpawn: number = 0;

  constructor(data: PowerupData, x: number, y: number) {
    super(x, y, 'pickup', ['pickup', 'powerup', data.category]);

    this.powerupId = data.id;
    this.category = data.category;

    this.setRenderable({
      type: 'custom',
      color: data.visual.color,
      draw: (renderer, entity) => this.draw(renderer, entity as PowerupPickup, data),
    });

    this.setCollider({
      type: 'circle',
      radius: 35, // Larger collision area
    });

    // Slower descent to be more catchable
    this.transform.vy = 40;

    events.emit('powerup:spawn', { id: this.id.toString(), type: data.id });
  }

  update(dt: number, screenHeight: number): void {
    this.time += dt;
    this.transform.y += this.transform.vy * dt;

    // Spawn particle trail
    if (this.time - this.lastParticleSpawn > 0.05) {
      this.spawnParticle();
      this.lastParticleSpawn = this.time;
    }

    // Update particles
    for (const particle of this.particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    // Destroy if off screen
    if (this.transform.y > screenHeight + 50) {
      this.destroy();
    }
  }

  private spawnParticle(): void {
    const angle = Math.random() * Math.PI * 2;
    const speed = 30 + Math.random() * 20;
    this.particles.push({
      x: this.transform.x + (Math.random() - 0.5) * 20,
      y: this.transform.y + (Math.random() - 0.5) * 20,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 20, // Drift upward
      life: 0.8 + Math.random() * 0.4,
      maxLife: 1.2,
      size: 3 + Math.random() * 4,
    });
  }

  private draw(renderer: Renderer, _pickup: PowerupPickup, data: PowerupData): void {
    const { x, y } = this.transform;
    const ctx = renderer.context;

    // Get colors based on category
    const isCalm = this.category === 'calm';
    const primaryColor = isCalm ? '#00ffff' : '#ff6644';
    const secondaryColor = isCalm ? '#00aaff' : '#ffaa00';
    const glowColor = isCalm ? '#00ddff' : '#ff4422';

    // Floating animation (more pronounced)
    const float = oscillate(this.time, 1.5, 8);
    const drawY = y + float;

    // Pulsing scale
    const pulse = 1 + oscillate(this.time, 3, 0.15);
    const powerupSize = 80 * pulse;

    // Draw particle trail first (behind powerup)
    this.drawParticles(ctx, primaryColor);

    // Outer glow ring (large and attention-grabbing)
    ctx.save();
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 30;
    const gradient = ctx.createRadialGradient(x, drawY, 10, x, drawY, powerupSize / 2 + 20);
    gradient.addColorStop(0, `${glowColor}88`);
    gradient.addColorStop(0.5, `${glowColor}44`);
    gradient.addColorStop(1, `${glowColor}00`);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, drawY, powerupSize / 2 + 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Rotating outer ring
    const ringAngle = this.time * 2;
    ctx.save();
    ctx.shadowColor = primaryColor;
    ctx.shadowBlur = 15;
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 3;
    ctx.setLineDash([15, 10]);
    ctx.lineDashOffset = -this.time * 50;
    ctx.beginPath();
    ctx.arc(x, drawY, powerupSize / 2 + 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Inner rotating arcs
    ctx.save();
    ctx.strokeStyle = secondaryColor;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(x, drawY, powerupSize / 2 - 5, ringAngle, ringAngle + Math.PI * 0.7);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, drawY, powerupSize / 2 - 5, ringAngle + Math.PI, ringAngle + Math.PI * 1.7);
    ctx.stroke();
    ctx.restore();

    // Main shape based on powerup type
    const shapeConfig = POWERUP_SHAPES[data.id] || { sides: 6, rotation: 0, scale: 1 };
    this.drawPowerupShape(
      ctx,
      x,
      drawY,
      (powerupSize / 2 - 15) * shapeConfig.scale,
      shapeConfig.sides,
      shapeConfig.rotation + this.time * 0.5,
      primaryColor,
      secondaryColor,
    );

    // Determine SVG ID and check for asset
    const svgId = `powerups/${data.id}`;
    const svgAsset = svgAssets.get(svgId);

    if (svgAsset) {
      // Render SVG powerup icon with glow
      ctx.save();
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 10;
      svgAssets.render(ctx, svgId, {
        x,
        y: drawY,
        width: powerupSize * 0.6,
        height: powerupSize * 0.6,
        rotation: oscillate(this.time, 8, 0.1),
        glow: 20,
        glowColor: primaryColor,
      });
      ctx.restore();
    } else {
      // Fallback icon with better rendering
      this.drawPowerupIcon(ctx, x, drawY, data.visual.icon, powerupSize * 0.35);
    }

    // "POWER" label above
    ctx.save();
    ctx.shadowColor = primaryColor;
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#ffffff';
    ctx.font = "bold 12px 'SF Mono', Consolas, monospace";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.strokeText('POWER', x, drawY - powerupSize / 2 - 15);
    ctx.fillText('POWER', x, drawY - powerupSize / 2 - 15);
    ctx.restore();

    // Powerup name below
    ctx.save();
    ctx.shadowColor = primaryColor;
    ctx.shadowBlur = 6;
    ctx.fillStyle = primaryColor;
    ctx.font = "bold 10px 'SF Mono', Consolas, monospace";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const name = data.id.replace('_', ' ').toUpperCase();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeText(name, x, drawY + powerupSize / 2 + 12);
    ctx.fillText(name, x, drawY + powerupSize / 2 + 12);
    ctx.restore();
  }

  private drawParticles(ctx: CanvasRenderingContext2D, color: string): void {
    for (const particle of this.particles) {
      const alpha = particle.life / particle.maxLife;
      ctx.save();
      ctx.globalAlpha = alpha * 0.7;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size * alpha, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawPowerupShape(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    sides: number,
    rotation: number,
    fillColor: string,
    strokeColor: string,
  ): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);

    // Fill with gradient
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.3, fillColor);
    gradient.addColorStop(1, strokeColor);

    ctx.fillStyle = gradient;
    ctx.shadowColor = fillColor;
    ctx.shadowBlur = 15;

    ctx.beginPath();
    for (let i = 0; i <= sides; i++) {
      const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
      const px = Math.cos(angle) * radius;
      const py = Math.sin(angle) * radius;
      if (i === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.closePath();
    ctx.fill();

    // Stroke
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.restore();
  }

  private drawPowerupIcon(ctx: CanvasRenderingContext2D, x: number, y: number, icon: string, size: number): void {
    ctx.save();
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#ffffff';
    ctx.font = `${size}px 'SF Mono', Consolas, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let symbol = '★';
    switch (icon) {
      case 'shield':
        symbol = '◆';
        break;
      case 'flame':
        symbol = '✦';
        break;
      case 'bolt':
        symbol = '⚡';
        break;
      case 'beam':
        symbol = '◇';
        break;
    }

    ctx.fillText(symbol, x, y);
    ctx.restore();
  }
}

/**
 * Active powerup effect
 */
export interface ActivePowerup {
  id: string;
  data: PowerupData;
  timeRemaining: number;
}

// Drop tables for powerup drops - expanded with new powerup types
const DROP_TABLES: Record<string, { powerupId: string; weight: number }[]> = {
  calm: [
    { powerupId: 'calm_shield', weight: 35 },
    { powerupId: 'calm_beam', weight: 25 },
    { powerupId: 'calm_time_slow', weight: 20 },
    { powerupId: 'calm_ghost', weight: 20 },
  ],
  passion: [
    { powerupId: 'passion_fury', weight: 30 },
    { powerupId: 'passion_explosive', weight: 25 },
    { powerupId: 'passion_multi_shot', weight: 25 },
    { powerupId: 'passion_magnet', weight: 20 },
  ],
};

/**
 * Powerup manager
 */
export class PowerupSystem {
  private pickups: EntityPool = new EntityPool();
  private activePowerups: Map<string, ActivePowerup> = new Map();

  private player: Player | null = null;
  private weapons: WeaponSystem | null = null;

  private readonly screenHeight: number;

  // Drop rate settings
  private readonly baseDropRate: number = 0.12; // 12% base drop chance
  private dropRateBonus: number = 0;

  constructor(screenHeight: number) {
    this.screenHeight = screenHeight;
  }

  /**
   * Connect to player and weapon systems
   */
  connect(player: Player, weapons: WeaponSystem): void {
    this.player = player;
    this.weapons = weapons;
  }

  /**
   * Spawn a powerup pickup
   */
  spawn(powerupId: string, x: number, y: number): PowerupPickup | null {
    const data = contentLoader.getPowerup(powerupId);
    if (!data) {
      console.warn(`Powerup not found: ${powerupId}`);
      return null;
    }

    const pickup = new PowerupPickup(data, x, y);
    this.pickups.add(pickup);
    return pickup;
  }

  /**
   * Try to drop a powerup from an enemy death
   * Returns true if a powerup was dropped
   */
  tryDrop(x: number, y: number, enemyTier: number = 1): boolean {
    // Calculate drop chance based on tier
    const tierBonus = (enemyTier - 1) * 0.05; // Higher tier = better drop rate
    const dropChance = this.baseDropRate + tierBonus + this.dropRateBonus;

    if (Math.random() > dropChance) {
      return false;
    }

    // Select category based on random
    const category = Math.random() > 0.5 ? 'calm' : 'passion';
    const table = DROP_TABLES[category];

    if (!table || table.length === 0) {
      return false;
    }

    // Weighted random selection
    const totalWeight = table.reduce((sum, item) => sum + item.weight, 0);
    let random = Math.random() * totalWeight;

    for (const item of table) {
      random -= item.weight;
      if (random <= 0) {
        this.spawn(item.powerupId, x, y);
        return true;
      }
    }

    // Fallback to first item
    this.spawn(table[0].powerupId, x, y);
    return true;
  }

  /**
   * Set drop rate bonus (e.g., from upgrades)
   */
  setDropRateBonus(bonus: number): void {
    this.dropRateBonus = bonus;
  }

  /**
   * Collect a powerup
   */
  collect(pickup: PowerupPickup): void {
    const data = contentLoader.getPowerup(pickup.powerupId);
    if (!data) return;

    // Add to active powerups
    this.activePowerups.set(pickup.powerupId, {
      id: pickup.powerupId,
      data,
      timeRemaining: data.durationMs / 1000,
    });

    // Apply effect
    this.applyEffect(data);

    // Emit event
    events.emit('powerup:collect', { type: pickup.powerupId, effect: data.effect });

    // Destroy pickup
    pickup.destroy();
  }

  /**
   * Apply powerup effect - supports all powerup types
   */
  private applyEffect(data: PowerupData): void {
    switch (data.effect) {
      // Calm/defensive powerups
      case 'shield':
        this.player?.setShield(true);
        break;
      case 'precision_beam':
        this.weapons?.setPrecisionBeam(true);
        break;
      case 'time_slow':
        // Emit event for game to handle time slow
        events.emit('powerup:time_slow', { active: true, factor: 0.5 });
        break;
      case 'ghost':
        this.player?.setGhost(true);
        break;

      // Passion/offensive powerups
      case 'rapid_fire':
        this.weapons?.setRapidFire(true);
        break;
      case 'explosive':
        this.weapons?.setExplosiveBananas(true);
        break;
      case 'multi_shot':
        this.weapons?.setMultiShot(true);
        break;
      case 'magnet':
        // Emit event for pickup attraction
        events.emit('powerup:magnet', { active: true, range: 150 });
        break;
    }
  }

  /**
   * Remove powerup effect
   */
  private removeEffect(data: PowerupData): void {
    switch (data.effect) {
      // Calm/defensive powerups
      case 'shield':
        this.player?.setShield(false);
        break;
      case 'precision_beam':
        this.weapons?.setPrecisionBeam(false);
        break;
      case 'time_slow':
        events.emit('powerup:time_slow', { active: false, factor: 1.0 });
        break;
      case 'ghost':
        this.player?.setGhost(false);
        break;

      // Passion/offensive powerups
      case 'rapid_fire':
        this.weapons?.setRapidFire(false);
        break;
      case 'explosive':
        this.weapons?.setExplosiveBananas(false);
        break;
      case 'multi_shot':
        this.weapons?.setMultiShot(false);
        break;
      case 'magnet':
        events.emit('powerup:magnet', { active: false, range: 0 });
        break;
    }

    events.emit('powerup:expire', { type: data.id });
  }

  /**
   * Update powerup system
   */
  update(dt: number): void {
    // Update pickups
    for (const entity of this.pickups.getActive()) {
      const pickup = entity as PowerupPickup;
      pickup.update(dt, this.screenHeight);
    }
    this.pickups.cleanup();

    // Update active powerups
    for (const [id, powerup] of this.activePowerups) {
      powerup.timeRemaining -= dt;

      if (powerup.timeRemaining <= 0) {
        this.removeEffect(powerup.data);
        this.activePowerups.delete(id);
      }
    }
  }

  /**
   * Render pickups
   */
  render(renderer: Renderer): void {
    for (const entity of this.pickups.getActive()) {
      if (entity.renderable?.draw) {
        entity.renderable.draw(renderer, entity);
      }
    }
  }

  /**
   * Get all pickup entities
   */
  getPickups(): Entity[] {
    return this.pickups.getActive();
  }

  /**
   * Get active powerup info for HUD (legacy - single powerup)
   */
  getActiveInfo(): { id: string; timeRemaining: number } | null {
    // Return first active powerup for HUD display
    for (const [id, powerup] of this.activePowerups) {
      return {
        id,
        timeRemaining: powerup.timeRemaining / (powerup.data.durationMs / 1000),
      };
    }
    return null;
  }

  /**
   * Get all active powerups for HUD display (supports stacking)
   */
  getAllActive(): Array<{ id: string; timeRemaining: number; category: string; color: string }> {
    const active: Array<{ id: string; timeRemaining: number; category: string; color: string }> = [];

    for (const [id, powerup] of this.activePowerups) {
      active.push({
        id,
        timeRemaining: powerup.timeRemaining / (powerup.data.durationMs / 1000),
        category: powerup.data.category,
        color: powerup.data.visual.color,
      });
    }

    return active;
  }

  /**
   * Get count of active powerups
   */
  getActiveCount(): number {
    return this.activePowerups.size;
  }

  /**
   * Clear all powerups
   */
  clear(): void {
    this.pickups.clear();

    // Remove all active effects
    for (const [_, powerup] of this.activePowerups) {
      this.removeEffect(powerup.data);
    }
    this.activePowerups.clear();
  }
}
