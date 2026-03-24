/**
 * Boss System Tests
 *
 * Tests for boss creation, movement patterns, attack execution, and projectile behavior.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BossData } from '../content/schema';
import { events } from '../core/events';
import { Boss, BossFactory } from './bosses';

// Mock events
vi.mock('../core/events', () => ({
  events: {
    emit: vi.fn(),
    on: vi.fn(() => () => {}),
    off: vi.fn(),
  },
}));

// Mock contentLoader
vi.mock('../content/loader', () => ({
  contentLoader: {
    getString: vi.fn((key: string) => key),
  },
}));

// Mock svgAssets
vi.mock('../engine/svgAssets', () => ({
  svgAssets: {
    render: vi.fn(),
    isLoaded: vi.fn(() => false),
  },
}));

const createMockBossData = (overrides?: Partial<BossData>): BossData => ({
  id: 'test_boss',
  name: 'Test Boss',
  title: 'The Tester',
  hp: 100,
  phases: [
    {
      hpThreshold: 1,
      pattern: 'sweep',
      speedMod: 1,
      attacks: [
        {
          type: 'straight_shot',
          cooldown: 1000,
          damage: 1,
          params: {},
        },
      ],
    },
    {
      hpThreshold: 0.5,
      pattern: 'chase',
      speedMod: 1.2,
      attacks: [
        {
          type: 'spread_shot',
          cooldown: 800,
          damage: 1,
          params: { count: 3 },
        },
      ],
    },
  ],
  visual: {
    type: 'custom',
    color: '#ff0000',
    size: 50,
    glow: true,
  },
  codexEntry: 'test_boss_entry',
  defeatUnlocks: [],
  ...overrides,
});

// Helper to complete boss entrance
const completeBossEntrance = (boss: Boss) => {
  // Entrance takes about 5 seconds (from -100 to 150 at 50px/s)
  for (let i = 0; i < 60; i++) {
    boss.update(0.1, 400, 500);
  }
  return boss;
};

describe('Boss', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Construction', () => {
    it('should create boss with correct initial position', () => {
      const data = createMockBossData();
      const boss = new Boss(data, 800, 600);

      // Boss starts at center X, above screen
      expect(boss.transform.x).toBe(400);
      expect(boss.transform.y).toBe(-100);
    });

    it('should have correct health', () => {
      const data = createMockBossData({ hp: 150 });
      const boss = new Boss(data, 800, 600);

      expect(boss.getHealthPercent()).toBe(1);
    });

    it('should have boss id and name', () => {
      const data = createMockBossData();
      const boss = new Boss(data, 800, 600);

      expect(boss.bossId).toBe('test_boss');
      expect(boss.name).toBe('Test Boss');
      expect(boss.title).toBe('The Tester');
    });

    it('should have enemy faction and boss tag', () => {
      const data = createMockBossData();
      const boss = new Boss(data, 800, 600);

      expect(boss.faction).toBe('enemy');
      expect(boss.hasTag('boss')).toBe(true);
    });

    it('should start not defeated', () => {
      const data = createMockBossData();
      const boss = new Boss(data, 800, 600);

      expect(boss.isDefeated()).toBe(false);
    });

    it('should have collider', () => {
      const data = createMockBossData();
      const boss = new Boss(data, 800, 600);

      expect(boss.collider).toBeDefined();
      expect(boss.collider!.type).toBe('circle');
    });
  });

  describe('Entrance Animation', () => {
    it('should start with entrance not complete', () => {
      const data = createMockBossData();
      const boss = new Boss(data, 800, 600);

      expect(boss.isEntranceComplete()).toBe(false);
    });

    it('should move down during entrance', () => {
      const data = createMockBossData();
      const boss = new Boss(data, 800, 600);
      const initialY = boss.transform.y;

      boss.update(0.1, 400, 500);

      expect(boss.transform.y).toBeGreaterThan(initialY);
    });

    it('should complete entrance when reaching target Y', () => {
      const data = createMockBossData();
      const boss = new Boss(data, 800, 600);

      completeBossEntrance(boss);

      expect(boss.isEntranceComplete()).toBe(true);
    });
  });

  describe('Movement Patterns', () => {
    it('should apply sweep pattern after entrance', () => {
      const data = createMockBossData({
        phases: [{ hpThreshold: 1, pattern: 'sweep', speedMod: 1, attacks: [] }],
      });
      const boss = new Boss(data, 800, 600);

      completeBossEntrance(boss);

      const initialX = boss.transform.x;

      // Update to trigger pattern movement
      boss.update(1, 400, 500);

      // Sweep pattern should move the boss
      expect(boss.transform.x).not.toBe(initialX);
    });

    it('should constrain position to screen bounds', () => {
      const data = createMockBossData({
        phases: [{ hpThreshold: 1, pattern: 'erratic', speedMod: 1, attacks: [] }],
      });
      const boss = new Boss(data, 800, 600);

      completeBossEntrance(boss);

      // Update many times
      for (let i = 0; i < 100; i++) {
        boss.update(0.1, 400, 500);
      }

      // Should stay within bounds (margin = 80)
      expect(boss.transform.x).toBeGreaterThanOrEqual(80);
      expect(boss.transform.x).toBeLessThanOrEqual(720);
    });
  });

  describe('Attack Execution', () => {
    it('should emit audio event when attacking', () => {
      const data = createMockBossData({
        phases: [
          {
            hpThreshold: 1,
            pattern: 'sweep',
            speedMod: 1,
            attacks: [{ type: 'straight_shot', cooldown: 100, damage: 1, params: {} }],
          },
        ],
      });
      const boss = new Boss(data, 800, 600);

      completeBossEntrance(boss);

      vi.clearAllMocks();

      // Update enough to trigger attack (cooldown is 100ms)
      boss.update(0.2, 400, 500);

      expect(events.emit).toHaveBeenCalledWith('audio:play_sfx', { id: 'boss_attack' });
    });

    it('should spawn projectiles after attack', () => {
      const data = createMockBossData({
        phases: [
          {
            hpThreshold: 1,
            pattern: 'sweep',
            speedMod: 1,
            attacks: [{ type: 'straight_shot', cooldown: 100, damage: 1, params: {} }],
          },
        ],
      });
      const boss = new Boss(data, 800, 600);

      completeBossEntrance(boss);

      // Trigger attack
      boss.update(0.2, 400, 500);

      const projectiles = boss.getProjectiles();
      expect(projectiles.length).toBeGreaterThan(0);
    });

    it('should spawn spread_shot projectiles', () => {
      const data = createMockBossData({
        phases: [
          {
            hpThreshold: 1,
            pattern: 'sweep',
            speedMod: 1,
            attacks: [{ type: 'spread_shot', cooldown: 100, damage: 1, params: { count: 5 } }],
          },
        ],
      });
      const boss = new Boss(data, 800, 600);

      completeBossEntrance(boss);
      boss.update(0.2, 400, 500);

      const projectiles = boss.getProjectiles();
      expect(projectiles.length).toBeGreaterThanOrEqual(5);
    });

    it('should spawn radial attack projectiles', () => {
      const data = createMockBossData({
        phases: [
          {
            hpThreshold: 1,
            pattern: 'sweep',
            speedMod: 1,
            attacks: [{ type: 'radial', cooldown: 100, damage: 1, params: { count: 8 } }],
          },
        ],
      });
      const boss = new Boss(data, 800, 600);

      completeBossEntrance(boss);
      boss.update(0.2, 400, 500);

      const projectiles = boss.getProjectiles();
      expect(projectiles.length).toBeGreaterThanOrEqual(8);
    });

    it('should spawn mirror_shot projectiles', () => {
      const data = createMockBossData({
        phases: [
          {
            hpThreshold: 1,
            pattern: 'sweep',
            speedMod: 1,
            attacks: [{ type: 'mirror_shot', cooldown: 100, damage: 1, params: {} }],
          },
        ],
      });
      const boss = new Boss(data, 800, 600);

      completeBossEntrance(boss);
      boss.update(0.2, 400, 500);

      const projectiles = boss.getProjectiles();
      expect(projectiles.length).toBeGreaterThanOrEqual(2);
    });

    it('should spawn split attack projectiles', () => {
      const data = createMockBossData({
        phases: [
          {
            hpThreshold: 1,
            pattern: 'sweep',
            speedMod: 1,
            attacks: [{ type: 'split', cooldown: 100, damage: 1, params: { count: 4 } }],
          },
        ],
      });
      const boss = new Boss(data, 800, 600);

      completeBossEntrance(boss);
      boss.update(0.2, 400, 500);

      const projectiles = boss.getProjectiles();
      expect(projectiles.length).toBeGreaterThanOrEqual(5); // 1 initial + 4 split
    });

    it('should spawn reality_warp projectiles', () => {
      const data = createMockBossData({
        phases: [
          {
            hpThreshold: 1,
            pattern: 'sweep',
            speedMod: 1,
            attacks: [{ type: 'reality_warp', cooldown: 100, damage: 1, params: {} }],
          },
        ],
      });
      const boss = new Boss(data, 800, 600);

      completeBossEntrance(boss);
      boss.update(0.2, 400, 500);

      const projectiles = boss.getProjectiles();
      expect(projectiles.length).toBeGreaterThanOrEqual(6); // 5 lanes + 1 homing
    });
  });

  describe('Projectile Behavior', () => {
    it('should update projectile positions over time', () => {
      const data = createMockBossData({
        phases: [
          {
            hpThreshold: 1,
            pattern: 'sweep',
            speedMod: 1,
            attacks: [{ type: 'straight_shot', cooldown: 100, damage: 1, params: {} }],
          },
        ],
      });
      const boss = new Boss(data, 800, 600);

      completeBossEntrance(boss);
      boss.update(0.2, 400, 500);

      const projectiles = boss.getProjectiles();
      expect(projectiles.length).toBeGreaterThan(0);

      const initialY = projectiles[0].y;

      // Wait for telegraph to finish and projectile to move
      boss.update(0.5, 400, 500);

      expect(projectiles[0].y).not.toBe(initialY);
    });

    it('should remove expired projectiles', () => {
      const data = createMockBossData({
        phases: [
          {
            hpThreshold: 1,
            pattern: 'sweep',
            speedMod: 1,
            attacks: [{ type: 'straight_shot', cooldown: 100000, damage: 1, params: {} }], // Very long cooldown
          },
        ],
      });
      const boss = new Boss(data, 800, 600);

      completeBossEntrance(boss);
      boss.update(100.1, 400, 500); // Trigger single attack

      expect(boss.getProjectiles().length).toBeGreaterThan(0);

      // Update until projectiles expire (life is about 3 seconds, need more time for cleanup)
      for (let i = 0; i < 10; i++) {
        boss.update(1, 400, 500);
      }

      expect(boss.getProjectiles().length).toBe(0);
    });
  });

  describe('Projectile Hit Detection', () => {
    it('should detect player collision with active projectile', () => {
      const data = createMockBossData({
        phases: [
          {
            hpThreshold: 1,
            pattern: 'sweep',
            speedMod: 1,
            attacks: [{ type: 'straight_shot', cooldown: 100, damage: 1, params: {} }],
          },
        ],
      });
      const boss = new Boss(data, 800, 600);

      completeBossEntrance(boss);
      boss.update(0.2, 400, 500);

      // Wait for telegraph to finish
      boss.update(0.5, 400, 500);

      const projectiles = boss.getProjectiles();
      if (projectiles.length > 0) {
        const proj = projectiles[0];

        // Check hit at projectile position
        const result = boss.checkProjectileHit(proj.x, proj.y, 10);
        expect(result.hit).toBe(true);
        expect(result.damage).toBeGreaterThan(0);
      }
    });

    it('should not detect hit when player is far away', () => {
      const data = createMockBossData({
        phases: [
          {
            hpThreshold: 1,
            pattern: 'sweep',
            speedMod: 1,
            attacks: [{ type: 'straight_shot', cooldown: 100, damage: 1, params: {} }],
          },
        ],
      });
      const boss = new Boss(data, 800, 600);

      completeBossEntrance(boss);
      boss.update(0.2, 400, 500);
      boss.update(0.5, 400, 500);

      // Check hit far from any projectile
      const result = boss.checkProjectileHit(0, 0, 10);
      expect(result.hit).toBe(false);
    });
  });

  describe('Phase Transitions', () => {
    it('should start at phase 1', () => {
      const data = createMockBossData();
      const boss = new Boss(data, 800, 600);

      expect(boss.getCurrentPhaseIndex()).toBe(1);
    });

    it('should transition to phase 2 when health drops below threshold', () => {
      const data = createMockBossData({
        phases: [
          { hpThreshold: 1, pattern: 'sweep', speedMod: 1, attacks: [] },
          { hpThreshold: 0.5, pattern: 'chase', speedMod: 1.2, attacks: [] },
        ],
      });
      const boss = new Boss(data, 800, 600);

      completeBossEntrance(boss);

      // Damage boss to below 50%
      boss.onDamage(55);

      // Boss has a 2-second phase transition animation
      // Update enough frames to complete the transition (~125 frames at 0.016s each)
      for (let i = 0; i < 150; i++) {
        boss.update(0.016, 400, 500);
      }

      expect(boss.getCurrentPhase()?.pattern).toBe('chase');
    });
  });

  describe('Damage Handling', () => {
    it('should reduce health on damage', () => {
      const data = createMockBossData({ hp: 100 });
      const boss = new Boss(data, 800, 600);

      boss.onDamage(20);

      expect(boss.getHealthPercent()).toBe(0.8);
    });

    it('should emit damage event', () => {
      const data = createMockBossData();
      const boss = new Boss(data, 800, 600);

      vi.clearAllMocks();
      boss.onDamage(10);

      expect(events.emit).toHaveBeenCalledWith('enemy:damage', { id: 'test_boss', amount: 10 });
    });

    it('should mark defeated when health depleted', () => {
      const data = createMockBossData({ hp: 50 });
      const boss = new Boss(data, 800, 600);

      boss.onDamage(50);

      expect(boss.isDefeated()).toBe(true);
    });

    it('should emit defeat event', () => {
      const data = createMockBossData({ hp: 30 });
      const boss = new Boss(data, 800, 600);

      vi.clearAllMocks();
      boss.onDamage(30);

      expect(events.emit).toHaveBeenCalledWith('boss:defeat', { id: 'test_boss' });
    });
  });

  describe('Hit Detection', () => {
    it('should detect hit within collider radius', () => {
      const data = createMockBossData();
      const boss = new Boss(data, 800, 600);

      completeBossEntrance(boss);

      const hit = boss.checkHit(boss.transform.x + 20, boss.transform.y, 10);
      expect(hit).toBe(true);
    });

    it('should not detect hit outside collider radius', () => {
      const data = createMockBossData();
      const boss = new Boss(data, 800, 600);

      completeBossEntrance(boss);

      const hit = boss.checkHit(0, 0, 10);
      expect(hit).toBe(false);
    });
  });
});

describe('BossFactory', () => {
  it('should create boss from data', () => {
    const data = createMockBossData();
    const boss = BossFactory.create(data, 800, 600);

    expect(boss).toBeInstanceOf(Boss);
    expect(boss.bossId).toBe('test_boss');
  });

  it('should pass screen dimensions', () => {
    const data = createMockBossData();
    const boss = BossFactory.create(data, 1024, 768);

    // Boss should spawn at center X
    expect(boss.transform.x).toBe(512);
  });
});
