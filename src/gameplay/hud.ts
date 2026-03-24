/**
 * Heads-up display rendering - Cyberpunk HUD style
 */

import { CONFIG } from '../config';
import type { Renderer } from '../engine/renderer';
import type { Player } from './player';

export interface ActivePowerupInfo {
  id: string;
  timeRemaining: number;
  category: string;
  color: string;
}

export interface HudState {
  score: number;
  combo: number;
  wave: number;
  sector: string;
  sectorName: string;
  levelName?: string; // Individual level name (e.g., "Plato's Cave")
  powerupActive: string | null;
  powerupTimeRemaining: number;
  // Stackable powerups support
  activePowerups?: ActivePowerupInfo[];
  calmLevel: number;
  arousalLevel: number;
  showPauseButton?: boolean;
  // Meta-progression meters (Level Bible v2)
  noise?: number; // 0-100: Screen chaos level
  focus?: number; // 0-100: Clean play reward
  stillness?: number; // 0-100: Calm survival reward
  // Current level rule card
  ruleCardHint?: string;
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

  // Level title display
  private levelTitleText: string = '';
  private levelSubtitleText: string = '';
  private levelRuleHint: string = '';
  private levelTitleTimer: number = 0;
  private readonly levelTitleDuration: number = 4; // Seconds to show title

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

    // Update level title timer
    if (this.levelTitleTimer > 0) {
      this.levelTitleTimer -= dt;
    }
  }

  /**
   * Show level title at start of gameplay
   * Call this when a new level starts
   */
  showLevelTitle(title: string, subtitle: string = '', ruleHint: string = ''): void {
    this.levelTitleText = title;
    this.levelSubtitleText = subtitle;
    this.levelRuleHint = ruleHint;
    this.levelTitleTimer = this.levelTitleDuration;
  }

  /**
   * Check if level title is currently showing
   */
  isShowingLevelTitle(): boolean {
    return this.levelTitleTimer > 0;
  }

  /**
   * Render the HUD
   */
  render(renderer: Renderer, state: HudState, player: Player): void {
    const { width, height } = renderer;
    const ctx = renderer.context;

    // Ensure HUD always renders at full opacity (prevent bleed from background effects)
    ctx.globalAlpha = 1;

    // Top bar - solid dark background for maximum readability
    renderer.drawPanel(0, 0, width, 58, 'rgba(8, 8, 12, 0.95)', CONFIG.COLORS.PRIMARY, 2);

    // Angular frame corners on score area
    renderer.drawAngularFrame(8, 6, 210, 46, CONFIG.COLORS.PRIMARY, 12);

    // Score with larger, bolder text
    const scoreText = `SCORE: ${Math.floor(this.scoreDisplay).toString().padStart(6, '0')}`;
    renderer.hudText(scoreText, 22, 30, CONFIG.COLORS.PRIMARY, 24, 'left');

    // Combo indicator with glow effect when active
    if (state.combo > 1) {
      const comboColor = state.combo >= 10 ? CONFIG.COLORS.PASSION : CONFIG.COLORS.ACCENT;
      renderer.hudText(`x${state.combo}`, 230, 30, comboColor, 22, 'left');
    }

    // Wave/Sector/Level info - centered with clear contrast
    // Show both act name and level name if available
    let waveText: string;
    if (state.levelName) {
      waveText = `[ ${state.sectorName} // ${state.levelName} // WAVE ${state.wave} ]`;
    } else {
      waveText = `[ ${state.sectorName} // WAVE ${state.wave} ]`;
    }
    renderer.hudText(waveText, width / 2, 30, '#ffffff', 16, 'center');

    // Health as energy bar with label
    this.renderHealthBar(renderer, player, width - 25, 30);

    // Powerup indicators - support multiple stacked powerups
    if (state.activePowerups && state.activePowerups.length > 0) {
      this.renderStackedPowerups(renderer, state.activePowerups, width / 2, 80);
    } else if (state.powerupActive) {
      // Legacy single powerup support
      this.renderPowerup(renderer, state, width / 2, 80);
    }

    // Bottom bar - calm/arousal meters
    this.renderMentalState(renderer, state, width, height);

    // Meta-progression meters (if present)
    if (state.noise !== undefined || state.focus !== undefined || state.stillness !== undefined) {
      this.renderMetaMeters(renderer, state, width);
    }

    // Rule card hint (if present)
    if (state.ruleCardHint) {
      this.renderRuleCardHint(renderer, state.ruleCardHint, width);
    }

    // Pause and Mute buttons
    if (state.showPauseButton !== false) {
      this.renderPauseButton(renderer, width);
      this.renderMuteButton(renderer, width, this._isMuted);
    }

    // Level title overlay (shown at level start)
    if (this.levelTitleTimer > 0) {
      this.renderLevelTitle(renderer, width, height);
    }
  }

  /**
   * Render level title overlay at start of gameplay
   */
  private renderLevelTitle(renderer: Renderer, width: number, height: number): void {
    const ctx = renderer.context;
    const centerX = width / 2;
    const centerY = height / 3;

    // Calculate alpha for fade in/out
    let alpha = 1;
    if (this.levelTitleTimer > this.levelTitleDuration - 0.5) {
      // Fade in during first 0.5 seconds
      alpha = (this.levelTitleDuration - this.levelTitleTimer) / 0.5;
    } else if (this.levelTitleTimer < 1) {
      // Fade out during last 1 second
      alpha = this.levelTitleTimer;
    }

    ctx.save();
    ctx.globalAlpha = alpha;

    // Dark overlay behind title
    ctx.fillStyle = 'rgba(8, 8, 12, 0.7)';
    ctx.fillRect(0, centerY - 80, width, 160);

    // Top and bottom lines
    ctx.strokeStyle = CONFIG.COLORS.PRIMARY;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(width * 0.1, centerY - 80);
    ctx.lineTo(width * 0.9, centerY - 80);
    ctx.moveTo(width * 0.1, centerY + 80);
    ctx.lineTo(width * 0.9, centerY + 80);
    ctx.stroke();

    // Main title
    ctx.shadowColor = CONFIG.COLORS.PRIMARY;
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#ffffff';
    ctx.font = "bold 32px 'SF Mono', Consolas, monospace";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.strokeText(this.levelTitleText, centerX, centerY - 20);
    ctx.fillText(this.levelTitleText, centerX, centerY - 20);

    // Subtitle (act/level info)
    if (this.levelSubtitleText) {
      ctx.shadowBlur = 10;
      ctx.fillStyle = CONFIG.COLORS.PRIMARY;
      ctx.font = "bold 16px 'SF Mono', Consolas, monospace";
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.strokeText(this.levelSubtitleText, centerX, centerY + 15);
      ctx.fillText(this.levelSubtitleText, centerX, centerY + 15);
    }

    // Rule hint
    if (this.levelRuleHint) {
      ctx.shadowBlur = 8;
      ctx.fillStyle = CONFIG.COLORS.ACCENT;
      ctx.font = "14px 'SF Mono', Consolas, monospace";
      ctx.strokeText(`◈ ${this.levelRuleHint} ◈`, centerX, centerY + 50);
      ctx.fillText(`◈ ${this.levelRuleHint} ◈`, centerX, centerY + 50);
    }

    ctx.restore();
  }

  /**
   * Render pause button - larger touch target with clear iconography
   */
  private renderPauseButton(renderer: Renderer, width: number): void {
    const buttonSize = 40;
    const margin = 20;
    const x = width - buttonSize - margin;
    const y = 55;

    // Store bounds for click detection
    this.pauseButtonBounds = { x, y, width: buttonSize, height: buttonSize };

    const ctx = renderer.context;
    const centerX = x + buttonSize / 2;
    const centerY = y + buttonSize / 2;

    // Button background with glow
    ctx.save();
    ctx.shadowColor = CONFIG.COLORS.PRIMARY;
    ctx.shadowBlur = 8;
    ctx.fillStyle = 'rgba(10, 10, 15, 0.95)';
    ctx.fillRect(x, y, buttonSize, buttonSize);
    ctx.restore();

    // Border with glow
    ctx.save();
    ctx.shadowColor = CONFIG.COLORS.PRIMARY;
    ctx.shadowBlur = 6;
    ctx.strokeStyle = CONFIG.COLORS.PRIMARY;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, buttonSize, buttonSize);
    ctx.restore();

    // Angular frame
    renderer.drawAngularFrame(x - 2, y - 2, buttonSize + 4, buttonSize + 4, CONFIG.COLORS.PRIMARY, 8);

    // Pause icon (two vertical bars) - larger and with glow
    const barWidth = 7;
    const barHeight = 20;
    const gap = 6;

    ctx.save();
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 4;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(centerX - barWidth - gap / 2, centerY - barHeight / 2, barWidth, barHeight);
    ctx.fillRect(centerX + gap / 2, centerY - barHeight / 2, barWidth, barHeight);
    ctx.restore();

    // Label below button
    renderer.hudText('PAUSE', centerX, y + buttonSize + 10, CONFIG.COLORS.TEXT_DIM, 8, 'center');
  }

  /**
   * Check if pause button was clicked
   */
  isPauseButtonClicked(mouseX: number, mouseY: number): boolean {
    const { x, y, width, height } = this.pauseButtonBounds;
    return mouseX >= x && mouseX <= x + width && mouseY >= y && mouseY <= y + height;
  }

  /**
   * Render mute button - larger touch target with clear iconography
   */
  private renderMuteButton(renderer: Renderer, width: number, isMuted: boolean = false): void {
    const buttonSize = 40;
    const margin = 20;
    const gap = 12;
    // Position to the left of pause button
    const x = width - buttonSize * 2 - margin - gap;
    const y = 55;

    // Store bounds for click detection
    this.muteButtonBounds = { x, y, width: buttonSize, height: buttonSize };

    const ctx = renderer.context;
    const centerX = x + buttonSize / 2;
    const centerY = y + buttonSize / 2;

    // Button color based on mute state
    const buttonColor = isMuted ? CONFIG.COLORS.DANGER : CONFIG.COLORS.SECONDARY;

    // Button background with glow
    ctx.save();
    ctx.shadowColor = buttonColor;
    ctx.shadowBlur = 8;
    ctx.fillStyle = 'rgba(10, 10, 15, 0.95)';
    ctx.fillRect(x, y, buttonSize, buttonSize);
    ctx.restore();

    // Border with glow
    ctx.save();
    ctx.shadowColor = buttonColor;
    ctx.shadowBlur = 6;
    ctx.strokeStyle = buttonColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, buttonSize, buttonSize);
    ctx.restore();

    // Angular frame
    renderer.drawAngularFrame(x - 2, y - 2, buttonSize + 4, buttonSize + 4, buttonColor, 8);

    // Speaker icon - larger
    ctx.save();
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 4;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    // Speaker body
    ctx.moveTo(centerX - 10, centerY - 6);
    ctx.lineTo(centerX - 4, centerY - 6);
    ctx.lineTo(centerX + 4, centerY - 12);
    ctx.lineTo(centerX + 4, centerY + 12);
    ctx.lineTo(centerX - 4, centerY + 6);
    ctx.lineTo(centerX - 10, centerY + 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    if (isMuted) {
      // X mark for muted - larger and red
      ctx.save();
      ctx.shadowColor = CONFIG.COLORS.DANGER;
      ctx.shadowBlur = 6;
      ctx.strokeStyle = CONFIG.COLORS.DANGER;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(centerX + 8, centerY - 8);
      ctx.lineTo(centerX + 18, centerY + 8);
      ctx.moveTo(centerX + 18, centerY - 8);
      ctx.lineTo(centerX + 8, centerY + 8);
      ctx.stroke();
      ctx.restore();
    } else {
      // Sound waves - larger and with glow
      ctx.save();
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 4;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(centerX + 8, centerY, 6, -Math.PI / 3.5, Math.PI / 3.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(centerX + 8, centerY, 12, -Math.PI / 3.5, Math.PI / 3.5);
      ctx.stroke();
      ctx.restore();
    }

    // Label below button
    const label = isMuted ? 'MUTED' : 'SOUND';
    renderer.hudText(
      label,
      centerX,
      y + buttonSize + 10,
      isMuted ? CONFIG.COLORS.DANGER : CONFIG.COLORS.TEXT_DIM,
      8,
      'center',
    );
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
   * Render health as energy bar (cyberpunk style) with label
   */
  private renderHealthBar(renderer: Renderer, player: Player, x: number, y: number): void {
    if (!player.health) return;

    const maxHealth = player.health.max;
    const currentHealth = player.health.current;
    const barWidth = 120;
    const barHeight = 16;
    const barX = x - barWidth;
    const barY = y - barHeight / 2;

    // Label above bar
    renderer.hudText('HEALTH', barX + barWidth / 2, barY - 12, CONFIG.COLORS.TEXT_LIGHT, 10, 'center');

    // Background with stronger contrast
    renderer.fillRect(barX, barY, barWidth, barHeight, '#101018');

    // Health fill with segments
    const healthPercent = currentHealth / maxHealth;
    const fillWidth = barWidth * healthPercent;

    // Color based on health level with brighter colors
    let healthColor: string = '#00ff88'; // Bright green
    if (healthPercent <= 0.33) {
      healthColor = '#ff3344'; // Bright red
    } else if (healthPercent <= 0.66) {
      healthColor = '#ffaa00'; // Bright orange
    }

    renderer.fillRect(barX, barY, fillWidth, barHeight, healthColor);

    // Segment lines (thicker for visibility)
    const segments = maxHealth;
    for (let i = 1; i < segments; i++) {
      const segX = barX + (barWidth / segments) * i;
      renderer.line(segX, barY, segX, barY + barHeight, '#000000', 3);
    }

    // Inner glow effect
    const ctx = renderer.context;
    ctx.save();
    ctx.shadowColor = healthColor;
    ctx.shadowBlur = 8;
    ctx.strokeStyle = healthColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, barY, barWidth, barHeight);
    ctx.restore();

    // Angular corners
    renderer.drawAngularFrame(barX - 3, barY - 3, barWidth + 6, barHeight + 6, healthColor, 6);

    // Health text inside bar
    renderer.hudText(
      `${currentHealth}/${maxHealth}`,
      barX + barWidth / 2,
      barY + barHeight / 2,
      '#ffffff',
      12,
      'center',
    );
  }

  /**
   * Render stacked powerups - shows multiple active powerups
   */
  private renderStackedPowerups(
    renderer: Renderer,
    powerups: ActivePowerupInfo[],
    centerX: number,
    baseY: number,
  ): void {
    const ctx = renderer.context;
    const barWidth = 140;
    const barHeight = 18;
    const spacing = 24;

    // Calculate starting position to center the stack
    const totalHeight = powerups.length * spacing;
    const startY = baseY - totalHeight / 2 + spacing / 2;

    powerups.forEach((powerup, index) => {
      const y = startY + index * spacing;
      const color = powerup.color;

      // Background
      renderer.drawPanel(
        centerX - barWidth / 2 - 4,
        y - barHeight / 2 - 2,
        barWidth + 8,
        barHeight + 4,
        'rgba(10, 10, 15, 0.9)',
        color,
        1,
      );

      // Progress bar background
      renderer.fillRect(centerX - barWidth / 2, y - barHeight / 2, barWidth, barHeight, '#101018');

      // Progress bar fill with glow
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = color;
      ctx.fillRect(centerX - barWidth / 2, y - barHeight / 2, barWidth * powerup.timeRemaining, barHeight);
      ctx.restore();

      // Border
      renderer.strokeRect(centerX - barWidth / 2, y - barHeight / 2, barWidth, barHeight, color, 1);

      // Powerup name
      const name = powerup.id.replace(/_/g, ' ').toUpperCase();
      renderer.hudText(name, centerX, y, '#ffffff', 10, 'center');
    });

    // Stack count indicator if multiple
    if (powerups.length > 1) {
      ctx.save();
      ctx.fillStyle = '#ffaa00';
      ctx.font = "bold 11px 'SF Mono', monospace";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      const countText = `x${powerups.length} ACTIVE`;
      ctx.strokeText(countText, centerX, baseY - totalHeight / 2 - 15);
      ctx.fillText(countText, centerX, baseY - totalHeight / 2 - 15);
      ctx.restore();
    }
  }

  /**
   * Render active powerup indicator - larger and more visible
   */
  private renderPowerup(renderer: Renderer, state: HudState, x: number, y: number): void {
    if (!state.powerupActive) return;

    const isCalm = state.powerupActive.includes('calm');
    const color = isCalm ? '#00ddff' : '#ff5577'; // Brighter colors

    const barWidth = 220;
    const barHeight = 24;
    const panelX = x - barWidth / 2 - 8;
    const panelY = y - barHeight / 2 - 8;
    const panelW = barWidth + 16;
    const panelH = barHeight + 16;

    // Panel background
    renderer.drawPanel(panelX, panelY, panelW, panelH, 'rgba(10, 10, 15, 0.95)', color, 2);

    // Progress bar background
    renderer.fillRect(x - barWidth / 2, y - barHeight / 2, barWidth, barHeight, '#101018');

    // Progress bar fill with glow
    const progress = state.powerupTimeRemaining;
    const ctx = renderer.context;
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.fillStyle = color;
    ctx.fillRect(x - barWidth / 2, y - barHeight / 2, barWidth * progress, barHeight);
    ctx.restore();

    // Border with angular frame
    renderer.strokeRect(x - barWidth / 2, y - barHeight / 2, barWidth, barHeight, color, 2);
    renderer.drawAngularFrame(x - barWidth / 2 - 4, y - barHeight / 2 - 4, barWidth + 8, barHeight + 8, color, 8);

    // Label - larger and clearer
    const powerupName = state.powerupActive.toUpperCase().replace('_', ' ');
    renderer.hudText(`⚡ ${powerupName} ⚡`, x, y, '#ffffff', 14, 'center');
  }

  /**
   * Render mental state meters (for BCI visualization)
   */
  private renderMentalState(renderer: Renderer, state: HudState, width: number, height: number): void {
    const meterWidth = 200;
    const meterHeight = 14;
    const y = height - 26;
    const margin = 40;

    // Bottom bar - solid dark background for readability
    renderer.drawPanel(0, height - 52, width, 52, 'rgba(8, 8, 12, 0.95)', CONFIG.COLORS.PRIMARY, 2);

    // Calm meter (left)
    const calmX = margin;
    const calmColor = '#00ccff'; // Brighter cyan for calm

    renderer.hudText('CALM', calmX + meterWidth / 2, y - 16, calmColor, 12, 'center');

    // Meter background
    renderer.fillRect(calmX, y, meterWidth, meterHeight, '#101018');

    // Meter fill with glow
    const ctx = renderer.context;
    ctx.save();
    ctx.shadowColor = calmColor;
    ctx.shadowBlur = 10;
    ctx.fillStyle = calmColor;
    ctx.fillRect(calmX, y, meterWidth * state.calmLevel, meterHeight);
    ctx.restore();

    // Border and frame
    renderer.strokeRect(calmX, y, meterWidth, meterHeight, calmColor, 2);
    renderer.drawAngularFrame(calmX - 3, y - 3, meterWidth + 6, meterHeight + 6, calmColor, 5);

    // Percentage text
    const calmPercent = Math.round(state.calmLevel * 100);
    renderer.hudText(`${calmPercent}%`, calmX + meterWidth + 10, y + meterHeight / 2, calmColor, 12, 'left');

    // Arousal meter (right)
    const arousalX = width - margin - meterWidth;
    const passionColor = '#ff4466'; // Brighter red for passion

    renderer.hudText('PASSION', arousalX + meterWidth / 2, y - 16, passionColor, 12, 'center');

    // Meter background
    renderer.fillRect(arousalX, y, meterWidth, meterHeight, '#101018');

    // Meter fill with glow (fills from right)
    ctx.save();
    ctx.shadowColor = passionColor;
    ctx.shadowBlur = 10;
    ctx.fillStyle = passionColor;
    ctx.fillRect(arousalX + meterWidth * (1 - state.arousalLevel), y, meterWidth * state.arousalLevel, meterHeight);
    ctx.restore();

    // Border and frame
    renderer.strokeRect(arousalX, y, meterWidth, meterHeight, passionColor, 2);
    renderer.drawAngularFrame(arousalX - 3, y - 3, meterWidth + 6, meterHeight + 6, passionColor, 5);

    // Percentage text
    const passionPercent = Math.round(state.arousalLevel * 100);
    renderer.hudText(`${passionPercent}%`, arousalX - 10, y + meterHeight / 2, passionColor, 12, 'right');
  }

  /**
   * Render meta-progression meters (Noise, Focus, Stillness)
   */
  private renderMetaMeters(renderer: Renderer, state: HudState, width: number): void {
    const meterWidth = 80;
    const meterHeight = 10;
    const panelHeight = 40;
    const y = 75;
    const totalWidth = meterWidth * 3 + 30;
    const startX = width / 2 - totalWidth / 2;
    const spacing = meterWidth + 15;

    // Panel background for meters
    renderer.drawPanel(
      startX - 10,
      y - 18,
      totalWidth + 20,
      panelHeight,
      'rgba(10, 10, 15, 0.9)',
      CONFIG.COLORS.TEXT_DIM,
      1,
    );

    const meters = [
      { label: 'NOISE', value: state.noise ?? 0, color: '#ff6666', icon: '◆' },
      { label: 'FOCUS', value: state.focus ?? 0, color: '#66ff66', icon: '◇' },
      { label: 'STILL', value: state.stillness ?? 0, color: '#6688ff', icon: '○' },
    ];

    const ctx = renderer.context;

    meters.forEach((meter, i) => {
      const x = startX + i * spacing;

      // Label with icon
      renderer.hudText(`${meter.icon} ${meter.label}`, x + meterWidth / 2, y - 6, meter.color, 10, 'center');

      // Background
      renderer.fillRect(x, y + 4, meterWidth, meterHeight, '#101018');

      // Fill with glow
      const fillWidth = (meterWidth * meter.value) / 100;
      ctx.save();
      ctx.shadowColor = meter.color;
      ctx.shadowBlur = 6;
      ctx.fillStyle = meter.color;
      ctx.fillRect(x, y + 4, fillWidth, meterHeight);
      ctx.restore();

      // Border
      renderer.strokeRect(x, y + 4, meterWidth, meterHeight, meter.color, 1.5);

      // Value text
      renderer.hudText(
        `${Math.round(meter.value)}`,
        x + meterWidth / 2,
        y + 4 + meterHeight / 2,
        '#ffffff',
        8,
        'center',
      );
    });
  }

  /**
   * Render level lore/insight hint at top of screen - informative flavor text
   */
  private renderRuleCardHint(renderer: Renderer, hint: string, width: number): void {
    const y = 130;

    // Calculate pill dimensions based on text
    const textWidth = hint.length * 7.5 + 50;
    const pillWidth = Math.min(width - 40, Math.max(200, textWidth));
    const pillHeight = 30;
    const pillX = (width - pillWidth) / 2;

    // Panel background with softer color (lore, not warning)
    renderer.drawPanel(
      pillX,
      y - pillHeight / 2,
      pillWidth,
      pillHeight,
      'rgba(10, 10, 15, 0.9)',
      CONFIG.COLORS.PRIMARY,
      1,
    );

    // Lore icon (star/insight symbol)
    renderer.hudText('✦', pillX + 16, y, CONFIG.COLORS.PRIMARY, 14, 'center');

    // Hint text - now lore/insight flavor
    renderer.hudText(hint, pillX + 32, y, CONFIG.COLORS.TEXT_LIGHT, 11, 'left');

    // Subtle angular frame (less prominent than before)
    renderer.drawAngularFrame(
      pillX - 1,
      y - pillHeight / 2 - 1,
      pillWidth + 2,
      pillHeight + 2,
      CONFIG.COLORS.PRIMARY,
      4,
    );
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
