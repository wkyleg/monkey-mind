/**
 * Level Select scene - allows replaying completed sectors
 */

import { Scene } from '../engine/scene';
import type { Game } from '../engine/game';
import type { Renderer } from '../engine/renderer';
import type { PlayerIntent } from '../engine/input';
import { CONFIG } from '../config';
import { storage } from '../core/storage';

interface SectorInfo {
  id: string;
  name: string;
  index: number;
  unlocked: boolean;
}

export class LevelSelectScene extends Scene {
  private sectors: SectorInfo[] = [];
  private selectedIndex: number = 0;
  private time: number = 0;
  private inputCooldown: number = 0;
  
  constructor(game: Game) {
    super(game);
  }
  
  enter(): void {
    this.selectedIndex = 0;
    this.time = 0;
    this.inputCooldown = 0.2;
    
    this.buildSectorList();
  }
  
  exit(): void {
    // Cleanup
  }
  
  private buildSectorList(): void {
    const highestCompleted = storage.highestSector;
    
    this.sectors = [
      { id: 'sector1_neural_cage', name: 'THE NEURAL CAGE', index: 0, unlocked: true },
      { id: 'sector2_synaptic_reef', name: 'SYNAPTIC REEF', index: 1, unlocked: highestCompleted >= 1 },
      { id: 'sector3_pantheon', name: 'THE PANTHEON', index: 2, unlocked: highestCompleted >= 2 },
      { id: 'sector4_black_projects', name: 'BLACK PROJECTS', index: 3, unlocked: highestCompleted >= 3 },
      { id: 'sector5_fractal_bloom', name: 'THE FRACTAL BLOOM', index: 4, unlocked: highestCompleted >= 4 },
    ];
  }
  
  update(dt: number, intent: PlayerIntent): void {
    this.time += dt;
    
    // Input cooldown
    if (this.inputCooldown > 0) {
      this.inputCooldown -= dt;
      return;
    }
    
    // Back
    if (intent.cancel) {
      this.game.getScenes().pop();
      return;
    }
    
    // Navigate with up/down
    if (intent.menuAxis < -0.5) {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      this.inputCooldown = 0.15;
    } else if (intent.menuAxis > 0.5) {
      this.selectedIndex = Math.min(this.sectors.length - 1, this.selectedIndex + 1);
      this.inputCooldown = 0.15;
    }
    
    // Select sector
    if (intent.confirm) {
      const sector = this.sectors[this.selectedIndex];
      if (sector.unlocked) {
        // Store the selected sector and start campaign from there
        this.game.getScenes().setContext('levelSelect', { sectorIndex: sector.index });
        this.game.getScenes().replace('campaign');
      }
    }
  }
  
  render(renderer: Renderer, _alpha: number): void {
    const { width, height } = renderer;
    
    // Background
    renderer.radialGradientBackground(
      [CONFIG.COLORS.BACKGROUND, '#1a1a2e'],
      width / 2,
      height / 2
    );
    
    // Title
    renderer.glowText(
      'LEVEL SELECT',
      width / 2,
      60,
      CONFIG.COLORS.PRIMARY,
      40,
      'center',
      20
    );
    
    // Subtitle
    renderer.text(
      'Choose a sector to replay',
      width / 2,
      100,
      CONFIG.COLORS.TEXT_DIM,
      16,
      'center'
    );
    
    // Sector list
    const startY = 180;
    const spacing = 70;
    
    this.sectors.forEach((sector, index) => {
      const y = startY + index * spacing;
      const isSelected = index === this.selectedIndex;
      
      // Selection box
      if (isSelected) {
        renderer.strokeRect(
          width / 2 - 200,
          y - 25,
          400,
          50,
          CONFIG.COLORS.PRIMARY,
          2
        );
      }
      
      if (sector.unlocked) {
        // Sector number
        renderer.hudText(
          `SECTOR ${index + 1}`,
          width / 2 - 180,
          y - 8,
          isSelected ? CONFIG.COLORS.ACCENT : CONFIG.COLORS.TEXT_DIM,
          12,
          'left'
        );
        
        // Sector name
        renderer.hudText(
          sector.name,
          width / 2 - 180,
          y + 10,
          isSelected ? CONFIG.COLORS.PRIMARY : CONFIG.COLORS.TEXT,
          isSelected ? 22 : 18,
          'left'
        );
        
        // Status indicator
        const completed = storage.highestSector > index;
        if (completed) {
          renderer.hudText(
            '✓ COMPLETED',
            width / 2 + 180,
            y,
            CONFIG.COLORS.SUCCESS,
            14,
            'right'
          );
        } else if (storage.highestSector === index) {
          renderer.hudText(
            'IN PROGRESS',
            width / 2 + 180,
            y,
            CONFIG.COLORS.WARNING,
            14,
            'right'
          );
        }
      } else {
        // Locked sector
        renderer.hudText(
          `SECTOR ${index + 1}`,
          width / 2 - 180,
          y - 8,
          CONFIG.COLORS.TEXT_DIM,
          12,
          'left'
        );
        
        renderer.hudText(
          '[ LOCKED ]',
          width / 2 - 180,
          y + 10,
          CONFIG.COLORS.TEXT_DIM,
          18,
          'left'
        );
        
        renderer.hudText(
          `Complete Sector ${index} to unlock`,
          width / 2 + 180,
          y,
          CONFIG.COLORS.TEXT_DIM,
          12,
          'right'
        );
      }
    });
    
    // Controls hint
    renderer.text(
      '↑ ↓ SELECT   SPACE START   ESC BACK',
      width / 2,
      height - 30,
      CONFIG.COLORS.TEXT_DIM,
      12,
      'center'
    );
  }
}
