/**
 * Wave spawning system
 */

import type { WaveData, LevelData } from '../content/schema';
import type { EnemySystem, Enemy } from './enemies';
import { contentLoader } from '../content/loader';
import { events } from '../core/events';
import { CONFIG } from '../config';

export interface SpawnCommand {
  enemyId: string;
  x: number;
  y: number;
  delay: number;
}

export interface WaveState {
  waveId: string;
  commands: SpawnCommand[];
  currentIndex: number;
  timer: number;
  complete: boolean;
}

export class Spawner {
  private enemySystem: EnemySystem;
  private screenWidth: number;
  
  private waveQueue: string[] = [];
  private currentWave: WaveState | null = null;
  private waveNumber: number = 0;
  
  private levelData: LevelData | null = null;
  
  private spawnedEnemies: Set<Enemy> = new Set();
  
  constructor(enemySystem: EnemySystem, screenWidth: number) {
    this.enemySystem = enemySystem;
    this.screenWidth = screenWidth;
  }
  
  /**
   * Load a sector and start its first level
   */
  loadSector(sectorId: string): void {
    const sector = contentLoader.getSector(sectorId);
    if (!sector) {
      console.warn(`Sector not found: ${sectorId}`);
      return;
    }
    
    if (sector.levels.length > 0) {
      this.loadLevel(sector.levels[0]);
    }
  }
  
  /**
   * Load a specific level
   */
  loadLevel(level: LevelData): void {
    this.levelData = level;
    this.waveQueue = [...level.waves];
    this.waveNumber = 0;
    this.nextWave();
  }
  
  /**
   * Start the next wave
   */
  private nextWave(): void {
    if (this.waveQueue.length === 0) {
      this.currentWave = null;
      events.emit('level:complete', { 
        levelId: this.levelData?.id ?? 'unknown', 
        score: 0 
      });
      return;
    }
    
    const waveId = this.waveQueue.shift()!;
    const waveData = contentLoader.getWave(waveId);
    
    if (!waveData) {
      // Use default wave if not found
      this.currentWave = this.createDefaultWave(waveId);
    } else {
      this.currentWave = this.createWaveState(waveData);
    }
    
    this.waveNumber++;
    events.emit('wave:start', { waveId, number: this.waveNumber });
  }
  
  /**
   * Create wave state from wave data
   */
  private createWaveState(data: WaveData): WaveState {
    const commands: SpawnCommand[] = [];
    
    // Handle waves with enemies array (new format)
    if (data.enemies && data.enemies.length > 0) {
      this.generateFromEnemiesArray(commands, data);
    } else {
      // Legacy single-enemy format
      switch (data.pattern) {
        case 'line':
          this.generateLinePattern(commands, data);
          break;
        case 'grid':
          this.generateGridPattern(commands, data);
          break;
        case 'v_formation':
          this.generateVFormation(commands, data);
          break;
        case 'random':
          this.generateRandomPattern(commands, data);
          break;
        case 'mixed':
          this.generateMixedPattern(commands, data);
          break;
        case 'drift':
          this.generateDriftPattern(commands, data);
          break;
        case 'wave':
          this.generateWavePattern(commands, data);
          break;
        case 'orbital':
          this.generateOrbitalPattern(commands, data);
          break;
        case 'swarm':
          this.generateSwarmPattern(commands, data);
          break;
        case 'pincer':
          this.generatePincerPattern(commands, data);
          break;
        case 'gauntlet':
          this.generateGauntletPattern(commands, data);
          break;
        default:
          this.generateLinePattern(commands, data);
      }
    }
    
    return {
      waveId: data.id,
      commands,
      currentIndex: 0,
      timer: 0,
      complete: false,
    };
  }
  
  /**
   * Generate spawn commands from enemies array (new wave format)
   */
  private generateFromEnemiesArray(commands: SpawnCommand[], data: WaveData): void {
    if (!data.enemies) return;
    
    const margin = 80;
    const usableWidth = this.screenWidth - margin * 2;
    let totalDelay = 0;
    
    for (const enemyGroup of data.enemies) {
      const count = enemyGroup.count ?? 1;
      const groupDelay = enemyGroup.spawnDelayMs ?? data.entryDelayMs ?? 300;
      const behavior = enemyGroup.behavior ?? 'descend';
      
      for (let i = 0; i < count; i++) {
        let x: number;
        let y = CONFIG.ENEMY_SPAWN_Y;
        
        // Position based on behavior/pattern
        switch (behavior) {
          case 'zigzag':
            // Spread across screen with slight offset
            x = margin + (usableWidth / (count + 1)) * (i + 1);
            x += Math.sin(i * 0.7) * 30;
            break;
          case 'orbit':
            // Circular formation
            const angle = (i / count) * Math.PI * 2;
            x = this.screenWidth / 2 + Math.cos(angle) * (usableWidth / 3);
            y = CONFIG.ENEMY_SPAWN_Y - 50 + Math.sin(angle) * 50;
            break;
          case 'drift':
            // Random horizontal with vertical offset
            x = margin + Math.random() * usableWidth;
            y = CONFIG.ENEMY_SPAWN_Y - i * 20;
            break;
          default:
            // Default spread
            x = margin + (usableWidth / (count + 1)) * (i + 1);
        }
        
        commands.push({
          enemyId: enemyGroup.type,
          x: this.clampX(x),
          y,
          delay: totalDelay + i * groupDelay,
        });
      }
      
      totalDelay += count * groupDelay + (data.spawnDelayMs ?? 500);
    }
  }
  
  /**
   * Clamp X position to playable area
   */
  private clampX(x: number): number {
    const margin = 80; // Keep enemies away from edges
    return Math.max(margin, Math.min(this.screenWidth - margin, x));
  }
  
  /**
   * Create a default wave (fallback)
   */
  private createDefaultWave(waveId: string): WaveState {
    const commands: SpawnCommand[] = [];
    const count = 5;
    const margin = 80;
    const usableWidth = this.screenWidth - margin * 2;
    const spacing = usableWidth / (count - 1);
    
    for (let i = 0; i < count; i++) {
      commands.push({
        enemyId: 'synapse_drone',
        x: margin + i * spacing,
        y: CONFIG.ENEMY_SPAWN_Y,
        delay: i * 300,
      });
    }
    
    return {
      waveId,
      commands,
      currentIndex: 0,
      timer: 0,
      complete: false,
    };
  }
  
  /**
   * Generate line pattern spawn commands
   */
  private generateLinePattern(commands: SpawnCommand[], data: WaveData): void {
    const count = data.count ?? 5;
    const margin = 80;
    const usableWidth = this.screenWidth - margin * 2;
    const spacing = usableWidth / (count + 1);
    
    for (let i = 0; i < count; i++) {
      commands.push({
        enemyId: data.enemy,
        x: this.clampX(margin + spacing + i * spacing),
        y: CONFIG.ENEMY_SPAWN_Y,
        delay: i * data.entryDelayMs,
      });
    }
  }
  
  /**
   * Generate grid pattern spawn commands
   */
  private generateGridPattern(commands: SpawnCommand[], data: WaveData): void {
    const rows = data.rows ?? 2;
    const cols = data.cols ?? 4;
    const margin = 80;
    const usableWidth = this.screenWidth - margin * 2;
    const spacingX = usableWidth / (cols + 1);
    const spacingY = 60;
    
    let delay = 0;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        commands.push({
          enemyId: data.enemy,
          x: this.clampX(margin + spacingX + col * spacingX),
          y: CONFIG.ENEMY_SPAWN_Y - row * spacingY,
          delay,
        });
        delay += data.entryDelayMs;
      }
    }
  }
  
  /**
   * Generate V formation spawn commands
   */
  private generateVFormation(commands: SpawnCommand[], data: WaveData): void {
    const count = data.count ?? 5;
    const centerX = this.screenWidth / 2;
    const margin = 80;
    const maxSpread = (this.screenWidth - margin * 2) / 2;
    const spacing = Math.min(80, maxSpread / Math.floor(count / 2));
    
    let delay = 0;
    for (let i = 0; i < count; i++) {
      const offset = Math.abs(i - Math.floor(count / 2));
      const x = centerX + (i - Math.floor(count / 2)) * spacing;
      const y = CONFIG.ENEMY_SPAWN_Y - offset * 40;
      
      commands.push({
        enemyId: data.enemy,
        x: this.clampX(x),
        y,
        delay,
      });
      delay += data.entryDelayMs;
    }
  }
  
  /**
   * Generate random pattern spawn commands
   */
  private generateRandomPattern(commands: SpawnCommand[], data: WaveData): void {
    const count = data.count ?? 8;
    const margin = 80;
    
    for (let i = 0; i < count; i++) {
      commands.push({
        enemyId: data.enemy,
        x: this.clampX(margin + Math.random() * (this.screenWidth - margin * 2)),
        y: CONFIG.ENEMY_SPAWN_Y - Math.random() * 100,
        delay: i * data.entryDelayMs,
      });
    }
  }
  
  /**
   * Generate mixed pattern spawn commands
   */
  private generateMixedPattern(commands: SpawnCommand[], data: WaveData): void {
    // Combination of line and random
    const count = data.count ?? 10;
    const half = Math.floor(count / 2);
    const margin = 80;
    const usableWidth = this.screenWidth - margin * 2;
    
    // First half in line
    const spacing = usableWidth / (half + 1);
    for (let i = 0; i < half; i++) {
      commands.push({
        enemyId: data.enemy,
        x: this.clampX(margin + spacing + i * spacing),
        y: CONFIG.ENEMY_SPAWN_Y,
        delay: i * data.entryDelayMs,
      });
    }
    
    // Second half random
    for (let i = 0; i < count - half; i++) {
      commands.push({
        enemyId: data.enemy,
        x: this.clampX(margin + Math.random() * usableWidth),
        y: CONFIG.ENEMY_SPAWN_Y - 100,
        delay: (half + i) * data.entryDelayMs,
      });
    }
  }
  
  /**
   * Generate drift pattern - enemies float down with horizontal drift
   */
  private generateDriftPattern(commands: SpawnCommand[], data: WaveData): void {
    const count = data.count ?? 6;
    const margin = 80;
    const usableWidth = this.screenWidth - margin * 2;
    
    for (let i = 0; i < count; i++) {
      // Staggered spawn positions with drift offset
      const baseX = margin + (usableWidth / (count + 1)) * (i + 1);
      const drift = Math.sin(i * 1.2) * 40;
      
      commands.push({
        enemyId: data.enemy,
        x: this.clampX(baseX + drift),
        y: CONFIG.ENEMY_SPAWN_Y - i * 15,
        delay: i * data.entryDelayMs,
      });
    }
  }
  
  /**
   * Generate wave pattern - enemies enter in sine-wave formation
   */
  private generateWavePattern(commands: SpawnCommand[], data: WaveData): void {
    const count = data.count ?? 8;
    const margin = 80;
    const usableWidth = this.screenWidth - margin * 2;
    const centerX = this.screenWidth / 2;
    const amplitude = usableWidth / 3;
    
    for (let i = 0; i < count; i++) {
      const phase = (i / count) * Math.PI * 2;
      const x = centerX + Math.sin(phase) * amplitude;
      const y = CONFIG.ENEMY_SPAWN_Y - Math.abs(Math.cos(phase)) * 60;
      
      commands.push({
        enemyId: data.enemy,
        x: this.clampX(x),
        y,
        delay: i * data.entryDelayMs,
      });
    }
  }
  
  /**
   * Generate orbital pattern - enemies spawn in circular formations
   */
  private generateOrbitalPattern(commands: SpawnCommand[], data: WaveData): void {
    const count = data.count ?? 6;
    const centerX = this.screenWidth / 2;
    const centerY = CONFIG.ENEMY_SPAWN_Y - 80;
    const radius = Math.min(150, (this.screenWidth - 160) / 2);
    
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * (radius * 0.6);
      
      commands.push({
        enemyId: data.enemy,
        x: this.clampX(x),
        y,
        delay: i * data.entryDelayMs,
      });
    }
  }
  
  /**
   * Generate swarm pattern - clustered random positions
   */
  private generateSwarmPattern(commands: SpawnCommand[], data: WaveData): void {
    const count = data.count ?? 10;
    const margin = 100;
    const usableWidth = this.screenWidth - margin * 2;
    
    // Pick 2-3 cluster centers
    const clusterCount = Math.min(3, Math.ceil(count / 4));
    const clusters: { x: number; y: number }[] = [];
    
    for (let c = 0; c < clusterCount; c++) {
      clusters.push({
        x: margin + (usableWidth / (clusterCount + 1)) * (c + 1),
        y: CONFIG.ENEMY_SPAWN_Y - 30 - Math.random() * 50,
      });
    }
    
    for (let i = 0; i < count; i++) {
      const cluster = clusters[i % clusters.length];
      const offsetX = (Math.random() - 0.5) * 100;
      const offsetY = (Math.random() - 0.5) * 60;
      
      commands.push({
        enemyId: data.enemy,
        x: this.clampX(cluster.x + offsetX),
        y: cluster.y + offsetY,
        delay: i * data.entryDelayMs * 0.7,
      });
    }
  }
  
  /**
   * Generate pincer pattern - enemies from both sides
   */
  private generatePincerPattern(commands: SpawnCommand[], data: WaveData): void {
    const count = data.count ?? 8;
    const half = Math.floor(count / 2);
    const margin = 80;
    
    // Left side
    for (let i = 0; i < half; i++) {
      const y = CONFIG.ENEMY_SPAWN_Y - i * 30;
      commands.push({
        enemyId: data.enemy,
        x: margin + i * 20,
        y,
        delay: i * data.entryDelayMs,
      });
    }
    
    // Right side
    for (let i = 0; i < count - half; i++) {
      const y = CONFIG.ENEMY_SPAWN_Y - i * 30;
      commands.push({
        enemyId: data.enemy,
        x: this.screenWidth - margin - i * 20,
        y,
        delay: i * data.entryDelayMs,
      });
    }
  }
  
  /**
   * Generate gauntlet pattern - continuous spawning stream
   */
  private generateGauntletPattern(commands: SpawnCommand[], data: WaveData): void {
    const count = data.count ?? 15;
    const margin = 80;
    const usableWidth = this.screenWidth - margin * 2;
    const lanes = 5;
    const laneWidth = usableWidth / lanes;
    
    for (let i = 0; i < count; i++) {
      // Alternate lanes with some randomness
      const baseLane = i % lanes;
      const laneOffset = (Math.random() - 0.5) * 0.5;
      const x = margin + laneWidth * (baseLane + 0.5 + laneOffset);
      
      // Stagger Y positions slightly
      const yOffset = Math.random() * 30;
      
      commands.push({
        enemyId: data.enemy,
        x: this.clampX(x),
        y: CONFIG.ENEMY_SPAWN_Y - yOffset,
        delay: i * data.entryDelayMs * 0.6,
      });
    }
  }
  
  /**
   * Update spawner
   */
  update(dt: number): void {
    if (!this.currentWave || this.currentWave.complete) {
      // Check if all spawned enemies are dead
      if (this.currentWave?.complete && this.spawnedEnemies.size > 0) {
        // Remove dead enemies
        for (const enemy of this.spawnedEnemies) {
          if (!enemy.active) {
            this.spawnedEnemies.delete(enemy);
          }
        }
        
        // Start next wave when all enemies cleared
        if (this.spawnedEnemies.size === 0) {
          events.emit('wave:complete', { waveId: this.currentWave.waveId });
          this.nextWave();
        }
      }
      return;
    }
    
    this.currentWave.timer += dt * 1000;
    
    // Spawn enemies according to commands
    while (
      this.currentWave.currentIndex < this.currentWave.commands.length &&
      this.currentWave.timer >= this.currentWave.commands[this.currentWave.currentIndex].delay
    ) {
      const cmd = this.currentWave.commands[this.currentWave.currentIndex];
      const enemy = this.enemySystem.spawn(cmd.enemyId, cmd.x, cmd.y);
      if (enemy) {
        this.spawnedEnemies.add(enemy);
        // Emit spawn event for dialogue system
        events.emit('enemy:spawn', { type: cmd.enemyId, x: cmd.x, y: cmd.y });
      }
      this.currentWave.currentIndex++;
    }
    
    // Check if all spawns complete
    if (this.currentWave.currentIndex >= this.currentWave.commands.length) {
      this.currentWave.complete = true;
    }
  }
  
  /**
   * Check if spawner is idle (no active waves or enemies)
   */
  isIdle(): boolean {
    return this.currentWave === null && this.waveQueue.length === 0;
  }
  
  /**
   * Queue additional waves for endless mode
   */
  queueWaves(waveIds: string[]): void {
    this.waveQueue.push(...waveIds);
    if (!this.currentWave) {
      this.nextWave();
    }
  }
  
  /**
   * Get current wave number
   */
  getWaveNumber(): number {
    return this.waveNumber;
  }
  
  /**
   * Reset spawner
   */
  reset(): void {
    this.waveQueue = [];
    this.currentWave = null;
    this.waveNumber = 0;
    this.spawnedEnemies.clear();
    this.levelData = null;
  }
}
