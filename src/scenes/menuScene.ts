/**
 * Main menu scene
 */

import { CONFIG } from '../config';
import { contentLoader } from '../content/loader';
import { storage } from '../core/storage';
import type { Game } from '../engine/game';
import type { PlayerIntent } from '../engine/input';
import type { Renderer } from '../engine/renderer';
import { Scene } from '../engine/scene';

// oscillate import removed - no longer using bouncing title

interface MenuItem {
  id: string;
  label: string;
  action: () => void;
}

export class MenuScene extends Scene {
  private menuItems: MenuItem[] = [];
  private selectedIndex: number = 0;
  private time: number = 0;

  // Animation states
  private fadeIn: number = 0;
  private menuOffset: number = 50;
  private selectionPulse: number = 0;

  // Hover effect tracking
  private hoverScale: number[] = [];

  // Input cooldown for edge-triggered navigation
  private inputCooldown: number = 0;
  private lastMoveDir: number = 0;

  constructor(game: Game) {
    super(game);

    this.menuItems = [
      { id: 'new_game', label: contentLoader.getString('menu_new_game'), action: () => this.startNewGame() },
      { id: 'continue', label: contentLoader.getString('menu_continue'), action: () => this.startCampaign() },
      { id: 'level_select', label: contentLoader.getString('menu_level_select'), action: () => this.openLevelSelect() },
      { id: 'endless', label: contentLoader.getString('menu_endless_mode'), action: () => this.startEndless() },
      { id: 'codex', label: contentLoader.getString('menu_codex'), action: () => this.openCodex() },
      {
        id: 'how_to_play',
        label: contentLoader.getString('menu_how_to_play'),
        action: () => this.game.getScenes().push('howToPlay'),
      },
      { id: 'neuro', label: contentLoader.getString('menu_neuro'), action: () => this.openNeuroSettings() },
      { id: 'settings', label: contentLoader.getString('menu_settings'), action: () => this.openSettings() },
    ];
  }

  enter(): void {
    this.selectedIndex = 0;
    this.time = 0;
    this.fadeIn = 0;
    this.menuOffset = 50;
    this.selectionPulse = 0;
    this.hoverScale = this.menuItems.map(() => 1);

    // Stop any playing music first, then start menu ambient music
    this.game.getMusic().stop();
    this.game.getMusic().setMenuMood();
    this.game.getMusic().start();
  }

  exit(): void {
    // Cleanup
  }

  update(dt: number, intent: PlayerIntent): void {
    this.time += dt;

    // Fade in animation
    this.fadeIn = Math.min(1, this.fadeIn + dt * 2);
    this.menuOffset = Math.max(0, this.menuOffset - dt * 200);

    // Selection pulse animation
    this.selectionPulse += dt * 5;

    // Update hover scale for smooth transitions
    for (let i = 0; i < this.hoverScale.length; i++) {
      const targetScale = i === this.selectedIndex ? 1.03 : 1.0;
      this.hoverScale[i] += (targetScale - this.hoverScale[i]) * dt * 8;
    }

    // Input cooldown
    if (this.inputCooldown > 0) {
      this.inputCooldown -= dt;
    }

    // Edge-triggered menu navigation (up/down arrows)
    const moveDir = intent.menuAxis < -0.5 ? -1 : intent.menuAxis > 0.5 ? 1 : 0;
    const justStarted = moveDir !== 0 && this.lastMoveDir === 0;
    const canRepeat = moveDir !== 0 && this.inputCooldown <= 0;

    if (justStarted || canRepeat) {
      if (moveDir < 0) {
        this.selectPrevious();
        this.inputCooldown = 0.2;
        this.selectionPulse = 0; // Reset pulse on selection change
      } else if (moveDir > 0) {
        this.selectNext();
        this.inputCooldown = 0.2;
        this.selectionPulse = 0;
      }
    }

    this.lastMoveDir = moveDir;

    // Confirm selection
    if (intent.confirm) {
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

    const menuStartY = height * 0.48;
    const availableHeight = height * 0.4;
    const menuSpacing = Math.max(36, Math.min(46, availableHeight / this.menuItems.length));

    if (mousePos) {
      for (let i = 0; i < this.menuItems.length; i++) {
        const y = menuStartY + i * menuSpacing;
        if (mousePos.y >= y - 16 && mousePos.y <= y + 16) {
          this.selectedIndex = i;
          break;
        }
      }
    }

    if (click) {
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

  private selectPrevious(): void {
    this.selectedIndex = (this.selectedIndex - 1 + this.menuItems.length) % this.menuItems.length;
  }

  private selectNext(): void {
    this.selectedIndex = (this.selectedIndex + 1) % this.menuItems.length;
  }

  render(renderer: Renderer, _alpha: number): void {
    const { width, height } = renderer;
    const ctx = renderer.context;

    ctx.globalAlpha = 1;
    renderer.fillRect(0, 0, width, height, '#000000');

    renderer.radialGradientBackground(['#0a0a14', '#0d0d1a', '#060610'], width / 2, height / 3);

    this.drawNeuralMesh(renderer);

    // Scanline overlay for loading-screen consistency
    renderer.drawScanLines(0.025, 3);

    const titleY = height * 0.25;

    renderer.save();
    renderer.setAlpha(this.fadeIn);

    const titleGlow = 20 + Math.sin(this.time * 1.5) * 3;
    renderer.glowText(
      contentLoader.getString('title'),
      width / 2,
      titleY,
      CONFIG.COLORS.PRIMARY,
      64,
      'center',
      titleGlow,
    );

    // Subtle horizontal rules flanking the title instead of chevron brackets
    const titleText = contentLoader.getString('title');
    ctx.font = "64px 'SF Mono', Consolas, 'Liberation Mono', monospace";
    const titleMeasured = ctx.measureText(titleText).width;
    const ruleGap = 20;
    const ruleW = 60 + Math.sin(this.time * 1) * 2;

    ctx.save();
    ctx.strokeStyle = CONFIG.COLORS.PRIMARY;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.4 * this.fadeIn;
    ctx.shadowColor = CONFIG.COLORS.PRIMARY;
    ctx.shadowBlur = 6;
    // Left rule
    ctx.beginPath();
    ctx.moveTo(width / 2 - titleMeasured / 2 - ruleGap - ruleW, titleY);
    ctx.lineTo(width / 2 - titleMeasured / 2 - ruleGap, titleY);
    ctx.stroke();
    // Right rule
    ctx.beginPath();
    ctx.moveTo(width / 2 + titleMeasured / 2 + ruleGap, titleY);
    ctx.lineTo(width / 2 + titleMeasured / 2 + ruleGap + ruleW, titleY);
    ctx.stroke();
    ctx.restore();

    renderer.glowText(
      contentLoader.getString('subtitle'),
      width / 2,
      titleY + 60,
      CONFIG.COLORS.SECONDARY,
      24,
      'center',
      10,
    );

    const menuStartY = height * 0.48;
    const availableHeight = height * 0.4;
    const menuSpacing = Math.max(36, Math.min(46, availableHeight / this.menuItems.length));

    this.menuItems.forEach((item, index) => {
      const itemAlpha = Math.max(0, Math.min(1, (this.fadeIn - index * 0.05) * 4));
      const staggerOffset = Math.max(0, (1 - itemAlpha) * 20);

      const y = menuStartY + index * menuSpacing + this.menuOffset + staggerOffset;
      const isSelected = index === this.selectedIndex;
      const scale = this.hoverScale[index] || 1;
      const finalScale = scale;

      let color: string;
      let size: number;
      let glow: number;

      if (isSelected) {
        color = CONFIG.COLORS.PRIMARY;
        size = 26;
        glow = 12;
      } else {
        color = CONFIG.COLORS.TEXT_DIM;
        size = 22;
        glow = 0;
      }

      ctx.save();
      ctx.globalAlpha = itemAlpha * this.fadeIn;

      if (isSelected) {
        // Terminal-style cursor accent on the left
        const cursorAlpha = 0.6 + Math.sin(this.selectionPulse * 1.5) * 0.4;
        ctx.save();
        ctx.globalAlpha = cursorAlpha * itemAlpha * this.fadeIn;
        ctx.fillStyle = CONFIG.COLORS.PRIMARY;
        ctx.shadowColor = CONFIG.COLORS.PRIMARY;
        ctx.shadowBlur = 6;
        ctx.fillRect(width / 2 - 140, y - 8, 3, 16);
        ctx.restore();

        // Measured underline
        ctx.font = `${size}px 'SF Mono', Consolas, 'Liberation Mono', monospace`;
        const textWidth = ctx.measureText(item.label).width;
        ctx.save();
        ctx.strokeStyle = CONFIG.COLORS.PRIMARY;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.5 * itemAlpha * this.fadeIn;
        ctx.shadowColor = CONFIG.COLORS.PRIMARY;
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.moveTo(width / 2 - textWidth / 2, y + 14);
        ctx.lineTo(width / 2 + textWidth / 2, y + 14);
        ctx.stroke();
        ctx.restore();
      }

      ctx.translate(width / 2, y);
      ctx.scale(finalScale, finalScale);
      ctx.translate(-width / 2, -y);

      renderer.glowText(item.label, width / 2, y, color, size, 'center', glow);

      if (item.id === 'neuro') {
        const neuroState = this.game.getNeuroManager().getState();
        let dotColor: string;
        if (neuroState.source === 'eeg') {
          dotColor = CONFIG.COLORS.SUCCESS;
        } else if (neuroState.source === 'rppg') {
          dotColor = '#ffaa44';
        } else if (neuroState.source === 'mock') {
          dotColor = CONFIG.COLORS.TEXT_DIM;
        } else {
          dotColor = CONFIG.COLORS.DANGER;
        }
        ctx.font = `${size}px 'SF Mono', Consolas, 'Liberation Mono', monospace`;
        const neuroTextW = ctx.measureText(item.label).width;
        renderer.fillCircle(width / 2 + neuroTextW / 2 + 10, y - 2, 4, dotColor);
      }

      ctx.restore();
    });

    // High scores
    const highScoreCampaign = storage.getHighScore('campaign');
    const highScoreEndless = storage.getHighScore('endless');

    if (highScoreCampaign > 0 || highScoreEndless > 0) {
      renderer.text(
        `HIGH SCORES — CAMPAIGN: ${highScoreCampaign} | ENDLESS: ${highScoreEndless}`,
        width / 2,
        height - 55,
        CONFIG.COLORS.TEXT_DIM,
        12,
        'center',
      );
    }

    renderer.text(
      '↑ ↓ SELECT   SPACE CONFIRM   CLICK TO SELECT',
      width / 2,
      height - 30,
      CONFIG.COLORS.TEXT_DIM,
      11,
      'center',
    );

    renderer.restore();
  }

  private drawNeuralMesh(renderer: Renderer): void {
    const { width, height } = renderer;
    const ctx = renderer.context;

    ctx.save();
    ctx.globalAlpha = 0.1 * this.fadeIn;

    // Draw grid of neural connections
    const gridSize = 80;
    const time = this.time * 0.2;

    for (let x = 0; x < width; x += gridSize) {
      for (let y = 0; y < height; y += gridSize) {
        const offsetX = Math.sin(time + y * 0.01) * 10;
        const offsetY = Math.cos(time + x * 0.01) * 10;

        // Draw node
        const nodeX = x + offsetX;
        const nodeY = y + offsetY;
        renderer.fillCircle(nodeX, nodeY, 2, CONFIG.COLORS.PRIMARY);

        // Draw connections
        if (x + gridSize < width) {
          const nextX = x + gridSize + Math.sin(time + (y + gridSize) * 0.01) * 10;
          renderer.line(nodeX, nodeY, nextX, nodeY + offsetY, CONFIG.COLORS.PRIMARY, 0.5);
        }
        if (y + gridSize < height) {
          const nextY = y + gridSize + Math.cos(time + (x + gridSize) * 0.01) * 10;
          renderer.line(nodeX, nodeY, nodeX + offsetX, nextY, CONFIG.COLORS.PRIMARY, 0.5);
        }
      }
    }

    ctx.restore();
  }

  private startNewGame(): void {
    this.game.getScenes().replace('intro');
  }

  private startCampaign(): void {
    this.game.getScenes().replace('campaign');
  }

  private startEndless(): void {
    this.game.getScenes().replace('endless');
  }

  private openLevelSelect(): void {
    // Use goto() to ensure clean stack (no menu underneath)
    this.game.getScenes().goto('levelSelect');
  }

  private openCodex(): void {
    // Codex is an overlay, so push is correct
    this.game.getScenes().push('codex');
  }

  private openNeuroSettings(): void {
    this.game.getScenes().push('neuroSettings');
  }

  private openSettings(): void {
    this.game.getScenes().push('settings');
  }
}
