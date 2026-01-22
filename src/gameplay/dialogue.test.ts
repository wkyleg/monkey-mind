/**
 * Dialogue System Tests
 * 
 * Tests for floating text spawning, enemy dialogue triggers, and rendering.
 * Uses dynamic imports to avoid singleton initialization issues.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

describe('DialogueSystem', () => {
  // Event listener storage
  let eventListeners: Map<string, Function[]>;

  beforeEach(() => {
    vi.resetModules();
    eventListeners = new Map();

    // Mock events module before importing DialogueSystem
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

    // Mock contentLoader
    vi.doMock('../content/loader', () => ({
      contentLoader: {
        getEnemy: vi.fn((type: string) => {
          if (type === 'test_enemy') {
            return {
              id: 'test_enemy',
              name: 'Test Enemy',
              visual: { color: '#00ff00' },
              spawnText: ['SPAWNING!', 'HELLO!'],
              deathText: ['DYING!', 'GOODBYE!'],
            };
          }
          if (type === 'silent_enemy') {
            return {
              id: 'silent_enemy',
              name: 'Silent Enemy',
              visual: { color: '#ff0000' },
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

  // Helper to trigger events
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

  describe('Manual Text Spawning', () => {
    it('should spawn text manually', async () => {
      const { DialogueSystem } = await import('./dialogue');
      const dialogue = new DialogueSystem();
      
      dialogue.spawnText('TEST MESSAGE', 100, 200, 'dialogue', '#ffffff');
      dialogue.update(0.1);
    });

    it('should spawn different text types', async () => {
      const { DialogueSystem } = await import('./dialogue');
      const dialogue = new DialogueSystem();
      
      dialogue.spawnText('Spawn', 100, 100, 'spawn', '#00ff00');
      dialogue.spawnText('Death', 100, 150, 'death', '#ff0000');
      dialogue.spawnText('Dialog', 100, 200, 'dialogue', '#ffffff');
      dialogue.update(0.1);
    });
  });

  describe('Update', () => {
    it('should update without crashing', async () => {
      const { DialogueSystem } = await import('./dialogue');
      const dialogue = new DialogueSystem();
      
      expect(() => dialogue.update(0.1)).not.toThrow();
    });

    it('should remove expired texts', async () => {
      const { DialogueSystem } = await import('./dialogue');
      const dialogue = new DialogueSystem();
      
      dialogue.spawnText('TEST', 100, 100);
      dialogue.update(3); // Past 2 second lifetime
    });
  });

  describe('Clear', () => {
    it('should clear all texts', async () => {
      const { DialogueSystem } = await import('./dialogue');
      const dialogue = new DialogueSystem();
      
      dialogue.spawnText('TEST 1', 100, 100);
      dialogue.spawnText('TEST 2', 100, 150);
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

    it('should not spawn text for silent enemies', async () => {
      const { DialogueSystem } = await import('./dialogue');
      const dialogue = new DialogueSystem();
      
      vi.spyOn(Math, 'random').mockReturnValue(0.1);

      triggerEvent('enemy:spawn', { type: 'silent_enemy', x: 100, y: 50 });
      dialogue.update(0.1);
    });

    it('should not spawn text when probability blocks', async () => {
      const { DialogueSystem } = await import('./dialogue');
      const dialogue = new DialogueSystem();
      
      vi.spyOn(Math, 'random').mockReturnValue(0.9);

      triggerEvent('enemy:spawn', { type: 'test_enemy', x: 100, y: 50 });
      dialogue.update(0.1);
    });

    it('should respect cooldown', async () => {
      const { DialogueSystem } = await import('./dialogue');
      const dialogue = new DialogueSystem();
      
      vi.spyOn(Math, 'random').mockReturnValue(0.1);

      triggerEvent('enemy:spawn', { type: 'test_enemy', x: 100, y: 50 });
      dialogue.update(0.1);

      // Second spawn immediately (should be blocked by cooldown)
      triggerEvent('enemy:spawn', { type: 'test_enemy', x: 200, y: 50 });
      dialogue.update(0.1);
    });

    it('should allow spawn after cooldown expires', async () => {
      const { DialogueSystem } = await import('./dialogue');
      const dialogue = new DialogueSystem();
      
      vi.spyOn(Math, 'random').mockReturnValue(0.1);

      triggerEvent('enemy:spawn', { type: 'test_enemy', x: 100, y: 50 });
      dialogue.update(2); // Past cooldown

      triggerEvent('enemy:spawn', { type: 'test_enemy', x: 200, y: 50 });
      dialogue.update(0.1);
    });
  });

  describe('Render', () => {
    it('should render without crashing', async () => {
      const { DialogueSystem } = await import('./dialogue');
      const dialogue = new DialogueSystem();
      
      const mockRenderer = {
        context: {
          save: vi.fn(),
          restore: vi.fn(),
          font: '',
          textAlign: '',
          textBaseline: '',
          shadowColor: '',
          shadowBlur: 0,
          shadowOffsetX: 0,
          shadowOffsetY: 0,
          fillStyle: '',
          globalAlpha: 1,
          fillText: vi.fn(),
        },
      };

      dialogue.spawnText('TEST', 100, 100);
      dialogue.update(0.1);

      expect(() => dialogue.render(mockRenderer as any)).not.toThrow();
    });

    it('should call fillText for active texts', async () => {
      const { DialogueSystem } = await import('./dialogue');
      const dialogue = new DialogueSystem();
      
      const mockRenderer = {
        context: {
          save: vi.fn(),
          restore: vi.fn(),
          font: '',
          textAlign: '',
          textBaseline: '',
          shadowColor: '',
          shadowBlur: 0,
          shadowOffsetX: 0,
          shadowOffsetY: 0,
          fillStyle: '',
          globalAlpha: 1,
          fillText: vi.fn(),
        },
      };

      dialogue.spawnText('TEST', 100, 100);
      dialogue.update(0.1);
      dialogue.render(mockRenderer as any);

      expect(mockRenderer.context.fillText).toHaveBeenCalled();
    });

    it('should not render expired texts', async () => {
      const { DialogueSystem } = await import('./dialogue');
      const dialogue = new DialogueSystem();
      
      const mockRenderer = {
        context: {
          save: vi.fn(),
          restore: vi.fn(),
          font: '',
          textAlign: '',
          textBaseline: '',
          shadowColor: '',
          shadowBlur: 0,
          shadowOffsetX: 0,
          shadowOffsetY: 0,
          fillStyle: '',
          globalAlpha: 1,
          fillText: vi.fn(),
        },
      };

      dialogue.spawnText('TEST', 100, 100);
      dialogue.update(3); // Past lifetime
      dialogue.render(mockRenderer as any);

      expect(mockRenderer.context.fillText).not.toHaveBeenCalled();
    });

    it('should use correct colors for text types', async () => {
      const { DialogueSystem } = await import('./dialogue');
      const dialogue = new DialogueSystem();
      
      const fillStyles: string[] = [];
      const mockRenderer = {
        context: {
          save: vi.fn(),
          restore: vi.fn(),
          font: '',
          textAlign: '',
          textBaseline: '',
          shadowColor: '',
          shadowBlur: 0,
          shadowOffsetX: 0,
          shadowOffsetY: 0,
          get fillStyle() { return ''; },
          set fillStyle(v: string) { fillStyles.push(v); },
          globalAlpha: 1,
          fillText: vi.fn(),
        },
      };

      dialogue.spawnText('Spawn', 100, 100, 'spawn', '#00ff00');
      dialogue.spawnText('Death', 100, 150, 'death', '#ff0000');
      dialogue.update(0.1);
      dialogue.render(mockRenderer as any);

      expect(fillStyles).toContain('#66ff66');
      expect(fillStyles).toContain('#ff6666');
    });
  });
});
