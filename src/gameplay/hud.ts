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
  levelName?: string;
  powerupActive: string | null;
  powerupTimeRemaining: number;
  activePowerups?: ActivePowerupInfo[];
  calmLevel: number;
  arousalLevel: number;
  showPauseButton?: boolean;
  noise?: number;
  focus?: number;
  stillness?: number;
  betaMeter?: number;
  thetaMeter?: number;
  ruleCardHint?: string;
  // Neuro state
  neuroSource?: 'eeg' | 'rppg' | 'mock' | 'none';
  bpm?: number | null;
  bpmQuality?: number;
  signalQuality?: number;
  alphaPower?: number | null;
  betaPower?: number | null;
  thetaPower?: number | null;
  deltaPower?: number | null;
  gammaPower?: number | null;
  alphaBump?: boolean;
  weaponMode?: 'beam' | 'spray' | 'balanced' | 'flow';
  shieldCharge?: number;
  overdriveCharge?: number;
  shieldActive?: boolean;
  overdriveActive?: boolean;
  eegConnected?: boolean;
  cameraActive?: boolean;
  calibrationProgress?: number;
  // Waveform / debug
  waveformData?: Uint8Array | null;
  frequencyData?: Uint8Array | null;
  effectiveTempo?: number;
  eegLastError?: string;
  cameraLastError?: string;
  eegReconnects?: number;
  eegSamples?: number[];
  // rPPG debug fields
  displayBpm?: number | null;
  rawBpm?: number | null;
  smoothedBpm?: number | null;
  lastValidBpm?: number | null;
  bpmHistory?: number[];
  lastValidBpmAge?: number;
  rppgActiveTime?: number;
  rppgWarmupComplete?: boolean;
  videoWidth?: number;
  videoHeight?: number;
  eegFrameCount?: number;
  eegDecodeErrors?: number;
  eegBleNotifications?: number;
  eegEmptyDecodes?: number;
  eegModelsReady?: boolean;
  eegBatteryLevel?: number | null;
  eegReconnecting?: boolean;
  eegReconnectAttempt?: number;
  eegReconnectCount?: number;
  // Expanded neurometrics
  hrvRmssd?: number | null;
  respirationRate?: number | null;
  baselineBpm?: number | null;
  baselineDelta?: number | null;
  calmnessState?: string | null;
  alphaPeakFreq?: number | null;
  alphaBumpState?: string | null;
  confidence?: number;
  // SDK debug internals
  rppgDebugMetrics?: import('../engine/rppgProvider').RppgDebugMetrics | null;
  // EEG band power history for sparkline chart
  eegBandHistory?: import('../engine/eegProvider').BandPowerSnapshot[];
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

  // Info button bounds for click detection
  private infoButtonBounds = { x: 0, y: 0, width: 0, height: 0 };

  // Neuro button bounds for click detection
  private neuroButtonBounds = { x: 0, y: 0, width: 0, height: 0 };

  // Alpha bump visual effect timer
  private alphaBumpTimer: number = 0;

  // Webcam face preview mirror
  private videoElement: HTMLVideoElement | null = null;

  // Weapon mode change tracking
  private previousWeaponMode: string = 'balanced';

  // Level title display
  private levelTitleText: string = '';
  private levelSubtitleText: string = '';
  private levelRuleHint: string = '';
  private levelTitleTimer: number = 0;
  private readonly levelTitleDuration: number = 4;

  // Neuro toast notifications
  private toastMessage: string = '';
  private toastTimer: number = 0;
  private toastColor: string = CONFIG.COLORS.PRIMARY;

  // Debug overlay
  private debugVisible: boolean = false;

  // Mouse hover tooltip system
  private mousePos: { x: number; y: number } | null = null;
  private tooltipRegions: Array<{ x: number; y: number; w: number; h: number; tip: string }> = [];

  setVideoElement(el: HTMLVideoElement | null): void {
    this.videoElement = el;
  }

  showToast(message: string, color: string = CONFIG.COLORS.PRIMARY): void {
    this.toastMessage = message;
    this.toastTimer = 3;
    this.toastColor = color;
  }

  setMousePos(pos: { x: number; y: number } | null): void {
    this.mousePos = pos;
  }

  toggleDebug(): void {
    this.debugVisible = !this.debugVisible;
  }

  isDebugVisible(): boolean {
    return this.debugVisible;
  }

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

    // Toast timer
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
    }

    // Alpha bump visual
    if (this.alphaBumpTimer > 0) {
      this.alphaBumpTimer -= dt;
    }
    if (state.alphaBump) {
      this.alphaBumpTimer = 0.5;
    }

    // Weapon mode change toast
    const currentMode = state.weaponMode ?? 'balanced';
    if (currentMode !== this.previousWeaponMode) {
      const modeDesc: Record<string, string> = {
        beam: 'BEAM MODE — High Calm = Precision Damage',
        spray: 'SPRAY MODE — High Arousal = Rapid Fire',
        flow: 'FLOW MODE — Balanced = Homing x2',
        balanced: 'BALANCED MODE — Standard Fire',
      };
      this.showToast(modeDesc[currentMode] ?? `MODE: ${currentMode.toUpperCase()}`, '#ffdd44');
      this.previousWeaponMode = currentMode;
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

    // Clear tooltip hit regions each frame
    this.tooltipRegions = [];

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

    // Neuro metrics strip (above bottom panel)
    this.renderNeuroStrip(renderer, state, width, height);

    // Waveform visualizations
    this.renderWaveforms(renderer, state, width, height);

    // Pause, Mute, Info, and Neuro buttons
    if (state.showPauseButton !== false) {
      this.renderPauseButton(renderer, width);
      this.renderMuteButton(renderer, width, this._isMuted);
      this.renderInfoButton(renderer, width);
      this.renderNeuroButton(renderer, width);
    }

    // Toast notification (positioned below quote bar when visible)
    if (this.toastTimer > 0) {
      this.renderToast(renderer, width, height, !!state.ruleCardHint);
    }

    // Debug overlay
    if (this.debugVisible) {
      this.renderDebugOverlay(renderer, state, width, height);
    }

    // Level title overlay (shown at level start)
    if (this.levelTitleTimer > 0) {
      this.renderLevelTitle(renderer, width, height);
    }

    // Hover tooltip (rendered last so it's always on top)
    this.renderHoverTooltip(renderer);
  }

  private addTooltipRegion(x: number, y: number, w: number, h: number, tip: string): void {
    this.tooltipRegions.push({ x, y, w, h, tip });
  }

  private renderHoverTooltip(renderer: Renderer): void {
    if (!this.mousePos) return;
    const { x: mx, y: my } = this.mousePos;

    let hoveredTip: string | null = null;
    let tipX = mx;
    let tipY = my;

    for (const r of this.tooltipRegions) {
      if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
        hoveredTip = r.tip;
        tipX = r.x + r.w / 2;
        tipY = r.y;
        break;
      }
    }

    if (!hoveredTip) return;

    const ctx = renderer.context;
    ctx.save();
    ctx.font = "11px 'SF Mono', Consolas, monospace";
    const textW = ctx.measureText(hoveredTip).width;
    const padH = 8;
    const padV = 6;
    const boxW = textW + padH * 2;
    const boxH = 16 + padV * 2;
    let boxX = tipX - boxW / 2;
    const boxY = tipY - boxH - 6;

    // Keep within canvas bounds
    if (boxX < 4) boxX = 4;
    if (boxX + boxW > renderer.width - 4) boxX = renderer.width - 4 - boxW;

    ctx.globalAlpha = 0.95;
    renderer.drawRoundRect(boxX, boxY, boxW, boxH, 4, 'rgba(8,8,16,0.95)', CONFIG.COLORS.PRIMARY, 1);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ccddee';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(hoveredTip, boxX + boxW / 2, boxY + boxH / 2);
    ctx.restore();
  }

  private renderToast(renderer: Renderer, width: number, _height: number, quoteVisible: boolean): void {
    const ctx = renderer.context;
    const alpha = Math.min(1, this.toastTimer);
    ctx.save();
    ctx.globalAlpha = alpha;

    const toastW = Math.max(300, this.toastMessage.length * 9 + 40);
    const toastH = 32;
    const toastX = (width - toastW) / 2;
    // Place below the quote bar (y=130, h=30 → bottom at 145) when visible
    const toastY = quoteVisible ? 155 : 100;

    renderer.drawPanel(toastX, toastY, toastW, toastH, 'rgba(8,8,12,0.9)', this.toastColor, 1);
    renderer.hudText(this.toastMessage, width / 2, toastY + toastH / 2, this.toastColor, 14, 'center');

    ctx.restore();
  }

  /**
   * Render debug overlay with raw neuro data
   */
  private renderDebugOverlay(renderer: Renderer, state: HudState, width: number, _height: number): void {
    const ctx = renderer.context;
    ctx.save();
    ctx.globalAlpha = 0.85;

    const panelW = 280;
    const panelX = width - panelW - 10;
    const panelY = 110;

    const lines: Array<{ label: string; value: string; color: string }> = [
      { label: 'SOURCE', value: state.neuroSource ?? 'none', color: '#88ff88' },
      { label: 'CALM', value: `${(state.calmLevel * 100).toFixed(1)}%`, color: '#44aaff' },
      { label: 'AROUSAL', value: `${(state.arousalLevel * 100).toFixed(1)}%`, color: '#ff4466' },
      { label: 'WEAPON', value: state.weaponMode ?? 'balanced', color: '#ffdd44' },
      { label: 'SHIELD', value: `${((state.shieldCharge ?? 0) * 100).toFixed(0)}%`, color: '#44aaff' },
      { label: 'OVERDRIVE', value: `${((state.overdriveCharge ?? 0) * 100).toFixed(0)}%`, color: '#ff4466' },
    ];

    // BPM section with raw/smooth/last-valid
    lines.push({ label: '--- HEART RATE ---', value: '', color: '#555577' });
    lines.push({
      label: 'RAW BPM',
      value: state.rawBpm != null ? `${Math.round(state.rawBpm)}` : '—',
      color: '#ff8844',
    });
    lines.push({
      label: 'SMOOTH BPM',
      value: state.smoothedBpm != null ? `${Math.round(state.smoothedBpm)}` : '—',
      color: '#ff6633',
    });
    lines.push({
      label: 'DISPLAY BPM',
      value: state.displayBpm != null ? `${Math.round(state.displayBpm)}` : '—',
      color: '#ff4466',
    });
    lines.push({ label: 'EMA BPM', value: state.bpm != null ? `${Math.round(state.bpm)}` : '—', color: '#ff5555' });
    lines.push({
      label: 'LAST VALID BPM',
      value: state.lastValidBpm != null ? `${Math.round(state.lastValidBpm)}` : '—',
      color: '#cc6644',
    });

    const staleAge = state.lastValidBpmAge ?? 0;
    if (staleAge > 0) {
      lines.push({
        label: 'STALE (s)',
        value: `${(staleAge / 1000).toFixed(1)}`,
        color: staleAge > 15000 ? '#ff4444' : '#ffaa44',
      });
    }
    lines.push({ label: 'BPM QUALITY', value: `${((state.bpmQuality ?? 0) * 100).toFixed(0)}%`, color: '#ffaa44' });
    lines.push({ label: 'SIGNAL', value: `${((state.signalQuality ?? 0) * 100).toFixed(0)}%`, color: '#aaffaa' });

    if (state.alphaPower != null) {
      lines.push(
        { label: '--- EEG BANDS ---', value: '', color: '#555577' },
        { label: 'ALPHA', value: state.alphaPower.toFixed(2), color: '#44aaff' },
        { label: 'BETA', value: (state.betaPower ?? 0).toFixed(2), color: '#ff6644' },
        { label: 'THETA', value: (state.thetaPower ?? 0).toFixed(2), color: '#aa44ff' },
      );
    }

    lines.push({ label: '--- DEVICES ---', value: '', color: '#555577' });
    lines.push(
      {
        label: 'EEG',
        value: state.eegConnected ? 'CONNECTED' : 'OFF',
        color: state.eegConnected ? '#44ff88' : '#666666',
      },
      {
        label: 'CAMERA',
        value: state.cameraActive ? 'ACTIVE' : 'OFF',
        color: state.cameraActive ? '#ffaa44' : '#666666',
      },
      { label: 'CALIB', value: `${Math.round((state.calibrationProgress ?? 0) * 100)}%`, color: '#ffaa44' },
    );

    // New rPPG debug fields
    lines.push({ label: 'CALIB TIME', value: `${(state.rppgActiveTime ?? 0).toFixed(1)}s`, color: '#aaaacc' });
    lines.push({
      label: 'WARMUP',
      value: state.rppgWarmupComplete ? 'YES' : 'NO',
      color: state.rppgWarmupComplete ? '#44ff88' : '#ffaa44',
    });

    if (state.videoWidth && state.videoHeight) {
      lines.push({ label: 'VIDEO RES', value: `${state.videoWidth}x${state.videoHeight}`, color: '#aaaacc' });
    }

    if (state.eegFrameCount !== undefined) {
      lines.push({
        label: 'EEG FRAMES',
        value: `${state.eegFrameCount}`,
        color: state.eegFrameCount > 0 ? '#44ccff' : '#ff6644',
      });
    }
    if (state.eegBleNotifications !== undefined) {
      lines.push({
        label: 'BLE NOTIFS',
        value: `${state.eegBleNotifications}`,
        color: state.eegBleNotifications > 0 ? '#44ccff' : '#ff6644',
      });
    }
    if (state.eegEmptyDecodes !== undefined && state.eegEmptyDecodes > 0) {
      lines.push({ label: 'EEG EMPTY DEC', value: `${state.eegEmptyDecodes}`, color: '#ffaa44' });
    }
    if (state.eegDecodeErrors !== undefined && state.eegDecodeErrors > 0) {
      lines.push({ label: 'EEG DECODE ERR', value: `${state.eegDecodeErrors}`, color: '#ff4444' });
    }
    if (state.eegModelsReady !== undefined) {
      lines.push({
        label: 'EEG MODELS',
        value: state.eegModelsReady ? 'READY' : 'NOT LOADED',
        color: state.eegModelsReady ? '#44ff88' : '#ff4444',
      });
    }
    if (state.eegSamples) {
      lines.push({ label: 'EEG SAMPLES', value: `${state.eegSamples.length}`, color: '#44ccff' });
    }
    if (state.eegBatteryLevel != null) {
      const batColor = state.eegBatteryLevel <= 10 ? '#ff4444' : state.eegBatteryLevel <= 20 ? '#ffaa44' : '#44ff88';
      lines.push({ label: 'EEG BATTERY', value: `${state.eegBatteryLevel}%`, color: batColor });
    }
    if (state.eegReconnecting) {
      lines.push({ label: 'EEG RECONN', value: `${state.eegReconnectAttempt ?? 0}/5`, color: '#ffaa44' });
    }

    if (state.eegLastError) {
      lines.push({ label: 'EEG ERR', value: state.eegLastError, color: '#ff4444' });
    }
    if (state.cameraLastError) {
      lines.push({ label: 'CAM ERR', value: state.cameraLastError, color: '#ff4444' });
    }
    if ((state.eegReconnectCount ?? 0) > 0) {
      lines.push({ label: 'RECONNECTS', value: `${state.eegReconnectCount}`, color: '#ffaa44' });
    }
    if (state.effectiveTempo) {
      lines.push({ label: 'MUSIC BPM', value: `${Math.round(state.effectiveTempo)}`, color: '#88ff88' });
    }

    // Expanded neurometrics
    if (state.hrvRmssd != null) {
      lines.push({ label: 'HRV (RMSSD)', value: `${state.hrvRmssd.toFixed(1)}ms`, color: '#44ddaa' });
    }
    if (state.respirationRate != null) {
      lines.push({ label: 'RESP RATE', value: `${state.respirationRate.toFixed(1)}/min`, color: '#88aaff' });
    }
    if (state.baselineBpm != null) {
      lines.push({ label: 'BASELINE HR', value: `${Math.round(state.baselineBpm)}`, color: '#aaaacc' });
    }
    if (state.baselineDelta != null) {
      const sign = state.baselineDelta >= 0 ? '+' : '';
      lines.push({
        label: 'HR DELTA',
        value: `${sign}${Math.round(state.baselineDelta)}`,
        color: state.baselineDelta > 5 ? '#ff8844' : '#88ff88',
      });
    }
    if (state.calmnessState) {
      lines.push({ label: 'CALM STATE', value: state.calmnessState, color: '#00ccff' });
    }
    if (state.alphaPeakFreq != null) {
      lines.push({ label: 'ALPHA PEAK', value: `${state.alphaPeakFreq.toFixed(1)} Hz`, color: '#44ccff' });
    }
    if (state.alphaBumpState) {
      lines.push({ label: 'ALPHA STATE', value: state.alphaBumpState, color: '#00ffcc' });
    }
    if (state.confidence !== undefined) {
      lines.push({ label: 'CONFIDENCE', value: `${(state.confidence * 100).toFixed(0)}%`, color: '#aaffaa' });
    }

    // SDK internals
    const dbg = state.rppgDebugMetrics;
    if (dbg) {
      lines.push({ label: '--- SDK INTERNALS ---', value: '', color: '#555577' });
      lines.push({
        label: 'SPECTRAL',
        value: dbg.spectralBpm != null ? `${Math.round(dbg.spectralBpm)}` : '—',
        color: '#777799',
      });
      lines.push({ label: 'ACF', value: dbg.acfBpm != null ? `${Math.round(dbg.acfBpm)}` : '—', color: '#777799' });
      lines.push({
        label: 'PEAKS',
        value: dbg.peaksBpm != null ? `${Math.round(dbg.peaksBpm)}` : '—',
        color: '#777799',
      });
      lines.push({
        label: 'BAYES',
        value: dbg.bayesBpm != null ? `${Math.round(dbg.bayesBpm)} (${(dbg.bayesConfidence * 100).toFixed(0)}%)` : '—',
        color: '#777799',
      });
      lines.push({
        label: 'FUSED',
        value: dbg.fusedBpm != null ? `${Math.round(dbg.fusedBpm)} [${dbg.fusedSource}]` : '—',
        color: '#777799',
      });
      lines.push({
        label: 'RESOLVED',
        value: dbg.resolvedBpm != null ? `${Math.round(dbg.resolvedBpm)}` : '—',
        color: '#777799',
      });
      if (dbg.calibrationTrained) {
        lines.push({ label: 'CALIBRATED', value: 'YES', color: '#44ff88' });
      }
      if (dbg.aliasFlag) {
        lines.push({ label: 'ALIAS', value: 'FLAG', color: '#ff8844' });
      }
      if (dbg.harmonicCorrected) {
        lines.push({
          label: 'HARMONIC',
          value: `HALVED (was ${dbg.preCorrectBpm?.toFixed(0) ?? '?'})`,
          color: '#ff44ff',
        });
      }
    }

    const panelHActual = Math.max(200, 15 + lines.length * 16 + 10);
    renderer.drawPanel(panelX, panelY, panelW, panelHActual, 'rgba(0,0,0,0.9)', '#444466', 1);

    const lineH = 16;
    lines.forEach((line, i) => {
      const y = panelY + 15 + i * lineH;
      renderer.hudText(line.label, panelX + 8, y, '#888888', 9, 'left');
      renderer.hudText(line.value, panelX + panelW - 8, y, line.color, 9, 'right');
    });

    ctx.restore();
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

    // Solid overlay behind title
    ctx.fillStyle = 'rgba(8, 8, 12, 0.92)';
    ctx.fillRect(0, centerY - 80, width, 160);

    // Glow border lines
    ctx.save();
    ctx.shadowColor = CONFIG.COLORS.PRIMARY;
    ctx.shadowBlur = 12;
    ctx.strokeStyle = CONFIG.COLORS.PRIMARY;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(width * 0.1, centerY - 80);
    ctx.lineTo(width * 0.9, centerY - 80);
    ctx.moveTo(width * 0.1, centerY + 80);
    ctx.lineTo(width * 0.9, centerY + 80);
    ctx.stroke();
    ctx.restore();

    // Main title
    ctx.shadowColor = CONFIG.COLORS.PRIMARY;
    ctx.shadowBlur = 25;
    ctx.fillStyle = '#ffffff';
    ctx.font = "bold 36px 'SF Mono', Consolas, monospace";
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
    renderer.drawRoundRect(x, y, buttonSize, buttonSize, 4, 'rgba(10, 10, 15, 0.95)');
    ctx.restore();

    // Border with glow
    ctx.save();
    ctx.shadowColor = CONFIG.COLORS.PRIMARY;
    ctx.shadowBlur = 6;
    renderer.drawRoundRect(x, y, buttonSize, buttonSize, 4, 'transparent', CONFIG.COLORS.PRIMARY, 2);
    ctx.restore();

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
    renderer.drawRoundRect(x, y, buttonSize, buttonSize, 4, 'rgba(10, 10, 15, 0.95)');
    ctx.restore();

    // Border with glow
    ctx.save();
    ctx.shadowColor = buttonColor;
    ctx.shadowBlur = 6;
    renderer.drawRoundRect(x, y, buttonSize, buttonSize, 4, 'transparent', buttonColor, 2);
    ctx.restore();

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
   * Render neuro state panel — three-section layout:
   * Left: device status + signal. Center: brain ring + abilities. Right: weapon mode info.
   */
  private renderMentalState(renderer: Renderer, state: HudState, width: number, height: number): void {
    const ctx = renderer.context;
    const panelH = 95;
    const panelY = height - panelH;

    renderer.drawPanel(0, panelY, width, panelH, 'rgba(8, 8, 12, 0.95)', CONFIG.COLORS.PRIMARY, 2);

    const calmColor = '#00ccff';
    const arousalColor = '#ff4466';
    const flowColor = '#ffdd44';

    const leftW = width * 0.25;
    const centerX = width / 2;
    const rightStart = width * 0.75;

    // ── LEFT SECTION: Device Status ──
    this.renderDeviceStatus(renderer, state, 14, panelY + 8, leftW - 20);

    // ── CENTER SECTION: Brain Ring + Calm/Arousal bars + Ability charges ──
    const ringY = panelY + 38;
    const ringR = 22;
    const lineW = 5;

    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, ringY, ringR, 0, Math.PI * 2);
    ctx.strokeStyle = '#181822';
    ctx.lineWidth = lineW + 2;
    ctx.stroke();

    const calmAngle = -Math.PI / 2 - Math.PI * state.calmLevel;
    ctx.beginPath();
    ctx.arc(centerX, ringY, ringR, -Math.PI / 2, calmAngle, true);
    ctx.strokeStyle = calmColor;
    ctx.lineWidth = lineW;
    ctx.shadowColor = calmColor;
    ctx.shadowBlur = 10;
    ctx.stroke();

    const arousalAngle = -Math.PI / 2 + Math.PI * state.arousalLevel;
    ctx.beginPath();
    ctx.arc(centerX, ringY, ringR, -Math.PI / 2, arousalAngle, false);
    ctx.strokeStyle = arousalColor;
    ctx.shadowColor = arousalColor;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();

    const mode = state.weaponMode ?? 'balanced';
    const modeIcon = mode === 'beam' ? '◎' : mode === 'spray' ? '✦' : mode === 'flow' ? '◈' : '•';
    const modeColor =
      mode === 'beam' ? calmColor : mode === 'spray' ? arousalColor : mode === 'flow' ? flowColor : '#aaaaaa';
    renderer.hudText(modeIcon, centerX, ringY + 1, modeColor, 16, 'center');

    // Calm / Arousal labels under ring
    renderer.hudText(
      `C ${Math.round(state.calmLevel * 100)}%`,
      centerX - 40,
      ringY + ringR + 14,
      calmColor,
      9,
      'center',
    );
    renderer.hudText(
      `A ${Math.round(state.arousalLevel * 100)}%`,
      centerX + 40,
      ringY + ringR + 14,
      arousalColor,
      9,
      'center',
    );

    // Shield charge bar (left of ring)
    const chargeBarW = 56;
    const chargeBarH = 7;
    const shieldCharge = state.shieldCharge ?? 0;
    const shieldBarX = centerX - ringR - 12 - chargeBarW;
    const shieldBarY = ringY - chargeBarH / 2;

    const shieldLabel = state.shieldActive ? 'SHIELD ON' : 'SHIELD';
    const shieldLabelColor = state.shieldActive ? '#ffffff' : calmColor;
    renderer.hudText(shieldLabel, shieldBarX + chargeBarW / 2, shieldBarY - 9, shieldLabelColor, 8, 'center');
    renderer.fillRect(shieldBarX, shieldBarY, chargeBarW, chargeBarH, '#101018');
    ctx.save();
    ctx.shadowColor = calmColor;
    ctx.shadowBlur = state.shieldActive ? 14 + Math.sin(this.time * 6) * 6 : shieldCharge > 0.9 ? 12 : 4;
    ctx.fillStyle = state.shieldActive ? '#66eeff' : calmColor;
    ctx.fillRect(shieldBarX, shieldBarY, chargeBarW * shieldCharge, chargeBarH);
    ctx.restore();
    renderer.strokeRect(shieldBarX, shieldBarY, chargeBarW, chargeBarH, calmColor, 1);

    // Overdrive charge bar (right of ring)
    const overdriveCharge = state.overdriveCharge ?? 0;
    const odBarX = centerX + ringR + 12;
    const odBarY = ringY - chargeBarH / 2;

    const odLabel = state.overdriveActive ? 'OVERDRIVE!' : 'OVERDRIVE';
    const odLabelColor = state.overdriveActive ? '#ffffff' : arousalColor;
    renderer.hudText(odLabel, odBarX + chargeBarW / 2, odBarY - 9, odLabelColor, 8, 'center');
    renderer.fillRect(odBarX, odBarY, chargeBarW, chargeBarH, '#101018');
    ctx.save();
    ctx.shadowColor = arousalColor;
    ctx.shadowBlur = state.overdriveActive ? 14 + Math.sin(this.time * 8) * 6 : overdriveCharge > 0.9 ? 12 : 4;
    ctx.fillStyle = state.overdriveActive ? '#ff8888' : arousalColor;
    ctx.fillRect(odBarX, odBarY, chargeBarW * overdriveCharge, chargeBarH);
    ctx.restore();
    renderer.strokeRect(odBarX, odBarY, chargeBarW, chargeBarH, arousalColor, 1);

    // ── RIGHT SECTION: Weapon Mode Info ──
    this.renderWeaponModeInfo(renderer, state, rightStart + 6, panelY + 8, width - rightStart - 20);
  }

  /**
   * Render device status in the left section of the neuro panel.
   * Shows connection icons, BPM, signal quality, and EEG band powers.
   */
  private renderDeviceStatus(renderer: Renderer, state: HudState, x: number, y: number, maxW: number): void {
    const ctx = renderer.context;
    const source = state.neuroSource ?? 'none';
    const quality = state.signalQuality ?? 0;

    // Row 1: Source with connection icon
    const eegConn = state.eegConnected ?? false;
    const camActive = state.cameraActive ?? false;
    const calibProg = state.calibrationProgress ?? 0;

    let icon: string;
    let iconColor: string;
    let statusLabel: string;

    if (source === 'eeg') {
      icon = '●';
      iconColor = '#44ff88';
      statusLabel = 'EEG CONNECTED';
    } else if (source === 'rppg') {
      if (calibProg < 1) {
        icon = '◉';
        iconColor = '#ffaa44';
        statusLabel = `CAM ${Math.round(calibProg * 100)}%`;
      } else {
        icon = '●';
        iconColor = '#ffaa44';
        statusLabel = 'WEBCAM ACTIVE';
      }
    } else if (source === 'mock') {
      icon = '◇';
      iconColor = '#666688';
      statusLabel = 'SIMULATED';
    } else if (eegConn) {
      const dots = '.'.repeat(1 + (Math.floor(this.time * 2) % 3));
      const frames = state.eegFrameCount ?? 0;
      const errors = state.eegDecodeErrors ?? 0;
      const bleNotifs = state.eegBleNotifications ?? 0;
      const bat = state.eegBatteryLevel;
      const batStr = bat != null ? ` [${bat}%]` : '';
      icon = '◉';
      iconColor = errors > 0 ? '#ff6644' : frames > 0 ? '#44ff88' : '#ffaa44';
      if (errors > 0) {
        statusLabel = `EEG decode err (${errors})`;
      } else if (frames > 0) {
        statusLabel = `EEG active${dots}${batStr}`;
      } else if (bleNotifs > 0) {
        statusLabel = `EEG decoding${dots} (${bleNotifs} pkts)`;
      } else {
        statusLabel = `EEG waiting${dots} (no data)`;
      }
    } else if (state.eegReconnecting) {
      const dots = '.'.repeat(1 + (Math.floor(this.time * 2) % 3));
      icon = '◎';
      iconColor = '#ffaa44';
      statusLabel = `EEG reconnecting${dots} (${state.eegReconnectAttempt ?? 0}/5)`;
    } else {
      icon = '✕';
      iconColor = '#ff4444';
      statusLabel = 'NO DEVICE';
    }

    // Pulsing animation for calibrating/reconnecting state
    if ((source === 'rppg' && calibProg < 1) || state.eegReconnecting) {
      const pulse = 0.6 + Math.sin(this.time * 4) * 0.4;
      ctx.save();
      ctx.globalAlpha = pulse;
      renderer.hudText(icon, x, y + 6, iconColor, 11, 'left');
      ctx.restore();
    } else {
      renderer.hudText(icon, x, y + 6, iconColor, 11, 'left');
    }
    renderer.hudText(statusLabel, x + 14, y + 6, iconColor, 10, 'left');

    // Row 2: secondary device status
    let row2Y = y + 20;

    // Low battery warning (inside panel, below status label)
    if (eegConn && state.eegBatteryLevel != null && state.eegBatteryLevel <= 20) {
      const batWarnColor = state.eegBatteryLevel <= 10 ? '#ff4444' : '#ffaa44';
      const batWarnPulse = state.eegBatteryLevel <= 10 ? 0.6 + Math.sin(this.time * 6) * 0.4 : 1;
      ctx.save();
      ctx.globalAlpha = batWarnPulse;
      renderer.hudText(`⚡ LOW BATTERY ${state.eegBatteryLevel}%`, x + 14, row2Y, batWarnColor, 9, 'left');
      ctx.restore();
      row2Y += 12;
    }
    if (eegConn && source !== 'eeg') {
      const frames = state.eegFrameCount ?? 0;
      const errors = state.eegDecodeErrors ?? 0;
      const hasEegData = state.alphaPower != null || frames > 0;
      if (errors > 0) {
        renderer.hudText('✕', x, row2Y, '#ff6644', 10, 'left');
        renderer.hudText(`EEG errors: ${errors}`, x + 14, row2Y, '#ff6644', 9, 'left');
      } else if (hasEegData) {
        renderer.hudText('●', x, row2Y, '#44ff88', 10, 'left');
        renderer.hudText(`EEG active (${frames} frames)`, x + 14, row2Y, '#44ff88', 9, 'left');
      } else {
        const dots = '.'.repeat(1 + (Math.floor(this.time * 2) % 3));
        renderer.hudText('◌', x, row2Y, '#ffaa44', 10, 'left');
        renderer.hudText(`EEG syncing${dots} (0 frames)`, x + 14, row2Y, '#ffaa44', 9, 'left');
      }
      row2Y += 14;
    }
    if (camActive && source !== 'rppg') {
      renderer.hudText('◌', x, row2Y, '#555566', 10, 'left');
      renderer.hudText('Camera standby', x + 14, row2Y, '#555566', 9, 'left');
      row2Y += 14;
    }

    // Heart rate (if available) — use displayBpm for a stable number
    const displayBpm = state.displayBpm ?? state.bpm;
    if (displayBpm !== null && displayBpm !== undefined) {
      const beatPhase = Math.sin(this.time * ((displayBpm || 72) / 60) * Math.PI * 2);
      const beatScale = 1 + beatPhase * 0.08;
      ctx.save();
      ctx.translate(x, row2Y);
      ctx.scale(beatScale, beatScale);
      ctx.translate(-x, -row2Y);
      renderer.hudText('♥', x, row2Y, '#ff4466', 18, 'left');
      ctx.restore();
      renderer.hudText(`${Math.round(displayBpm)}`, x + 18, row2Y, '#ff4466', 16, 'left');
      renderer.hudText('BPM', x + 50, row2Y, '#cc3355', 9, 'left');
      this.addTooltipRegion(x, row2Y - 10, 70, 20, 'Heart rate in beats per minute');
      row2Y += 20;

      // BPM history sparkline
      const history = state.bpmHistory;
      if (history && history.length > 2) {
        this.renderBpmSparkline(renderer, history, x, row2Y, Math.min(maxW - 4, 90), 20);
        row2Y += 26;
      }
    }

    // Signal quality bar
    const qualBarW = Math.min(maxW - 4, 90);
    const qualBarH = 5;
    const qualColor = quality > 0.6 ? '#44ff88' : quality > 0.3 ? '#ffaa44' : '#ff4444';
    renderer.hudText('SIG', x, row2Y + 1, '#5a6070', 8, 'left');
    this.addTooltipRegion(x, row2Y - 4, qualBarW + 26, qualBarH + 8, 'Neuro signal quality — higher is better');
    renderer.fillRect(x + 22, row2Y - 1, qualBarW, qualBarH, '#101018');
    ctx.save();
    ctx.fillStyle = qualColor;
    ctx.fillRect(x + 22, row2Y - 1, qualBarW * quality, qualBarH);
    ctx.restore();
    renderer.hudText(`${Math.round(quality * 100)}%`, x + 22 + qualBarW + 4, row2Y + 1, qualColor, 8, 'left');
    row2Y += 14;

    // Floating elements stacked upward above the panel
    const floatW = Math.min(maxW - 4, 90);
    const floatPad = 6;
    const sectionGap = 8;

    const hasCam = camActive && this.videoElement && this.videoElement.readyState >= 2;
    const hasBands = eegConn && state.alphaPower !== undefined && state.alphaPower !== null;
    const hasChart = hasBands && state.eegBandHistory && state.eegBandHistory.length > 2;
    const hasWave = eegConn && state.eegSamples && state.eegSamples.length > 4;

    const camH = hasCam ? 48 : 0;
    const chartH = 32;
    const waveH = 28;
    let barsEstimate = 0;
    if (hasBands) {
      barsEstimate = 5 * 9 + 2;
      if (state.calmnessState) barsEstimate += 10;
      if (state.alphaPeakFreq != null) barsEstimate += 10;
      if (state.alphaBumpState && state.alphaBumpState !== 'unknown') barsEstimate += 10;
    }

    let totalFloatH = 0;
    if (hasCam) totalFloatH += camH + sectionGap;
    if (hasBands) totalFloatH += barsEstimate + sectionGap;
    if (hasChart) totalFloatH += chartH + 6;
    if (hasWave) totalFloatH += waveH + sectionGap;

    const floatClearance = 24;
    if (totalFloatH > 0) {
      totalFloatH += floatPad * 2;
      const bgX = x - floatPad;
      const bgY = y - floatClearance - totalFloatH;
      const bgW = floatW + 30 + floatPad * 2;

      renderer.drawRoundRect(bgX, bgY, bgW, totalFloatH, 4, 'rgba(8,8,16,0.75)', 'rgba(40,40,60,0.5)');
    }

    let floatY = y - floatClearance - floatPad;

    if (hasCam) {
      floatY -= camH;
      this.renderFacePreview(renderer, x, floatY);
      floatY -= sectionGap;
      if (hasBands || hasChart || hasWave) {
        ctx.save();
        ctx.strokeStyle = '#1a1a2a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, floatY + sectionGap / 2);
        ctx.lineTo(x + floatW + 20, floatY + sectionGap / 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    if (hasBands) {
      floatY -= barsEstimate;
      this.renderBandPowerBars(renderer, state, x, floatY, floatW + 30);
      floatY -= sectionGap;
    }

    if (hasChart) {
      floatY -= chartH;
      this.renderBandPowerChart(renderer, state.eegBandHistory!, x, floatY, Math.min(floatW + 30, 100), chartH);
      floatY -= 6;
    }

    if (hasWave) {
      if (hasBands || hasChart) {
        ctx.save();
        ctx.strokeStyle = '#1a1a2a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, floatY + 2);
        ctx.lineTo(x + floatW + 20, floatY + 2);
        ctx.stroke();
        ctx.restore();
        floatY -= 4;
      }
      floatY -= waveH;
      this.renderEEGWaveform(renderer, state.eegSamples!, x, floatY, floatW, waveH);
    }
  }

  private renderBpmSparkline(renderer: Renderer, history: number[], x: number, y: number, w: number, h: number): void {
    if (history.length < 2) return;
    const ctx = renderer.context;

    let min = Infinity;
    let max = -Infinity;
    for (const v of history) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
    const range = Math.max(max - min, 4);

    ctx.save();
    ctx.strokeStyle = '#ff4466';
    ctx.lineWidth = 1.2;
    ctx.shadowColor = '#ff4466';
    ctx.shadowBlur = 3;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    for (let i = 0; i < history.length; i++) {
      const px = x + (i / (history.length - 1)) * w;
      const py = y + h - ((history[i] - min) / range) * h;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();

    renderer.hudText(`${Math.round(min)}`, x, y + h + 6, '#883344', 6, 'left');
    renderer.hudText(`${Math.round(max)}`, x + w, y + h + 6, '#883344', 6, 'right');
  }

  private renderFacePreview(renderer: Renderer, x: number, y: number): void {
    if (!this.videoElement) return;
    const ctx = renderer.context;
    const previewW = 64;
    const previewH = 48;

    ctx.save();
    ctx.translate(x + previewW, y);
    ctx.scale(-1, 1);
    ctx.drawImage(this.videoElement, 0, 0, previewW, previewH);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = '#00cccc';
    ctx.lineWidth = 1;
    ctx.shadowColor = '#00cccc';
    ctx.shadowBlur = 4;
    ctx.strokeRect(x, y, previewW, previewH);
    ctx.restore();

    renderer.hudText('CAM', x + 2, y + 2, 'rgba(0,204,204,0.7)', 6, 'left');
  }

  private renderEEGWaveform(renderer: Renderer, samples: number[], x: number, y: number, w: number, h: number): void {
    const ctx = renderer.context;
    if (samples.length < 2) return;

    let min = Infinity;
    let max = -Infinity;
    for (const s of samples) {
      if (s < min) min = s;
      if (s > max) max = s;
    }
    const range = max - min || 1;

    renderer.hudText('EEG', x + 1, y + 1, 'rgba(68,204,255,0.5)', 6, 'left');

    ctx.save();
    ctx.globalAlpha = 0.65;
    ctx.strokeStyle = '#44ccff';
    ctx.lineWidth = 1;
    ctx.shadowColor = '#44ccff';
    ctx.shadowBlur = 4;
    ctx.beginPath();

    const step = w / (samples.length - 1);
    for (let i = 0; i < samples.length; i++) {
      const px = x + i * step;
      const py = y + h - ((samples[i] - min) / range) * h;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Render EEG alpha/beta/theta band power mini-bars
   */
  private renderBandPowerBars(renderer: Renderer, state: HudState, x: number, y: number, maxW: number): number {
    const ctx = renderer.context;
    const barH = 4;
    const barW = Math.min(maxW - 30, 60);
    const bands: Array<{ label: string; value: number; color: string }> = [
      { label: 'δ', value: Math.min(1, state.deltaPower ?? 0), color: '#aa88ff' },
      { label: 'θ', value: Math.min(1, state.thetaPower ?? 0), color: '#88cc44' },
      { label: 'α', value: Math.min(1, state.alphaPower ?? 0), color: '#44ccff' },
      { label: 'β', value: Math.min(1, state.betaPower ?? 0), color: '#ff6644' },
      { label: 'γ', value: Math.min(1, state.gammaPower ?? 0), color: '#ffaa88' },
    ];
    for (let i = 0; i < bands.length; i++) {
      const by = y + i * 9;
      renderer.hudText(bands[i].label, x, by + 2, bands[i].color, 8, 'left');
      renderer.fillRect(x + 12, by, barW, barH, '#101018');
      ctx.save();
      ctx.fillStyle = bands[i].color;
      ctx.fillRect(x + 12, by, barW * bands[i].value, barH);
      ctx.restore();
    }
    let extraY = y + bands.length * 9 + 2;

    if (state.calmnessState) {
      renderer.hudText(state.calmnessState.toUpperCase(), x, extraY, '#00ccff', 8, 'left');
      extraY += 10;
    }
    if (state.alphaPeakFreq != null) {
      renderer.hudText(`αPk ${state.alphaPeakFreq.toFixed(1)}Hz`, x, extraY, '#44ccff', 7, 'left');
      extraY += 10;
    }
    if (state.alphaBumpState && state.alphaBumpState !== 'unknown') {
      renderer.hudText(`α:${state.alphaBumpState}`, x, extraY, '#00ffcc', 7, 'left');
      extraY += 10;
    }
    return extraY - y;
  }

  private renderBandPowerChart(
    renderer: Renderer,
    history: import('../engine/eegProvider').BandPowerSnapshot[],
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    if (history.length < 2) return;
    const ctx = renderer.context;

    ctx.save();
    ctx.fillStyle = 'rgba(8,8,16,0.6)';
    ctx.fillRect(x, y, w, h);

    renderer.hudText('BRAIN WAVES', x + 2, y + 1, '#557799', 6, 'left');

    const chartY = y + 8;
    const chartH = h - 10;
    const bands: Array<{ key: keyof import('../engine/eegProvider').BandPowerSnapshot; color: string }> = [
      { key: 'delta', color: 'rgba(170,136,255,0.7)' },
      { key: 'theta', color: 'rgba(136,204,68,0.7)' },
      { key: 'alpha', color: 'rgba(68,204,255,0.8)' },
      { key: 'beta', color: 'rgba(255,102,68,0.8)' },
      { key: 'gamma', color: 'rgba(255,170,136,0.6)' },
    ];

    for (const band of bands) {
      ctx.beginPath();
      for (let i = 0; i < history.length; i++) {
        const px = x + (i / (history.length - 1)) * w;
        const val = Math.min(1, history[i][band.key]);
        const py = chartY + chartH - val * chartH;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = band.color;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Render weapon mode info in the right section of the neuro panel.
   */
  private renderWeaponModeInfo(renderer: Renderer, state: HudState, x: number, y: number, _maxW: number): void {
    const mode = state.weaponMode ?? 'balanced';
    const calmColor = '#00ccff';
    const arousalColor = '#ff4466';
    const flowColor = '#ffdd44';

    const modeIcon = mode === 'beam' ? '◎' : mode === 'spray' ? '✦' : mode === 'flow' ? '◈' : '•';
    const modeColor =
      mode === 'beam' ? calmColor : mode === 'spray' ? arousalColor : mode === 'flow' ? flowColor : '#aaaaaa';
    const modeName = mode === 'beam' ? 'BEAM' : mode === 'spray' ? 'SPRAY' : mode === 'flow' ? 'FLOW' : 'BALANCED';
    const modeDesc =
      mode === 'beam'
        ? 'Precision — High Damage'
        : mode === 'spray'
          ? 'Rapid — Wide Spread'
          : mode === 'flow'
            ? 'Homing — Damage x2'
            : 'Standard Fire';

    renderer.hudText(`${modeIcon} ${modeName}`, x, y + 6, modeColor, 12, 'left');
    renderer.hudText(modeDesc, x, y + 22, '#8890a0', 9, 'left');

    // Fire rate modifier display
    const shieldCharge = state.shieldCharge ?? 0;
    const overdriveCharge = state.overdriveCharge ?? 0;
    let frLabel = '';
    if (mode === 'beam') frLabel = 'x0.3 rate · x3 dmg';
    else if (mode === 'spray') frLabel = 'x2.5 rate · x0.5 dmg';
    else if (mode === 'flow') frLabel = 'x1 rate · x2 dmg';
    else frLabel = 'x1 rate';
    renderer.hudText(frLabel, x, y + 36, '#5a6070', 8, 'left');

    // Active ability glow labels
    let abilityY = y + 52;
    if (state.shieldActive) {
      const glow = 0.7 + Math.sin(this.time * 6) * 0.3;
      const ctx = renderer.context;
      ctx.save();
      ctx.shadowColor = calmColor;
      ctx.shadowBlur = 12;
      ctx.globalAlpha = glow;
      renderer.hudText('◆ CALM SHIELD', x, abilityY, calmColor, 10, 'left');
      ctx.restore();
      abilityY += 14;
    } else if (shieldCharge > 0.8) {
      renderer.hudText('SHIELD READY', x, abilityY, calmColor, 8, 'left');
      abilityY += 12;
    }

    if (state.overdriveActive) {
      const glow = 0.7 + Math.sin(this.time * 8) * 0.3;
      const ctx = renderer.context;
      ctx.save();
      ctx.shadowColor = arousalColor;
      ctx.shadowBlur = 12;
      ctx.globalAlpha = glow;
      renderer.hudText('◆ OVERDRIVE', x, abilityY, arousalColor, 10, 'left');
      ctx.restore();
    } else if (overdriveCharge > 0.8) {
      renderer.hudText('OVERDRIVE READY', x, abilityY, arousalColor, 8, 'left');
    }
  }

  /**
   * Render meta-progression meters (Noise, Focus, Stillness)
   */
  private static readonly METER_TIPS: Record<string, string> = {
    CALM: 'Mental calmness (0-100%)',
    AROUSAL: 'Mental activation (0-100%)',
    ALPHA: 'Relaxed focus (8-12Hz)',
    BETA: 'Active thinking (12-30Hz)',
    THETA: 'Deep relaxation (4-8Hz)',
    HR: 'Heart rate (BPM)',
  };

  private renderMetaMeters(renderer: Renderer, state: HudState, width: number): void {
    const eegConnected = !!state.eegConnected;

    const meters: Array<{ label: string; value: number; color: string }> = [
      { label: 'CALM', value: state.focus ?? 0, color: '#00ccff' },
      { label: 'AROUSAL', value: state.noise ?? 0, color: '#ff4466' },
    ];
    if (eegConnected) {
      meters.push(
        { label: 'ALPHA', value: state.stillness ?? 0, color: '#44aaff' },
        { label: 'BETA', value: state.betaMeter ?? 0, color: '#ff8844' },
        { label: 'THETA', value: state.thetaMeter ?? 0, color: '#44cc44' },
      );
    }
    const displayBpm = state.displayBpm ?? state.bpm;
    if (state.cameraActive && displayBpm != null) {
      meters.push({ label: 'HR', value: Math.min(200, Math.round(displayBpm)), color: '#ff4466' });
    }

    const meterW = meters.length > 5 ? 50 : 60;
    const meterH = 8;
    const gap = meters.length > 5 ? 6 : 10;
    const totalW = meters.length * meterW + (meters.length - 1) * gap;
    const startX = width / 2 - totalW / 2;
    const y = 75;
    const panelW = totalW + 20;
    const panelH = 46;

    renderer.drawPanel(startX - 10, y - 16, panelW, panelH, 'rgba(10,10,15,0.9)', CONFIG.COLORS.TEXT_DIM, 1, 4);

    const ctx = renderer.context;

    meters.forEach((m, i) => {
      const x = startX + i * (meterW + gap);
      renderer.hudText(m.label, x + meterW / 2, y - 5, m.color, 8, 'center');
      renderer.fillRect(x, y + 3, meterW, meterH, '#101018');

      const fill = (meterW * Math.min(100, m.value)) / 100;
      ctx.save();
      ctx.shadowColor = m.color;
      ctx.shadowBlur = 4;
      ctx.fillStyle = m.color;
      ctx.fillRect(x, y + 3, fill, meterH);
      ctx.restore();

      renderer.strokeRect(x, y + 3, meterW, meterH, m.color, 1);
      renderer.hudText(`${Math.round(m.value)}`, x + meterW / 2, y + 3 + meterH / 2, '#ffffff', 7, 'center');

      const tip = Hud.METER_TIPS[m.label];
      if (tip) {
        this.addTooltipRegion(x, y - 16, meterW, panelH, tip);
      }
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
   * Render [?] info button
   */
  private renderInfoButton(renderer: Renderer, width: number): void {
    const sz = 30;
    const margin = 20;
    const gap = 10;
    const x = width - 40 - margin - gap - 40 - gap - sz;
    const y = 60;

    this.infoButtonBounds = { x, y, width: sz, height: sz };

    renderer.drawRoundRect(x, y, sz, sz, 4, 'rgba(10,10,15,0.9)', CONFIG.COLORS.TEXT_DIM);

    renderer.hudText('?', x + sz / 2, y + sz / 2, CONFIG.COLORS.TEXT_LIGHT, 16, 'center');
    renderer.hudText('INFO', x + sz / 2, y + sz + 8, CONFIG.COLORS.TEXT_DIM, 7, 'center');
  }

  isInfoButtonClicked(mouseX: number, mouseY: number): boolean {
    const { x, y, width, height } = this.infoButtonBounds;
    return mouseX >= x && mouseX <= x + width && mouseY >= y && mouseY <= y + height;
  }

  /**
   * Render [N] neuro settings button
   */
  private renderNeuroButton(renderer: Renderer, width: number): void {
    const sz = 30;
    const margin = 20;
    const gap = 10;
    const x = width - 40 - margin - gap - 40 - gap - sz - gap - sz;
    const y = 60;

    this.neuroButtonBounds = { x, y, width: sz, height: sz };

    const neuroColor = CONFIG.COLORS.NEURAL;
    renderer.drawRoundRect(x, y, sz, sz, 4, 'rgba(10,10,15,0.9)', neuroColor);

    renderer.hudText('◈', x + sz / 2, y + sz / 2, neuroColor, 14, 'center');
    renderer.hudText('NEURO', x + sz / 2, y + sz + 8, CONFIG.COLORS.TEXT_DIM, 7, 'center');
  }

  isNeuroButtonClicked(mouseX: number, mouseY: number): boolean {
    const { x, y, width, height } = this.neuroButtonBounds;
    return mouseX >= x && mouseX <= x + width && mouseY >= y && mouseY <= y + height;
  }

  /**
   * Render neuro metrics strip just above the bottom panel
   */
  private renderNeuroStrip(renderer: Renderer, state: HudState, width: number, height: number): void {
    const stripH = 22;
    const panelH = 95;
    const stripY = height - panelH - stripH - 2;

    const ctx = renderer.context;
    ctx.save();
    ctx.globalAlpha = 0.7;
    renderer.fillRect(0, stripY, width, stripH, 'rgba(8,8,12,0.8)');
    ctx.restore();

    const camActive = state.cameraActive ?? false;
    const eegConn = state.eegConnected ?? false;
    const bothActive = camActive && eegConn;

    const items: Array<{ label: string; value: string; color: string; tip?: string }> = [];

    // Device status dots when both active
    if (bothActive) {
      items.push({ label: 'CAM', value: '●', color: '#ffaa44', tip: 'Webcam active' });
      items.push({ label: 'EEG', value: '●', color: '#44ff88', tip: 'EEG headband' });
    }

    const source = state.neuroSource ?? 'none';
    const calmLabel = source === 'eeg' ? 'CAL(eeg)' : camActive ? 'CAL(cam)' : 'CAL';
    const aroLabel = source === 'eeg' ? 'ARO(eeg)' : camActive ? 'ARO(cam)' : 'ARO';
    items.push({
      label: calmLabel,
      value: `${Math.round(state.calmLevel * 100)}%`,
      color: '#00ccff',
      tip: 'Mental calmness 0-100%',
    });
    items.push({
      label: aroLabel,
      value: `${Math.round(state.arousalLevel * 100)}%`,
      color: '#ff4466',
      tip: 'Mental activation 0-100%',
    });

    const stripBpm = state.displayBpm ?? state.bpm;
    if (stripBpm != null) {
      const hrLabel = camActive && eegConn ? 'HR(cam)' : 'HR';
      items.push({ label: hrLabel, value: `${Math.round(stripBpm)}`, color: '#ff4466', tip: 'Heart rate (BPM)' });
    }

    if (state.hrvRmssd != null && state.hrvRmssd > 0) {
      items.push({
        label: 'HRV',
        value: `${Math.round(state.hrvRmssd)}`,
        color: '#44ddaa',
        tip: 'Heart rate variability (ms)',
      });
    }
    if (state.respirationRate != null && state.respirationRate > 0) {
      items.push({
        label: 'RESP',
        value: `${state.respirationRate.toFixed(1)}`,
        color: '#88aaff',
        tip: 'Breaths per minute',
      });
    }
    if (state.baselineDelta != null) {
      const sign = state.baselineDelta >= 0 ? '+' : '';
      items.push({
        label: 'BL±',
        value: `${sign}${Math.round(state.baselineDelta)}`,
        color: state.baselineDelta > 5 ? '#ff8844' : '#88ff88',
        tip: 'Deviation from baseline BPM',
      });
    }

    items.push({
      label: 'SIG',
      value: `${Math.round((state.signalQuality ?? 0) * 100)}%`,
      color: '#44ff88',
      tip: 'Signal quality',
    });

    if (eegConn && state.alphaPower != null) {
      items.push({
        label: 'α',
        value: `${Math.round((state.alphaPower ?? 0) * 100)}%`,
        color: '#44ccff',
        tip: 'Alpha 8-12Hz — relaxed focus',
      });
      items.push({
        label: 'β',
        value: `${Math.round((state.betaPower ?? 0) * 100)}%`,
        color: '#ff6644',
        tip: 'Beta 12-30Hz — active thinking',
      });
      items.push({
        label: 'θ',
        value: `${Math.round((state.thetaPower ?? 0) * 100)}%`,
        color: '#88cc44',
        tip: 'Theta 4-8Hz — deep relaxation',
      });
      if (state.deltaPower != null) {
        items.push({
          label: 'δ',
          value: `${Math.round(state.deltaPower * 100)}%`,
          color: '#aa88ff',
          tip: 'Delta 0.5-4Hz — deep sleep',
        });
      }
      if (state.gammaPower != null) {
        items.push({
          label: 'γ',
          value: `${Math.round(state.gammaPower * 100)}%`,
          color: '#ffaa88',
          tip: 'Gamma 30-100Hz — high focus',
        });
      }
    }

    if (state.calmnessState) {
      items.push({
        label: '',
        value: state.calmnessState.toUpperCase(),
        color: '#00ccff',
        tip: 'Overall calmness state',
      });
    }

    if (this.alphaBumpTimer > 0) {
      items.push({ label: '', value: 'ALPHA BUMP', color: '#00ffff', tip: '2x score bonus active' });
    }

    const spacing = width / (items.length + 1);
    items.forEach((item, i) => {
      const x = spacing * (i + 1);
      const alpha = item.value === 'ALPHA BUMP' ? 0.5 + Math.sin(this.time * 12) * 0.5 : 1;
      ctx.save();
      ctx.globalAlpha = alpha;
      if (item.label) {
        renderer.hudText(item.label, x - 16, stripY + stripH / 2, '#5a6070', 8, 'right');
      }
      renderer.hudText(item.value, x - 12, stripY + stripH / 2, item.color, 10, 'left');
      ctx.restore();

      if (item.tip) {
        const regionW = spacing * 0.9;
        this.addTooltipRegion(x - regionW / 2, stripY, regionW, stripH, item.tip);
      }
    });
  }

  /**
   * Render waveform oscilloscope and frequency spectrum mini-displays
   */
  private renderWaveforms(renderer: Renderer, state: HudState, width: number, height: number): void {
    const ctx = renderer.context;
    const panelH = 95;
    const panelY = height - panelH;

    // Audio oscilloscope (left edge, inside bottom panel)
    if (state.waveformData) {
      const wvW = 80;
      const wvH = 28;
      const wvX = 14;
      const wvY = panelY + panelH - wvH - 6;

      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = '#00cccc';
      ctx.lineWidth = 1;
      ctx.shadowColor = '#00cccc';
      ctx.shadowBlur = 4;
      ctx.beginPath();

      const data = state.waveformData;
      const step = Math.max(1, Math.floor(data.length / wvW));
      for (let i = 0; i < wvW; i++) {
        const sample = data[i * step] ?? 128;
        const y = wvY + (1 - sample / 255) * wvH;
        if (i === 0) ctx.moveTo(wvX + i, y);
        else ctx.lineTo(wvX + i, y);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Frequency spectrum (right edge, inside bottom panel)
    if (state.frequencyData) {
      const spW = 80;
      const spH = 28;
      const spX = width - spW - 14;
      const spY = panelY + panelH - spH - 6;

      ctx.save();
      ctx.globalAlpha = 0.4;

      const data = state.frequencyData;
      const barCount = 20;
      const barW = spW / barCount;
      const step = Math.max(1, Math.floor(data.length / barCount));

      for (let i = 0; i < barCount; i++) {
        const val = data[i * step] ?? 0;
        const barH = (val / 255) * spH;
        const hue = 180 + (i / barCount) * 120;
        ctx.fillStyle = `hsla(${hue}, 80%, 60%, 0.7)`;
        ctx.fillRect(spX + i * barW, spY + spH - barH, barW - 1, barH);
      }

      ctx.restore();
    }

    // Heart rate ECG trace (near BPM in device status)
    if (state.bpm != null && state.bpm > 0) {
      const trW = 60;
      const trH = 16;
      const trX = 14;
      const trY = panelY + 8;

      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = '#ff4466';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = '#ff4466';
      ctx.shadowBlur = 3;
      ctx.beginPath();

      const bpm = state.bpm;
      const period = 60 / bpm;
      for (let i = 0; i < trW; i++) {
        const t = (i / trW) * period * 2;
        const phase = ((this.time + t) % period) / period;
        let y: number;
        if (phase > 0.35 && phase < 0.45) {
          y = trY + trH / 2 - trH * 0.8 * Math.sin(((phase - 0.35) / 0.1) * Math.PI);
        } else if (phase > 0.45 && phase < 0.55) {
          y = trY + trH / 2 + trH * 0.3 * Math.sin(((phase - 0.45) / 0.1) * Math.PI);
        } else {
          y = trY + trH / 2 + Math.sin(phase * Math.PI * 4) * 1;
        }
        if (i === 0) ctx.moveTo(trX + i, y);
        else ctx.lineTo(trX + i, y);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  /**
   * Reset HUD state
   */
  reset(): void {
    this.scoreDisplay = 0;
    this.lastScore = 0;
    this.scorePulse = 0;
    this.time = 0;
    this.previousWeaponMode = 'balanced';
    this.videoElement = null;
  }
}
