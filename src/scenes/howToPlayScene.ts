/**
 * How-to-Play scene — multi-page overlay explaining game mechanics
 */

import { CONFIG } from '../config';
import type { PlayerIntent } from '../engine/input';
import type { Renderer } from '../engine/renderer';
import { Scene } from '../engine/scene';

interface HelpPage {
  title: string;
  lines: string[];
}

const PAGES: HelpPage[] = [
  {
    title: 'CONTROLS',
    lines: [
      '← → or A D      Move left / right',
      '↑ ↓ or W S      Move up / down (limited)',
      '',
      'Weapons fire automatically.',
      'Your fire rate and damage depend on your brain state.',
      '',
      'ESC / P          Pause',
      '`  (backtick)    Toggle debug overlay',
    ],
  },
  {
    title: 'NEURO CONNECTION',
    lines: [
      'This game reads your brain signals in real time.',
      '',
      'WEBCAM (rPPG)',
      '  Any browser with a camera.',
      '  Detects heart rate via face blood-flow changes.',
      '  Hold still in good lighting for best results.',
      '',
      'EEG HEADBAND (Muse)',
      '  Requires Chrome/Edge with Web Bluetooth enabled.',
      '  Reads alpha, beta, theta brain waves directly.',
      '  Provides calm and arousal signals.',
    ],
  },
  {
    title: 'WEAPON MODES',
    lines: [
      'Your mental state controls your weapon:',
      '',
      '◎ BEAM   — High calm → precision laser, x3 damage',
      '✦ SPRAY  — High arousal → rapid-fire spread, x2.5 rate',
      '◈ FLOW   — Balanced calm + arousal → homing shots, x2 dmg',
      '• BALANCED — Neutral state → standard fire',
      '',
      'The weapon icon in the brain ring shows your current mode.',
    ],
  },
  {
    title: 'ABILITIES',
    lines: [
      'Sustaining mental states charges special abilities:',
      '',
      'CALM SHIELD',
      '  Maintain calm > 60% to charge.',
      '  At full charge, auto-activates a damage shield.',
      '',
      'AROUSAL OVERDRIVE',
      '  Maintain arousal > 60% to charge.',
      '  At full charge, triggers a burst of bonus damage.',
      '',
      'Charge bars are shown next to the brain ring.',
    ],
  },
  {
    title: 'BRAIN METRICS',
    lines: [
      'The HUD shows live neurological data:',
      '',
      'CALM / AROUSAL — derived from EEG or heart rate',
      'HR (BPM)      — your heart rate, detected by webcam',
      'SIG           — signal quality (higher = more accurate)',
      'α (alpha)     — relaxed attention (EEG only)',
      'β (beta)      — active concentration (EEG only)',
      'θ (theta)     — deep relaxation / drowsiness (EEG only)',
      '',
      'ALPHA BUMP — a sudden spike in alpha waves',
    ],
  },
  {
    title: 'MUSIC & HEART RATE',
    lines: [
      "The game's music is generated in real time.",
      '',
      'When your heart rate is detected, the music tempo',
      'synchronizes to match your pulse — nearly 1:1.',
      '',
      'Each act uses a different musical scale:',
      '  Harmonic minor, Indonesian slendro, Indian bhairav,',
      '  Middle-Eastern hijaz, Japanese hirajoshi, and more.',
      '',
      'Different levels also use different time signatures:',
      '  4/4, 3/4 waltz, 5/4, 7/8, 6/8 compound...',
    ],
  },
];

export class HowToPlayScene extends Scene {
  override readonly isOverlay: boolean = true;

  private currentPage: number = 0;
  private fadeAlpha: number = 0;
  private inputCooldown: number = 0;
  private time: number = 0;

  enter(): void {
    this.currentPage = 0;
    this.fadeAlpha = 0;
    this.inputCooldown = 0.3;
    this.time = 0;
  }

  exit(): void {}

  update(dt: number, intent: PlayerIntent): void {
    this.time += dt;
    this.inputCooldown = Math.max(0, this.inputCooldown - dt);
    this.fadeAlpha = Math.min(1, this.fadeAlpha + dt * 4);

    if (this.inputCooldown > 0) return;

    if (intent.cancel) {
      this.game.getScenes().pop();
      return;
    }

    if (intent.confirm || intent.menuAxis > 0.5) {
      this.currentPage++;
      this.inputCooldown = 0.2;
      this.fadeAlpha = 0.3;
      if (this.currentPage >= PAGES.length) {
        this.game.getScenes().pop();
      }
      return;
    }

    if (intent.menuAxis < -0.5 && this.currentPage > 0) {
      this.currentPage--;
      this.inputCooldown = 0.2;
      this.fadeAlpha = 0.3;
    }
  }

  render(renderer: Renderer, _alpha: number): void {
    const { width, height } = renderer;
    const ctx = renderer.context;

    ctx.globalAlpha = 1;
    ctx.save();
    ctx.globalAlpha = 0.85;
    renderer.fillRect(0, 0, width, height, '#000000');
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = this.fadeAlpha;

    const page = PAGES[this.currentPage];

    renderer.glowText(page.title, width / 2, height * 0.12, CONFIG.COLORS.PRIMARY, 32, 'center', 20);

    const lineH = 24;
    const startY = height * 0.22;
    for (let i = 0; i < page.lines.length; i++) {
      const line = page.lines[i];
      if (line === '') continue;
      const isLabel = line === line.toUpperCase() && !line.includes('—') && !line.includes('→') && line.length < 25;
      const color = isLabel ? CONFIG.COLORS.PRIMARY : CONFIG.COLORS.TEXT;
      const size = isLabel ? 16 : 14;
      renderer.text(line, width * 0.15, startY + i * lineH, color, size, 'left');
    }

    const pageLabel = `${this.currentPage + 1} / ${PAGES.length}`;
    renderer.text(pageLabel, width / 2, height * 0.88, CONFIG.COLORS.TEXT_DIM, 14, 'center');

    renderer.text(
      '← PREV    SPACE / → NEXT    ESC CLOSE',
      width / 2,
      height * 0.94,
      CONFIG.COLORS.TEXT_DIM,
      12,
      'center',
    );

    ctx.restore();
  }
}
