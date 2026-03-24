/**
 * Drop system for health and upgrade pickups from enemies
 */

import { events } from '../core/events';
import { Entity, EntityPool } from '../engine/entity';
import type { Renderer } from '../engine/renderer';
import type { Player } from './player';
import type { WeaponSystem } from './weapons';

export type DropType = 'health' | 'damage_up' | 'fire_rate' | 'shield';

interface DropConfig {
  type: DropType;
  color: string;
  icon: string;
  duration?: number; // For temporary upgrades (seconds)
  value: number; // Amount of effect
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

// Labels for each drop type
const DROP_LABELS: Record<DropType, string> = {
  health: 'HEALTH',
  damage_up: 'DAMAGE',
  fire_rate: 'RAPID',
  shield: 'SHIELD',
};

// Particle for drop trail
interface DropParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
}

/**
 * Drop entity - Enhanced with glow, particles, and prominent visuals
 */
export class Drop extends Entity {
  readonly dropType: DropType;
  readonly config: DropConfig;
  private time: number = 0;
  private readonly fallSpeed: number = 60; // Slower for better visibility
  private particles: DropParticle[] = [];
  private lastParticleTime: number = 0;

  constructor(type: DropType, x: number, y: number) {
    super(x, y, 'pickup', ['pickup', 'drop', type]);

    this.dropType = type;
    this.config = DROP_CONFIGS[type];

    this.setRenderable({
      type: 'custom',
      color: this.config.color,
      draw: (renderer) => this.draw(renderer),
    });

    // Larger collider for easier pickup
    this.setCollider({
      type: 'circle',
      radius: 22,
    });
  }

  update(dt: number, screenHeight: number): void {
    this.time += dt;
    this.transform.y += this.fallSpeed * dt;

    // Spawn particles
    if (this.time - this.lastParticleTime > 0.05) {
      this.spawnParticle();
      this.lastParticleTime = this.time;
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Destroy if off screen
    if (this.transform.y > screenHeight + 30) {
      this.destroy();
    }
  }

  private spawnParticle(): void {
    const angle = Math.random() * Math.PI * 2;
    const speed = 20 + Math.random() * 30;
    this.particles.push({
      x: this.transform.x + (Math.random() - 0.5) * 10,
      y: this.transform.y + (Math.random() - 0.5) * 10,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 20, // Slight upward bias
      life: 0.5 + Math.random() * 0.5,
      maxLife: 0.5 + Math.random() * 0.5,
      size: 2 + Math.random() * 3,
    });
  }

  private draw(renderer: Renderer): void {
    const { x, y } = this.transform;
    const color = this.config.color;
    const ctx = renderer.context;

    // Floating animation
    const floatY = y + Math.sin(this.time * 3) * 4;
    const pulse = 0.8 + Math.sin(this.time * 5) * 0.2;
    const size = 20;

    // Draw particles first (behind main drop)
    for (const p of this.particles) {
      const alpha = p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = alpha * 0.6;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Outer glow (large, pulsing)
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 25 * pulse;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.arc(x, floatY, size + 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Rotating outer ring
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.7;
    ctx.translate(x, floatY);
    ctx.rotate(this.time * 2);
    ctx.beginPath();
    // Draw dashed circle
    const segments = 8;
    for (let i = 0; i < segments; i++) {
      const startAngle = (i / segments) * Math.PI * 2;
      const endAngle = startAngle + (Math.PI / segments) * 0.7;
      ctx.arc(0, 0, size + 3, startAngle, endAngle);
      ctx.moveTo(Math.cos(endAngle + 0.3) * (size + 3), Math.sin(endAngle + 0.3) * (size + 3));
    }
    ctx.stroke();
    ctx.restore();

    // Main body with glow
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 15;

    // Filled background circle
    ctx.fillStyle = '#0a0a10';
    ctx.beginPath();
    ctx.arc(x, floatY, size, 0, Math.PI * 2);
    ctx.fill();

    // Colored border
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    // Draw type-specific shape inside
    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;

    switch (this.dropType) {
      case 'health':
        // Cross/Plus shape
        ctx.beginPath();
        ctx.moveTo(x - 8, floatY);
        ctx.lineTo(x + 8, floatY);
        ctx.moveTo(x, floatY - 8);
        ctx.lineTo(x, floatY + 8);
        ctx.stroke();
        break;

      case 'damage_up':
        // Up arrow
        ctx.beginPath();
        ctx.moveTo(x, floatY - 10);
        ctx.lineTo(x - 7, floatY + 2);
        ctx.moveTo(x, floatY - 10);
        ctx.lineTo(x + 7, floatY + 2);
        ctx.moveTo(x, floatY - 10);
        ctx.lineTo(x, floatY + 8);
        ctx.stroke();
        break;

      case 'fire_rate':
        // Lightning bolt
        ctx.beginPath();
        ctx.moveTo(x + 2, floatY - 10);
        ctx.lineTo(x - 4, floatY);
        ctx.lineTo(x + 2, floatY);
        ctx.lineTo(x - 2, floatY + 10);
        ctx.stroke();
        break;

      case 'shield':
        // Diamond/Shield shape
        ctx.beginPath();
        ctx.moveTo(x, floatY - 10);
        ctx.lineTo(x + 8, floatY);
        ctx.lineTo(x, floatY + 10);
        ctx.lineTo(x - 8, floatY);
        ctx.closePath();
        ctx.stroke();
        break;
    }
    ctx.restore();

    // Label below drop
    const label = DROP_LABELS[this.dropType];
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    ctx.fillStyle = color;
    ctx.font = "bold 10px 'SF Mono', Consolas, monospace";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    // Black outline for readability
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.strokeText(label, x, floatY + size + 6);
    ctx.fillText(label, x, floatY + size + 6);
    ctx.restore();

    // Inner highlight/shine
    ctx.save();
    ctx.globalAlpha = 0.4;
    const gradient = ctx.createRadialGradient(x - 5, floatY - 5, 0, x, floatY, size);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, floatY, size - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
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
  private readonly healthDropChance = 0.12; // 12% base chance
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
          this.player.health.current = Math.min(this.player.health.max, this.player.health.current + config.value);
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
    const existing = this.activeUpgrades.find((u) => u.type === type);
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
    return this.drops.getAll().filter((e) => e.active) as Drop[];
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
