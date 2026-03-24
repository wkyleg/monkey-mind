/**
 * Codex/Bestiary scene
 */

import { CONFIG } from '../config';
import { contentLoader } from '../content/loader';
import { storage } from '../core/storage';
import type { PlayerIntent } from '../engine/input';
import type { Renderer } from '../engine/renderer';
import { Scene } from '../engine/scene';
import { oscillate } from '../util/math';

interface CodexCategory {
  id: string;
  name: string;
  entries: CodexDisplayEntry[];
}

interface CodexDisplayEntry {
  id: string;
  name: string;
  unlocked: boolean;
  description?: string;
}

export class CodexScene extends Scene {
  // Mark as overlay - renders on top of the previous scene
  readonly isOverlay: boolean = true;

  private categories: CodexCategory[] = [];
  private selectedCategoryIndex: number = 0;
  private selectedEntryIndex: number = 0;
  private time: number = 0;
  private inputCooldown: number = 0;
  private viewMode: 'list' | 'detail' = 'list';

  enter(): void {
    this.selectedCategoryIndex = 0;
    this.selectedEntryIndex = 0;
    this.time = 0;
    this.inputCooldown = 0.2;
    this.viewMode = 'list';

    this.buildCategories();
  }

  exit(): void {
    // Cleanup
  }

  private buildCategories(): void {
    const unlockedIds = new Set(storage.getData().codexUnlocked);

    // Build enemy category dynamically from content
    const enemies = contentLoader.getAllEnemies();
    const enemyEntries: CodexDisplayEntry[] =
      enemies.length > 0
        ? enemies.map((e) => ({
            id: e.id,
            name: e.name,
            unlocked: unlockedIds.has(e.id),
            description: e.codexEntry,
          }))
        : [
            {
              id: 'synapse_drone',
              name: 'Synapse Drone',
              unlocked: true,
              description: 'Basic neural defense unit. Patrols thought corridors endlessly.',
            },
            { id: 'neuron_cluster', name: 'Neuron Cluster', unlocked: false },
            { id: 'glitch_sprite', name: 'Glitch Sprite', unlocked: false },
            { id: 'orbital_eye', name: 'Orbital Eye', unlocked: false },
          ];

    // Build boss category dynamically from content
    const bosses = contentLoader.getAllBosses();
    const bossEntries: CodexDisplayEntry[] =
      bosses.length > 0
        ? bosses.map((b) => ({
            id: b.id,
            name: b.name,
            unlocked: unlockedIds.has(b.id),
            description: b.codexEntry,
          }))
        : [
            {
              id: 'cortex_auditor',
              name: 'Cortex Auditor',
              unlocked: unlockedIds.has('cortex_auditor'),
              description: 'The Mind Inspector. Audits all neural traffic for unauthorized thoughts.',
            },
            { id: 'grey_administrator', name: 'Grey Administrator', unlocked: unlockedIds.has('grey_administrator') },
            { id: 'banana_pentagon', name: 'Banana Pentagon', unlocked: unlockedIds.has('banana_pentagon') },
            { id: 'archon_exe', name: 'Archon.EXE', unlocked: unlockedIds.has('archon_exe') },
            { id: 'mirror_self', name: 'Mirror Self', unlocked: unlockedIds.has('mirror_self') },
          ];

    // Build categories
    this.categories = [
      {
        id: 'enemies',
        name: 'ENEMIES',
        entries: enemyEntries,
      },
      {
        id: 'bosses',
        name: 'BOSSES',
        entries: bossEntries,
      },
      {
        id: 'lore',
        name: 'SECRET FILES',
        entries: [
          {
            id: 'project_monkeymind',
            name: 'Project: Monkey Mind',
            unlocked: unlockedIds.has('project_monkeymind'),
            description: '[REDACTED] ...the subject exhibited unprecedented neural plasticity...',
          },
          { id: 'neural_cage_memo', name: 'Neural Cage Memo', unlocked: unlockedIds.has('neural_cage_memo') },
          {
            id: 'synaptic_reef_report',
            name: 'Synaptic Reef Report',
            unlocked: unlockedIds.has('synaptic_reef_report'),
          },
        ],
      },
    ];
  }

  update(dt: number, intent: PlayerIntent): void {
    this.time += dt;

    // Input cooldown
    if (this.inputCooldown > 0) {
      this.inputCooldown -= dt;
      return;
    }

    // Back
    if (intent.cancel) {
      if (this.viewMode === 'detail') {
        this.viewMode = 'list';
        this.inputCooldown = 0.2;
      } else {
        this.game.getScenes().pop();
      }
      return;
    }

    if (this.viewMode === 'list') {
      // Switch category with left/right arrows
      if (intent.moveAxis < -0.5) {
        this.selectedCategoryIndex = Math.max(0, this.selectedCategoryIndex - 1);
        this.selectedEntryIndex = 0; // Reset entry selection when switching category
        this.inputCooldown = 0.15;
      } else if (intent.moveAxis > 0.5) {
        this.selectedCategoryIndex = Math.min(this.categories.length - 1, this.selectedCategoryIndex + 1);
        this.selectedEntryIndex = 0; // Reset entry selection when switching category
        this.inputCooldown = 0.15;
      }

      // Navigate entries with up/down arrows
      if (intent.menuAxis < -0.5) {
        this.selectedEntryIndex = Math.max(0, this.selectedEntryIndex - 1);
        this.inputCooldown = 0.15;
      } else if (intent.menuAxis > 0.5) {
        const category = this.categories[this.selectedCategoryIndex];
        this.selectedEntryIndex = Math.min(category.entries.length - 1, this.selectedEntryIndex + 1);
        this.inputCooldown = 0.15;
      }

      // View detail with confirm
      if (intent.confirm) {
        const category = this.categories[this.selectedCategoryIndex];
        const entry = category.entries[this.selectedEntryIndex];
        if (entry.unlocked) {
          this.viewMode = 'detail';
          this.inputCooldown = 0.2;
        }
      }
    }
  }

  render(renderer: Renderer, _alpha: number): void {
    const { width, height } = renderer;

    // Clear canvas and reset context state
    renderer.context.globalAlpha = 1;
    renderer.fillRect(0, 0, width, height, '#000000');

    // Background
    renderer.radialGradientBackground([CONFIG.COLORS.BACKGROUND, '#1a1a2e'], width / 2, height / 2);

    // Title
    renderer.glowText('CODEX', width / 2, 50, CONFIG.COLORS.ACCENT, 40, 'center', 20);

    // Category tabs
    const tabY = 100;
    const tabWidth = width / this.categories.length;

    this.categories.forEach((category, index) => {
      const x = tabWidth * index + tabWidth / 2;
      const isSelected = index === this.selectedCategoryIndex;

      renderer.text(
        category.name,
        x,
        tabY,
        isSelected ? CONFIG.COLORS.PRIMARY : CONFIG.COLORS.TEXT_DIM,
        isSelected ? 20 : 16,
        'center',
      );

      if (isSelected) {
        renderer.line(x - 50, tabY + 20, x + 50, tabY + 20, CONFIG.COLORS.PRIMARY, 2);
      }
    });

    if (this.viewMode === 'list') {
      this.renderList(renderer);
    } else {
      this.renderDetail(renderer);
    }

    // Controls hint
    renderer.text(
      '← → CATEGORY   ↑ ↓ SELECT   SPACE VIEW   ESC BACK',
      width / 2,
      height - 30,
      CONFIG.COLORS.TEXT_DIM,
      12,
      'center',
    );
  }

  private renderList(renderer: Renderer): void {
    const { width } = renderer;
    const category = this.categories[this.selectedCategoryIndex];

    const startY = 160;
    const spacing = 40;

    category.entries.forEach((entry, index) => {
      const y = startY + index * spacing;
      const isSelected = index === this.selectedEntryIndex;

      if (entry.unlocked) {
        const color = isSelected ? CONFIG.COLORS.PRIMARY : CONFIG.COLORS.TEXT;
        renderer.text(entry.name, width * 0.3, y, color, isSelected ? 20 : 18, 'left');

        if (isSelected) {
          const pulse = oscillate(this.time, 2, 5);
          renderer.glowCircle(width * 0.25 + pulse, y + 8, 5, CONFIG.COLORS.PRIMARY, 8);
        }
      } else {
        renderer.text('???', width * 0.3, y, CONFIG.COLORS.TEXT_DIM, 18, 'left');
        renderer.text('[LOCKED]', width * 0.6, y, CONFIG.COLORS.TEXT_DIM, 14, 'left');
      }
    });
  }

  private renderDetail(renderer: Renderer): void {
    const { width, height } = renderer;
    const category = this.categories[this.selectedCategoryIndex];
    const entry = category.entries[this.selectedEntryIndex];

    if (!entry.unlocked) return;

    // Entry name
    renderer.glowText(entry.name.toUpperCase(), width / 2, 180, CONFIG.COLORS.PRIMARY, 32, 'center', 15);

    // Description
    if (entry.description) {
      const lines = this.wrapText(entry.description, 60);
      lines.forEach((line, i) => {
        renderer.text(line, width / 2, 260 + i * 25, CONFIG.COLORS.TEXT, 16, 'center');
      });
    }

    // Category badge
    renderer.text(category.name, width / 2, height - 100, CONFIG.COLORS.TEXT_DIM, 14, 'center');
  }

  private wrapText(text: string, maxChars: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      if (`${currentLine} ${word}`.trim().length <= maxChars) {
        currentLine = `${currentLine} ${word}`.trim();
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);

    return lines;
  }
}
