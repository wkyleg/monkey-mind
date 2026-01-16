/**
 * Player entity and behavior
 */

import { Entity } from '../engine/entity';
import type { Renderer } from '../engine/renderer';
import type { PlayerIntent } from '../engine/input';
import { CONFIG } from '../config';
import { lerp, oscillate } from '../util/math';
import { events } from '../core/events';

export class Player extends Entity {
  // Lane system
  targetLane: number;
  currentLanePosition: number;
  private readonly laneWidth: number;
  private readonly leftBound: number;
  private readonly laneCount: number;
  
  // Visual state
  private bobTime: number = 0;
  private damageFlashTime: number = 0;
  private shieldActive: boolean = false;
  private furyActive: boolean = false;
  
  // Weapon state
  private fireTimer: number = 0;
  private readonly fireRate: number = CONFIG.BANANA_FIRE_RATE;
  
  // Lane switch edge detection
  private lastMoveDir: number = 0;
  private laneSwitchCooldown: number = 0;
  private readonly laneSwitchRate: number = 0.15;
  
  constructor(screenWidth: number, screenHeight: number, laneCount: number = CONFIG.LANES) {
    const y = screenHeight * CONFIG.PLAYER_Y_POSITION;
    super(screenWidth / 2, y, 'player', ['player']);
    
    this.laneCount = laneCount;
    this.laneWidth = screenWidth / (laneCount + 1);
    this.leftBound = this.laneWidth;
    
    // Start in center lane
    this.targetLane = Math.floor(laneCount / 2);
    this.currentLanePosition = this.targetLane;
    this.transform.lane = this.targetLane;
    this.transform.x = this.getLaneX(this.targetLane);
    
    // Set up components
    this.setRenderable({
      type: 'custom',
      color: CONFIG.COLORS.ACCENT,
      draw: (renderer, entity) => this.draw(renderer, entity as Player),
    });
    
    this.setCollider({
      type: 'circle',
      radius: 20,
    });
    
    this.setHealth(3);
  }
  
  /**
   * Get X position for a given lane
   */
  getLaneX(lane: number): number {
    return this.leftBound + lane * this.laneWidth;
  }
  
  /**
   * Update player based on input
   */
  updateFromIntent(intent: PlayerIntent, dt: number): void {
    this.bobTime += dt;
    
    // Lane switch cooldown
    if (this.laneSwitchCooldown > 0) {
      this.laneSwitchCooldown -= dt;
    }
    
    // Detect move direction
    const moveDir = intent.moveAxis < -0.5 ? -1 : intent.moveAxis > 0.5 ? 1 : 0;
    
    // Edge-triggered lane switching: switch on new input OR on held input after cooldown
    const justStarted = moveDir !== 0 && this.lastMoveDir === 0;
    const canContinue = moveDir !== 0 && this.laneSwitchCooldown <= 0;
    
    if (justStarted || canContinue) {
      if (moveDir < 0 && this.targetLane > 0) {
        const oldLane = this.targetLane;
        this.targetLane--;
        this.laneSwitchCooldown = this.laneSwitchRate;
        events.emit('player:lane_change', { from: oldLane, to: this.targetLane });
      } else if (moveDir > 0 && this.targetLane < this.laneCount - 1) {
        const oldLane = this.targetLane;
        this.targetLane++;
        this.laneSwitchCooldown = this.laneSwitchRate;
        events.emit('player:lane_change', { from: oldLane, to: this.targetLane });
      }
    }
    
    this.lastMoveDir = moveDir;
    
    // Smooth lane movement
    this.currentLanePosition = lerp(
      this.currentLanePosition,
      this.targetLane,
      1 - Math.pow(0.001, dt)
    );
    
    this.transform.x = this.getLaneX(this.currentLanePosition);
    this.transform.lane = this.targetLane;
    
    // Damage flash decay
    if (this.damageFlashTime > 0) {
      this.damageFlashTime -= dt;
    }
    
    // Invulnerability decay
    if (this.health && this.health.invulnerable && this.health.invulnerableTime > 0) {
      this.health.invulnerableTime -= dt;
      if (this.health.invulnerableTime <= 0) {
        this.health.invulnerable = false;
      }
    }
    
    // Auto-fire
    this.fireTimer += dt;
  }
  
  /**
   * Check if player can fire
   */
  canFire(): boolean {
    if (this.fireTimer >= this.fireRate) {
      this.fireTimer = 0;
      return true;
    }
    return false;
  }
  
  /**
   * Handle taking damage
   */
  onDamage(amount: number): void {
    if (this.shieldActive) return;
    
    const killed = this.takeDamage(amount);
    this.damageFlashTime = 0.2;
    
    if (this.health) {
      events.emit('player:damage', {
        amount,
        remaining: this.health.current,
      });
    }
    
    if (killed) {
      events.emit('player:death', undefined);
    } else {
      // Brief invulnerability
      this.setInvulnerable(1);
    }
  }
  
  /**
   * Set shield state
   */
  setShield(active: boolean): void {
    this.shieldActive = active;
  }
  
  /**
   * Set fury state
   */
  setFury(active: boolean): void {
    this.furyActive = active;
  }
  
  /**
   * Check if shield is active
   */
  hasShield(): boolean {
    return this.shieldActive;
  }
  
  /**
   * Check if fury is active
   */
  hasFury(): boolean {
    return this.furyActive;
  }
  
  /**
   * Custom draw function
   */
  private draw(renderer: Renderer, _player: Player): void {
    const { x, y } = this.transform;
    
    // Bob animation
    const bob = oscillate(this.bobTime, 2, 3);
    const drawY = y + bob;
    
    // Damage flash
    const flashAlpha = this.damageFlashTime > 0 ? 0.5 + Math.sin(this.bobTime * 30) * 0.5 : 0;
    
    // Shield effect
    if (this.shieldActive) {
      renderer.glowCircle(x, drawY, 35, CONFIG.COLORS.CALM, 20);
    }
    
    // Fury effect
    if (this.furyActive) {
      renderer.setBlendMode('screen');
      renderer.glowCircle(x, drawY, 30, CONFIG.COLORS.PASSION, 15);
      renderer.resetBlendMode();
    }
    
    // Body (monkey shape - simplified as circle with ears)
    const bodyColor = flashAlpha > 0 ? '#ffffff' : CONFIG.COLORS.ACCENT;
    
    // Main body
    renderer.glowCircle(x, drawY, 22, bodyColor, 15);
    
    // Ears
    renderer.glowCircle(x - 20, drawY - 15, 8, bodyColor, 5);
    renderer.glowCircle(x + 20, drawY - 15, 8, bodyColor, 5);
    
    // Face
    renderer.fillCircle(x, drawY, 18, '#8B4513');
    
    // Eyes
    const eyeOffset = 6;
    renderer.fillCircle(x - eyeOffset, drawY - 4, 4, '#ffffff');
    renderer.fillCircle(x + eyeOffset, drawY - 4, 4, '#ffffff');
    renderer.fillCircle(x - eyeOffset, drawY - 4, 2, '#000000');
    renderer.fillCircle(x + eyeOffset, drawY - 4, 2, '#000000');
    
    // Mouth (grin)
    const ctx = renderer.context;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, drawY + 2, 8, 0.2, Math.PI - 0.2);
    ctx.stroke();
    
    // Helmet/EEG wires
    renderer.strokeCircle(x, drawY - 5, 25, CONFIG.COLORS.PRIMARY, 2);
    
    // EEG nodes
    const nodes = [
      { angle: -Math.PI * 0.7, dist: 25 },
      { angle: -Math.PI * 0.3, dist: 25 },
      { angle: Math.PI * 0.7, dist: 25 },
      { angle: Math.PI * 0.3, dist: 25 },
    ];
    
    nodes.forEach(node => {
      const nodeX = x + Math.cos(node.angle) * node.dist;
      const nodeY = drawY - 5 + Math.sin(node.angle) * node.dist;
      renderer.glowCircle(nodeX, nodeY, 3, CONFIG.COLORS.PRIMARY, 5);
    });
    
    // Invulnerability flicker
    if (this.health?.invulnerable && Math.sin(this.bobTime * 20) > 0) {
      renderer.setAlpha(0.3);
      renderer.fillCircle(x, drawY, 30, '#ffffff');
      renderer.resetAlpha();
    }
  }
}
