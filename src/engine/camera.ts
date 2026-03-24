/**
 * Camera system for viewport management
 */

import { CONFIG } from '../config';
import { clamp, lerp } from '../util/math';

export class Camera {
  x: number = 0;
  y: number = 0;
  targetX: number = 0;
  targetY: number = 0;

  scale: number = 1;
  targetScale: number = 1;

  rotation: number = 0;

  // Bounds for camera movement
  minX: number = -Infinity;
  maxX: number = Infinity;
  minY: number = -Infinity;
  maxY: number = Infinity;

  // Smoothing
  smoothing: number = 0.1;

  // Screen shake
  shakeIntensity: number = 0;
  shakeDecay: number = 0.9;
  shakeOffsetX: number = 0;
  shakeOffsetY: number = 0;

  constructor() {
    this.reset();
  }

  /**
   * Reset camera to default state
   */
  reset(): void {
    this.x = CONFIG.CANVAS_WIDTH / 2;
    this.y = CONFIG.CANVAS_HEIGHT / 2;
    this.targetX = this.x;
    this.targetY = this.y;
    this.scale = 1;
    this.targetScale = 1;
    this.rotation = 0;
    this.shakeIntensity = 0;
    this.shakeOffsetX = 0;
    this.shakeOffsetY = 0;
  }

  /**
   * Set camera bounds
   */
  setBounds(minX: number, minY: number, maxX: number, maxY: number): void {
    this.minX = minX;
    this.minY = minY;
    this.maxX = maxX;
    this.maxY = maxY;
  }

  /**
   * Clear camera bounds
   */
  clearBounds(): void {
    this.minX = -Infinity;
    this.maxX = Infinity;
    this.minY = -Infinity;
    this.maxY = Infinity;
  }

  /**
   * Set camera position immediately
   */
  setPosition(x: number, y: number): void {
    this.x = clamp(x, this.minX, this.maxX);
    this.y = clamp(y, this.minY, this.maxY);
    this.targetX = this.x;
    this.targetY = this.y;
  }

  /**
   * Set camera target (will smooth towards it)
   */
  setTarget(x: number, y: number): void {
    this.targetX = clamp(x, this.minX, this.maxX);
    this.targetY = clamp(y, this.minY, this.maxY);
  }

  /**
   * Follow an entity
   */
  follow(x: number, y: number): void {
    this.setTarget(x, y);
  }

  /**
   * Set zoom level
   */
  setScale(scale: number, immediate: boolean = false): void {
    this.targetScale = Math.max(0.1, Math.min(5, scale));
    if (immediate) {
      this.scale = this.targetScale;
    }
  }

  /**
   * Trigger screen shake
   */
  shake(intensity: number = 10): void {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
  }

  /**
   * Update camera (call each frame)
   */
  update(_dt: number): void {
    // Smooth camera movement
    this.x = lerp(this.x, this.targetX, this.smoothing);
    this.y = lerp(this.y, this.targetY, this.smoothing);
    this.scale = lerp(this.scale, this.targetScale, this.smoothing);

    // Apply screen shake
    if (this.shakeIntensity > 0.1) {
      this.shakeOffsetX = (Math.random() - 0.5) * 2 * this.shakeIntensity;
      this.shakeOffsetY = (Math.random() - 0.5) * 2 * this.shakeIntensity;
      this.shakeIntensity *= this.shakeDecay;
    } else {
      this.shakeIntensity = 0;
      this.shakeOffsetX = 0;
      this.shakeOffsetY = 0;
    }
  }

  /**
   * Get effective camera position (with shake)
   */
  getEffectivePosition(): { x: number; y: number } {
    return {
      x: this.x + this.shakeOffsetX,
      y: this.y + this.shakeOffsetY,
    };
  }

  /**
   * Convert world coordinates to screen coordinates
   */
  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    const pos = this.getEffectivePosition();
    return {
      x: (worldX - pos.x) * this.scale + CONFIG.CANVAS_WIDTH / 2,
      y: (worldY - pos.y) * this.scale + CONFIG.CANVAS_HEIGHT / 2,
    };
  }

  /**
   * Convert screen coordinates to world coordinates
   */
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    const pos = this.getEffectivePosition();
    return {
      x: (screenX - CONFIG.CANVAS_WIDTH / 2) / this.scale + pos.x,
      y: (screenY - CONFIG.CANVAS_HEIGHT / 2) / this.scale + pos.y,
    };
  }

  /**
   * Get the visible world bounds
   */
  getVisibleBounds(): { left: number; right: number; top: number; bottom: number } {
    const halfWidth = CONFIG.CANVAS_WIDTH / 2 / this.scale;
    const halfHeight = CONFIG.CANVAS_HEIGHT / 2 / this.scale;
    const pos = this.getEffectivePosition();

    return {
      left: pos.x - halfWidth,
      right: pos.x + halfWidth,
      top: pos.y - halfHeight,
      bottom: pos.y + halfHeight,
    };
  }

  /**
   * Check if a point is visible on screen
   */
  isVisible(x: number, y: number, margin: number = 0): boolean {
    const bounds = this.getVisibleBounds();
    return (
      x >= bounds.left - margin && x <= bounds.right + margin && y >= bounds.top - margin && y <= bounds.bottom + margin
    );
  }

  /**
   * Check if a rect is visible on screen
   */
  isRectVisible(x: number, y: number, width: number, height: number, margin: number = 0): boolean {
    const bounds = this.getVisibleBounds();
    return (
      x + width >= bounds.left - margin &&
      x <= bounds.right + margin &&
      y + height >= bounds.top - margin &&
      y <= bounds.bottom + margin
    );
  }
}
