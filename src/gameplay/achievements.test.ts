/**
 * AchievementSystem tests
 *
 * Uses dynamic imports and vi.doMock to avoid singleton / module init ordering issues.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('AchievementSystem', () => {
  let eventListeners: Map<string, Function[]>;

  beforeEach(() => {
    vi.resetModules();
    eventListeners = new Map();

    vi.doMock('../core/events', () => ({
      events: {
        emit: vi.fn((event: string, data?: unknown) => {
          const cbs = eventListeners.get(event) || [];
          for (const cb of cbs) cb(data);
        }),
        on: vi.fn((event: string, cb: Function) => {
          if (!eventListeners.has(event)) eventListeners.set(event, []);
          eventListeners.get(event)!.push(cb);
          return () => {};
        }),
        off: vi.fn(),
      },
    }));

    vi.doMock('../core/storage', () => ({
      storage: {
        stats: {
          totalBananasThrown: 0,
          totalEnemiesDefeated: 0,
          totalBossesDefeated: 0,
          runsCompleted: 0,
        },
        incrementStat: vi.fn(),
        isAchievementUnlocked: vi.fn(() => false),
        unlockAchievement: vi.fn(() => true),
        getHighScore: vi.fn(() => 0),
        highestSector: 0,
        unlockCosmetic: vi.fn(),
        unlockCodex: vi.fn(),
      },
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  const triggerEvent = (name: string, data?: unknown) => {
    for (const cb of eventListeners.get(name) || []) cb(data);
  };

  async function importFresh() {
    const { events } = await import('../core/events');
    const { storage } = await import('../core/storage');
    const { achievements, AchievementSystem } = await import('./achievements');
    return { events, storage, achievements, AchievementSystem };
  }

  describe('Construction', () => {
    it('creates an instance and registers expected event listeners', async () => {
      await importFresh();

      const expected = [
        'combo:increase',
        'score:add',
        'player:damage',
        'game:over',
        'boss:defeated',
        'enemy:death',
        'weapon:fire',
        'sector:complete',
      ];

      for (const name of expected) {
        expect(eventListeners.has(name)).toBe(true);
      }
    });

    it('exposes AchievementSystem constructor', async () => {
      const { AchievementSystem } = await importFresh();
      const extra = new AchievementSystem();
      expect(extra).toBeDefined();
    });
  });

  describe('update()', () => {
    it('increments survival and damage timers; unlocks calm_under_fire after 30s without damage', async () => {
      const { achievements, storage } = await importFresh();

      achievements.update(31);

      expect(vi.mocked(storage.unlockAchievement)).toHaveBeenCalledWith('calm_under_fire');
    });

    it('does not unlock calm_under_fire if player took damage within the window', async () => {
      const { achievements, storage } = await importFresh();

      achievements.update(20);
      triggerEvent('player:damage', undefined);
      achievements.update(20);

      expect(vi.mocked(storage.unlockAchievement)).not.toHaveBeenCalledWith('calm_under_fire');
    });
  });

  describe('Event handling', () => {
    it('combo:increase updates max combo and checks achievements', async () => {
      const { storage } = await importFresh();

      triggerEvent('combo:increase', { count: 50 });

      expect(vi.mocked(storage.unlockAchievement)).toHaveBeenCalledWith('combo_master');
    });

    it('score:add runs achievement checks (score conditions use storage high scores)', async () => {
      const { storage } = await importFresh();

      vi.mocked(storage.getHighScore).mockReturnValue(10_000);

      triggerEvent('score:add', { amount: 1 });

      expect(vi.mocked(storage.unlockAchievement)).toHaveBeenCalledWith('highscore_10k');
    });

    it('player:damage resets calm-under-fire timer and marks sector damage', async () => {
      const { achievements, storage } = await importFresh();

      achievements.update(31);
      vi.mocked(storage.unlockAchievement).mockClear();

      triggerEvent('player:damage', undefined);
      achievements.update(20);

      expect(vi.mocked(storage.unlockAchievement)).not.toHaveBeenCalledWith('calm_under_fire');
    });
  });

  describe('Boss defeat tracking', () => {
    it('boss:defeated records the boss, increments totalBossesDefeated, and unlocks mapped achievement', async () => {
      const { storage } = await importFresh();

      triggerEvent('boss:defeated', { bossId: 'cortex_auditor' });

      expect(vi.mocked(storage.incrementStat)).toHaveBeenCalledWith('totalBossesDefeated');
      expect(vi.mocked(storage.unlockAchievement)).toHaveBeenCalledWith('mk_ultra_survivor');
    });
  });

  describe('getAllProgress()', () => {
    it('returns one entry per achievement with id, unlocked, progress, and target', async () => {
      const { achievements } = await importFresh();

      const progress = achievements.getAllProgress();

      expect(progress).toHaveLength(19);
      for (const row of progress) {
        expect(row).toMatchObject({
          id: expect.any(String),
          unlocked: expect.any(Boolean),
          progress: expect.any(Number),
          target: expect.any(Number),
        });
      }

      const banana = progress.find((p) => p.id === 'banana_republic');
      expect(banana).toEqual({
        id: 'banana_republic',
        unlocked: false,
        progress: 0,
        target: 1000,
      });
    });
  });

  describe('resetSession()', () => {
    it('clears session combo tracking and defeated bosses', async () => {
      const { achievements, storage } = await importFresh();

      triggerEvent('combo:increase', { count: 40 });
      triggerEvent('boss:defeated', { bossId: 'mirror_self' });

      expect(achievements.getAllProgress().find((p) => p.id === 'combo_master')?.progress).toBe(40);

      achievements.resetSession();

      expect(achievements.getAllProgress().find((p) => p.id === 'combo_master')?.progress).toBe(0);

      vi.mocked(storage.isAchievementUnlocked).mockReturnValue(false);
      vi.mocked(storage.unlockAchievement).mockClear();
      triggerEvent('game:over', undefined);

      expect(vi.mocked(storage.unlockAchievement)).not.toHaveBeenCalledWith('know_thyself');
    });
  });

  describe('tryUnlock()', () => {
    it('attempts to unlock a known achievement by id', async () => {
      const { achievements, storage } = await importFresh();

      const ok = achievements.tryUnlock('survivor');

      expect(ok).toBe(true);
      expect(vi.mocked(storage.unlockAchievement)).toHaveBeenCalledWith('survivor');
    });

    it('returns false when the achievement is already unlocked', async () => {
      const { achievements, storage } = await importFresh();

      vi.mocked(storage.isAchievementUnlocked).mockReturnValue(true);

      expect(achievements.tryUnlock('survivor')).toBe(false);
      expect(vi.mocked(storage.unlockAchievement)).not.toHaveBeenCalled();
    });

    it('returns false for an unknown id', async () => {
      const { achievements, storage } = await importFresh();

      expect(achievements.tryUnlock('not_a_real_achievement')).toBe(false);
      expect(vi.mocked(storage.unlockAchievement)).not.toHaveBeenCalled();
    });
  });
});
