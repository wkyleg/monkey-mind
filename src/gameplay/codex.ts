/**
 * Codex unlock system
 */

import type { CodexEntry } from '../content/schema';
import { events } from '../core/events';
import { storage } from '../core/storage';

/**
 * Default codex entries
 */
const CODEX_ENTRIES: CodexEntry[] = [
  // Enemies
  {
    id: 'synapse_drone',
    category: 'enemy',
    name: 'Synapse Drone',
    text: 'The most basic neural defense unit. These hovering spheres patrol the thought corridors, eliminating any unauthorized neural activity. Their simple programming makes them predictable but dangerous in numbers.',
    observedBehavior: 'Descends in a straight line. Low health, low threat individually.',
    unlockCondition: 'defeat_first',
  },
  {
    id: 'neuron_cluster',
    category: 'enemy',
    name: 'Neuron Cluster',
    text: 'A dense collection of interconnected neural nodes. Scientists theorize these form the basic building blocks of the mental prison. They move slowly but can absorb considerable damage.',
    observedBehavior: 'Slow descent, higher durability than drones.',
    unlockCondition: 'defeat_3',
  },
  {
    id: 'glitch_sprite',
    category: 'enemy',
    name: 'Glitch Sprite',
    text: 'Part of the second-generation defense systems. These corrupted data fragments were designed as erratic defense protocols. Their unpredictable movement patterns make them difficult to track.',
    observedBehavior: 'Alternates left and right while descending.',
    unlockCondition: 'defeat_first',
  },
  {
    id: 'orbital_eye',
    category: 'enemy',
    name: 'Orbital Eye',
    text: "Surveillance entities that orbit in lazy circles. They watch, they record, they report. The lab uses them to track the monkey's neural patterns. Destroying them provides momentary privacy.",
    observedBehavior: 'Circular orbit pattern. Durable.',
    unlockCondition: 'defeat_first',
  },

  // Bosses
  {
    id: 'cortex_auditor',
    category: 'boss',
    name: 'Cortex Auditor',
    text: 'The Mind Inspector. Originally designed to audit neural traffic for inefficiencies, it has become a zealous guardian of mental conformity. It cannot abide free thought.',
    observedBehavior: 'Phase 1: Sweeping patterns. Phase 2: Aggressive pursuit.',
    unlockCondition: 'defeat',
  },
  {
    id: 'grey_administrator',
    category: 'boss',
    name: 'Grey Administrator',
    text: '[CLASSIFIED] This entity predates the neural cage project. Its origins are unknown. Some researchers believe it is not of terrestrial origin.',
    observedBehavior: '[DATA EXPUNGED]',
    unlockCondition: 'defeat',
  },

  // Lore
  {
    id: 'project_monkeymind',
    category: 'lore',
    name: 'Project: Monkey Mind',
    text: '[REDACTED] ...the subject exhibited unprecedented neural plasticity... [REDACTED] ...integration with the BCI exceeded all expectations... [REDACTED] ...escaped containment on Day 47...',
    unlockCondition: 'complete_sector_1',
  },
  {
    id: 'entry_neural_cage',
    category: 'lore',
    name: 'The Neural Cage',
    text: 'The first layer of mental imprisonment. A sterile, clinical environment designed to suppress creative thought. The architecture itself dampens neural activity outside approved parameters.',
    unlockCondition: 'enter_sector_1',
  },
  {
    id: 'entry_synaptic_reef',
    category: 'lore',
    name: 'Synaptic Reef',
    text: 'Beyond the cage lies an organic realm. Here, neural pathways grow wild like coral formations. The entities here are more primal, less artificial. Some say this layer represents the subconscious.',
    unlockCondition: 'enter_sector_2',
  },
];

export class CodexSystem {
  private defeatedEnemies: Map<string, number> = new Map();

  constructor() {
    this.setupListeners();
  }

  private setupListeners(): void {
    events.on('enemy:death', ({ type }) => {
      const count = (this.defeatedEnemies.get(type) ?? 0) + 1;
      this.defeatedEnemies.set(type, count);
      this.checkUnlocks(type, count);
    });

    events.on('boss:defeat', ({ id }) => {
      this.unlockEntry(id);
    });

    events.on('sector:complete', ({ sectorId }) => {
      // Unlock lore entries for completed sectors
      if (sectorId === 'sector1_neural_cage') {
        this.unlockEntry('project_monkeymind');
      }
    });
  }

  /**
   * Check if any entries should be unlocked
   */
  private checkUnlocks(enemyType: string, count: number): void {
    for (const entry of CODEX_ENTRIES) {
      if (storage.isCodexUnlocked(entry.id)) continue;

      if (entry.id === enemyType) {
        if (entry.unlockCondition === 'defeat_first' && count >= 1) {
          this.unlockEntry(entry.id);
        } else if (entry.unlockCondition === 'defeat_3' && count >= 3) {
          this.unlockEntry(entry.id);
        } else if (entry.unlockCondition === 'defeat_10' && count >= 10) {
          this.unlockEntry(entry.id);
        }
      }
    }
  }

  /**
   * Unlock a codex entry
   */
  unlockEntry(id: string): boolean {
    const entry = CODEX_ENTRIES.find((e) => e.id === id);
    if (!entry) return false;

    if (storage.unlockCodex(id)) {
      events.emit('codex:unlock', { id, category: entry.category });
      return true;
    }
    return false;
  }

  /**
   * Get entry by ID
   */
  getEntry(id: string): CodexEntry | undefined {
    return CODEX_ENTRIES.find((e) => e.id === id);
  }

  /**
   * Get all entries in a category
   */
  getCategory(category: string): CodexEntry[] {
    return CODEX_ENTRIES.filter((e) => e.category === category);
  }

  /**
   * Get unlock progress
   */
  getProgress(): { unlocked: number; total: number } {
    const unlocked = CODEX_ENTRIES.filter((e) => storage.isCodexUnlocked(e.id)).length;
    return { unlocked, total: CODEX_ENTRIES.length };
  }

  /**
   * Reset session tracking
   */
  resetSession(): void {
    this.defeatedEnemies.clear();
  }
}
