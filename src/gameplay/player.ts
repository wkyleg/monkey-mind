/**
 * Player entity and behavior
 */

import { CONFIG } from '../config';
import { events } from '../core/events';
import { Entity } from '../engine/entity';
import type { PlayerIntent } from '../engine/input';
import type { Renderer } from '../engine/renderer';
import { svgAssets } from '../engine/svgAssets';
import { lerp, oscillate } from '../util/math';

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
  private ghostActive: boolean = false;

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
    this.currentLanePosition = lerp(this.currentLanePosition, this.targetLane, 1 - 0.001 ** dt);

    this.transform.x = this.getLaneX(this.currentLanePosition);
    this.transform.lane = this.targetLane;

    // Damage flash decay
    if (this.damageFlashTime > 0) {
      this.damageFlashTime -= dt;
    }

    // Invulnerability decay
    if (this.health?.invulnerable && this.health.invulnerableTime > 0) {
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
   * @param fireRateModifier multiplier from WeaponSystem (lower = faster)
   */
  canFire(fireRateModifier: number = 1): boolean {
    if (this.fireTimer >= this.fireRate * fireRateModifier) {
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
    if (this.ghostActive) return; // Ghost mode = invulnerable

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
   * Set ghost state (phase through enemies)
   */
  setGhost(active: boolean): void {
    this.ghostActive = active;
  }

  /**
   * Check if ghost is active
   */
  hasGhost(): boolean {
    return this.ghostActive;
  }

  /**
   * Get current visual state for rendering
   */
  private getVisualState(): 'normal' | 'shielded' | 'fury' | 'damaged' | 'invulnerable' | 'ghost' {
    if (this.damageFlashTime > 0) return 'damaged';
    if (this.health?.invulnerable) return 'invulnerable';
    if (this.ghostActive) return 'ghost';
    if (this.shieldActive) return 'shielded';
    if (this.furyActive) return 'fury';
    return 'normal';
  }

  /**
   * Custom draw function - uses SVG assets with distinct visual states
   */
  private draw(renderer: Renderer, _player: Player): void {
    const { x, y } = this.transform;
    const ctx = renderer.context;

    // Reduced bob animation (was 3, now 1.5 for subtler movement)
    const bob = oscillate(this.bobTime, 2.5, 1.5);
    const drawY = y + bob;

    // Get current visual state
    const visualState = this.getVisualState();

    // Determine SVG and colors based on state
    let svgId = 'player/monkey_default';
    let glowColor: string = CONFIG.COLORS.ACCENT;
    let glowSize = 15;
    let scale = 1.0;

    switch (visualState) {
      case 'shielded':
        svgId = 'player/monkey_calm';
        glowColor = '#00ddff';
        glowSize = 25;
        scale = 1.05;
        break;
      case 'fury':
        svgId = 'player/monkey_passion';
        glowColor = '#ff4422';
        glowSize = 30;
        scale = 1.1;
        break;
      case 'damaged':
        glowColor = '#ff0000';
        glowSize = 20;
        break;
      case 'invulnerable':
        glowColor = '#ffffff';
        glowSize = 18;
        break;
      case 'ghost':
        svgId = 'player/monkey_calm';
        glowColor = '#aa88ff';
        glowSize = 20;
        scale = 1.0;
        break;
    }

    // Draw state-specific background effects
    this.drawStateEffects(renderer, x, drawY, visualState);

    // Damage flash effect
    const flashAlpha = this.damageFlashTime > 0 ? 0.5 + Math.sin(this.bobTime * 30) * 0.5 : 0;

    // Render SVG monkey
    const svgAsset = svgAssets.get(svgId);
    const monkeySize = 70 * scale;

    if (svgAsset) {
      // Apply invulnerability flicker
      const alpha = visualState === 'invulnerable' && Math.sin(this.bobTime * 15) > 0 ? 0.4 : 1;

      // Apply damage flash tint
      if (flashAlpha > 0) {
        ctx.save();
        ctx.globalAlpha = flashAlpha;
        renderer.glowCircle(x, drawY, 40, '#ff0000', 25);
        ctx.restore();
      }

      // Render the monkey SVG
      svgAssets.render(ctx, svgId, {
        x,
        y: drawY,
        width: monkeySize,
        height: monkeySize,
        alpha,
        glow: glowSize,
        glowColor,
      });
    } else {
      // Fallback to procedural rendering if SVG not loaded
      this.drawFallback(renderer, x, drawY, flashAlpha, visualState);
    }

    // Draw state-specific overlay effects
    this.drawStateOverlay(renderer, x, drawY, visualState);
  }

  /**
   * Draw background effects based on current state
   */
  private drawStateEffects(renderer: Renderer, x: number, y: number, state: string): void {
    const ctx = renderer.context;

    switch (state) {
      case 'shielded': {
        // Hexagonal shield barrier
        ctx.save();
        ctx.strokeStyle = '#00ddff';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#00ddff';
        ctx.shadowBlur = 20;

        // Rotating hexagon
        const shieldAngle = this.bobTime * 0.5;
        ctx.beginPath();
        for (let i = 0; i <= 6; i++) {
          const angle = (i / 6) * Math.PI * 2 + shieldAngle;
          const px = x + Math.cos(angle) * 48;
          const py = y + Math.sin(angle) * 48;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();

        // Inner glow
        const gradient = ctx.createRadialGradient(x, y, 20, x, y, 50);
        gradient.addColorStop(0, 'rgba(0, 221, 255, 0.3)');
        gradient.addColorStop(1, 'rgba(0, 221, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.restore();
        break;
      }

      case 'fury':
        // Fiery aura effect
        ctx.save();
        renderer.setBlendMode('screen');

        // Multiple flame layers
        for (let i = 0; i < 3; i++) {
          const offset = i * 0.3;
          const flameRadius = 35 + i * 8 + Math.sin(this.bobTime * 8 + offset) * 5;
          const alpha = 0.4 - i * 0.1;
          ctx.globalAlpha = alpha;

          const gradient = ctx.createRadialGradient(x, y, 15, x, y, flameRadius);
          gradient.addColorStop(0, '#ffaa00');
          gradient.addColorStop(0.5, '#ff4400');
          gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(x, y, flameRadius, 0, Math.PI * 2);
          ctx.fill();
        }

        renderer.resetBlendMode();
        ctx.restore();
        break;

      case 'invulnerable': {
        // Pulsing white shield
        const pulseAlpha = 0.3 + Math.sin(this.bobTime * 8) * 0.2;
        ctx.save();
        ctx.globalAlpha = pulseAlpha;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);
        ctx.lineDashOffset = -this.bobTime * 30;
        ctx.beginPath();
        ctx.arc(x, y, 42, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
        break;
      }

      case 'damaged': {
        // Red flash overlay
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#ff0000';
        const damageRadius = 45 + Math.sin(this.bobTime * 20) * 5;
        ctx.beginPath();
        ctx.arc(x, y, damageRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        break;
      }

      case 'ghost': {
        // Ghostly phase effect - translucent with purple glow
        ctx.save();
        ctx.globalAlpha = 0.3 + Math.sin(this.bobTime * 4) * 0.1;

        // Ethereal glow
        const ghostGradient = ctx.createRadialGradient(x, y, 10, x, y, 50);
        ghostGradient.addColorStop(0, 'rgba(170, 136, 255, 0.6)');
        ghostGradient.addColorStop(0.5, 'rgba(170, 136, 255, 0.2)');
        ghostGradient.addColorStop(1, 'rgba(170, 136, 255, 0)');
        ctx.fillStyle = ghostGradient;
        ctx.beginPath();
        ctx.arc(x, y, 50, 0, Math.PI * 2);
        ctx.fill();

        // Floating particles around player
        for (let i = 0; i < 5; i++) {
          const angle = this.bobTime * 2 + (i / 5) * Math.PI * 2;
          const dist = 35 + Math.sin(this.bobTime * 3 + i) * 10;
          const px = x + Math.cos(angle) * dist;
          const py = y + Math.sin(angle) * dist;
          ctx.globalAlpha = 0.5;
          ctx.fillStyle = '#aa88ff';
          ctx.beginPath();
          ctx.arc(px, py, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        break;
      }
    }
  }

  /**
   * Draw overlay effects on top of player
   */
  private drawStateOverlay(renderer: Renderer, x: number, y: number, state: string): void {
    const ctx = renderer.context;

    switch (state) {
      case 'shielded':
        // Shield icon above player
        ctx.save();
        ctx.shadowColor = '#00ddff';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#00ddff';
        ctx.font = "bold 14px 'SF Mono', monospace";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('◆', x, y - 50);
        ctx.restore();
        break;

      case 'fury':
        // Flame particles above
        ctx.save();
        for (let i = 0; i < 3; i++) {
          const particleY = y - 45 - i * 8 - Math.sin(this.bobTime * 10 + i) * 3;
          const particleX = x + Math.sin(this.bobTime * 5 + i * 2) * 10;
          const size = 4 - i;
          ctx.fillStyle = i === 0 ? '#ffff00' : '#ff6600';
          ctx.beginPath();
          ctx.arc(particleX, particleY, size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        break;
    }
  }

  /**
   * Fallback procedural rendering if SVG not loaded
   */
  private drawFallback(renderer: Renderer, x: number, drawY: number, flashAlpha: number, state: string): void {
    // Body color based on state
    let bodyColor: string = CONFIG.COLORS.ACCENT;
    let helmetColor: string = CONFIG.COLORS.PRIMARY;

    switch (state) {
      case 'shielded':
        bodyColor = '#00ddff';
        helmetColor = '#00aaff';
        break;
      case 'fury':
        bodyColor = '#ff6644';
        helmetColor = '#ff4422';
        break;
      case 'damaged':
        bodyColor = '#ff4444';
        helmetColor = '#ff0000';
        break;
      case 'invulnerable':
        bodyColor = flashAlpha > 0 ? '#ffffff' : '#cccccc';
        helmetColor = '#ffffff';
        break;
    }

    if (flashAlpha > 0) {
      bodyColor = '#ffffff';
    }

    const ctx = renderer.context;

    // Glow effect behind body
    ctx.save();
    ctx.shadowColor = bodyColor;
    ctx.shadowBlur = 20;

    // Main body
    renderer.glowCircle(x, drawY, 22, bodyColor, 15);

    // Ears
    renderer.glowCircle(x - 20, drawY - 15, 8, bodyColor, 5);
    renderer.glowCircle(x + 20, drawY - 15, 8, bodyColor, 5);
    ctx.restore();

    // Face
    renderer.fillCircle(x, drawY, 18, '#8B4513');

    // Eyes - change based on state
    const eyeOffset = 6;
    renderer.fillCircle(x - eyeOffset, drawY - 4, 4, '#ffffff');
    renderer.fillCircle(x + eyeOffset, drawY - 4, 4, '#ffffff');

    // Pupil color based on state
    let pupilColor = '#000000';
    if (state === 'fury') pupilColor = '#ff0000';
    if (state === 'shielded') pupilColor = '#0088ff';

    renderer.fillCircle(x - eyeOffset, drawY - 4, 2, pupilColor);
    renderer.fillCircle(x + eyeOffset, drawY - 4, 2, pupilColor);

    // Mouth - expression changes with state
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (state === 'fury') {
      // Angry mouth
      ctx.moveTo(x - 6, drawY + 6);
      ctx.lineTo(x + 6, drawY + 6);
    } else if (state === 'damaged') {
      // Grimace
      ctx.arc(x, drawY + 8, 6, Math.PI, 0);
    } else {
      // Normal smile
      ctx.arc(x, drawY + 2, 8, 0.2, Math.PI - 0.2);
    }
    ctx.stroke();

    // Helmet with state color
    ctx.save();
    ctx.shadowColor = helmetColor;
    ctx.shadowBlur = 10;
    renderer.strokeCircle(x, drawY - 5, 25, helmetColor, 3);
    ctx.restore();
  }
}
