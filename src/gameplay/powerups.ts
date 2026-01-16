/**
 * Powerup system
 */

import { Entity, EntityPool } from '../engine/entity';
import type { Renderer } from '../engine/renderer';
import type { PowerupData } from '../content/schema';
import type { Player } from './player';
import type { WeaponSystem } from './weapons';
import { events } from '../core/events';
import { oscillate } from '../util/math';
import { contentLoader } from '../content/loader';

/**
 * Powerup pickup entity
 */
export class PowerupPickup extends Entity {
  readonly powerupId: string;
  readonly category: 'calm' | 'passion' | 'neutral';
  private time: number = 0;
  
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
      radius: 20,
    });
    
    // Slow descent
    this.transform.vy = 50;
    
    events.emit('powerup:spawn', { id: this.id.toString(), type: data.id });
  }
  
  update(dt: number, screenHeight: number): void {
    this.time += dt;
    this.transform.y += this.transform.vy * dt;
    
    // Destroy if off screen
    if (this.transform.y > screenHeight + 50) {
      this.destroy();
    }
  }
  
  private draw(renderer: Renderer, _pickup: PowerupPickup, data: PowerupData): void {
    const { x, y } = this.transform;
    const color = data.visual.color;
    
    // Floating animation
    const float = oscillate(this.time, 2, 5);
    const drawY = y + float;
    
    // Outer glow
    renderer.glowCircle(x, drawY, 25, color, 20);
    
    // Inner circle
    renderer.fillCircle(x, drawY, 18, color);
    
    // Icon (simplified)
    const ctx = renderer.context;
    ctx.fillStyle = '#ffffff';
    ctx.font = "16px 'SF Mono', Consolas, monospace";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    switch (data.visual.icon) {
      case 'shield':
        ctx.fillText('🛡', x, drawY);
        break;
      case 'flame':
        ctx.fillText('🔥', x, drawY);
        break;
      case 'bolt':
        ctx.fillText('⚡', x, drawY);
        break;
      default:
        ctx.fillText('★', x, drawY);
    }
    
    // Rotating ring
    const ringAngle = this.time * 2;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, drawY, 22, ringAngle, ringAngle + Math.PI);
    ctx.stroke();
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

// Drop tables for powerup drops
const DROP_TABLES: Record<string, { powerupId: string; weight: number }[]> = {
  calm: [
    { powerupId: 'calm_shield', weight: 50 },
    { powerupId: 'calm_beam', weight: 50 },
  ],
  passion: [
    { powerupId: 'passion_fury', weight: 50 },
    { powerupId: 'passion_explosive', weight: 50 },
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
   * Apply powerup effect
   */
  private applyEffect(data: PowerupData): void {
    switch (data.effect) {
      case 'shield':
        this.player?.setShield(true);
        break;
      case 'rapid_fire':
        this.weapons?.setRapidFire(true);
        break;
      case 'precision_beam':
        this.weapons?.setPrecisionBeam(true);
        break;
      case 'explosive':
        this.weapons?.setExplosiveBananas(true);
        break;
    }
  }
  
  /**
   * Remove powerup effect
   */
  private removeEffect(data: PowerupData): void {
    switch (data.effect) {
      case 'shield':
        this.player?.setShield(false);
        break;
      case 'rapid_fire':
        this.weapons?.setRapidFire(false);
        break;
      case 'precision_beam':
        this.weapons?.setPrecisionBeam(false);
        break;
      case 'explosive':
        this.weapons?.setExplosiveBananas(false);
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
   * Get active powerup info for HUD
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
