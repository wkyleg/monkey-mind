import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LevelDataV2 } from '../content/schema';
import { events } from '../core/events';
import { svgAssets } from '../engine/svgAssets';
import type { EnemySystem } from './enemies';
import { SpawnerV2 } from './spawnerV2';

vi.mock('../core/events', () => ({
  events: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
}));

vi.mock('../engine/svgAssets', () => ({
  svgAssets: {
    getActEnemies: vi.fn(() => []),
    getExpansionEnemies: vi.fn(() => []),
    getActEnemySvgId: vi.fn((actId: string, visual: string) => `acts/${actId}/enemies/${visual}`),
    getExpansionEnemySvgId: vi.fn((expId: string, visual: string) => `expansions/${expId}/enemies/${visual}`),
    getLevelEnemySvgId: vi.fn(
      (actId: string, levelIdx: number, visual: string) => `acts/${actId}/level${levelIdx}_enemies/${visual}`,
    ),
  },
}));

vi.mock('../content/schema', async () => {
  const actual = await vi.importActual<typeof import('../content/schema')>('../content/schema');
  return {
    ...actual,
    ARCHETYPE_BEHAVIORS: {
      drifter: { baseHp: 1, movementPattern: 'straight_descend' },
      chaser: { baseHp: 1.2, movementPattern: 'chase_player' },
    },
    MODIFIER_EFFECTS: {
      observed: { hpMod: 1, speedMod: 1 },
    },
  };
});

vi.mock('../config', () => ({
  CONFIG: { ENEMY_SPAWN_Y: -30 },
}));

const createMockEnemySystem = () => ({
  spawn: vi.fn((_id: string, _x: number, _y: number) => ({
    active: true,
    health: { max: 100, current: 100 },
    speed: 1,
    speedMod: 1,
    behavior: 'straight_descend',
    setBehavior: vi.fn(),
    setCustomSvgId: vi.fn(),
    setDialogueEnemyId: vi.fn(),
    addModifier: vi.fn(),
    setTargetX: vi.fn(),
  })),
});

const createMockLevel = (overrides: Partial<LevelDataV2> = {}): LevelDataV2 =>
  ({
    id: 'test_level',
    index: 1,
    title: 'Test Level',
    themeTags: ['test'],
    ruleCard: { icon: 'test', hint: 'test', mechanic: 'test' },
    enemyDeck: [
      { archetype: 'drifter' as const, weight: 5 },
      { archetype: 'chaser' as const, weight: 3 },
    ],
    hazards: [],
    bgLayers: [],
    copyLayers: { ruleCard: 'test' },
    musicSeed: { seed: 'test', mode: 'dorian', tempoRange: [80, 120] as [number, number] },
    duration: 90,
    ...overrides,
  }) as LevelDataV2;

describe('SpawnerV2', () => {
  const screenWidth = 800;
  const screenHeight = 600;
  let enemySystem: ReturnType<typeof createMockEnemySystem>;
  let spawner: SpawnerV2;
  let mathRandomSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mathRandomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    enemySystem = createMockEnemySystem();
    spawner = new SpawnerV2(enemySystem as unknown as EnemySystem, screenWidth, screenHeight);
  });

  afterEach(() => {
    mathRandomSpy.mockRestore();
  });

  describe('construction', () => {
    it('creates instance with idle state, wave 0, and zero level timer', () => {
      expect(spawner.isIdle()).toBe(true);
      expect(spawner.getWaveNumber()).toBe(0);
      expect(spawner.getLevelTimer()).toBe(0);
    });
  });

  describe('isIdle', () => {
    it('returns true before any level is loaded', () => {
      expect(spawner.isIdle()).toBe(true);
    });
  });

  describe('loadLevelV2', () => {
    it('starts spawning: emits wave:start and isIdle becomes false', () => {
      spawner.loadLevelV2(createMockLevel());
      expect(spawner.isIdle()).toBe(false);
      expect(events.emit).toHaveBeenCalledWith('wave:start', { waveId: 'wave_1', number: 1 });
    });

    it('sets getWaveNumber to the active wave', () => {
      spawner.loadLevelV2(createMockLevel());
      expect(spawner.getWaveNumber()).toBe(1);
    });
  });

  describe('setCurrentAct / setCurrentExpansion', () => {
    it('setCurrentAct clears expansion context; setCurrentExpansion clears act context', () => {
      vi.mocked(svgAssets.getActEnemies).mockReturnValue(['act_vis']);
      vi.mocked(svgAssets.getExpansionEnemies).mockReturnValue(['exp_vis']);

      spawner.setCurrentExpansion('exp_a');
      spawner.setCurrentAct('act_1');
      spawner.loadLevelV2(createMockLevel());
      spawner.update(0.05, 400, 300);
      expect(svgAssets.getExpansionEnemies).not.toHaveBeenCalled();
      expect(svgAssets.getActEnemies).toHaveBeenCalledWith('act_1');

      vi.mocked(svgAssets.getActEnemies).mockClear();
      vi.mocked(svgAssets.getExpansionEnemies).mockClear();

      spawner.setCurrentAct('act_2');
      spawner.setCurrentExpansion('exp_b');
      spawner.loadLevelV2(createMockLevel());
      spawner.update(0.05, 400, 300);
      expect(svgAssets.getActEnemies).not.toHaveBeenCalled();
      expect(svgAssets.getExpansionEnemies).toHaveBeenCalledWith('exp_b');
    });
  });

  describe('update', () => {
    it('spawns enemies over time via enemySystem.spawn', () => {
      spawner.loadLevelV2(createMockLevel());
      spawner.update(0.05, 400, 300);
      expect(enemySystem.spawn).toHaveBeenCalled();
      expect(enemySystem.spawn.mock.calls.length).toBeGreaterThanOrEqual(1);
    });

    it('increments level timer by dt', () => {
      spawner.loadLevelV2(createMockLevel());
      spawner.update(0.25, 0, 0);
      expect(spawner.getLevelTimer()).toBeCloseTo(0.25, 5);
      spawner.update(0.1, 0, 0);
      expect(spawner.getLevelTimer()).toBeCloseTo(0.35, 5);
    });

    it('calls setTargetX on chase_player enemies when updating', () => {
      const chaseEnemy = {
        active: true,
        health: { max: 100, current: 100 },
        speed: 1,
        speedMod: 1,
        behavior: 'straight_descend',
        setBehavior: vi.fn(),
        setCustomSvgId: vi.fn(),
        setDialogueEnemyId: vi.fn(),
        addModifier: vi.fn(),
        setTargetX: vi.fn(),
      };
      chaseEnemy.setBehavior.mockImplementation((pattern: string) => {
        chaseEnemy.behavior = pattern;
      });
      enemySystem.spawn.mockReturnValue(chaseEnemy);
      spawner.loadLevelV2(
        createMockLevel({
          enemyDeck: [{ archetype: 'chaser' as const, weight: 1 }],
        }),
      );
      spawner.update(1, 0, 0);
      expect(chaseEnemy.setBehavior).toHaveBeenCalledWith('chase_player');
      spawner.update(0.016, 123, 0);
      expect(chaseEnemy.setTargetX).toHaveBeenCalledWith(123);
    });
  });

  describe('reset', () => {
    it('clears wave, timer, and wave number', () => {
      spawner.loadLevelV2(createMockLevel());
      spawner.update(0.5, 0, 0);
      spawner.reset();
      expect(spawner.isIdle()).toBe(true);
      expect(spawner.getWaveNumber()).toBe(0);
      expect(spawner.getLevelTimer()).toBe(0);
    });
  });

  describe('empty enemy deck', () => {
    it('handles boss-only levels without throwing', () => {
      spawner.loadLevelV2(createMockLevel({ enemyDeck: [] }));
      expect(() => spawner.update(0.016, 400, 300)).not.toThrow();
      expect(events.emit).toHaveBeenCalledWith('wave:start', { waveId: 'wave_1', number: 1 });
    });
  });
});
