/**
 * Boss battle scene
 */

import { CONFIG } from '../config';
import { contentLoader } from '../content/loader';
import { events } from '../core/events';
import { Camera } from '../engine/camera';
import type { PlayerIntent } from '../engine/input';
import type { Renderer } from '../engine/renderer';
import { Scene } from '../engine/scene';
import { type Boss, BossFactory } from '../gameplay/bosses';
import { Hud, type HudState } from '../gameplay/hud';
import { Player } from '../gameplay/player';
import { WeaponSystem } from '../gameplay/weapons';
import { drawBackground, getBackgroundForSector } from '../graphics/backgrounds';

export class BossScene extends Scene {
  override readonly canPause = true;

  private player!: Player;
  private weapons!: WeaponSystem;
  private boss: Boss | null = null;
  private hud!: Hud;
  private camera!: Camera;

  private bossId: string = '';
  private sectorIndex: number = 0;
  private time: number = 0;

  private score: number = 0;
  private gameOver: boolean = false;
  private gameOverTimer: number = 0;
  private victory: boolean = false;
  private victoryTimer: number = 0;

  private hudState: HudState = {
    score: 0,
    combo: 0,
    wave: 0,
    sector: '',
    sectorName: '',
    powerupActive: null,
    powerupTimeRemaining: 0,
    calmLevel: 0,
    arousalLevel: 0,
  };

  enter(): void {
    const { width, height } = this.game.getRenderer();

    // Get boss context from scene manager
    const context = this.game.getScenes().getBossContext();
    if (context) {
      this.bossId = context.bossId;

      // Determine sector index from boss ID
      const sectors = contentLoader.getAllSectors();
      this.sectorIndex = sectors.findIndex((s) => s.boss === this.bossId);
    }

    // Initialize game objects
    this.player = new Player(width, height);
    this.weapons = new WeaponSystem(height);
    this.hud = new Hud();
    this.camera = new Camera();

    // Create boss
    this.createBoss(width, height);

    // Reset state
    this.time = 0;
    this.score = 0;
    this.gameOver = false;
    this.gameOverTimer = 0;
    this.victory = false;
    this.victoryTimer = 0;

    // Update HUD
    const bossData = contentLoader.getBoss(this.bossId);
    this.hudState.sectorName = bossData?.name || 'BOSS BATTLE';
    this.hudState.sector = this.bossId;

    events.emit('boss:start', { bossId: this.bossId });

    // Start boss music
    this.game.getMusic().setBossMood();
    this.game.getMusic().start();
  }

  private createBoss(width: number, height: number): void {
    const bossData = contentLoader.getBoss(this.bossId);
    if (bossData) {
      this.boss = BossFactory.create(bossData, width, height);
    }
  }

  exit(): void {
    this.weapons.clear();
    this.game.getScenes().clearBossContext();
    this.game.getMusic().stop();
  }

  update(dt: number, intent: PlayerIntent): void {
    this.time += dt;

    // Handle button clicks
    const mouseClick = this.game.getInput().getMouseClick();
    if (mouseClick && !this.gameOver && !this.victory) {
      // Pause button
      if (this.hud.isPauseButtonClicked(mouseClick.x, mouseClick.y)) {
        this.game.getScenes().push('pause');
        return;
      }
      // Mute button
      if (this.hud.isMuteButtonClicked(mouseClick.x, mouseClick.y)) {
        const isMuted = this.game.getMusic().toggleMute();
        this.hud.setMuteState(isMuted);
        return;
      }
    }

    // Handle pause (Space, P, or Escape)
    if (intent.pause && !this.gameOver && !this.victory) {
      this.game.getScenes().push('pause');
      return;
    }

    // Victory state
    if (this.victory) {
      this.victoryTimer += dt;
      if (this.victoryTimer > 3 && intent.confirm) {
        events.emit('boss:defeated', { bossId: this.bossId });
        this.game.getScenes().pop();
      }
      return;
    }

    // Game over state
    if (this.gameOver) {
      this.gameOverTimer += dt;
      if (this.gameOverTimer > 2 && intent.confirm) {
        this.game.getScenes().goto('menu');
      }
      return;
    }

    // Update camera
    this.camera.update(dt);

    // Update player
    this.player.updateFromIntent(intent, dt);

    // Auto-fire (no sound on throw - only on hit)
    if (this.player.canFire()) {
      this.weapons.fire(this.player.transform.x, this.player.transform.y);
    }

    // Update weapons
    this.weapons.update(dt);

    // Update boss
    if (this.boss) {
      this.boss.update(dt, this.player.transform.x, this.player.transform.y);

      // Check if boss is defeated
      if (this.boss.isDefeated()) {
        this.victory = true;
        this.victoryTimer = 0;
        this.score += 1000; // Boss kill bonus
        this.game.getAudio().playPowerup();
      }
    }

    // Collision detection
    this.handleCollisions();

    // Check player death
    if (this.player.health && this.player.health.current <= 0 && !this.gameOver) {
      this.gameOver = true;
      this.gameOverTimer = 0;
      events.emit('player:death', undefined);
      this.game.getAudio().playDeath();
    }

    // Update HUD state
    this.hudState.score = this.score;
    this.hudState.calmLevel = intent.calm ?? 0;
    this.hudState.arousalLevel = intent.arousal ?? 0;

    // Update HUD
    this.hud.update(dt, this.hudState);
  }

  private handleCollisions(): void {
    if (!this.boss) return;

    const projectiles = this.weapons.getProjectiles();

    // Projectiles vs Boss
    for (const proj of projectiles) {
      if (!proj.active) continue;

      // Check if this is a beam
      if (proj.hasTag('beam')) {
        const beam = proj as import('../gameplay/weapons').Beam;
        // Beams use AABB collider, check manually
        if (this.boss.checkHit(beam.transform.x, this.boss.transform.y, 50)) {
          if (!beam.hasHitEnemy(this.boss.id)) {
            beam.markEnemyHit(this.boss.id);
            // Use onDamage instead of takeDamage to properly trigger defeat
            this.boss.onDamage(beam.damage);
            this.score += 5;
            this.game.getAudio().playHit();
            this.camera.shake(3);
          }
        }
      } else {
        // Banana projectile
        const banana = proj as import('../gameplay/weapons').Banana;

        if (this.boss.checkHit(banana.transform.x, banana.transform.y, 10)) {
          // Use onDamage instead of takeDamage to properly trigger defeat
          this.boss.onDamage(banana.damage);
          banana.onHit();
          this.score += 5;
          this.game.getAudio().playHit();
          this.camera.shake(3);
        }
      }
    }

    // Boss attacks vs Player (using boss attack positions)
    const attacks = this.boss.getActiveAttacks();
    for (const attack of attacks) {
      const dx = this.player.transform.x - attack.x;
      const dy = this.player.transform.y - attack.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < attack.radius + 15 && !this.player.health?.invulnerable) {
        this.player.onDamage(1);
        this.camera.shake(15);
      }
    }
  }

  render(renderer: Renderer, _alpha: number): void {
    const { width, height } = renderer;

    // Clear canvas and reset context state
    renderer.context.globalAlpha = 1;
    renderer.fillRect(0, 0, width, height, '#000000');

    // Background (themed by sector)
    const bgType = getBackgroundForSector(this.sectorIndex + 1);
    drawBackground(renderer, bgType, width, height, this.time);

    // Weapons
    this.weapons.render(renderer);

    // Boss
    if (this.boss) {
      this.boss.render(renderer);
    }

    // Player
    if (this.player.renderable?.draw) {
      this.player.renderable.draw(renderer, this.player);
    }

    // Boss health bar
    if (this.boss && !this.victory) {
      this.renderBossHealthBar(renderer, width);
    }

    // HUD
    this.hud.render(renderer, this.hudState, this.player);

    // Victory overlay
    if (this.victory) {
      this.renderVictory(renderer, width, height);
    }

    // Game over overlay
    if (this.gameOver) {
      this.renderGameOver(renderer, width, height);
    }
  }

  private renderBossHealthBar(renderer: Renderer, width: number): void {
    if (!this.boss) return;

    const barWidth = width * 0.6;
    const barHeight = 20;
    const barX = (width - barWidth) / 2;
    const barY = 30;

    const healthPercent = this.boss.getHealthPercent();
    const phaseIndex = this.boss.getCurrentPhaseIndex();

    // Background
    renderer.fillRect(barX - 2, barY - 2, barWidth + 4, barHeight + 4, '#000000');
    renderer.fillRect(barX, barY, barWidth, barHeight, '#1a1a2e');

    // Health fill
    const healthColor =
      healthPercent > 0.5 ? CONFIG.COLORS.DANGER : healthPercent > 0.25 ? CONFIG.COLORS.ACCENT : '#ff0000';
    renderer.fillRect(barX, barY, barWidth * healthPercent, barHeight, healthColor);

    // Phase indicators
    const phaseColors = ['#ffffff', '#ffaa00', '#ff0066'];
    for (let i = 0; i < 3; i++) {
      const indicatorX = barX + barWidth + 10 + i * 15;
      const isActive = i < phaseIndex;
      renderer.context.beginPath();
      renderer.context.arc(indicatorX, barY + barHeight / 2, 5, 0, Math.PI * 2);
      renderer.context.fillStyle = isActive ? phaseColors[i] : '#333333';
      renderer.context.fill();
    }

    // Boss name
    const bossData = contentLoader.getBoss(this.bossId);
    renderer.text(
      bossData?.name.toUpperCase() || 'BOSS',
      width / 2,
      barY + barHeight + 15,
      CONFIG.COLORS.TEXT_DIM,
      12,
      'center',
    );
  }

  private renderVictory(renderer: Renderer, width: number, height: number): void {
    renderer.save();
    renderer.setAlpha(0.8);
    renderer.fillRect(0, 0, width, height, '#000000');
    renderer.restore();

    // Victory text
    renderer.glowText('VICTORY', width / 2, height * 0.35, CONFIG.COLORS.PRIMARY, 48, 'center', 35);

    // Boss defeated
    const bossData = contentLoader.getBoss(this.bossId);
    renderer.glowText(
      `${bossData?.name || 'BOSS'} DEFEATED`,
      width / 2,
      height * 0.5,
      CONFIG.COLORS.ACCENT,
      28,
      'center',
      15,
    );

    // Score
    renderer.glowText(`SCORE: ${this.score}`, width / 2, height * 0.65, CONFIG.COLORS.SECONDARY, 24, 'center', 10);

    // Continue
    if (this.victoryTimer > 1.5) {
      renderer.text('PRESS SPACE TO CONTINUE', width / 2, height * 0.8, CONFIG.COLORS.TEXT_DIM, 14, 'center');
    }
  }

  private renderGameOver(renderer: Renderer, width: number, height: number): void {
    renderer.save();
    renderer.setAlpha(0.8);
    renderer.fillRect(0, 0, width, height, '#000000');
    renderer.restore();

    renderer.glowText('DEFEATED', width / 2, height * 0.4, CONFIG.COLORS.DANGER, 48, 'center', 30);

    if (this.gameOverTimer > 2) {
      renderer.text('PRESS SPACE TO CONTINUE', width / 2, height * 0.65, CONFIG.COLORS.TEXT_DIM, 14, 'center');
    }
  }
}
