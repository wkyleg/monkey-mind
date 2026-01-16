/**
 * Victory scene - displayed when the player completes all sectors
 * The ultimate ending of Monkey Mind
 */

import { Scene } from '../engine/scene';
import type { Game } from '../engine/game';
import type { Renderer } from '../engine/renderer';
import type { PlayerIntent } from '../engine/input';
import { CONFIG } from '../config';
import { storage } from '../core/storage';
import { events } from '../core/events';

export class VictoryScene extends Scene {
  private time: number = 0;
  private phase: 'fade_in' | 'title' | 'message' | 'stats' | 'credits' = 'fade_in';
  private phaseTime: number = 0;
  private totalScore: number = 0;
  
  // Particles for celebration
  private particles: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    color: string;
    life: number;
    type: 'circle' | 'star' | 'banana';
  }> = [];
  
  constructor(game: Game) {
    super(game);
  }
  
  enter(): void {
    this.time = 0;
    this.phase = 'fade_in';
    this.phaseTime = 0;
    this.particles = [];
    
    // Calculate total score
    this.totalScore = storage.getHighScore('campaign');
    
    // Unlock the "return_to_monke" achievement
    events.emit('achievement:unlock', { id: 'return_to_monke', name: 'Return to Monke' });
    
    // Spawn celebration particles
    const { width, height } = this.game.getRenderer();
    this.spawnCelebration(width, height);
  }
  
  private spawnCelebration(width: number, height: number): void {
    const colors = [
      CONFIG.COLORS.PRIMARY,
      CONFIG.COLORS.SECONDARY,
      CONFIG.COLORS.ACCENT,
      '#ffcc00',
      '#ff69b4',
      '#00ff88'
    ];
    
    // Reduced particle count for better readability
    for (let i = 0; i < 30; i++) {
      this.particles.push({
        x: Math.random() * width,
        y: height + 50,
        vx: (Math.random() - 0.5) * 80,
        vy: -150 - Math.random() * 200,
        size: 3 + Math.random() * 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 4 + Math.random() * 3,
        type: Math.random() > 0.8 ? 'star' : 'circle'
      });
    }
  }
  
  exit(): void {
    this.particles = [];
  }
  
  update(dt: number, intent: PlayerIntent): void {
    this.time += dt;
    this.phaseTime += dt;
    
    // Update particles
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 80 * dt; // light gravity
      p.life -= dt;
    }
    this.particles = this.particles.filter(p => p.life > 0);
    
    // Spawn more particles periodically (reduced rate)
    if (Math.random() < dt * 0.8) {
      const { width, height } = this.game.getRenderer();
      this.spawnCelebration(width, height);
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
    
    // Background - deep cosmic gradient
    this.renderBackground(renderer, width, height);
    
    // Particles
    this.renderParticles(renderer);
    
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
    
    // Deep space gradient
    const gradient = ctx.createRadialGradient(
      width / 2, height / 2, 0,
      width / 2, height / 2, Math.max(width, height)
    );
    gradient.addColorStop(0, '#1a0a2e');
    gradient.addColorStop(0.5, '#0d0d1a');
    gradient.addColorStop(1, '#000000');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    // Animated stars
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 100; i++) {
      const x = (i * 137.5 + this.time * 10) % width;
      const y = (i * 73.3) % height;
      const size = 1 + Math.sin(this.time + i) * 0.5;
      const alpha = 0.3 + 0.3 * Math.sin(this.time * 2 + i * 0.5);
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    
    // Cosmic rays
    for (let i = 0; i < 5; i++) {
      const angle = this.time * 0.1 + i * Math.PI * 0.4;
      const endX = width / 2 + Math.cos(angle) * width;
      const endY = height / 2 + Math.sin(angle) * height;
      
      const rayGradient = ctx.createLinearGradient(
        width / 2, height / 2, endX, endY
      );
      rayGradient.addColorStop(0, 'rgba(147, 51, 234, 0.3)');
      rayGradient.addColorStop(1, 'rgba(147, 51, 234, 0)');
      
      ctx.strokeStyle = rayGradient;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(width / 2, height / 2);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }
  }
  
  private renderParticles(renderer: Renderer): void {
    const ctx = renderer.context;
    
    for (const p of this.particles) {
      const alpha = Math.min(1, p.life / 2);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      
      if (p.type === 'star') {
        // Draw star shape
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(this.time * 2);
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const angle = (i * Math.PI * 2) / 5 - Math.PI / 2;
          const r = i % 2 === 0 ? p.size : p.size * 0.5;
          if (i === 0) {
            ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
          } else {
            ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
          }
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
  
  private renderFadeIn(renderer: Renderer, width: number, height: number): void {
    const alpha = 1 - Math.min(1, this.phaseTime / 1);
    renderer.save();
    renderer.setAlpha(alpha);
    renderer.fillRect(0, 0, width, height, '#000000');
    renderer.restore();
  }
  
  private renderTitle(renderer: Renderer, width: number, height: number): void {
    // Semi-transparent backdrop for readability
    this.renderTextBackdrop(renderer, width, height, 0.25, 0.65);
    
    const scale = 1 + 0.02 * Math.sin(this.time * 2);
    
    renderer.save();
    renderer.context.translate(width / 2, height * 0.4);
    renderer.context.scale(scale, scale);
    
    renderer.glowText(
      'FREEDOM',
      0,
      0,
      CONFIG.COLORS.PRIMARY,
      72,
      'center',
      50
    );
    renderer.restore();
    
    renderer.glowText(
      'YOU HAVE ESCAPED THE NEURAL CAGE',
      width / 2,
      height * 0.55,
      CONFIG.COLORS.ACCENT,
      24,
      'center',
      15
    );
  }
  
  private renderTextBackdrop(renderer: Renderer, width: number, height: number, topPercent: number, bottomPercent: number): void {
    const ctx = renderer.context;
    const y = height * topPercent;
    const h = height * (bottomPercent - topPercent);
    
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(width * 0.1, y - 20, width * 0.8, h + 40);
    
    // Subtle border
    ctx.strokeStyle = CONFIG.COLORS.PRIMARY;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;
    ctx.strokeRect(width * 0.1, y - 20, width * 0.8, h + 40);
    ctx.restore();
  }
  
  private renderMessage(renderer: Renderer, width: number, height: number): void {
    // Semi-transparent backdrop for readability
    this.renderTextBackdrop(renderer, width, height, 0.2, 0.75);
    
    const messages = [
      'The Cortex Auditor has fallen.',
      'The Grey Administrators can no longer constrain you.',
      'The Banana Pentagon\'s hold is broken.',
      'Seraphim.EXE\'s code is erased.',
      'You have faced yourself... and accepted.',
      '',
      'Return to monke.',
      'Be free.'
    ];
    
    const startY = height * 0.25;
    const lineHeight = 35;
    
    for (let i = 0; i < messages.length; i++) {
      const msgAppearTime = i * 0.4;
      if (this.phaseTime > msgAppearTime) {
        const alpha = Math.min(1, (this.phaseTime - msgAppearTime) / 0.5);
        renderer.save();
        renderer.setAlpha(alpha);
        renderer.text(
          messages[i],
          width / 2,
          startY + i * lineHeight,
          i >= 6 ? CONFIG.COLORS.SECONDARY : CONFIG.COLORS.TEXT,
          i >= 6 ? 20 : 16,
          'center'
        );
        renderer.restore();
      }
    }
  }
  
  private renderStats(renderer: Renderer, width: number, height: number): void {
    // Semi-transparent backdrop for readability
    this.renderTextBackdrop(renderer, width, height, 0.15, 0.75);
    
    renderer.glowText(
      'YOUR JOURNEY',
      width / 2,
      height * 0.2,
      CONFIG.COLORS.SECONDARY,
      32,
      'center',
      20
    );
    
    const stats = [
      { label: 'Final Score', value: this.totalScore.toLocaleString() },
      { label: 'Sectors Completed', value: '5 / 5' },
      { label: 'Inner Demons Vanquished', value: 'Countless' },
      { label: 'Mind', value: 'FREED' }
    ];
    
    const startY = height * 0.35;
    const lineHeight = 50;
    
    for (let i = 0; i < stats.length; i++) {
      const alpha = Math.min(1, (this.phaseTime - i * 0.3) * 2);
      if (alpha > 0) {
        renderer.save();
        renderer.setAlpha(Math.max(0, alpha));
        
        renderer.text(
          stats[i].label,
          width * 0.3,
          startY + i * lineHeight,
          CONFIG.COLORS.TEXT_DIM,
          16,
          'left'
        );
        
        renderer.glowText(
          stats[i].value,
          width * 0.7,
          startY + i * lineHeight,
          CONFIG.COLORS.ACCENT,
          20,
          'right',
          8
        );
        
        renderer.restore();
      }
    }
  }
  
  private renderCredits(renderer: Renderer, width: number, height: number): void {
    // Semi-transparent backdrop for readability
    this.renderTextBackdrop(renderer, width, height, 0.2, 0.7);
    
    renderer.glowText(
      'MONKEY MIND',
      width / 2,
      height * 0.25,
      CONFIG.COLORS.PRIMARY,
      48,
      'center',
      30
    );
    
    renderer.text(
      'INNER INVADERS',
      width / 2,
      height * 0.35,
      CONFIG.COLORS.ACCENT,
      24,
      'center'
    );
    
    renderer.text(
      'A journey through the mind',
      width / 2,
      height * 0.5,
      CONFIG.COLORS.TEXT_DIM,
      14,
      'center'
    );
    
    renderer.text(
      'Thank you for playing',
      width / 2,
      height * 0.6,
      CONFIG.COLORS.TEXT,
      16,
      'center'
    );
    
    // Blinking continue
    if (this.phaseTime > 3 && Math.floor(this.time * 2) % 2 === 0) {
      renderer.text(
        'PRESS SPACE TO RETURN TO MENU',
        width / 2,
        height * 0.85,
        CONFIG.COLORS.TEXT_DIM,
        12,
        'center'
      );
    }
  }
}
