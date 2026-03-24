/**
 * Events System Tests
 *
 * The event emitter is the backbone of game communication.
 * These tests ensure reliable pub/sub behavior for all game systems.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type EventCallback, events, type GameEvents } from './events';

describe('EventEmitter', () => {
  beforeEach(() => {
    // Clear all listeners between tests
    events.removeAllListeners();
  });

  describe('on() - Subscribe to events', () => {
    it('should call callback when event is emitted', () => {
      const callback = vi.fn();
      events.on('game:start', callback);

      events.emit('game:start', { mode: 'campaign' });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith({ mode: 'campaign' });
    });

    it('should pass correct data to callback', () => {
      const callback = vi.fn();
      events.on('player:damage', callback);

      events.emit('player:damage', { amount: 10, remaining: 90 });

      expect(callback).toHaveBeenCalledWith({ amount: 10, remaining: 90 });
    });

    it('should support multiple listeners on same event', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      events.on('game:start', callback1);
      events.on('game:start', callback2);

      events.emit('game:start', { mode: 'endless' });

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it('should call listener for each emit', () => {
      const callback = vi.fn();
      events.on('score:add', callback);

      events.emit('score:add', { amount: 10, reason: 'kill' });
      events.emit('score:add', { amount: 20, reason: 'combo' });
      events.emit('score:add', { amount: 5, reason: 'pickup' });

      expect(callback).toHaveBeenCalledTimes(3);
    });

    it('should return unsubscribe function', () => {
      const callback = vi.fn();
      const unsubscribe = events.on('game:pause', callback);

      events.emit('game:pause', undefined);
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();
      events.emit('game:pause', undefined);
      expect(callback).toHaveBeenCalledTimes(1); // Still 1, not called again
    });
  });

  describe('once() - One-time subscription', () => {
    it('should call callback only once', () => {
      const callback = vi.fn();
      events.once('boss:defeat', callback);

      events.emit('boss:defeat', { id: 'boss1' });
      events.emit('boss:defeat', { id: 'boss2' });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith({ id: 'boss1' });
    });

    it('should remove listener after first call', () => {
      const callback = vi.fn();
      events.once('achievement:unlock', callback);

      expect(events.listenerCount('achievement:unlock')).toBe(1);

      events.emit('achievement:unlock', { id: 'first_kill', name: 'First Blood' });

      expect(events.listenerCount('achievement:unlock')).toBe(0);
    });
  });

  describe('off() - Unsubscribe from events', () => {
    it('should remove specific listener', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      events.on('enemy:death', callback1);
      events.on('enemy:death', callback2);

      events.off('enemy:death', callback1);
      events.emit('enemy:death', { id: 'e1', type: 'basic', position: { x: 0, y: 0 } });

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it('should not throw when removing non-existent listener', () => {
      const callback = vi.fn();

      expect(() => {
        events.off('game:start', callback);
      }).not.toThrow();
    });

    it('should remove once listener via off()', () => {
      const callback = vi.fn();
      events.once('wave:complete', callback);

      events.off('wave:complete', callback);
      events.emit('wave:complete', { waveId: 'w1' });

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('emit() - Emit events', () => {
    it('should not throw when emitting with no listeners', () => {
      expect(() => {
        events.emit('game:over', { score: 100, sector: 's1', cause: 'death' });
      }).not.toThrow();
    });

    it('should handle void event data', () => {
      const callback = vi.fn();
      events.on('game:pause', callback);

      events.emit('game:pause', undefined);

      expect(callback).toHaveBeenCalledWith(undefined);
    });

    it('should catch and log errors in callbacks', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const badCallback = vi.fn(() => {
        throw new Error('Test error');
      });
      const goodCallback = vi.fn();

      events.on('score:add', badCallback);
      events.on('score:add', goodCallback);

      events.emit('score:add', { amount: 10, reason: 'test' });

      // Error should be logged but not thrown
      expect(consoleError).toHaveBeenCalled();
      // Good callback should still be called
      expect(goodCallback).toHaveBeenCalled();

      consoleError.mockRestore();
    });

    it('should handle complex event data', () => {
      const callback = vi.fn();
      events.on('enemy:death', callback);

      const data = {
        id: 'enemy_123',
        type: 'aberration',
        position: { x: 250, y: 400 },
      };

      events.emit('enemy:death', data);

      expect(callback).toHaveBeenCalledWith(data);
    });
  });

  describe('removeAllListeners() - Bulk cleanup', () => {
    it('should remove all listeners for specific event', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      events.on('game:start', callback1);
      events.on('game:start', callback2);

      events.removeAllListeners('game:start');
      events.emit('game:start', { mode: 'campaign' });

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
    });

    it('should remove all listeners when no event specified', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      events.on('game:start', callback1);
      events.on('player:death', callback2);

      events.removeAllListeners();

      events.emit('game:start', { mode: 'campaign' });
      events.emit('player:death', undefined);

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
    });

    it('should remove both on and once listeners', () => {
      const onCallback = vi.fn();
      const onceCallback = vi.fn();

      events.on('combo:increase', onCallback);
      events.once('combo:increase', onceCallback);

      expect(events.listenerCount('combo:increase')).toBe(2);

      events.removeAllListeners('combo:increase');

      expect(events.listenerCount('combo:increase')).toBe(0);
    });
  });

  describe('listenerCount() - Listener inspection', () => {
    it('should return 0 for events with no listeners', () => {
      expect(events.listenerCount('game:start')).toBe(0);
    });

    it('should count regular listeners', () => {
      events.on('score:add', () => {});
      events.on('score:add', () => {});

      expect(events.listenerCount('score:add')).toBe(2);
    });

    it('should count once listeners', () => {
      events.once('boss:defeat', () => {});

      expect(events.listenerCount('boss:defeat')).toBe(1);
    });

    it('should count both regular and once listeners', () => {
      events.on('powerup:collect', () => {});
      events.once('powerup:collect', () => {});

      expect(events.listenerCount('powerup:collect')).toBe(2);
    });

    it('should update count after unsubscribe', () => {
      const callback = vi.fn();
      events.on('wave:start', callback);

      expect(events.listenerCount('wave:start')).toBe(1);

      events.off('wave:start', callback);

      expect(events.listenerCount('wave:start')).toBe(0);
    });
  });

  describe('Type Safety', () => {
    it('should enforce correct event types', () => {
      // This test verifies type safety at compile time
      // At runtime, we just verify the data flows correctly

      const gameStartCallback: EventCallback<GameEvents['game:start']> = (data) => {
        expect(data.mode).toMatch(/^(campaign|endless)$/);
      };

      const playerDamageCallback: EventCallback<GameEvents['player:damage']> = (data) => {
        expect(typeof data.amount).toBe('number');
        expect(typeof data.remaining).toBe('number');
      };

      events.on('game:start', gameStartCallback);
      events.on('player:damage', playerDamageCallback);

      events.emit('game:start', { mode: 'campaign' });
      events.emit('player:damage', { amount: 5, remaining: 95 });
    });
  });

  describe('BCI-Related Events', () => {
    it('should handle state:calm events', () => {
      const callback = vi.fn();
      events.on('state:calm', callback);

      events.emit('state:calm', { level: 0.8 });

      expect(callback).toHaveBeenCalledWith({ level: 0.8 });
    });

    it('should handle state:arousal events', () => {
      const callback = vi.fn();
      events.on('state:arousal', callback);

      events.emit('state:arousal', { level: 0.3 });

      expect(callback).toHaveBeenCalledWith({ level: 0.3 });
    });

    it('should support rapid state updates', () => {
      const callback = vi.fn();
      events.on('state:calm', callback);

      // Simulate rapid BCI updates
      for (let i = 0; i < 60; i++) {
        events.emit('state:calm', { level: Math.sin(i * 0.1) * 0.5 + 0.5 });
      }

      expect(callback).toHaveBeenCalledTimes(60);
    });
  });

  describe('Game Flow Events', () => {
    it('should support complete game flow sequence', () => {
      const eventLog: string[] = [];

      events.on('game:start', () => eventLog.push('start'));
      events.on('wave:start', () => eventLog.push('wave'));
      events.on('enemy:spawn', () => eventLog.push('spawn'));
      events.on('enemy:death', () => eventLog.push('death'));
      events.on('wave:complete', () => eventLog.push('wave_done'));
      events.on('level:complete', () => eventLog.push('level_done'));
      events.on('game:over', () => eventLog.push('over'));

      // Simulate game flow
      events.emit('game:start', { mode: 'campaign' });
      events.emit('wave:start', { waveId: 'w1', number: 1 });
      events.emit('enemy:spawn', { type: 'basic', x: 100, y: 0 });
      events.emit('enemy:death', { id: 'e1', type: 'basic', position: { x: 0, y: 0 } });
      events.emit('wave:complete', { waveId: 'w1' });
      events.emit('level:complete', { levelId: 'l1', score: 1000 });
      events.emit('game:over', { score: 1000, sector: 's1', cause: 'victory' });

      expect(eventLog).toEqual(['start', 'wave', 'spawn', 'death', 'wave_done', 'level_done', 'over']);
    });
  });
});
