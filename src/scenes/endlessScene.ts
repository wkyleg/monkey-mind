/**
 * Endless game mode scene
 */

import { CONFIG } from '../config';
import { contentLoader } from '../content/loader';
import { events } from '../core/events';
import { storage } from '../core/storage';
import { Camera } from '../engine/camera';
import { collisionSystem } from '../engine/collision';
import type { PlayerIntent } from '../engine/input';
import type { Renderer } from '../engine/renderer';
import { Scene } from '../engine/scene';
import { EnemySystem } from '../gameplay/enemies';
import { Hud, type HudState } from '../gameplay/hud';
import { Player } from '../gameplay/player';
import { WeaponSystem } from '../gameplay/weapons';
import { rng } from '../util/rng';

export class EndlessScene extends Scene {
  override readonly canPause = true;

  private player!: Player;
  private weapons!: WeaponSystem;
  private enemies!: EnemySystem;
  private hud!: Hud;
  private camera!: Camera;

  private score: number = 0;
  private combo: number = 0;
  private comboTimer: number = 0;
  private readonly comboTimeout: number = 2;

  private wave: number = 0;
  private waveTimer: number = 0;
  private waveInterval: number = 5;
  private spawnTimer: number = 0;
  private spawnInterval: number = 1.5;

  private difficulty: number = 1;
  private playTime: number = 0;

  private gameOver: boolean = false;
  private gameOverTimer: number = 0;

  private hudState: HudState = {
    score: 0,
    combo: 0,
    wave: 0,
    sector: 'endless',
    sectorName: 'ENDLESS MODE',
    powerupActive: null,
    powerupTimeRemaining: 0,
    calmLevel: 0,
    arousalLevel: 0,
  };

  enter(): void {
    const { width, height } = this.game.getRenderer();

    // Initialize game objects
    this.player = new Player(width, height);
    this.weapons = new WeaponSystem(height);
    this.enemies = new EnemySystem(width, height);
    this.hud = new Hud();
    this.camera = new Camera();

    // Reset state
    this.score = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.wave = 0;
    this.waveTimer = 0;
    this.spawnTimer = 0;
    this.difficulty = 1;
    this.playTime = 0;
    this.gameOver = false;
    this.gameOverTimer = 0;

    // Set up event listeners
    this.setupEventListeners();

    // Emit game start
    events.emit('game:start', { mode: 'endless' });
  }

  exit(): void {
    // Save progress
    storage.setHighScore('endless', this.score);
    storage.incrementStat('totalPlayTime', Math.floor(this.playTime));
    storage.save();

    // Cleanup
    this.weapons.clear();
    this.enemies.clear();
  }

  private setupEventListeners(): void {
    events.on('enemy:death', () => {
      this.addScore(10);
      this.incrementCombo();
    });

    events.on('player:death', () => {
      this.gameOver = true;
      this.game.getAudio().playDeath();
    });
  }

  private addScore(amount: number): void {
    const comboMultiplier = 1 + this.combo * 0.1;
    const difficultyBonus = 1 + (this.difficulty - 1) * 0.2;
    const totalAmount = Math.floor(amount * comboMultiplier * difficultyBonus);
    this.score += totalAmount;
    this.hudState.score = this.score;

    events.emit('score:add', { amount: totalAmount, reason: 'enemy_kill' });
  }

  private incrementCombo(): void {
    this.combo++;
    this.comboTimer = this.comboTimeout;
    this.hudState.combo = this.combo;

    events.emit('combo:increase', { count: this.combo });
  }

  private breakCombo(): void {
    if (this.combo > 0) {
      events.emit('combo:break', { finalCount: this.combo });
      this.combo = 0;
      this.hudState.combo = 0;
    }
  }

  update(dt: number, intent: PlayerIntent): void {
    // Handle button clicks
    const mouseClick = this.game.getInput().getMouseClick();
    if (mouseClick && !this.gameOver) {
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
    if (intent.pause && !this.gameOver) {
      this.game.getScenes().push('pause');
      return;
    }

    if (this.gameOver) {
      this.gameOverTimer += dt;
      if (this.gameOverTimer > 2 && intent.confirm) {
        this.game.getScenes().goto('menu');
      }
      return;
    }

    this.playTime += dt;

    // Update difficulty based on time
    this.updateDifficulty(dt);

    // Update camera
    this.camera.update(dt);

    // Update player
    this.player.updateFromIntent(intent, dt);

    // Auto-fire
    if (this.player.canFire()) {
      this.weapons.fire(this.player.transform.x, this.player.transform.y);
      this.game.getAudio().playBananaThrow();
    }

    // Update weapons
    this.weapons.update(dt);

    // Spawn enemies
    this.updateSpawning(dt);

    // Update enemies
    this.enemies.update(dt);

    // Collision detection
    this.handleCollisions();

    // Combo timer
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.breakCombo();
      }
    }

    // Update HUD state
    this.hudState.calmLevel = intent.calm ?? 0;
    this.hudState.arousalLevel = intent.arousal ?? 0;

    // Update HUD
    this.hud.update(dt, this.hudState);
  }

  private updateDifficulty(_dt: number): void {
    // Ramp difficulty over time
    const rampTime = CONFIG.DIFFICULTY_RAMP_TIME;
    this.difficulty = 1 + Math.min(4, this.playTime / rampTime);

    // Update spawn interval based on difficulty
    this.spawnInterval = Math.max(CONFIG.MIN_SPAWN_INTERVAL, CONFIG.MAX_SPAWN_INTERVAL / this.difficulty);

    // Wave interval decreases slightly
    this.waveInterval = Math.max(3, 5 / Math.sqrt(this.difficulty));
  }

  private updateSpawning(dt: number): void {
    const { width } = this.game.getRenderer();

    // Wave timer
    this.waveTimer += dt;
    if (this.waveTimer >= this.waveInterval) {
      this.wave++;
      this.waveTimer = 0;
      this.hudState.wave = this.wave;
      events.emit('wave:start', { waveId: 'endless', number: this.wave });
    }

    // Spawn timer
    this.spawnTimer += dt;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      this.spawnEnemy(width);
    }
  }

  private spawnEnemy(screenWidth: number): void {
    // Pick enemy type based on difficulty
    const enemies = contentLoader.getAllEnemies();
    if (enemies.length === 0) return;

    // Weight by tier and difficulty
    const availableEnemies = enemies.filter((e) => e.tier <= Math.ceil(this.difficulty));
    if (availableEnemies.length === 0) return;

    const enemy = rng.pick(availableEnemies);
    const margin = 100;
    const x = margin + rng.random() * (screenWidth - margin * 2);

    this.enemies.spawn(enemy.id, x, CONFIG.ENEMY_SPAWN_Y);

    // Chance to spawn extra enemies at higher difficulty
    if (this.difficulty > 2 && rng.bool(0.3)) {
      const extraX = margin + rng.random() * (screenWidth - margin * 2);
      this.enemies.spawn(enemy.id, extraX, CONFIG.ENEMY_SPAWN_Y - 50);
    }
  }

  private handleCollisions(): void {
    const projectiles = this.weapons.getProjectiles();
    const enemies = this.enemies.getEnemies();

    // Projectiles vs Enemies
    collisionSystem.checkGroups(projectiles, enemies, (proj, enemy) => {
      const banana = proj as import('../gameplay/weapons').Banana;
      const enemyEntity = enemy as import('../gameplay/enemies').Enemy;

      if (enemyEntity.onDamage(banana.damage)) {
        this.game.getAudio().playHit();
      }
      banana.onHit();
    });

    // Player vs Enemies
    collisionSystem.checkGroups([this.player], enemies, (_player, enemy) => {
      const enemyEntity = enemy as import('../gameplay/enemies').Enemy;

      if (!this.player.health?.invulnerable) {
        this.player.onDamage(1);
        enemyEntity.destroy();
        this.breakCombo();
        this.camera.shake(10);
      }
    });
  }

  render(renderer: Renderer, _alpha: number): void {
    const { width, height } = renderer;

    // Background
    this.renderBackground(renderer);

    // Game objects
    this.weapons.render(renderer);
    this.enemies.render(renderer);

    // Player
    if (this.player.renderable?.draw) {
      this.player.renderable.draw(renderer, this.player);
    }

    // HUD
    this.hud.render(renderer, this.hudState, this.player);

    // Difficulty indicator
    this.renderDifficultyIndicator(renderer, width);

    // Game over overlay
    if (this.gameOver) {
      this.renderGameOver(renderer, width, height);
    }
  }

  private renderBackground(renderer: Renderer): void {
    const { width, height } = renderer;

    // Clear canvas and reset context state
    renderer.context.globalAlpha = 1;
    renderer.fillRect(0, 0, width, height, '#000000');

    // Dynamic background based on difficulty
    const hue = 220 + (this.difficulty - 1) * 20;
    const bgColor1 = `hsl(${hue}, 30%, 5%)`;
    const bgColor2 = `hsl(${hue}, 40%, 10%)`;

    renderer.radialGradientBackground([bgColor1, bgColor2, bgColor1], width / 2, height / 2);

    // Lane indicators
    const laneCount = CONFIG.LANES;
    const laneWidth = width / (laneCount + 1);

    renderer.save();
    renderer.setAlpha(0.1);

    for (let i = 0; i < laneCount; i++) {
      const laneX = laneWidth + i * laneWidth;
      renderer.line(laneX, 0, laneX, height, CONFIG.COLORS.PRIMARY, 1);
    }

    renderer.restore();
  }

  private renderDifficultyIndicator(renderer: Renderer, width: number): void {
    const diffText = `DIFFICULTY: ${this.difficulty.toFixed(1)}x`;
    renderer.text(diffText, width - 20, 60, CONFIG.COLORS.TEXT_DIM, 12, 'right');
  }

  private renderGameOver(renderer: Renderer, width: number, height: number): void {
    // Darken background
    renderer.save();
    renderer.setAlpha(0.8);
    renderer.fillRect(0, 0, width, height, '#000000');
    renderer.restore();

    // Game over text
    renderer.glowText(
      contentLoader.getString('game_over'),
      width / 2,
      height * 0.3,
      CONFIG.COLORS.DANGER,
      48,
      'center',
      30,
    );

    // Stats
    renderer.glowText(
      `${contentLoader.getString('score')}: ${this.score}`,
      width / 2,
      height * 0.45,
      CONFIG.COLORS.PRIMARY,
      32,
      'center',
      15,
    );

    renderer.text(`WAVES SURVIVED: ${this.wave}`, width / 2, height * 0.55, CONFIG.COLORS.TEXT, 20, 'center');

    renderer.text(
      `TIME: ${Math.floor(this.playTime / 60)}:${String(Math.floor(this.playTime % 60)).padStart(2, '0')}`,
      width / 2,
      height * 0.62,
      CONFIG.COLORS.TEXT,
      20,
      'center',
    );

    // High score check
    const isHighScore = this.score > storage.getHighScore('endless');
    if (isHighScore) {
      renderer.glowText(
        contentLoader.getString('new_high_score'),
        width / 2,
        height * 0.72,
        CONFIG.COLORS.ACCENT,
        24,
        'center',
        20,
      );
    }

    // Continue prompt
    if (this.gameOverTimer > 2) {
      renderer.text('PRESS SPACE TO CONTINUE', width / 2, height * 0.85, CONFIG.COLORS.TEXT_DIM, 16, 'center');
    }
  }
}
