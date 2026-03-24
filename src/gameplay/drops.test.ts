import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../core/events', () => ({
  events: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
}));

import { events } from '../core/events';
import { Drop, DropSystem, type DropType } from './drops';
import type { Player } from './player';
import type { WeaponSystem } from './weapons';

const DROP_TYPES: DropType[] = ['health', 'damage_up', 'fire_rate', 'shield'];

function mockPlayer(): Player {
  return {
    health: { current: 1, max: 3, invulnerable: false, invulnerableTime: 0 },
    setShield: vi.fn(),
  } as unknown as Player;
}

function mockWeapons(): WeaponSystem {
  return {
    setDamageMultiplier: vi.fn(),
    setFireRateMultiplier: vi.fn(),
  } as unknown as WeaponSystem;
}

describe('Drop', () => {
  beforeEach(() => {
    vi.mocked(events.emit).mockClear();
  });

  it.each(DROP_TYPES)('constructs with drop type %s', (type) => {
    const drop = new Drop(type, 10, 20);
    expect(drop.dropType).toBe(type);
    expect(drop.transform.x).toBe(10);
    expect(drop.transform.y).toBe(20);
    expect(drop.active).toBe(true);
  });

  it('has circle collider with radius 22', () => {
    const drop = new Drop('health', 0, 0);
    expect(drop.collider).toEqual({ type: 'circle', radius: 22 });
  });

  it('update moves drop downward by fallSpeed * dt', () => {
    const drop = new Drop('health', 0, 0);
    drop.update(1, 600);
    expect(drop.transform.y).toBe(60);
    drop.update(0.5, 600);
    expect(drop.transform.y).toBe(90);
  });

  it('destroys when off screen', () => {
    const drop = new Drop('health', 0, 0);
    drop.update(3, 100);
    expect(drop.transform.y).toBe(180);
    expect(drop.active).toBe(false);
  });
});

describe('DropSystem', () => {
  beforeEach(() => {
    vi.mocked(events.emit).mockClear();
  });

  it('constructs with screen height', () => {
    const system = new DropSystem(720);
    expect(system.getDrops()).toEqual([]);
    expect(system.getActiveUpgrades()).toEqual([]);
  });

  it('spawn() creates a drop and emits drop:spawn', () => {
    const system = new DropSystem(600);
    const drop = system.spawn('fire_rate', 42, 55);

    expect(drop).toBeInstanceOf(Drop);
    expect(drop.dropType).toBe('fire_rate');
    expect(system.getDrops()).toContain(drop);
    expect(events.emit).toHaveBeenCalledWith('drop:spawn', { type: 'fire_rate', x: 42, y: 55 });
  });

  describe('spawnFromEnemy', () => {
    afterEach(() => {
      vi.spyOn(Math, 'random').mockRestore();
    });

    it('tier 1 spawns health when random is below health chance', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.05);
      const system = new DropSystem(600);
      system.spawnFromEnemy(1, 2, 1);
      expect(system.getDrops()).toHaveLength(1);
      expect(system.getDrops()[0]!.dropType).toBe('health');
    });

    it('tier 1 spawns nothing when random is above health chance', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.99);
      const system = new DropSystem(600);
      system.spawnFromEnemy(1, 2, 1);
      expect(system.getDrops()).toHaveLength(0);
    });

    it('tier 2+ can spawn upgrade when health roll fails and upgrade roll succeeds', () => {
      vi.spyOn(Math, 'random').mockReturnValueOnce(0.2).mockReturnValueOnce(0.05).mockReturnValueOnce(0.1);
      const system = new DropSystem(600);
      system.spawnFromEnemy(0, 0, 2);
      expect(system.getDrops()).toHaveLength(1);
      expect(system.getDrops()[0]!.dropType).toBe('damage_up');
    });
  });

  it('connect() links player and weapons for collect effects', () => {
    const system = new DropSystem(600);
    const player = mockPlayer();
    const weapons = mockWeapons();

    system.connect(player, weapons);
    system.collect(new Drop('health', 0, 0));

    expect(player.health!.current).toBe(2);
  });

  it('collect() does nothing without player', () => {
    const system = new DropSystem(600);
    const drop = new Drop('health', 0, 0);
    system.collect(drop);
    expect(events.emit).not.toHaveBeenCalledWith('drop:collect', expect.anything());
  });

  it('collect() applies health and emits drop:collect', () => {
    const system = new DropSystem(600);
    const player = mockPlayer();
    system.connect(player, mockWeapons());

    const drop = new Drop('health', 0, 0);
    system.collect(drop);

    expect(player.health!.current).toBe(2);
    expect(events.emit).toHaveBeenCalledWith('drop:collect', { type: 'health', value: 1 });
    expect(drop.active).toBe(false);
  });

  it('collect() applies temporary weapon upgrades', () => {
    const system = new DropSystem(600);
    const player = mockPlayer();
    const weapons = mockWeapons();
    system.connect(player, weapons);

    system.collect(new Drop('damage_up', 0, 0));
    expect(weapons.setDamageMultiplier).toHaveBeenCalledWith(1.5);

    system.collect(new Drop('fire_rate', 0, 0));
    expect(weapons.setFireRateMultiplier).toHaveBeenCalledWith(0.7);
  });

  it('collect() enables shield on player', () => {
    const system = new DropSystem(600);
    const player = mockPlayer();
    system.connect(player, mockWeapons());

    system.collect(new Drop('shield', 0, 0));
    expect(player.setShield).toHaveBeenCalledWith(true);
  });

  it('update() ticks active upgrade timers and expires upgrades', () => {
    const system = new DropSystem(600);
    const player = mockPlayer();
    const weapons = mockWeapons();
    system.connect(player, weapons);

    system.collect(new Drop('damage_up', 0, 0));
    expect(system.getActiveUpgrades()).toHaveLength(1);
    expect(system.getActiveUpgrades()[0]!.timeRemaining).toBe(15);

    system.update(4);
    expect(system.getActiveUpgrades()[0]!.timeRemaining).toBe(11);

    system.update(20);
    expect(system.getActiveUpgrades()).toHaveLength(0);
    expect(weapons.setDamageMultiplier).toHaveBeenLastCalledWith(1);
    expect(events.emit).toHaveBeenCalledWith('upgrade:expire', { type: 'damage_up' });
  });

  it('clear() removes all drops and active upgrades', () => {
    const system = new DropSystem(600);
    const player = mockPlayer();
    const weapons = mockWeapons();
    system.connect(player, weapons);

    system.spawn('health', 0, 0);
    system.collect(new Drop('shield', 0, 0));

    expect(system.getDrops().length).toBeGreaterThan(0);
    expect(system.getActiveUpgrades().length).toBeGreaterThan(0);

    system.clear();

    expect(system.getDrops()).toHaveLength(0);
    expect(system.getActiveUpgrades()).toHaveLength(0);
    expect(player.setShield).toHaveBeenCalledWith(false);
  });

  it('getDrops() returns only active drops', () => {
    const system = new DropSystem(100);
    const drop = system.spawn('health', 0, 0);
    expect(system.getDrops()).toEqual([drop]);

    drop.destroy();
    expect(system.getDrops()).toEqual([]);

    system.update(0);
    expect(system.getDrops()).toEqual([]);
  });

  it('getActiveUpgrades() returns current upgrade entries', () => {
    const system = new DropSystem(600);
    system.connect(mockPlayer(), mockWeapons());
    system.collect(new Drop('fire_rate', 0, 0));

    const upgrades = system.getActiveUpgrades();
    expect(upgrades).toHaveLength(1);
    expect(upgrades[0]).toMatchObject({
      type: 'fire_rate',
      value: 0.7,
      timeRemaining: 12,
    });
  });
});
