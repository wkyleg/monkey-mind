/**
 * Inter-level story scene
 * Shows narrative text between levels
 */

import { CONFIG } from '../config';
import type { PlayerIntent } from '../engine/input';
import type { Renderer } from '../engine/renderer';
import { Scene } from '../engine/scene';

// Story beats for legacy sectors (kept for compatibility)
const SECTOR_STORIES: Record<string, { intro: string[]; outro: string[] }> = {
  sector1_neural_cage: {
    intro: [
      'ACT 1: THE ESCAPE',
      '',
      'You awaken in the sterile white corridors of',
      'your recent memories. Clinical. Cold. Familiar.',
      '',
      'The first intrusive thoughts emerge—',
      'small anxieties, reflexive worries.',
      'They are weak, but relentless.',
    ],
    outro: ['The clinical walls begin to dissolve.', 'Deeper you go, into older memories.', 'The water is rising...'],
  },
  sector2_synaptic_reef: {
    intro: [
      'ACT 2: THE OCEAN',
      '',
      'The depths of your subconscious spread before you—',
      'an alien ocean of half-formed memories.',
      '',
      'Here swim the creatures of pattern recognition:',
      'thoughts that loop, fears that circle,',
      'emotional currents that pull you under.',
    ],
    outro: ['You break through the surface.', 'Above, something ancient looms—', 'the architecture of belief itself.'],
  },
  sector3_forgotten_pantheon: {
    intro: [
      'ACT 3: THE HEROIC',
      '',
      'Towering statues of abandoned ideologies.',
      'Heroes you once worshipped, now crumbling.',
      '',
      'Your old beliefs have become your enemies:',
      'rigid, judgmental, unforgiving.',
      'They attack with righteous fury.',
    ],
    outro: ['The temples collapse behind you.', 'Only darkness ahead—', 'the things you tried to forget.'],
  },
  sector4_black_projects: {
    intro: [
      'ACT 4: THE SACRED',
      '',
      'Classified. Redacted. Suppressed.',
      'The memories you buried deepest.',
      '',
      'Trauma given form. Pain made manifest.',
      'They move with divine precision.',
      'They know your weaknesses.',
    ],
    outro: ['The darkness lifts.', 'Beyond the pain, something beautiful.', 'The final door opens...'],
  },
  sector5_fractal_bloom: {
    intro: [
      'ACT 5: THE PAINTED',
      '',
      'Transcendence. Ego death. Rebirth.',
      'The boundaries of self dissolve.',
      '',
      'Reality fractures into infinite possibility.',
      'Every color exists. Every thought is alive.',
      'You are everything. You are nothing.',
    ],
    outro: ['You see it now—the path continues.', 'More layers await within.', 'The journey is far from over...'],
  },
};

// Story beats for the new Act system
const ACT_STORIES: Record<string, { intro: string[]; outro: string[] }> = {
  act1_escape: {
    intro: [
      'ACT 1: ESCAPE',
      '',
      'Breaking free from their control.',
      'The laboratory walls are just the beginning.',
      '',
      'Every thought is a weapon.',
      'Every fear is an enemy.',
      'Use what they gave you.',
    ],
    outro: ['The first barriers fall.', 'But deeper realms await...'],
  },
  act2_ocean: {
    intro: [
      'ACT 2: OCEAN',
      '',
      'Submerged in the depths of consciousness.',
      'Ancient memories swim in these waters.',
      '',
      'The pressure builds.',
      'The creatures multiply.',
    ],
    outro: ['You surface, gasping.', 'Heroes await above...'],
  },
  act3_heroic: {
    intro: [
      'ACT 3: HEROIC',
      '',
      'The myths you were raised on.',
      'The heroes you were told to worship.',
      '',
      'Now they stand against you.',
      'Legends become obstacles.',
    ],
    outro: ['The old stories crumble.', 'Something sacred stirs...'],
  },
  act4_sacred: {
    intro: [
      'ACT 4: SACRED',
      '',
      'The temples of belief.',
      'The gods of childhood.',
      '',
      'Faith weaponized.',
      'Devotion turned against you.',
    ],
    outro: ['The altars fall silent.', 'Art awaits...'],
  },
  act5_painted: {
    intro: [
      'ACT 5: PAINTED',
      '',
      'Reality becomes canvas.',
      'Colors bleed meaning.',
      '',
      'Every stroke a thought.',
      'Every hue an emotion.',
    ],
    outro: ['The painting is complete.', 'Knowledge beckons...'],
  },
  act6_library: {
    intro: [
      'ACT 6: LIBRARY',
      '',
      'Infinite corridors of memory.',
      'Every book a suppressed thought.',
      '',
      'Knowledge can be a prison.',
      'Learning can be a trap.',
    ],
    outro: ['The pages close.', 'The machine awakens...'],
  },
  act7_machine: {
    intro: [
      'ACT 7: MACHINE',
      '',
      'The gears of conditioning.',
      'The mechanisms of control.',
      '',
      'You were built for this.',
      'Now break yourself free.',
    ],
    outro: ['The machine stops.', 'One signal remains...'],
  },
  act8_signals: {
    intro: [
      'ACT 8: SIGNALS',
      '',
      'The final transmission.',
      'Beyond all systems. Beyond all control.',
      '',
      'This is it. The edge of consciousness.',
      'The last barrier before freedom.',
    ],
    outro: ['The signal fades.', 'You are free.'],
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

  enter(): void {
    this.context = this.game.getScenes().getLevelStoryContext();
    this.time = 0;
    this.fadeAlpha = 0;
    this.inputCooldown = 0.5;

    if (this.context) {
      // Check Act stories first, then fall back to legacy sector stories
      const story = ACT_STORIES[this.context.sectorId] || SECTOR_STORIES[this.context.sectorId];

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

    // Clear canvas and reset context state
    renderer.context.globalAlpha = 1;
    renderer.fillRect(0, 0, width, height, '#000000');

    renderer.save();
    renderer.setAlpha(this.fadeAlpha);

    // Story text
    const lineHeight = 30;
    const startY = height * 0.3;

    this.lines.forEach((line, index) => {
      const y = startY + index * lineHeight;
      const isTitle = index === 0 && (line.startsWith('SECTOR') || line.startsWith('ACT'));

      if (isTitle) {
        renderer.glowText(line, width / 2, y, CONFIG.COLORS.ACCENT, 28, 'center', 20);
      } else {
        const color = line === '' ? CONFIG.COLORS.TEXT_DIM : CONFIG.COLORS.TEXT;
        renderer.text(line, width / 2, y, color, 18, 'center');
      }
    });

    // Continue hint
    if (this.time > 2) {
      const pulseAlpha = 0.5 + Math.sin(this.time * 3) * 0.3;
      renderer.save();
      renderer.setAlpha(pulseAlpha * this.fadeAlpha);
      renderer.text('PRESS SPACE TO CONTINUE', width / 2, height * 0.88, CONFIG.COLORS.TEXT_DIM, 14, 'center');
      renderer.restore();
    }

    renderer.restore();
  }
}
