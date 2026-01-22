/**
 * Spawner System Tests
 * 
 * Tests for wave generation, spawn timing, enemy selection, and pattern generation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Spawner } from './spawner';
import type { EnemySystem } from './enemies';
import type { WaveData, LevelData, SectorData } from '../content/schema';
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
const mockWaveData: Record<string, WaveData> = {};
const mockSectorData: Record<string, SectorData> = {};

vi.mock('../content/loader', () => ({
  contentLoader: {
    getWave: vi.fn((id: string) => mockWaveData[id] ?? null),
    getSector: vi.fn((id: string) => mockSectorData[id] ?? null),
  },
}));

// Mock enemy system
const createMockEnemySystem = (): EnemySystem => {
  const spawned: { id: string; x: number; y: number; active: boolean }[] = [];
  let nextId = 0;
  
  return {
    spawn: vi.fn((enemyId: string, x: number, y: number) => {
      const enemy = { 
        id: (nextId++).toString(), 
        enemyId,
        x, 
        y, 
        active: true,
        transform: { x, y },
        destroy: function() { this.active = false; },
      };
      spawned.push(enemy);
      return enemy;
    }),
    getEnemies: vi.fn(() => spawned.filter(e => e.active)),
    count: vi.fn(() => spawned.filter(e => e.active).length),
    clear: vi.fn(() => { spawned.length = 0; }),
    update: vi.fn(),
    render: vi.fn(),
    spawnLine: vi.fn(),
    spawnGrid: vi.fn(),
  } as unknown as EnemySystem;
};

describe('Spawner', () => {
  let spawner: Spawner;
  let enemySystem: EnemySystem;
  const screenWidth = 800;

  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockWaveData).forEach(key => delete mockWaveData[key]);
    Object.keys(mockSectorData).forEach(key => delete mockSectorData[key]);
    enemySystem = createMockEnemySystem();
    spawner = new Spawner(enemySystem, screenWidth);
  });

  describe('Construction', () => {
    it('should create spawner with enemy system', () => {
      expect(spawner).toBeDefined();
    });

    it('should start idle', () => {
      expect(spawner.isIdle()).toBe(true);
    });

    it('should have wave number 0 initially', () => {
      expect(spawner.getWaveNumber()).toBe(0);
    });
  });

  describe('Load Level', () => {
    it('should load level and start first wave', () => {
      const level: LevelData = {
        id: 'test_level',
        waves: ['wave1'],
      };

      mockWaveData['wave1'] = {
        id: 'wave1',
        enemy: 'synapse_drone',
        count: 3,
        pattern: 'line',
        entryDelayMs: 100,
      };

      spawner.loadLevel(level);

      expect(spawner.getWaveNumber()).toBe(1);
      expect(events.emit).toHaveBeenCalledWith('wave:start', { waveId: 'wave1', number: 1 });
    });

    it('should handle level with multiple waves', () => {
      const level: LevelData = {
        id: 'test_level',
        waves: ['wave1', 'wave2', 'wave3'],
      };

      mockWaveData['wave1'] = {
        id: 'wave1',
        enemy: 'synapse_drone',
        count: 3,
        pattern: 'line',
        entryDelayMs: 100,
      };

      spawner.loadLevel(level);

      // Should start with first wave
      expect(spawner.getWaveNumber()).toBe(1);
    });
  });

  describe('Load Sector', () => {
    it('should load sector and start first level', () => {
      const sector: SectorData = {
        id: 'sector1',
        name: 'Test Sector',
        description: 'A test sector',
        theme: {
          bg: 'neural_grid',
          palette: ['#fff'],
          pattern: 'grid',
        },
        lanes: 5,
        levels: [{
          id: 'level1',
          waves: ['wave1'],
        }],
        boss: 'test_boss',
        unlocks: {},
      };

      mockSectorData['sector1'] = sector;
      mockWaveData['wave1'] = {
        id: 'wave1',
        enemy: 'synapse_drone',
        count: 1,
        pattern: 'line',
        entryDelayMs: 100,
      };

      spawner.loadSector('sector1');

      expect(spawner.getWaveNumber()).toBe(1);
    });

    it('should handle unknown sector gracefully', () => {
      spawner.loadSector('unknown_sector');

      expect(spawner.isIdle()).toBe(true);
    });
  });

  describe('Wave State Creation', () => {
    it('should create wave state with spawn commands', () => {
      const level: LevelData = {
        id: 'test_level',
        waves: ['wave1'],
      };

      mockWaveData['wave1'] = {
        id: 'wave1',
        enemy: 'synapse_drone',
        count: 5,
        pattern: 'line',
        entryDelayMs: 200,
      };

      spawner.loadLevel(level);

      // Update should spawn enemies
      spawner.update(0.5); // 500ms

      expect(enemySystem.spawn).toHaveBeenCalled();
    });

    it('should create default wave for unknown wave ID', () => {
      const level: LevelData = {
        id: 'test_level',
        waves: ['unknown_wave'],
      };

      spawner.loadLevel(level);

      // Should create default wave with synapse_drones
      spawner.update(0.5);

      expect(enemySystem.spawn).toHaveBeenCalledWith('synapse_drone', expect.any(Number), expect.any(Number));
    });
  });

  describe('Spawn Timing', () => {
    it('should spawn enemies according to delay', () => {
      const level: LevelData = {
        id: 'test_level',
        waves: ['wave1'],
      };

      mockWaveData['wave1'] = {
        id: 'wave1',
        enemy: 'synapse_drone',
        count: 3,
        pattern: 'line',
        entryDelayMs: 1000, // 1 second between spawns
      };

      spawner.loadLevel(level);

      // First spawn should happen immediately
      spawner.update(0.01);
      expect(enemySystem.spawn).toHaveBeenCalledTimes(1);

      // Second spawn at 1 second - after 0.5s more, still at 510ms (not yet 1000ms)
      spawner.update(0.5);
      expect(enemySystem.spawn).toHaveBeenCalledTimes(1);

      // Now pass 1 second total - should spawn second enemy
      spawner.update(0.6);
      expect(enemySystem.spawn).toHaveBeenCalledTimes(2);
    });

    it('should spawn multiple enemies if time passes threshold', () => {
      const level: LevelData = {
        id: 'test_level',
        waves: ['wave1'],
      };

      mockWaveData['wave1'] = {
        id: 'wave1',
        enemy: 'synapse_drone',
        count: 5,
        pattern: 'line',
        entryDelayMs: 100, // 100ms between spawns
      };

      spawner.loadLevel(level);

      // Update with 500ms should spawn all 5
      spawner.update(0.5);

      expect(enemySystem.spawn).toHaveBeenCalledTimes(5);
    });
  });

  describe('Line Pattern', () => {
    it('should generate line pattern spawn commands', () => {
      const level: LevelData = {
        id: 'test_level',
        waves: ['wave1'],
      };

      mockWaveData['wave1'] = {
        id: 'wave1',
        enemy: 'synapse_drone',
        count: 4,
        pattern: 'line',
        entryDelayMs: 100,
      };

      spawner.loadLevel(level);
      spawner.update(0.5);

      // Should spawn 4 enemies in a line
      expect(enemySystem.spawn).toHaveBeenCalledTimes(4);
      
      // Check X positions are within bounds
      const calls = (enemySystem.spawn as ReturnType<typeof vi.fn>).mock.calls;
      calls.forEach(call => {
        const x = call[1];
        expect(x).toBeGreaterThanOrEqual(80);
        expect(x).toBeLessThanOrEqual(screenWidth - 80);
      });
    });
  });

  describe('Grid Pattern', () => {
    it('should generate grid pattern spawn commands', () => {
      const level: LevelData = {
        id: 'test_level',
        waves: ['wave1'],
      };

      mockWaveData['wave1'] = {
        id: 'wave1',
        enemy: 'synapse_drone',
        pattern: 'grid',
        rows: 2,
        cols: 3,
        entryDelayMs: 100,
      };

      spawner.loadLevel(level);
      spawner.update(1);

      // Should spawn 6 enemies (2 rows x 3 cols)
      expect(enemySystem.spawn).toHaveBeenCalledTimes(6);
    });
  });

  describe('V Formation Pattern', () => {
    it('should generate V formation pattern', () => {
      const level: LevelData = {
        id: 'test_level',
        waves: ['wave1'],
      };

      mockWaveData['wave1'] = {
        id: 'wave1',
        enemy: 'synapse_drone',
        count: 5,
        pattern: 'v_formation',
        entryDelayMs: 100,
      };

      spawner.loadLevel(level);
      spawner.update(1);

      expect(enemySystem.spawn).toHaveBeenCalledTimes(5);
    });
  });

  describe('Random Pattern', () => {
    it('should generate random pattern spawn commands', () => {
      const level: LevelData = {
        id: 'test_level',
        waves: ['wave1'],
      };

      mockWaveData['wave1'] = {
        id: 'wave1',
        enemy: 'synapse_drone',
        count: 8,
        pattern: 'random',
        entryDelayMs: 50,
      };

      spawner.loadLevel(level);
      spawner.update(1);

      expect(enemySystem.spawn).toHaveBeenCalledTimes(8);

      // X positions should all be within bounds
      const calls = (enemySystem.spawn as ReturnType<typeof vi.fn>).mock.calls;
      calls.forEach(call => {
        const x = call[1];
        expect(x).toBeGreaterThanOrEqual(80);
        expect(x).toBeLessThanOrEqual(screenWidth - 80);
      });
    });
  });

  describe('Mixed Pattern', () => {
    it('should generate mixed pattern spawn commands', () => {
      const level: LevelData = {
        id: 'test_level',
        waves: ['wave1'],
      };

      mockWaveData['wave1'] = {
        id: 'wave1',
        enemy: 'synapse_drone',
        count: 10,
        pattern: 'mixed',
        entryDelayMs: 50,
      };

      spawner.loadLevel(level);
      spawner.update(1);

      expect(enemySystem.spawn).toHaveBeenCalledTimes(10);
    });
  });

  describe('Drift Pattern', () => {
    it('should generate drift pattern spawn commands', () => {
      const level: LevelData = {
        id: 'test_level',
        waves: ['wave1'],
      };

      mockWaveData['wave1'] = {
        id: 'wave1',
        enemy: 'synapse_drone',
        count: 6,
        pattern: 'drift',
        entryDelayMs: 100,
      };

      spawner.loadLevel(level);
      spawner.update(1);

      expect(enemySystem.spawn).toHaveBeenCalledTimes(6);
    });
  });

  describe('Wave Pattern', () => {
    it('should generate wave pattern spawn commands', () => {
      const level: LevelData = {
        id: 'test_level',
        waves: ['wave1'],
      };

      mockWaveData['wave1'] = {
        id: 'wave1',
        enemy: 'synapse_drone',
        count: 8,
        pattern: 'wave',
        entryDelayMs: 100,
      };

      spawner.loadLevel(level);
      spawner.update(1);

      expect(enemySystem.spawn).toHaveBeenCalledTimes(8);
    });
  });

  describe('Orbital Pattern', () => {
    it('should generate orbital pattern spawn commands', () => {
      const level: LevelData = {
        id: 'test_level',
        waves: ['wave1'],
      };

      mockWaveData['wave1'] = {
        id: 'wave1',
        enemy: 'synapse_drone',
        count: 6,
        pattern: 'orbital',
        entryDelayMs: 100,
      };

      spawner.loadLevel(level);
      spawner.update(1);

      expect(enemySystem.spawn).toHaveBeenCalledTimes(6);
    });
  });

  describe('Swarm Pattern', () => {
    it('should generate swarm pattern spawn commands', () => {
      const level: LevelData = {
        id: 'test_level',
        waves: ['wave1'],
      };

      mockWaveData['wave1'] = {
        id: 'wave1',
        enemy: 'synapse_drone',
        count: 10,
        pattern: 'swarm',
        entryDelayMs: 50,
      };

      spawner.loadLevel(level);
      spawner.update(1);

      expect(enemySystem.spawn).toHaveBeenCalledTimes(10);
    });
  });

  describe('Pincer Pattern', () => {
    it('should generate pincer pattern spawn commands', () => {
      const level: LevelData = {
        id: 'test_level',
        waves: ['wave1'],
      };

      mockWaveData['wave1'] = {
        id: 'wave1',
        enemy: 'synapse_drone',
        count: 8,
        pattern: 'pincer',
        entryDelayMs: 100,
      };

      spawner.loadLevel(level);
      spawner.update(1);

      expect(enemySystem.spawn).toHaveBeenCalledTimes(8);
    });
  });

  describe('Gauntlet Pattern', () => {
    it('should generate gauntlet pattern spawn commands', () => {
      const level: LevelData = {
        id: 'test_level',
        waves: ['wave1'],
      };

      mockWaveData['wave1'] = {
        id: 'wave1',
        enemy: 'synapse_drone',
        count: 15,
        pattern: 'gauntlet',
        entryDelayMs: 50,
      };

      spawner.loadLevel(level);
      spawner.update(1);

      expect(enemySystem.spawn).toHaveBeenCalledTimes(15);
    });
  });

  describe('Enemies Array Format', () => {
    it('should handle waves with enemies array', () => {
      const level: LevelData = {
        id: 'test_level',
        waves: ['wave1'],
      };

      mockWaveData['wave1'] = {
        id: 'wave1',
        enemy: '',
        pattern: 'line',
        entryDelayMs: 100,
        enemies: [
          { type: 'synapse_drone', count: 3 },
          { type: 'pulse_node', count: 2 },
        ],
      };

      spawner.loadLevel(level);
      spawner.update(2);

      // Should spawn 3 synapse_drones and 2 pulse_nodes
      expect(enemySystem.spawn).toHaveBeenCalledTimes(5);
    });

    it('should handle enemy groups with different behaviors', () => {
      const level: LevelData = {
        id: 'test_level',
        waves: ['wave1'],
      };

      mockWaveData['wave1'] = {
        id: 'wave1',
        enemy: '',
        pattern: 'line',
        entryDelayMs: 100,
        enemies: [
          { type: 'synapse_drone', count: 2, behavior: 'zigzag' },
          { type: 'pulse_node', count: 2, behavior: 'orbit' },
        ],
      };

      spawner.loadLevel(level);
      spawner.update(2);

      expect(enemySystem.spawn).toHaveBeenCalledTimes(4);
    });
  });

  describe('Wave Completion', () => {
    it('should mark wave complete after all spawns', () => {
      const level: LevelData = {
        id: 'test_level',
        waves: ['wave1'],
      };

      mockWaveData['wave1'] = {
        id: 'wave1',
        enemy: 'synapse_drone',
        count: 3,
        pattern: 'line',
        entryDelayMs: 100,
      };

      spawner.loadLevel(level);
      spawner.update(0.5); // Spawn all enemies

      // Wave should be marked complete (all spawned)
      // But level not complete until enemies killed
    });

    it('should emit wave:complete when all enemies killed', () => {
      const level: LevelData = {
        id: 'test_level',
        waves: ['wave1'],
      };

      mockWaveData['wave1'] = {
        id: 'wave1',
        enemy: 'synapse_drone',
        count: 2,
        pattern: 'line',
        entryDelayMs: 100,
      };

      spawner.loadLevel(level);
      spawner.update(0.5); // Spawn all

      // Simulate killing enemies by making them inactive
      const enemies = (enemySystem as any).spawn.mock.results.map((r: any) => r.value);
      enemies.forEach((e: any) => { e.active = false; });

      vi.clearAllMocks();
      spawner.update(0.1);

      expect(events.emit).toHaveBeenCalledWith('wave:complete', { waveId: 'wave1' });
    });

    it('should progress to next wave after completion', () => {
      const level: LevelData = {
        id: 'test_level',
        waves: ['wave1', 'wave2'],
      };

      mockWaveData['wave1'] = {
        id: 'wave1',
        enemy: 'synapse_drone',
        count: 2,
        pattern: 'line',
        entryDelayMs: 100,
      };

      mockWaveData['wave2'] = {
        id: 'wave2',
        enemy: 'pulse_node',
        count: 3,
        pattern: 'line',
        entryDelayMs: 100,
      };

      spawner.loadLevel(level);
      expect(spawner.getWaveNumber()).toBe(1);

      spawner.update(0.5);

      // Kill enemies
      const enemies = (enemySystem as any).spawn.mock.results.map((r: any) => r.value);
      enemies.forEach((e: any) => { e.active = false; });

      spawner.update(0.1);

      // Should now be on wave 2
      expect(spawner.getWaveNumber()).toBe(2);
    });
  });

  describe('Level Completion', () => {
    it('should emit level:complete when all waves done', () => {
      const level: LevelData = {
        id: 'test_level',
        waves: ['wave1'],
      };

      mockWaveData['wave1'] = {
        id: 'wave1',
        enemy: 'synapse_drone',
        count: 2,
        pattern: 'line',
        entryDelayMs: 100,
      };

      spawner.loadLevel(level);
      spawner.update(0.5);

      // Kill all enemies
      const enemies = (enemySystem as any).spawn.mock.results.map((r: any) => r.value);
      enemies.forEach((e: any) => { e.active = false; });

      vi.clearAllMocks();
      spawner.update(0.1);
      spawner.update(0.1); // Need second update to trigger level complete

      expect(events.emit).toHaveBeenCalledWith('level:complete', expect.any(Object));
    });
  });

  describe('Queue Waves', () => {
    it('should queue additional waves', () => {
      const level: LevelData = {
        id: 'test_level',
        waves: ['wave1'],
      };

      mockWaveData['wave1'] = {
        id: 'wave1',
        enemy: 'synapse_drone',
        count: 1,
        pattern: 'line',
        entryDelayMs: 100,
      };

      mockWaveData['wave2'] = {
        id: 'wave2',
        enemy: 'pulse_node',
        count: 1,
        pattern: 'line',
        entryDelayMs: 100,
      };

      spawner.loadLevel(level);
      spawner.queueWaves(['wave2']);

      spawner.update(0.5);

      // Kill enemy from wave1
      const enemies1 = (enemySystem as any).spawn.mock.results.map((r: any) => r.value);
      enemies1.forEach((e: any) => { e.active = false; });

      spawner.update(0.1);

      // Should progress to queued wave
      expect(spawner.getWaveNumber()).toBe(2);
    });

    it('should start next wave if idle when queueing', () => {
      mockWaveData['wave1'] = {
        id: 'wave1',
        enemy: 'synapse_drone',
        count: 1,
        pattern: 'line',
        entryDelayMs: 100,
      };

      // Queue while idle
      spawner.queueWaves(['wave1']);

      expect(spawner.getWaveNumber()).toBe(1);
      expect(events.emit).toHaveBeenCalledWith('wave:start', expect.any(Object));
    });
  });

  describe('Reset', () => {
    it('should reset spawner state', () => {
      const level: LevelData = {
        id: 'test_level',
        waves: ['wave1'],
      };

      mockWaveData['wave1'] = {
        id: 'wave1',
        enemy: 'synapse_drone',
        count: 3,
        pattern: 'line',
        entryDelayMs: 100,
      };

      spawner.loadLevel(level);
      spawner.update(0.5);

      expect(spawner.getWaveNumber()).toBe(1);

      spawner.reset();

      expect(spawner.getWaveNumber()).toBe(0);
      expect(spawner.isIdle()).toBe(true);
    });
  });

  describe('X Position Clamping', () => {
    it('should clamp X positions to playable area', () => {
      const level: LevelData = {
        id: 'test_level',
        waves: ['wave1'],
      };

      mockWaveData['wave1'] = {
        id: 'wave1',
        enemy: 'synapse_drone',
        count: 20,
        pattern: 'random',
        entryDelayMs: 10,
      };

      spawner.loadLevel(level);
      spawner.update(1);

      const calls = (enemySystem.spawn as ReturnType<typeof vi.fn>).mock.calls;
      calls.forEach(call => {
        const x = call[1];
        expect(x).toBeGreaterThanOrEqual(80);
        expect(x).toBeLessThanOrEqual(screenWidth - 80);
      });
    });
  });

  describe('Spawn Event Emission', () => {
    it('should emit enemy:spawn event for each spawned enemy', () => {
      const level: LevelData = {
        id: 'test_level',
        waves: ['wave1'],
      };

      mockWaveData['wave1'] = {
        id: 'wave1',
        enemy: 'synapse_drone',
        count: 3,
        pattern: 'line',
        entryDelayMs: 100,
      };

      spawner.loadLevel(level);
      vi.clearAllMocks();
      spawner.update(0.5);

      // Should emit 3 spawn events
      const spawnCalls = (events.emit as ReturnType<typeof vi.fn>).mock.calls.filter(
        call => call[0] === 'enemy:spawn'
      );
      expect(spawnCalls.length).toBe(3);
    });
  });
});
