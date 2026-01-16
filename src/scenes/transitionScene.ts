/**
 * Sector transition scene - displayed between sectors
 * Shows cinematic sector completion with unlock notifications
 */

import { Scene } from '../engine/scene';
import type { Game } from '../engine/game';
import type { Renderer } from '../engine/renderer';
import type { PlayerIntent } from '../engine/input';
import { CONFIG } from '../config';
import { storage } from '../core/storage';
import { contentLoader } from '../content/loader';
import { drawBackground, getBackgroundForSector } from '../graphics/backgrounds';

interface TransitionContext {
  completedSector: number;
  nextSector: number;
  score: number;
  unlocks: string[];
}

export class TransitionScene extends Scene {
  private context: TransitionContext | null = null;
  private time: number = 0;
  private phase: 'fade_in' | 'show_complete' | 'show_unlocks' | 'show_next' | 'fade_out' = 'fade_in';
  private phaseTime: number = 0;
  
  private completedSectorData: { id: string; name: string } | null = null;
  private nextSectorData: { id: string; name: string } | null = null;
  private unlockMessages: string[] = [];
  private canSkip: boolean = false;
  
  // Visual effects
  private particles: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    color: string;
    life: number;
  }> = [];
  
  constructor(game: Game) {
    super(game);
  }
  
  enter(): void {
    this.time = 0;
    this.phase = 'fade_in';
    this.phaseTime = 0;
    this.canSkip = false;
    this.particles = [];
    
    // Get context from scene manager
    const ctx = this.game.getScenes().getTransitionContext();
    if (ctx) {
      this.context = ctx;
    } else {
      // Default context for testing
      this.context = {
        completedSector: 1,
        nextSector: 2,
        score: 0,
        unlocks: []
      };
    }
    
    // Load sector data
    const sectors = contentLoader.getAllSectors();
    if (this.context.completedSector > 0 && this.context.completedSector <= sectors.length) {
      const sector = sectors[this.context.completedSector - 1];
      this.completedSectorData = { id: sector.id, name: sector.name };
    }
    
    if (this.context.nextSector > 0 && this.context.nextSector <= sectors.length) {
      const sector = sectors[this.context.nextSector - 1];
      this.nextSectorData = { id: sector.id, name: sector.name };
      
      // Unlock next sector
      storage.highestSector = Math.max(storage.highestSector, this.context.nextSector);
    }
    
    // Build unlock messages
    this.unlockMessages = [];
    for (const unlock of this.context.unlocks) {
      if (unlock.startsWith('powerup:')) {
        const id = unlock.replace('powerup:', '');
        this.unlockMessages.push(`🍌 Power-up Unlocked: ${id.replace(/_/g, ' ').toUpperCase()}`);
      } else if (unlock.startsWith('codex:')) {
        const id = unlock.replace('codex:', '');
        storage.unlockCodex(id);
        this.unlockMessages.push(`📖 Codex Entry: ${id.replace(/_/g, ' ').toUpperCase()}`);
      } else if (unlock.startsWith('cosmetic:')) {
        const id = unlock.replace('cosmetic:', '');
        storage.unlockCosmetic(id);
        this.unlockMessages.push(`✨ Cosmetic Unlocked: ${id.replace(/_/g, ' ').toUpperCase()}`);
      }
    }
    
    // Create celebration particles
    const { width, height } = this.game.getRenderer();
    this.spawnCelebrationParticles(width, height);
    
    // Play celebration audio
    this.game.getAudio().playPowerup();
  }
  
  private spawnCelebrationParticles(width: number, height: number): void {
    const colors = [CONFIG.COLORS.PRIMARY, CONFIG.COLORS.SECONDARY, CONFIG.COLORS.ACCENT, '#ffffff', '#ffcc00'];
    
    for (let i = 0; i < 50; i++) {
      this.particles.push({
        x: width / 2 + (Math.random() - 0.5) * 100,
        y: height / 2,
        vx: (Math.random() - 0.5) * 200,
        vy: -100 - Math.random() * 200,
        size: 3 + Math.random() * 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 2 + Math.random() * 2
      });
    }
  }
  
  exit(): void {
    this.context = null;
    this.particles = [];
    this.game.getScenes().clearTransitionContext();
  }
  
  update(dt: number, intent: PlayerIntent): void {
    this.time += dt;
    this.phaseTime += dt;
    
    // Update particles
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 150 * dt; // gravity
      p.life -= dt;
    }
    this.particles = this.particles.filter(p => p.life > 0);
    
    // Phase transitions
    switch (this.phase) {
      case 'fade_in':
        if (this.phaseTime > 0.5) {
          this.phase = 'show_complete';
          this.phaseTime = 0;
        }
        break;
        
      case 'show_complete':
        if (this.phaseTime > 2) {
          if (this.unlockMessages.length > 0) {
            this.phase = 'show_unlocks';
          } else if (this.nextSectorData) {
            this.phase = 'show_next';
          } else {
            this.canSkip = true;
          }
          this.phaseTime = 0;
        }
        break;
        
      case 'show_unlocks':
        if (this.phaseTime > 1.5 * this.unlockMessages.length + 1) {
          if (this.nextSectorData) {
            this.phase = 'show_next';
          } else {
            this.canSkip = true;
          }
          this.phaseTime = 0;
        }
        break;
        
      case 'show_next':
        if (this.phaseTime > 2) {
          this.canSkip = true;
        }
        break;
        
      case 'fade_out':
        if (this.phaseTime > 0.5) {
          // Pop back to campaign scene
          this.game.getScenes().pop();
        }
        break;
    }
    
    // Skip with confirm
    if (this.canSkip && intent.confirm) {
      if (this.phase !== 'fade_out') {
        this.phase = 'fade_out';
        this.phaseTime = 0;
      }
    }
  }
  
  render(renderer: Renderer, _alpha: number): void {
    const { width, height } = renderer;
    
    // Background - blend between completed and next sector backgrounds
    const bgType = getBackgroundForSector(this.context?.completedSector || 1);
    drawBackground(renderer, bgType, width, height, this.time);
    
    // Dark overlay
    renderer.save();
    renderer.setAlpha(0.7);
    renderer.fillRect(0, 0, width, height, '#000000');
    renderer.restore();
    
    // Particles
    for (const p of this.particles) {
      const alpha = Math.min(1, p.life);
      renderer.save();
      renderer.setAlpha(alpha);
      renderer.context.beginPath();
      renderer.context.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      renderer.context.fillStyle = p.color;
      renderer.context.fill();
      renderer.restore();
    }
    
    // Phase-based content
    switch (this.phase) {
      case 'fade_in':
        this.renderFadeIn(renderer, width, height);
        break;
        
      case 'show_complete':
        this.renderSectorComplete(renderer, width, height);
        break;
        
      case 'show_unlocks':
        this.renderUnlocks(renderer, width, height);
        break;
        
      case 'show_next':
        this.renderNextSector(renderer, width, height);
        break;
        
      case 'fade_out':
        this.renderFadeOut(renderer, width, height);
        break;
    }
    
    // Skip prompt
    if (this.canSkip && Math.floor(this.time * 2) % 2 === 0) {
      renderer.text(
        'PRESS SPACE TO CONTINUE',
        width / 2,
        height - 40,
        CONFIG.COLORS.TEXT_DIM,
        12,
        'center'
      );
    }
  }
  
  private renderFadeIn(renderer: Renderer, width: number, height: number): void {
    const alpha = Math.min(1, this.phaseTime / 0.5);
    renderer.save();
    renderer.setAlpha(alpha);
    renderer.glowText(
      'SECTOR COMPLETE',
      width / 2,
      height / 2,
      CONFIG.COLORS.PRIMARY,
      48,
      'center',
      30
    );
    renderer.restore();
  }
  
  private renderSectorComplete(renderer: Renderer, width: number, height: number): void {
    // Title
    renderer.glowText(
      'SECTOR COMPLETE',
      width / 2,
      height * 0.3,
      CONFIG.COLORS.PRIMARY,
      48,
      'center',
      30
    );
    
    // Sector name
    if (this.completedSectorData) {
      renderer.glowText(
        this.completedSectorData.name.toUpperCase(),
        width / 2,
        height * 0.45,
        CONFIG.COLORS.ACCENT,
        32,
        'center',
        15
      );
    }
    
    // Score
    renderer.glowText(
      `SCORE: ${this.context?.score || 0}`,
      width / 2,
      height * 0.6,
      CONFIG.COLORS.SECONDARY,
      24,
      'center',
      10
    );
  }
  
  private renderUnlocks(renderer: Renderer, width: number, height: number): void {
    // Title
    renderer.glowText(
      'UNLOCKS',
      width / 2,
      height * 0.25,
      CONFIG.COLORS.SECONDARY,
      36,
      'center',
      20
    );
    
    // Unlock messages with staggered appearance
    const startY = height * 0.4;
    const lineHeight = 40;
    
    for (let i = 0; i < this.unlockMessages.length; i++) {
      const msgAppearTime = i * 0.5;
      if (this.phaseTime > msgAppearTime) {
        const alpha = Math.min(1, (this.phaseTime - msgAppearTime) / 0.3);
        const yOffset = Math.max(0, 20 * (1 - alpha));
        
        renderer.save();
        renderer.setAlpha(alpha);
        renderer.glowText(
          this.unlockMessages[i],
          width / 2,
          startY + i * lineHeight - yOffset,
          CONFIG.COLORS.TEXT,
          18,
          'center',
          8
        );
        renderer.restore();
      }
    }
  }
  
  private renderNextSector(renderer: Renderer, width: number, height: number): void {
    // Title
    renderer.glowText(
      'NEXT SECTOR',
      width / 2,
      height * 0.3,
      CONFIG.COLORS.TEXT_DIM,
      24,
      'center',
      10
    );
    
    // Next sector name
    if (this.nextSectorData) {
      const pulseScale = 1 + 0.05 * Math.sin(this.time * 3);
      renderer.save();
      renderer.context.translate(width / 2, height * 0.5);
      renderer.context.scale(pulseScale, pulseScale);
      renderer.glowText(
        this.nextSectorData.name.toUpperCase(),
        0,
        0,
        CONFIG.COLORS.ACCENT,
        42,
        'center',
        25
      );
      renderer.restore();
    }
    
    // Sector number
    renderer.text(
      `SECTOR ${this.context?.nextSector || '?'}`,
      width / 2,
      height * 0.65,
      CONFIG.COLORS.TEXT_DIM,
      16,
      'center'
    );
  }
  
  private renderFadeOut(renderer: Renderer, width: number, height: number): void {
    const alpha = 1 - Math.min(1, this.phaseTime / 0.5);
    renderer.save();
    renderer.setAlpha(alpha);
    renderer.glowText(
      'LOADING...',
      width / 2,
      height / 2,
      CONFIG.COLORS.TEXT,
      24,
      'center',
      10
    );
    renderer.restore();
    
    // Full black overlay
    renderer.save();
    renderer.setAlpha(Math.min(1, this.phaseTime / 0.5));
    renderer.fillRect(0, 0, width, height, '#000000');
    renderer.restore();
  }
}
