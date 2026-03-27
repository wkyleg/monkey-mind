import { CONFIG } from '../config';
import type { PlayerIntent } from '../engine/input';
import type { Renderer } from '../engine/renderer';
import { Scene } from '../engine/scene';

interface GateOption {
  id: string;
  label: string;
  description: string;
  icon: string;
  action: () => void;
}

export class DeviceGateScene extends Scene {
  override readonly isOverlay: boolean = true;

  private options: GateOption[] = [];
  private selectedIndex = 0;
  private time = 0;
  private inputCooldown = 0;
  private statusText = '';
  private statusColor: string = CONFIG.COLORS.TEXT_DIM;
  private connecting = false;
  private lastMoveDir = 0;
  private cameraConnected = false;
  private headbandConnected = false;

  enter(): void {
    this.selectedIndex = 0;
    this.time = 0;
    this.inputCooldown = 0.3;
    this.statusText = '';
    this.connecting = false;
    this.lastMoveDir = 0;
    this.cameraConnected = false;
    this.headbandConnected = false;
    this.buildOptions();
  }

  exit(): void {}

  private buildOptions(): void {
    const nm = this.game.getNeuroManager();

    this.options = [
      {
        id: 'webcam',
        label: this.cameraConnected ? '✓ WEBCAM CONNECTED' : 'CONNECT WEBCAM',
        description: this.cameraConnected
          ? 'Camera active — heart rate being tracked'
          : 'Heart rate via camera — works with any webcam',
        icon: this.cameraConnected ? '●' : '◉',
        action: async () => {
          if (this.connecting || this.cameraConnected) return;
          this.connecting = true;
          this.statusText = 'Requesting camera access...';
          this.statusColor = CONFIG.COLORS.PRIMARY;

          const success = await nm.enableCamera();
          this.connecting = false;

          if (success) {
            this.cameraConnected = true;
            this.statusText = 'Camera active! Connect another device or continue.';
            this.statusColor = CONFIG.COLORS.SUCCESS;
            this.buildOptions();
          } else {
            this.statusText = nm.getCameraErrorMessage();
            this.statusColor = CONFIG.COLORS.DANGER;
          }
        },
      },
      {
        id: 'headband',
        label: this.headbandConnected ? '✓ EEG HEADBAND CONNECTED' : 'CONNECT EEG HEADBAND',
        description: this.headbandConnected
          ? 'Headband active — brain signals streaming'
          : 'Full brain sensing — requires Muse headband + Chrome',
        icon: this.headbandConnected ? '●' : '◈',
        action: async () => {
          if (this.connecting || this.headbandConnected) return;

          if (!nm.isWasmReady()) {
            this.statusText = 'EEG processing not available — try refreshing';
            this.statusColor = CONFIG.COLORS.DANGER;
            return;
          }

          this.connecting = true;
          this.statusText = 'Scanning for headband...';
          this.statusColor = CONFIG.COLORS.PRIMARY;

          const success = await nm.connectHeadband();
          this.connecting = false;

          if (success) {
            this.headbandConnected = true;
            this.statusText = 'Headband connected! Connect another device or continue.';
            this.statusColor = CONFIG.COLORS.SUCCESS;
            this.buildOptions();
          } else {
            this.statusText = nm.getHeadbandErrorMessage();
            this.statusColor = CONFIG.COLORS.DANGER;
          }
        },
      },
      {
        id: 'continue',
        label: this.cameraConnected || this.headbandConnected ? 'CONTINUE TO GAME' : 'PLAY WITHOUT NEURO',
        description:
          this.cameraConnected || this.headbandConnected
            ? 'Start playing with connected devices'
            : 'Skip brain features — standard arcade mode',
        icon: '▷',
        action: () => {
          if (!this.cameraConnected && !this.headbandConnected) {
            nm.disableMock();
          }
          this.dismiss();
        },
      },
    ];
  }

  private dismiss(): void {
    this.game.getScenes().pop();
  }

  update(dt: number, intent: PlayerIntent): void {
    this.time += dt;

    if (this.inputCooldown > 0) {
      this.inputCooldown -= dt;
      return;
    }

    if (this.connecting) return;

    if (intent.cancel) {
      this.dismiss();
      return;
    }

    const moveDir = intent.menuAxis < -0.5 ? -1 : intent.menuAxis > 0.5 ? 1 : 0;
    const justStarted = moveDir !== 0 && this.lastMoveDir === 0;
    const canRepeat = moveDir !== 0 && this.inputCooldown <= 0;

    if (justStarted || canRepeat) {
      if (moveDir < 0) {
        this.selectedIndex = (this.selectedIndex - 1 + this.options.length) % this.options.length;
      } else {
        this.selectedIndex = (this.selectedIndex + 1) % this.options.length;
      }
      this.inputCooldown = 0.15;
    }

    this.lastMoveDir = moveDir;

    if (intent.confirm && this.inputCooldown <= 0) {
      this.options[this.selectedIndex].action();
      this.inputCooldown = 0.3;
    }
  }

  render(renderer: Renderer, _alpha: number): void {
    const { width, height } = renderer;
    const ctx = renderer.context;

    renderer.save();
    renderer.setAlpha(0.85);
    renderer.fillRect(0, 0, width, height, '#000000');
    renderer.restore();

    renderer.radialGradientBackground(['rgba(8,8,16,0.9)', 'rgba(12,14,30,0.9)'], width / 2, height * 0.35);

    renderer.drawScanLines(0.02, 3);

    const titleY = height * 0.15;
    renderer.glowText('NEURO SETUP', width / 2, titleY, CONFIG.COLORS.ACCENT, 36, 'center', 15);
    renderer.text(
      'Connect a device for the full neuro experience',
      width / 2,
      titleY + 40,
      CONFIG.COLORS.TEXT_LIGHT,
      16,
      'center',
    );

    const startY = height * 0.32;
    const spacing = 70;

    for (let i = 0; i < this.options.length; i++) {
      const opt = this.options[i];
      const y = startY + i * spacing;
      const isSelected = i === this.selectedIndex;

      if (isSelected) {
        renderer.drawPanel(width * 0.15, y - 25, width * 0.7, 50, 'rgba(0,204,204,0.06)', CONFIG.COLORS.PRIMARY, 1, 4);
        // Terminal cursor instead of glowCircle
        ctx.save();
        ctx.fillStyle = CONFIG.COLORS.PRIMARY;
        ctx.shadowColor = CONFIG.COLORS.PRIMARY;
        ctx.shadowBlur = 4;
        const cursorAlpha = 0.5 + Math.sin(this.time * 3) * 0.5;
        ctx.globalAlpha = cursorAlpha;
        ctx.fillRect(width * 0.17, y - 8, 3, 16);
        ctx.restore();
      }

      const isConnected =
        (opt.id === 'webcam' && this.cameraConnected) || (opt.id === 'headband' && this.headbandConnected);
      const iconColor = isConnected
        ? CONFIG.COLORS.SUCCESS
        : isSelected
          ? CONFIG.COLORS.PRIMARY
          : CONFIG.COLORS.TEXT_DIM;
      renderer.text(opt.icon, width * 0.2, y, iconColor, 22, 'center', 'middle');

      const labelColor = isConnected ? CONFIG.COLORS.SUCCESS : isSelected ? CONFIG.COLORS.PRIMARY : CONFIG.COLORS.TEXT;
      renderer.text(opt.label, width * 0.25, y - 8, labelColor, isSelected ? 20 : 18, 'left', 'middle');

      renderer.text(opt.description, width * 0.25, y + 12, CONFIG.COLORS.TEXT_DIM, 12, 'left', 'middle');
    }

    if (this.statusText) {
      const statusY = startY + this.options.length * spacing + 20;
      if (this.connecting) {
        const dots = '.'.repeat(1 + (Math.floor(this.time * 3) % 3));
        renderer.text(this.statusText + dots, width / 2, statusY, this.statusColor, 16, 'center', 'middle');
      } else {
        renderer.text(this.statusText, width / 2, statusY, this.statusColor, 16, 'center', 'middle');
      }
    }

    const infoY = height * 0.76;
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
      'Firefox / Safari: Not supported — please use Chrome or Edge',
      width / 2,
      infoY + lineH * 4,
      CONFIG.COLORS.TEXT_DIM,
      9,
      'center',
    );
    renderer.text(
      'Ensure system Bluetooth is ON and headband powered on before connecting',
      width / 2,
      infoY + lineH * 5,
      CONFIG.COLORS.TEXT_DIM,
      9,
      'center',
    );
    ctx.restore();

    renderer.text(
      '↑ ↓ SELECT   SPACE CONFIRM   ESC SKIP',
      width / 2,
      height - 15,
      CONFIG.COLORS.TEXT_DIM,
      11,
      'center',
    );
  }
}
