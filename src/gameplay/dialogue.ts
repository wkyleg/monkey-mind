/**
 * Floating dialogue/text system for enemy spawn/death messages
 */

import type { Renderer } from '../engine/renderer';
import { events } from '../core/events';
import { contentLoader } from '../content/loader';

interface FloatingText {
  id: number;
  text: string;
  x: number;
  y: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  vx: number;
  vy: number;
  type: 'spawn' | 'death' | 'dialogue';
}

export class DialogueSystem {
  private texts: FloatingText[] = [];
  private idCounter: number = 0;
  private lastSpawnTime: Map<string, number> = new Map();
  private time: number = 0;
  
  // Dialogue frequency (reduced cooldowns for more frequent dialogue)
  private readonly spawnCooldown = 1.5; // seconds between spawn texts for same enemy type
  private readonly deathCooldown = 0.8; // seconds between death texts
  
  constructor() {
    this.setupListeners();
  }
  
  private setupListeners(): void {
    // Listen for enemy spawn events
    events.on('enemy:spawn', (data: { type: string; x: number; y: number }) => {
      this.handleEnemySpawn(data.type, data.x, data.y);
    });
    
    // Listen for enemy death events
    events.on('enemy:death', (data: { type: string; position?: { x: number; y: number }; x?: number; y?: number }) => {
      const x = data.position?.x ?? data.x ?? 0;
      const y = data.position?.y ?? data.y ?? 0;
      this.handleEnemyDeath(data.type, x, y);
    });
  }
  
  private handleEnemySpawn(type: string, x: number, y: number): void {
    const enemy = contentLoader.getEnemy(type);
    if (!enemy?.spawnText?.length) return;
    
    // Check cooldown for this specific enemy type
    const lastSpawn = this.lastSpawnTime.get(`spawn_${type}`) ?? 0;
    if (this.time - lastSpawn < this.spawnCooldown) return;
    
    // Increased probability for spawn text (was 15%, now 35%)
    if (Math.random() > 0.35) return;
    
    const text = enemy.spawnText[Math.floor(Math.random() * enemy.spawnText.length)];
    this.spawnText(text, x, y, 'spawn', enemy.visual.color);
    this.lastSpawnTime.set(`spawn_${type}`, this.time);
  }
  
  private handleEnemyDeath(type: string, x: number, y: number): void {
    const enemy = contentLoader.getEnemy(type);
    if (!enemy?.deathText?.length) return;
    
    // Check cooldown for this specific enemy type
    const lastDeath = this.lastSpawnTime.get(`death_${type}`) ?? 0;
    if (this.time - lastDeath < this.deathCooldown) return;
    
    // Increased probability for death text (was 25%, now 50%)
    if (Math.random() > 0.50) return;
    
    const text = enemy.deathText[Math.floor(Math.random() * enemy.deathText.length)];
    this.spawnText(text, x, y, 'death', enemy.visual.color);
    this.lastSpawnTime.set(`death_${type}`, this.time);
  }
  
  /**
   * Spawn floating text
   */
  spawnText(
    text: string,
    x: number,
    y: number,
    type: FloatingText['type'] = 'dialogue',
    color: string = '#ffffff'
  ): void {
    this.texts.push({
      id: this.idCounter++,
      text,
      x,
      y,
      life: 2,
      maxLife: 2,
      color,
      size: type === 'death' ? 14 : 12,
      vx: (Math.random() - 0.5) * 20,
      vy: -30 - Math.random() * 20,
      type,
    });
  }
  
  /**
   * Update dialogue system
   */
  update(dt: number): void {
    this.time += dt;
    
    for (const text of this.texts) {
      text.x += text.vx * dt;
      text.y += text.vy * dt;
      text.vy += 10 * dt; // Slight gravity
      text.life -= dt;
    }
    
    // Remove expired texts
    this.texts = this.texts.filter(t => t.life > 0);
  }
  
  /**
   * Render floating texts
   */
  render(renderer: Renderer): void {
    const ctx = renderer.context;
    
    for (const text of this.texts) {
      const alpha = Math.min(1, text.life / 0.5); // Fade out in last 0.5s
      
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `${text.size}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Shadow for readability
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
      
      // Text color based on type
      let fillColor = text.color;
      if (text.type === 'death') {
        fillColor = '#ff6666';
      } else if (text.type === 'spawn') {
        fillColor = '#66ff66';
      }
      
      ctx.fillStyle = fillColor;
      ctx.fillText(text.text, text.x, text.y);
      
      ctx.restore();
    }
  }
  
  /**
   * Clear all texts
   */
  clear(): void {
    this.texts = [];
  }
}

// Global dialogue system instance
export const dialogueSystem = new DialogueSystem();
