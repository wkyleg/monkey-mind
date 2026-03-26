import { CONFIG, DEV_MODE } from '../config';
import type { Game } from '../engine/game';
import type { PlayerIntent } from '../engine/input';
import type { Renderer } from '../engine/renderer';
import { Scene } from '../engine/scene';

interface NeuroMenuItem {
  id: string;
  label: string;
  type: 'button' | 'toggle' | 'info';
  action?: () => void;
  getStatus?: () => string;
  getStatusColor?: () => string;
  getButtonLabel?: () => string;
  getValue?: () => boolean;
}

export class NeuroSettingsScene extends Scene {
  override readonly isOverlay: boolean = true;

  private menuItems: NeuroMenuItem[] = [];
  private selectedIndex = 0;
  private time = 0;
  private inputCooldown = 0;
  private lastMoveDir = 0;
  private notification = '';
  private notificationTimer = 0;
  private notificationColor: string = CONFIG.COLORS.PRIMARY;
  private connecting = false;

  constructor(game: Game) {
    super(game);
  }

  private buildMenu(): void {
    const nm = this.game.getNeuroManager();

    this.menuItems = [
      {
        id: 'headband',
        label: 'EEG HEADBAND',
        type: 'button',
        action: async () => {
          if (this.connecting) return;

          if (!nm.isWasmReady()) {
            this.showNotification('EEG processing not available — try refreshing', CONFIG.COLORS.DANGER);
            return;
          }

          this.connecting = true;
          this.showNotification('Scanning for headband...', CONFIG.COLORS.PRIMARY);
          const success = await nm.connectHeadband();
          this.connecting = false;

          if (success) {
            this.showNotification('Headband connected!', CONFIG.COLORS.SUCCESS);
          } else {
            this.showNotification(nm.getHeadbandErrorMessage(), CONFIG.COLORS.DANGER);
          }
        },
        getStatus: () => (nm.getState().eegConnected ? 'CONNECTED' : 'NOT CONNECTED'),
        getStatusColor: () => (nm.getState().eegConnected ? CONFIG.COLORS.SUCCESS : CONFIG.COLORS.TEXT_DIM),
        getButtonLabel: () => (nm.getState().eegConnected ? 'CONNECTED' : 'CONNECT'),
      },
      {
        id: 'camera',
        label: 'WEBCAM (HEART RATE)',
        type: 'button',
        action: async () => {
          if (this.connecting) return;

          const state = nm.getState();
          if (state.cameraActive) {
            nm.disableCamera();
            this.showNotification('Camera disconnected', CONFIG.COLORS.TEXT_LIGHT);
            return;
          }

          this.connecting = true;
          this.showNotification('Requesting camera access...', CONFIG.COLORS.PRIMARY);
          const success = await nm.enableCamera();
          this.connecting = false;

          if (success) {
            this.showNotification('Camera active!', CONFIG.COLORS.SUCCESS);
          } else {
            this.showNotification(nm.getCameraErrorMessage(), CONFIG.COLORS.DANGER);
          }
        },
        getStatus: () => {
          const state = nm.getState();
          if (!state.cameraActive) return 'DISABLED';
          if (state.bpm !== null) return `ACTIVE — ${Math.round(state.bpm)} BPM`;
          const progress = nm.getRppgProvider().getState().calibrationProgress;
          const pct = Math.round(progress * 100);
          return `CALIBRATING ${pct}% — hold still`;
        },
        getStatusColor: () => (nm.getState().cameraActive ? CONFIG.COLORS.SUCCESS : CONFIG.COLORS.TEXT_DIM),
        getButtonLabel: () => (nm.getState().cameraActive ? 'DISCONNECT' : 'CONNECT'),
      },
      ...(DEV_MODE
        ? [
            {
              id: 'mock',
              label: 'SIMULATED SIGNALS (DEV)',
              type: 'toggle' as const,
              getValue: () => nm.isMockEnabled(),
              action: () => {
                if (nm.isMockEnabled()) {
                  nm.disableMock();
                } else {
                  nm.enableMock();
                }
              },
            },
          ]
        : []),
    ];
  }

  enter(): void {
    this.buildMenu();
    this.selectedIndex = 0;
    this.time = 0;
    this.inputCooldown = 0.2;
    this.lastMoveDir = 0;
    this.connecting = false;
  }

  exit(): void {}

  private showNotification(msg: string, color: string = CONFIG.COLORS.PRIMARY): void {
    this.notification = msg;
    this.notificationTimer = 4;
    this.notificationColor = color;
  }

  update(dt: number, intent: PlayerIntent): void {
    this.time += dt;

    if (this.notificationTimer > 0) {
      this.notificationTimer -= dt;
    }

    if (this.inputCooldown > 0) {
      this.inputCooldown -= dt;
      return;
    }

    if (this.connecting) return;

    if (intent.cancel) {
      this.game.getScenes().pop();
      return;
    }

    const moveDir = intent.menuAxis < -0.5 ? -1 : intent.menuAxis > 0.5 ? 1 : 0;
    const justStarted = moveDir !== 0 && this.lastMoveDir === 0;
    const canRepeat = moveDir !== 0 && this.inputCooldown <= 0;

    if (justStarted || canRepeat) {
      if (moveDir < 0) {
        this.selectedIndex = (this.selectedIndex - 1 + this.menuItems.length) % this.menuItems.length;
      } else {
        this.selectedIndex = (this.selectedIndex + 1) % this.menuItems.length;
      }
      this.inputCooldown = 0.15;
    }

    this.lastMoveDir = moveDir;

    if (intent.confirm) {
      const item = this.menuItems[this.selectedIndex];
      item.action?.();
      this.inputCooldown = 0.3;
    }
  }

  render(renderer: Renderer, _alpha: number): void {
    const { width, height } = renderer;
    const ctx = renderer.context;

    ctx.globalAlpha = 1;
    renderer.fillRect(0, 0, width, height, '#000000');

    renderer.radialGradientBackground(['#0a0a14', '#0d0d1a'], width / 2, height / 2);

    renderer.drawScanLines(0.02, 3);

    renderer.glowText('NEURO SETTINGS', width / 2, height * 0.08, CONFIG.COLORS.ACCENT, 36, 'center', 15);

    const nm = this.game.getNeuroManager();
    const neuro = nm.getState();

    const startY = height * 0.18;
    const spacing = 55;

    for (let i = 0; i < this.menuItems.length; i++) {
      const item = this.menuItems[i];
      const y = startY + i * spacing;
      const isSelected = i === this.selectedIndex;
      const labelColor = isSelected ? CONFIG.COLORS.PRIMARY : CONFIG.COLORS.TEXT;

      if (isSelected) {
        const cursorAlpha = 0.5 + Math.sin(this.time * 3) * 0.5;
        ctx.save();
        ctx.globalAlpha = cursorAlpha;
        ctx.fillStyle = CONFIG.COLORS.PRIMARY;
        ctx.shadowColor = CONFIG.COLORS.PRIMARY;
        ctx.shadowBlur = 4;
        ctx.fillRect(width * 0.12, y - 8, 3, 16);
        ctx.restore();
      }

      if (item.type === 'button') {
        renderer.text(item.label, width * 0.15, y, labelColor, isSelected ? 20 : 18, 'left', 'middle');

        const status = item.getStatus?.() ?? '';
        const statusColor = item.getStatusColor?.() ?? CONFIG.COLORS.TEXT_DIM;
        renderer.text(status, width * 0.55, y, statusColor, 16, 'left', 'middle');

        if (isSelected) {
          const btnLabel = item.getButtonLabel?.() ?? 'CONNECT';
          const btnColor = btnLabel === 'DISCONNECT' ? CONFIG.COLORS.DANGER : CONFIG.COLORS.PRIMARY;
          const btnBg = btnLabel === 'DISCONNECT' ? 'rgba(255,34,34,0.12)' : 'rgba(0,204,204,0.15)';
          renderer.drawPanel(width * 0.78, y - 14, 90, 28, btnBg, btnColor, 1);
          renderer.text(btnLabel, width * 0.78 + 45, y, btnColor, 13, 'center', 'middle');
        }
      } else if (item.type === 'toggle') {
        renderer.text(item.label, width * 0.15, y, labelColor, isSelected ? 20 : 18, 'left', 'middle');

        const on = item.getValue?.() ?? false;
        const toggleColor = on ? CONFIG.COLORS.SUCCESS : CONFIG.COLORS.DANGER;
        renderer.glowText(on ? 'ON' : 'OFF', width * 0.6, y, toggleColor, 18, 'left', isSelected ? 10 : 0);
      } else if (item.type === 'info') {
        renderer.text(item.label, width * 0.15, y, labelColor, isSelected ? 20 : 18, 'left', 'middle');
      }
    }

    // Signal preview panel — compute height dynamically
    const previewY = startY + this.menuItems.length * spacing + 10;
    let panelH = 145; // base: source row + calm + arousal + HR
    if (neuro.eegConnected && neuro.alphaPower !== null) {
      panelH += 30; // band bars
      if (neuro.calmnessState) panelH += 18;
      if (neuro.alphaPeakFreq != null) panelH += 18;
      if (neuro.hrvRmssd != null || neuro.respirationRate != null) panelH += 22;
    } else if (neuro.eegConnected) {
      panelH += 22;
    }
    panelH += 20; // bottom padding
    renderer.drawPanel(width * 0.1, previewY, width * 0.8, panelH, 'rgba(8,8,12,0.85)', CONFIG.COLORS.PRIMARY, 1);

    const panelLeft = width * 0.15;
    const barLeft = panelLeft + 80;
    const barWidth = width * 0.52;

    // Row 1: Source + quality
    const row1Y = previewY + 25;
    const sourceLabel =
      neuro.source === 'eeg'
        ? 'EEG HEADBAND'
        : neuro.source === 'rppg'
          ? 'WEBCAM'
          : neuro.source === 'mock'
            ? 'SIMULATION'
            : 'NO SOURCE';
    const sourceColor =
      neuro.source === 'eeg'
        ? CONFIG.COLORS.SUCCESS
        : neuro.source === 'rppg'
          ? '#ffaa44'
          : neuro.source === 'mock'
            ? CONFIG.COLORS.TEXT_DIM
            : CONFIG.COLORS.DANGER;
    renderer.text(`SOURCE: ${sourceLabel}`, panelLeft, row1Y, sourceColor, 14, 'left', 'middle');

    const qualityBarX = panelLeft + 220;
    const qualityBarW = 100;
    renderer.fillRect(qualityBarX, row1Y - 6, qualityBarW, 12, 'rgba(255,255,255,0.1)');
    renderer.fillRect(qualityBarX, row1Y - 6, qualityBarW * neuro.signalQuality, 12, sourceColor);
    renderer.text(
      `${Math.round(neuro.signalQuality * 100)}%`,
      qualityBarX + qualityBarW + 10,
      row1Y,
      CONFIG.COLORS.TEXT_DIM,
      12,
      'left',
      'middle',
    );

    // Row 2: Calm bar (full width)
    const row2Y = previewY + 58;
    renderer.text('CALM', panelLeft, row2Y, '#44aaff', 14, 'left', 'middle');
    renderer.fillRect(barLeft, row2Y - 7, barWidth, 14, 'rgba(68,170,255,0.15)');
    ctx.save();
    ctx.shadowColor = '#44aaff';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#44aaff';
    ctx.fillRect(barLeft, row2Y - 7, barWidth * neuro.calm, 14);
    ctx.restore();
    renderer.text(`${Math.round(neuro.calm * 100)}%`, barLeft + barWidth + 12, row2Y, '#44aaff', 13, 'left', 'middle');

    // Row 3: Arousal bar (full width)
    const row3Y = previewY + 88;
    renderer.text('AROUSAL', panelLeft, row3Y, '#ff6644', 14, 'left', 'middle');
    renderer.fillRect(barLeft, row3Y - 7, barWidth, 14, 'rgba(255,102,68,0.15)');
    ctx.save();
    ctx.shadowColor = '#ff6644';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#ff6644';
    ctx.fillRect(barLeft, row3Y - 7, barWidth * neuro.arousal, 14);
    ctx.restore();
    renderer.text(
      `${Math.round(neuro.arousal * 100)}%`,
      barLeft + barWidth + 12,
      row3Y,
      '#ff6644',
      13,
      'left',
      'middle',
    );

    // Row 4: Heart rate
    const row4Y = previewY + 122;
    if (neuro.bpm !== null) {
      const beatPulse = 1 + Math.sin(this.time * (neuro.bpm / 60) * Math.PI * 2) * 0.1;
      ctx.save();
      ctx.translate(panelLeft + 10, row4Y);
      ctx.scale(beatPulse, beatPulse);
      ctx.translate(-(panelLeft + 10), -row4Y);
      renderer.text('♥', panelLeft + 10, row4Y, '#ff4466', 20, 'center', 'middle');
      ctx.restore();
      renderer.text(`${Math.round(neuro.bpm)} BPM`, panelLeft + 30, row4Y, '#ff4466', 18, 'left', 'middle');

      const qualityLabel = neuro.bpmQuality > 0.7 ? 'STRONG' : neuro.bpmQuality > 0.4 ? 'FAIR' : 'WEAK';
      const qualityColor =
        neuro.bpmQuality > 0.7 ? CONFIG.COLORS.SUCCESS : neuro.bpmQuality > 0.4 ? '#ffaa44' : CONFIG.COLORS.DANGER;
      renderer.text(qualityLabel, panelLeft + 130, row4Y, qualityColor, 14, 'left', 'middle');
    } else {
      renderer.text('♥ — BPM', panelLeft + 10, row4Y, CONFIG.COLORS.TEXT_DIM, 18, 'left', 'middle');
      renderer.text(
        neuro.cameraActive ? 'CALIBRATING...' : 'NO CAMERA',
        panelLeft + 130,
        row4Y,
        CONFIG.COLORS.TEXT_DIM,
        14,
        'left',
        'middle',
      );
    }

    // Row 5: Band powers (when EEG connected, regardless of source)
    if (neuro.eegConnected && neuro.alphaPower !== null) {
      const row5Y = row4Y + 38;
      const bands = [
        { label: 'α', value: neuro.alphaPower, color: '#44aaff' },
        { label: 'β', value: neuro.betaPower, color: '#ff6644' },
        { label: 'θ', value: neuro.thetaPower, color: '#aa44ff' },
        { label: 'δ', value: neuro.deltaPower, color: '#aa88ff' },
        { label: 'γ', value: neuro.gammaPower, color: '#ffaa88' },
      ];
      const bandBarW = 60;
      bands.forEach((band, idx) => {
        const bx = panelLeft + idx * (bandBarW + 20);
        renderer.text(band.label, bx, row5Y, band.color, 14, 'left', 'middle');
        renderer.fillRect(bx + 16, row5Y - 5, bandBarW, 10, 'rgba(255,255,255,0.1)');
        const v = band.value !== null ? Math.min(1, band.value) : 0;
        renderer.fillRect(bx + 16, row5Y - 5, bandBarW * v, 10, band.color);
      });

      // Row 6: Additional EEG metrics
      let row6Y = row5Y + 28;
      if (neuro.calmnessState) {
        renderer.text(`State: ${neuro.calmnessState.toUpperCase()}`, panelLeft, row6Y, '#00ccff', 12, 'left', 'middle');
        row6Y += 18;
      }
      if (neuro.alphaPeakFreq != null) {
        renderer.text(
          `Alpha Peak: ${neuro.alphaPeakFreq.toFixed(1)} Hz`,
          panelLeft,
          row6Y,
          '#44ccff',
          12,
          'left',
          'middle',
        );
        row6Y += 18;
      }
      if (neuro.hrvRmssd != null) {
        renderer.text(
          `HRV (RMSSD): ${neuro.hrvRmssd.toFixed(1)} ms`,
          panelLeft + 220,
          row5Y + 28,
          '#88cc44',
          12,
          'left',
          'middle',
        );
      }
      if (neuro.respirationRate != null) {
        renderer.text(
          `Resp: ${neuro.respirationRate.toFixed(1)} br/min`,
          panelLeft + 220,
          row5Y + 46,
          '#88cc44',
          12,
          'left',
          'middle',
        );
      }
    } else if (neuro.eegConnected) {
      const row5Y = row4Y + 38;
      renderer.text(
        'EEG connected — waiting for data...',
        panelLeft,
        row5Y,
        CONFIG.COLORS.TEXT_DIM,
        12,
        'left',
        'middle',
      );
    }

    // Compatibility info — positioned below the preview panel
    const infoY = previewY + panelH + 16;
    ctx.save();
    ctx.globalAlpha = 0.45;
    const lineH = 14;
    renderer.text(
      'WEBCAM: Any browser with camera access — hold face still in good lighting',
      width / 2,
      infoY,
      CONFIG.COLORS.TEXT_DIM,
      10,
      'center',
    );
    renderer.text(
      'EEG: Requires Web Bluetooth — supported on Chrome, Edge, Opera, and Brave',
      width / 2,
      infoY + lineH,
      CONFIG.COLORS.TEXT_DIM,
      10,
      'center',
    );
    ctx.globalAlpha = 0.55;
    renderer.text(
      'Chrome / Edge: chrome://flags/#enable-web-bluetooth → Enabled → relaunch',
      width / 2,
      infoY + lineH * 2,
      '#44ccff',
      9,
      'center',
    );
    renderer.text(
      'Brave: brave://flags/#enable-web-bluetooth → Enabled → relaunch',
      width / 2,
      infoY + lineH * 3,
      '#44ccff',
      9,
      'center',
    );
    ctx.globalAlpha = 0.4;
    renderer.text(
      'Firefox / Safari: Web Bluetooth not supported — please use Chrome or Edge',
      width / 2,
      infoY + lineH * 4,
      CONFIG.COLORS.TEXT_DIM,
      9,
      'center',
    );
    renderer.text(
      'Ensure system Bluetooth is ON and headband is powered on before connecting',
      width / 2,
      infoY + lineH * 5,
      CONFIG.COLORS.TEXT_DIM,
      9,
      'center',
    );
    ctx.restore();

    // Notification toast — below instructions
    if (this.notificationTimer > 0) {
      const toastAlpha = Math.min(1, this.notificationTimer);
      ctx.save();
      ctx.globalAlpha = toastAlpha;
      const toastY = infoY + lineH * 6 + 8;
      const toastBg = this.notificationColor === CONFIG.COLORS.DANGER ? 'rgba(255,34,34,0.15)' : 'rgba(0,204,204,0.2)';
      renderer.drawPanel(width * 0.2, toastY, width * 0.6, 36, toastBg, this.notificationColor, 1, 4);

      if (this.connecting) {
        const dots = '.'.repeat(1 + (Math.floor(this.time * 3) % 3));
        renderer.text(this.notification + dots, width / 2, toastY + 18, this.notificationColor, 15, 'center', 'middle');
      } else {
        renderer.text(this.notification, width / 2, toastY + 18, this.notificationColor, 15, 'center', 'middle');
      }
      ctx.restore();
    }

    renderer.text(
      '↑ ↓ SELECT   SPACE CONFIRM   ESC BACK',
      width / 2,
      height - 12,
      CONFIG.COLORS.TEXT_DIM,
      12,
      'center',
    );
  }
}
