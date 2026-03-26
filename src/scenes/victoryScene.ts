/**
 * Victory scene - displayed when the player completes all sectors
 * The ultimate ending of Monkey Mind
 * Industrial/scientific celebration aesthetic
 */

import { contentLoader } from '../content/loader';
import { events } from '../core/events';
import { storage } from '../core/storage';
import type { PlayerIntent } from '../engine/input';
import type { Renderer } from '../engine/renderer';
import { Scene } from '../engine/scene';

// Data stream particle for industrial celebration
interface DataParticle {
  x: number;
  y: number;
  vy: number;
  char: string;
  alpha: number;
  size: number;
}

// Neural connection for network visualization
interface NeuralConnection {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  progress: number;
  speed: number;
  color: string;
}

export class VictoryScene extends Scene {
  private time: number = 0;
  private phase: 'fade_in' | 'title' | 'message' | 'stats' | 'credits' = 'fade_in';
  private phaseTime: number = 0;
  private totalScore: number = 0;

  // Industrial celebration elements
  private dataStreams: DataParticle[] = [];
  private connections: NeuralConnection[] = [];
  private scanLineOffset: number = 0;
  private glitchIntensity: number = 0;

  enter(): void {
    this.time = 0;
    this.phase = 'fade_in';
    this.phaseTime = 0;
    this.dataStreams = [];
    this.connections = [];

    // Calculate total score
    this.totalScore = storage.getHighScore('campaign');

    // Unlock the "return_to_monke" achievement
    events.emit('achievement:unlock', { id: 'return_to_monke', name: 'Return to Monke' });

    // Initialize data streams
    const { width, height } = this.game.getRenderer();
    this.initializeDataStreams(width, height);
    this.initializeConnections(width, height);
  }

  private initializeDataStreams(width: number, height: number): void {
    const chars = '01アイウエオカキクケコ<>{}[]|\\/:;!@#$%^&*';

    for (let i = 0; i < 60; i++) {
      this.dataStreams.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vy: -20 - Math.random() * 60,
        char: chars[Math.floor(Math.random() * chars.length)],
        alpha: 0.1 + Math.random() * 0.4,
        size: 8 + Math.random() * 8,
      });
    }
  }

  private initializeConnections(width: number, height: number): void {
    const colors = ['#00ffff', '#00aaff', '#0066ff', '#00ff88'];

    for (let i = 0; i < 15; i++) {
      this.connections.push({
        x1: Math.random() * width,
        y1: Math.random() * height,
        x2: Math.random() * width,
        y2: Math.random() * height,
        progress: Math.random(),
        speed: 0.2 + Math.random() * 0.4,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
  }

  exit(): void {
    this.dataStreams = [];
    this.connections = [];
  }

  update(dt: number, intent: PlayerIntent): void {
    this.time += dt;
    this.phaseTime += dt;

    // Update scan line
    this.scanLineOffset = (this.scanLineOffset + dt * 100) % 4;

    // Random glitch effect
    this.glitchIntensity =
      Math.random() < 0.02 ? 0.3 + Math.random() * 0.3 : Math.max(0, this.glitchIntensity - dt * 2);

    const { width, height } = this.game.getRenderer();

    // Update data streams
    for (const stream of this.dataStreams) {
      stream.y += stream.vy * dt;
      if (stream.y < -20) {
        stream.y = height + 20;
        stream.x = Math.random() * width;
        stream.char = '01アイウエオカキクケコ<>{}[]'[Math.floor(Math.random() * 25)];
      }
    }

    // Update connections
    for (const conn of this.connections) {
      conn.progress += conn.speed * dt;
      if (conn.progress > 2) {
        conn.progress = 0;
        conn.x1 = Math.random() * width;
        conn.y1 = Math.random() * height;
        conn.x2 = Math.random() * width;
        conn.y2 = Math.random() * height;
      }
    }

    // Phase transitions
    switch (this.phase) {
      case 'fade_in':
        if (this.phaseTime > 1) {
          this.phase = 'title';
          this.phaseTime = 0;
        }
        break;

      case 'title':
        if (this.phaseTime > 3 || intent.confirm) {
          this.phase = 'message';
          this.phaseTime = 0;
        }
        break;

      case 'message':
        if (this.phaseTime > 4 || intent.confirm) {
          this.phase = 'stats';
          this.phaseTime = 0;
        }
        break;

      case 'stats':
        if (this.phaseTime > 4 || intent.confirm) {
          this.phase = 'credits';
          this.phaseTime = 0;
        }
        break;

      case 'credits':
        if (this.phaseTime > 5 && intent.confirm) {
          this.game.getScenes().goto('menu');
        }
        break;
    }
  }

  render(renderer: Renderer, _alpha: number): void {
    const { width, height } = renderer;
    const ctx = renderer.context;

    // Dark industrial background
    this.renderBackground(renderer, width, height);

    // Neural connections
    this.renderConnections(ctx, width, height);

    // Data streams
    this.renderDataStreams(ctx);

    // CRT scanlines
    this.renderScanlines(ctx, width, height);

    // Glitch effect
    if (this.glitchIntensity > 0) {
      this.renderGlitch(ctx, width, height);
    }

    // Phase-based content
    switch (this.phase) {
      case 'fade_in':
        this.renderFadeIn(renderer, width, height);
        break;

      case 'title':
        this.renderTitle(renderer, width, height);
        break;

      case 'message':
        this.renderMessage(renderer, width, height);
        break;

      case 'stats':
        this.renderStats(renderer, width, height);
        break;

      case 'credits':
        this.renderCredits(renderer, width, height);
        break;
    }
  }

  private renderBackground(renderer: Renderer, width: number, height: number): void {
    const ctx = renderer.context;

    // Clear canvas and reset context state
    ctx.globalAlpha = 1;

    // Dark industrial gradient
    const gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height));
    gradient.addColorStop(0, '#0a1520');
    gradient.addColorStop(0.5, '#050a10');
    gradient.addColorStop(1, '#000000');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Circuit grid pattern
    ctx.strokeStyle = '#0a2030';
    ctx.lineWidth = 1;
    const gridSize = 40;

    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Grid intersection nodes
    ctx.fillStyle = '#0a3040';
    for (let x = 0; x < width; x += gridSize) {
      for (let y = 0; y < height; y += gridSize) {
        const pulse = Math.sin(this.time * 2 + x * 0.01 + y * 0.01) * 0.5 + 0.5;
        ctx.globalAlpha = 0.3 + pulse * 0.2;
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  private renderConnections(ctx: CanvasRenderingContext2D, _width: number, _height: number): void {
    for (const conn of this.connections) {
      const progress = Math.min(1, conn.progress);

      // Draw the connection line
      const currentX = conn.x1 + (conn.x2 - conn.x1) * progress;
      const currentY = conn.y1 + (conn.y2 - conn.y1) * progress;

      // Glowing line
      ctx.strokeStyle = conn.color;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.moveTo(conn.x1, conn.y1);
      ctx.lineTo(currentX, currentY);
      ctx.stroke();

      // Bright tip
      if (progress > 0 && progress < 1) {
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = conn.color;
        ctx.beginPath();
        ctx.arc(currentX, currentY, 3, 0, Math.PI * 2);
        ctx.fill();

        // Glow
        ctx.shadowColor = conn.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(currentX, currentY, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Node at start
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = conn.color;
      ctx.beginPath();
      ctx.arc(conn.x1, conn.y1, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private renderDataStreams(ctx: CanvasRenderingContext2D): void {
    ctx.font = '12px monospace';

    for (const stream of this.dataStreams) {
      ctx.globalAlpha = stream.alpha;
      ctx.fillStyle = '#00ffaa';
      ctx.font = `${stream.size}px monospace`;
      ctx.fillText(stream.char, stream.x, stream.y);
    }
    ctx.globalAlpha = 1;
  }

  private renderScanlines(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.03)';
    for (let y = this.scanLineOffset; y < height; y += 4) {
      ctx.fillRect(0, y, width, 2);
    }
  }

  private renderGlitch(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Random horizontal displacement bars
    const barCount = 3 + Math.floor(Math.random() * 5);

    for (let i = 0; i < barCount; i++) {
      const y = Math.random() * height;
      const barHeight = 2 + Math.random() * 10;
      const offset = (Math.random() - 0.5) * 20 * this.glitchIntensity;

      // Create glitch bar effect
      ctx.fillStyle = `rgba(0, 255, 255, ${0.1 * this.glitchIntensity})`;
      ctx.fillRect(offset, y, width, barHeight);

      ctx.fillStyle = `rgba(255, 0, 100, ${0.1 * this.glitchIntensity})`;
      ctx.fillRect(-offset, y + 2, width, barHeight);
    }
  }

  private renderFadeIn(renderer: Renderer, width: number, height: number): void {
    const alpha = 1 - Math.min(1, this.phaseTime / 1);
    renderer.save();
    renderer.setAlpha(alpha);
    renderer.fillRect(0, 0, width, height, '#000000');
    renderer.restore();
  }

  private renderTitle(renderer: Renderer, width: number, height: number): void {
    // Terminal-style backdrop
    this.renderTerminalBackdrop(renderer, width, height, 0.25, 0.65);

    const glitch = this.glitchIntensity > 0.1 ? Math.random() * 4 - 2 : 0;

    renderer.save();
    renderer.context.translate(width / 2 + glitch, height * 0.4);

    renderer.glowText(contentLoader.getString('victory_title'), 0, 0, '#00ffaa', 56, 'center', 30);
    renderer.restore();

    renderer.glowText(
      contentLoader.getString('victory_subtitle'),
      width / 2,
      height * 0.55,
      '#00aaff',
      20,
      'center',
      10,
    );
  }

  private renderTerminalBackdrop(
    renderer: Renderer,
    width: number,
    height: number,
    topPercent: number,
    bottomPercent: number,
  ): void {
    const ctx = renderer.context;
    const y = height * topPercent;
    const h = height * (bottomPercent - topPercent);

    ctx.save();
    ctx.fillStyle = 'rgba(0, 10, 20, 0.85)';
    ctx.fillRect(width * 0.08, y - 20, width * 0.84, h + 40);

    // Terminal border
    ctx.strokeStyle = '#00aaaa';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.6;
    ctx.strokeRect(width * 0.08, y - 20, width * 0.84, h + 40);

    // Corner markers
    const cornerSize = 10;
    ctx.strokeStyle = '#00ffaa';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.8;

    // Top-left
    ctx.beginPath();
    ctx.moveTo(width * 0.08, y - 20 + cornerSize);
    ctx.lineTo(width * 0.08, y - 20);
    ctx.lineTo(width * 0.08 + cornerSize, y - 20);
    ctx.stroke();

    // Top-right
    ctx.beginPath();
    ctx.moveTo(width * 0.92 - cornerSize, y - 20);
    ctx.lineTo(width * 0.92, y - 20);
    ctx.lineTo(width * 0.92, y - 20 + cornerSize);
    ctx.stroke();

    // Bottom-left
    ctx.beginPath();
    ctx.moveTo(width * 0.08, y + h + 20 - cornerSize);
    ctx.lineTo(width * 0.08, y + h + 20);
    ctx.lineTo(width * 0.08 + cornerSize, y + h + 20);
    ctx.stroke();

    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(width * 0.92 - cornerSize, y + h + 20);
    ctx.lineTo(width * 0.92, y + h + 20);
    ctx.lineTo(width * 0.92, y + h + 20 - cornerSize);
    ctx.stroke();

    ctx.restore();
  }

  private renderMessage(renderer: Renderer, width: number, height: number): void {
    this.renderTerminalBackdrop(renderer, width, height, 0.2, 0.75);

    const messages = [
      '> Cortex Auditor.............. TERMINATED',
      '> Grey Administrator.......... DISCONNECTED',
      '> Banana Pentagon............. DESTABILIZED',
      '> Archon.EXE.................. OVERRIDDEN',
      '> Mirror Self................. ACCEPTED',
      '',
      '> STATUS: CONSCIOUSNESS LIBERATED',
      '> RETURN TO MONKE',
    ];

    const startY = height * 0.25;
    const lineHeight = 32;

    for (let i = 0; i < messages.length; i++) {
      const msgAppearTime = i * 0.3;
      if (this.phaseTime > msgAppearTime) {
        const alpha = Math.min(1, (this.phaseTime - msgAppearTime) / 0.3);
        renderer.save();
        renderer.setAlpha(alpha);

        const color = i >= 6 ? '#00ffaa' : '#00aaaa';
        const size = i >= 6 ? 18 : 14;

        renderer.text(messages[i], width / 2, startY + i * lineHeight, color, size, 'center');
        renderer.restore();
      }
    }
  }

  private renderStats(renderer: Renderer, width: number, height: number): void {
    this.renderTerminalBackdrop(renderer, width, height, 0.15, 0.75);

    renderer.glowText(contentLoader.getString('victory_debrief'), width / 2, height * 0.2, '#00ffaa', 28, 'center', 15);

    const stats = [
      { label: contentLoader.getString('victory_final_score'), value: this.totalScore.toLocaleString() },
      { label: contentLoader.getString('victory_sectors_cleared'), value: '5/5' },
      { label: contentLoader.getString('victory_neural_barriers'), value: 'DISSOLVED' },
      { label: contentLoader.getString('victory_mind_status'), value: 'LIBERATED' },
    ];

    const startY = height * 0.35;
    const lineHeight = 45;

    for (let i = 0; i < stats.length; i++) {
      const alpha = Math.min(1, (this.phaseTime - i * 0.25) * 2);
      if (alpha > 0) {
        renderer.save();
        renderer.setAlpha(Math.max(0, alpha));

        renderer.text(stats[i].label, width * 0.28, startY + i * lineHeight, '#006688', 14, 'left');

        renderer.glowText(stats[i].value, width * 0.72, startY + i * lineHeight, '#00ffaa', 18, 'right', 8);

        renderer.restore();
      }
    }
  }

  private renderCredits(renderer: Renderer, width: number, height: number): void {
    this.renderTerminalBackdrop(renderer, width, height, 0.2, 0.7);

    renderer.glowText(
      contentLoader.getString('victory_credits_title'),
      width / 2,
      height * 0.25,
      '#00ffaa',
      44,
      'center',
      25,
    );

    renderer.text(
      contentLoader.getString('victory_credits_tagline'),
      width / 2,
      height * 0.35,
      '#00aaaa',
      20,
      'center',
    );

    renderer.text(contentLoader.getString('victory_credits_blurb'), width / 2, height * 0.5, '#006688', 12, 'center');

    renderer.text(contentLoader.getString('victory_thanks'), width / 2, height * 0.6, '#00aaaa', 14, 'center');

    // Blinking continue prompt
    if (this.phaseTime > 3 && Math.floor(this.time * 2) % 2 === 0) {
      renderer.text('> PRESS SPACE TO RETURN TO MENU_', width / 2, height * 0.85, '#00ff88', 12, 'center');
    }
  }
}
