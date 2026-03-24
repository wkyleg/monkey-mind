/**
 * Campaign game scene
 * Updated to support both old Sector system and new Act system (Level Bible v2)
 */

import { CONFIG } from '../config';
import { contentLoader } from '../content/loader';
import type { ActData, ExpansionCategory, LevelDataV2 } from '../content/schema';
import { events } from '../core/events';
import { storage } from '../core/storage';
import { Camera } from '../engine/camera';
import { collisionSystem } from '../engine/collision';
import type { PlayerIntent } from '../engine/input';
import type { Renderer } from '../engine/renderer';
import { Scene } from '../engine/scene';
import { dialogueSystem } from '../gameplay/dialogue';
import { type Drop, DropSystem } from '../gameplay/drops';
import { EnemySystem } from '../gameplay/enemies';
import { Hud, type HudState } from '../gameplay/hud';
import { MetersSystem } from '../gameplay/meters';
import { Player } from '../gameplay/player';
import { type PowerupPickup, PowerupSystem } from '../gameplay/powerups';
import { Spawner } from '../gameplay/spawner';
import { SpawnerV2 } from '../gameplay/spawnerV2';
import { WeaponSystem } from '../gameplay/weapons';
import {
  drawActSvgBackground,
  drawBackground,
  drawLevelSvgBackground,
  getBackgroundForSector,
} from '../graphics/backgrounds';
import { particles } from '../graphics/particles';

type CampaignMode = 'sector' | 'act' | 'expansion';

interface LevelSelectContext {
  mode?: CampaignMode;
  sectorIndex?: number;
  actId?: string;
  actIndex?: number;
  expansionId?: string;
}

export class CampaignScene extends Scene {
  override readonly canPause = true;

  private player!: Player;
  private weapons!: WeaponSystem;
  private enemies!: EnemySystem;
  private spawner!: Spawner;
  private spawnerV2!: SpawnerV2;
  private powerups!: PowerupSystem;
  private drops!: DropSystem;
  private hud!: Hud;
  private camera!: Camera;
  private meters!: MetersSystem;

  private score: number = 0;
  private combo: number = 0;
  private comboTimer: number = 0;
  private readonly comboTimeout: number = 2;

  // Campaign state
  private campaignMode: CampaignMode = 'sector';
  private currentSectorIndex: number = 0;
  private currentActId: string = '';
  private currentAct: ActData | null = null;
  private currentExpansion: ExpansionCategory | null = null;
  private currentLevelIndex: number = 0;
  private currentLevel: LevelDataV2 | null = null;

  private gameOver: boolean = false;
  private gameOverTimer: number = 0;
  private time: number = 0;

  // Boss and transition state
  private pendingBoss: string | null = null;
  private showingSectorComplete: boolean = false;
  private sectorCompleteTimer: number = 0;
  private showingBossIntro: boolean = false;
  private bossIntroTimer: number = 0;
  private showingRuleCard: boolean = false;
  private ruleCardTimer: number = 0;

  // Level transition state
  private showingLevelTransition: boolean = false;
  private levelTransitionTimer: number = 0;
  private nextLevelData: { title: string; subtitle?: string; lore?: string } | null = null;

  // Game over menu state
  private gameOverSelectedOption: number = 0; // 0 = RETRY, 1 = QUIT
  private gameOverInputCooldown: number = 0;

  private hudState: HudState = {
    score: 0,
    combo: 0,
    wave: 0,
    sector: '',
    sectorName: '',
    levelName: undefined,
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
    this.spawner = new Spawner(this.enemies, width);
    this.spawnerV2 = new SpawnerV2(this.enemies, width, height);
    this.powerups = new PowerupSystem(height);
    this.powerups.connect(this.player, this.weapons);
    this.drops = new DropSystem(height);
    this.drops.connect(this.player, this.weapons);
    this.hud = new Hud();
    this.camera = new Camera();
    this.meters = new MetersSystem();

    // Reset state
    this.score = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.gameOver = false;
    this.gameOverTimer = 0;
    this.currentLevelIndex = 0;
    this.showingRuleCard = false;

    // Check if we're starting from level select
    const levelSelectContext = this.game.getScenes().getContext<LevelSelectContext>('levelSelect');
    if (levelSelectContext) {
      this.initializeFromContext(levelSelectContext);
      this.game.getScenes().clearContext('levelSelect');
    } else {
      // Default: try to use new Act system, fall back to sectors
      this.initializeDefault();
    }

    // Set up event listeners BEFORE loading content
    this.setupEventListeners();

    // Load content based on mode
    this.loadCurrentContent(true);

    // Emit game start
    events.emit('game:start', { mode: 'campaign' });

    // Start procedural music
    this.updateMusic();
    this.game.getMusic().start();
  }

  private initializeFromContext(context: LevelSelectContext): void {
    if (context.mode === 'act' && context.actId) {
      this.campaignMode = 'act';
      this.currentActId = context.actId;
      this.currentAct = contentLoader.getAct(context.actId) || null;
      this.currentSectorIndex = context.actIndex ?? 0;
    } else if (context.mode === 'expansion' && context.expansionId) {
      this.campaignMode = 'expansion';
      this.currentExpansion = contentLoader.getExpansionCategory(context.expansionId) || null;
    } else {
      this.campaignMode = 'sector';
      this.currentSectorIndex = context.sectorIndex ?? 0;
    }
  }

  private initializeDefault(): void {
    // Prefer Act system if acts are available
    const acts = contentLoader.getAllActs();
    if (acts.length > 0) {
      this.campaignMode = 'act';
      this.currentAct = acts[0];
      this.currentActId = this.currentAct.id;
      this.currentSectorIndex = 0;
    } else {
      this.campaignMode = 'sector';
      this.currentSectorIndex = 0;
    }
  }

  private updateMusic(): void {
    if (this.campaignMode === 'act' && this.currentAct) {
      // Prefer level's musicSeed if available for unique music per level
      if (this.currentLevel?.musicSeed) {
        this.game.getMusic().setFromMusicSeed(this.currentLevel.musicSeed);
      } else {
        // Fall back to act-level music mood
        this.game.getMusic().setActMood(this.currentAct.id, this.currentLevelIndex);
      }
    } else if (this.campaignMode === 'expansion' && this.currentExpansion) {
      // For expansions, prefer level's musicSeed if available
      if (this.currentLevel?.musicSeed) {
        this.game.getMusic().setFromMusicSeed(this.currentLevel.musicSeed);
      } else {
        // Fall back to mapping expansion to closest act mood
        const expansionMoodMap: Record<string, string> = {
          literature: 'act6_library',
          myth: 'act3_heroic',
          art: 'act5_painted',
          paranoia: 'act8_signals',
          state: 'act7_machine',
          science: 'act1_escape',
          lost_worlds: 'act3_heroic',
          cosmic: 'act8_signals',
          monkey_vars: 'act2_ocean',
          travel: 'act4_sacred',
          samurai: 'act3_heroic',
          climax: 'act8_signals',
        };
        const actIdForMusic = expansionMoodMap[this.currentExpansion.id] || 'act1_escape';
        this.game.getMusic().setActMood(actIdForMusic, this.currentLevelIndex);
      }
    } else {
      // Legacy sector mode
      this.game.getMusic().setLevel(this.currentSectorIndex, this.currentLevelIndex);
    }
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
    this.spawnerV2.reset();
    this.powerups.clear();
  }

  resume(): void {
    // Called when returning from transition, boss, or story scenes

    // Don't reload content if we're showing sector complete (boss just defeated)
    // This prevents the boss from being re-triggered when returning from boss scene
    if (this.showingSectorComplete) {
      return;
    }

    this.loadCurrentContent(false);
    this.updateMusic();
    if (!this.game.getMusic().isPlaying()) {
      this.game.getMusic().start();
    }
  }

  private loadCurrentContent(showIntro: boolean = false): void {
    switch (this.campaignMode) {
      case 'act':
        this.loadCurrentAct(showIntro);
        break;
      case 'expansion':
        this.loadCurrentExpansion(showIntro);
        break;
      default:
        this.loadCurrentSector(showIntro);
        break;
    }
  }

  private loadCurrentAct(showIntro: boolean = false): void {
    if (!this.currentAct || this.currentAct.levels.length === 0) {
      // Fallback to sector mode
      this.campaignMode = 'sector';
      this.loadCurrentSector(showIntro);
      return;
    }

    // Get current level
    if (this.currentLevelIndex >= this.currentAct.levels.length) {
      // Act complete!
      if (this.currentAct.bossId) {
        this.pendingBoss = this.currentAct.bossId;
        this.showingBossIntro = true;
        this.bossIntroTimer = 0;
      } else {
        this.advanceToNextAct();
      }
      return;
    }

    this.currentLevel = this.currentAct.levels[this.currentLevelIndex];

    // Register level-specific enemy dialogue if present
    if (this.currentLevel.levelEnemies) {
      contentLoader.registerLevelEnemyDialogue(this.currentLevel.levelEnemies);
    }

    // Update HUD
    this.hudState.sector = this.currentAct.id;
    this.hudState.sectorName = this.currentAct.name;
    this.hudState.levelName = this.currentLevel.title;

    // Set current act and level index for spawner to use level-specific enemy visuals
    this.spawnerV2.setCurrentAct(this.currentAct.id);
    this.spawnerV2.setCurrentLevelIndex(this.currentLevelIndex + 1); // 1-indexed for file paths

    // Update music for this level
    this.updateMusic();

    // Show rule card for new levels
    // Check if this is a boss-only level (empty enemy deck with boss)
    const isBossLevel =
      this.currentLevel.boss && (!this.currentLevel.enemyDeck || this.currentLevel.enemyDeck.length === 0);

    if (isBossLevel) {
      // Go straight to boss for boss-only levels
      const bossId = typeof this.currentLevel.boss === 'string' ? this.currentLevel.boss : this.currentLevel.boss?.id;
      if (bossId) {
        this.pendingBoss = bossId;
        this.showingBossIntro = true;
        this.bossIntroTimer = 0;
      }
      return;
    }

    if (showIntro && this.currentLevel.ruleCard) {
      this.showingRuleCard = true;
      this.ruleCardTimer = 0;
      // Level title will be shown when rule card is dismissed
    } else {
      // Start spawning enemies
      this.spawnerV2.loadLevelV2(this.currentLevel);
      // Show level title immediately since no rule card
      this.showLevelTitleForCurrentLevel();
    }
  }

  /**
   * Show the level title overlay for the current level
   */
  private showLevelTitleForCurrentLevel(): void {
    if (!this.currentLevel) return;

    const levelTitle = this.currentLevel.title || `Level ${this.currentLevelIndex + 1}`;
    let levelSubtitle = '';

    if (this.campaignMode === 'act' && this.currentAct) {
      levelSubtitle = `${this.currentAct.name} // Level ${this.currentLevelIndex + 1}`;
    } else if (this.campaignMode === 'expansion' && this.currentExpansion) {
      levelSubtitle = `${this.currentExpansion.name} // Level ${this.currentLevelIndex + 1}`;
    }

    const ruleHint = this.currentLevel.ruleCard?.hint || this.currentLevel.subtitle || '';
    this.hud.showLevelTitle(levelTitle, levelSubtitle, ruleHint);
  }

  private loadCurrentExpansion(showIntro: boolean = false): void {
    if (!this.currentExpansion || this.currentExpansion.levels.length === 0) {
      this.gameOver = true;
      return;
    }

    if (this.currentLevelIndex >= this.currentExpansion.levels.length) {
      // Expansion complete!
      this.gameOver = true;
      events.emit('game:complete', { score: this.score });
      this.game.getScenes().goto('victory');
      return;
    }

    this.currentLevel = this.currentExpansion.levels[this.currentLevelIndex];

    // Register level-specific enemy dialogue if present
    if (this.currentLevel.levelEnemies) {
      contentLoader.registerLevelEnemyDialogue(this.currentLevel.levelEnemies);
    }

    this.hudState.sector = this.currentExpansion.id;
    this.hudState.sectorName = this.currentExpansion.name;
    this.hudState.levelName = this.currentLevel.title;

    // Extract expansion short ID (e.g., "art" from "expansion_art" or from level's expansion field)
    const expansionShortId = this.currentLevel.expansion || this.currentExpansion.id.replace('expansion_', '');

    // Set current expansion for spawner to use expansion-specific enemy visuals
    this.spawnerV2.setCurrentExpansion(expansionShortId);

    // Update music for this expansion level
    this.updateMusic();

    // Check if this is a boss-only level
    const isBossLevel =
      this.currentLevel.boss && (!this.currentLevel.enemyDeck || this.currentLevel.enemyDeck.length === 0);

    if (isBossLevel) {
      const bossId = typeof this.currentLevel.boss === 'string' ? this.currentLevel.boss : this.currentLevel.boss?.id;
      if (bossId) {
        this.pendingBoss = bossId;
        this.showingBossIntro = true;
        this.bossIntroTimer = 0;
      }
      return;
    }

    if (showIntro && this.currentLevel.ruleCard) {
      this.showingRuleCard = true;
      this.ruleCardTimer = 0;
      // Level title will be shown when rule card is dismissed
    } else {
      this.spawnerV2.loadLevelV2(this.currentLevel);
      // Show level title immediately since no rule card
      this.showLevelTitleForCurrentLevel();
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

    events.on('enemy:spawn', () => {
      // Update meters when enemy spawns
      this.meters.onEnemySpawn(1);
    });

    events.on('enemy:death', ({ position, type }) => {
      this.addScore(10);
      this.incrementCombo();

      // Update meters on enemy kill
      this.meters.onEnemyKill();

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

    events.on('player:damage', ({ amount }) => {
      // Update meters when player takes damage
      this.meters.onPlayerDamage(amount);
    });

    events.on('player:death', () => {
      this.gameOver = true;
      this.gameOverTimer = 0;
      this.gameOverSelectedOption = 0;
      this.gameOverInputCooldown = 0.5;
      this.game.getAudio().playDeath();
    });

    events.on('level:complete', () => {
      this.handleLevelComplete();
    });

    events.on('boss:defeated', () => {
      this.handleBossDefeated();
    });
  }

  private handleLevelComplete(): void {
    const nextLevelIndex = this.currentLevelIndex + 1;

    // Check what comes next and prepare transition data
    switch (this.campaignMode) {
      case 'act':
        if (this.currentAct && nextLevelIndex >= this.currentAct.levels.length) {
          // Act complete - show boss intro directly
          this.currentLevelIndex = nextLevelIndex;
          if (this.currentAct.bossId) {
            this.pendingBoss = this.currentAct.bossId;
            this.showingBossIntro = true;
            this.bossIntroTimer = 0;
          } else {
            this.advanceToNextAct();
          }
        } else if (this.currentAct) {
          // Show transition to next level
          const nextLevel = this.currentAct.levels[nextLevelIndex];
          if (nextLevel) {
            this.nextLevelData = {
              title: nextLevel.title,
              subtitle: nextLevel.subtitle,
              lore: nextLevel.copyLayers?.codexSnippet,
            };
            this.showingLevelTransition = true;
            this.levelTransitionTimer = 0;
          } else {
            this.currentLevelIndex = nextLevelIndex;
            this.loadCurrentAct(true);
          }
        }
        break;

      case 'expansion':
        if (this.currentExpansion && nextLevelIndex >= this.currentExpansion.levels.length) {
          // Expansion complete
          events.emit('game:complete', { score: this.score });
          this.game.getScenes().goto('victory');
        } else if (this.currentExpansion) {
          // Show transition to next level
          const nextLevel = this.currentExpansion.levels[nextLevelIndex];
          if (nextLevel) {
            this.nextLevelData = {
              title: nextLevel.title,
              subtitle: nextLevel.subtitle,
              lore: nextLevel.copyLayers?.codexSnippet,
            };
            this.showingLevelTransition = true;
            this.levelTransitionTimer = 0;
          } else {
            this.currentLevelIndex = nextLevelIndex;
            this.loadCurrentExpansion(true);
          }
        }
        break;
      default: {
        this.currentLevelIndex = nextLevelIndex;
        const sectors = contentLoader.getAllSectors();
        const sector = sectors[this.currentSectorIndex];
        if (this.currentLevelIndex >= sector.levels.length) {
          if (sector.boss) {
            this.pendingBoss = sector.boss;
            this.showingBossIntro = true;
            this.bossIntroTimer = 0;
          } else {
            this.advanceToNextSector();
          }
        } else {
          this.spawner.loadLevel(sector.levels[this.currentLevelIndex]);
        }
        break;
      }
    }
  }

  /**
   * Complete the level transition and load the next level
   */
  private completeLevelTransition(): void {
    this.currentLevelIndex++;
    this.showingLevelTransition = false;
    this.nextLevelData = null;

    switch (this.campaignMode) {
      case 'act':
        this.loadCurrentAct(true);
        break;
      case 'expansion':
        this.loadCurrentExpansion(true);
        break;
    }
  }

  private handleBossDefeated(): void {
    this.pendingBoss = null;
    this.showingSectorComplete = true;
    this.sectorCompleteTimer = 0;

    // Unlock rewards
    if (this.campaignMode === 'act' && this.currentAct?.unlocks) {
      storage.unlockSector(this.currentSectorIndex + 2);
      this.currentAct.unlocks.codex?.forEach((entry) => storage.unlockCodexEntry(entry));
      storage.save();
    } else if (this.campaignMode === 'sector') {
      const sectors = contentLoader.getAllSectors();
      const sector = sectors[this.currentSectorIndex];
      if (sector.unlocks) {
        storage.unlockSector(this.currentSectorIndex + 2);
        sector.unlocks.codex?.forEach((entry) => storage.unlockCodexEntry(entry));
        storage.save();
      }
    }
  }

  private advanceToNextAct(): void {
    const allActs = contentLoader.getAllActs();
    const currentActIndex = allActs.findIndex((a) => a.id === this.currentActId);

    this.currentSectorIndex++;
    this.currentLevelIndex = 0;

    if (currentActIndex >= 0 && currentActIndex + 1 < allActs.length) {
      const nextAct = allActs[currentActIndex + 1];
      this.currentAct = nextAct;
      this.currentActId = nextAct.id;

      // Show transition
      this.game
        .getScenes()
        .pushTransition(
          currentActIndex + 1,
          currentActIndex + 2,
          this.score,
          this.currentAct.unlocks?.powerups?.map((p) => `powerup:${p}`) || [],
        );
    } else {
      // Campaign complete!
      events.emit('game:complete', { score: this.score });
      this.game.getScenes().goto('victory');
    }
  }

  private advanceToNextSector(): void {
    const sectors = contentLoader.getAllSectors();
    const completedSectorIndex = this.currentSectorIndex;
    const completedSector = sectors[completedSectorIndex];

    this.currentSectorIndex++;
    this.currentLevelIndex = 0;

    if (this.currentSectorIndex < sectors.length) {
      const unlocks: string[] = [];
      if (completedSector?.unlocks) {
        completedSector.unlocks.powerups?.forEach((p) => unlocks.push(`powerup:${p}`));
        completedSector.unlocks.codex?.forEach((c) => unlocks.push(`codex:${c}`));
        completedSector.unlocks.cosmetics?.forEach((c) => unlocks.push(`cosmetic:${c}`));
      }

      this.game.getScenes().pushTransition(completedSectorIndex + 1, this.currentSectorIndex + 1, this.score, unlocks);
    } else {
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
    const { width, height } = this.game.getRenderer();

    this.player = new Player(width, height);
    this.weapons = new WeaponSystem(height);
    this.enemies = new EnemySystem(width, height);
    this.spawner = new Spawner(this.enemies, width);
    this.spawnerV2 = new SpawnerV2(this.enemies, width, height);
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

    // Reload current content
    this.loadCurrentContent(false);

    events.emit('game:start', { mode: 'campaign' });
  }

  update(dt: number, intent: PlayerIntent): void {
    this.time += dt;

    // Handle button clicks
    const mouseClick = this.game.getInput().getMouseClick();
    if (mouseClick && !this.gameOver) {
      if (this.hud.isPauseButtonClicked(mouseClick.x, mouseClick.y)) {
        this.game.getScenes().push('pause');
        return;
      }
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

    // Handle mute toggle via keyboard
    if (intent.mute && !this.gameOver) {
      const isMuted = this.game.getMusic().toggleMute();
      this.hud.setMuteState(isMuted);
    }

    if (this.gameOver) {
      this.updateGameOver(dt, intent);
      return;
    }

    // Level transition screen (between levels)
    if (this.showingLevelTransition) {
      this.levelTransitionTimer += dt;
      if (this.levelTransitionTimer > 2.5 || intent.confirm) {
        this.completeLevelTransition();
      }
      return;
    }

    // Rule card display
    if (this.showingRuleCard) {
      this.ruleCardTimer += dt;
      if (this.ruleCardTimer > 3 || intent.confirm) {
        this.showingRuleCard = false;
        // Now start spawning
        if (this.currentLevel) {
          this.spawnerV2.loadLevelV2(this.currentLevel);
        }
        // Show level title now that rule card is dismissed
        this.showLevelTitleForCurrentLevel();
      }
      return;
    }

    // Boss intro screen
    if (this.showingBossIntro) {
      this.bossIntroTimer += dt;
      if (this.bossIntroTimer > 3 || intent.confirm) {
        this.showingBossIntro = false;
        this.game.getScenes().pushBoss(this.pendingBoss!, this);
      }
      return;
    }

    // Sector complete screen
    if (this.showingSectorComplete) {
      this.sectorCompleteTimer += dt;
      if (this.sectorCompleteTimer > 3 || intent.confirm) {
        this.showingSectorComplete = false;
        if (this.campaignMode === 'act') {
          this.advanceToNextAct();
        } else {
          this.advanceToNextSector();
        }
      }
      return;
    }

    // Update camera
    this.camera.update(dt);

    // Update player
    this.player.updateFromIntent(intent, dt);

    // Auto-fire
    if (this.player.canFire()) {
      this.weapons.fire(this.player.transform.x, this.player.transform.y);
    }

    // Update weapons
    this.weapons.update(dt);

    // Update spawner based on mode
    if (this.campaignMode === 'act' || this.campaignMode === 'expansion') {
      this.spawnerV2.update(dt, this.player.transform.x, this.player.transform.y);
    } else {
      this.spawner.update(dt);
    }
    this.enemies.update(dt);

    // Update powerups
    this.powerups.update(dt);

    // Update drops
    this.drops.update(dt);

    // Update particles
    particles.update(dt);

    // Update dialogue system
    dialogueSystem.update(dt);

    // Update music combat intensity
    const enemyCount = this.enemies.getEnemies().length;
    const combatIntensity = Math.min(1, enemyCount / 8);
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

    // Update meters system
    const projectileCount = this.weapons.getProjectiles().length;
    const isPlayerMoving = Math.abs(intent.moveAxis) > 0.1;
    this.meters.update(dt, {
      enemyCount,
      projectileCount,
      playerDamaged: false, // Will be set true in damage handler
      playerMoving: isPlayerMoving,
    });

    // Pass meter values to HUD
    const meterValues = this.meters.getAll();
    this.hudState.noise = meterValues.noise;
    this.hudState.focus = meterValues.focus;
    this.hudState.stillness = meterValues.stillness;

    // Update rule card hint from current level - show lore (codexSnippet), not gameplay hints
    if (this.currentLevel?.copyLayers?.codexSnippet) {
      this.hudState.ruleCardHint = this.currentLevel.copyLayers.codexSnippet;
    } else if (this.currentLevel?.subtitle) {
      // Fall back to subtitle if no codexSnippet
      this.hudState.ruleCardHint = this.currentLevel.subtitle;
    } else {
      this.hudState.ruleCardHint = undefined;
    }

    const activePowerup = this.powerups.getActiveInfo();
    if (activePowerup) {
      this.hudState.powerupActive = activePowerup.id;
      this.hudState.powerupTimeRemaining = activePowerup.timeRemaining;
    } else {
      this.hudState.powerupActive = null;
      this.hudState.powerupTimeRemaining = 0;
    }

    this.hud.update(dt, this.hudState);
  }

  private updateGameOver(dt: number, intent: PlayerIntent): void {
    this.gameOverTimer += dt;
    this.gameOverInputCooldown = Math.max(0, this.gameOverInputCooldown - dt);

    if (this.gameOverTimer > 1.5 && this.gameOverInputCooldown <= 0) {
      if (intent.menuAxis < -0.5) {
        this.gameOverSelectedOption = 0;
        this.gameOverInputCooldown = 0.2;
      } else if (intent.menuAxis > 0.5) {
        this.gameOverSelectedOption = 1;
        this.gameOverInputCooldown = 0.2;
      }

      if (intent.confirm) {
        if (this.gameOverSelectedOption === 0) {
          this.retryLevel();
        } else {
          this.game.getScenes().goto('menu');
        }
      }
    }
  }

  private handleCollisions(): void {
    const projectiles = this.weapons.getProjectiles();
    const enemies = this.enemies.getEnemies();
    const pickups = this.powerups.getPickups();
    const drops = this.drops.getDrops();

    // Projectiles vs Enemies
    collisionSystem.checkGroups(projectiles, enemies, (proj, enemy) => {
      const enemyEntity = enemy as import('../gameplay/enemies').Enemy;

      if (proj.hasTag('beam')) {
        const beam = proj as import('../gameplay/weapons').Beam;
        if (beam.hasHitEnemy(enemyEntity.id)) {
          return;
        }
        beam.markEnemyHit(enemyEntity.id);
        particles.bananaHit(enemyEntity.transform.x, enemyEntity.transform.y);
        if (enemyEntity.onDamage(beam.damage)) {
          this.game.getAudio().playHit();
        }
      } else {
        const banana = proj as import('../gameplay/weapons').Banana;
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
        particles.playerDamage(this.player.transform.x, this.player.transform.y);
      }
    });

    // Player vs Powerups
    collisionSystem.checkGroups([this.player], pickups, (_player, pickup) => {
      const powerupPickup = pickup as PowerupPickup;
      const color = powerupPickup.category === 'calm' ? '#00aaff' : '#ff0066';
      particles.powerupCollect(powerupPickup.transform.x, powerupPickup.transform.y, color);
      this.powerups.collect(powerupPickup);
      this.game.getAudio().playPowerup();
    });

    // Player vs Drops
    collisionSystem.checkGroups([this.player], drops, (_player, drop) => {
      const dropEntity = drop as Drop;
      particles.powerupCollect(dropEntity.transform.x, dropEntity.transform.y, dropEntity.config.color);
      this.drops.collect(dropEntity);
      this.game.getAudio().playPowerup();
    });
  }

  render(renderer: Renderer, _alpha: number): void {
    const { width, height } = renderer;

    // Background
    this.renderBackground(renderer);

    // Rule card overlay
    if (this.showingRuleCard && this.currentLevel) {
      this.renderRuleCard(renderer, width, height);
      return;
    }

    // Boss intro overlay
    if (this.showingBossIntro) {
      this.renderBossIntro(renderer, width, height);
      return;
    }

    // Level transition overlay
    if (this.showingLevelTransition) {
      this.renderLevelTransition(renderer, width, height);
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

    // Particles
    particles.render(renderer);

    // Floating dialogue
    dialogueSystem.render(renderer);

    // HUD
    this.hud.render(renderer, this.hudState, this.player);

    // Game over overlay
    if (this.gameOver) {
      this.renderGameOver(renderer, width, height);
    }
  }

  private renderBackground(renderer: Renderer): void {
    const { width, height } = renderer;

    // Clear canvas and reset context state to prevent bleeding
    renderer.context.globalAlpha = 1;
    renderer.fillRect(0, 0, width, height, '#000000');

    if (this.campaignMode === 'act' && this.currentAct) {
      // Use level-specific backgrounds if available, fall back to act-level with variation
      drawActSvgBackground(
        renderer,
        this.currentAct.id,
        width,
        height,
        this.time,
        this.currentLevelIndex,
        this.currentLevel?.bgLayers,
      );
    } else if (this.campaignMode === 'expansion' && this.currentExpansion && this.currentLevel) {
      // Use expansion-themed SVG background from level data
      const expansionShortId = this.currentLevel.expansion || this.currentExpansion.id.replace('expansion_', '');
      drawLevelSvgBackground(renderer, this.currentLevel.bgLayers || [], expansionShortId, width, height, this.time);
    } else {
      // Legacy sector mode
      drawBackground(renderer, getBackgroundForSector(this.currentSectorIndex + 1), width, height, this.time);
    }

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

  private renderRuleCard(renderer: Renderer, width: number, height: number): void {
    if (!this.currentLevel?.ruleCard) return;

    const ctx = renderer.context;

    // Ensure full opacity for rule card display
    ctx.globalAlpha = 1;

    // Solid dark background (fully opaque to hide gameplay behind)
    renderer.fillRect(0, 0, width, height, '#080810');

    // Add subtle gradient overlay for depth
    const gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width * 0.6);
    gradient.addColorStop(0, 'rgba(20, 20, 35, 1)');
    gradient.addColorStop(1, 'rgba(8, 8, 16, 1)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Decorative border lines
    ctx.strokeStyle = CONFIG.COLORS.PRIMARY;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.moveTo(0, 60);
    ctx.lineTo(width, 60);
    ctx.moveTo(0, height - 60);
    ctx.lineTo(width, height - 60);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Level title with strong glow
    ctx.save();
    ctx.shadowColor = CONFIG.COLORS.PRIMARY;
    ctx.shadowBlur = 25;
    renderer.glowText(
      this.currentLevel.title.toUpperCase(),
      width / 2,
      height * 0.25,
      CONFIG.COLORS.PRIMARY,
      36,
      'center',
      25,
    );
    ctx.restore();

    if (this.currentLevel.subtitle) {
      renderer.text(this.currentLevel.subtitle, width / 2, height * 0.32, CONFIG.COLORS.TEXT_LIGHT, 18, 'center');
    }

    // Lore box with glow - show world lore instead of gameplay rules
    const boxWidth = 500;
    const boxHeight = 140;
    const boxX = (width - boxWidth) / 2;
    const boxY = height * 0.43;

    ctx.save();
    ctx.shadowColor = CONFIG.COLORS.PRIMARY;
    ctx.shadowBlur = 15;
    renderer.strokeRect(boxX, boxY, boxWidth, boxHeight, CONFIG.COLORS.PRIMARY, 2);
    ctx.restore();
    renderer.fillRect(boxX + 2, boxY + 2, boxWidth - 4, boxHeight - 4, '#12121e');

    // Lore label
    renderer.glowText('INSIGHT', width / 2, boxY + 25, CONFIG.COLORS.PRIMARY, 14, 'center', 10);

    // Show ONLY lore text (codexSnippet) - never show gameplay hints
    const loreText =
      this.currentLevel.copyLayers?.codexSnippet ||
      this.currentLevel.subtitle ||
      'The mind awakens to new possibilities...';

    // Wrap long text for better display
    ctx.font = "16px 'SF Mono', Consolas, monospace";
    const maxWidth = boxWidth - 40;
    const words = loreText.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);

    // Draw wrapped text
    const lineHeight = 22;
    const textStartY = boxY + 55;
    ctx.fillStyle = CONFIG.COLORS.TEXT_LIGHT;
    ctx.textAlign = 'center';
    for (let i = 0; i < lines.length && i < 3; i++) {
      ctx.fillText(lines[i], width / 2, textStartY + i * lineHeight);
    }

    // Radio whisper quote at bottom if available
    if (this.currentLevel.copyLayers?.radioWhisper) {
      ctx.globalAlpha = 0.5;
      ctx.font = "italic 12px 'SF Mono', Consolas, monospace";
      ctx.fillStyle = CONFIG.COLORS.TEXT_DIM;
      ctx.fillText(`"${this.currentLevel.copyLayers.radioWhisper}"`, width / 2, boxY + boxHeight - 15);
      ctx.globalAlpha = 1;
    }

    // Continue hint with pulsing effect
    if (this.ruleCardTimer > 1) {
      const pulse = 0.5 + Math.sin(this.time * 3) * 0.3;
      ctx.globalAlpha = pulse;
      renderer.text('PRESS SPACE TO BEGIN', width / 2, height * 0.88, CONFIG.COLORS.PRIMARY, 16, 'center');
      ctx.globalAlpha = 1;
    }
  }

  private renderBossIntro(renderer: Renderer, width: number, height: number): void {
    const ctx = renderer.context;

    // Ensure full opacity
    ctx.globalAlpha = 1;

    // Solid dark background
    renderer.fillRect(0, 0, width, height, '#080810');

    // Red-tinted gradient for danger feel
    const gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width * 0.5);
    gradient.addColorStop(0, 'rgba(30, 10, 15, 1)');
    gradient.addColorStop(1, 'rgba(8, 8, 16, 1)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const pulse = Math.sin(this.bossIntroTimer * 4) * 0.3 + 0.7;

    ctx.save();
    ctx.globalAlpha = pulse;

    renderer.glowText('WARNING', width / 2, height * 0.25, CONFIG.COLORS.DANGER, 28, 'center', 20);

    ctx.restore();
    ctx.globalAlpha = 1;

    const bossData = contentLoader.getBoss(this.pendingBoss!);
    const bossName = bossData?.name || this.pendingBoss || 'UNKNOWN';

    ctx.save();
    ctx.shadowColor = CONFIG.COLORS.ACCENT;
    ctx.shadowBlur = 30;
    renderer.glowText(bossName.toUpperCase(), width / 2, height * 0.45, CONFIG.COLORS.ACCENT, 48, 'center', 35);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = pulse;
    renderer.glowText('APPROACHING', width / 2, height * 0.6, CONFIG.COLORS.DANGER, 32, 'center', 25);
    ctx.restore();
    ctx.globalAlpha = 1;

    if (this.bossIntroTimer > 1) {
      const textPulse = 0.5 + Math.sin(this.time * 3) * 0.3;
      ctx.globalAlpha = textPulse;
      renderer.text('PRESS SPACE TO ENGAGE', width / 2, height * 0.85, CONFIG.COLORS.PRIMARY, 16, 'center');
      ctx.globalAlpha = 1;
    }
  }

  /**
   * Render transition screen between levels showing story progress
   */
  private renderLevelTransition(renderer: Renderer, width: number, height: number): void {
    const ctx = renderer.context;

    // Ensure full opacity
    ctx.globalAlpha = 1;

    // Solid dark background
    renderer.fillRect(0, 0, width, height, '#080810');

    // Soft gradient
    const gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width * 0.5);
    gradient.addColorStop(0, 'rgba(15, 20, 30, 1)');
    gradient.addColorStop(1, 'rgba(8, 8, 16, 1)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // "Level Complete" header
    ctx.save();
    ctx.shadowColor = CONFIG.COLORS.PRIMARY;
    ctx.shadowBlur = 20;
    renderer.glowText('LEVEL COMPLETE', width / 2, height * 0.22, CONFIG.COLORS.PRIMARY, 28, 'center', 20);
    ctx.restore();

    // Current level finished
    renderer.text(
      this.currentLevel?.title || 'Unknown',
      width / 2,
      height * 0.32,
      CONFIG.COLORS.TEXT_DIM,
      18,
      'center',
    );

    // Decorative divider
    ctx.strokeStyle = CONFIG.COLORS.PRIMARY;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.moveTo(width * 0.3, height * 0.4);
    ctx.lineTo(width * 0.7, height * 0.4);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // "Next" label
    renderer.text('NEXT', width / 2, height * 0.48, CONFIG.COLORS.ACCENT, 14, 'center');

    // Next level title
    if (this.nextLevelData) {
      ctx.save();
      ctx.shadowColor = CONFIG.COLORS.SECONDARY;
      ctx.shadowBlur = 15;
      renderer.glowText(
        this.nextLevelData.title.toUpperCase(),
        width / 2,
        height * 0.55,
        CONFIG.COLORS.SECONDARY,
        32,
        'center',
        18,
      );
      ctx.restore();

      // Subtitle if available
      if (this.nextLevelData.subtitle) {
        renderer.text(this.nextLevelData.subtitle, width / 2, height * 0.62, CONFIG.COLORS.TEXT_LIGHT, 16, 'center');
      }

      // Lore snippet if available
      if (this.nextLevelData.lore) {
        ctx.globalAlpha = 0.7;
        ctx.font = "italic 14px 'SF Mono', Consolas, monospace";
        ctx.fillStyle = CONFIG.COLORS.TEXT_DIM;
        ctx.textAlign = 'center';

        // Word wrap lore text
        const maxWidth = width * 0.7;
        const words = this.nextLevelData.lore.split(' ');
        const lines: string[] = [];
        let currentLine = '';

        for (const word of words) {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          const metrics = ctx.measureText(testLine);
          if (metrics.width > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        }
        if (currentLine) lines.push(currentLine);

        // Draw wrapped text (max 2 lines)
        const lineHeight = 20;
        const loreStartY = height * 0.72;
        for (let i = 0; i < Math.min(lines.length, 2); i++) {
          ctx.fillText(
            `"${lines[i]}${i === Math.min(lines.length, 2) - 1 ? '"' : ''}`,
            width / 2,
            loreStartY + i * lineHeight,
          );
        }
        ctx.globalAlpha = 1;
      }
    }

    // Continue hint with pulsing
    if (this.levelTransitionTimer > 1) {
      const pulse = 0.5 + Math.sin(this.time * 3) * 0.3;
      ctx.globalAlpha = pulse;
      renderer.text('PRESS SPACE TO CONTINUE', width / 2, height * 0.88, CONFIG.COLORS.PRIMARY, 14, 'center');
      ctx.globalAlpha = 1;
    }
  }

  private renderSectorComplete(renderer: Renderer, width: number, height: number): void {
    const ctx = renderer.context;

    // Ensure full opacity
    ctx.globalAlpha = 1;

    // Solid dark background
    renderer.fillRect(0, 0, width, height, '#080810');

    // Success-tinted gradient
    const gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width * 0.5);
    gradient.addColorStop(0, 'rgba(10, 25, 25, 1)');
    gradient.addColorStop(1, 'rgba(8, 8, 16, 1)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const title = this.campaignMode === 'act' ? 'ACT COMPLETE' : 'SECTOR COMPLETE';

    ctx.save();
    ctx.shadowColor = CONFIG.COLORS.PRIMARY;
    ctx.shadowBlur = 30;
    renderer.glowText(title, width / 2, height * 0.3, CONFIG.COLORS.PRIMARY, 42, 'center', 30);
    ctx.restore();

    renderer.glowText(this.hudState.sectorName, width / 2, height * 0.45, CONFIG.COLORS.SECONDARY, 32, 'center', 20);

    ctx.save();
    ctx.shadowColor = CONFIG.COLORS.ACCENT;
    ctx.shadowBlur = 15;
    renderer.glowText(`SCORE: ${this.score}`, width / 2, height * 0.6, CONFIG.COLORS.ACCENT, 28, 'center', 15);
    ctx.restore();

    if (this.sectorCompleteTimer > 1.5) {
      const pulse = 0.5 + Math.sin(this.time * 3) * 0.3;
      ctx.globalAlpha = pulse;
      renderer.text('PRESS SPACE TO CONTINUE', width / 2, height * 0.8, CONFIG.COLORS.PRIMARY, 16, 'center');
      ctx.globalAlpha = 1;
    }
  }

  private renderGameOver(renderer: Renderer, width: number, height: number): void {
    renderer.save();
    renderer.setAlpha(0.85);
    renderer.fillRect(0, 0, width, height, '#000000');
    renderer.restore();

    renderer.glowText(
      contentLoader.getString('game_over'),
      width / 2,
      height * 0.25,
      CONFIG.COLORS.DANGER,
      48,
      'center',
      20,
    );

    renderer.glowText(
      `${contentLoader.getString('score')}: ${this.score}`,
      width / 2,
      height * 0.4,
      CONFIG.COLORS.PRIMARY,
      28,
      'center',
      10,
    );

    const isHighScore = this.score > storage.getHighScore('campaign');
    if (isHighScore) {
      renderer.glowText(
        contentLoader.getString('new_high_score'),
        width / 2,
        height * 0.5,
        CONFIG.COLORS.ACCENT,
        20,
        'center',
        15,
      );
    }

    if (this.gameOverTimer > 1.5) {
      const menuY = isHighScore ? height * 0.62 : height * 0.55;
      const menuSpacing = 40;

      const retrySelected = this.gameOverSelectedOption === 0;
      const retryColor = retrySelected ? CONFIG.COLORS.PRIMARY : CONFIG.COLORS.TEXT_DIM;
      renderer.text(
        retrySelected ? '> RETRY <' : 'RETRY',
        width / 2,
        menuY,
        retryColor,
        retrySelected ? 22 : 18,
        'center',
      );

      const quitSelected = this.gameOverSelectedOption === 1;
      const quitColor = quitSelected ? CONFIG.COLORS.PRIMARY : CONFIG.COLORS.TEXT_DIM;
      renderer.text(
        quitSelected ? '> QUIT <' : 'QUIT',
        width / 2,
        menuY + menuSpacing,
        quitColor,
        quitSelected ? 22 : 18,
        'center',
      );

      renderer.text('↑ ↓ SELECT   SPACE CONFIRM', width / 2, height * 0.85, CONFIG.COLORS.TEXT_DIM, 12, 'center');
    }
  }
}
