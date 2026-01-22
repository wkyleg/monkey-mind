/**
 * Main menu scene
 */

import { Scene } from '../engine/scene';
import type { Game } from '../engine/game';
import type { Renderer } from '../engine/renderer';
import type { PlayerIntent } from '../engine/input';
import { CONFIG } from '../config';
import { contentLoader } from '../content/loader';
import { storage } from '../core/storage';
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
      } else if (moveDir > 0) {
        this.selectNext();
        this.inputCooldown = 0.2;
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
    
    // Background
    renderer.radialGradientBackground(
      [CONFIG.COLORS.BACKGROUND, CONFIG.COLORS.BACKGROUND_LIGHT, CONFIG.COLORS.BACKGROUND],
      width / 2,
      height / 3
    );
    
    // Neural mesh background pattern
    this.drawNeuralMesh(renderer);
    
    // Title
    const titleY = height * 0.25;
    
    renderer.save();
    renderer.setAlpha(this.fadeIn);
    
    // Title glow (static, no bounce)
    renderer.glowText(
      contentLoader.getString('title'),
      width / 2,
      titleY,
      CONFIG.COLORS.PRIMARY,
      64,
      'center',
      30
    );
    
    // Subtitle
    renderer.glowText(
      contentLoader.getString('subtitle'),
      width / 2,
      titleY + 60,
      CONFIG.COLORS.SECONDARY,
      24,
      'center',
      15
    );
    
    // Menu items - dynamic spacing based on screen height
    const menuStartY = height * 0.50;
    const availableHeight = height * 0.38; // Space for menu items
    const menuSpacing = Math.max(38, Math.min(50, availableHeight / this.menuItems.length));
    
    this.menuItems.forEach((item, index) => {
      const y = menuStartY + index * menuSpacing + this.menuOffset;
      const isSelected = index === this.selectedIndex;
      
      const color = isSelected ? CONFIG.COLORS.PRIMARY : CONFIG.COLORS.TEXT_DIM;
      const size = isSelected ? 28 : 24;
      const glow = isSelected ? 20 : 0;
      
      if (isSelected) {
        // Selection indicator (static)
        const indicatorX = width / 2 - 120;
        renderer.glowCircle(indicatorX, y, 6, CONFIG.COLORS.PRIMARY, 10);
        renderer.glowCircle(width / 2 + 120, y, 6, CONFIG.COLORS.PRIMARY, 10);
      }
      
      renderer.glowText(item.label, width / 2, y, color, size, 'center', glow);
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
        'center'
      );
    }
    
    // Controls hint
    renderer.text(
      '↑ ↓ SELECT   SPACE CONFIRM',
      width / 2,
      height - 30,
      CONFIG.COLORS.TEXT_DIM,
      12,
      'center'
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
    this.game.getScenes().push('levelSelect');
  }
  
  private openCodex(): void {
    this.game.getScenes().push('codex');
  }
  
  private openSettings(): void {
    this.game.getScenes().push('settings');
  }
}
