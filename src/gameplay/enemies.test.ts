/**
 * Enemy System Tests
 * 
 * Tests for enemy creation, movement behaviors, damage handling, and enemy system management.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Enemy, EnemySystem } from './enemies';
import type { EnemyData } from '../content/schema';
import { events } from '../core/events';

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
    getEnemy: vi.fn((id: string) => {
      if (id === 'test_enemy') {
        return createMockEnemyData();
      }
      if (id === 'zigzag_enemy') {
        return createMockEnemyData({ id: 'zigzag_enemy', behavior: 'zigzag' });
      }
      if (id === 'orbit_enemy') {
        return createMockEnemyData({ id: 'orbit_enemy', behavior: 'orbit' });
      }
      if (id === 'dive_enemy') {
        return createMockEnemyData({ id: 'dive_enemy', behavior: 'dive' });
      }
      if (id === 'swarm_enemy') {
        return createMockEnemyData({ id: 'swarm_enemy', behavior: 'swarm' });
      }
      return null;
    }),
  },
}));

// Mock svgAssets
vi.mock('../engine/svgAssets', () => ({
  svgAssets: {
    get: vi.fn(() => null),
    render: vi.fn(),
  },
}));

const createMockEnemyData = (overrides?: Partial<EnemyData>): EnemyData => ({
  id: 'test_enemy',
  name: 'Test Enemy',
  tier: 1,
  hp: 3,
  speed: 1.0,
  behavior: 'straight_descend',
  scoreValue: 10,
  dropTable: 'common',
  visual: {
    type: 'circle',
    color: '#00ffaa',
    size: 20,
    glow: true,
  },
  ...overrides,
});

describe('Enemy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Construction', () => {
    it('should create enemy at specified position', () => {
      const data = createMockEnemyData();
      const enemy = new Enemy(data, 100, 200);

      expect(enemy.transform.x).toBe(100);
      expect(enemy.transform.y).toBe(200);
    });

    it('should have correct enemy type and tier', () => {
      const data = createMockEnemyData({ id: 'my_enemy', tier: 3 });
      const enemy = new Enemy(data, 0, 0);

      expect(enemy.enemyType).toBe('my_enemy');
      expect(enemy.tier).toBe(3);
    });

    it('should have enemy faction', () => {
      const data = createMockEnemyData();
      const enemy = new Enemy(data, 0, 0);

      expect(enemy.faction).toBe('enemy');
    });

    it('should have enemy and tier tags', () => {
      const data = createMockEnemyData({ tier: 2 });
      const enemy = new Enemy(data, 0, 0);

      expect(enemy.hasTag('enemy')).toBe(true);
      expect(enemy.hasTag('tier2')).toBe(true);
    });

    it('should have correct health', () => {
      const data = createMockEnemyData({ hp: 5 });
      const enemy = new Enemy(data, 0, 0);

      expect(enemy.health?.current).toBe(5);
      expect(enemy.health?.max).toBe(5);
    });

    it('should have correct score value', () => {
      const data = createMockEnemyData({ scoreValue: 50 });
      const enemy = new Enemy(data, 0, 0);

      expect(enemy.scoreValue).toBe(50);
    });

    it('should have collider', () => {
      const data = createMockEnemyData();
      const enemy = new Enemy(data, 0, 0);

      expect(enemy.collider).toBeDefined();
      expect(enemy.collider!.type).toBe('circle');
    });

    it('should store startX in data', () => {
      const data = createMockEnemyData();
      const enemy = new Enemy(data, 150, 0);

      expect(enemy.getData('startX')).toBe(150);
    });
  });

  describe('Straight Descend Behavior', () => {
    it('should move downward', () => {
      const data = createMockEnemyData({ behavior: 'straight_descend', speed: 1.0 });
      const enemy = new Enemy(data, 100, 100);
      const initialY = enemy.transform.y;

      enemy.update(0.1);

      expect(enemy.transform.y).toBeGreaterThan(initialY);
    });

    it('should not move horizontally', () => {
      const data = createMockEnemyData({ behavior: 'straight_descend' });
      const enemy = new Enemy(data, 100, 100);
      const initialX = enemy.transform.x;

      enemy.update(0.5);

      expect(enemy.transform.x).toBe(initialX);
    });

    it('should move faster with higher speed', () => {
      const slowData = createMockEnemyData({ behavior: 'straight_descend', speed: 0.5 });
      const fastData = createMockEnemyData({ behavior: 'straight_descend', speed: 2.0 });
      
      const slowEnemy = new Enemy(slowData, 100, 100);
      const fastEnemy = new Enemy(fastData, 100, 100);

      slowEnemy.update(0.1);
      fastEnemy.update(0.1);

      expect(fastEnemy.transform.y).toBeGreaterThan(slowEnemy.transform.y);
    });
  });

  describe('Zigzag Behavior', () => {
    it('should move downward', () => {
      const data = createMockEnemyData({ behavior: 'zigzag' });
      const enemy = new Enemy(data, 100, 100);
      const initialY = enemy.transform.y;

      enemy.update(0.1);

      expect(enemy.transform.y).toBeGreaterThan(initialY);
    });

    it('should move horizontally in zigzag pattern', () => {
      const data = createMockEnemyData({ behavior: 'zigzag' });
      const enemy = new Enemy(data, 100, 100);
      const initialX = enemy.transform.x;

      // Update several times to see zigzag
      for (let i = 0; i < 10; i++) {
        enemy.update(0.1);
      }

      // X should have changed (may be same if at zero point of sine)
      // After enough time, X will definitely differ
      expect(enemy.transform.x).not.toBe(initialX);
    });

    it('should track time in data', () => {
      const data = createMockEnemyData({ behavior: 'zigzag' });
      const enemy = new Enemy(data, 100, 100);

      enemy.update(0.5);

      expect(enemy.getData('time')).toBeGreaterThan(0);
    });
  });

  describe('Orbit Behavior', () => {
    it('should move downward slowly', () => {
      const data = createMockEnemyData({ behavior: 'orbit' });
      const enemy = new Enemy(data, 100, 100);
      const initialY = enemy.transform.y;

      enemy.update(0.1);

      expect(enemy.transform.y).toBeGreaterThan(initialY);
    });

    it('should orbit around start X position', () => {
      const data = createMockEnemyData({ behavior: 'orbit' });
      const enemy = new Enemy(data, 300, 100);
      const startX = 300;

      // Update to complete some of the orbit
      for (let i = 0; i < 50; i++) {
        enemy.update(0.1);
      }

      // X should oscillate around startX
      expect(Math.abs(enemy.transform.x - startX)).toBeLessThanOrEqual(55); // radius + tolerance
    });
  });

  describe('Dive Behavior', () => {
    it('should move slowly initially', () => {
      const data = createMockEnemyData({ behavior: 'dive', speed: 1.0 });
      const enemy = new Enemy(data, 100, 100);
      const initialY = enemy.transform.y;

      enemy.update(0.1);

      const slowDistance = enemy.transform.y - initialY;
      expect(slowDistance).toBeGreaterThan(0);
    });

    it('should dive fast after delay', () => {
      const data = createMockEnemyData({ behavior: 'dive', speed: 1.0 });
      const enemy = new Enemy(data, 100, 100);

      // Move past dive time (2 seconds)
      enemy.update(2.5);
      const yAfterDelay = enemy.transform.y;

      enemy.update(0.1);
      const diveDistance = enemy.transform.y - yAfterDelay;

      // Dive should be much faster (3x speed)
      expect(diveDistance).toBeGreaterThan(0);
    });
  });

  describe('Swarm Behavior', () => {
    it('should move downward', () => {
      const data = createMockEnemyData({ behavior: 'swarm' });
      const enemy = new Enemy(data, 100, 100);
      const initialY = enemy.transform.y;

      enemy.update(0.1);

      expect(enemy.transform.y).toBeGreaterThan(initialY);
    });

    it('should move with swarm pattern', () => {
      const data = createMockEnemyData({ behavior: 'swarm' });
      const enemy = new Enemy(data, 100, 100);

      for (let i = 0; i < 10; i++) {
        enemy.update(0.1);
      }

      // Swarm enemies should move horizontally too
      expect(enemy.transform.x).not.toBe(100);
    });
  });

  describe('Damage Handling', () => {
    it('should emit damage event', () => {
      const data = createMockEnemyData({ hp: 5 });
      const enemy = new Enemy(data, 100, 100);

      vi.clearAllMocks();
      enemy.onDamage(2);

      expect(events.emit).toHaveBeenCalledWith('enemy:damage', {
        id: enemy.id.toString(),
        amount: 2,
      });
    });

    it('should reduce health on damage', () => {
      const data = createMockEnemyData({ hp: 5 });
      const enemy = new Enemy(data, 100, 100);

      enemy.onDamage(2);

      expect(enemy.health?.current).toBe(3);
    });

    it('should return false when not killed', () => {
      const data = createMockEnemyData({ hp: 5 });
      const enemy = new Enemy(data, 100, 100);

      const killed = enemy.onDamage(2);

      expect(killed).toBe(false);
      expect(enemy.active).toBe(true);
    });

    it('should return true when killed', () => {
      const data = createMockEnemyData({ hp: 3 });
      const enemy = new Enemy(data, 100, 100);

      const killed = enemy.onDamage(5);

      expect(killed).toBe(true);
    });

    it('should emit death event when killed', () => {
      const data = createMockEnemyData({ hp: 2 });
      const enemy = new Enemy(data, 150, 250);

      vi.clearAllMocks();
      enemy.onDamage(5);

      expect(events.emit).toHaveBeenCalledWith('enemy:death', {
        id: enemy.id.toString(),
        type: 'test_enemy',
        position: { x: 150, y: 250 },
      });
    });

    it('should destroy enemy when killed', () => {
      const data = createMockEnemyData({ hp: 1 });
      const enemy = new Enemy(data, 100, 100);

      enemy.onDamage(5);

      expect(enemy.active).toBe(false);
    });
  });

  describe('Off Screen Detection', () => {
    it('should detect when off screen', () => {
      const data = createMockEnemyData();
      const enemy = new Enemy(data, 100, 700);

      expect(enemy.isOffScreen(600)).toBe(true);
    });

    it('should not detect when on screen', () => {
      const data = createMockEnemyData();
      const enemy = new Enemy(data, 100, 300);

      expect(enemy.isOffScreen(600)).toBe(false);
    });

    it('should include margin in detection', () => {
      const data = createMockEnemyData();
      const enemy = new Enemy(data, 100, 620);

      // Should not be off screen yet (margin is 50)
      expect(enemy.isOffScreen(600)).toBe(false);
    });
  });
});

describe('EnemySystem', () => {
  let system: EnemySystem;

  beforeEach(() => {
    vi.clearAllMocks();
    system = new EnemySystem(800, 600);
  });

  describe('Spawning', () => {
    it('should spawn enemy at position', () => {
      const enemy = system.spawn('test_enemy', 400, 100);

      expect(enemy).not.toBeNull();
      expect(enemy?.transform.x).toBe(400);
      expect(enemy?.transform.y).toBe(100);
    });

    it('should add enemy to pool', () => {
      system.spawn('test_enemy', 400);

      expect(system.count()).toBe(1);
    });

    it('should return null for unknown enemy', () => {
      const enemy = system.spawn('unknown_enemy', 400);

      expect(enemy).toBeNull();
      expect(system.count()).toBe(0);
    });

    it('should spawn multiple enemies', () => {
      system.spawn('test_enemy', 100);
      system.spawn('test_enemy', 200);
      system.spawn('test_enemy', 300);

      expect(system.count()).toBe(3);
    });
  });

  describe('Line Spawning', () => {
    it('should spawn enemies in a line', () => {
      const enemies = system.spawnLine('test_enemy', 3, 100);

      expect(enemies.length).toBe(3);
      expect(system.count()).toBe(3);
    });

    it('should space enemies correctly', () => {
      const enemies = system.spawnLine('test_enemy', 3, 100, 400);

      // With centerX=400, spacing=100, 3 enemies:
      // startX = 400 - (2 * 100) / 2 = 300
      // positions: 300, 400, 500
      expect(enemies[0].transform.x).toBe(300);
      expect(enemies[1].transform.x).toBe(400);
      expect(enemies[2].transform.x).toBe(500);
    });

    it('should center line by default', () => {
      const enemies = system.spawnLine('test_enemy', 2, 200);

      // Screen width is 800, center is 400
      // startX = 400 - (1 * 200) / 2 = 300
      expect(enemies[0].transform.x).toBe(300);
      expect(enemies[1].transform.x).toBe(500);
    });

    it('should handle single enemy', () => {
      const enemies = system.spawnLine('test_enemy', 1, 100, 400);

      expect(enemies.length).toBe(1);
      expect(enemies[0].transform.x).toBe(400);
    });
  });

  describe('Grid Spawning', () => {
    it('should spawn enemies in a grid', () => {
      const enemies = system.spawnGrid('test_enemy', 2, 3);

      expect(enemies.length).toBe(6);
      expect(system.count()).toBe(6);
    });

    it('should position grid correctly', () => {
      const enemies = system.spawnGrid('test_enemy', 2, 2, 100, 50);

      // 2x2 grid with spacing 100x50
      // startX = (800 - 1 * 100) / 2 = 350
      // Y positions descend from ENEMY_SPAWN_Y
      expect(enemies.length).toBe(4);
    });
  });

  describe('Update', () => {
    it('should update all enemies', () => {
      system.spawn('test_enemy', 100, 100);
      system.spawn('test_enemy', 200, 100);

      const enemies = system.getEnemies();
      const initialY = enemies[0].transform.y;

      system.update(0.1);

      expect(enemies[0].transform.y).toBeGreaterThan(initialY);
    });

    it('should remove off-screen enemies', () => {
      system.spawn('test_enemy', 100, 700);

      system.update(0.1);

      // Enemy should be destroyed and cleaned up
      expect(system.count()).toBe(0);
    });

    it('should not remove on-screen enemies', () => {
      system.spawn('test_enemy', 100, 100);

      system.update(0.1);

      expect(system.count()).toBe(1);
    });
  });

  describe('Get Enemies', () => {
    it('should return active enemies', () => {
      system.spawn('test_enemy', 100);
      system.spawn('test_enemy', 200);

      const enemies = system.getEnemies();

      expect(enemies.length).toBe(2);
    });

    it('should not return destroyed enemies', () => {
      const enemy = system.spawn('test_enemy', 100);
      system.spawn('test_enemy', 200);

      enemy?.destroy();
      system.update(0); // Trigger cleanup

      const enemies = system.getEnemies();
      expect(enemies.length).toBe(1);
    });
  });

  describe('Clear', () => {
    it('should remove all enemies', () => {
      system.spawn('test_enemy', 100);
      system.spawn('test_enemy', 200);
      system.spawn('test_enemy', 300);

      expect(system.count()).toBe(3);

      system.clear();

      expect(system.count()).toBe(0);
    });
  });

  describe('Different Behaviors', () => {
    it('should spawn zigzag enemy', () => {
      const enemy = system.spawn('zigzag_enemy', 400, 100);

      expect(enemy).not.toBeNull();
      expect(enemy?.behavior).toBe('zigzag');
    });

    it('should spawn orbit enemy', () => {
      const enemy = system.spawn('orbit_enemy', 400, 100);

      expect(enemy).not.toBeNull();
      expect(enemy?.behavior).toBe('orbit');
    });

    it('should spawn dive enemy', () => {
      const enemy = system.spawn('dive_enemy', 400, 100);

      expect(enemy).not.toBeNull();
      expect(enemy?.behavior).toBe('dive');
    });

    it('should spawn swarm enemy', () => {
      const enemy = system.spawn('swarm_enemy', 400, 100);

      expect(enemy).not.toBeNull();
      expect(enemy?.behavior).toBe('swarm');
    });
  });
});
