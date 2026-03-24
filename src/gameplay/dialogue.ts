/**
 * Dialogue system for enemy spawn/death text
 * Displays brief text popups when enemies appear and are defeated
 */

import { contentLoader } from '../content/loader';
import { events } from '../core/events';
import type { Renderer } from '../engine/renderer';

export interface DialogueLine {
  text: string;
  x: number;
  y: number;
  color: string;
  lifetime: number;
  maxLifetime: number;
  type: 'spawn' | 'death';
  fontSize: number;
}

// Default spawn/death texts by archetype
const ARCHETYPE_DIALOGUE: Record<string, { spawn: string[]; death: string[] }> = {
  drifter: {
    spawn: ['I drift...', 'Wandering...', 'Lost in thought...'],
    death: ['Free...', 'Released...', 'Peace...'],
  },
  chaser: {
    spawn: ['Found you!', 'You cannot hide!', 'CHASE!'],
    death: ['Too... slow...', 'Escaped...', 'Lost the trail...'],
  },
  sniper: {
    spawn: ['Target acquired.', 'In my sights.', 'Locked on.'],
    death: ['Missed...', 'Shot down...', 'Off target...'],
  },
  swarm: {
    spawn: ['We are many!', 'Join the swarm!', 'Together!'],
    death: ['One falls...', 'The swarm endures...', 'Scattered...'],
  },
  splitter: {
    spawn: ['I multiply!', 'Divide and conquer!', 'Split!'],
    death: ['Cannot... divide...', 'Whole again...', 'Unity...'],
  },
  shieldbearer: {
    spawn: ['DEFEND!', 'Impenetrable!', 'Block all!'],
    death: ['Breached...', 'Shield broken...', 'Defenses down...'],
  },
  mimic: {
    spawn: ['I am you.', 'Mirror...', 'Reflection!'],
    death: ['Copy... failed...', 'Original wins...', 'Shattered...'],
  },
  anchor: {
    spawn: ['Held fast!', 'Unmoving!', 'Rooted!'],
    death: ['Uprooted...', 'Drifting away...', 'Anchor lost...'],
  },
  courier: {
    spawn: ['INCOMING!', 'Delivery!', 'Express!'],
    death: ['Package... lost...', 'Undelivered...', 'Return to sender...'],
  },
  phaser: {
    spawn: ['Now you see me...', 'Phase shift!', 'Blinking...'],
    death: ["Can't... phase...", 'Solid...', 'Caught between...'],
  },
  weaver: {
    spawn: ['Weaving patterns!', 'Dance!', 'Threads of fate!'],
    death: ['Pattern... broken...', 'Unraveled...', 'Thread cut...'],
  },
  boss_chassis: {
    spawn: ['I AM YOUR FEAR!', 'FACE ME!', 'THE END COMES!'],
    death: ['Impossible...', 'This cannot be...', 'You... win...'],
  },
};

// Language variants for diversity
const LANGUAGE_VARIANTS: Record<string, Record<string, string[]>> = {
  spawn: {
    es: ['¡Te encontré!', '¡Prepárate!', '¡Aquí estoy!'],
    de: ['Ich komme!', 'Bereit?', 'Hier bin ich!'],
    ja: ['来たぞ！', '覚悟しろ！', '見つけた！'],
    fr: ["Je t'ai trouvé!", 'Prépare-toi!', 'Me voilà!'],
    la: ['Veni!', 'Paratus esto!', 'Adsum!'],
  },
  death: {
    es: ['No...', 'Derrotado...', 'Adiós...'],
    de: ['Nein...', 'Besiegt...', 'Lebewohl...'],
    ja: ['無念...', '敗北...', 'さらば...'],
    fr: ['Non...', 'Vaincu...', 'Adieu...'],
    la: ['Non...', 'Victus...', 'Vale...'],
  },
};

export class DialogueSystem {
  private activeDialogues: DialogueLine[] = [];
  private lastSpawnDialogueTime: number = 0;
  private lastDeathDialogueTime: number = 0;
  private readonly minDialogueInterval: number = 0.8; // Seconds between dialogues
  private dialogueEnabled: boolean = true;

  constructor() {
    this.setupEventListeners();
  }

  /**
   * Set up event listeners for enemy spawn/death
   */
  private setupEventListeners(): void {
    events.on('enemy:spawn', (data: { type: string; x: number; y: number; actVisual?: string }) => {
      this.onEnemySpawn(data);
    });

    events.on('enemy:death', (data: { type: string; position: { x: number; y: number }; actVisual?: string }) => {
      this.onEnemyDeath(data);
    });
  }

  /**
   * Enable or disable dialogue display
   */
  setEnabled(enabled: boolean): void {
    this.dialogueEnabled = enabled;
  }

  /**
   * Handle enemy spawn event
   */
  private onEnemySpawn(data: { type: string; x: number; y: number; actVisual?: string }): void {
    if (!this.dialogueEnabled) return;

    const now = performance.now() / 1000;
    if (now - this.lastSpawnDialogueTime < this.minDialogueInterval) return;

    // Only show spawn dialogue occasionally (30% chance)
    if (Math.random() > 0.3) return;

    // Prioritize actVisual for unique enemy dialogue, fall back to generic type
    const enemyId = data.actVisual || data.type;
    const text = this.getSpawnText(enemyId);
    if (!text) return;

    this.addDialogue({
      text,
      x: data.x,
      y: Math.max(60, data.y - 30),
      color: '#00cccc',
      lifetime: 0,
      maxLifetime: 1.5,
      type: 'spawn',
      fontSize: 12,
    });

    this.lastSpawnDialogueTime = now;
  }

  /**
   * Handle enemy death event
   */
  private onEnemyDeath(data: { type: string; position: { x: number; y: number }; actVisual?: string }): void {
    if (!this.dialogueEnabled) return;

    const now = performance.now() / 1000;
    if (now - this.lastDeathDialogueTime < this.minDialogueInterval * 0.5) return;

    // Show death dialogue more frequently (50% chance)
    if (Math.random() > 0.5) return;

    // Prioritize actVisual for unique enemy dialogue, fall back to generic type
    const enemyId = data.actVisual || data.type;
    const text = this.getDeathText(enemyId);
    if (!text) return;

    this.addDialogue({
      text,
      x: data.position.x,
      y: data.position.y,
      color: '#ff6666',
      lifetime: 0,
      maxLifetime: 1.2,
      type: 'death',
      fontSize: 11,
    });

    this.lastDeathDialogueTime = now;
  }

  /**
   * Get spawn text for an enemy type
   * Prioritizes unique enemy dialogue from content, falls back to archetype dialogue
   */
  private getSpawnText(enemyType: string): string | null {
    // First, try to get enemy-specific dialogue from content loader
    const uniqueDialogue = contentLoader.getEnemyDialogue(enemyType);
    if (uniqueDialogue && uniqueDialogue.spawn.length > 0) {
      // Occasionally use foreign language (10% chance) even with unique dialogue
      if (Math.random() < 0.1) {
        const languages = Object.keys(LANGUAGE_VARIANTS.spawn);
        const lang = languages[Math.floor(Math.random() * languages.length)];
        const variants = LANGUAGE_VARIANTS.spawn[lang];
        return variants[Math.floor(Math.random() * variants.length)];
      }
      return uniqueDialogue.spawn[Math.floor(Math.random() * uniqueDialogue.spawn.length)];
    }

    // Fall back to archetype-based dialogue
    const archetype = this.getArchetypeForEnemy(enemyType);
    const dialogueSet = ARCHETYPE_DIALOGUE[archetype];

    if (!dialogueSet || dialogueSet.spawn.length === 0) {
      return null;
    }

    // Occasionally use foreign language (15% chance)
    if (Math.random() < 0.15) {
      const languages = Object.keys(LANGUAGE_VARIANTS.spawn);
      const lang = languages[Math.floor(Math.random() * languages.length)];
      const variants = LANGUAGE_VARIANTS.spawn[lang];
      return variants[Math.floor(Math.random() * variants.length)];
    }

    return dialogueSet.spawn[Math.floor(Math.random() * dialogueSet.spawn.length)];
  }

  /**
   * Get death text for an enemy type
   * Prioritizes unique enemy dialogue from content, falls back to archetype dialogue
   */
  private getDeathText(enemyType: string): string | null {
    // First, try to get enemy-specific dialogue from content loader
    const uniqueDialogue = contentLoader.getEnemyDialogue(enemyType);
    if (uniqueDialogue && uniqueDialogue.death.length > 0) {
      // Occasionally use foreign language (10% chance) even with unique dialogue
      if (Math.random() < 0.1) {
        const languages = Object.keys(LANGUAGE_VARIANTS.death);
        const lang = languages[Math.floor(Math.random() * languages.length)];
        const variants = LANGUAGE_VARIANTS.death[lang];
        return variants[Math.floor(Math.random() * variants.length)];
      }
      return uniqueDialogue.death[Math.floor(Math.random() * uniqueDialogue.death.length)];
    }

    // Fall back to archetype-based dialogue
    const archetype = this.getArchetypeForEnemy(enemyType);
    const dialogueSet = ARCHETYPE_DIALOGUE[archetype];

    if (!dialogueSet || dialogueSet.death.length === 0) {
      return null;
    }

    // Occasionally use foreign language (15% chance)
    if (Math.random() < 0.15) {
      const languages = Object.keys(LANGUAGE_VARIANTS.death);
      const lang = languages[Math.floor(Math.random() * languages.length)];
      const variants = LANGUAGE_VARIANTS.death[lang];
      return variants[Math.floor(Math.random() * variants.length)];
    }

    return dialogueSet.death[Math.floor(Math.random() * dialogueSet.death.length)];
  }

  /**
   * Map enemy ID to archetype name
   */
  private getArchetypeForEnemy(enemyType: string): string {
    // Simple mapping based on enemy naming conventions
    const typeToArchetype: Record<string, string> = {
      synapse_drone: 'drifter',
      neuron_cluster: 'chaser',
      pulse_node: 'sniper',
      glitch_sprite: 'splitter',
      protocol_enforcer: 'shieldbearer',
      orbital_eye: 'mimic',
      logic_cultist: 'anchor',
      jellyfish_thought: 'courier',
      animal_philosopher: 'phaser',
      tentacled_halo: 'weaver',
      fractal_insect: 'swarm',
    };

    return typeToArchetype[enemyType] || 'drifter';
  }

  /**
   * Add a new dialogue line
   */
  private addDialogue(dialogue: DialogueLine): void {
    // Limit max active dialogues
    if (this.activeDialogues.length >= 5) {
      this.activeDialogues.shift();
    }
    this.activeDialogues.push(dialogue);
  }

  /**
   * Update dialogue lifetimes
   */
  update(dt: number): void {
    for (const dialogue of this.activeDialogues) {
      dialogue.lifetime += dt;
      // Float upward for death dialogues
      if (dialogue.type === 'death') {
        dialogue.y -= 30 * dt;
      }
    }

    // Remove expired dialogues
    this.activeDialogues = this.activeDialogues.filter((d) => d.lifetime < d.maxLifetime);
  }

  /**
   * Render active dialogues
   */
  render(renderer: Renderer): void {
    const ctx = renderer.context;

    for (const dialogue of this.activeDialogues) {
      const alpha = 1 - dialogue.lifetime / dialogue.maxLifetime;
      const scale = dialogue.type === 'spawn' ? 1 + dialogue.lifetime * 0.3 : 1 - dialogue.lifetime * 0.2;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(dialogue.x, dialogue.y);
      ctx.scale(scale, scale);

      // Text with outline
      ctx.font = `bold ${dialogue.fontSize}px 'SF Mono', Consolas, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Outline
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.strokeText(dialogue.text, 0, 0);

      // Fill with glow
      ctx.shadowColor = dialogue.color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = dialogue.color;
      ctx.fillText(dialogue.text, 0, 0);

      ctx.restore();
    }
  }

  /**
   * Clear all active dialogues
   */
  clear(): void {
    this.activeDialogues = [];
  }
}

// Export singleton instance
export const dialogueSystem = new DialogueSystem();
