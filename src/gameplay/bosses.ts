/**
 * Boss entity and battle system
 */

import { Entity } from '../engine/entity';
import type { Renderer } from '../engine/renderer';
import type { BossData, BossPhase } from '../content/schema';
import { CONFIG } from '../config';
import { events } from '../core/events';
import { oscillate } from '../util/math';
import { contentLoader } from '../content/loader';
import { svgAssets } from '../engine/svgAssets';

/**
 * Boss entity
 */
export class Boss extends Entity {
  readonly bossId: string;
  readonly name: string;
  readonly title: string;
  
  private phases: BossPhase[];
  private currentPhaseIndex: number = 0;
  private phaseTimer: number = 0;
  private attackTimers: Map<string, number> = new Map();
  
  private time: number = 0;
  private entranceComplete: boolean = false;
  private defeated: boolean = false;
  
  private readonly targetY: number;
  
  constructor(data: BossData, screenWidth: number) {
    super(screenWidth / 2, -100, 'enemy', ['enemy', 'boss']);
    
    this.bossId = data.id;
    this.name = data.name;
    this.title = data.title;
    this.phases = data.phases;
    this.targetY = 150;
    
    this.setRenderable({
      type: 'custom',
      color: data.visual.color,
      draw: (renderer, entity) => this.draw(renderer, entity as Boss, data),
    });
    
    this.setCollider({
      type: 'circle',
      radius: data.visual.size,
    });
    
    this.setHealth(data.hp);
    
    // Initialize attack timers
    for (const phase of this.phases) {
      for (const attack of phase.attacks) {
        this.attackTimers.set(attack.type, 0);
      }
    }
  }
  
  /**
   * Get current phase
   */
  getCurrentPhase(): BossPhase | null {
    if (this.currentPhaseIndex >= this.phases.length) return null;
    return this.phases[this.currentPhaseIndex];
  }
  
  // Active attacks for collision
  private activeAttacks: { x: number; y: number; radius: number }[] = [];
  private attackCleanupTimer: number = 0;
  
  /**
   * Update boss
   */
  update(dt: number, playerX: number, playerY: number): void {
    this.time += dt;
    
    // Clean up old attacks
    this.attackCleanupTimer += dt;
    if (this.attackCleanupTimer > 0.5) {
      this.activeAttacks = [];
      this.attackCleanupTimer = 0;
    }
    
    // Entrance animation
    if (!this.entranceComplete) {
      this.transform.y += 50 * dt;
      if (this.transform.y >= this.targetY) {
        this.transform.y = this.targetY;
        this.entranceComplete = true;
      }
      return;
    }
    
    // Check phase transitions
    this.checkPhaseTransition();
    
    const phase = this.getCurrentPhase();
    if (!phase) return;
    
    // Apply movement pattern
    this.applyPattern(phase.pattern, dt, playerX, playerY);
    
    // Update attack timers
    this.phaseTimer += dt;
    
    for (const attack of phase.attacks) {
      const timer = (this.attackTimers.get(attack.type) ?? 0) + dt * 1000;
      this.attackTimers.set(attack.type, timer);
      
      if (timer >= attack.cooldown) {
        this.executeAttack(attack.type, attack.params, playerX, playerY);
        this.attackTimers.set(attack.type, 0);
      }
    }
  }
  
  /**
   * Check for phase transition
   */
  private checkPhaseTransition(): void {
    if (!this.health) return;
    
    const healthPercent = this.health.current / this.health.max;
    const nextPhase = this.phases[this.currentPhaseIndex + 1];
    
    if (nextPhase && healthPercent <= nextPhase.hpThreshold) {
      this.currentPhaseIndex++;
      this.phaseTimer = 0;
      events.emit('boss:phase', { id: this.bossId, phase: this.currentPhaseIndex + 1 });
    }
  }
  
  /**
   * Apply movement pattern
   */
  private applyPattern(pattern: string, dt: number, playerX: number, _playerY: number): void {
    const speed = 100;
    const margin = 100;
    const screenWidth = 600; // Approximate, will be passed from scene
    
    switch (pattern) {
      case 'sweep':
        // Side to side sweep
        const sweepX = screenWidth / 2 + Math.sin(this.time * 0.5) * (screenWidth / 2 - margin);
        this.transform.x += (sweepX - this.transform.x) * dt * 2;
        break;
        
      case 'chase':
        // Chase player X position
        const chaseSpeed = 80;
        const dx = playerX - this.transform.x;
        this.transform.x += Math.sign(dx) * Math.min(Math.abs(dx), chaseSpeed * dt);
        break;
        
      case 'orbit':
        // Circular orbit
        const orbitRadius = 150;
        const centerX = screenWidth / 2;
        this.transform.x = centerX + Math.cos(this.time * 0.3) * orbitRadius;
        this.transform.y = this.targetY + Math.sin(this.time * 0.3) * 50;
        break;
        
      case 'erratic':
        // Random movement
        if (Math.random() < 0.02) {
          this.transform.vx = (Math.random() - 0.5) * speed * 2;
        }
        this.transform.x += this.transform.vx * dt;
        this.transform.x = Math.max(margin, Math.min(screenWidth - margin, this.transform.x));
        break;
        
      case 'teleport':
        // Occasional teleport
        if (Math.random() < 0.005) {
          this.transform.x = margin + Math.random() * (screenWidth - margin * 2);
        }
        break;
    }
  }
  
  /**
   * Execute an attack
   */
  private executeAttack(type: string, params: Record<string, unknown>, playerX: number, playerY: number): void {
    // Attack execution - add to active attacks for collision checking
    events.emit('audio:play_sfx', { id: 'boss_attack' });
    
    const attackRadius = (params.radius as number) || 30;
    
    switch (type) {
      case 'straight_shot':
        // Shoots toward player
        this.activeAttacks.push({
          x: playerX,
          y: playerY,
          radius: attackRadius,
        });
        break;
        
      case 'spread_shot':
        // Multiple shots in a spread
        const count = (params.count as number) || 3;
        for (let i = 0; i < count; i++) {
          const offset = (i - (count - 1) / 2) * 40;
          this.activeAttacks.push({
            x: playerX + offset,
            y: playerY,
            radius: attackRadius,
          });
        }
        break;
        
      case 'radial':
        // Radial burst
        const radialCount = (params.count as number) || 8;
        for (let i = 0; i < radialCount; i++) {
          const angle = (i / radialCount) * Math.PI * 2;
          const dist = 100;
          this.activeAttacks.push({
            x: this.transform.x + Math.cos(angle) * dist,
            y: this.transform.y + Math.sin(angle) * dist,
            radius: attackRadius * 0.7,
          });
        }
        break;
        
      case 'laser':
        // Vertical laser at boss X
        this.activeAttacks.push({
          x: this.transform.x,
          y: playerY,
          radius: attackRadius * 1.5,
        });
        break;
        
      case 'summon':
        // Would spawn minions - emit event for spawner
        events.emit('boss:summon', { count: (params.count as number) || 2 });
        break;
    }
  }
  
  /**
   * Handle taking damage
   */
  onDamage(amount: number): boolean {
    events.emit('enemy:damage', { id: this.bossId, amount });
    
    const killed = this.takeDamage(amount);
    
    if (killed && !this.defeated) {
      this.defeated = true;
      events.emit('boss:defeat', { id: this.bossId });
    }
    
    return killed;
  }
  
  /**
   * Check if entrance is complete
   */
  isEntranceComplete(): boolean {
    return this.entranceComplete;
  }
  
  /**
   * Check if defeated
   */
  isDefeated(): boolean {
    return this.defeated;
  }
  
  /**
   * Get current phase index (1-based)
   */
  getCurrentPhaseIndex(): number {
    return this.currentPhaseIndex + 1;
  }
  
  /**
   * Get health percentage
   */
  getHealthPercent(): number {
    if (!this.health) return 1;
    return this.health.current / this.health.max;
  }
  
  /**
   * Check if a point hits the boss
   */
  checkHit(x: number, y: number, radius: number): boolean {
    if (!this.collider) return false;
    const dx = x - this.transform.x;
    const dy = y - this.transform.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist < (this.collider.radius || 50) + radius;
  }
  
  /**
   * Get active attacks for collision checking
   */
  getActiveAttacks(): { x: number; y: number; radius: number }[] {
    return this.activeAttacks;
  }
  
  /**
   * Render the boss
   */
  render(renderer: Renderer): void {
    if (this.renderable?.draw) {
      this.renderable.draw(renderer, this);
    }
  }
  
  /**
   * Custom draw - uses SVG assets when available
   */
  private draw(renderer: Renderer, _boss: Boss, data: BossData): void {
    const { x, y } = this.transform;
    const size = data.visual.size;
    const color = data.visual.color;
    
    // Pulse effect
    const pulse = oscillate(this.time, 1, 5);
    const drawSize = size + pulse;
    
    // Damage flash
    const isHurt = this.health && this.health.current < this.health.max;
    
    // Try to render SVG asset first
    const svgId = `bosses/${this.bossId}`;
    const svgAsset = svgAssets.get(svgId);
    
    if (svgAsset) {
      // Render SVG with glow effect
      const ctx = renderer.context;
      ctx.save();
      
      // Apply glow
      if (data.visual.glow) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 20;
      }
      
      // Slow rotation for visual interest
      const rotation = this.time * 0.1;
      
      svgAssets.render(ctx, svgId, {
        x,
        y,
        width: drawSize * 3,
        height: drawSize * 3,
        rotation,
        glow: data.visual.glow ? 15 : 0,
        glowColor: color,
      });
      
      ctx.restore();
      
      // Phase indicator dots around boss
      for (let i = 0; i < this.phases.length; i++) {
        const angle = (i / this.phases.length) * Math.PI * 2 - Math.PI / 2;
        const indicatorRadius = drawSize * 1.6;
        const indicatorX = x + Math.cos(angle) * indicatorRadius;
        const indicatorY = y + Math.sin(angle) * indicatorRadius;
        const isActive = i === this.currentPhaseIndex;
        
        if (isActive) {
          renderer.glowCircle(indicatorX, indicatorY, 6, '#ffffff', 8);
        } else if (i < this.currentPhaseIndex) {
          renderer.fillCircle(indicatorX, indicatorY, 4, color);
        } else {
          renderer.strokeCircle(indicatorX, indicatorY, 4, color, 1);
        }
      }
    } else {
      // Fallback to procedural rendering
      if (data.visual.glow) {
        renderer.glowCircle(x, y, drawSize + 10, color, 25);
      }
      
      renderer.fillCircle(x, y, drawSize, color);
      renderer.fillCircle(x, y, drawSize * 0.7, '#000000');
      renderer.strokeCircle(x, y, drawSize * 0.5, color, 3);
      
      // Phase indicator rings
      for (let i = 0; i < this.phases.length; i++) {
        const ringRadius = drawSize * (0.3 + i * 0.15);
        const isActive = i === this.currentPhaseIndex;
        renderer.strokeCircle(x, y, ringRadius, isActive ? '#ffffff' : color, isActive ? 2 : 1);
      }
    }
    
    // Damage effect
    if (isHurt && Math.sin(this.time * 15) > 0) {
      renderer.save();
      renderer.setAlpha(0.3);
      renderer.fillCircle(x, y, drawSize + 5, '#ffffff');
      renderer.restore();
    }
    
    // Health bar (cyberpunk style)
    if (this.health) {
      const barWidth = size * 3;
      const barHeight = 8;
      const barX = x - barWidth / 2;
      const barY = y + size + 25;
      const healthPercent = this.health.current / this.health.max;
      
      // Background
      renderer.fillRect(barX, barY, barWidth, barHeight, '#1a1a2e');
      
      // Health fill
      renderer.fillRect(barX, barY, barWidth * healthPercent, barHeight, CONFIG.COLORS.DANGER);
      
      // Angular frame
      renderer.drawAngularFrame(barX - 2, barY - 2, barWidth + 4, barHeight + 4, color, 6);
      
      // Boss name
      renderer.hudText(
        this.name.toUpperCase(),
        x,
        barY + barHeight + 12,
        color,
        12,
        'center'
      );
    }
  }
}

/**
 * Boss manager
 */
export class BossSystem {
  private currentBoss: Boss | null = null;
  private screenWidth: number;
  
  constructor(screenWidth: number, _screenHeight: number) {
    this.screenWidth = screenWidth;
  }
  
  /**
   * Spawn a boss
   */
  spawn(bossId: string): Boss | null {
    const data = contentLoader.getBoss(bossId);
    if (!data) {
      console.warn(`Boss not found: ${bossId}`);
      return null;
    }
    
    this.currentBoss = new Boss(data, this.screenWidth);
    return this.currentBoss;
  }
  
  /**
   * Update boss
   */
  update(dt: number, playerX: number, playerY: number): void {
    if (this.currentBoss && this.currentBoss.active) {
      this.currentBoss.update(dt, playerX, playerY);
    }
  }
  
  /**
   * Render boss
   */
  render(renderer: Renderer): void {
    if (this.currentBoss && this.currentBoss.active && this.currentBoss.renderable?.draw) {
      this.currentBoss.renderable.draw(renderer, this.currentBoss);
    }
  }
  
  /**
   * Get current boss
   */
  getBoss(): Boss | null {
    return this.currentBoss;
  }
  
  /**
   * Check if boss battle is active
   */
  isActive(): boolean {
    return this.currentBoss !== null && this.currentBoss.active && !this.currentBoss.isDefeated();
  }
  
  /**
   * Clear boss
   */
  clear(): void {
    this.currentBoss = null;
  }
}

/**
 * Boss factory for creating bosses from data
 */
export class BossFactory {
  /**
   * Create a boss from data
   */
  static create(data: BossData, screenWidth: number, _screenHeight: number): Boss {
    return new Boss(data, screenWidth);
  }
}
