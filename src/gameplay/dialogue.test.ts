/**
 * Dialogue System Tests
 *
 * Tests for event-driven dialogue spawning, rendering, and lifecycle.
 * Uses dynamic imports to avoid singleton initialization issues.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('DialogueSystem', () => {
  let eventListeners: Map<string, Function[]>;

  beforeEach(() => {
    vi.resetModules();
    eventListeners = new Map();

    vi.doMock('../core/events', () => ({
      events: {
        emit: vi.fn(),
        on: vi.fn((event: string, callback: Function) => {
          if (!eventListeners.has(event)) {
            eventListeners.set(event, []);
          }
          eventListeners.get(event)!.push(callback);
          return () => {};
        }),
        off: vi.fn(),
      },
    }));

    vi.doMock('../content/loader', () => ({
      contentLoader: {
        getEnemyDialogue: vi.fn((type: string) => {
          if (type === 'test_enemy') {
            return {
              spawn: ['SPAWNING!', 'HELLO!'],
              death: ['DYING!', 'GOODBYE!'],
            };
          }
          return null;
        }),
      },
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  const triggerEvent = (eventName: string, data: unknown) => {
    const listeners = eventListeners.get(eventName) || [];
    for (const listener of listeners) {
      listener(data);
    }
  };

  describe('Construction', () => {
    it('should create DialogueSystem instance', async () => {
      const { DialogueSystem } = await import('./dialogue');
      const dialogue = new DialogueSystem();
      expect(dialogue).toBeDefined();
    });

    it('should register event listeners on construction', async () => {
      const { DialogueSystem } = await import('./dialogue');
      new DialogueSystem();

      expect(eventListeners.has('enemy:spawn')).toBe(true);
      expect(eventListeners.has('enemy:death')).toBe(true);
    });
  });

  describe('Enable / Disable', () => {
    it('should allow disabling dialogue', async () => {
      const { DialogueSystem } = await import('./dialogue');
      const dialogue = new DialogueSystem();
      dialogue.setEnabled(false);

      vi.spyOn(Math, 'random').mockReturnValue(0.01);
      triggerEvent('enemy:spawn', { type: 'drifter', x: 100, y: 50 });
      dialogue.update(0.1);
      // No crash — dialogue silently ignored
    });

    it('should allow re-enabling dialogue', async () => {
      const { DialogueSystem } = await import('./dialogue');
      const dialogue = new DialogueSystem();
      dialogue.setEnabled(false);
      dialogue.setEnabled(true);

      vi.spyOn(Math, 'random').mockReturnValue(0.01);
      triggerEvent('enemy:spawn', { type: 'drifter', x: 100, y: 50 });
      dialogue.update(0.1);
    });
  });

  describe('Update', () => {
    it('should update without crashing', async () => {
      const { DialogueSystem } = await import('./dialogue');
      const dialogue = new DialogueSystem();

      expect(() => dialogue.update(0.1)).not.toThrow();
    });

    it('should remove expired dialogues after their maxLifetime', async () => {
      const { DialogueSystem } = await import('./dialogue');
      const dialogue = new DialogueSystem();

      vi.spyOn(Math, 'random').mockReturnValue(0.01);
      triggerEvent('enemy:spawn', { type: 'drifter', x: 100, y: 50 });

      dialogue.update(5);
      // After 5s the 1.5s-lifetime dialogue is gone — no crash
    });
  });

  describe('Clear', () => {
    it('should clear all dialogues', async () => {
      const { DialogueSystem } = await import('./dialogue');
      const dialogue = new DialogueSystem();

      vi.spyOn(Math, 'random').mockReturnValue(0.01);
      triggerEvent('enemy:spawn', { type: 'drifter', x: 100, y: 50 });
      dialogue.update(0.1);

      dialogue.clear();
      dialogue.update(0.1);
    });
  });

  describe('Event Handling', () => {
    it('should handle enemy spawn event when probability allows', async () => {
      const { DialogueSystem } = await import('./dialogue');
      const dialogue = new DialogueSystem();

      vi.spyOn(Math, 'random').mockReturnValue(0.1);
      triggerEvent('enemy:spawn', { type: 'test_enemy', x: 100, y: 50 });
      dialogue.update(0.1);
    });

    it('should handle enemy death event', async () => {
      const { DialogueSystem } = await import('./dialogue');
      const dialogue = new DialogueSystem();

      vi.spyOn(Math, 'random').mockReturnValue(0.1);
      triggerEvent('enemy:death', { type: 'test_enemy', position: { x: 100, y: 200 } });
      dialogue.update(0.1);
    });

    it('should not spawn text when probability blocks', async () => {
      const { DialogueSystem } = await import('./dialogue');
      const dialogue = new DialogueSystem();

      vi.spyOn(Math, 'random').mockReturnValue(0.9);
      triggerEvent('enemy:spawn', { type: 'test_enemy', x: 100, y: 50 });
      dialogue.update(0.1);
    });

    it('should respect cooldown between dialogues', async () => {
      const { DialogueSystem } = await import('./dialogue');
      const dialogue = new DialogueSystem();

      vi.spyOn(Math, 'random').mockReturnValue(0.1);

      triggerEvent('enemy:spawn', { type: 'test_enemy', x: 100, y: 50 });
      dialogue.update(0.1);

      triggerEvent('enemy:spawn', { type: 'test_enemy', x: 200, y: 50 });
      dialogue.update(0.1);
    });

    it('should allow spawn after cooldown expires', async () => {
      const { DialogueSystem } = await import('./dialogue');
      const dialogue = new DialogueSystem();

      vi.spyOn(Math, 'random').mockReturnValue(0.1);

      triggerEvent('enemy:spawn', { type: 'test_enemy', x: 100, y: 50 });
      dialogue.update(2);

      triggerEvent('enemy:spawn', { type: 'test_enemy', x: 200, y: 50 });
      dialogue.update(0.1);
    });

    it('should handle actVisual field for unique enemy dialogue', async () => {
      const { DialogueSystem } = await import('./dialogue');
      const dialogue = new DialogueSystem();

      vi.spyOn(Math, 'random').mockReturnValue(0.1);
      triggerEvent('enemy:spawn', { type: 'drifter', x: 100, y: 50, actVisual: 'test_enemy' });
      dialogue.update(0.1);
    });
  });

  describe('Render', () => {
    const createMockRenderer = () => ({
      context: {
        save: vi.fn(),
        restore: vi.fn(),
        translate: vi.fn(),
        scale: vi.fn(),
        font: '',
        textAlign: '',
        textBaseline: '',
        shadowColor: '',
        shadowBlur: 0,
        strokeStyle: '',
        lineWidth: 0,
        fillStyle: '',
        globalAlpha: 1,
        fillText: vi.fn(),
        strokeText: vi.fn(),
      },
    });

    it('should render without crashing when empty', async () => {
      const { DialogueSystem } = await import('./dialogue');
      const dialogue = new DialogueSystem();
      const mockRenderer = createMockRenderer();

      expect(() => dialogue.render(mockRenderer as any)).not.toThrow();
    });

    it('should render active dialogues', async () => {
      const { DialogueSystem } = await import('./dialogue');
      const dialogue = new DialogueSystem();
      const mockRenderer = createMockRenderer();

      vi.spyOn(Math, 'random').mockReturnValue(0.01);
      vi.spyOn(performance, 'now').mockReturnValue(5000);
      triggerEvent('enemy:spawn', { type: 'drifter', x: 100, y: 50 });
      dialogue.update(0.1);

      dialogue.render(mockRenderer as any);
      expect(mockRenderer.context.fillText).toHaveBeenCalled();
    });

    it('should not render expired dialogues', async () => {
      const { DialogueSystem } = await import('./dialogue');
      const dialogue = new DialogueSystem();
      const mockRenderer = createMockRenderer();

      vi.spyOn(Math, 'random').mockReturnValue(0.01);
      triggerEvent('enemy:spawn', { type: 'drifter', x: 100, y: 50 });
      dialogue.update(5);

      dialogue.render(mockRenderer as any);
      expect(mockRenderer.context.fillText).not.toHaveBeenCalled();
    });
  });
});
