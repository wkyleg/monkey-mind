/**
 * Scene management system
 */

import type { Game } from './game';
import type { PlayerIntent } from './input';
import type { Renderer } from './renderer';

/**
 * Base scene class
 */
export abstract class Scene {
  protected readonly game: Game;

  /** Whether this scene supports pausing (gameplay scenes only) */
  readonly canPause: boolean = false;

  /** Whether this scene is an overlay (renders on top of previous scene) */
  readonly isOverlay: boolean = false;

  constructor(game: Game) {
    this.game = game;
  }

  /**
   * Called when scene becomes active
   */
  abstract enter(): void;

  /**
   * Called when scene is no longer active
   */
  abstract exit(): void;

  /**
   * Called when scene is paused (another scene pushed on top)
   */
  pause(): void {}

  /**
   * Called when scene is resumed (scene on top popped)
   */
  resume(): void {}

  /**
   * Update game logic
   */
  abstract update(dt: number, intent: PlayerIntent): void;

  /**
   * Render the scene
   */
  abstract render(renderer: Renderer, alpha: number): void;
}

/**
 * Scene manager with stack-based navigation
 */
export class SceneManager {
  private scenes: Map<string, Scene> = new Map();
  private stack: Scene[] = [];

  /**
   * Register a scene
   */
  register(name: string, scene: Scene): void {
    this.scenes.set(name, scene);
  }

  /**
   * Get a registered scene by name
   */
  get(name: string): Scene | undefined {
    return this.scenes.get(name);
  }

  /**
   * Push a scene onto the stack
   */
  push(name: string): void {
    const scene = this.scenes.get(name);
    if (!scene) {
      console.error(`Scene not found: ${name}`);
      return;
    }

    // Pause current scene if exists
    const current = this.current();
    if (current) {
      current.pause();
    }

    // Push and enter new scene
    this.stack.push(scene);
    scene.enter();
  }

  // Boss context for passing data between scenes
  private bossContext: { bossId: string; returnScene: Scene } | null = null;

  // Transition context for sector transitions
  private transitionContext: {
    completedSector: number;
    nextSector: number;
    score: number;
    unlocks: string[];
  } | null = null;

  /**
   * Push boss scene with context
   */
  pushBoss(bossId: string, returnScene: Scene): void {
    this.bossContext = { bossId, returnScene };
    this.push('boss');
  }

  /**
   * Get current boss context
   */
  getBossContext(): { bossId: string; returnScene: Scene } | null {
    return this.bossContext;
  }

  /**
   * Clear boss context
   */
  clearBossContext(): void {
    this.bossContext = null;
  }

  /**
   * Push transition scene with context
   */
  pushTransition(completedSector: number, nextSector: number, score: number, unlocks: string[] = []): void {
    this.transitionContext = { completedSector, nextSector, score, unlocks };
    this.push('transition');
  }

  /**
   * Get current transition context
   */
  getTransitionContext(): {
    completedSector: number;
    nextSector: number;
    score: number;
    unlocks: string[];
  } | null {
    return this.transitionContext;
  }

  /**
   * Clear transition context
   */
  clearTransitionContext(): void {
    this.transitionContext = null;
  }

  // Level story context for inter-level narratives
  private levelStoryContext: { sectorId: string; isIntro: boolean } | null = null;

  /**
   * Push level story scene with context
   */
  pushLevelStory(sectorId: string, isIntro: boolean): void {
    this.levelStoryContext = { sectorId, isIntro };
    this.push('levelStory');
  }

  /**
   * Get current level story context
   */
  getLevelStoryContext(): { sectorId: string; isIntro: boolean } | null {
    return this.levelStoryContext;
  }

  /**
   * Clear level story context
   */
  clearLevelStoryContext(): void {
    this.levelStoryContext = null;
  }

  // Generic context storage for scene data
  private genericContext: Map<string, unknown> = new Map();

  /**
   * Set context data for scenes
   */
  setContext(key: string, value: unknown): void {
    this.genericContext.set(key, value);
  }

  /**
   * Get context data
   */
  getContext<T>(key: string): T | undefined {
    return this.genericContext.get(key) as T | undefined;
  }

  /**
   * Clear context data
   */
  clearContext(key: string): void {
    this.genericContext.delete(key);
  }

  /**
   * Pop the top scene from the stack
   */
  pop(): Scene | undefined {
    if (this.stack.length <= 1) {
      console.warn('Cannot pop the last scene');
      return undefined;
    }

    const popped = this.stack.pop();
    if (popped) {
      popped.exit();
    }

    // Resume previous scene
    const current = this.current();
    if (current) {
      current.resume();
    }

    return popped;
  }

  /**
   * Replace the current scene
   */
  replace(name: string): void {
    const scene = this.scenes.get(name);
    if (!scene) {
      console.error(`Scene not found: ${name}`);
      return;
    }

    // Exit current scene
    const current = this.stack.pop();
    if (current) {
      current.exit();
    }

    // Enter new scene
    this.stack.push(scene);
    scene.enter();
  }

  /**
   * Clear stack and go to a specific scene
   */
  goto(name: string): void {
    const scene = this.scenes.get(name);
    if (!scene) {
      console.error(`Scene not found: ${name}`);
      return;
    }

    // Exit all scenes
    while (this.stack.length > 0) {
      const popped = this.stack.pop();
      if (popped) {
        popped.exit();
      }
    }

    // Enter new scene
    this.stack.push(scene);
    scene.enter();
  }

  /**
   * Get the current (top) scene
   */
  current(): Scene | undefined {
    return this.stack[this.stack.length - 1];
  }

  /**
   * Update the current scene
   */
  update(dt: number, intent: PlayerIntent): void {
    const scene = this.current();
    if (scene) {
      scene.update(dt, intent);
    }
  }

  /**
   * Render visible scenes (base scene + overlays only)
   */
  render(renderer: Renderer, alpha: number): void {
    if (this.stack.length === 0) return;

    // Find the topmost non-overlay scene (the base scene to render)
    let baseSceneIndex = this.stack.length - 1;
    while (baseSceneIndex > 0 && this.stack[baseSceneIndex].isOverlay) {
      baseSceneIndex--;
    }

    // Render from the base scene upward (base + any overlays on top)
    for (let i = baseSceneIndex; i < this.stack.length; i++) {
      this.stack[i].render(renderer, alpha);
    }
  }

  /**
   * Get current stack depth
   */
  depth(): number {
    return this.stack.length;
  }

  /**
   * Check if current scene supports pausing
   */
  currentSupportsPause(): boolean {
    const scene = this.current();
    return scene ? scene.canPause : false;
  }
}
