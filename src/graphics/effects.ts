/**
 * Visual effects
 */

import type { Renderer } from '../engine/renderer';
import { hexToRgba } from '../util/color';
import { lerp } from '../util/math';

/**
 * Screen shake state
 */
export interface ShakeState {
  intensity: number;
  decay: number;
  offsetX: number;
  offsetY: number;
}

/**
 * Flash effect state
 */
export interface FlashState {
  color: string;
  alpha: number;
  decay: number;
}

/**
 * Effects manager
 */
export class EffectsManager {
  private shake: ShakeState = {
    intensity: 0,
    decay: 0.9,
    offsetX: 0,
    offsetY: 0,
  };

  private flash: FlashState = {
    color: '#ffffff',
    alpha: 0,
    decay: 5,
  };

  private slowMotion: number = 1;
  private slowMotionTarget: number = 1;

  private chromaticAberration: number = 0;

  /**
   * Trigger screen shake
   */
  screenShake(intensity: number = 10): void {
    this.shake.intensity = Math.max(this.shake.intensity, intensity);
  }

  /**
   * Trigger screen flash
   */
  screenFlash(color: string = '#ffffff', alpha: number = 0.5): void {
    this.flash.color = color;
    this.flash.alpha = alpha;
  }

  /**
   * Set slow motion factor
   */
  setSlowMotion(factor: number, immediate: boolean = false): void {
    this.slowMotionTarget = factor;
    if (immediate) {
      this.slowMotion = factor;
    }
  }

  /**
   * Set chromatic aberration intensity
   */
  setChromaticAberration(intensity: number): void {
    this.chromaticAberration = intensity;
  }

  /**
   * Update effects
   */
  update(dt: number): void {
    // Update shake
    if (this.shake.intensity > 0.1) {
      this.shake.offsetX = (Math.random() - 0.5) * 2 * this.shake.intensity;
      this.shake.offsetY = (Math.random() - 0.5) * 2 * this.shake.intensity;
      this.shake.intensity *= this.shake.decay;
    } else {
      this.shake.intensity = 0;
      this.shake.offsetX = 0;
      this.shake.offsetY = 0;
    }

    // Update flash
    if (this.flash.alpha > 0) {
      this.flash.alpha -= this.flash.decay * dt;
      if (this.flash.alpha < 0) this.flash.alpha = 0;
    }

    // Update slow motion
    this.slowMotion = lerp(this.slowMotion, this.slowMotionTarget, dt * 5);

    // Decay chromatic aberration
    if (this.chromaticAberration > 0) {
      this.chromaticAberration *= 0.95;
      if (this.chromaticAberration < 0.1) this.chromaticAberration = 0;
    }
  }

  /**
   * Get shake offset
   */
  getShakeOffset(): { x: number; y: number } {
    return { x: this.shake.offsetX, y: this.shake.offsetY };
  }

  /**
   * Get time scale for slow motion
   */
  getTimeScale(): number {
    return this.slowMotion;
  }

  /**
   * Apply pre-render effects (called before rendering)
   */
  preRender(renderer: Renderer): void {
    const offset = this.getShakeOffset();
    if (offset.x !== 0 || offset.y !== 0) {
      renderer.translate(offset.x, offset.y);
    }
  }

  /**
   * Apply post-render effects (called after rendering)
   */
  postRender(renderer: Renderer, width: number, height: number): void {
    // Flash overlay
    if (this.flash.alpha > 0) {
      renderer.save();
      renderer.setAlpha(this.flash.alpha);
      renderer.fillRect(0, 0, width, height, this.flash.color);
      renderer.restore();
    }

    // Chromatic aberration (simplified - just colored edges)
    if (this.chromaticAberration > 0) {
      const ctx = renderer.context;
      const intensity = this.chromaticAberration;

      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = intensity * 0.3;

      // Red shift left
      ctx.fillStyle = 'rgba(255, 0, 0, 0.1)';
      ctx.fillRect(0, 0, 20, height);

      // Cyan shift right
      ctx.fillStyle = 'rgba(0, 255, 255, 0.1)';
      ctx.fillRect(width - 20, 0, 20, height);

      ctx.restore();
    }
  }

  /**
   * Draw damage vignette
   */
  drawDamageVignette(renderer: Renderer, width: number, height: number, intensity: number): void {
    if (intensity <= 0) return;

    const ctx = renderer.context;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.max(width, height) * 0.6;

    const gradient = ctx.createRadialGradient(centerX, centerY, radius * 0.5, centerX, centerY, radius);

    gradient.addColorStop(0, 'rgba(255, 0, 0, 0)');
    gradient.addColorStop(1, `rgba(255, 0, 0, ${intensity * 0.5})`);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  /**
   * Draw low health pulse
   */
  drawLowHealthPulse(renderer: Renderer, width: number, height: number, time: number, healthPercent: number): void {
    if (healthPercent > 0.3) return;

    const pulseIntensity = (0.3 - healthPercent) / 0.3;
    const pulse = (Math.sin(time * 4) + 1) / 2;
    const alpha = pulseIntensity * pulse * 0.3;

    this.drawDamageVignette(renderer, width, height, alpha);
  }

  /**
   * Draw powerup active effect
   */
  drawPowerupEffect(renderer: Renderer, width: number, height: number, type: 'calm' | 'passion', time: number): void {
    const ctx = renderer.context;
    const color = type === 'calm' ? '#00aaff' : '#ff0066';

    // Subtle edge glow
    ctx.save();
    ctx.globalAlpha = 0.1 + Math.sin(time * 3) * 0.05;

    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, hexToRgba(color, 0.3));
    gradient.addColorStop(0.1, 'transparent');
    gradient.addColorStop(0.9, 'transparent');
    gradient.addColorStop(1, hexToRgba(color, 0.3));

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Side gradients
    const sideGradient = ctx.createLinearGradient(0, 0, width, 0);
    sideGradient.addColorStop(0, hexToRgba(color, 0.2));
    sideGradient.addColorStop(0.1, 'transparent');
    sideGradient.addColorStop(0.9, 'transparent');
    sideGradient.addColorStop(1, hexToRgba(color, 0.2));

    ctx.fillStyle = sideGradient;
    ctx.fillRect(0, 0, width, height);

    ctx.restore();
  }

  /**
   * Reset all effects
   */
  reset(): void {
    this.shake.intensity = 0;
    this.shake.offsetX = 0;
    this.shake.offsetY = 0;
    this.flash.alpha = 0;
    this.slowMotion = 1;
    this.slowMotionTarget = 1;
    this.chromaticAberration = 0;
  }
}

// Global effects manager
export const effects = new EffectsManager();
