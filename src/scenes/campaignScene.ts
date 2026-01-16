/**
 * Campaign game scene
 */

import { Scene } from '../engine/scene';
import type { Game } from '../engine/game';
import type { Renderer } from '../engine/renderer';
import type { PlayerIntent } from '../engine/input';
import { CONFIG } from '../config';
import { events } from '../core/events';
import { storage } from '../core/storage';
import { contentLoader } from '../content/loader';
import { Player } from '../gameplay/player';
import { WeaponSystem } from '../gameplay/weapons';
import { EnemySystem } from '../gameplay/enemies';
import { Spawner } from '../gameplay/spawner';
import { Hud, HudState } from '../gameplay/hud';
import { collisionSystem } from '../engine/collision';
import { Camera } from '../engine/camera';
import { drawBackground, getBackgroundForSector } from '../graphics/backgrounds';
import { PowerupSystem, PowerupPickup } from '../gameplay/powerups';
import { DropSystem, Drop } from '../gameplay/drops';
import { particles } from '../graphics/particles';

export class CampaignScene extends Scene {
  override readonly canPause = true;
  
  private player!: Player;
  private weapons!: WeaponSystem;
  private enemies!: EnemySystem;
  private spawner!: Spawner;
  private powerups!: PowerupSystem;
  private drops!: DropSystem;
  private hud!: Hud;
  private camera!: Camera;
  
  private score: number = 0;
  private combo: number = 0;
  private comboTimer: number = 0;
  private readonly comboTimeout: number = 2;
  
  private currentSectorIndex: number = 0;
  private currentLevelIndex: number = 0;
  private gameOver: boolean = false;
  private gameOverTimer: number = 0;
  private time: number = 0;
  
  // Boss and transition state
  private pendingBoss: string | null = null;
  private showingSectorComplete: boolean = false;
  private sectorCompleteTimer: number = 0;
  private showingBossIntro: boolean = false;
  private bossIntroTimer: number = 0;
  
  // Game over menu state
  private gameOverSelectedOption: number = 0;  // 0 = RETRY, 1 = QUIT
  private gameOverInputCooldown: number = 0;
  
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
  
  constructor(game: Game) {
    super(game);
  }
  
  enter(): void {
    const { width, height } = this.game.getRenderer();
    
    // Initialize game objects
    this.player = new Player(width, height);
    this.weapons = new WeaponSystem(height);
    this.enemies = new EnemySystem(width, height);
    this.spawner = new Spawner(this.enemies, width);
    this.powerups = new PowerupSystem(height);
    this.powerups.connect(this.player, this.weapons);
    this.drops = new DropSystem(height);
    this.drops.connect(this.player, this.weapons);
    this.hud = new Hud();
    this.camera = new Camera();
    
    // Reset state
    this.score = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.gameOver = false;
    this.gameOverTimer = 0;
    this.currentLevelIndex = 0;
    
    // Check if we're starting from a specific sector (level select)
    const levelSelectContext = this.game.getScenes().getContext<{ sectorIndex: number }>('levelSelect');
    if (levelSelectContext) {
      this.currentSectorIndex = levelSelectContext.sectorIndex;
      this.game.getScenes().clearContext('levelSelect');
    } else {
      this.currentSectorIndex = 0;
    }
    
    // Set up event listeners BEFORE loading sector (to catch wave:start)
    this.setupEventListeners();
    
    // Load first sector with intro
    this.loadCurrentSector(true);
    
    // Emit game start
    events.emit('game:start', { mode: 'campaign' });
    
    // Start procedural music with level variation
    this.game.getMusic().setLevel(this.currentSectorIndex, this.currentLevelIndex);
    this.game.getMusic().start();
  }
  
  exit(): void {
    // Save progress
    storage.setHighScore('campaign', this.score);
    storage.save();
    
    // Stop music
    this.game.getMusic().stop();
    
    // Cleanup
    this.weapons.clear();
    this.enemies.clear();
    this.spawner.reset();
    this.powerups.clear();
  }
  
  resume(): void {
    // Called when returning from transition, boss, or story scenes
    // Check if we need to load a new sector
    const sectors = contentLoader.getAllSectors();
    if (this.currentSectorIndex < sectors.length) {
      // Check if current sector needs loading (after transition)
      const sector = sectors[this.currentSectorIndex];
      if (this.hudState.sector !== sector.id) {
        this.loadCurrentSector(true); // Show intro for new sector
      }
      
      // Update music with level variation for new sector/level
      this.game.getMusic().setLevel(this.currentSectorIndex, this.currentLevelIndex);
      if (!this.game.getMusic().isPlaying()) {
        this.game.getMusic().start();
      }
    }
  }
  
  private loadCurrentSector(showIntro: boolean = false): void {
    const sectors = contentLoader.getAllSectors();
    if (this.currentSectorIndex >= sectors.length) {
      // Game complete!
      this.gameOver = true;
      return;
    }
    
    const sector = sectors[this.currentSectorIndex];
    this.spawner.loadSector(sector.id);
    
    this.hudState.sector = sector.id;
    this.hudState.sectorName = sector.name;
    
    // Show sector intro for first level of each sector
    if (showIntro && this.currentLevelIndex === 0) {
      this.game.getScenes().pushLevelStory(sector.id, true);
    }
  }
  
  private setupEventListeners(): void {
    events.on('wave:start', ({ number }) => {
      this.hudState.wave = number;
    });
    
    events.on('enemy:death', ({ position, type }) => {
      this.addScore(10);
      this.incrementCombo();
      
      if (position) {
        // Death particles
        particles.enemyDeath(position.x, position.y, '#00ffaa');
        
        // Try to drop a powerup
        this.powerups.tryDrop(position.x, position.y, 1);
        
        // Try to spawn health/upgrade drop
        const enemyData = contentLoader.getEnemy(type);
        const tier = enemyData?.tier || 1;
        this.drops.spawnFromEnemy(position.x, position.y, tier);
      }
    });
    
    events.on('player:death', () => {
      this.gameOver = true;
      this.gameOverTimer = 0;
      this.gameOverSelectedOption = 0;
      this.gameOverInputCooldown = 0.5;
      this.game.getAudio().playDeath();
    });
    
    events.on('level:complete', () => {
      const sectors = contentLoader.getAllSectors();
      const sector = sectors[this.currentSectorIndex];
      
      this.currentLevelIndex++;
      if (this.currentLevelIndex >= sector.levels.length) {
        // Sector complete - show boss intro then transition to boss
        if (sector.boss) {
          this.pendingBoss = sector.boss;
          this.showingBossIntro = true;
          this.bossIntroTimer = 0;
        } else {
          // No boss, move to next sector
          this.advanceToNextSector();
        }
      } else {
        // Load next level in current sector
        this.spawner.loadLevel(sector.levels[this.currentLevelIndex]);
      }
    });
    
    events.on('boss:defeated', () => {
      // Boss was defeated, show sector complete screen
      this.pendingBoss = null;
      this.showingSectorComplete = true;
      this.sectorCompleteTimer = 0;
      
      // Unlock sector rewards
      const sectors = contentLoader.getAllSectors();
      const sector = sectors[this.currentSectorIndex];
      if (sector.unlocks) {
        storage.unlockSector(this.currentSectorIndex + 2); // Unlock next sector
        sector.unlocks.codex?.forEach(entry => storage.unlockCodexEntry(entry));
        storage.save();
      }
    });
  }
  
  private advanceToNextSector(): void {
    const sectors = contentLoader.getAllSectors();
    const completedSectorIndex = this.currentSectorIndex;
    const completedSector = sectors[completedSectorIndex];
    
    this.currentSectorIndex++;
    this.currentLevelIndex = 0;
    
    if (this.currentSectorIndex < sectors.length) {
      // Collect unlocks from completed sector
      const unlocks: string[] = [];
      if (completedSector?.unlocks) {
        completedSector.unlocks.powerups?.forEach(p => unlocks.push(`powerup:${p}`));
        completedSector.unlocks.codex?.forEach(c => unlocks.push(`codex:${c}`));
        completedSector.unlocks.cosmetics?.forEach(c => unlocks.push(`cosmetic:${c}`));
      }
      
      // Show transition scene
      this.game.getScenes().pushTransition(
        completedSectorIndex + 1,  // 1-based sector number
        this.currentSectorIndex + 1,  // next sector number
        this.score,
        unlocks
      );
    } else {
      // Game complete! Show victory scene
      events.emit('game:complete', { score: this.score });
      this.game.getScenes().goto('victory');
    }
  }
  
  private addScore(amount: number): void {
    const comboMultiplier = 1 + this.combo * 0.1;
    const totalAmount = Math.floor(amount * comboMultiplier);
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
  
  private retryLevel(): void {
    // Reset all state and reload current sector/level
    const { width, height } = this.game.getRenderer();
    
    this.player = new Player(width, height);
    this.weapons = new WeaponSystem(height);
    this.enemies = new EnemySystem(width, height);
    this.spawner = new Spawner(this.enemies, width);
    this.powerups = new PowerupSystem(height);
    this.powerups.connect(this.player, this.weapons);
    this.drops = new DropSystem(height);
    this.drops.connect(this.player, this.weapons);
    
    this.score = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.time = 0;
    this.gameOver = false;
    this.gameOverTimer = 0;
    this.gameOverSelectedOption = 0;
    this.gameOverInputCooldown = 0.5;
    
    // Reload current sector
    this.loadCurrentSector();
    
    events.emit('game:start', { mode: 'campaign' });
  }
  
  update(dt: number, intent: PlayerIntent): void {
    this.time += dt;
    
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
    
    // Handle pause (Escape key)
    if (intent.cancel && !this.gameOver) {
      this.game.getScenes().push('pause');
      return;
    }
    
    if (this.gameOver) {
      this.gameOverTimer += dt;
      this.gameOverInputCooldown = Math.max(0, this.gameOverInputCooldown - dt);
      
      if (this.gameOverTimer > 1.5 && this.gameOverInputCooldown <= 0) {
        // Navigate game over menu with up/down
        if (intent.menuAxis < -0.5) {
          this.gameOverSelectedOption = 0;
          this.gameOverInputCooldown = 0.2;
        } else if (intent.menuAxis > 0.5) {
          this.gameOverSelectedOption = 1;
          this.gameOverInputCooldown = 0.2;
        }
        
        // Execute selected option
        if (intent.confirm) {
          if (this.gameOverSelectedOption === 0) {
            this.retryLevel();
          } else {
            this.game.getScenes().goto('menu');
          }
        }
      }
      return;
    }
    
    // Boss intro screen
    if (this.showingBossIntro) {
      this.bossIntroTimer += dt;
      if (this.bossIntroTimer > 3 || intent.confirm) {
        this.showingBossIntro = false;
        // Transition to boss scene
        this.game.getScenes().pushBoss(this.pendingBoss!, this);
      }
      return;
    }
    
    // Sector complete screen
    if (this.showingSectorComplete) {
      this.sectorCompleteTimer += dt;
      if (this.sectorCompleteTimer > 3 || intent.confirm) {
        this.showingSectorComplete = false;
        this.advanceToNextSector();
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
    
    // Update spawner and enemies
    this.spawner.update(dt);
    this.enemies.update(dt);
    
    // Update powerups
    this.powerups.update(dt);
    
    // Update drops
    this.drops.update(dt);
    
    // Update particles
    particles.update(dt);
    
    // Update music combat intensity based on enemy count
    const enemyCount = this.enemies.getEnemies().length;
    const combatIntensity = Math.min(1, enemyCount / 8); // Max intensity at 8+ enemies
    this.game.getMusic().setCombatIntensity(combatIntensity);
    
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
    
    // Active powerup info
    const activePowerup = this.powerups.getActiveInfo();
    if (activePowerup) {
      this.hudState.powerupActive = activePowerup.id;
      this.hudState.powerupTimeRemaining = activePowerup.timeRemaining;
    } else {
      this.hudState.powerupActive = null;
      this.hudState.powerupTimeRemaining = 0;
    }
    
    // Update HUD
    this.hud.update(dt, this.hudState);
  }
  
  private handleCollisions(): void {
    const projectiles = this.weapons.getProjectiles();
    const enemies = this.enemies.getEnemies();
    const pickups = this.powerups.getPickups();
    const drops = this.drops.getDrops();
    
    // Projectiles vs Enemies
    collisionSystem.checkGroups(projectiles, enemies, (proj, enemy) => {
      const enemyEntity = enemy as import('../gameplay/enemies').Enemy;
      
      // Check if this is a beam projectile
      if (proj.hasTag('beam')) {
        const beam = proj as import('../gameplay/weapons').Beam;
        // Only hit each enemy once per beam
        if (beam.hasHitEnemy(enemyEntity.id)) {
          return;
        }
        beam.markEnemyHit(enemyEntity.id);
        
        // Beam hit sparks
        particles.bananaHit(enemyEntity.transform.x, enemyEntity.transform.y);
        
        if (enemyEntity.onDamage(beam.damage)) {
          this.game.getAudio().playHit();
        }
      } else {
        // Banana projectile
        const banana = proj as import('../gameplay/weapons').Banana;
        
        // Hit sparks
        particles.bananaHit(banana.transform.x, banana.transform.y);
        
        if (enemyEntity.onDamage(banana.damage)) {
          this.game.getAudio().playHit();
        }
        banana.onHit();
      }
    });
    
    // Player vs Enemies
    collisionSystem.checkGroups([this.player], enemies, (_player, enemy) => {
      const enemyEntity = enemy as import('../gameplay/enemies').Enemy;
      
      if (!this.player.health?.invulnerable) {
        this.player.onDamage(1);
        enemyEntity.destroy();
        this.breakCombo();
        this.camera.shake(10);
        
        // Damage particles
        particles.playerDamage(this.player.transform.x, this.player.transform.y);
      }
    });
    
    // Player vs Powerups
    collisionSystem.checkGroups([this.player], pickups, (_player, pickup) => {
      const powerupPickup = pickup as PowerupPickup;
      
      // Powerup collect particles
      const color = powerupPickup.category === 'calm' ? '#00aaff' : '#ff0066';
      particles.powerupCollect(powerupPickup.transform.x, powerupPickup.transform.y, color);
      
      this.powerups.collect(powerupPickup);
      this.game.getAudio().playPowerup();
    });
    
    // Player vs Drops
    collisionSystem.checkGroups([this.player], drops, (_player, drop) => {
      const dropEntity = drop as Drop;
      
      // Collect particles
      particles.powerupCollect(dropEntity.transform.x, dropEntity.transform.y, dropEntity.config.color);
      
      this.drops.collect(dropEntity);
      this.game.getAudio().playPowerup();
    });
  }
  
  render(renderer: Renderer, _alpha: number): void {
    const { width, height } = renderer;
    
    // Background (themed by sector)
    this.renderBackground(renderer);
    
    // Boss intro overlay
    if (this.showingBossIntro) {
      this.renderBossIntro(renderer, width, height);
      return;
    }
    
    // Sector complete overlay
    if (this.showingSectorComplete) {
      this.renderSectorComplete(renderer, width, height);
      return;
    }
    
    // Game objects
    this.weapons.render(renderer);
    this.enemies.render(renderer);
    this.powerups.render(renderer);
    this.drops.render(renderer);
    
    // Player
    if (this.player.renderable?.draw) {
      this.player.renderable.draw(renderer, this.player);
    }
    
    // Particles (on top of game objects)
    particles.render(renderer);
    
    // HUD
    this.hud.render(renderer, this.hudState, this.player);
    
    // Game over overlay
    if (this.gameOver) {
      this.renderGameOver(renderer, width, height);
    }
  }
  
  private renderBackground(renderer: Renderer): void {
    const { width, height } = renderer;
    
    // Draw sector-themed background
    const bgType = getBackgroundForSector(this.currentSectorIndex + 1);
    drawBackground(renderer, bgType, width, height, this.time);
    
    // Lane indicators
    const laneCount = CONFIG.LANES;
    const laneWidth = width / (laneCount + 1);
    
    renderer.save();
    renderer.setAlpha(0.08);
    
    for (let i = 0; i < laneCount; i++) {
      const laneX = laneWidth + i * laneWidth;
      renderer.line(laneX, 0, laneX, height, CONFIG.COLORS.PRIMARY, 1);
    }
    
    renderer.restore();
  }
  
  private renderBossIntro(renderer: Renderer, width: number, height: number): void {
    // Dark overlay with boss warning
    renderer.save();
    renderer.setAlpha(0.9);
    renderer.fillRect(0, 0, width, height, '#000000');
    renderer.restore();
    
    // Warning text pulse
    const pulse = Math.sin(this.bossIntroTimer * 4) * 0.3 + 0.7;
    
    renderer.save();
    renderer.setAlpha(pulse);
    
    // WARNING
    renderer.glowText(
      'WARNING',
      width / 2,
      height * 0.25,
      CONFIG.COLORS.DANGER,
      24,
      'center',
      15
    );
    
    // Boss name
    const bossData = contentLoader.getBoss(this.pendingBoss!);
    const bossName = bossData?.name || this.pendingBoss || 'UNKNOWN';
    
    renderer.glowText(
      bossName.toUpperCase(),
      width / 2,
      height * 0.45,
      CONFIG.COLORS.ACCENT,
      42,
      'center',
      30
    );
    
    // "APPROACHING"
    renderer.glowText(
      'APPROACHING',
      width / 2,
      height * 0.6,
      CONFIG.COLORS.DANGER,
      28,
      'center',
      20
    );
    
    renderer.restore();
    
    // Skip hint
    if (this.bossIntroTimer > 1) {
      renderer.text(
        'PRESS SPACE TO ENGAGE',
        width / 2,
        height * 0.85,
        CONFIG.COLORS.TEXT_DIM,
        14,
        'center'
      );
    }
  }
  
  private renderSectorComplete(renderer: Renderer, width: number, height: number): void {
    // Victory overlay
    renderer.save();
    renderer.setAlpha(0.85);
    renderer.fillRect(0, 0, width, height, '#000000');
    renderer.restore();
    
    // Sector complete
    renderer.glowText(
      'SECTOR COMPLETE',
      width / 2,
      height * 0.3,
      CONFIG.COLORS.PRIMARY,
      36,
      'center',
      25
    );
    
    // Sector name
    renderer.glowText(
      this.hudState.sectorName,
      width / 2,
      height * 0.45,
      CONFIG.COLORS.SECONDARY,
      28,
      'center',
      15
    );
    
    // Score
    renderer.glowText(
      `SCORE: ${this.score}`,
      width / 2,
      height * 0.6,
      CONFIG.COLORS.ACCENT,
      24,
      'center',
      10
    );
    
    // Continue hint
    if (this.sectorCompleteTimer > 1.5) {
      renderer.text(
        'PRESS SPACE TO CONTINUE',
        width / 2,
        height * 0.8,
        CONFIG.COLORS.TEXT_DIM,
        14,
        'center'
      );
    }
  }
  
  private renderGameOver(renderer: Renderer, width: number, height: number): void {
    // Darken background
    renderer.save();
    renderer.setAlpha(0.85);
    renderer.fillRect(0, 0, width, height, '#000000');
    renderer.restore();
    
    // Game over text
    renderer.glowText(
      contentLoader.getString('game_over'),
      width / 2,
      height * 0.25,
      CONFIG.COLORS.DANGER,
      48,
      'center',
      20
    );
    
    // Score
    renderer.glowText(
      `${contentLoader.getString('score')}: ${this.score}`,
      width / 2,
      height * 0.4,
      CONFIG.COLORS.PRIMARY,
      28,
      'center',
      10
    );
    
    // High score check
    const isHighScore = this.score > storage.getHighScore('campaign');
    if (isHighScore) {
      renderer.glowText(
        contentLoader.getString('new_high_score'),
        width / 2,
        height * 0.5,
        CONFIG.COLORS.ACCENT,
        20,
        'center',
        15
      );
    }
    
    // Menu options
    if (this.gameOverTimer > 1.5) {
      const menuY = isHighScore ? height * 0.62 : height * 0.55;
      const menuSpacing = 40;
      
      // RETRY option
      const retrySelected = this.gameOverSelectedOption === 0;
      const retryColor = retrySelected ? CONFIG.COLORS.PRIMARY : CONFIG.COLORS.TEXT_DIM;
      renderer.text(
        retrySelected ? '> RETRY <' : 'RETRY',
        width / 2,
        menuY,
        retryColor,
        retrySelected ? 22 : 18,
        'center'
      );
      
      // QUIT option
      const quitSelected = this.gameOverSelectedOption === 1;
      const quitColor = quitSelected ? CONFIG.COLORS.PRIMARY : CONFIG.COLORS.TEXT_DIM;
      renderer.text(
        quitSelected ? '> QUIT <' : 'QUIT',
        width / 2,
        menuY + menuSpacing,
        quitColor,
        quitSelected ? 22 : 18,
        'center'
      );
      
      // Controls hint
      renderer.text(
        '↑ ↓ SELECT   SPACE CONFIRM',
        width / 2,
        height * 0.85,
        CONFIG.COLORS.TEXT_DIM,
        12,
        'center'
      );
    }
  }
}
