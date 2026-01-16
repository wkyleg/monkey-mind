/**
 * Pause overlay scene
 */

import { Scene } from '../engine/scene';
import type { Game } from '../engine/game';
import type { Renderer } from '../engine/renderer';
import type { PlayerIntent } from '../engine/input';
import { CONFIG } from '../config';
import { events } from '../core/events';
import { contentLoader } from '../content/loader';
import { oscillate } from '../util/math';

interface MenuItem {
  id: string;
  label: string;
  action: () => void;
}

export class PauseScene extends Scene {
  private menuItems: MenuItem[] = [];
  private selectedIndex: number = 0;
  private time: number = 0;
  private inputCooldown: number = 0;
  private lastMoveDir: number = 0;
  
  constructor(game: Game) {
    super(game);
    
    this.menuItems = [
      { id: 'resume', label: 'RESUME', action: () => this.doResume() },
      { id: 'settings', label: 'SETTINGS', action: () => this.openSettings() },
      { id: 'quit', label: 'QUIT TO MENU', action: () => this.quitToMenu() },
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
  }
  
  render(renderer: Renderer, _alpha: number): void {
    const { width, height } = renderer;
    
    // Darken background
    renderer.save();
    renderer.setAlpha(0.8);
    renderer.fillRect(0, 0, width, height, '#000000');
    renderer.restore();
    
    // Pause title
    const titleY = height * 0.3;
    renderer.glowText(
      contentLoader.getString('pause'),
      width / 2,
      titleY,
      CONFIG.COLORS.ACCENT,
      48,
      'center',
      25
    );
    
    // Menu items
    const menuStartY = height * 0.5;
    const menuSpacing = 50;
    
    this.menuItems.forEach((item, index) => {
      const y = menuStartY + index * menuSpacing;
      const isSelected = index === this.selectedIndex;
      
      const color = isSelected ? CONFIG.COLORS.PRIMARY : CONFIG.COLORS.TEXT_DIM;
      const size = isSelected ? 28 : 24;
      const glow = isSelected ? 20 : 0;
      
      if (isSelected) {
        // Selection indicator
        const pulse = oscillate(this.time, 2, 5);
        renderer.glowCircle(width / 2 - 100 + pulse, y, 5, CONFIG.COLORS.PRIMARY, 8);
        renderer.glowCircle(width / 2 + 100 - pulse, y, 5, CONFIG.COLORS.PRIMARY, 8);
      }
      
      renderer.glowText(item.label, width / 2, y, color, size, 'center', glow);
    });
    
    // Controls hint
    renderer.text(
      'ESC RESUME   ↑ ↓ SELECT   SPACE CONFIRM',
      width / 2,
      height - 40,
      CONFIG.COLORS.TEXT_DIM,
      12,
      'center'
    );
  }
  
  private doResume(): void {
    events.emit('game:resume', undefined);
    this.game.getScenes().pop();
  }
  
  private openSettings(): void {
    this.game.getScenes().push('settings');
  }
  
  private quitToMenu(): void {
    this.game.getScenes().goto('menu');
  }
}
