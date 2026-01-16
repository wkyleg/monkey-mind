/**
 * Inter-level story scene
 * Shows narrative text between levels
 */

import { Scene } from '../engine/scene';
import type { Game } from '../engine/game';
import type { Renderer } from '../engine/renderer';
import type { PlayerIntent } from '../engine/input';
import { CONFIG } from '../config';

// Story beats for each sector
const SECTOR_STORIES: Record<string, { intro: string[]; outro: string[] }> = {
  sector1_neural_cage: {
    intro: [
      'SECTOR 1: THE NEURAL CAGE',
      '',
      'You awaken in the sterile white corridors of',
      'your recent memories. Clinical. Cold. Familiar.',
      '',
      'The first intrusive thoughts emerge—',
      'small anxieties, reflexive worries.',
      'They are weak, but relentless.',
    ],
    outro: [
      'The clinical walls begin to dissolve.',
      'Deeper you go, into older memories.',
      'The water is rising...',
    ],
  },
  sector2_synaptic_reef: {
    intro: [
      'SECTOR 2: THE SYNAPTIC REEF',
      '',
      'The depths of your subconscious spread before you—',
      'an alien ocean of half-formed memories.',
      '',
      'Here swim the creatures of pattern recognition:',
      'thoughts that loop, fears that circle,',
      'emotional currents that pull you under.',
    ],
    outro: [
      'You break through the surface.',
      'Above, something ancient looms—',
      'the architecture of belief itself.',
    ],
  },
  sector3_forgotten_pantheon: {
    intro: [
      'SECTOR 3: THE FORGOTTEN PANTHEON',
      '',
      'Towering statues of abandoned ideologies.',
      'Gods you once worshipped, now crumbling.',
      '',
      'Your old beliefs have become your enemies:',
      'rigid, judgmental, unforgiving.',
      'They attack with righteous fury.',
    ],
    outro: [
      'The temples collapse behind you.',
      'Only darkness ahead—',
      'the things you tried to forget.',
    ],
  },
  sector4_black_projects: {
    intro: [
      'SECTOR 4: BLACK PROJECTS',
      '',
      'Classified. Redacted. Suppressed.',
      'The memories you buried deepest.',
      '',
      'Trauma given form. Pain made manifest.',
      'They move with military precision.',
      'They know your weaknesses.',
    ],
    outro: [
      'The darkness lifts.',
      'Beyond the pain, something beautiful.',
      'The final door opens...',
    ],
  },
  sector5_fractal_bloom: {
    intro: [
      'SECTOR 5: THE FRACTAL BLOOM',
      '',
      'Transcendence. Ego death. Rebirth.',
      'The boundaries of self dissolve.',
      '',
      'Reality fractures into infinite possibility.',
      'Every color exists. Every thought is alive.',
      'You are everything. You are nothing.',
    ],
    outro: [
      'You see it now—the exit.',
      'One final guardian stands between',
      'you and freedom: yourself.',
    ],
  },
};

interface LevelStoryContext {
  sectorId: string;
  isIntro: boolean;
}

export class LevelStoryScene extends Scene {
  private context: LevelStoryContext | null = null;
  private time: number = 0;
  private fadeAlpha: number = 0;
  private inputCooldown: number = 0;
  private lines: string[] = [];
  
  constructor(game: Game) {
    super(game);
  }
  
  enter(): void {
    this.context = this.game.getScenes().getLevelStoryContext();
    this.time = 0;
    this.fadeAlpha = 0;
    this.inputCooldown = 0.5;
    
    if (this.context) {
      const story = SECTOR_STORIES[this.context.sectorId];
      if (story) {
        this.lines = this.context.isIntro ? story.intro : story.outro;
      } else {
        this.lines = ['Continuing deeper into the mind...'];
      }
    }
  }
  
  exit(): void {
    this.game.getScenes().clearLevelStoryContext();
  }
  
  update(dt: number, intent: PlayerIntent): void {
    this.time += dt;
    this.inputCooldown = Math.max(0, this.inputCooldown - dt);
    
    // Fade in
    this.fadeAlpha = Math.min(1, this.time * 2);
    
    // Skip or continue
    if ((intent.confirm || intent.cancel) && this.inputCooldown <= 0 && this.time > 1.5) {
      this.game.getScenes().pop();
    }
    
    // Auto-advance after delay
    if (this.time > 8) {
      this.game.getScenes().pop();
    }
  }
  
  render(renderer: Renderer, _alpha: number): void {
    const { width, height } = renderer;
    
    // Background
    renderer.fillRect(0, 0, width, height, '#000000');
    
    renderer.save();
    renderer.setAlpha(this.fadeAlpha);
    
    // Story text
    const lineHeight = 30;
    const startY = height * 0.3;
    
    this.lines.forEach((line, index) => {
      const y = startY + index * lineHeight;
      const isTitle = index === 0 && line.startsWith('SECTOR');
      
      if (isTitle) {
        renderer.glowText(
          line,
          width / 2,
          y,
          CONFIG.COLORS.ACCENT,
          28,
          'center',
          20
        );
      } else {
        const color = line === '' ? CONFIG.COLORS.TEXT_DIM : CONFIG.COLORS.TEXT;
        renderer.text(
          line,
          width / 2,
          y,
          color,
          18,
          'center'
        );
      }
    });
    
    // Continue hint
    if (this.time > 2) {
      const pulseAlpha = 0.5 + Math.sin(this.time * 3) * 0.3;
      renderer.save();
      renderer.setAlpha(pulseAlpha * this.fadeAlpha);
      renderer.text(
        'PRESS SPACE TO CONTINUE',
        width / 2,
        height * 0.88,
        CONFIG.COLORS.TEXT_DIM,
        14,
        'center'
      );
      renderer.restore();
    }
    
    renderer.restore();
  }
}
