/**
 * Level Select scene - allows selecting Acts and Expansions
 * Updated for Level Bible v2 with 8 Acts and Expansion Vault
 */

import { CONFIG } from '../config';
import { contentLoader } from '../content/loader';
import type { ActData, ExpansionCategory } from '../content/schema';
import { storage } from '../core/storage';
import type { PlayerIntent } from '../engine/input';
import type { Renderer } from '../engine/renderer';
import { Scene } from '../engine/scene';

type ViewMode = 'acts' | 'expansions';

interface ActInfo {
  act: ActData;
  index: number;
  unlocked: boolean;
  completed: boolean;
}

interface ExpansionInfo {
  expansion: ExpansionCategory;
  index: number;
  unlocked: boolean;
}

export class LevelSelectScene extends Scene {
  private viewMode: ViewMode = 'acts';
  private acts: ActInfo[] = [];
  private expansions: ExpansionInfo[] = [];
  private selectedIndex: number = 0;
  private time: number = 0;
  private inputCooldown: number = 0;
  private tabCooldown: number = 0;
  private toastMessage: string = '';
  private toastTimer: number = 0;
  private toastColor: string = CONFIG.COLORS.PRIMARY;

  enter(): void {
    this.selectedIndex = 0;
    this.time = 0;
    this.inputCooldown = 0.2;
    this.tabCooldown = 0;
    this.viewMode = 'acts';
    this.toastMessage = '';
    this.toastTimer = 0;

    this.buildActList();
    this.buildExpansionList();
  }

  exit(): void {
    // Cleanup
  }

  private buildActList(): void {
    const highestCompleted = storage.highestSector; // Acts completed
    const allActs = contentLoader.getAllActs();

    // Sort by act number
    allActs.sort((a, b) => a.number - b.number);

    this.acts = allActs.map((act, index) => ({
      act,
      index,
      // For testing, unlock all acts; in production: highestCompleted >= index
      unlocked: true, // highestCompleted >= index,
      completed: highestCompleted > index,
    }));
  }

  private buildExpansionList(): void {
    const allExpansions = contentLoader.getAllExpansionCategories();

    this.expansions = allExpansions.map((expansion, index) => ({
      expansion,
      index,
      unlocked: false,
    }));
  }

  update(dt: number, intent: PlayerIntent): void {
    this.time += dt;

    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
    }

    // Input cooldown
    if (this.inputCooldown > 0) {
      this.inputCooldown -= dt;
    }
    if (this.tabCooldown > 0) {
      this.tabCooldown -= dt;
    }

    // Back to menu
    if (intent.cancel) {
      this.game.getScenes().goto('menu');
      return;
    }

    // Tab switching with left/right at top
    if (this.tabCooldown <= 0) {
      if (intent.moveAxis < -0.5) {
        this.viewMode = 'acts';
        this.selectedIndex = 0;
        this.tabCooldown = 0.2;
      } else if (intent.moveAxis > 0.5) {
        this.tabCooldown = 0.2;
        this.showToast(contentLoader.getString('level_select_under_construction'), CONFIG.COLORS.PRIMARY);
      }
    }

    // Navigate with up/down
    if (this.inputCooldown <= 0) {
      const items = this.viewMode === 'acts' ? this.acts : this.expansions;

      if (intent.menuAxis < -0.5) {
        this.selectedIndex = Math.max(0, this.selectedIndex - 1);
        this.inputCooldown = 0.15;
      } else if (intent.menuAxis > 0.5) {
        this.selectedIndex = Math.min(items.length - 1, this.selectedIndex + 1);
        this.inputCooldown = 0.15;
      }

      // Select item
      if (intent.confirm) {
        if (this.viewMode === 'acts') {
          const actInfo = this.acts[this.selectedIndex];
          if (actInfo.unlocked) {
            this.game.getScenes().setContext('levelSelect', {
              mode: 'act',
              actId: actInfo.act.id,
              actIndex: actInfo.index,
            });
            this.game.getScenes().replace('campaign');
          }
        } else {
          const expInfo = this.expansions[this.selectedIndex];
          if (expInfo.unlocked) {
            this.game.getScenes().setContext('levelSelect', {
              mode: 'expansion',
              expansionId: expInfo.expansion.id,
            });
            this.game.getScenes().replace('campaign');
          }
        }
        this.inputCooldown = 0.2;
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
    renderer.glowText(
      contentLoader.getString('level_select_title'),
      width / 2,
      50,
      CONFIG.COLORS.PRIMARY,
      36,
      'center',
      20,
    );

    // Tab buttons
    this.renderTabs(renderer, width);

    // Content based on view mode
    if (this.viewMode === 'acts') {
      this.renderActList(renderer, width, height);
    } else {
      this.renderExpansionList(renderer, width, height);
    }

    // Controls hint
    renderer.text(
      '← → TABS   ↑ ↓ SELECT   SPACE START   ESC BACK',
      width / 2,
      height - 25,
      CONFIG.COLORS.TEXT_DIM,
      11,
      'center',
    );

    this.renderToast(renderer, width, height);
  }

  private renderTabs(renderer: Renderer, width: number): void {
    const ctx = renderer.context;
    const tabY = 95;
    const tabH = 30;
    const gap = 12;
    const pad = 16;

    const actsLabel = contentLoader.getString('level_select_tab_canon');
    const expLabel = contentLoader.getString('level_select_tab_expansion');

    ctx.font = "14px 'SF Mono', Consolas, 'Liberation Mono', monospace";
    const actsW = ctx.measureText(actsLabel).width + pad * 2;
    const expW = ctx.measureText(expLabel).width + pad * 2;
    const totalW = actsW + gap + expW;

    const leftX = width / 2 - totalW / 2;
    const rightX = leftX + actsW + gap;

    const actsSelected = this.viewMode === 'acts';
    renderer.fillRect(leftX, tabY - tabH / 2, actsW, tabH, actsSelected ? CONFIG.COLORS.PRIMARY : '#333344');
    renderer.text(actsLabel, leftX + actsW / 2, tabY, actsSelected ? '#000000' : CONFIG.COLORS.TEXT_DIM, 14, 'center');

    renderer.fillRect(rightX, tabY - tabH / 2, expW, tabH, '#222233');
    renderer.text(expLabel, rightX + expW / 2, tabY, CONFIG.COLORS.TEXT_DIM, 14, 'center');
  }

  private renderActList(renderer: Renderer, width: number, height: number): void {
    const ctx = renderer.context;
    const startY = 150;
    const itemHeight = 65;
    const maxVisible = Math.floor((height - startY - 60) / itemHeight);

    // Calculate scroll offset
    const scrollOffset = Math.max(0, this.selectedIndex - Math.floor(maxVisible / 2));
    const visibleActs = this.acts.slice(scrollOffset, scrollOffset + maxVisible);

    visibleActs.forEach((actInfo, displayIndex) => {
      const actualIndex = scrollOffset + displayIndex;
      const y = startY + displayIndex * itemHeight;
      const isSelected = actualIndex === this.selectedIndex;

      // Selection box
      if (isSelected) {
        renderer.strokeRect(width / 2 - 220, y - 25, 440, 55, CONFIG.COLORS.PRIMARY, 2);
      }

      if (actInfo.unlocked) {
        // Act number badge
        const badgeColor = this.getActColor(actInfo.act.number);
        renderer.fillRect(width / 2 - 210, y - 18, 50, 36, badgeColor);
        renderer.text(`ACT ${actInfo.act.number}`, width / 2 - 185, y, '#000000', 12, 'center');

        // Act name (truncated to fit within selection box)
        const nameMaxW = 300;
        let actName = actInfo.act.name.toUpperCase();
        const nameSize = isSelected ? 18 : 16;
        ctx.font = `bold ${nameSize}px 'SF Mono', Consolas, 'Liberation Mono', monospace`;
        if (ctx.measureText(actName).width > nameMaxW) {
          while (actName.length > 3 && ctx.measureText(actName + '...').width > nameMaxW) {
            actName = actName.slice(0, -1);
          }
          actName += '...';
        }
        renderer.hudText(
          actName,
          width / 2 - 150,
          y - 8,
          isSelected ? CONFIG.COLORS.PRIMARY : CONFIG.COLORS.TEXT,
          nameSize,
          'left',
        );

        // Act thesis (truncated)
        const thesisMaxW = 340;
        let thesis = actInfo.act.thesis;
        ctx.font = "11px 'SF Mono', Consolas, 'Liberation Mono', monospace";
        if (ctx.measureText(thesis).width > thesisMaxW) {
          while (thesis.length > 3 && ctx.measureText(thesis + '...').width > thesisMaxW) {
            thesis = thesis.slice(0, -1);
          }
          thesis += '...';
        }
        renderer.text(thesis, width / 2 - 150, y + 12, CONFIG.COLORS.TEXT_DIM, 11, 'left');

        // Status indicator
        if (actInfo.completed) {
          renderer.hudText(
            contentLoader.getString('level_select_completed'),
            width / 2 + 210,
            y,
            CONFIG.COLORS.SUCCESS,
            12,
            'right',
          );
        } else {
          renderer.hudText(
            `${actInfo.act.levels.length} LEVELS`,
            width / 2 + 210,
            y,
            CONFIG.COLORS.TEXT_DIM,
            12,
            'right',
          );
        }
      } else {
        // Locked act
        renderer.hudText(`ACT ${actInfo.act.number}`, width / 2 - 180, y - 8, CONFIG.COLORS.TEXT_DIM, 12, 'left');

        renderer.hudText(
          contentLoader.getString('level_select_locked'),
          width / 2 - 180,
          y + 10,
          CONFIG.COLORS.TEXT_DIM,
          16,
          'left',
        );

        renderer.hudText(
          `Complete Act ${actInfo.index} to unlock`,
          width / 2 + 180,
          y,
          CONFIG.COLORS.TEXT_DIM,
          11,
          'right',
        );
      }
    });

    // Scroll indicators
    if (scrollOffset > 0) {
      renderer.text('▲ MORE', width / 2, startY - 15, CONFIG.COLORS.TEXT_DIM, 11, 'center');
    }
    if (scrollOffset + maxVisible < this.acts.length) {
      renderer.text('▼ MORE', width / 2, height - 55, CONFIG.COLORS.TEXT_DIM, 11, 'center');
    }
  }

  private renderExpansionList(renderer: Renderer, width: number, height: number): void {
    const startY = 150;
    const itemHeight = 55;
    const maxVisible = Math.floor((height - startY - 60) / itemHeight);

    if (this.expansions.length === 0) {
      renderer.text(
        contentLoader.getString('level_select_no_expansions'),
        width / 2,
        height / 2,
        CONFIG.COLORS.TEXT_DIM,
        16,
        'center',
      );
      return;
    }

    // Calculate scroll offset
    const scrollOffset = Math.max(0, this.selectedIndex - Math.floor(maxVisible / 2));
    const visibleExpansions = this.expansions.slice(scrollOffset, scrollOffset + maxVisible);

    visibleExpansions.forEach((expInfo, displayIndex) => {
      const actualIndex = scrollOffset + displayIndex;
      const y = startY + displayIndex * itemHeight;
      const isSelected = actualIndex === this.selectedIndex;

      // Selection box
      if (isSelected) {
        renderer.strokeRect(width / 2 - 220, y - 20, 440, 45, CONFIG.COLORS.ACCENT, 2);
      }

      if (expInfo.unlocked) {
        // Expansion name
        renderer.hudText(
          expInfo.expansion.name.toUpperCase(),
          width / 2 - 200,
          y - 3,
          isSelected ? CONFIG.COLORS.ACCENT : CONFIG.COLORS.TEXT,
          isSelected ? 16 : 14,
          'left',
        );

        // Description
        renderer.text(
          expInfo.expansion.description.substring(0, 60) + (expInfo.expansion.description.length > 60 ? '...' : ''),
          width / 2 - 200,
          y + 14,
          CONFIG.COLORS.TEXT_DIM,
          10,
          'left',
        );

        // Level count
        renderer.hudText(
          `${expInfo.expansion.levels.length} LEVELS`,
          width / 2 + 200,
          y,
          CONFIG.COLORS.TEXT_DIM,
          12,
          'right',
        );
      } else {
        renderer.hudText(
          contentLoader.getString('level_select_locked'),
          width / 2 - 200,
          y,
          CONFIG.COLORS.TEXT_DIM,
          14,
          'left',
        );
      }
    });

    // Scroll indicators
    if (scrollOffset > 0) {
      renderer.text('▲ MORE', width / 2, startY - 15, CONFIG.COLORS.TEXT_DIM, 11, 'center');
    }
    if (scrollOffset + maxVisible < this.expansions.length) {
      renderer.text('▼ MORE', width / 2, height - 55, CONFIG.COLORS.TEXT_DIM, 11, 'center');
    }
  }

  private showToast(message: string, color: string = CONFIG.COLORS.PRIMARY): void {
    this.toastMessage = message;
    this.toastTimer = 3;
    this.toastColor = color;
  }

  private renderToast(renderer: Renderer, width: number, height: number): void {
    if (this.toastTimer <= 0 || !this.toastMessage) return;
    const ctx = renderer.context;
    ctx.save();
    ctx.globalAlpha = Math.min(1, this.toastTimer);
    const toastW = Math.max(300, this.toastMessage.length * 9 + 40);
    const toastH = 32;
    const toastX = (width - toastW) / 2;
    const toastY = height * 0.13;
    renderer.drawPanel(toastX, toastY, toastW, toastH, 'rgba(8,8,12,0.9)', this.toastColor, 1);
    renderer.hudText(this.toastMessage, width / 2, toastY + toastH / 2, this.toastColor, 14, 'center');
    ctx.restore();
  }

  private getActColor(actNumber: number): string {
    const colors = [
      '#00ff88', // Act 1 - Escape (green)
      '#00aaff', // Act 2 - Ocean (blue)
      '#d4af37', // Act 3 - Heroic (gold)
      '#ff6600', // Act 4 - Sacred (orange)
      '#ff00aa', // Act 5 - Painted (magenta)
      '#8855ff', // Act 6 - Library (purple)
      '#888888', // Act 7 - Machine (silver)
      '#ffffff', // Act 8 - Signals (white)
    ];
    return colors[(actNumber - 1) % colors.length];
  }
}
