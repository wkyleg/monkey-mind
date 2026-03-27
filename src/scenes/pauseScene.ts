/**
 * Pause overlay scene
 */

import { CONFIG } from '../config';
import { contentLoader } from '../content/loader';
import { events } from '../core/events';
import type { Game } from '../engine/game';
import type { PlayerIntent } from '../engine/input';
import type { Renderer } from '../engine/renderer';
import { Scene } from '../engine/scene';

// pause overlay — styled to match loading/menu screens

interface MenuItem {
  id: string;
  label: string;
  action: () => void;
}

export class PauseScene extends Scene {
  // Mark as overlay - renders on top of the game scene
  override readonly isOverlay: boolean = true;

  private menuItems: MenuItem[] = [];
  private selectedIndex: number = 0;
  private time: number = 0;
  private inputCooldown: number = 0;
  private lastMoveDir: number = 0;

  constructor(game: Game) {
    super(game);

    this.menuItems = [
      { id: 'resume', label: contentLoader.getString('pause_resume'), action: () => this.doResume() },
      { id: 'neuro', label: contentLoader.getString('pause_neuro_settings'), action: () => this.openNeuroSettings() },
      { id: 'settings', label: contentLoader.getString('pause_settings'), action: () => this.openSettings() },
      { id: 'quit', label: contentLoader.getString('pause_quit_to_menu'), action: () => this.quitToMenu() },
    ];
  }

  enter(): void {
    this.selectedIndex = 0;
    this.time = 0;
    this.inputCooldown = 0.2; // Prevent immediate input
  }

  exit(): void {
    // Cleanup
  }

  update(dt: number, intent: PlayerIntent): void {
    this.time += dt;

    // Input cooldown
    if (this.inputCooldown > 0) {
      this.inputCooldown -= dt;
    }

    // Resume on cancel (after initial cooldown)
    if (intent.cancel && this.inputCooldown <= 0) {
      this.doResume();
      return;
    }

    // Edge-triggered menu navigation (up/down)
    const moveDir = intent.menuAxis < -0.5 ? -1 : intent.menuAxis > 0.5 ? 1 : 0;
    const justStarted = moveDir !== 0 && this.lastMoveDir === 0;
    const canRepeat = moveDir !== 0 && this.inputCooldown <= 0;

    if (justStarted || canRepeat) {
      if (moveDir < 0) {
        this.selectedIndex = (this.selectedIndex - 1 + this.menuItems.length) % this.menuItems.length;
        this.inputCooldown = 0.15;
      } else if (moveDir > 0) {
        this.selectedIndex = (this.selectedIndex + 1) % this.menuItems.length;
        this.inputCooldown = 0.15;
      }
    }

    this.lastMoveDir = moveDir;

    // Confirm selection
    if (intent.confirm && this.inputCooldown <= 0) {
      this.menuItems[this.selectedIndex].action();
    }

    // Mouse support
    this.handleMouseInput();
  }

  private handleMouseInput(): void {
    const input = this.game.getInput();
    const mousePos = input.getMousePos();
    const click = input.getMouseClick();
    const renderer = this.game.getRenderer();
    const { height } = renderer;

    const menuStartY = height * 0.5;
    const menuSpacing = 50;

    if (mousePos) {
      for (let i = 0; i < this.menuItems.length; i++) {
        const y = menuStartY + i * menuSpacing;
        if (mousePos.y >= y - 16 && mousePos.y <= y + 16) {
          this.selectedIndex = i;
          break;
        }
      }
    }

    if (click && this.inputCooldown <= 0) {
      for (let i = 0; i < this.menuItems.length; i++) {
        const y = menuStartY + i * menuSpacing;
        if (click.y >= y - 16 && click.y <= y + 16) {
          this.selectedIndex = i;
          this.menuItems[i].action();
          break;
        }
      }
    }
  }

  render(renderer: Renderer, _alpha: number): void {
    const { width, height } = renderer;
    const ctx = renderer.context;

    // Radial gradient background (over darkened game)
    renderer.save();
    renderer.setAlpha(0.85);
    renderer.radialGradientBackground(['#0a0a14', '#0d0d1a', '#060610']);
    renderer.restore();

    // Scanlines
    renderer.drawScanLines(0.02, 3);

    // Pause title
    const titleY = height * 0.3;
    const pauseLabel = contentLoader.getString('pause');
    renderer.glowText(pauseLabel, width / 2, titleY, CONFIG.COLORS.ACCENT, 48, 'center', 25);

    // Horizontal rules flanking the title
    ctx.save();
    ctx.font = "bold 48px 'SF Mono', Consolas, monospace";
    const titleMeasured = ctx.measureText(pauseLabel).width;
    const ruleW = 40;
    const ruleGap = 16;
    ctx.strokeStyle = CONFIG.COLORS.PRIMARY;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(width / 2 - titleMeasured / 2 - ruleGap - ruleW, titleY);
    ctx.lineTo(width / 2 - titleMeasured / 2 - ruleGap, titleY);
    ctx.moveTo(width / 2 + titleMeasured / 2 + ruleGap, titleY);
    ctx.lineTo(width / 2 + titleMeasured / 2 + ruleGap + ruleW, titleY);
    ctx.stroke();
    ctx.restore();

    // Menu items
    const menuStartY = height * 0.5;
    const menuSpacing = 50;

    this.menuItems.forEach((item, index) => {
      const y = menuStartY + index * menuSpacing;
      const isSelected = index === this.selectedIndex;

      const color = isSelected ? CONFIG.COLORS.PRIMARY : CONFIG.COLORS.TEXT_DIM;
      const size = isSelected ? 26 : 22;
      const glow = isSelected ? 15 : 0;

      if (isSelected) {
        // Terminal cursor accent bar
        ctx.save();
        const cursorAlpha = 0.6 + Math.sin(this.time * 4) * 0.4;
        ctx.globalAlpha = cursorAlpha;
        ctx.fillStyle = CONFIG.COLORS.PRIMARY;
        ctx.fillRect(width / 2 - 120, y - 8, 3, 16);
        ctx.restore();

        // Precise underline
        ctx.save();
        ctx.font = `bold ${size}px 'SF Mono', Consolas, monospace`;
        const labelW = ctx.measureText(item.label).width;
        ctx.strokeStyle = CONFIG.COLORS.PRIMARY;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.moveTo(width / 2 - labelW / 2, y + size / 2 + 2);
        ctx.lineTo(width / 2 + labelW / 2, y + size / 2 + 2);
        ctx.stroke();
        ctx.restore();
      }

      renderer.glowText(item.label, width / 2, y, color, size, 'center', glow);
    });

    // Controls hint
    ctx.save();
    ctx.globalAlpha = 0.4;
    renderer.text(
      'ESC RESUME   ↑ ↓ SELECT   SPACE CONFIRM',
      width / 2,
      height - 40,
      CONFIG.COLORS.TEXT_DIM,
      11,
      'center',
    );
    ctx.restore();
  }

  private doResume(): void {
    events.emit('game:resume', undefined);
    this.game.getScenes().pop();
  }

  private openNeuroSettings(): void {
    this.game.getScenes().push('neuroSettings');
  }

  private openSettings(): void {
    this.game.getScenes().push('settings');
  }

  private quitToMenu(): void {
    this.game.getScenes().goto('menu');
  }
}
