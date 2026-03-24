/**
 * Main game orchestrator
 */

import { CONFIG } from '../config';
import { contentLoader } from '../content/loader';
import { clock } from '../core/clock';
import { events } from '../core/events';
import { storage } from '../core/storage';
import { BossScene } from '../scenes/bossScene';
import { CampaignScene } from '../scenes/campaignScene';
import { CodexScene } from '../scenes/codexScene';
import { EndlessScene } from '../scenes/endlessScene';
import { IntroScene } from '../scenes/introScene';
import { LevelSelectScene } from '../scenes/levelSelectScene';
import { LevelStoryScene } from '../scenes/levelStoryScene';
import { MenuScene } from '../scenes/menuScene';
import { PauseScene } from '../scenes/pauseScene';
import { SettingsScene } from '../scenes/settingsScene';
import { TransitionScene } from '../scenes/transitionScene';
import { VictoryScene } from '../scenes/victoryScene';
import { AudioManager } from './audio';
import { InputManager } from './input';
import { proceduralMusic } from './music';
import { Renderer } from './renderer';
import { SceneManager } from './scene';
import { svgAssets } from './svgAssets';

export class Game {
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: Renderer;
  private readonly input: InputManager;
  private readonly audio: AudioManager;
  private readonly scenes: SceneManager;

  private initialized: boolean = false;
  private paused: boolean = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    this.input = new InputManager();
    this.audio = new AudioManager();
    this.scenes = new SceneManager();
  }

  /**
   * Initialize the game
   * @param progressCallback Optional callback for loading progress (0-1, status message)
   */
  async init(progressCallback?: (progress: number, status?: string) => void): Promise<void> {
    if (this.initialized) return;

    const updateProgress = (progress: number, status?: string): void => {
      if (progressCallback) {
        progressCallback(progress, status);
      }
    };

    // Load content
    updateProgress(0, 'LOADING CONTENT DATA...');
    await contentLoader.loadAll();
    updateProgress(0.3, 'CONTENT LOADED');

    // Preload SVG assets
    updateProgress(0.35, 'LOADING VISUAL ASSETS...');
    await svgAssets.preloadAll();
    updateProgress(0.7, 'ASSETS LOADED');

    // Initialize subsystems
    updateProgress(0.75, 'INITIALIZING INPUT SYSTEMS...');
    this.input.init();
    this.input.setCanvas(this.canvas);

    updateProgress(0.8, 'INITIALIZING AUDIO SYSTEMS...');
    this.audio.init();
    proceduralMusic.init();

    // Register scenes
    updateProgress(0.85, 'LOADING SCENES...');
    this.registerScenes();

    // Set up event handlers
    updateProgress(0.9, 'SETTING UP EVENT HANDLERS...');
    this.setupEventHandlers();

    // Start auto-save
    updateProgress(0.95, 'INITIALIZING SAVE SYSTEM...');
    storage.startAutoSave();

    // Handle window resize
    this.setupResizeHandler();

    updateProgress(1.0, 'INITIALIZATION COMPLETE');
    this.initialized = true;
  }

  /**
   * Register all game scenes
   */
  private registerScenes(): void {
    this.scenes.register('menu', new MenuScene(this));
    this.scenes.register('campaign', new CampaignScene(this));
    this.scenes.register('endless', new EndlessScene(this));
    this.scenes.register('pause', new PauseScene(this));
    this.scenes.register('settings', new SettingsScene(this));
    this.scenes.register('codex', new CodexScene(this));
    this.scenes.register('boss', new BossScene(this));
    this.scenes.register('transition', new TransitionScene(this));
    this.scenes.register('victory', new VictoryScene(this));
    this.scenes.register('intro', new IntroScene(this));
    this.scenes.register('levelStory', new LevelStoryScene(this));
    this.scenes.register('levelSelect', new LevelSelectScene(this));

    // Start at menu
    this.scenes.push('menu');
  }

  /**
   * Set up global event handlers
   */
  private setupEventHandlers(): void {
    // Pause handling
    events.on('game:pause', () => {
      this.paused = true;
      this.scenes.push('pause');
    });

    events.on('game:resume', () => {
      this.paused = false;
      this.scenes.pop();
    });

    // Audio events
    events.on('audio:play_sfx', ({ id, volume }) => {
      this.audio.playSfx(id, volume);
    });

    events.on('audio:play_music', ({ id, crossfade }) => {
      this.audio.playMusic(id, crossfade);
    });

    events.on('audio:stop_music', () => {
      this.audio.stopMusic();
    });

    // Stats tracking
    events.on('projectile:fire', () => {
      storage.incrementStat('totalBananasThrown');
    });

    events.on('enemy:death', () => {
      storage.incrementStat('totalEnemiesDefeated');
    });

    events.on('boss:defeat', () => {
      storage.incrementStat('totalBossesDefeated');
    });

    events.on('player:death', () => {
      storage.incrementStat('totalDeaths');
    });
  }

  /**
   * Set up window resize handler
   */
  private setupResizeHandler(): void {
    const resize = (): void => {
      const container = this.canvas.parentElement;
      if (!container) return;

      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;

      // Calculate scale to fit while maintaining aspect ratio
      const scale = Math.min(containerWidth / CONFIG.CANVAS_WIDTH, containerHeight / CONFIG.CANVAS_HEIGHT);

      // Apply scale via CSS
      this.canvas.style.width = `${CONFIG.CANVAS_WIDTH * scale}px`;
      this.canvas.style.height = `${CONFIG.CANVAS_HEIGHT * scale}px`;
    };

    window.addEventListener('resize', resize);
    resize();
  }

  /**
   * Start the game loop
   */
  start(): void {
    clock.start({
      update: this.update.bind(this),
      render: this.render.bind(this),
    });
  }

  /**
   * Stop the game loop
   */
  stop(): void {
    clock.stop();
    storage.save();
  }

  /**
   * Main update loop
   */
  private update(dt: number): void {
    // Update input
    this.input.update(dt);

    // Get player intent
    const intent = this.input.getIntent();

    // Handle pause toggle (only in gameplay scenes)
    if (intent.cancel && !this.paused && this.scenes.currentSupportsPause()) {
      events.emit('game:pause', undefined);
      return;
    }

    // Update current scene
    this.scenes.update(dt, intent);

    // Update audio mix
    this.audio.update(dt);

    // Update procedural music
    proceduralMusic.update(dt);
  }

  /**
   * Main render loop
   */
  private render(alpha: number): void {
    // Clear to black and render (prevents transparent bleed-through)
    this.renderer.clear('#000000');
    this.scenes.render(this.renderer, alpha);

    // Debug overlay
    if (CONFIG.SHOW_FPS) {
      this.renderer.drawFps(clock.getFps());
    }
  }

  // Accessors for subsystems

  getRenderer(): Renderer {
    return this.renderer;
  }

  getInput(): InputManager {
    return this.input;
  }

  getAudio(): AudioManager {
    return this.audio;
  }

  getScenes(): SceneManager {
    return this.scenes;
  }

  isPaused(): boolean {
    return this.paused;
  }

  getMusic(): typeof proceduralMusic {
    return proceduralMusic;
  }
}
