/**
 * Tests for Enemy Archetypes System
 * TDD: Tests written FIRST before implementation
 *
 * 12 Archetypes:
 * - drifter: Slow, predictable descent
 * - chaser: Homes toward player lane
 * - sniper: Stationary, fires aimed shots
 * - swarm: Small units, overwhelm
 * - splitter: Breaks into 2+ on death
 * - shieldbearer: Front shield, must flank
 * - mimic: Copies player shot pattern
 * - anchor: Creates hazard field
 * - courier: Drops power-ups/traps on death
 * - phaser: Blinks, ignores some bullets
 * - weaver: Draws SVG spline hazards
 * - boss_chassis: Modular boss component
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the module we're about to create
vi.mock('./archetypes', async () => {
  const actual = await vi.importActual('./archetypes');
  return actual;
});

// Import after mock setup
import {
  ALL_ARCHETYPES,
  type ArchetypeEntity,
  ArchetypeSystem,
  createArchetypeEntity,
  getArchetypeBehavior,
} from './archetypes';

describe('Archetype System', () => {
  describe('ALL_ARCHETYPES constant', () => {
    it('should contain all 12 archetypes', () => {
      expect(ALL_ARCHETYPES).toHaveLength(12);
      expect(ALL_ARCHETYPES).toContain('drifter');
      expect(ALL_ARCHETYPES).toContain('chaser');
      expect(ALL_ARCHETYPES).toContain('sniper');
      expect(ALL_ARCHETYPES).toContain('swarm');
      expect(ALL_ARCHETYPES).toContain('splitter');
      expect(ALL_ARCHETYPES).toContain('shieldbearer');
      expect(ALL_ARCHETYPES).toContain('mimic');
      expect(ALL_ARCHETYPES).toContain('anchor');
      expect(ALL_ARCHETYPES).toContain('courier');
      expect(ALL_ARCHETYPES).toContain('phaser');
      expect(ALL_ARCHETYPES).toContain('weaver');
      expect(ALL_ARCHETYPES).toContain('boss_chassis');
    });
  });

  describe('getArchetypeBehavior', () => {
    it('should return behavior definition for drifter', () => {
      const behavior = getArchetypeBehavior('drifter');
      expect(behavior).toBeDefined();
      expect(behavior.id).toBe('drifter');
      expect(behavior.baseSpeed).toBeLessThan(1); // Slow
      expect(behavior.movementPattern).toBe('straight_descend');
    });

    it('should return behavior definition for chaser', () => {
      const behavior = getArchetypeBehavior('chaser');
      expect(behavior).toBeDefined();
      expect(behavior.id).toBe('chaser');
      expect(behavior.movementPattern).toBe('chase_player');
    });

    it('should return behavior definition for sniper', () => {
      const behavior = getArchetypeBehavior('sniper');
      expect(behavior).toBeDefined();
      expect(behavior.id).toBe('sniper');
      expect(behavior.baseSpeed).toBe(0); // Stationary
      expect(behavior.attackPattern).toBe('aimed_shot');
    });

    it('should return behavior definition for swarm', () => {
      const behavior = getArchetypeBehavior('swarm');
      expect(behavior).toBeDefined();
      expect(behavior.id).toBe('swarm');
      expect(behavior.baseSpeed).toBeGreaterThan(1); // Fast
      expect(behavior.baseHp).toBeLessThan(1); // Low HP
    });

    it('should return behavior definition for splitter', () => {
      const behavior = getArchetypeBehavior('splitter');
      expect(behavior).toBeDefined();
      expect(behavior.id).toBe('splitter');
      expect(behavior.onDeathEffect).toBe('split_spawn');
    });

    it('should return behavior definition for shieldbearer', () => {
      const behavior = getArchetypeBehavior('shieldbearer');
      expect(behavior).toBeDefined();
      expect(behavior.id).toBe('shieldbearer');
      expect(behavior.baseHp).toBeGreaterThan(2); // Tanky
    });

    it('should return behavior definition for mimic', () => {
      const behavior = getArchetypeBehavior('mimic');
      expect(behavior).toBeDefined();
      expect(behavior.id).toBe('mimic');
      expect(behavior.movementPattern).toBe('mirror_player');
      expect(behavior.attackPattern).toBe('copy_player');
    });

    it('should return behavior definition for anchor', () => {
      const behavior = getArchetypeBehavior('anchor');
      expect(behavior).toBeDefined();
      expect(behavior.id).toBe('anchor');
      expect(behavior.attackPattern).toBe('hazard_field');
    });

    it('should return behavior definition for courier', () => {
      const behavior = getArchetypeBehavior('courier');
      expect(behavior).toBeDefined();
      expect(behavior.id).toBe('courier');
      expect(behavior.onDeathEffect).toBe('drop_item');
    });

    it('should return behavior definition for phaser', () => {
      const behavior = getArchetypeBehavior('phaser');
      expect(behavior).toBeDefined();
      expect(behavior.id).toBe('phaser');
      expect(behavior.movementPattern).toBe('phase_shift');
    });

    it('should return behavior definition for weaver', () => {
      const behavior = getArchetypeBehavior('weaver');
      expect(behavior).toBeDefined();
      expect(behavior.id).toBe('weaver');
      expect(behavior.attackPattern).toBe('draw_hazard');
    });

    it('should return behavior definition for boss_chassis', () => {
      const behavior = getArchetypeBehavior('boss_chassis');
      expect(behavior).toBeDefined();
      expect(behavior.id).toBe('boss_chassis');
      expect(behavior.baseHp).toBeGreaterThan(5); // Very tanky
    });
  });

  describe('createArchetypeEntity', () => {
    it('should create an entity with correct archetype', () => {
      const entity = createArchetypeEntity('drifter', 100, 50);
      expect(entity).toBeDefined();
      expect(entity.archetype).toBe('drifter');
      expect(entity.x).toBe(100);
      expect(entity.y).toBe(50);
    });

    it('should apply base HP from archetype', () => {
      const drifter = createArchetypeEntity('drifter', 0, 0);
      const swarm = createArchetypeEntity('swarm', 0, 0);
      const shieldbearer = createArchetypeEntity('shieldbearer', 0, 0);

      // Swarm should have less HP than drifter
      expect(swarm.hp).toBeLessThan(drifter.hp);
      // Shieldbearer should have more HP than drifter
      expect(shieldbearer.hp).toBeGreaterThan(drifter.hp);
    });

    it('should apply base speed from archetype', () => {
      const drifter = createArchetypeEntity('drifter', 0, 0);
      const sniper = createArchetypeEntity('sniper', 0, 0);
      const swarm = createArchetypeEntity('swarm', 0, 0);

      expect(sniper.speed).toBe(0); // Stationary
      expect(drifter.speed).toBeLessThan(swarm.speed); // Drifter slower than swarm
    });

    it('should allow HP override', () => {
      const entity = createArchetypeEntity('drifter', 0, 0, { hp: 10 });
      expect(entity.hp).toBe(10);
    });

    it('should allow speed override', () => {
      const entity = createArchetypeEntity('sniper', 0, 0, { speed: 2 });
      expect(entity.speed).toBe(2);
    });
  });

  describe('ArchetypeEntity', () => {
    let entity: ArchetypeEntity;

    beforeEach(() => {
      entity = createArchetypeEntity('drifter', 400, 0);
    });

    describe('Movement', () => {
      it('should move drifter straight down', () => {
        const initialY = entity.y;
        entity.update(1, 400, 500); // dt=1s, playerX=400, playerY=500
        expect(entity.y).toBeGreaterThan(initialY);
        expect(entity.x).toBe(400); // No horizontal movement
      });

      it('should move chaser toward player lane', () => {
        const chaser = createArchetypeEntity('chaser', 100, 0);
        chaser.update(1, 400, 500); // Player is to the right
        expect(chaser.x).toBeGreaterThan(100); // Should move right
      });

      it('should keep sniper stationary', () => {
        const sniper = createArchetypeEntity('sniper', 200, 100);
        const initialX = sniper.x;
        const initialY = sniper.y;
        sniper.update(1, 400, 500);
        expect(sniper.x).toBe(initialX);
        expect(sniper.y).toBe(initialY);
      });

      it('should move swarm in cluster pattern', () => {
        const swarm = createArchetypeEntity('swarm', 200, 0);
        swarm.update(1, 400, 500);
        // Swarm should move faster than drifter
        expect(swarm.y).toBeGreaterThan(entity.y);
      });

      it('should move mimic to mirror player position', () => {
        const mimic = createArchetypeEntity('mimic', 400, 0);
        // Screen center is 400, player at 300 means mimic should go to 500
        mimic.update(1, 300, 500, { screenWidth: 800 });
        // Mimic mirrors player position around center
        expect(mimic.x).toBeGreaterThan(400);
      });

      it('should move phaser with phase shifting', () => {
        const phaser = createArchetypeEntity('phaser', 200, 0);
        phaser.update(0.5, 400, 500);
        // Phaser should have phase state
        expect(phaser.isPhased).toBeDefined();
      });

      it('should move weaver in weaving pattern', () => {
        const weaver = createArchetypeEntity('weaver', 200, 0);
        const positions: number[] = [];
        for (let i = 0; i < 10; i++) {
          weaver.update(0.1, 400, 500);
          positions.push(weaver.x);
        }
        // Weaver should have varying X positions (weaving)
        const uniquePositions = new Set(positions);
        expect(uniquePositions.size).toBeGreaterThan(1);
      });

      it('should move anchor slowly', () => {
        const anchor = createArchetypeEntity('anchor', 200, 0);
        anchor.update(1, 400, 500);
        // Anchor moves very slowly
        expect(anchor.y).toBeLessThan(100);
      });
    });

    describe('Damage and Death', () => {
      it('should take damage', () => {
        const initialHp = entity.hp;
        entity.takeDamage(1);
        expect(entity.hp).toBe(initialHp - 1);
      });

      it('should die when HP reaches 0', () => {
        entity.takeDamage(entity.hp);
        expect(entity.isDead).toBe(true);
      });

      it('should not go below 0 HP', () => {
        entity.takeDamage(999);
        expect(entity.hp).toBe(0);
      });

      it('should trigger split_spawn for splitter on death', () => {
        const splitter = createArchetypeEntity('splitter', 200, 200);
        const onDeathSpy = vi.fn();
        splitter.onDeath(onDeathSpy);
        splitter.takeDamage(splitter.hp);
        expect(onDeathSpy).toHaveBeenCalledWith('split_spawn', expect.any(Object));
      });

      it('should trigger drop_item for courier on death', () => {
        const courier = createArchetypeEntity('courier', 200, 200);
        const onDeathSpy = vi.fn();
        courier.onDeath(onDeathSpy);
        courier.takeDamage(courier.hp);
        expect(onDeathSpy).toHaveBeenCalledWith('drop_item', expect.any(Object));
      });

      it('should not trigger death effect for drifter', () => {
        const onDeathSpy = vi.fn();
        entity.onDeath(onDeathSpy);
        entity.takeDamage(entity.hp);
        expect(onDeathSpy).toHaveBeenCalledWith(undefined, expect.any(Object));
      });
    });

    describe('Attacks', () => {
      it('should sniper fire aimed shots', () => {
        const sniper = createArchetypeEntity('sniper', 400, 100);
        sniper.update(2, 400, 500); // Wait for attack cooldown
        const projectiles = sniper.getProjectiles();
        expect(projectiles.length).toBeGreaterThan(0);
        // Projectile should be aimed at player
        const proj = projectiles[0];
        expect(proj.targetX).toBe(400);
        expect(proj.targetY).toBe(500);
      });

      it('should mimic copy player shot pattern', () => {
        const mimic = createArchetypeEntity('mimic', 400, 100);
        mimic.registerPlayerShot({ x: 400, y: 500, angle: Math.PI / 2 });
        mimic.update(0.5, 400, 500);
        const projectiles = mimic.getProjectiles();
        // Mimic should fire back with similar pattern
        expect(projectiles.length).toBeGreaterThan(0);
      });

      it('should anchor create hazard field', () => {
        const anchor = createArchetypeEntity('anchor', 400, 200);
        anchor.update(2, 400, 500); // Wait for hazard creation
        const hazards = anchor.getHazards();
        expect(hazards.length).toBeGreaterThan(0);
        // Hazard should be near anchor position (anchor moves slowly)
        expect(hazards[0].x).toBe(400);
        expect(hazards[0].y).toBeGreaterThanOrEqual(200);
        expect(hazards[0].y).toBeLessThan(300);
      });

      it('should weaver draw spline hazards', () => {
        const weaver = createArchetypeEntity('weaver', 200, 0);
        for (let i = 0; i < 20; i++) {
          weaver.update(0.1, 400, 500);
        }
        const hazards = weaver.getHazards();
        // Weaver should have created trail hazards
        expect(hazards.length).toBeGreaterThan(0);
      });
    });

    describe('Special Behaviors', () => {
      it('should shieldbearer block frontal attacks', () => {
        const shieldbearer = createArchetypeEntity('shieldbearer', 400, 100);
        // Attack from front (below)
        const blocked = shieldbearer.takeDamageFrom(1, { x: 400, y: 200 });
        expect(blocked).toBe(true);
        expect(shieldbearer.hp).toBe(shieldbearer.maxHp); // No damage taken
      });

      it('should shieldbearer take damage from flanks', () => {
        const shieldbearer = createArchetypeEntity('shieldbearer', 400, 100);
        const initialHp = shieldbearer.hp;
        // Attack from side
        const blocked = shieldbearer.takeDamageFrom(1, { x: 200, y: 100 });
        expect(blocked).toBe(false);
        expect(shieldbearer.hp).toBe(initialHp - 1);
      });

      it('should phaser become invulnerable when phased', () => {
        const phaser = createArchetypeEntity('phaser', 400, 100);
        // Force phased state
        phaser.setPhased(true);
        const initialHp = phaser.hp;
        phaser.takeDamage(1);
        expect(phaser.hp).toBe(initialHp); // No damage when phased
      });

      it('should phaser take damage when not phased', () => {
        const phaser = createArchetypeEntity('phaser', 400, 100);
        phaser.setPhased(false);
        const initialHp = phaser.hp;
        phaser.takeDamage(1);
        expect(phaser.hp).toBe(initialHp - 1);
      });

      it('should phaser toggle phase state over time', () => {
        const phaser = createArchetypeEntity('phaser', 400, 100);
        const states: boolean[] = [];
        for (let i = 0; i < 20; i++) {
          phaser.update(0.2, 400, 500);
          states.push(phaser.isPhased);
        }
        // Should have both phased and unphased states
        expect(states.includes(true)).toBe(true);
        expect(states.includes(false)).toBe(true);
      });
    });

    describe('Visual Properties', () => {
      it('should have visual hint from archetype', () => {
        const drifter = createArchetypeEntity('drifter', 0, 0);
        expect(drifter.visualHint).toBe('simple_shape');

        const chaser = createArchetypeEntity('chaser', 0, 0);
        expect(chaser.visualHint).toBe('arrow_eye_motif');

        const sniper = createArchetypeEntity('sniper', 0, 0);
        expect(sniper.visualHint).toBe('crosshair_glow');
      });

      it('should have correct radius based on archetype', () => {
        const swarm = createArchetypeEntity('swarm', 0, 0);
        const boss = createArchetypeEntity('boss_chassis', 0, 0);
        // Swarm should be smaller than boss
        expect(swarm.radius).toBeLessThan(boss.radius);
      });
    });
  });

  describe('ArchetypeSystem', () => {
    let system: ArchetypeSystem;

    beforeEach(() => {
      system = new ArchetypeSystem();
    });

    describe('Entity Management', () => {
      it('should spawn entity', () => {
        const entity = system.spawn('drifter', 100, 50);
        expect(entity).toBeDefined();
        expect(system.getEntities()).toContain(entity);
      });

      it('should spawn multiple entities', () => {
        system.spawn('drifter', 100, 50);
        system.spawn('chaser', 200, 50);
        system.spawn('sniper', 300, 50);
        expect(system.getEntities()).toHaveLength(3);
      });

      it('should remove dead entities on update', () => {
        const entity = system.spawn('drifter', 100, 50);
        entity.takeDamage(entity.hp); // Kill it
        system.update(0.1, 400, 500);
        expect(system.getEntities()).not.toContain(entity);
      });

      it('should clear all entities', () => {
        system.spawn('drifter', 100, 50);
        system.spawn('chaser', 200, 50);
        system.clear();
        expect(system.getEntities()).toHaveLength(0);
      });
    });

    describe('Batch Spawning', () => {
      it('should spawn line of entities', () => {
        system.spawnLine('drifter', 5, 100, 50, 50);
        expect(system.getEntities()).toHaveLength(5);
        // Check spacing
        const entities = system.getEntities();
        expect(entities[1].x - entities[0].x).toBe(50);
      });

      it('should spawn grid of entities', () => {
        system.spawnGrid('swarm', 3, 4, 100, 50, 30, 30);
        expect(system.getEntities()).toHaveLength(12); // 3 rows x 4 cols
      });

      it('should spawn V formation', () => {
        system.spawnVFormation('chaser', 5, 400, 50, 40);
        expect(system.getEntities()).toHaveLength(5);
      });
    });

    describe('Update and Collision', () => {
      it('should update all entities', () => {
        const entity1 = system.spawn('drifter', 100, 0);
        const entity2 = system.spawn('drifter', 200, 0);
        const initialY1 = entity1.y;
        const initialY2 = entity2.y;
        system.update(1, 400, 500);
        expect(entity1.y).toBeGreaterThan(initialY1);
        expect(entity2.y).toBeGreaterThan(initialY2);
      });

      it('should collect all projectiles from entities', () => {
        system.spawn('sniper', 400, 100);
        system.update(2, 400, 500); // Wait for attack
        const projectiles = system.getAllProjectiles();
        expect(projectiles.length).toBeGreaterThan(0);
      });

      it('should collect all hazards from entities', () => {
        system.spawn('anchor', 400, 200);
        system.update(2, 400, 500); // Wait for hazard
        const hazards = system.getAllHazards();
        expect(hazards.length).toBeGreaterThan(0);
      });

      it('should check collision with player', () => {
        const entity = system.spawn('drifter', 400, 500);
        entity.radius = 20;
        const collision = system.checkPlayerCollision(400, 500, 15);
        expect(collision).toBe(entity);
      });

      it('should return null for no collision', () => {
        system.spawn('drifter', 100, 100);
        const collision = system.checkPlayerCollision(400, 500, 15);
        expect(collision).toBeNull();
      });
    });

    describe('Splitter Spawning', () => {
      it('should spawn children when splitter dies', () => {
        const splitter = system.spawn('splitter', 400, 200);
        splitter.takeDamage(splitter.hp);
        system.update(0.1, 400, 500);
        // Should have spawned 2 children
        const entities = system.getEntities();
        expect(entities.length).toBeGreaterThanOrEqual(2);
      });

      it('should spawn weaker children', () => {
        const splitter = system.spawn('splitter', 400, 200);
        const parentHp = splitter.hp;
        splitter.takeDamage(splitter.hp);
        system.update(0.1, 400, 500);
        const children = system.getEntities();
        // Children should have less HP
        children.forEach((child) => {
          expect(child.hp).toBeLessThan(parentHp);
        });
      });
    });

    describe('Statistics', () => {
      it('should track total spawned', () => {
        system.spawn('drifter', 100, 50);
        system.spawn('chaser', 200, 50);
        expect(system.getTotalSpawned()).toBe(2);
      });

      it('should track total killed', () => {
        const entity = system.spawn('drifter', 100, 50);
        entity.takeDamage(entity.hp);
        system.update(0.1, 400, 500);
        expect(system.getTotalKilled()).toBe(1);
      });

      it('should track by archetype', () => {
        system.spawn('drifter', 100, 50);
        system.spawn('drifter', 200, 50);
        system.spawn('chaser', 300, 50);
        expect(system.getSpawnedByArchetype('drifter')).toBe(2);
        expect(system.getSpawnedByArchetype('chaser')).toBe(1);
      });
    });
  });
});
