/**
 * Boss entity and battle system
 */

import { CONFIG } from '../config';
import { contentLoader } from '../content/loader';
import type { BossData, BossPhase } from '../content/schema';
import { events } from '../core/events';
import { Entity } from '../engine/entity';
import type { Renderer } from '../engine/renderer';
import { svgAssets } from '../engine/svgAssets';
import { oscillate } from '../util/math';

/**
 * Boss projectile - visible, moving attack
 */
export interface BossProjectile {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  life: number;
  maxLife: number;
  color: string;
  type: 'orb' | 'laser' | 'ring' | 'homing';
  targetX?: number;
  targetY?: number;
  telegraph: number; // Telegraph time before becoming active
}

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
  private readonly screenWidth: number;

  // Enhanced phase system
  private phaseTransitionTime: number = 0;
  private isTransitioning: boolean = false;
  private phaseAbilityActive: boolean = false;
  private phaseAbilityTimer: number = 0;
  private enrageMode: boolean = false;
  private enrageTimer: number = 0;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(data: BossData, screenWidth: number, _screenHeight: number = 600) {
    super(screenWidth / 2, -100, 'enemy', ['enemy', 'boss']);

    this.screenWidth = screenWidth;

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

  // Active projectiles for collision and rendering
  private projectiles: BossProjectile[] = [];
  private projectileIdCounter: number = 0;

  // Legacy active attacks (for backwards compatibility)
  private activeAttacks: { x: number; y: number; radius: number }[] = [];
  private attackCleanupTimer: number = 0;

  /**
   * Update boss
   */
  update(dt: number, playerX: number, playerY: number): void {
    this.time += dt;

    // Update projectiles
    this.updateProjectiles(dt, playerX, playerY);

    // Clean up old legacy attacks
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

    // Skip attacks during transition
    if (this.isTransitioning) {
      // Dramatic shaking during transition
      this.transform.x += Math.sin(this.time * 30) * 3;
      this.transform.y += Math.cos(this.time * 25) * 2;
      return;
    }

    // Update phase ability timer
    if (this.phaseAbilityActive) {
      this.phaseAbilityTimer -= dt;
      if (this.phaseAbilityTimer <= 0) {
        this.phaseAbilityActive = false;
      }
    }

    // Update enrage timer
    if (this.enrageMode) {
      this.enrageTimer += dt;
    }

    const phase = this.getCurrentPhase();
    if (!phase) return;

    // Apply movement pattern (faster when enraged)
    const speedMultiplier = this.enrageMode ? 1.5 : 1;
    this.applyPattern(phase.pattern, dt * speedMultiplier, playerX, playerY);

    // Update attack timers (faster when enraged)
    this.phaseTimer += dt;
    const cooldownMultiplier = this.enrageMode ? 0.6 : 1; // 40% faster attacks when enraged

    for (const attack of phase.attacks) {
      const timer = (this.attackTimers.get(attack.type) ?? 0) + dt * 1000;
      this.attackTimers.set(attack.type, timer);

      if (timer >= attack.cooldown * cooldownMultiplier) {
        this.executeAttack(attack.type, attack.params, playerX, playerY);
        this.attackTimers.set(attack.type, 0);

        // Extra attacks when enraged
        if (this.enrageMode && Math.random() < 0.3) {
          // Bonus radial burst
          for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2 + this.time;
            this.spawnProjectile(
              this.transform.x,
              this.transform.y,
              Math.cos(angle) * 180,
              Math.sin(angle) * 180,
              'orb',
              { radius: 8, color: '#ff0000', telegraph: 0.15, life: 2 },
            );
          }
        }
      }
    }
  }

  /**
   * Update all projectiles
   */
  private updateProjectiles(dt: number, playerX: number, playerY: number): void {
    for (const proj of this.projectiles) {
      // Decrement telegraph time
      if (proj.telegraph > 0) {
        proj.telegraph -= dt;
        continue; // Don't move while telegraphing
      }

      // Move projectile
      if (proj.type === 'homing' && proj.targetX !== undefined && proj.targetY !== undefined) {
        // Update target to player position
        proj.targetX = playerX;
        proj.targetY = playerY;

        const dx = proj.targetX - proj.x;
        const dy = proj.targetY - proj.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 5) {
          const homingSpeed = 150;
          proj.vx = (dx / dist) * homingSpeed;
          proj.vy = (dy / dist) * homingSpeed;
        }
      }

      proj.x += proj.vx * dt;
      proj.y += proj.vy * dt;
      proj.life -= dt;
    }

    // Remove expired projectiles
    this.projectiles = this.projectiles.filter((p) => p.life > 0);
  }

  /**
   * Spawn a visible projectile
   */
  private spawnProjectile(
    x: number,
    y: number,
    vx: number,
    vy: number,
    type: BossProjectile['type'],
    options: {
      radius?: number;
      damage?: number;
      life?: number;
      color?: string;
      telegraph?: number;
      targetX?: number;
      targetY?: number;
    } = {},
  ): void {
    const proj: BossProjectile = {
      id: this.projectileIdCounter++,
      x,
      y,
      vx,
      vy,
      radius: options.radius ?? 15,
      damage: options.damage ?? 1,
      life: options.life ?? 3,
      maxLife: options.life ?? 3,
      color: options.color ?? CONFIG.COLORS.DANGER,
      type,
      telegraph: options.telegraph ?? 0.3,
      targetX: options.targetX,
      targetY: options.targetY,
    };
    this.projectiles.push(proj);
  }

  /**
   * Check for phase transition
   */
  private checkPhaseTransition(): void {
    if (!this.health) return;

    const healthPercent = this.health.current / this.health.max;
    const nextPhase = this.phases[this.currentPhaseIndex + 1];

    if (nextPhase && healthPercent <= nextPhase.hpThreshold && !this.isTransitioning) {
      // Start phase transition
      this.isTransitioning = true;
      this.phaseTransitionTime = 2; // 2 second transition
      events.emit('boss:phase', { id: this.bossId, phase: this.currentPhaseIndex + 2 });

      // Clear all projectiles during transition
      this.projectiles = [];
    }

    // Complete transition
    if (this.isTransitioning) {
      this.phaseTransitionTime -= 0.016; // Approximate dt
      if (this.phaseTransitionTime <= 0) {
        this.currentPhaseIndex++;
        this.phaseTimer = 0;
        this.isTransitioning = false;
        this.triggerPhaseAbility();
      }
    }

    // Check for enrage mode (under 20% health in final phase)
    if (this.currentPhaseIndex === this.phases.length - 1 && healthPercent < 0.2 && !this.enrageMode) {
      this.enrageMode = true;
      this.enrageTimer = 0;
      events.emit('audio:play_sfx', { id: 'boss_enrage' });
    }
  }

  /**
   * Trigger special ability when entering a new phase
   */
  private triggerPhaseAbility(): void {
    this.phaseAbilityActive = true;
    this.phaseAbilityTimer = 3; // 3 second special ability

    const phase = this.getCurrentPhase();
    if (!phase) return;

    // Phase-specific abilities
    switch (this.currentPhaseIndex) {
      case 1: // Phase 2 - Bullet hell burst
        for (let ring = 0; ring < 3; ring++) {
          const count = 12 + ring * 4;
          for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2 + ring * 0.3;
            const speed = 100 + ring * 30;
            this.spawnProjectile(
              this.transform.x,
              this.transform.y,
              Math.cos(angle) * speed,
              Math.sin(angle) * speed,
              'orb',
              { radius: 10, color: '#ff4400', telegraph: 0.5 + ring * 0.2, life: 4 },
            );
          }
        }
        break;

      case 2: // Phase 3 - Laser cage
        for (let i = 0; i < 6; i++) {
          const laneX = (this.screenWidth / 7) * (i + 1);
          this.spawnProjectile(laneX, -20, 0, 0, 'laser', {
            radius: 25,
            color: '#00ffff',
            telegraph: 1.0,
            life: 3,
          });
        }
        break;

      case 3: // Phase 4 - Homing swarm
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          this.spawnProjectile(
            this.transform.x + Math.cos(angle) * 50,
            this.transform.y + Math.sin(angle) * 50,
            0,
            0,
            'homing',
            { radius: 12, color: '#ff0088', telegraph: 0.8 + i * 0.1, life: 6 },
          );
        }
        break;
    }
  }

  /**
   * Check if boss is in transition state
   */
  isInTransition(): boolean {
    return this.isTransitioning;
  }

  /**
   * Check if boss is enraged
   */
  isEnraged(): boolean {
    return this.enrageMode;
  }

  /**
   * Apply movement pattern
   */
  private applyPattern(pattern: string, dt: number, playerX: number, _playerY: number): void {
    const speed = 100;
    const margin = 80;
    const sw = this.screenWidth;
    const centerX = sw / 2;

    switch (pattern) {
      case 'sweep': {
        // Side to side sweep - smooth sinusoidal movement
        const sweepX = centerX + Math.sin(this.time * 0.5) * (sw / 2 - margin);
        this.transform.x += (sweepX - this.transform.x) * dt * 2;
        break;
      }

      case 'chase': {
        // Chase player X position with smoothing
        const chaseSpeed = 100;
        const dx = playerX - this.transform.x;
        this.transform.x += Math.sign(dx) * Math.min(Math.abs(dx), chaseSpeed * dt);
        break;
      }

      case 'orbit': {
        // Circular orbit around center
        const orbitRadius = Math.min(150, sw / 4);
        this.transform.x = centerX + Math.cos(this.time * 0.3) * orbitRadius;
        this.transform.y = this.targetY + Math.sin(this.time * 0.3) * 50;
        break;
      }

      case 'erratic':
        // Random movement with better control
        if (Math.random() < 0.03) {
          // Bias toward center when near edges
          const edgeBias = this.transform.x < sw * 0.3 ? 0.3 : this.transform.x > sw * 0.7 ? -0.3 : 0;
          this.transform.vx = (Math.random() - 0.5 + edgeBias) * speed * 2;
        }
        this.transform.x += this.transform.vx * dt;
        break;

      case 'teleport':
        // Occasional teleport to random position
        if (Math.random() < 0.008) {
          this.transform.x = margin + Math.random() * (sw - margin * 2);
        }
        break;

      default: {
        // Default: gentle hover around center
        const hoverX = centerX + Math.sin(this.time * 0.2) * (sw / 4);
        this.transform.x += (hoverX - this.transform.x) * dt;
      }
    }

    // Always constrain to screen bounds
    this.transform.x = Math.max(margin, Math.min(sw - margin, this.transform.x));

    // Keep Y position stable around target (prevent drifting)
    if (pattern !== 'orbit') {
      this.transform.y += (this.targetY - this.transform.y) * dt * 0.5;
    }
  }

  /**
   * Execute an attack
   */
  private executeAttack(type: string, params: Record<string, unknown>, playerX: number, playerY: number): void {
    events.emit('audio:play_sfx', { id: 'boss_attack' });

    const attackRadius = (params.radius as number) || 15;
    const projectileSpeed = 200;

    switch (type) {
      case 'straight_shot': {
        // Shoots toward player - visible projectile
        const dx = playerX - this.transform.x;
        const dy = playerY - this.transform.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const vx = (dx / dist) * projectileSpeed;
        const vy = (dy / dist) * projectileSpeed;

        this.spawnProjectile(this.transform.x, this.transform.y, vx, vy, 'orb', {
          radius: attackRadius,
          color: '#ff3300',
          telegraph: 0.3,
        });
        break;
      }

      case 'spread_shot': {
        // Multiple shots in a spread
        const count = (params.count as number) || 3;
        const spreadAngle = Math.PI / 4; // 45 degree spread
        const baseAngle = Math.atan2(playerY - this.transform.y, playerX - this.transform.x);

        for (let i = 0; i < count; i++) {
          const angle = baseAngle + (i - (count - 1) / 2) * (spreadAngle / count);
          const vx = Math.cos(angle) * projectileSpeed;
          const vy = Math.sin(angle) * projectileSpeed;

          this.spawnProjectile(this.transform.x, this.transform.y, vx, vy, 'orb', {
            radius: attackRadius * 0.8,
            color: '#ff6600',
            telegraph: 0.2 + i * 0.1,
          });
        }
        break;
      }

      case 'radial': {
        // Radial burst of projectiles
        const radialCount = (params.count as number) || 8;

        for (let i = 0; i < radialCount; i++) {
          const angle = (i / radialCount) * Math.PI * 2 + this.time * 0.5;
          const vx = Math.cos(angle) * projectileSpeed * 0.8;
          const vy = Math.sin(angle) * projectileSpeed * 0.8;

          this.spawnProjectile(this.transform.x, this.transform.y, vx, vy, 'orb', {
            radius: attackRadius * 0.6,
            color: '#ff00ff',
            telegraph: 0.4,
          });
        }
        break;
      }

      case 'laser': {
        // Vertical laser beam
        this.spawnProjectile(this.transform.x, this.transform.y, 0, projectileSpeed * 1.5, 'laser', {
          radius: attackRadius * 2,
          color: '#00ffff',
          telegraph: 0.6,
          life: 2,
        });
        break;
      }

      case 'homing': {
        // Homing projectile that tracks the player
        this.spawnProjectile(this.transform.x, this.transform.y, 0, projectileSpeed * 0.5, 'homing', {
          radius: attackRadius * 1.2,
          color: '#ff0088',
          telegraph: 0.5,
          life: 4,
          targetX: playerX,
          targetY: playerY,
        });
        break;
      }

      case 'ring': {
        // Expanding ring attack
        this.spawnProjectile(this.transform.x, this.transform.y, 0, 0, 'ring', {
          radius: 20,
          color: '#ffaa00',
          telegraph: 0.3,
          life: 2,
        });
        break;
      }

      case 'code_rain': {
        // Multiple projectiles raining down in lanes
        const lanes = (params.lanes as number) || 3;
        for (let i = 0; i < lanes; i++) {
          const laneX = (this.screenWidth / (lanes + 1)) * (i + 1);
          this.spawnProjectile(laneX, 0, 0, projectileSpeed, 'orb', {
            radius: attackRadius,
            color: '#00ff00',
            telegraph: 0.2 + i * 0.15,
            life: 3,
          });
        }
        break;
      }

      case 'firewall':
      case 'virus': {
        // Multiple homing projectiles
        const virusCount = (params.count as number) || 3;
        for (let i = 0; i < virusCount; i++) {
          const offsetAngle = (i / virusCount) * Math.PI * 2;
          const startX = this.transform.x + Math.cos(offsetAngle) * 30;
          const startY = this.transform.y + Math.sin(offsetAngle) * 30;

          this.spawnProjectile(startX, startY, 0, 0, 'homing', {
            radius: attackRadius * 0.8,
            color: type === 'firewall' ? '#ff4400' : '#00ff88',
            telegraph: 0.4 + i * 0.2,
            life: 5,
            targetX: playerX,
            targetY: playerY,
          });
        }
        break;
      }

      // Mirror Self boss attacks
      case 'mirror_shot': {
        // Mirror the player's position - shoot from where player is mirrored
        const mirrorX = this.screenWidth - playerX;
        const dx = playerX - mirrorX;
        const dy = playerY - this.transform.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const vx = dist > 0 ? (dx / dist) * projectileSpeed * 0.8 : 0;
        const vy = dist > 0 ? (dy / dist) * projectileSpeed * 0.8 : projectileSpeed;

        // Shoot from both the boss and a mirrored position
        this.spawnProjectile(this.transform.x, this.transform.y, vx, vy, 'orb', {
          radius: attackRadius,
          color: '#ffff00',
          telegraph: 0.3,
        });
        this.spawnProjectile(mirrorX, this.transform.y, -vx, vy, 'orb', {
          radius: attackRadius,
          color: '#ffff00',
          telegraph: 0.3,
        });
        break;
      }

      case 'split': {
        // Projectile that splits into multiple
        const splitCount = (params.count as number) || 4;
        const centerX = this.screenWidth / 2;

        // Initial shot toward player
        this.spawnProjectile(this.transform.x, this.transform.y, 0, projectileSpeed * 0.6, 'orb', {
          radius: attackRadius * 1.5,
          color: '#aa00ff',
          telegraph: 0.4,
          life: 1.5,
        });

        // Delayed split projectiles
        for (let i = 0; i < splitCount; i++) {
          const angle = (i / splitCount) * Math.PI * 2;
          const vx = Math.cos(angle) * projectileSpeed * 0.7;
          const vy = Math.sin(angle) * projectileSpeed * 0.7;

          this.spawnProjectile(centerX, this.transform.y + 100, vx, vy, 'orb', {
            radius: attackRadius * 0.6,
            color: '#cc44ff',
            telegraph: 0.8 + i * 0.1,
            life: 2,
          });
        }
        break;
      }

      case 'reality_warp': {
        // Screen-wide distortion attack - lanes of projectiles
        const warpLanes = 5;
        const warpSpeed = projectileSpeed * 0.7;

        // Create wave pattern across the screen
        for (let i = 0; i < warpLanes; i++) {
          const laneX = (this.screenWidth / (warpLanes + 1)) * (i + 1);
          const offset = i % 2 === 0 ? 0 : 0.3;

          this.spawnProjectile(laneX, 0, 0, warpSpeed, 'orb', {
            radius: attackRadius * 1.2,
            color: '#ff00ff',
            telegraph: 0.5 + offset,
            life: 4,
          });
        }

        // Also spawn homing "ego fragments"
        this.spawnProjectile(this.transform.x, this.transform.y, 0, 0, 'homing', {
          radius: attackRadius,
          color: '#ffff00',
          telegraph: 1.0,
          life: 5,
          targetX: playerX,
          targetY: playerY,
        });
        break;
      }

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
   * Get active attacks for collision checking (includes projectiles)
   */
  getActiveAttacks(): { x: number; y: number; radius: number }[] {
    // Include active projectiles (not in telegraph phase)
    const projectileAttacks = this.projectiles
      .filter((p) => p.telegraph <= 0)
      .map((p) => ({
        x: p.x,
        y: p.y,
        radius: p.type === 'ring' ? 20 + (p.maxLife - p.life) * 100 : p.radius, // Ring expands
      }));

    return [...this.activeAttacks, ...projectileAttacks];
  }

  /**
   * Get all projectiles for rendering
   */
  getProjectiles(): BossProjectile[] {
    return this.projectiles;
  }

  /**
   * Check if any projectile hits the player
   */
  checkProjectileHit(playerX: number, playerY: number, playerRadius: number): { hit: boolean; damage: number } {
    for (const proj of this.projectiles) {
      if (proj.telegraph > 0) continue; // Not active yet

      const hitRadius = proj.radius;
      if (proj.type === 'ring') {
        // Ring is a donut shape - check if player is at the ring edge
        const ringRadius = 20 + (proj.maxLife - proj.life) * 100;
        const ringThickness = 20;
        const dx = playerX - proj.x;
        const dy = playerY - proj.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (Math.abs(dist - ringRadius) < ringThickness + playerRadius) {
          return { hit: true, damage: proj.damage };
        }
        continue;
      }

      const dx = playerX - proj.x;
      const dy = playerY - proj.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < hitRadius + playerRadius) {
        // Remove projectile on hit
        proj.life = 0;
        return { hit: true, damage: proj.damage };
      }
    }

    return { hit: false, damage: 0 };
  }

  /**
   * Render the boss
   */
  render(renderer: Renderer): void {
    // Render projectiles first (behind boss)
    this.renderProjectiles(renderer);

    if (this.renderable?.draw) {
      this.renderable.draw(renderer, this);
    }
  }

  /**
   * Render boss projectiles
   */
  private renderProjectiles(renderer: Renderer): void {
    const ctx = renderer.context;

    for (const proj of this.projectiles) {
      // Telegraphing phase - show warning indicator
      if (proj.telegraph > 0) {
        const telegraphAlpha = 0.3 + Math.sin(this.time * 20) * 0.2;
        ctx.save();
        ctx.globalAlpha = telegraphAlpha;
        ctx.strokeStyle = proj.color;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);

        if (proj.type === 'laser') {
          // Laser telegraph - vertical line
          ctx.beginPath();
          ctx.moveTo(proj.x, proj.y);
          ctx.lineTo(proj.x, 600);
          ctx.stroke();
        } else if (proj.type === 'ring') {
          // Ring telegraph - expanding circle indicator
          ctx.beginPath();
          ctx.arc(proj.x, proj.y, 30, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          // Standard telegraph - crosshair
          ctx.beginPath();
          ctx.arc(proj.x, proj.y, proj.radius + 5, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.setLineDash([]);
        ctx.restore();
        continue;
      }

      // Active projectile rendering
      ctx.save();

      const lifePercent = proj.life / proj.maxLife;
      ctx.globalAlpha = Math.min(1, lifePercent * 2);

      // Glow effect
      ctx.shadowColor = proj.color;
      ctx.shadowBlur = 15;

      ctx.fillStyle = proj.color;
      ctx.strokeStyle = proj.color;

      switch (proj.type) {
        case 'orb': {
          // Glowing orb
          renderer.glowCircle(proj.x, proj.y, proj.radius, proj.color, 15);
          renderer.fillCircle(proj.x, proj.y, proj.radius * 0.6, '#ffffff');
          break;
        }

        case 'laser': {
          // Vertical beam
          const beamWidth = proj.radius;
          const gradient = ctx.createLinearGradient(proj.x - beamWidth, proj.y, proj.x + beamWidth, proj.y);
          gradient.addColorStop(0, 'transparent');
          gradient.addColorStop(0.3, proj.color);
          gradient.addColorStop(0.5, '#ffffff');
          gradient.addColorStop(0.7, proj.color);
          gradient.addColorStop(1, 'transparent');
          ctx.fillStyle = gradient;
          ctx.fillRect(proj.x - beamWidth, proj.y, beamWidth * 2, 600);
          break;
        }

        case 'ring': {
          // Expanding ring
          const ringRadius = 20 + (proj.maxLife - proj.life) * 100;
          ctx.lineWidth = 10;
          ctx.strokeStyle = proj.color;
          ctx.beginPath();
          ctx.arc(proj.x, proj.y, ringRadius, 0, Math.PI * 2);
          ctx.stroke();

          // Inner glow
          ctx.lineWidth = 4;
          ctx.strokeStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(proj.x, proj.y, ringRadius, 0, Math.PI * 2);
          ctx.stroke();
          break;
        }

        case 'homing': {
          // Homing projectile with trail
          renderer.glowCircle(proj.x, proj.y, proj.radius, proj.color, 20);

          // Direction indicator
          const angle = Math.atan2(proj.vy, proj.vx);
          ctx.save();
          ctx.translate(proj.x, proj.y);
          ctx.rotate(angle);
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.moveTo(proj.radius, 0);
          ctx.lineTo(-proj.radius / 2, proj.radius / 2);
          ctx.lineTo(-proj.radius / 2, -proj.radius / 2);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
          break;
        }
      }

      ctx.restore();
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

    // Phase transition effect
    if (this.isTransitioning) {
      const ctx = renderer.context;
      ctx.save();

      // Dramatic shockwave effect
      const shockRadius = (2 - this.phaseTransitionTime) * 150;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.globalAlpha = this.phaseTransitionTime / 2;
      ctx.beginPath();
      ctx.arc(x, y, shockRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Inner energy buildup
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 50;
      ctx.beginPath();
      ctx.arc(x, y, drawSize * (1 + (2 - this.phaseTransitionTime) * 0.3), 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // Phase text
      renderer.glowText(`PHASE ${this.currentPhaseIndex + 2}`, x, y - drawSize - 60, '#ffffff', 24, 'center', 30);
    }

    // Enrage visual effect
    if (this.enrageMode) {
      const ctx = renderer.context;
      ctx.save();

      // Pulsing red aura
      const enragePulse = Math.sin(this.enrageTimer * 8) * 0.3 + 0.7;
      ctx.globalAlpha = enragePulse * 0.5;
      ctx.fillStyle = '#ff0000';
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur = 40;
      ctx.beginPath();
      ctx.arc(x, y, drawSize + 20, 0, Math.PI * 2);
      ctx.fill();

      // Angry particles
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2 + this.time * 3;
        const particleRadius = drawSize + 30 + Math.sin(this.time * 10 + i) * 10;
        const px = x + Math.cos(angle) * particleRadius;
        const py = y + Math.sin(angle) * particleRadius;

        ctx.globalAlpha = 0.8;
        ctx.fillStyle = '#ff4400';
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      // Enraged text
      if (Math.sin(this.enrageTimer * 5) > 0) {
        renderer.glowText('!! ENRAGED !!', x, y - drawSize - 50, '#ff0000', 18, 'center', 25);
      }
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
      renderer.hudText(this.name.toUpperCase(), x, barY + barHeight + 12, color, 12, 'center');
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
    if (this.currentBoss?.active) {
      this.currentBoss.update(dt, playerX, playerY);
    }
  }

  /**
   * Render boss
   */
  render(renderer: Renderer): void {
    if (this.currentBoss?.active && this.currentBoss.renderable?.draw) {
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
    return (this.currentBoss?.active && !this.currentBoss.isDefeated()) ?? false;
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
  static create(data: BossData, screenWidth: number, screenHeight: number): Boss {
    return new Boss(data, screenWidth, screenHeight);
  }
}
