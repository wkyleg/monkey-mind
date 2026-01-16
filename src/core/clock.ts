/**
 * Fixed timestep game loop with accumulator
 */

import { CONFIG } from '../config';

export type UpdateFn = (dt: number) => void;
export type RenderFn = (alpha: number) => void;

export interface ClockCallbacks {
  update: UpdateFn;
  render: RenderFn;
}

export class Clock {
  private running: boolean = false;
  private lastTime: number = 0;
  private accumulator: number = 0;
  private frameId: number = 0;
  
  private readonly targetDt: number;
  private readonly maxAccumulator: number;
  
  private callbacks: ClockCallbacks | null = null;
  
  // Performance tracking
  private frameCount: number = 0;
  private fpsTime: number = 0;
  private currentFps: number = 0;
  
  constructor(targetFps: number = CONFIG.TARGET_FPS) {
    this.targetDt = 1 / targetFps;
    this.maxAccumulator = this.targetDt * 5; // Prevent spiral of death
  }
  
  /**
   * Start the game loop
   */
  start(callbacks: ClockCallbacks): void {
    if (this.running) return;
    
    this.callbacks = callbacks;
    this.running = true;
    this.lastTime = performance.now() / 1000;
    this.accumulator = 0;
    this.frameCount = 0;
    this.fpsTime = this.lastTime;
    
    this.tick();
  }
  
  /**
   * Stop the game loop
   */
  stop(): void {
    this.running = false;
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
      this.frameId = 0;
    }
  }
  
  /**
   * Check if the clock is running
   */
  isRunning(): boolean {
    return this.running;
  }
  
  /**
   * Get current FPS
   */
  getFps(): number {
    return this.currentFps;
  }
  
  /**
   * Get the fixed timestep
   */
  getTimestep(): number {
    return this.targetDt;
  }
  
  private tick = (): void => {
    if (!this.running || !this.callbacks) return;
    
    const currentTime = performance.now() / 1000;
    let frameTime = currentTime - this.lastTime;
    this.lastTime = currentTime;
    
    // Clamp frame time to prevent spiral of death
    if (frameTime > this.maxAccumulator) {
      frameTime = this.maxAccumulator;
    }
    
    this.accumulator += frameTime;
    
    // Fixed timestep updates
    while (this.accumulator >= this.targetDt) {
      this.callbacks.update(this.targetDt);
      this.accumulator -= this.targetDt;
    }
    
    // Interpolation alpha for smooth rendering
    const alpha = this.accumulator / this.targetDt;
    this.callbacks.render(alpha);
    
    // FPS calculation
    this.frameCount++;
    if (currentTime - this.fpsTime >= 1) {
      this.currentFps = this.frameCount;
      this.frameCount = 0;
      this.fpsTime = currentTime;
    }
    
    this.frameId = requestAnimationFrame(this.tick);
  };
}

// Global clock instance
export const clock = new Clock();
