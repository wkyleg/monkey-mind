/**
 * Heads-up display rendering - Cyberpunk HUD style
 */

import type { Renderer } from '../engine/renderer';
import type { Player } from './player';
import { CONFIG } from '../config';

export interface HudState {
  score: number;
  combo: number;
  wave: number;
  sector: string;
  sectorName: string;
  powerupActive: string | null;
  powerupTimeRemaining: number;
  calmLevel: number;
  arousalLevel: number;
  showPauseButton?: boolean;
}

export class Hud {
  private time: number = 0;
  private scoreDisplay: number = 0;
  private lastScore: number = 0;
  private scorePulse: number = 0;
  
  // Pause button bounds for click detection
  private pauseButtonBounds = { x: 0, y: 0, width: 0, height: 0 };
  
  // Mute button bounds for click detection
  private muteButtonBounds = { x: 0, y: 0, width: 0, height: 0 };
  
  /**
   * Update HUD animations
   */
  update(dt: number, state: HudState): void {
    this.time += dt;
    
    // Animate score counting up
    const scoreDiff = state.score - this.scoreDisplay;
    if (scoreDiff > 0) {
      const increment = Math.max(1, Math.floor(scoreDiff * dt * 10));
      this.scoreDisplay = Math.min(state.score, this.scoreDisplay + increment);
    }
    
    // Score pulse on change
    if (state.score !== this.lastScore) {
      this.scorePulse = 1;
      this.lastScore = state.score;
    }
    this.scorePulse = Math.max(0, this.scorePulse - dt * 3);
  }
  
  /**
   * Render the HUD
   */
  render(renderer: Renderer, state: HudState, player: Player): void {
    const { width, height } = renderer;
    
    // Top bar background with angular frame
    renderer.save();
    renderer.setAlpha(0.7);
    renderer.fillRect(0, 0, width, 55, '#0a0a0f');
    renderer.restore();
    
    // Top bar border line
    renderer.line(0, 55, width, 55, CONFIG.COLORS.PRIMARY, 1);
    
    // Angular frame corners on top bar
    renderer.drawAngularFrame(10, 8, 180, 40, CONFIG.COLORS.PRIMARY, 10);
    
    // Score with clean monospace
    const scoreText = `SCORE: ${Math.floor(this.scoreDisplay).toString().padStart(6, '0')}`;
    renderer.hudText(scoreText, 25, 28, CONFIG.COLORS.PRIMARY, 20, 'left');
    
    // Combo indicator (clean, no glow)
    if (state.combo > 1) {
      renderer.hudText(`x${state.combo}`, 195, 28, CONFIG.COLORS.ACCENT, 18, 'left');
    }
    
    // Wave/Sector info - centered with brackets
    const waveText = `[ ${state.sectorName} // WAVE ${state.wave} ]`;
    renderer.hudText(waveText, width / 2, 28, CONFIG.COLORS.TEXT, 16, 'center');
    
    // Health as energy bar instead of hearts
    this.renderHealthBar(renderer, player, width - 20, 28);
    
    // Powerup indicator
    if (state.powerupActive) {
      this.renderPowerup(renderer, state, width / 2, 75);
    }
    
    // Bottom bar - calm/arousal meters
    this.renderMentalState(renderer, state, width, height);
    
    // Pause button
    if (state.showPauseButton !== false) {
      this.renderPauseButton(renderer, width);
      this.renderMuteButton(renderer, width, this._isMuted);
    }
    
    // Subtle scan lines over entire HUD
    renderer.save();
    renderer.setAlpha(0.02);
    for (let y = 0; y < 55; y += 2) {
      renderer.line(0, y, width, y, '#000000', 1);
    }
    renderer.restore();
  }
  
  /**
   * Render pause button
   */
  private renderPauseButton(renderer: Renderer, width: number): void {
    const buttonSize = 32;
    const margin = 15;
    const x = width - buttonSize - margin;
    const y = 60;
    
    // Store bounds for click detection
    this.pauseButtonBounds = { x, y, width: buttonSize, height: buttonSize };
    
    // Button with angular frame
    renderer.fillRect(x, y, buttonSize, buttonSize, '#0a0a0f');
    renderer.drawAngularFrame(x, y, buttonSize, buttonSize, CONFIG.COLORS.TEXT_DIM, 6);
    
    // Pause icon (two vertical bars)
    const barWidth = 5;
    const barHeight = 14;
    const gap = 4;
    const centerX = x + buttonSize / 2;
    const centerY = y + buttonSize / 2;
    
    renderer.fillRect(
      centerX - barWidth - gap / 2,
      centerY - barHeight / 2,
      barWidth,
      barHeight,
      CONFIG.COLORS.TEXT
    );
    renderer.fillRect(
      centerX + gap / 2,
      centerY - barHeight / 2,
      barWidth,
      barHeight,
      CONFIG.COLORS.TEXT
    );
  }
  
  /**
   * Check if pause button was clicked
   */
  isPauseButtonClicked(mouseX: number, mouseY: number): boolean {
    const { x, y, width, height } = this.pauseButtonBounds;
    return mouseX >= x && mouseX <= x + width && mouseY >= y && mouseY <= y + height;
  }
  
  /**
   * Render mute button
   */
  private renderMuteButton(renderer: Renderer, width: number, isMuted: boolean = false): void {
    const buttonSize = 32;
    const margin = 15;
    // Position to the left of pause button
    const x = width - buttonSize * 2 - margin * 2;
    const y = 60;
    
    // Store bounds for click detection
    this.muteButtonBounds = { x, y, width: buttonSize, height: buttonSize };
    
    // Button with angular frame
    renderer.fillRect(x, y, buttonSize, buttonSize, '#0a0a0f');
    renderer.drawAngularFrame(x, y, buttonSize, buttonSize, CONFIG.COLORS.TEXT_DIM, 6);
    
    const ctx = renderer.context;
    const centerX = x + buttonSize / 2;
    const centerY = y + buttonSize / 2;
    
    // Speaker icon
    ctx.fillStyle = CONFIG.COLORS.TEXT;
    ctx.beginPath();
    // Speaker body
    ctx.moveTo(centerX - 6, centerY - 4);
    ctx.lineTo(centerX - 2, centerY - 4);
    ctx.lineTo(centerX + 4, centerY - 8);
    ctx.lineTo(centerX + 4, centerY + 8);
    ctx.lineTo(centerX - 2, centerY + 4);
    ctx.lineTo(centerX - 6, centerY + 4);
    ctx.closePath();
    ctx.fill();
    
    if (isMuted) {
      // X mark for muted
      ctx.strokeStyle = CONFIG.COLORS.DANGER;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(centerX + 6, centerY - 6);
      ctx.lineTo(centerX + 12, centerY + 6);
      ctx.moveTo(centerX + 12, centerY - 6);
      ctx.lineTo(centerX + 6, centerY + 6);
      ctx.stroke();
    } else {
      // Sound waves
      ctx.strokeStyle = CONFIG.COLORS.TEXT;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(centerX + 6, centerY, 4, -Math.PI / 4, Math.PI / 4);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(centerX + 6, centerY, 8, -Math.PI / 4, Math.PI / 4);
      ctx.stroke();
    }
  }
  
  /**
   * Check if mute button was clicked
   */
  isMuteButtonClicked(mouseX: number, mouseY: number): boolean {
    const { x, y, width, height } = this.muteButtonBounds;
    return mouseX >= x && mouseX <= x + width && mouseY >= y && mouseY <= y + height;
  }
  
  /**
   * Update mute button state (call from render with current mute state)
   */
  setMuteState(isMuted: boolean): void {
    // This is used by the scene to pass mute state
    this._isMuted = isMuted;
  }
  
  private _isMuted: boolean = false;
  
  /**
   * Render health as energy bar (cyberpunk style)
   */
  private renderHealthBar(renderer: Renderer, player: Player, x: number, y: number): void {
    if (!player.health) return;
    
    const maxHealth = player.health.max;
    const currentHealth = player.health.current;
    const barWidth = 100;
    const barHeight = 12;
    const barX = x - barWidth;
    const barY = y - barHeight / 2;
    
    // Background
    renderer.fillRect(barX, barY, barWidth, barHeight, '#1a1a2e');
    
    // Health fill with segments
    const healthPercent = currentHealth / maxHealth;
    const fillWidth = barWidth * healthPercent;
    
    // Color based on health level
    let healthColor: string = CONFIG.COLORS.SUCCESS;
    if (healthPercent <= 0.33) {
      healthColor = CONFIG.COLORS.DANGER;
    } else if (healthPercent <= 0.66) {
      healthColor = CONFIG.COLORS.ACCENT;
    }
    
    renderer.fillRect(barX, barY, fillWidth, barHeight, healthColor);
    
    // Segment lines
    const segments = maxHealth;
    for (let i = 1; i < segments; i++) {
      const segX = barX + (barWidth / segments) * i;
      renderer.line(segX, barY, segX, barY + barHeight, '#0a0a0f', 2);
    }
    
    // Border
    renderer.strokeRect(barX, barY, barWidth, barHeight, healthColor, 1);
    
    // Angular corners
    renderer.drawAngularFrame(barX - 2, barY - 2, barWidth + 4, barHeight + 4, healthColor, 5);
  }
  
  /**
   * Render active powerup indicator
   */
  private renderPowerup(renderer: Renderer, state: HudState, x: number, y: number): void {
    if (!state.powerupActive) return;
    
    const isCalm = state.powerupActive.includes('calm');
    const color = isCalm ? CONFIG.COLORS.CALM : CONFIG.COLORS.PASSION;
    
    // Background
    const barWidth = 180;
    const barHeight = 16;
    renderer.fillRect(x - barWidth / 2, y - barHeight / 2, barWidth, barHeight, '#0a0a0f');
    
    // Progress bar
    const progress = state.powerupTimeRemaining;
    renderer.fillRect(
      x - barWidth / 2,
      y - barHeight / 2,
      barWidth * progress,
      barHeight,
      color
    );
    
    // Border with angular frame
    renderer.drawAngularFrame(x - barWidth / 2 - 2, y - barHeight / 2 - 2, barWidth + 4, barHeight + 4, color, 6);
    
    // Label
    const label = `[ ${state.powerupActive.toUpperCase().replace('_', ' ')} ]`;
    renderer.hudText(label, x, y, '#ffffff', 11, 'center');
  }
  
  /**
   * Render mental state meters (for BCI visualization)
   */
  private renderMentalState(renderer: Renderer, state: HudState, width: number, height: number): void {
    const meterWidth = 150;
    const meterHeight = 8;
    const y = height - 25;
    const margin = 20;
    
    // Bottom bar background
    renderer.save();
    renderer.setAlpha(0.6);
    renderer.fillRect(0, height - 45, width, 45, '#0a0a0f');
    renderer.restore();
    renderer.line(0, height - 45, width, height - 45, CONFIG.COLORS.PRIMARY, 1);
    
    // Calm meter (left)
    const calmX = margin;
    
    renderer.hudText('CALM', calmX, y - 12, CONFIG.COLORS.CALM, 10, 'left');
    renderer.fillRect(calmX, y, meterWidth, meterHeight, '#1a1a2e');
    renderer.fillRect(calmX, y, meterWidth * state.calmLevel, meterHeight, CONFIG.COLORS.CALM);
    renderer.drawAngularFrame(calmX - 2, y - 2, meterWidth + 4, meterHeight + 4, CONFIG.COLORS.CALM, 4);
    
    // Tech readout decoration
    renderer.drawTechReadout(calmX, y + meterHeight + 8, meterWidth, CONFIG.COLORS.CALM);
    
    // Arousal meter (right)
    const arousalX = width - margin - meterWidth;
    
    renderer.hudText('PASSION', arousalX + meterWidth, y - 12, CONFIG.COLORS.PASSION, 10, 'right');
    renderer.fillRect(arousalX, y, meterWidth, meterHeight, '#1a1a2e');
    renderer.fillRect(
      arousalX + meterWidth * (1 - state.arousalLevel),
      y,
      meterWidth * state.arousalLevel,
      meterHeight,
      CONFIG.COLORS.PASSION
    );
    renderer.drawAngularFrame(arousalX - 2, y - 2, meterWidth + 4, meterHeight + 4, CONFIG.COLORS.PASSION, 4);
    
    // Tech readout decoration
    renderer.drawTechReadout(arousalX, y + meterHeight + 8, meterWidth, CONFIG.COLORS.PASSION);
  }
  
  /**
   * Reset HUD state
   */
  reset(): void {
    this.scoreDisplay = 0;
    this.lastScore = 0;
    this.scorePulse = 0;
    this.time = 0;
  }
}
