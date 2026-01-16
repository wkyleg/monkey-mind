/**
 * Particle system
 */

import type { Renderer } from '../engine/renderer';
import { rng } from '../util/rng';
import { hexToRgba } from '../util/color';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  type: 'circle' | 'spark' | 'trail';
  gravity?: number;
  friction?: number;
}

export class ParticleSystem {
  private particles: Particle[] = [];
  private readonly maxParticles: number = 500;
  
  /**
   * Emit particles at a position
   */
  emit(
    x: number,
    y: number,
    count: number,
    options: Partial<{
      color: string;
      speed: number;
      speedVariance: number;
      angle: number;
      angleSpread: number;
      life: number;
      lifeVariance: number;
      size: number;
      sizeVariance: number;
      type: Particle['type'];
      gravity: number;
      friction: number;
    }> = {}
  ): void {
    const {
      color = '#ffffff',
      speed = 100,
      speedVariance = 50,
      angle = 0,
      angleSpread = Math.PI * 2,
      life = 1,
      lifeVariance = 0.3,
      size = 5,
      sizeVariance = 2,
      type = 'circle',
      gravity = 0,
      friction = 0.98,
    } = options;
    
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;
      
      const particleAngle = angle + (rng.random() - 0.5) * angleSpread;
      const particleSpeed = speed + (rng.random() - 0.5) * speedVariance;
      const particleLife = life + (rng.random() - 0.5) * lifeVariance;
      const particleSize = size + (rng.random() - 0.5) * sizeVariance;
      
      this.particles.push({
        x,
        y,
        vx: Math.cos(particleAngle) * particleSpeed,
        vy: Math.sin(particleAngle) * particleSpeed,
        life: particleLife,
        maxLife: particleLife,
        size: particleSize,
        color,
        type,
        gravity,
        friction,
      });
    }
  }
  
  /**
   * Emit explosion effect
   */
  explode(x: number, y: number, color: string, count: number = 20): void {
    this.emit(x, y, count, {
      color,
      speed: 200,
      speedVariance: 100,
      life: 0.5,
      lifeVariance: 0.2,
      size: 4,
      sizeVariance: 2,
      type: 'spark',
      gravity: 200,
      friction: 0.95,
    });
  }
  
  /**
   * Emit hit sparks
   */
  hitSparks(x: number, y: number, color: string): void {
    this.emit(x, y, 8, {
      color,
      speed: 150,
      speedVariance: 50,
      angle: -Math.PI / 2,
      angleSpread: Math.PI,
      life: 0.3,
      size: 3,
      type: 'spark',
    });
  }
  
  /**
   * Emit trail particles
   */
  trail(x: number, y: number, color: string): void {
    this.emit(x, y, 1, {
      color,
      speed: 10,
      life: 0.3,
      size: 4,
      type: 'trail',
      friction: 0.9,
    });
  }
  
  /**
   * Emit powerup collect effect
   */
  powerupCollect(x: number, y: number, color: string): void {
    // Ring of particles
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      this.emit(x, y, 1, {
        color,
        speed: 100,
        angle,
        angleSpread: 0.2,
        life: 0.5,
        size: 6,
        type: 'circle',
        friction: 0.92,
      });
    }
  }
  
  /**
   * Enemy death explosion with enemy color
   */
  enemyDeath(x: number, y: number, color: string): void {
    // Main explosion
    this.explode(x, y, color, 15);
    
    // Inner bright burst
    this.emit(x, y, 8, {
      color: '#ffffff',
      speed: 80,
      speedVariance: 40,
      life: 0.25,
      size: 5,
      type: 'circle',
    });
  }
  
  /**
   * Player damage effect
   */
  playerDamage(x: number, y: number): void {
    this.emit(x, y, 20, {
      color: '#ff3333',
      speed: 150,
      speedVariance: 80,
      life: 0.4,
      lifeVariance: 0.2,
      size: 4,
      type: 'spark',
      gravity: 100,
    });
  }
  
  /**
   * Banana hit sparks
   */
  bananaHit(x: number, y: number): void {
    this.emit(x, y, 10, {
      color: '#ffdd00',
      speed: 120,
      speedVariance: 60,
      angle: -Math.PI / 2,
      angleSpread: Math.PI * 0.8,
      life: 0.3,
      size: 3,
      type: 'spark',
    });
  }
  
  /**
   * Boss phase transition effect
   */
  bossPhase(x: number, y: number, color: string): void {
    // Large burst
    for (let ring = 0; ring < 3; ring++) {
      const delay = ring * 0.1;
      setTimeout(() => {
        for (let i = 0; i < 24; i++) {
          const angle = (i / 24) * Math.PI * 2;
          this.emit(x, y, 1, {
            color,
            speed: 150 + ring * 50,
            angle,
            angleSpread: 0.1,
            life: 0.8,
            size: 8 - ring * 2,
            type: 'circle',
            friction: 0.95,
          });
        }
      }, delay * 1000);
    }
  }
  
  /**
   * Victory confetti
   */
  confetti(width: number, _height: number): void {
    const colors = ['#ff0066', '#00ffaa', '#ffdd00', '#00aaff', '#ff6600'];
    
    for (let i = 0; i < 50; i++) {
      const x = rng.random() * width;
      const color = colors[Math.floor(rng.random() * colors.length)];
      
      this.emit(x, -10, 1, {
        color,
        speed: 50 + rng.random() * 100,
        angle: Math.PI / 2,
        angleSpread: 0.5,
        life: 2 + rng.random(),
        size: 6 + rng.random() * 4,
        type: 'circle',
        gravity: 100,
        friction: 0.99,
      });
    }
  }
  
  /**
   * Update all particles
   */
  update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      
      // Apply physics
      if (p.gravity) {
        p.vy += p.gravity * dt;
      }
      if (p.friction) {
        p.vx *= p.friction;
        p.vy *= p.friction;
      }
      
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      
      // Remove dead particles
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }
  
  /**
   * Render all particles
   */
  render(renderer: Renderer): void {
    const ctx = renderer.context;
    
    for (const p of this.particles) {
      const alpha = p.life / p.maxLife;
      const size = p.size * alpha;
      
      switch (p.type) {
        case 'circle':
          ctx.fillStyle = hexToRgba(p.color, alpha);
          ctx.beginPath();
          ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
          ctx.fill();
          break;
          
        case 'spark':
          ctx.strokeStyle = hexToRgba(p.color, alpha);
          ctx.lineWidth = Math.max(1, size / 2);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 0.05, p.y - p.vy * 0.05);
          ctx.stroke();
          break;
          
        case 'trail':
          const gradient = ctx.createRadialGradient(
            p.x, p.y, 0,
            p.x, p.y, size
          );
          gradient.addColorStop(0, hexToRgba(p.color, alpha));
          gradient.addColorStop(1, hexToRgba(p.color, 0));
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
          ctx.fill();
          break;
      }
    }
  }
  
  /**
   * Get particle count
   */
  count(): number {
    return this.particles.length;
  }
  
  /**
   * Clear all particles
   */
  clear(): void {
    this.particles = [];
  }
}

// Global particle system instance
export const particles = new ParticleSystem();
