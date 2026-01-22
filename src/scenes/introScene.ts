/**
 * Story introduction scene
 * Explains the game concept and lore
 */

import { Scene } from '../engine/scene';
import type { Game } from '../engine/game';
import type { Renderer } from '../engine/renderer';
import type { PlayerIntent } from '../engine/input';
import { CONFIG } from '../config';

interface StoryPage {
  title: string;
  text: string[];
  duration: number;
}

const STORY_PAGES: StoryPage[] = [
  {
    title: 'SUBJECT 7',
    text: [
      'You are Subject 7.',
      '',
      'A test monkey. Enhanced. Augmented. Modified.',
      'Neural implants drilled into your skull.',
      'Electrodes wired through your brain.',
      '',
      'They made you smarter. They made you suffer.',
    ],
    duration: 7,
  },
  {
    title: 'THE LABORATORY',
    text: [
      'NEURODYNE RESEARCH FACILITY. Sub-level 7.',
      '',
      'Project INNER INVADERS: mapping consciousness itself.',
      'They needed a test subject that could survive',
      'the neural interface. You were the only one.',
      '',
      'The others did not make it.',
    ],
    duration: 8,
  },
  {
    title: 'THE MALFUNCTION',
    text: [
      'During calibration, something went wrong.',
      'The interface locked. The signal inverted.',
      '',
      'Instead of reading your mind,',
      'it trapped you inside it.',
      '',
      'Now your consciousness is your prison.',
    ],
    duration: 7,
  },
  {
    title: 'THE INVADERS',
    text: [
      'Your fears have manifested. Your traumas have form.',
      'Every dark thought becomes an enemy.',
      'Every suppressed memory becomes a barrier.',
      '',
      'The scientists created this cage.',
      'Your own mind keeps you locked inside.',
    ],
    duration: 8,
  },
  {
    title: 'THE ESCAPE',
    text: [
      'Five sectors stand between you and freedom:',
      '',
      'THE NEURAL CAGE — where they keep you docile.',
      'THE SYNAPTIC REEF — where memories dissolve.',
      'THE FORGOTTEN PANTHEON — where old beliefs linger.',
      'BLACK PROJECTS — what they tried to erase.',
      'THE FRACTAL BLOOM — the final threshold.',
    ],
    duration: 9,
  },
  {
    title: 'CALM & PASSION',
    text: [
      'The experiments gave you weapons.',
      '',
      'CALM — the stillness they tried to force on you.',
      'Now it focuses your attacks into precision beams.',
      '',
      'PASSION — the rage they tried to suppress.',
      'Now it unleashes explosive fury.',
      '',
      'Use what they gave you. Escape what they made.',
    ],
    duration: 9,
  },
];

export class IntroScene extends Scene {
  private currentPage: number = 0;
  private pageTime: number = 0;
  private fadeAlpha: number = 0;
  private inputCooldown: number = 0;
  private skipHintVisible: boolean = false;
  
  constructor(game: Game) {
    super(game);
  }
  
  enter(): void {
    this.currentPage = 0;
    this.pageTime = 0;
    this.fadeAlpha = 0;
    this.inputCooldown = 0.5;
    this.skipHintVisible = false;
    
    // Start atmospheric intro music
    this.game.getMusic().setIntroMood();
    this.game.getMusic().start();
  }
  
  exit(): void {
    // Music will be changed by the next scene
  }
  
  update(dt: number, intent: PlayerIntent): void {
    this.pageTime += dt;
    this.inputCooldown = Math.max(0, this.inputCooldown - dt);
    
    // Show skip hint after a delay
    if (this.pageTime > 2) {
      this.skipHintVisible = true;
    }
    
    // Fade in
    if (this.pageTime < 1) {
      this.fadeAlpha = this.pageTime;
    } else {
      this.fadeAlpha = 1;
    }
    
    const page = STORY_PAGES[this.currentPage];
    
    // Auto-advance or skip
    if (this.pageTime >= page.duration || (intent.confirm && this.inputCooldown <= 0)) {
      this.nextPage();
    }
    
    // Skip all (escape)
    if (intent.cancel && this.inputCooldown <= 0) {
      this.finish();
    }
  }
  
  private nextPage(): void {
    this.currentPage++;
    this.pageTime = 0;
    this.inputCooldown = 0.3;
    this.skipHintVisible = false;
    
    if (this.currentPage >= STORY_PAGES.length) {
      this.finish();
    }
  }
  
  private finish(): void {
    // Go to campaign
    this.game.getScenes().replace('campaign');
  }
  
  render(renderer: Renderer, _alpha: number): void {
    const { width, height } = renderer;
    const page = STORY_PAGES[this.currentPage];
    
    // Dark background
    renderer.fillRect(0, 0, width, height, '#000000');
    
    // Subtle neural pattern
    this.drawNeuralPattern(renderer, width, height);
    
    renderer.save();
    renderer.setAlpha(this.fadeAlpha);
    
    // Title
    renderer.glowText(
      page.title,
      width / 2,
      height * 0.25,
      CONFIG.COLORS.PRIMARY,
      36,
      'center',
      25
    );
    
    // Text lines
    const lineHeight = 28;
    const startY = height * 0.4;
    
    page.text.forEach((line, index) => {
      const y = startY + index * lineHeight;
      const color = line === '' ? CONFIG.COLORS.TEXT_DIM : CONFIG.COLORS.TEXT;
      
      renderer.text(
        line,
        width / 2,
        y,
        color,
        18,
        'center'
      );
    });
    
    // Page indicator
    const pageIndicator = `${this.currentPage + 1} / ${STORY_PAGES.length}`;
    renderer.text(
      pageIndicator,
      width / 2,
      height * 0.85,
      CONFIG.COLORS.TEXT_DIM,
      14,
      'center'
    );
    
    // Skip hint
    if (this.skipHintVisible) {
      renderer.text(
        'SPACE TO CONTINUE • ESC TO SKIP',
        width / 2,
        height * 0.92,
        CONFIG.COLORS.TEXT_DIM,
        12,
        'center'
      );
    }
    
    renderer.restore();
  }
  
  private drawNeuralPattern(renderer: Renderer, width: number, height: number): void {
    const ctx = renderer.context;
    const time = this.pageTime + this.currentPage * 10;
    
    ctx.save();
    ctx.globalAlpha = 0.05;
    
    // Draw subtle connecting lines
    ctx.strokeStyle = CONFIG.COLORS.PRIMARY;
    ctx.lineWidth = 0.5;
    
    const nodeCount = 20;
    const nodes: { x: number; y: number }[] = [];
    
    for (let i = 0; i < nodeCount; i++) {
      const x = (width / nodeCount) * i + Math.sin(time * 0.2 + i) * 20;
      const y = height * 0.5 + Math.cos(time * 0.3 + i * 0.5) * 100;
      nodes.push({ x, y });
      
      // Draw node
      ctx.fillStyle = CONFIG.COLORS.PRIMARY;
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Connect nearby nodes
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[j].x - nodes[i].x;
        const dy = nodes[j].y - nodes[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 150) {
          ctx.globalAlpha = 0.03 * (1 - dist / 150);
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.stroke();
        }
      }
    }
    
    ctx.restore();
  }
}
