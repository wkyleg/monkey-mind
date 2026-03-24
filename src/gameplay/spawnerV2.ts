/**
 * SpawnerV2 - Wave spawning system for Level Bible v2
 * Uses Archetypes and Modifiers for enemy generation
 * Supports Act-specific enemy visuals
 */

import { CONFIG } from '../config';
import type { AIModifier, EnemyArchetype, EnemyDeckEntry, LevelDataV2 } from '../content/schema';
import { ARCHETYPE_BEHAVIORS, MODIFIER_EFFECTS } from '../content/schema';
import { events } from '../core/events';
import { svgAssets } from '../engine/svgAssets';
import type { Enemy, EnemySystem } from './enemies';

interface SpawnCommand {
  archetype: EnemyArchetype;
  modifiers: AIModifier[];
  x: number;
  y: number;
  delay: number;
  params?: Record<string, unknown>;
  actEnemyVisual?: string; // Act-specific enemy visual SVG path
  dialogueEnemyId?: string; // Simple enemy ID for dialogue lookup (e.g., "zookeeper")
}

interface WaveState {
  levelId: string;
  commands: SpawnCommand[];
  currentIndex: number;
  timer: number;
  complete: boolean;
  waveNumber: number;
  cooldown: number; // Delay between waves
}

export class SpawnerV2 {
  private enemySystem: EnemySystem;
  private screenWidth: number;

  private currentWave: WaveState | null = null;
  private spawnedEnemies: Set<Enemy> = new Set();
  private levelData: LevelDataV2 | null = null;
  private levelTimer: number = 0;
  private totalWaves: number = 0;
  private currentActId: string = '';
  private currentExpansionId: string = '';
  private currentLevelIndex: number = 0;

  // Anti-repetition tracking
  private recentArchetypes: EnemyArchetype[] = [];
  private recentVisuals: string[] = [];
  private readonly MAX_RECENT_MEMORY = 5; // How many recent spawns to remember

  constructor(enemySystem: EnemySystem, screenWidth: number, _screenHeight: number) {
    this.enemySystem = enemySystem;
    this.screenWidth = screenWidth;
  }

  /**
   * Set the current act for enemy visual selection
   */
  setCurrentAct(actId: string): void {
    this.currentActId = actId;
    this.currentExpansionId = ''; // Clear expansion when setting act
  }

  /**
   * Set the current level index for level-specific enemy visuals
   */
  setCurrentLevelIndex(levelIndex: number): void {
    this.currentLevelIndex = levelIndex;
  }

  /**
   * Set the current expansion for enemy visual selection
   */
  setCurrentExpansion(expansionId: string): void {
    this.currentExpansionId = expansionId;
    this.currentActId = ''; // Clear act when setting expansion
  }

  /**
   * Load a LevelDataV2 and start spawning
   */
  loadLevelV2(level: LevelDataV2): void {
    this.levelData = level;
    this.levelTimer = 0;
    this.totalWaves = 0;

    // Generate waves from enemy deck
    this.startNextWave();
  }

  /**
   * Start the next wave based on enemy deck
   */
  private startNextWave(): void {
    if (!this.levelData) return;

    this.totalWaves++;

    // Check if level is complete (duration-based or wave-based)
    const duration = this.levelData.duration || 90; // Default 90 seconds
    if (this.levelTimer >= duration) {
      this.currentWave = null;
      events.emit('level:complete', {
        levelId: this.levelData.id,
        score: 0,
      });
      return;
    }

    // Generate spawn commands from enemy deck
    const commands = this.generateWaveCommands();

    this.currentWave = {
      levelId: this.levelData.id,
      commands,
      currentIndex: 0,
      timer: 0,
      complete: false,
      waveNumber: this.totalWaves,
      cooldown: 0,
    };

    events.emit('wave:start', { waveId: `wave_${this.totalWaves}`, number: this.totalWaves });
  }

  /**
   * Generate spawn commands from the enemy deck
   */
  private generateWaveCommands(): SpawnCommand[] {
    if (!this.levelData) return [];

    const commands: SpawnCommand[] = [];
    const deck = this.levelData.enemyDeck;

    // Handle empty deck (boss-only levels)
    if (!deck || deck.length === 0) {
      return commands; // Return empty - boss levels handle differently
    }

    // Calculate total weight
    const totalWeight = deck.reduce((sum, entry) => sum + entry.weight, 0);

    // Guard against zero weight
    if (totalWeight <= 0) {
      return commands;
    }

    // Determine wave size based on wave number and difficulty
    const baseSize = 5;
    const waveBonus = Math.floor(this.totalWaves * 0.5);
    const waveSize = Math.min(baseSize + waveBonus, 15);

    const margin = 80;
    const usableWidth = this.screenWidth - margin * 2;
    let totalDelay = 0;

    // Get available act enemies for visual variety
    const actEnemies = this.currentActId ? svgAssets.getActEnemies(this.currentActId) : [];
    // Get available expansion enemies for visual variety
    const expansionEnemies = this.currentExpansionId ? svgAssets.getExpansionEnemies(this.currentExpansionId) : [];
    // Get level-specific enemies if defined
    const levelEnemies = this.levelData?.levelEnemies;
    const levelEnemyIds = levelEnemies ? Object.keys(levelEnemies) : [];

    for (let i = 0; i < waveSize; i++) {
      // Pick enemy from weighted deck (with anti-repetition)
      const entry = this.pickFromDeck(deck, totalWeight);

      // Calculate spawn position
      const x = this.clampX(margin + (usableWidth / (waveSize + 1)) * (i + 1));
      const y = CONFIG.ENEMY_SPAWN_Y - Math.random() * 50;

      // Determine enemy visual - priority: levelEnemies > deck visualId > expansion > act > fallback
      // Now uses varied visual selection to reduce repetition
      let enemyVisual: string | undefined;
      let dialogueId: string | undefined; // Simple ID for dialogue lookup

      // First priority: Level-specific enemies (for unique enemies per level)
      if (levelEnemyIds.length > 0) {
        // Select from level-specific enemies with anti-repetition
        // Returns both the SVG path and the simple ID for dialogue
        const result = this.getLevelSpecificVisual(levelEnemyIds);
        enemyVisual = result.svgPath;
        dialogueId = result.dialogueId;
      } else if (entry.visualId) {
        // Use the visualId from the deck entry (expansion-specific)
        if (this.currentExpansionId) {
          enemyVisual = `expansions/${this.currentExpansionId}/${entry.visualId}`;
        } else {
          enemyVisual = entry.visualId;
        }
        this.trackRecentVisual(enemyVisual);
      } else if (this.currentExpansionId && expansionEnemies.length > 0) {
        // Use varied visual selection to reduce repetition
        enemyVisual = this.getVariedVisual(entry.archetype, expansionEnemies, true);
      } else if (this.currentActId && actEnemies.length > 0) {
        // Use varied visual selection to reduce repetition
        enemyVisual = this.getVariedVisual(entry.archetype, actEnemies, false);
      }

      commands.push({
        archetype: entry.archetype,
        modifiers: entry.modifiers || [],
        x,
        y,
        delay: totalDelay,
        params: entry.params,
        actEnemyVisual: enemyVisual,
        dialogueEnemyId: dialogueId, // Pass simple ID for dialogue lookup
      });

      totalDelay += 300 + Math.random() * 200; // 300-500ms between spawns
    }

    return commands;
  }

  /**
   * Pick an entry from the weighted deck with anti-repetition logic
   * Reduces weight of recently used archetypes to promote variety
   */
  private pickFromDeck(deck: EnemyDeckEntry[], totalWeight: number): EnemyDeckEntry {
    // Calculate adjusted weights (reduce weight for recently used archetypes)
    const adjustedDeck = deck.map((entry) => {
      let adjustedWeight = entry.weight;

      // Reduce weight if archetype was recently used
      const recentIndex = this.recentArchetypes.lastIndexOf(entry.archetype);
      if (recentIndex !== -1) {
        // More recent = more reduction
        const recency = this.recentArchetypes.length - recentIndex;
        const reduction = 0.3 + (recency / this.MAX_RECENT_MEMORY) * 0.5;
        adjustedWeight *= 1 - reduction;
      }

      return { entry, adjustedWeight };
    });

    // Calculate new total weight
    const adjustedTotalWeight = adjustedDeck.reduce((sum, item) => sum + item.adjustedWeight, 0);

    // If all weights are very low, use original weights
    const effectiveTotalWeight = adjustedTotalWeight > 0.1 ? adjustedTotalWeight : totalWeight;
    const useAdjusted = adjustedTotalWeight > 0.1;

    let random = Math.random() * effectiveTotalWeight;

    for (const item of adjustedDeck) {
      const weight = useAdjusted ? item.adjustedWeight : item.entry.weight;
      random -= weight;
      if (random <= 0) {
        // Track this archetype as recently used
        this.trackRecentArchetype(item.entry.archetype);
        return item.entry;
      }
    }

    const fallback = deck[deck.length - 1];
    this.trackRecentArchetype(fallback.archetype);
    return fallback;
  }

  /**
   * Track an archetype as recently used for anti-repetition
   */
  private trackRecentArchetype(archetype: EnemyArchetype): void {
    this.recentArchetypes.push(archetype);
    if (this.recentArchetypes.length > this.MAX_RECENT_MEMORY) {
      this.recentArchetypes.shift();
    }
  }

  /**
   * Track a visual as recently used for anti-repetition
   */
  private trackRecentVisual(visual: string): void {
    this.recentVisuals.push(visual);
    if (this.recentVisuals.length > this.MAX_RECENT_MEMORY) {
      this.recentVisuals.shift();
    }
  }

  /**
   * Get a varied visual for an archetype, preferring unused visuals
   */
  private getVariedVisual(
    _archetype: EnemyArchetype,
    availableVisuals: string[],
    isExpansion: boolean,
  ): string | undefined {
    if (availableVisuals.length === 0) return undefined;

    // Sort visuals by how recently they were used (least recent first)
    const sortedVisuals = availableVisuals.slice().sort((a, b) => {
      const aIndex = this.recentVisuals.lastIndexOf(a);
      const bIndex = this.recentVisuals.lastIndexOf(b);
      // -1 means never used, which should come first
      if (aIndex === -1 && bIndex === -1) return Math.random() - 0.5;
      if (aIndex === -1) return -1;
      if (bIndex === -1) return 1;
      return aIndex - bIndex;
    });

    // Pick from the least recently used visuals
    const selectedVisual = sortedVisuals[0];

    // Format based on source
    let fullVisualId: string;
    if (isExpansion && this.currentExpansionId) {
      fullVisualId = svgAssets.getExpansionEnemySvgId(this.currentExpansionId, selectedVisual) || selectedVisual;
    } else if (this.currentActId) {
      fullVisualId = svgAssets.getActEnemySvgId(this.currentActId, selectedVisual) || selectedVisual;
    } else {
      fullVisualId = selectedVisual;
    }

    this.trackRecentVisual(fullVisualId);
    return fullVisualId;
  }

  /**
   * Get a level-specific enemy visual, preferring unused visuals
   * Uses the levelEnemies configuration from the current level data
   * Returns both the SVG path for rendering AND the simple ID for dialogue lookup
   */
  private getLevelSpecificVisual(levelEnemyIds: string[]): {
    svgPath: string | undefined;
    dialogueId: string | undefined;
  } {
    if (levelEnemyIds.length === 0) {
      return { svgPath: undefined, dialogueId: undefined };
    }

    // Sort by how recently used (least recent first)
    const sortedIds = levelEnemyIds.slice().sort((a, b) => {
      const aIndex = this.recentVisuals.lastIndexOf(a);
      const bIndex = this.recentVisuals.lastIndexOf(b);
      if (aIndex === -1 && bIndex === -1) return Math.random() - 0.5;
      if (aIndex === -1) return -1;
      if (bIndex === -1) return 1;
      return aIndex - bIndex;
    });

    const selectedId = sortedIds[0];

    // Get the visualId from levelEnemies config
    const levelEnemies = this.levelData?.levelEnemies;
    if (levelEnemies?.[selectedId]) {
      const visualId = levelEnemies[selectedId].visualId;
      // Build full path: acts/{actId}/level{index}_enemies/{visualId}
      const fullVisualId = this.currentActId
        ? svgAssets.getLevelEnemySvgId(this.currentActId, this.currentLevelIndex, visualId)
        : visualId;
      this.trackRecentVisual(selectedId);
      // Return both SVG path AND the simple dialogue ID
      return { svgPath: fullVisualId, dialogueId: selectedId };
    }

    // Fallback to just the ID
    this.trackRecentVisual(selectedId);
    return { svgPath: selectedId, dialogueId: selectedId };
  }

  /**
   * Clamp X position to playable area
   */
  private clampX(x: number): number {
    const margin = 80;
    return Math.max(margin, Math.min(this.screenWidth - margin, x));
  }

  /**
   * Get enemy ID based on archetype (maps to existing enemy data)
   */
  private getEnemyIdForArchetype(archetype: EnemyArchetype): string {
    // Map archetypes to existing enemy types
    const archetypeMap: Record<EnemyArchetype, string> = {
      drifter: 'synapse_drone',
      chaser: 'neuron_cluster',
      sniper: 'pulse_node',
      swarm: 'synapse_drone',
      splitter: 'glitch_sprite',
      shieldbearer: 'protocol_enforcer',
      mimic: 'orbital_eye',
      anchor: 'logic_cultist',
      courier: 'jellyfish_thought',
      phaser: 'animal_philosopher',
      weaver: 'tentacled_halo',
      boss_chassis: 'fractal_insect',
    };

    return archetypeMap[archetype] || 'synapse_drone';
  }

  /**
   * Apply archetype behavior to enemy stats
   */
  private applyArchetype(enemy: Enemy, archetype: EnemyArchetype): void {
    const behavior = ARCHETYPE_BEHAVIORS[archetype];
    if (!behavior) return;

    // Modify enemy based on archetype
    if (enemy.health) {
      enemy.health.max = Math.floor(enemy.health.max * behavior.baseHp);
      enemy.health.current = enemy.health.max;
    }

    // Set behavior pattern
    enemy.setBehavior(behavior.movementPattern);
  }

  /**
   * Apply modifiers to enemy behavior
   */
  private applyModifiers(enemy: Enemy, modifiers: AIModifier[]): void {
    for (const modId of modifiers) {
      const modifier = MODIFIER_EFFECTS[modId];
      if (!modifier) continue;

      // Apply HP modifier
      if (enemy.health) {
        enemy.health.max = Math.floor(enemy.health.max * modifier.hpMod);
        enemy.health.current = enemy.health.max;
      }

      // Apply speed modifier
      enemy.speedMod = (enemy.speedMod || 1) * modifier.speedMod;

      // Apply special effects
      enemy.addModifier(modId);
    }
  }

  /**
   * Update spawner - playerX/playerY used for chase behaviors
   */
  update(dt: number, playerX: number, _playerY: number): void {
    // Update chase targets for all chaser enemies
    for (const enemy of this.spawnedEnemies) {
      if (enemy.active && enemy.behavior === 'chase_player') {
        enemy.setTargetX(playerX);
      }
    }
    this.levelTimer += dt;

    if (!this.currentWave) return;

    if (this.currentWave.complete) {
      // Clean up dead enemies from tracking
      for (const enemy of this.spawnedEnemies) {
        if (!enemy.active) {
          this.spawnedEnemies.delete(enemy);
        }
      }

      // Start next wave when all enemies cleared (or if none were spawned)
      if (this.spawnedEnemies.size === 0) {
        // Brief cooldown between waves (1.5 seconds)
        this.currentWave.cooldown += dt * 1000;
        if (this.currentWave.cooldown >= 1500) {
          events.emit('wave:complete', { waveId: `wave_${this.currentWave.waveNumber}` });
          this.startNextWave();
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

      // Get base enemy ID for this archetype
      const enemyId = this.getEnemyIdForArchetype(cmd.archetype);

      // Spawn the enemy
      const enemy = this.enemySystem.spawn(enemyId, cmd.x, cmd.y);

      if (enemy) {
        // Apply archetype behavior
        this.applyArchetype(enemy, cmd.archetype);

        // Apply modifiers
        if (cmd.modifiers.length > 0) {
          this.applyModifiers(enemy, cmd.modifiers);
        }

        // Set act-specific visual if available
        if (cmd.actEnemyVisual) {
          enemy.setCustomSvgId(cmd.actEnemyVisual);
        }

        // Set dialogue enemy ID for level-specific dialogue lookup
        if (cmd.dialogueEnemyId) {
          enemy.setDialogueEnemyId(cmd.dialogueEnemyId);
        }

        // Track for wave completion
        this.spawnedEnemies.add(enemy);

        // Emit spawn event for dialogue system
        // Use dialogueEnemyId (simple ID like "zookeeper") for dialogue lookup
        // Not the full SVG path (actEnemyVisual)
        events.emit('enemy:spawn', {
          type: enemyId,
          x: cmd.x,
          y: cmd.y,
          actVisual: cmd.dialogueEnemyId || cmd.actEnemyVisual,
        });
      }

      this.currentWave.currentIndex++;
    }

    // Check if all spawns complete
    if (this.currentWave.currentIndex >= this.currentWave.commands.length) {
      this.currentWave.complete = true;
    }
  }

  /**
   * Check if spawner is idle
   */
  isIdle(): boolean {
    return this.currentWave === null;
  }

  /**
   * Get current wave number
   */
  getWaveNumber(): number {
    return this.currentWave?.waveNumber ?? 0;
  }

  /**
   * Get level timer
   */
  getLevelTimer(): number {
    return this.levelTimer;
  }

  /**
   * Reset spawner
   */
  reset(): void {
    this.currentWave = null;
    this.spawnedEnemies.clear();
    this.levelData = null;
    this.levelTimer = 0;
    this.totalWaves = 0;
    // Reset anti-repetition tracking
    this.recentArchetypes = [];
    this.recentVisuals = [];
  }
}
