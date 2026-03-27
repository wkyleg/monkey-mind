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

    // Score — same font size as center wave text
    const scoreText = `SCORE: ${Math.floor(this.scoreDisplay).toString().padStart(6, '0')}`;
    renderer.hudText(scoreText, 22, 30, CONFIG.COLORS.PRIMARY, 16, 'left');

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

    // Bottom cockpit panel — consolidated neuro HUD
    this.renderCockpitPanel(renderer, state, width, height);

    // Rule card hint (if present)
    if (state.ruleCardHint) {
      this.renderRuleCardHint(renderer, state.ruleCardHint, width);
    }

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
    // Place below the rule hint pill (y=74, h=30 → bottom ~92) when visible
    const toastY = quoteVisible ? 96 : 64;

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

  private readonly btnSize = 32;
  private readonly btnGap = 6;
  private readonly btnMargin = 8;
  private readonly btnStartY = 100;

  private btnSlotX(width: number): number {
    return width - this.btnSize - this.btnMargin;
  }

  private btnSlotY(slot: number): number {
    return this.btnStartY + slot * (this.btnSize + this.btnGap);
  }

  private renderPauseButton(renderer: Renderer, width: number): void {
    const sz = this.btnSize;
    const x = this.btnSlotX(width);
    const y = this.btnSlotY(0);
    this.pauseButtonBounds = { x, y, width: sz, height: sz };

    const ctx = renderer.context;
    const cx = x + sz / 2;
    const cy = y + sz / 2;

    ctx.save();
    ctx.shadowColor = CONFIG.COLORS.PRIMARY;
    ctx.shadowBlur = 6;
    renderer.drawRoundRect(x, y, sz, sz, 4, 'rgba(10,10,15,0.95)', CONFIG.COLORS.PRIMARY, 1.5);
    ctx.restore();

    const bw = 4;
    const bh = 12;
    const bg = 4;
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx - bw - bg / 2, cy - bh / 2, bw, bh);
    ctx.fillRect(cx + bg / 2, cy - bh / 2, bw, bh);
    ctx.restore();

    renderer.hudText('PAUSE', x - 4, cy, CONFIG.COLORS.TEXT_DIM, 7, 'right');
  }

  /**
   * Check if pause button was clicked
   */
  isPauseButtonClicked(mouseX: number, mouseY: number): boolean {
    const { x, y, width, height } = this.pauseButtonBounds;
    return mouseX >= x && mouseX <= x + width && mouseY >= y && mouseY <= y + height;
  }

  private renderMuteButton(renderer: Renderer, width: number, isMuted: boolean = false): void {
    const sz = this.btnSize;
    const x = this.btnSlotX(width);
    const y = this.btnSlotY(1);
    this.muteButtonBounds = { x, y, width: sz, height: sz };

    const ctx = renderer.context;
    const cx = x + sz / 2;
    const cy = y + sz / 2;
    const btnColor = isMuted ? CONFIG.COLORS.DANGER : CONFIG.COLORS.SECONDARY;

    ctx.save();
    ctx.shadowColor = btnColor;
    ctx.shadowBlur = 6;
    renderer.drawRoundRect(x, y, sz, sz, 4, 'rgba(10,10,15,0.95)', btnColor, 1.5);
    ctx.restore();

    const ix = cx - 2;
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(ix - 4, cy - 2.5);
    ctx.lineTo(ix - 1.5, cy - 2.5);
    ctx.lineTo(ix + 2.5, cy - 5);
    ctx.lineTo(ix + 2.5, cy + 5);
    ctx.lineTo(ix - 1.5, cy + 2.5);
    ctx.lineTo(ix - 4, cy + 2.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    if (isMuted) {
      ctx.save();
      ctx.strokeStyle = CONFIG.COLORS.DANGER;
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(ix + 5, cy - 3);
      ctx.lineTo(ix + 9, cy + 3);
      ctx.moveTo(ix + 9, cy - 3);
      ctx.lineTo(ix + 5, cy + 3);
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.save();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(ix + 4, cy, 3, -Math.PI / 4, Math.PI / 4);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(ix + 4, cy, 6, -Math.PI / 4, Math.PI / 4);
      ctx.stroke();
      ctx.restore();
    }

    const label = isMuted ? 'MUTED' : 'SOUND';
    renderer.hudText(label, x - 4, cy, isMuted ? CONFIG.COLORS.DANGER : CONFIG.COLORS.TEXT_DIM, 7, 'right');
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

    // Health bar — no separate label, bar speaks for itself

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
  // ──────────────────────────────────────────────────────────────────
  //  COCKPIT PANEL v2 — game mechanics on top, neuro data below
  // ──────────────────────────────────────────────────────────────────

  private readonly mechBarH = 22;
  private readonly neuroH = 110;

  private renderCockpitPanel(renderer: Renderer, state: HudState, width: number, height: number): void {
    const ctx = renderer.context;
    const totalH = this.mechBarH + this.neuroH;
    const panelY = height - totalH;

    // ── TOP SUB-BAR: game mechanics (weapon, shield, overdrive) ──
    renderer.drawPanel(0, panelY, width, this.mechBarH, 'rgba(10,10,16,0.96)', CONFIG.COLORS.PRIMARY, 1);
    this.renderMechanicsBar(renderer, state, 0, panelY, width, this.mechBarH);

    // ── MAIN NEURO PANEL ──
    const neuroY = panelY + this.mechBarH;
    renderer.drawPanel(0, neuroY, width, this.neuroH, 'rgba(6,6,10,0.96)', CONFIG.COLORS.PRIMARY, 2);

    // Scan-lines
    ctx.save();
    ctx.globalAlpha = 0.025;
    for (let sy = neuroY; sy < height; sy += 3) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, sy, width, 1);
    }
    ctx.restore();

    const leftW = width * 0.20;
    const rightW = width * 0.25;
    const centerLeft = leftW;
    const centerW = width - leftW - rightW;
    const centerMid = leftW + centerW / 2;

    // LEFT (20 %): cam preview + device status
    this.renderNeuroLeft(renderer, state, 10, neuroY + 4, leftW - 14);

    // Divider
    ctx.save();
    ctx.strokeStyle = 'rgba(0,204,204,0.10)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(leftW, neuroY + 4);
    ctx.lineTo(leftW, height - 4);
    ctx.stroke();
    ctx.restore();

    // CENTER (55 %): EEG viz, band bars, brain ring
    this.renderNeuroCenter(renderer, state, centerLeft + 6, neuroY + 4, centerW - 12, this.neuroH - 8, centerMid);

    // Divider
    ctx.save();
    ctx.strokeStyle = 'rgba(0,204,204,0.10)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(width - rightW, neuroY + 4);
    ctx.lineTo(width - rightW, height - 4);
    ctx.stroke();
    ctx.restore();

    // RIGHT (25 %): BPM, sparkline, HRV, RESP, SIG, calmness, alpha
    this.renderNeuroRight(renderer, state, width - rightW + 6, neuroY + 4, rightW - 12, this.neuroH - 8);
  }

  // ── MECHANICS BAR (weapon mode + shield/overdrive) ──
  private renderMechanicsBar(renderer: Renderer, state: HudState, x: number, y: number, w: number, h: number): void {
    const ctx = renderer.context;
    const cy = y + h / 2;
    const calmColor = '#00ccff';
    const arousalColor = '#ff4466';
    const flowColor = '#ffdd44';

    const mode = state.weaponMode ?? 'balanced';
    const modeIcon = mode === 'beam' ? '◎' : mode === 'spray' ? '✦' : mode === 'flow' ? '◈' : '•';
    const modeColor = mode === 'beam' ? calmColor : mode === 'spray' ? arousalColor : mode === 'flow' ? flowColor : '#aaaaaa';
    const modeName = mode === 'beam' ? 'BEAM' : mode === 'spray' ? 'SPRAY' : mode === 'flow' ? 'FLOW' : 'BALANCED';
    const modeDesc = mode === 'beam' ? 'Precision · x3 dmg' : mode === 'spray' ? 'Rapid · x2.5 rate' : mode === 'flow' ? 'Homing · x2 dmg' : 'Standard';

    renderer.hudText(`${modeIcon} ${modeName}`, x + 12, cy, modeColor, 11, 'left');
    renderer.hudText(modeDesc, x + 90, cy, '#6a6a80', 8, 'left');

    // Shield bar
    const barW = 80;
    const barH = 6;
    const shieldCharge = state.shieldCharge ?? 0;
    const shieldX = w / 2 - barW - 30;
    const shieldLabel = state.shieldActive ? 'SHIELD ON' : 'SHIELD';
    const shieldLblColor = state.shieldActive ? '#ffffff' : calmColor;
    renderer.hudText(shieldLabel, shieldX - 4, cy, shieldLblColor, 8, 'right');
    renderer.fillRect(shieldX, cy - barH / 2, barW, barH, '#101018');
    ctx.save();
    ctx.shadowColor = calmColor;
    ctx.shadowBlur = state.shieldActive ? 10 + Math.sin(this.time * 6) * 4 : shieldCharge > 0.9 ? 8 : 2;
    ctx.fillStyle = state.shieldActive ? '#66eeff' : calmColor;
    ctx.fillRect(shieldX, cy - barH / 2, barW * shieldCharge, barH);
    ctx.restore();
    renderer.strokeRect(shieldX, cy - barH / 2, barW, barH, calmColor, 1);

    // Overdrive bar
    const odCharge = state.overdriveCharge ?? 0;
    const odX = w / 2 + 30;
    const odLabel = state.overdriveActive ? 'OVERDRIVE!' : 'OVERDRIVE';
    const odLblColor = state.overdriveActive ? '#ffffff' : arousalColor;
    renderer.fillRect(odX, cy - barH / 2, barW, barH, '#101018');
    ctx.save();
    ctx.shadowColor = arousalColor;
    ctx.shadowBlur = state.overdriveActive ? 10 + Math.sin(this.time * 8) * 4 : odCharge > 0.9 ? 8 : 2;
    ctx.fillStyle = state.overdriveActive ? '#ff8888' : arousalColor;
    ctx.fillRect(odX, cy - barH / 2, barW * odCharge, barH);
    ctx.restore();
    renderer.strokeRect(odX, cy - barH / 2, barW, barH, arousalColor, 1);
    renderer.hudText(odLabel, odX + barW + 4, cy, odLblColor, 8, 'left');

    // Active ability glow labels at right edge
    let abilX = w - 12;
    if (state.shieldActive) {
      const glow = 0.7 + Math.sin(this.time * 6) * 0.3;
      ctx.save();
      ctx.shadowColor = calmColor;
      ctx.shadowBlur = 8;
      ctx.globalAlpha = glow;
      renderer.hudText('◆ CALM SHIELD', abilX, cy, calmColor, 8, 'right');
      ctx.restore();
      abilX -= 90;
    } else if (shieldCharge > 0.8) {
      renderer.hudText('SHIELD RDY', abilX, cy, calmColor, 7, 'right');
      abilX -= 70;
    }
    if (state.overdriveActive) {
      const glow = 0.7 + Math.sin(this.time * 8) * 0.3;
      ctx.save();
      ctx.shadowColor = arousalColor;
      ctx.shadowBlur = 8;
      ctx.globalAlpha = glow;
      renderer.hudText('◆ OVERDRIVE', abilX, cy, arousalColor, 8, 'right');
      ctx.restore();
    } else if (odCharge > 0.8) {
      renderer.hudText('OVDRV RDY', abilX, cy, arousalColor, 7, 'right');
    }

    // Alpha bump flash
    if (this.alphaBumpTimer > 0) {
      const flash = 0.5 + Math.sin(this.time * 12) * 0.5;
      ctx.save();
      ctx.globalAlpha = flash;
      renderer.hudText('ALPHA BUMP ×2', w / 2, cy, '#00ffff', 9, 'center');
      ctx.restore();
    }
  }

  // ── NEURO LEFT: cam preview + device status ──
  private renderNeuroLeft(renderer: Renderer, state: HudState, x: number, y: number, maxW: number): void {
    const ctx = renderer.context;
    const source = state.neuroSource ?? 'none';
    const eegConn = state.eegConnected ?? false;
    const camActive = state.cameraActive ?? false;
    const calibProg = state.calibrationProgress ?? 0;

    let curY = y;

    // Webcam preview
    const hasCam = camActive && this.videoElement && this.videoElement.readyState >= 2;
    if (hasCam) {
      const pw = Math.min(maxW, 80);
      const ph = Math.round(pw * 0.75);
      ctx.save();
      ctx.translate(x + pw, curY);
      ctx.scale(-1, 1);
      ctx.drawImage(this.videoElement!, 0, 0, pw, ph);
      ctx.restore();
      ctx.save();
      ctx.strokeStyle = '#00cccc';
      ctx.lineWidth = 1;
      ctx.shadowColor = '#00cccc';
      ctx.shadowBlur = 3;
      ctx.strokeRect(x, curY, pw, ph);
      ctx.restore();
      renderer.hudText('CAM', x + 2, curY + 1, 'rgba(0,204,204,0.6)', 6, 'left');
      curY += ph + 3;
    }

    // Device status
    let icon: string;
    let iconColor: string;
    let statusLabel: string;

    if (source === 'eeg') {
      icon = '●'; iconColor = '#44ff88'; statusLabel = 'EEG CONNECTED';
    } else if (source === 'rppg') {
      if (calibProg < 1) {
        icon = '◉'; iconColor = '#ffaa44'; statusLabel = `CAM ${Math.round(calibProg * 100)}%`;
      } else {
        icon = '●'; iconColor = '#ffaa44'; statusLabel = 'WEBCAM ACTIVE';
      }
    } else if (source === 'mock') {
      icon = '◇'; iconColor = '#666688'; statusLabel = 'SIMULATED';
    } else if (eegConn) {
      const dots = '.'.repeat(1 + (Math.floor(this.time * 2) % 3));
      const frames = state.eegFrameCount ?? 0;
      const errors = state.eegDecodeErrors ?? 0;
      const bleNotifs = state.eegBleNotifications ?? 0;
      const bat = state.eegBatteryLevel;
      const batStr = bat != null ? ` [${bat}%]` : '';
      icon = '◉';
      iconColor = errors > 0 ? '#ff6644' : frames > 0 ? '#44ff88' : '#ffaa44';
      if (errors > 0) statusLabel = `EEG err(${errors})`;
      else if (frames > 0) statusLabel = `EEG on${dots}${batStr}`;
      else if (bleNotifs > 0) statusLabel = `EEG dec${dots}`;
      else statusLabel = `EEG wait${dots}`;
    } else if (state.eegReconnecting) {
      const dots = '.'.repeat(1 + (Math.floor(this.time * 2) % 3));
      icon = '◎'; iconColor = '#ffaa44';
      statusLabel = `Recon${dots}(${state.eegReconnectAttempt ?? 0}/5)`;
    } else {
      icon = '✕'; iconColor = '#ff4444'; statusLabel = 'NO DEVICE';
    }

    if ((source === 'rppg' && calibProg < 1) || state.eegReconnecting) {
      const pulse = 0.6 + Math.sin(this.time * 4) * 0.4;
      ctx.save();
      ctx.globalAlpha = pulse;
      renderer.hudText(icon, x, curY + 3, iconColor, 9, 'left');
      ctx.restore();
    } else {
      renderer.hudText(icon, x, curY + 3, iconColor, 9, 'left');
    }
    renderer.hudText(statusLabel, x + 12, curY + 3, iconColor, 9, 'left');
    curY += 13;

    // Secondary device
    if (eegConn && source !== 'eeg') {
      const frames = state.eegFrameCount ?? 0;
      const errors = state.eegDecodeErrors ?? 0;
      if (errors > 0) {
        renderer.hudText(`✕ EEG err:${errors}`, x, curY, '#ff6644', 7, 'left');
      } else if (state.alphaPower != null || frames > 0) {
        renderer.hudText(`● EEG(${frames}f)`, x, curY, '#44ff88', 7, 'left');
      }
      curY += 10;
    }
    if (camActive && source !== 'rppg') {
      renderer.hudText('◌ Cam standby', x, curY, '#555566', 7, 'left');
      curY += 10;
    }

    // Low battery
    if (eegConn && state.eegBatteryLevel != null && state.eegBatteryLevel <= 20) {
      const batColor = state.eegBatteryLevel <= 10 ? '#ff4444' : '#ffaa44';
      const batPulse = state.eegBatteryLevel <= 10 ? 0.6 + Math.sin(this.time * 6) * 0.4 : 1;
      ctx.save();
      ctx.globalAlpha = batPulse;
      renderer.hudText(`⚡${state.eegBatteryLevel}%`, x, curY, batColor, 8, 'left');
      ctx.restore();
      curY += 10;
    }

    // Mini EEG waveform (small, in left column) — only if there's enough room
    if ((eegConn || source === 'eeg') && curY + 22 < y + 100) {
      const waveH = 16;
      const waveW = maxW;
      const waveY = curY + 2;
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 204, 255, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < waveW; i++) {
        const t = this.time * 3 + i * 0.12;
        const v = Math.sin(t) * 0.4 + Math.sin(t * 2.3) * 0.25 + Math.sin(t * 5.7) * 0.15;
        const py = waveY + waveH / 2 + v * (waveH * 0.4);
        if (i === 0) ctx.moveTo(x + i, py);
        else ctx.lineTo(x + i, py);
      }
      ctx.stroke();
      ctx.restore();
      renderer.hudText('RAW', x, waveY - 1, 'rgba(0,204,255,0.4)', 6, 'left');
    }
  }

  // ── NEURO CENTER: EEG viz + band bars + brain ring ──
  private renderNeuroCenter(
    renderer: Renderer,
    state: HudState,
    x: number,
    y: number,
    w: number,
    h: number,
    centerMid: number,
  ): void {
    const calmColor = '#00ccff';
    const arousalColor = '#ff4466';
    const eegConn = state.eegConnected ?? false;
    const camActive = state.cameraActive ?? false;
    const hasBands = eegConn && state.alphaPower != null;
    const hasChart = hasBands && state.eegBandHistory && state.eegBandHistory.length > 2;
    const webcamOnly = !eegConn && camActive;

    if (webcamOnly) {
      // Webcam-only mode: large BPM sparkline + brain ring
      const history = state.bpmHistory;
      if (history && history.length > 2) {
        renderer.hudText('HEART RATE TRACE', x + 2, y + 1, '#883344', 7, 'left');
        this.renderBpmSparkline(renderer, history, x, y + 10, w, h * 0.55);
      }

      const ringY = y + h - 20;
      this.renderBrainRing(renderer, state, centerMid, ringY, 14, calmColor, arousalColor);
      return;
    }

    // Band bars on the left side of center column
    const bandBarW = Math.round(w * 0.28);
    if (hasBands) {
      this.renderBandPowerBars(renderer, state, x, y, bandBarW);
    }

    // Brain waves chart as the hero visualization — takes most of the center
    if (hasChart) {
      const chartX = x + bandBarW + 4;
      const chartW = w - bandBarW - 4;
      const chartH = Math.round(h * 0.7);
      this.renderBandPowerChart(renderer, state.eegBandHistory!, chartX, y, chartW, chartH);
    }

    // Brain ring at bottom
    const ringY = y + h - 20;
    this.renderBrainRing(renderer, state, centerMid, ringY, 14, calmColor, arousalColor);
  }

  private renderBrainRing(
    renderer: Renderer,
    state: HudState,
    cx: number,
    cy: number,
    r: number,
    calmColor: string,
    arousalColor: string,
  ): void {
    const ctx = renderer.context;
    const lw = 3;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = '#181822';
    ctx.lineWidth = lw + 2;
    ctx.stroke();

    const calmAngle = -Math.PI / 2 - Math.PI * state.calmLevel;
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, calmAngle, true);
    ctx.strokeStyle = calmColor;
    ctx.lineWidth = lw;
    ctx.shadowColor = calmColor;
    ctx.shadowBlur = 6;
    ctx.stroke();

    const arousalAngle = -Math.PI / 2 + Math.PI * state.arousalLevel;
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, arousalAngle, false);
    ctx.strokeStyle = arousalColor;
    ctx.shadowColor = arousalColor;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();

    // Brain state label
    let brainLabel = 'BALANCED';
    let brainColor = '#aaaaaa';
    if (state.calmLevel > 0.65) { brainLabel = 'FOCUSED'; brainColor = calmColor; }
    else if (state.arousalLevel > 0.65) { brainLabel = 'ALERT'; brainColor = arousalColor; }
    else if (state.calmLevel > 0.45 && state.arousalLevel < 0.3) { brainLabel = 'RELAXED'; brainColor = '#44ddaa'; }
    renderer.hudText(brainLabel, cx, cy - r - 5, brainColor, 7, 'center');

    renderer.hudText(`C ${Math.round(state.calmLevel * 100)}%`, cx - r - 8, cy, calmColor, 7, 'right');
    renderer.hudText(`A ${Math.round(state.arousalLevel * 100)}%`, cx + r + 8, cy, arousalColor, 7, 'left');

    this.addTooltipRegion(cx - r - 30, cy - r - 8, r * 2 + 60, r * 2 + 16, 'Brain state: Calm (left) vs Arousal (right)');
  }

  // ── NEURO RIGHT: BPM, sparkline, HRV, RESP, BL±, SIG, calmness, alpha ──
  private renderNeuroRight(renderer: Renderer, state: HudState, x: number, y: number, maxW: number, maxH: number): void {
    const ctx = renderer.context;
    const quality = state.signalQuality ?? 0;
    const bottomLimit = y + maxH - 6;
    let curY = y + 4;

    // Heart rate
    const displayBpm = state.displayBpm ?? state.bpm;
    if (displayBpm != null) {
      const beatPhase = Math.sin(this.time * ((displayBpm || 72) / 60) * Math.PI * 2);
      const beatScale = 1 + beatPhase * 0.06;
      ctx.save();
      ctx.translate(x, curY + 2);
      ctx.scale(beatScale, beatScale);
      ctx.translate(-x, -(curY + 2));
      renderer.hudText('♥', x, curY + 2, '#ff4466', 14, 'left');
      ctx.restore();
      renderer.hudText(`${Math.round(displayBpm)}`, x + 16, curY + 2, '#ff4466', 14, 'left');
      renderer.hudText('BPM', x + 44, curY + 2, '#cc3355', 8, 'left');
      this.addTooltipRegion(x, curY - 2, 60, 16, 'Heart rate (beats per minute)');
      curY += 16;

      const history = state.bpmHistory;
      if (history && history.length > 2 && curY + 18 < bottomLimit) {
        this.renderBpmSparkline(renderer, history, x, curY, Math.min(maxW, 90), 14);
        curY += 18;
      }
    } else {
      curY += 4;
    }

    // Continuous metrics — each on its own row
    const metrics: Array<{ label: string; value: string; color: string; tip: string }> = [];

    if (state.hrvRmssd != null && state.hrvRmssd > 0) {
      metrics.push({ label: 'HRV', value: `${Math.round(state.hrvRmssd)}ms`, color: '#44ddaa', tip: 'Heart rate variability (RMSSD)' });
    }
    if (state.respirationRate != null && state.respirationRate > 0) {
      metrics.push({ label: 'RESP', value: `${state.respirationRate.toFixed(1)}/m`, color: '#88aaff', tip: 'Breaths per minute' });
    }
    if (state.baselineDelta != null) {
      const sign = state.baselineDelta >= 0 ? '+' : '';
      metrics.push({
        label: 'BL±',
        value: `${sign}${Math.round(state.baselineDelta)}`,
        color: state.baselineDelta > 5 ? '#ff8844' : '#88ff88',
        tip: 'Deviation from baseline BPM',
      });
    }

    const qualColor = quality > 0.6 ? '#44ff88' : quality > 0.3 ? '#ffaa44' : '#ff4444';
    metrics.push({ label: 'SIG', value: `${Math.round(quality * 100)}%`, color: qualColor, tip: 'Signal quality — higher is better' });

    if (state.calmnessState) {
      metrics.push({ label: 'STATE', value: state.calmnessState.toUpperCase(), color: '#00ccff', tip: 'Overall calmness state' });
    }

    if (state.alphaPeakFreq != null) {
      metrics.push({ label: 'αPk', value: `${state.alphaPeakFreq.toFixed(1)}Hz`, color: '#44ccff', tip: 'Alpha peak frequency (8-12Hz)' });
    }

    if (state.alphaBumpState && state.alphaBumpState !== 'unknown') {
      metrics.push({ label: 'α', value: state.alphaBumpState, color: '#00ffcc', tip: 'Alpha bump detection state' });
    }

    for (const m of metrics) {
      if (curY + 11 > bottomLimit) break;
      renderer.hudText(m.label, x, curY + 1, '#6a7080', 8, 'left');
      renderer.hudText(m.value, x + 30, curY + 1, m.color, 9, 'left');
      this.addTooltipRegion(x, curY - 2, maxW, 11, m.tip);
      curY += 11;
    }
  }

  /**
   * Render device status in the left section of the neuro panel.
   * Shows connection icons, BPM, signal quality, and EEG band powers.
   */

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


  /**
   * Render EEG alpha/beta/theta band power mini-bars
   */
  private renderBandPowerBars(renderer: Renderer, state: HudState, x: number, y: number, maxW: number): number {
    const ctx = renderer.context;
    const barH = 5;
    const rowH = 11;
    const barW = Math.min(maxW - 30, 70);
    const bands: Array<{ label: string; fullName: string; desc: string; value: number; color: string }> = [
      { label: 'δ', fullName: 'Delta', desc: 'Deep sleep & unconscious processing', value: Math.min(1, state.deltaPower ?? 0), color: '#aa88ff' },
      { label: 'θ', fullName: 'Theta', desc: 'Creativity, daydreaming & light meditation', value: Math.min(1, state.thetaPower ?? 0), color: '#88cc44' },
      { label: 'α', fullName: 'Alpha', desc: 'Relaxed awareness & calm focus', value: Math.min(1, state.alphaPower ?? 0), color: '#44ccff' },
      { label: 'β', fullName: 'Beta', desc: 'Active thinking & concentration', value: Math.min(1, state.betaPower ?? 0), color: '#ff6644' },
      { label: 'γ', fullName: 'Gamma', desc: 'Peak attention & information processing', value: Math.min(1, state.gammaPower ?? 0), color: '#ffaa88' },
    ];
    for (let i = 0; i < bands.length; i++) {
      const by = y + i * rowH;
      renderer.hudText(bands[i].label, x, by + 3, bands[i].color, 9, 'left');
      renderer.fillRect(x + 14, by, barW, barH, '#101018');
      ctx.save();
      ctx.fillStyle = bands[i].color;
      ctx.fillRect(x + 14, by, barW * bands[i].value, barH);
      ctx.restore();
      this.addTooltipRegion(x, by - 2, barW + 14, rowH, `${bands[i].fullName} (${Math.round(bands[i].value * 100)}%) — ${bands[i].desc}`);
    }
    let extraY = y + bands.length * rowH + 3;

    if (state.calmnessState) {
      renderer.hudText(state.calmnessState.toUpperCase(), x, extraY, '#00ccff', 9, 'left');
      this.addTooltipRegion(x, extraY - 4, maxW, 12, 'Current brain calmness state');
      extraY += 12;
    }
    if (state.alphaPeakFreq != null) {
      renderer.hudText(`αPk ${state.alphaPeakFreq.toFixed(1)}Hz`, x, extraY, '#44ccff', 8, 'left');
      this.addTooltipRegion(x, extraY - 4, maxW, 11, 'Alpha peak frequency (8–12 Hz)');
      extraY += 11;
    }
    if (state.alphaBumpState && state.alphaBumpState !== 'unknown') {
      renderer.hudText(`α:${state.alphaBumpState}`, x, extraY, '#00ffcc', 8, 'left');
      extraY += 11;
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
    ctx.fillStyle = 'rgba(8,8,16,0.5)';
    ctx.fillRect(x, y, w, h);

    renderer.hudText('BRAIN WAVES', x + 4, y + 2, '#7799bb', 8, 'left');

    const chartY = y + 12;
    const chartH = h - 16;
    const bands: Array<{ key: keyof import('../engine/eegProvider').BandPowerSnapshot; label: string; color: string; solid: string }> = [
      { key: 'delta', label: 'δ', color: 'rgba(170,136,255,0.8)', solid: '#aa88ff' },
      { key: 'theta', label: 'θ', color: 'rgba(136,204,68,0.8)', solid: '#88cc44' },
      { key: 'alpha', label: 'α', color: 'rgba(68,204,255,0.9)', solid: '#44ccff' },
      { key: 'beta', label: 'β', color: 'rgba(255,102,68,0.9)', solid: '#ff6644' },
      { key: 'gamma', label: 'γ', color: 'rgba(255,170,136,0.7)', solid: '#ffaa88' },
    ];

    // Subtle grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let g = 0.25; g < 1; g += 0.25) {
      const gy = chartY + chartH - g * chartH;
      ctx.beginPath();
      ctx.moveTo(x, gy);
      ctx.lineTo(x + w, gy);
      ctx.stroke();
    }

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
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Inline legend at top-right of chart
    let legendX = x + w - 4;
    for (let i = bands.length - 1; i >= 0; i--) {
      const lbl = bands[i].label;
      legendX -= 14;
      renderer.hudText(lbl, legendX, y + 2, bands[i].solid, 8, 'left');
    }

    ctx.restore();
  }



  /**
   * Render level lore/insight hint at top of screen - informative flavor text
   */
  private renderRuleCardHint(renderer: Renderer, hint: string, width: number): void {
    const y = 74;

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

  private renderInfoButton(renderer: Renderer, width: number): void {
    const sz = this.btnSize;
    const x = this.btnSlotX(width);
    const y = this.btnSlotY(2);
    this.infoButtonBounds = { x, y, width: sz, height: sz };

    renderer.drawRoundRect(x, y, sz, sz, 4, 'rgba(10,10,15,0.9)', CONFIG.COLORS.TEXT_DIM, 1.5);
    renderer.hudText('?', x + sz / 2, y + sz / 2, CONFIG.COLORS.TEXT_LIGHT, 13, 'center');
    renderer.hudText('INFO', x - 4, y + sz / 2, CONFIG.COLORS.TEXT_DIM, 7, 'right');
  }

  isInfoButtonClicked(mouseX: number, mouseY: number): boolean {
    const { x, y, width, height } = this.infoButtonBounds;
    return mouseX >= x && mouseX <= x + width && mouseY >= y && mouseY <= y + height;
  }

  private renderNeuroButton(renderer: Renderer, width: number): void {
    const sz = this.btnSize;
    const x = this.btnSlotX(width);
    const y = this.btnSlotY(3);
    this.neuroButtonBounds = { x, y, width: sz, height: sz };

    const neuroColor = CONFIG.COLORS.NEURAL;
    renderer.drawRoundRect(x, y, sz, sz, 4, 'rgba(10,10,15,0.9)', neuroColor, 1.5);
    renderer.hudText('◈', x + sz / 2, y + sz / 2, neuroColor, 12, 'center');
    renderer.hudText('NEURO', x - 4, y + sz / 2, CONFIG.COLORS.TEXT_DIM, 7, 'right');
  }

  isNeuroButtonClicked(mouseX: number, mouseY: number): boolean {
    const { x, y, width, height } = this.neuroButtonBounds;
    return mouseX >= x && mouseX <= x + width && mouseY >= y && mouseY <= y + height;
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
