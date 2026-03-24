/**
 * Settings scene
 */

import { CONFIG } from '../config';
import { storage } from '../core/storage';
import type { Game } from '../engine/game';
import type { PlayerIntent } from '../engine/input';
import type { Renderer } from '../engine/renderer';
import { Scene } from '../engine/scene';
import { clamp, oscillate } from '../util/math';

interface SettingItem {
  id: string;
  label: string;
  type: 'slider' | 'toggle';
  getValue: () => number | boolean;
  setValue: (value: number | boolean) => void;
  min?: number;
  max?: number;
  step?: number;
}

export class SettingsScene extends Scene {
  // Mark as overlay - renders on top of the previous scene
  readonly isOverlay: boolean = true;

  private settings: SettingItem[] = [];
  private selectedIndex: number = 0;
  private time: number = 0;
  private inputCooldown: number = 0;

  constructor(game: Game) {
    super(game);

    this.settings = [
      {
        id: 'masterVolume',
        label: 'MASTER VOLUME',
        type: 'slider',
        getValue: () => storage.settings.masterVolume,
        setValue: (v) => storage.updateSettings({ masterVolume: v as number }),
        min: 0,
        max: 1,
        step: 0.1,
      },
      {
        id: 'musicVolume',
        label: 'MUSIC VOLUME',
        type: 'slider',
        getValue: () => storage.settings.musicVolume,
        setValue: (v) => storage.updateSettings({ musicVolume: v as number }),
        min: 0,
        max: 1,
        step: 0.1,
      },
      {
        id: 'sfxVolume',
        label: 'SFX VOLUME',
        type: 'slider',
        getValue: () => storage.settings.sfxVolume,
        setValue: (v) => storage.updateSettings({ sfxVolume: v as number }),
        min: 0,
        max: 1,
        step: 0.1,
      },
      {
        id: 'screenShake',
        label: 'SCREEN SHAKE',
        type: 'toggle',
        getValue: () => storage.settings.screenShake,
        setValue: (v) => storage.updateSettings({ screenShake: v as boolean }),
      },
      {
        id: 'showFps',
        label: 'SHOW FPS',
        type: 'toggle',
        getValue: () => storage.settings.showFps,
        setValue: (v) => storage.updateSettings({ showFps: v as boolean }),
      },
    ];
  }

  enter(): void {
    this.selectedIndex = 0;
    this.time = 0;
    this.inputCooldown = 0.2;
  }

  exit(): void {
    storage.save();
    this.game.getAudio().updateVolumes();
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
      this.game.getScenes().pop();
      return;
    }

    // Navigation
    if (intent.moveAxis < -0.5) {
      // Move up or adjust value left
      const setting = this.settings[this.selectedIndex];
      if (setting.type === 'slider') {
        const currentValue = setting.getValue() as number;
        const newValue = clamp(currentValue - (setting.step ?? 0.1), setting.min ?? 0, setting.max ?? 1);
        setting.setValue(newValue);
        this.inputCooldown = 0.1;
      }
    } else if (intent.moveAxis > 0.5) {
      // Move down or adjust value right
      const setting = this.settings[this.selectedIndex];
      if (setting.type === 'slider') {
        const currentValue = setting.getValue() as number;
        const newValue = clamp(currentValue + (setting.step ?? 0.1), setting.min ?? 0, setting.max ?? 1);
        setting.setValue(newValue);
        this.inputCooldown = 0.1;
      }
    }

    // Confirm (toggle or next item)
    if (intent.confirm) {
      const setting = this.settings[this.selectedIndex];
      if (setting.type === 'toggle') {
        setting.setValue(!setting.getValue());
        this.inputCooldown = 0.2;
      } else {
        // Move to next setting
        this.selectedIndex = (this.selectedIndex + 1) % this.settings.length;
        this.inputCooldown = 0.15;
      }
    }
  }

  render(renderer: Renderer, _alpha: number): void {
    const { width, height } = renderer;

    // Clear canvas and reset context state
    renderer.context.globalAlpha = 1;
    renderer.fillRect(0, 0, width, height, '#000000');

    // Background
    renderer.radialGradientBackground(
      [CONFIG.COLORS.BACKGROUND, CONFIG.COLORS.BACKGROUND_LIGHT],
      width / 2,
      height / 2,
    );

    // Title
    renderer.glowText('SETTINGS', width / 2, height * 0.15, CONFIG.COLORS.ACCENT, 40, 'center', 20);

    // Settings list
    const startY = height * 0.3;
    const spacing = 60;

    this.settings.forEach((setting, index) => {
      const y = startY + index * spacing;
      const isSelected = index === this.selectedIndex;

      const labelColor = isSelected ? CONFIG.COLORS.PRIMARY : CONFIG.COLORS.TEXT;

      // Label
      renderer.text(setting.label, width * 0.3, y, labelColor, isSelected ? 22 : 20, 'left', 'middle');

      // Value
      if (setting.type === 'slider') {
        const value = setting.getValue() as number;
        const barWidth = 200;
        const barHeight = 10;
        const barX = width * 0.55;
        const barY = y - barHeight / 2;

        // Background bar
        renderer.fillRect(barX, barY, barWidth, barHeight, CONFIG.COLORS.BACKGROUND_LIGHT);

        // Fill bar
        const fillWidth = value * barWidth;
        renderer.fillRect(
          barX,
          barY,
          fillWidth,
          barHeight,
          isSelected ? CONFIG.COLORS.PRIMARY : CONFIG.COLORS.TEXT_DIM,
        );

        // Border
        renderer.strokeRect(
          barX,
          barY,
          barWidth,
          barHeight,
          isSelected ? CONFIG.COLORS.PRIMARY : CONFIG.COLORS.TEXT_DIM,
        );

        // Value text
        renderer.text(`${Math.round(value * 100)}%`, barX + barWidth + 20, y, labelColor, 18, 'left', 'middle');

        if (isSelected) {
          // Arrows
          const pulse = oscillate(this.time, 3, 3);
          renderer.text('◄', barX - 20 - pulse, y, CONFIG.COLORS.PRIMARY, 16, 'center', 'middle');
          renderer.text('►', barX + barWidth + 60 + pulse, y, CONFIG.COLORS.PRIMARY, 16, 'center', 'middle');
        }
      } else if (setting.type === 'toggle') {
        const value = setting.getValue() as boolean;
        const toggleX = width * 0.55;

        const text = value ? 'ON' : 'OFF';
        const color = value ? CONFIG.COLORS.SUCCESS : CONFIG.COLORS.DANGER;

        renderer.glowText(text, toggleX, y, color, 20, 'left', isSelected ? 10 : 0);
      }

      // Selection indicator
      if (isSelected) {
        const pulse = oscillate(this.time, 2, 5);
        renderer.glowCircle(width * 0.25 - 20 + pulse, y, 5, CONFIG.COLORS.PRIMARY, 8);
      }
    });

    // Controls hint
    renderer.text(
      '← → ADJUST   SPACE TOGGLE/NEXT   ESC BACK',
      width / 2,
      height - 40,
      CONFIG.COLORS.TEXT_DIM,
      12,
      'center',
    );
  }
}
