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
  private titleBob: number = 0;

  // Hover effect tracking
  private hoverScale: number[] = [];

  // Input cooldown for edge-triggered navigation
  private inputCooldown: number = 0;
  private lastMoveDir: number = 0;

  constructor(game: Game) {
    super(game);

    this.menuItems = [
      { id: 'new_game', label: 'NEW GAME', action: () => this.startNewGame() },
      { id: 'continue', label: 'CONTINUE', action: () => this.startCampaign() },
      { id: 'level_select', label: 'LEVEL SELECT', action: () => this.openLevelSelect() },
      { id: 'endless', label: 'ENDLESS MODE', action: () => this.startEndless() },
      { id: 'codex', label: 'CODEX', action: () => this.openCodex() },
      { id: 'settings', label: 'SETTINGS', action: () => this.openSettings() },
    ];
  }

  enter(): void {
    this.selectedIndex = 0;
    this.time = 0;
    this.fadeIn = 0;
    this.menuOffset = 50;
    this.selectionPulse = 0;
    this.titleBob = 0;
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

    // Title bob animation (subtle)
    this.titleBob = Math.sin(this.time * 1.5) * 3;

    // Update hover scale for smooth transitions
    for (let i = 0; i < this.hoverScale.length; i++) {
      const targetScale = i === this.selectedIndex ? 1.1 : 1.0;
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
  }

  private selectPrevious(): void {
    this.selectedIndex = (this.selectedIndex - 1 + this.menuItems.length) % this.menuItems.length;
  }

  private selectNext(): void {
    this.selectedIndex = (this.selectedIndex + 1) % this.menuItems.length;
  }

  render(renderer: Renderer, _alpha: number): void {
    const { width, height } = renderer;

    // Clear any previous content and reset context state
    renderer.context.globalAlpha = 1;
    renderer.fillRect(0, 0, width, height, '#000000');

    // Background
    renderer.radialGradientBackground(
      [CONFIG.COLORS.BACKGROUND, CONFIG.COLORS.BACKGROUND_LIGHT, CONFIG.COLORS.BACKGROUND],
      width / 2,
      height / 3,
    );

    // Neural mesh background pattern
    this.drawNeuralMesh(renderer);

    // Title with subtle animation
    const titleY = height * 0.25 + this.titleBob;

    renderer.save();
    renderer.setAlpha(this.fadeIn);

    // Title glow with pulsing effect
    const titleGlow = 30 + Math.sin(this.time * 2) * 5;
    renderer.glowText(
      contentLoader.getString('title'),
      width / 2,
      titleY,
      CONFIG.COLORS.PRIMARY,
      64,
      'center',
      titleGlow,
    );

    // Animated bracket decorations around title
    const ctx = renderer.context;
    const bracketPulse = Math.sin(this.time * 3) * 5;
    ctx.save();
    ctx.strokeStyle = CONFIG.COLORS.PRIMARY;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.7 * this.fadeIn;
    ctx.shadowColor = CONFIG.COLORS.PRIMARY;
    ctx.shadowBlur = 10;

    // Left bracket
    ctx.beginPath();
    ctx.moveTo(width / 2 - 200 - bracketPulse, titleY - 25);
    ctx.lineTo(width / 2 - 210 - bracketPulse, titleY);
    ctx.lineTo(width / 2 - 200 - bracketPulse, titleY + 25);
    ctx.stroke();

    // Right bracket
    ctx.beginPath();
    ctx.moveTo(width / 2 + 200 + bracketPulse, titleY - 25);
    ctx.lineTo(width / 2 + 210 + bracketPulse, titleY);
    ctx.lineTo(width / 2 + 200 + bracketPulse, titleY + 25);
    ctx.stroke();
    ctx.restore();

    // Subtitle
    renderer.glowText(
      contentLoader.getString('subtitle'),
      width / 2,
      titleY + 60,
      CONFIG.COLORS.SECONDARY,
      24,
      'center',
      15,
    );

    // Menu items - dynamic spacing based on screen height
    const menuStartY = height * 0.5;
    const availableHeight = height * 0.38; // Space for menu items
    const menuSpacing = Math.max(38, Math.min(50, availableHeight / this.menuItems.length));

    this.menuItems.forEach((item, index) => {
      // Staggered fade-in per item
      const itemAlpha = Math.max(0, Math.min(1, (this.fadeIn - index * 0.1) * 3));
      const staggerOffset = Math.max(0, (1 - itemAlpha) * 30);

      const y = menuStartY + index * menuSpacing + this.menuOffset + staggerOffset;
      const isSelected = index === this.selectedIndex;
      const scale = this.hoverScale[index] || 1;

      // Calculate pulse for selected item
      const pulseEffect = isSelected ? Math.sin(this.selectionPulse) * 0.05 + 1 : 1;
      const finalScale = scale * pulseEffect;

      // Colors with smooth transitions
      let color: string;
      let size: number;
      let glow: number;

      if (isSelected) {
        // Pulsing selection effect
        const pulseAlpha = 0.7 + Math.sin(this.selectionPulse) * 0.3;
        color = `rgba(0, 204, 204, ${pulseAlpha})`;
        size = 28;
        glow = 25 + Math.sin(this.selectionPulse) * 10;
      } else {
        color = CONFIG.COLORS.TEXT_DIM;
        size = 24;
        glow = 0;
      }

      ctx.save();
      ctx.globalAlpha = itemAlpha * this.fadeIn;

      if (isSelected) {
        // Animated selection indicators
        const indicatorPulse = Math.sin(this.selectionPulse * 2) * 3;
        const indicatorX = width / 2 - 130 - indicatorPulse;
        const indicatorXRight = width / 2 + 130 + indicatorPulse;

        // Left indicator with trail
        renderer.glowCircle(indicatorX, y, 6, CONFIG.COLORS.PRIMARY, 15);
        renderer.glowCircle(indicatorX - 15, y, 3, CONFIG.COLORS.PRIMARY, 8);

        // Right indicator with trail
        renderer.glowCircle(indicatorXRight, y, 6, CONFIG.COLORS.PRIMARY, 15);
        renderer.glowCircle(indicatorXRight + 15, y, 3, CONFIG.COLORS.PRIMARY, 8);

        // Underline effect
        ctx.strokeStyle = CONFIG.COLORS.PRIMARY;
        ctx.lineWidth = 2;
        ctx.shadowColor = CONFIG.COLORS.PRIMARY;
        ctx.shadowBlur = 10;
        const textWidth = item.label.length * 14; // Approximate
        ctx.beginPath();
        ctx.moveTo(width / 2 - textWidth / 2, y + 18);
        ctx.lineTo(width / 2 + textWidth / 2, y + 18);
        ctx.stroke();
      }

      // Draw scaled text
      ctx.translate(width / 2, y);
      ctx.scale(finalScale, finalScale);
      ctx.translate(-width / 2, -y);

      renderer.glowText(item.label, width / 2, y, color, size, 'center', glow);

      ctx.restore();
    });

    // High scores
    const highScoreCampaign = storage.getHighScore('campaign');
    const highScoreEndless = storage.getHighScore('endless');

    if (highScoreCampaign > 0 || highScoreEndless > 0) {
      renderer.text(
        `HIGH SCORES - CAMPAIGN: ${highScoreCampaign} | ENDLESS: ${highScoreEndless}`,
        width / 2,
        height - 60,
        CONFIG.COLORS.TEXT_DIM,
        14,
        'center',
      );
    }

    // Controls hint
    renderer.text('↑ ↓ SELECT   SPACE CONFIRM', width / 2, height - 30, CONFIG.COLORS.TEXT_DIM, 12, 'center');

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

  private openSettings(): void {
    // Settings is an overlay, so push is correct
    this.game.getScenes().push('settings');
  }
}
