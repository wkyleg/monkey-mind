/**
 * Drop system for health and upgrade pickups from enemies
 */

import { Entity, EntityPool } from '../engine/entity';
import type { Renderer } from '../engine/renderer';
import type { Player } from './player';
import type { WeaponSystem } from './weapons';
import { events } from '../core/events';

export type DropType = 'health' | 'damage_up' | 'fire_rate' | 'shield';

interface DropConfig {
  type: DropType;
  color: string;
  icon: string;
  duration?: number; // For temporary upgrades (seconds)
  value: number;     // Amount of effect
}

const DROP_CONFIGS: Record<DropType, DropConfig> = {
  health: {
    type: 'health',
    color: '#33ff66',
    icon: '+',
    value: 1,
  },
  damage_up: {
    type: 'damage_up',
    color: '#ff6633',
    icon: '↑',
    duration: 15,
    value: 1.5,
  },
  fire_rate: {
    type: 'fire_rate',
    color: '#ffcc00',
    icon: '»',
    duration: 12,
    value: 0.7, // Multiplier for fire rate
  },
  shield: {
    type: 'shield',
    color: '#00ccff',
    icon: '◊',
    duration: 8,
    value: 1,
  },
};

/**
 * Drop entity
 */
export class Drop extends Entity {
  readonly dropType: DropType;
  readonly config: DropConfig;
  private time: number = 0;
  private readonly fallSpeed: number = 80;
  
  constructor(type: DropType, x: number, y: number) {
    super(x, y, 'pickup', ['pickup', 'drop', type]);
    
    this.dropType = type;
    this.config = DROP_CONFIGS[type];
    
    this.setRenderable({
      type: 'custom',
      color: this.config.color,
      draw: (renderer) => this.draw(renderer),
    });
    
    this.setCollider({
      type: 'circle',
      radius: 15,
    });
  }
  
  update(dt: number, screenHeight: number): void {
    this.time += dt;
    this.transform.y += this.fallSpeed * dt;
    
    // Destroy if off screen
    if (this.transform.y > screenHeight + 30) {
      this.destroy();
    }
  }
  
  private draw(renderer: Renderer): void {
    const { x, y } = this.transform;
    const color = this.config.color;
    
    // Subtle floating animation
    const floatY = y + Math.sin(this.time * 3) * 3;
    
    // Outer ring (no glow, clean look)
    renderer.strokeCircle(x, floatY, 14, color, 2);
    
    // Inner fill
    renderer.fillCircle(x, floatY, 10, '#0a0a0f');
    
    // Icon
    const ctx = renderer.context;
    ctx.fillStyle = color;
    ctx.font = '12px "SF Mono", Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.config.icon, x, floatY);
    
    // Angular corner accents
    const size = 14;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    
    // Top-left
    ctx.beginPath();
    ctx.moveTo(x - size, floatY - size + 4);
    ctx.lineTo(x - size, floatY - size);
    ctx.lineTo(x - size + 4, floatY - size);
    ctx.stroke();
    
    // Top-right
    ctx.beginPath();
    ctx.moveTo(x + size - 4, floatY - size);
    ctx.lineTo(x + size, floatY - size);
    ctx.lineTo(x + size, floatY - size + 4);
    ctx.stroke();
    
    // Bottom-left
    ctx.beginPath();
    ctx.moveTo(x - size, floatY + size - 4);
    ctx.lineTo(x - size, floatY + size);
    ctx.lineTo(x - size + 4, floatY + size);
    ctx.stroke();
    
    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(x + size - 4, floatY + size);
    ctx.lineTo(x + size, floatY + size);
    ctx.lineTo(x + size, floatY + size - 4);
    ctx.stroke();
  }
}

/**
 * Active upgrade effect tracking
 */
interface ActiveUpgrade {
  type: DropType;
  timeRemaining: number;
  value: number;
}

/**
 * Drop system manager
 */
export class DropSystem {
  private drops: EntityPool = new EntityPool();
  private screenHeight: number;
  private player: Player | null = null;
  private weapons: WeaponSystem | null = null;
  
  // Active temporary upgrades
  private activeUpgrades: ActiveUpgrade[] = [];
  
  // Drop chance configuration
  private readonly healthDropChance = 0.12;  // 12% base chance
  private readonly upgradeDropChance = 0.05; // 5% base chance
  
  constructor(screenHeight: number) {
    this.screenHeight = screenHeight;
  }
  
  /**
   * Connect to player and weapons for applying effects
   */
  connect(player: Player, weapons: WeaponSystem): void {
    this.player = player;
    this.weapons = weapons;
  }
  
  /**
   * Try to spawn a drop from a killed enemy
   */
  spawnFromEnemy(x: number, y: number, enemyTier: number): void {
    // Higher tier = better drop chance
    const tierBonus = (enemyTier - 1) * 0.03;
    
    // Health drop
    if (Math.random() < this.healthDropChance + tierBonus) {
      this.spawn('health', x, y);
      return;
    }
    
    // Upgrade drop (only from tier 2+)
    if (enemyTier >= 2 && Math.random() < this.upgradeDropChance + tierBonus) {
      const upgradeTypes: DropType[] = ['damage_up', 'fire_rate', 'shield'];
      const randomType = upgradeTypes[Math.floor(Math.random() * upgradeTypes.length)];
      this.spawn(randomType, x, y);
    }
  }
  
  /**
   * Spawn a specific drop
   */
  spawn(type: DropType, x: number, y: number): Drop {
    const drop = new Drop(type, x, y);
    this.drops.add(drop);
    events.emit('drop:spawn', { type, x, y });
    return drop;
  }
  
  /**
   * Collect a drop
   */
  collect(drop: Drop): void {
    if (!this.player) return;
    
    const config = drop.config;
    
    switch (drop.dropType) {
      case 'health':
        // Restore health
        if (this.player.health) {
          this.player.health.current = Math.min(
            this.player.health.max,
            this.player.health.current + config.value
          );
        }
        events.emit('drop:collect', { type: 'health', value: config.value });
        break;
        
      case 'damage_up':
      case 'fire_rate':
      case 'shield':
        // Add temporary upgrade
        this.addUpgrade(drop.dropType, config.duration || 10, config.value);
        events.emit('drop:collect', { type: drop.dropType, duration: config.duration });
        break;
    }
    
    drop.destroy();
  }
  
  /**
   * Add a temporary upgrade
   */
  private addUpgrade(type: DropType, duration: number, value: number): void {
    // Check if already have this upgrade - extend duration
    const existing = this.activeUpgrades.find(u => u.type === type);
    if (existing) {
      existing.timeRemaining += duration;
      return;
    }
    
    this.activeUpgrades.push({ type, timeRemaining: duration, value });
    this.applyUpgrade(type, value);
  }
  
  /**
   * Apply upgrade effect
   */
  private applyUpgrade(type: DropType, value: number): void {
    if (!this.player || !this.weapons) return;
    
    switch (type) {
      case 'damage_up':
        this.weapons.setDamageMultiplier(value);
        break;
      case 'fire_rate':
        this.weapons.setFireRateMultiplier(value);
        break;
      case 'shield':
        this.player.setShield(true);
        break;
    }
  }
  
  /**
   * Remove upgrade effect
   */
  private removeUpgrade(type: DropType): void {
    if (!this.player || !this.weapons) return;
    
    switch (type) {
      case 'damage_up':
        this.weapons.setDamageMultiplier(1);
        break;
      case 'fire_rate':
        this.weapons.setFireRateMultiplier(1);
        break;
      case 'shield':
        this.player.setShield(false);
        break;
    }
  }
  
  /**
   * Update drops and active upgrades
   */
  update(dt: number): void {
    // Update drops
    for (const entity of this.drops.getAll()) {
      const drop = entity as Drop;
      if (drop.active) {
        drop.update(dt, this.screenHeight);
      }
    }
    
    // Clean up destroyed drops
    this.drops.cleanup();
    
    // Update active upgrades
    for (let i = this.activeUpgrades.length - 1; i >= 0; i--) {
      const upgrade = this.activeUpgrades[i];
      upgrade.timeRemaining -= dt;
      
      if (upgrade.timeRemaining <= 0) {
        this.removeUpgrade(upgrade.type);
        this.activeUpgrades.splice(i, 1);
        events.emit('upgrade:expire', { type: upgrade.type });
      }
    }
  }
  
  /**
   * Render drops
   */
  render(renderer: Renderer): void {
    for (const entity of this.drops.getAll()) {
      const drop = entity as Drop;
      if (drop.active && drop.renderable?.draw) {
        drop.renderable.draw(renderer, drop);
      }
    }
  }
  
  /**
   * Get all drops for collision checking
   */
  getDrops(): Drop[] {
    return this.drops.getAll().filter(e => e.active) as Drop[];
  }
  
  /**
   * Get active upgrades for HUD display
   */
  getActiveUpgrades(): ActiveUpgrade[] {
    return this.activeUpgrades;
  }
  
  /**
   * Clear all drops
   */
  clear(): void {
    this.drops.clear();
    
    // Remove all active upgrades
    for (const upgrade of this.activeUpgrades) {
      this.removeUpgrade(upgrade.type);
    }
    this.activeUpgrades = [];
  }
}
