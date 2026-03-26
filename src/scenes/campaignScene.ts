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
import { NeuroAbilities } from '../gameplay/neuroAbilities';
import { Player } from '../gameplay/player';
import { type PowerupPickup, PowerupSystem } from '../gameplay/powerups';
import { SessionRecorder } from '../gameplay/sessionRecorder';
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
  private neuroAbilities!: NeuroAbilities;

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
  private gameOverSelectedOption: number = 0;
  private gameOverInputCooldown: number = 0;

  // Breathe gate state
  private breatheGateActive = false;
  private breatheGateTimer = 0;
  private breatheGateCalmTimer = 0;
  private readonly breatheGateTimeout = 8;

  // Session recorder for neuro performance reports
  private sessionRecorder: SessionRecorder = new SessionRecorder();
  private pendingLevelReport = false;

  // Alpha bump score bonus
  private alphaBumpBonusTimer = 0;
  private alphaBumpFlashTimer = 0;

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
    this.neuroAbilities = new NeuroAbilities();

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

    // Wire webcam video element to HUD for face preview
    this.hud.setVideoElement(this.game.getNeuroManager().getCameraVideoElement());

    // Start procedural music
    this.updateMusic();
    this.game.getMusic().start();

    // Prompt for neuro device if nothing is connected
    if (!this.game.getNeuroManager().hasActiveSource()) {
      this.game.getScenes().push('deviceGate');
    }
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

  override resume(): void {
    // Returning from level report — proceed with the normal transition
    if (this.pendingLevelReport) {
      this.pendingLevelReport = false;
      this.proceedAfterLevelComplete();
      return;
    }

    // Don't reload content if we're showing sector complete (boss just defeated)
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

    // Clear previous level dialogue before registering new ones
    if (this.currentLevel.levelEnemies) {
      contentLoader.clearLevelEnemyDialogue(Object.keys(this.currentLevel.levelEnemies));
      contentLoader.registerLevelEnemyDialogue(this.currentLevel.levelEnemies);
    }

    // Update HUD
    this.hudState.sector = this.currentAct.id;
    this.hudState.sectorName = this.currentAct.name;
    this.hudState.levelName = this.currentLevel.title;

    this.sessionRecorder.start(
      `${this.currentAct.id}-L${this.currentLevelIndex + 1}`,
      this.currentLevel.title,
      this.currentAct.name,
    );

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

    // Clear previous level dialogue before registering new ones
    if (this.currentLevel.levelEnemies) {
      contentLoader.clearLevelEnemyDialogue(Object.keys(this.currentLevel.levelEnemies));
      contentLoader.registerLevelEnemyDialogue(this.currentLevel.levelEnemies);
    }

    this.hudState.sector = this.currentExpansion.id;
    this.hudState.sectorName = this.currentExpansion.name;
    this.hudState.levelName = this.currentLevel.title;

    this.sessionRecorder.start(
      `${this.currentExpansion.id}-L${this.currentLevelIndex + 1}`,
      this.currentLevel.title,
      this.currentExpansion.name,
    );

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

    this.sessionRecorder.start(
      `${sector.id}-L${this.currentLevelIndex + 1}`,
      `Level ${this.currentLevelIndex + 1}`,
      sector.name,
    );

    // Show sector intro for first level of each sector
    if (showIntro && this.currentLevelIndex === 0) {
      this.game.getScenes().pushLevelStory(sector.id, true);
    }
  }

  private setupEventListeners(): void {
    events.on('wave:start', ({ number }) => {
      this.hudState.wave = number;
    });

    events.on('wave:complete', () => {
      if (this.currentLevel?.breatheGate && !this.breatheGateActive) {
        this.breatheGateActive = true;
        this.breatheGateTimer = 0;
        this.breatheGateCalmTimer = 0;
      }
    });

    events.on('neuro:disconnected', ({ source }) => {
      const msg =
        source === 'eeg'
          ? 'Headband disconnected — ESC > Neuro Settings to reconnect'
          : 'Camera lost — ESC > Neuro Settings to reconnect';
      this.hud.showToast(msg, '#ff6644');
    });

    events.on('neuro:source_changed', ({ to }) => {
      const label = to === 'eeg' ? 'EEG headband' : to === 'rppg' ? 'webcam' : to === 'mock' ? 'simulation' : 'none';
      this.hud.showToast(`Signal source: ${label}`);
    });

    events.on('neuro:camera_quality_low', () => {
      this.hud.showToast('Camera signal weak — check lighting', '#ffaa44');
    });

    events.on('neuro:alpha_bump', () => {
      this.alphaBumpBonusTimer = 2;
      this.alphaBumpFlashTimer = 0.3;
      this.hud.showToast('ALPHA BURST — 2x SCORE', '#00ffcc');
      this.sessionRecorder.recordAlphaBump();
    });

    events.on('enemy:spawn', () => {
      // Update meters when enemy spawns
      this.meters.onEnemySpawn(1);
    });

    events.on('enemy:death', ({ position, type }) => {
      this.addScore(10);
      this.incrementCombo();
      this.sessionRecorder.recordKill();

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
      this.meters.onPlayerDamage(amount);
      this.sessionRecorder.recordDamage();
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
    // Stop the session recorder and push the report scene
    if (this.sessionRecorder.isActive()) {
      const report = this.sessionRecorder.stop(this.score);
      this.game.getScenes().setContext('levelReport', report);
      this.pendingLevelReport = true;
      this.game.getScenes().push('levelReport');
      return;
    }

    this.proceedAfterLevelComplete();
  }

  private proceedAfterLevelComplete(): void {
    const nextLevelIndex = this.currentLevelIndex + 1;

    switch (this.campaignMode) {
      case 'act':
        if (this.currentAct && nextLevelIndex >= this.currentAct.levels.length) {
          this.currentLevelIndex = nextLevelIndex;
          if (this.currentAct.bossId) {
            this.pendingBoss = this.currentAct.bossId;
            this.showingBossIntro = true;
            this.bossIntroTimer = 0;
          } else {
            this.advanceToNextAct();
          }
        } else if (this.currentAct) {
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
          events.emit('game:complete', { score: this.score });
          this.game.getScenes().goto('victory');
        } else if (this.currentExpansion) {
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
    const alphaBumpMultiplier = this.alphaBumpBonusTimer > 0 ? 2 : 1;
    const totalAmount = Math.floor(amount * comboMultiplier * alphaBumpMultiplier);
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

    // Pass mouse position to HUD for hover tooltips
    this.hud.setMousePos(this.game.getInput().getMousePos());

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
      if (this.hud.isInfoButtonClicked(mouseClick.x, mouseClick.y)) {
        this.game.getScenes().push('howToPlay');
        return;
      }
      if (this.hud.isNeuroButtonClicked(mouseClick.x, mouseClick.y)) {
        this.game.getScenes().push('neuroSettings');
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

    // Handle debug overlay toggle
    if (intent.debugToggle) {
      this.hud.toggleDebug();
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

    // Update weapon mode from neuro state
    this.weapons.setNeuroState(intent.calm ?? 0, intent.arousal ?? 0);
    this.weapons.setEnemyPositions(this.enemies.getEnemies().map((e) => ({ x: e.transform.x, y: e.transform.y })));
    this.hudState.weaponMode = this.weapons.getWeaponMode();

    // Auto-fire
    if (this.player.canFire(this.weapons.getFireRateModifier())) {
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

    // Update music combat intensity + heart rate tempo
    const enemyCount = this.enemies.getEnemies().length;
    const combatIntensity = Math.min(1, enemyCount / 8);
    this.game.getMusic().setCombatIntensity(combatIntensity);
    const neuroForMusic = this.game.getNeuroManager().getState();
    this.game.getMusic().setHeartRateBpm(neuroForMusic.bpm, neuroForMusic.bpmQuality);

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

    // Populate neuro HUD fields
    const neuro = this.game.getNeuroManager().getState();
    this.hudState.neuroSource = neuro.source;
    this.hudState.bpm = neuro.bpm;
    this.hudState.bpmQuality = neuro.bpmQuality;
    this.hudState.signalQuality = neuro.signalQuality;
    this.hudState.alphaPower = neuro.alphaPower;
    this.hudState.betaPower = neuro.betaPower;
    this.hudState.thetaPower = neuro.thetaPower;
    this.hudState.alphaBump = neuro.alphaBump;

    // Evaluate NeuroHooks from current level
    if (this.currentLevel?.neuroHooks) {
      for (const hook of this.currentLevel.neuroHooks) {
        const value =
          hook.trigger === 'calm' ? (intent.calm ?? 0) : hook.trigger === 'arousal' ? (intent.arousal ?? 0) : null;
        if (value !== null && value > hook.threshold) {
          events.emit('neuro:hook', { effect: hook.effect, params: hook.params });
        }
      }
    }

    // Update neuro-reactive enemies (observed/unseen modifiers)
    const calm = this.hudState.calmLevel;
    const arousal = this.hudState.arousalLevel;
    for (const entity of this.enemies.getEnemies()) {
      const enemy = entity as import('../gameplay/enemies').Enemy;
      if (enemy.hasModifier?.('observed')) {
        enemy.dormant = arousal < 0.3;
      }
      if (enemy.hasModifier?.('unseen')) {
        enemy.neuroInvulnerable = calm < 0.5;
      }
    }

    // Update meters system
    const projectileCount = this.weapons.getProjectiles().length;
    const isPlayerMoving = Math.abs(intent.moveAxis) > 0.1;
    const neuroState = this.game.getNeuroManager().getState();
    this.meters.update(dt, {
      enemyCount,
      projectileCount,
      playerDamaged: false,
      playerMoving: isPlayerMoving,
      calm: neuroState.calm,
      arousal: neuroState.arousal,
      alpha: neuroState.alphaPower ?? 0,
      beta: neuroState.betaPower ?? 0,
      theta: neuroState.thetaPower ?? 0,
    });

    // Sample neuro data for session report
    const playerHealth = this.player.health?.current ?? 0;
    const playerHealthMax = this.player.health?.max ?? 1;
    this.sessionRecorder.sample(
      dt,
      neuroState,
      this.score,
      this.combo,
      this.player.transform.x,
      playerHealth,
      playerHealthMax,
    );

    // Pass raw SDK meter values to HUD
    this.hudState.noise = this.meters.getArousal();
    this.hudState.focus = this.meters.getCalm();
    this.hudState.stillness = this.meters.getAlpha();
    this.hudState.betaMeter = this.meters.getBeta();
    this.hudState.thetaMeter = this.meters.getTheta();

    // Update neuro abilities
    this.neuroAbilities.update(
      dt,
      this.hudState.calmLevel,
      this.hudState.arousalLevel,
      this.player,
      this.weapons,
      neuroState.hrvRmssd,
    );
    this.hudState.shieldCharge = this.neuroAbilities.getShieldCharge();
    this.hudState.overdriveCharge = this.neuroAbilities.getOverdriveCharge();
    this.hudState.shieldActive = this.neuroAbilities.isShieldActive();
    this.hudState.overdriveActive = this.neuroAbilities.isOverdriveActive();

    // Alpha bump bonus timer
    if (this.alphaBumpBonusTimer > 0) this.alphaBumpBonusTimer -= dt;
    if (this.alphaBumpFlashTimer > 0) this.alphaBumpFlashTimer -= dt;

    // Gamma power -> damage bonus (high gamma = peak concentration)
    const gammaPower = neuroState.gammaPower ?? 0;
    if (gammaPower > 0.3) {
      this.weapons.setDamageMultiplier(1 + gammaPower * 0.5);
    }
    this.hudState.eegConnected = neuro.eegConnected;
    this.hudState.cameraActive = neuro.cameraActive;
    this.hudState.calibrationProgress =
      this.game.getNeuroManager().getRppgProvider()?.getState().calibrationProgress ?? 0;
    this.hudState.waveformData = this.game.getMusic().getWaveformData();
    this.hudState.frequencyData = this.game.getMusic().getFrequencyData();
    this.hudState.effectiveTempo = this.game.getMusic().getEffectiveTempo();
    this.hudState.eegLastError = this.game.getNeuroManager().getHeadbandErrorMessage() || undefined;
    this.hudState.cameraLastError = this.game.getNeuroManager().getCameraErrorMessage() || undefined;

    const rppgState = this.game.getNeuroManager().getRppgProvider()?.getState();
    if (rppgState) {
      this.hudState.displayBpm = rppgState.displayBpm;
      this.hudState.rawBpm = rppgState.rawBpm;
      this.hudState.smoothedBpm = rppgState.smoothedBpm;
      this.hudState.lastValidBpm = rppgState.lastValidBpm;
      this.hudState.lastValidBpmAge = rppgState.lastValidBpmAge;
      this.hudState.rppgActiveTime = rppgState.activeTime;
      this.hudState.rppgWarmupComplete = rppgState.warmupComplete;
      this.hudState.videoWidth = rppgState.videoWidth;
      this.hudState.videoHeight = rppgState.videoHeight;
      this.hudState.bpmHistory = rppgState.bpmHistory;
    }

    const eegProvider = this.game.getNeuroManager().getEEGProvider();
    this.hudState.eegSamples = eegProvider.getRecentSamples();
    this.hudState.eegFrameCount = eegProvider.getFrameCount();
    this.hudState.eegDecodeErrors = eegProvider.getDecodeErrorCount();
    this.hudState.eegBleNotifications = eegProvider.getBleNotificationCount();
    this.hudState.eegEmptyDecodes = eegProvider.getEmptyDecodeCount();
    this.hudState.eegModelsReady = eegProvider.isModelsReady();
    this.hudState.eegBatteryLevel = eegProvider.getBatteryLevel();
    this.hudState.eegReconnecting = eegProvider.isReconnecting();
    this.hudState.eegReconnectAttempt = eegProvider.getReconnectAttempt();
    this.hudState.eegReconnectCount = eegProvider.getReconnectCount();
    this.hudState.eegBandHistory = eegProvider.getBandPowerHistory();

    this.hudState.hrvRmssd = neuro.hrvRmssd;
    this.hudState.respirationRate = neuro.respirationRate;
    this.hudState.baselineBpm = neuro.baselineBpm;
    this.hudState.baselineDelta = neuro.baselineDelta;
    this.hudState.calmnessState = neuro.calmnessState;
    this.hudState.alphaPeakFreq = neuro.alphaPeakFreq;
    this.hudState.alphaBumpState = neuro.alphaBumpState;
    this.hudState.deltaPower = neuro.deltaPower;
    this.hudState.gammaPower = neuro.gammaPower;
    this.hudState.confidence = rppgState?.confidence ?? 0;
    this.hudState.rppgDebugMetrics = rppgState?.debugMetrics ?? null;

    // Re-wire video element each frame in case camera was enabled after scene enter
    this.hud.setVideoElement(this.game.getNeuroManager().getCameraVideoElement());

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

    // Breathe gate logic
    if (this.breatheGateActive) {
      this.breatheGateTimer += dt;
      if ((intent.calm ?? 0) > 0.6) {
        this.breatheGateCalmTimer += dt;
      } else {
        this.breatheGateCalmTimer = Math.max(0, this.breatheGateCalmTimer - dt * 0.5);
      }
      if (this.breatheGateCalmTimer >= 1 || this.breatheGateTimer >= this.breatheGateTimeout) {
        this.breatheGateActive = false;
      }
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

    // Breathe gate overlay
    if (this.breatheGateActive) {
      this.renderBreatheGate(renderer, width, height);
    }

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

    // Level title with strong glow — auto-size to fit
    const titleStr = this.currentLevel.title.toUpperCase();
    ctx.font = "36px 'SF Mono', Consolas, monospace";
    let titleSize = 36;
    if (ctx.measureText(titleStr).width > width * 0.7) {
      titleSize = 28;
      if (ctx.measureText(titleStr).width > width * 0.7) titleSize = 22;
    }

    ctx.save();
    ctx.shadowColor = CONFIG.COLORS.PRIMARY;
    ctx.shadowBlur = 25;
    renderer.glowText(titleStr, width / 2, height * 0.25, CONFIG.COLORS.PRIMARY, titleSize, 'center', 25);
    ctx.restore();

    if (this.currentLevel.subtitle) {
      ctx.font = "18px 'SF Mono', Consolas, monospace";
      const subStr = this.currentLevel.subtitle;
      let subSize = 18;
      if (ctx.measureText(subStr).width > width * 0.7) subSize = 14;
      renderer.text(subStr, width / 2, height * 0.32, CONFIG.COLORS.TEXT_LIGHT, subSize, 'center');
    }

    // Lore box — taller to accommodate more lines
    const boxWidth = Math.min(500, width * 0.65);
    const boxHeight = 180;
    const boxX = (width - boxWidth) / 2;
    const boxY = height * 0.4;

    ctx.save();
    ctx.shadowColor = CONFIG.COLORS.PRIMARY;
    ctx.shadowBlur = 15;
    renderer.strokeRect(boxX, boxY, boxWidth, boxHeight, CONFIG.COLORS.PRIMARY, 2);
    ctx.restore();
    renderer.fillRect(boxX + 2, boxY + 2, boxWidth - 4, boxHeight - 4, '#12121e');

    renderer.glowText(
      contentLoader.getString('campaign_insight'),
      width / 2,
      boxY + 25,
      CONFIG.COLORS.PRIMARY,
      14,
      'center',
      10,
    );

    const loreText =
      this.currentLevel.copyLayers?.codexSnippet ||
      this.currentLevel.subtitle ||
      contentLoader.getString('campaign_rule_default_lore');

    ctx.font = "15px 'SF Mono', Consolas, monospace";
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

    const lineHeight = 20;
    const textStartY = boxY + 50;
    ctx.fillStyle = CONFIG.COLORS.TEXT_LIGHT;
    ctx.textAlign = 'center';
    for (let i = 0; i < lines.length && i < 5; i++) {
      ctx.fillText(lines[i], width / 2, textStartY + i * lineHeight);
    }

    // Radio whisper — word-wrapped
    if (this.currentLevel.copyLayers?.radioWhisper) {
      ctx.globalAlpha = 0.5;
      ctx.font = "italic 11px 'SF Mono', Consolas, monospace";
      ctx.fillStyle = CONFIG.COLORS.TEXT_DIM;
      const whisper = `"${this.currentLevel.copyLayers.radioWhisper}"`;
      const whisperMaxW = boxWidth - 30;
      if (ctx.measureText(whisper).width > whisperMaxW) {
        const wWords = whisper.split(' ');
        let wLine = '';
        let wy = 0;
        for (const w of wWords) {
          const test = wLine ? `${wLine} ${w}` : w;
          if (ctx.measureText(test).width > whisperMaxW && wLine) {
            ctx.fillText(wLine, width / 2, boxY + boxHeight - 28 + wy);
            wLine = w;
            wy += 13;
          } else {
            wLine = test;
          }
        }
        if (wLine) ctx.fillText(wLine, width / 2, boxY + boxHeight - 28 + wy);
      } else {
        ctx.fillText(whisper, width / 2, boxY + boxHeight - 15);
      }
      ctx.globalAlpha = 1;
    }

    // Continue hint with pulsing effect
    if (this.ruleCardTimer > 1) {
      const pulse = 0.5 + Math.sin(this.time * 3) * 0.3;
      ctx.globalAlpha = pulse;
      renderer.text(
        contentLoader.getString('campaign_press_space_begin'),
        width / 2,
        height * 0.88,
        CONFIG.COLORS.PRIMARY,
        16,
        'center',
      );
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

    renderer.glowText(
      contentLoader.getString('campaign_warning'),
      width / 2,
      height * 0.25,
      CONFIG.COLORS.DANGER,
      28,
      'center',
      20,
    );

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
    renderer.glowText(
      contentLoader.getString('campaign_approaching'),
      width / 2,
      height * 0.6,
      CONFIG.COLORS.DANGER,
      32,
      'center',
      25,
    );
    ctx.restore();
    ctx.globalAlpha = 1;

    if (this.bossIntroTimer > 1) {
      const textPulse = 0.5 + Math.sin(this.time * 3) * 0.3;
      ctx.globalAlpha = textPulse;
      renderer.text(
        contentLoader.getString('campaign_press_space_engage'),
        width / 2,
        height * 0.85,
        CONFIG.COLORS.PRIMARY,
        16,
        'center',
      );
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
    renderer.glowText(
      contentLoader.getString('campaign_level_complete'),
      width / 2,
      height * 0.22,
      CONFIG.COLORS.PRIMARY,
      28,
      'center',
      20,
    );
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
      renderer.text(
        contentLoader.getString('campaign_press_space'),
        width / 2,
        height * 0.88,
        CONFIG.COLORS.PRIMARY,
        14,
        'center',
      );
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

    const title =
      this.campaignMode === 'act'
        ? contentLoader.getString('campaign_act_complete')
        : contentLoader.getString('campaign_sector_complete');

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
      renderer.text(
        contentLoader.getString('campaign_press_space'),
        width / 2,
        height * 0.8,
        CONFIG.COLORS.PRIMARY,
        16,
        'center',
      );
      ctx.globalAlpha = 1;
    }
  }

  private renderBreatheGate(renderer: Renderer, width: number, height: number): void {
    const ctx = renderer.context;
    const centerX = width / 2;
    const centerY = height / 2;

    // Dim overlay
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(0, 0, width, height);

    // Breathing ring (4s cycle)
    const breathePhase = (this.breatheGateTimer % 4) / 4;
    const ringScale = 0.7 + Math.sin(breathePhase * Math.PI * 2) * 0.3;
    const ringRadius = 80 * ringScale;

    ctx.strokeStyle = '#44aaff';
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.6 + Math.sin(breathePhase * Math.PI * 2) * 0.3;
    ctx.shadowColor = '#44aaff';
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(centerX, centerY, ringRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    // BREATHE text
    renderer.glowText(contentLoader.getString('campaign_breathe'), centerX, centerY - 10, '#44aaff', 32, 'center', 15);

    // Calm meter under the text
    const calmLevel = this.hudState.calmLevel;
    const barW = 200;
    const barH = 12;
    const barX = centerX - barW / 2;
    const barY = centerY + 30;
    renderer.fillRect(barX, barY, barW, barH, 'rgba(68,170,255,0.15)');
    ctx.shadowColor = '#44aaff';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#44aaff';
    ctx.fillRect(barX, barY, barW * calmLevel, barH);
    ctx.shadowBlur = 0;
    renderer.strokeRect(barX, barY, barW, barH, '#44aaff', 1);

    // Threshold marker
    const threshX = barX + barW * 0.6;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(threshX, barY - 3);
    ctx.lineTo(threshX, barY + barH + 3);
    ctx.stroke();

    // Progress indicator
    const timeLeft = Math.max(0, this.breatheGateTimeout - this.breatheGateTimer);
    renderer.text(`${Math.ceil(timeLeft)}s`, centerX, barY + barH + 20, '#aaaaaa', 14, 'center');

    ctx.restore();
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
      const retryLabel = contentLoader.getString('campaign_retry');
      renderer.text(
        retrySelected ? `> ${retryLabel} <` : retryLabel,
        width / 2,
        menuY,
        retryColor,
        retrySelected ? 22 : 18,
        'center',
      );

      const quitSelected = this.gameOverSelectedOption === 1;
      const quitColor = quitSelected ? CONFIG.COLORS.PRIMARY : CONFIG.COLORS.TEXT_DIM;
      const quitLabel = contentLoader.getString('campaign_quit');
      renderer.text(
        quitSelected ? `> ${quitLabel} <` : quitLabel,
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
