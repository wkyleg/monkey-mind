/**
 * Tests for AI Modifiers System
 * TDD: Tests written FIRST before implementation
 *
 * 12 AI Modifiers:
 * - observed: Wakes only when player looks at it (eye-tracking ready)
 * - unseen: Vulnerable only when NOT looked at (eye-tracking ready)
 * - recursive: Respawns weaker copy on death
 * - bureaucratic: Must be shot in sequence (symbols)
 * - mythic: Fate shield, prophecy condition
 * - simulacrum: Fake enemy, vanishes on hit
 * - apophenic: Spawns trap patterns that look meaningful
 * - entropy: Shots accelerate over time
 * - koan: Defeated by "wrong" action
 * - labyrinthine: Emerges from maze walls
 * - liturgical: Wave timing follows rhythm
 * - incompleteness: Cannot be fully defeated, must escape
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createArchetypeEntity } from './archetypes';
// Import after mock setup
import { ALL_MODIFIERS, applyModifier, createModifiedEntity, getModifierEffect, ModifierSystem } from './modifiers';

describe('Modifier System', () => {
  describe('ALL_MODIFIERS constant', () => {
    it('should contain all 12 modifiers', () => {
      expect(ALL_MODIFIERS).toHaveLength(12);
      expect(ALL_MODIFIERS).toContain('observed');
      expect(ALL_MODIFIERS).toContain('unseen');
      expect(ALL_MODIFIERS).toContain('recursive');
      expect(ALL_MODIFIERS).toContain('bureaucratic');
      expect(ALL_MODIFIERS).toContain('mythic');
      expect(ALL_MODIFIERS).toContain('simulacrum');
      expect(ALL_MODIFIERS).toContain('apophenic');
      expect(ALL_MODIFIERS).toContain('entropy');
      expect(ALL_MODIFIERS).toContain('koan');
      expect(ALL_MODIFIERS).toContain('labyrinthine');
      expect(ALL_MODIFIERS).toContain('liturgical');
      expect(ALL_MODIFIERS).toContain('incompleteness');
    });
  });

  describe('getModifierEffect', () => {
    it('should return effect definition for observed', () => {
      const effect = getModifierEffect('observed');
      expect(effect).toBeDefined();
      expect(effect.id).toBe('observed');
      expect(effect.eyeTrackingReady).toBe(true);
      expect(effect.specialEffect).toBe('gaze_activate');
    });

    it('should return effect definition for unseen', () => {
      const effect = getModifierEffect('unseen');
      expect(effect).toBeDefined();
      expect(effect.id).toBe('unseen');
      expect(effect.eyeTrackingReady).toBe(true);
      expect(effect.specialEffect).toBe('gaze_invulnerable');
    });

    it('should return effect definition for recursive', () => {
      const effect = getModifierEffect('recursive');
      expect(effect).toBeDefined();
      expect(effect.id).toBe('recursive');
      expect(effect.specialEffect).toBe('death_respawn');
    });

    it('should return effect definition for bureaucratic', () => {
      const effect = getModifierEffect('bureaucratic');
      expect(effect).toBeDefined();
      expect(effect.id).toBe('bureaucratic');
      expect(effect.specialEffect).toBe('sequence_required');
    });

    it('should return effect definition for mythic', () => {
      const effect = getModifierEffect('mythic');
      expect(effect).toBeDefined();
      expect(effect.id).toBe('mythic');
      expect(effect.specialEffect).toBe('fate_shield');
      expect(effect.hpMod).toBeGreaterThan(1); // Tankier
    });

    it('should return effect definition for simulacrum', () => {
      const effect = getModifierEffect('simulacrum');
      expect(effect).toBeDefined();
      expect(effect.id).toBe('simulacrum');
      expect(effect.specialEffect).toBe('vanish_on_hit');
      expect(effect.hpMod).toBeLessThan(1); // Very low HP
    });

    it('should return effect definition for apophenic', () => {
      const effect = getModifierEffect('apophenic');
      expect(effect).toBeDefined();
      expect(effect.id).toBe('apophenic');
      expect(effect.specialEffect).toBe('pattern_trap');
    });

    it('should return effect definition for entropy', () => {
      const effect = getModifierEffect('entropy');
      expect(effect).toBeDefined();
      expect(effect.id).toBe('entropy');
      expect(effect.specialEffect).toBe('accelerating_shots');
    });

    it('should return effect definition for koan', () => {
      const effect = getModifierEffect('koan');
      expect(effect).toBeDefined();
      expect(effect.id).toBe('koan');
      expect(effect.specialEffect).toBe('paradox_defeat');
    });

    it('should return effect definition for labyrinthine', () => {
      const effect = getModifierEffect('labyrinthine');
      expect(effect).toBeDefined();
      expect(effect.id).toBe('labyrinthine');
      expect(effect.specialEffect).toBe('wall_emerge');
    });

    it('should return effect definition for liturgical', () => {
      const effect = getModifierEffect('liturgical');
      expect(effect).toBeDefined();
      expect(effect.id).toBe('liturgical');
      expect(effect.specialEffect).toBe('rhythm_sync');
    });

    it('should return effect definition for incompleteness', () => {
      const effect = getModifierEffect('incompleteness');
      expect(effect).toBeDefined();
      expect(effect.id).toBe('incompleteness');
      expect(effect.specialEffect).toBe('unkillable');
      expect(effect.hpMod).toBeGreaterThan(100); // Essentially unkillable
    });
  });

  describe('applyModifier', () => {
    it('should apply modifier to archetype entity', () => {
      const baseEntity = createArchetypeEntity('drifter', 100, 50);
      const modified = applyModifier(baseEntity, 'observed');
      expect(modified).toBeDefined();
      expect(modified.modifiers).toContain('observed');
    });

    it('should apply multiple modifiers', () => {
      const baseEntity = createArchetypeEntity('drifter', 100, 50);
      let modified = applyModifier(baseEntity, 'observed');
      modified = applyModifier(modified, 'recursive');
      expect(modified.modifiers).toContain('observed');
      expect(modified.modifiers).toContain('recursive');
    });

    it('should modify HP based on modifier', () => {
      const baseEntity = createArchetypeEntity('drifter', 100, 50);
      const baseHp = baseEntity.hp;
      const mythic = applyModifier(baseEntity, 'mythic');
      expect(mythic.hp).toBeGreaterThan(baseHp);
    });

    it('should modify speed based on modifier', () => {
      const baseEntity = createArchetypeEntity('chaser', 100, 50);
      const baseSpeed = baseEntity.speed;
      const bureaucratic = applyModifier(baseEntity, 'bureaucratic');
      expect(bureaucratic.speed).toBeLessThan(baseSpeed);
    });
  });

  describe('createModifiedEntity', () => {
    it('should create entity with archetype and modifiers', () => {
      const entity = createModifiedEntity('drifter', ['observed', 'recursive'], 100, 50);
      expect(entity.archetype).toBe('drifter');
      expect(entity.modifiers).toContain('observed');
      expect(entity.modifiers).toContain('recursive');
    });
  });

  describe('ModifiedEntity', () => {
    describe('Observed Modifier', () => {
      it('should be dormant when not observed', () => {
        const entity = createModifiedEntity('drifter', ['observed'], 400, 100);
        entity.setGazeState(false);
        const initialY = entity.y;
        entity.update(1, 400, 500);
        // Should not move when not observed
        expect(entity.y).toBe(initialY);
      });

      it('should wake when observed', () => {
        const entity = createModifiedEntity('drifter', ['observed'], 400, 100);
        entity.setGazeState(true);
        const initialY = entity.y;
        entity.update(1, 400, 500);
        // Should move when observed
        expect(entity.y).toBeGreaterThan(initialY);
      });

      it('should have visual indicator for dormant state', () => {
        const entity = createModifiedEntity('drifter', ['observed'], 400, 100);
        entity.setGazeState(false);
        expect(entity.getVisualState().dormant).toBe(true);
      });
    });

    describe('Unseen Modifier', () => {
      it('should be invulnerable when observed', () => {
        const entity = createModifiedEntity('drifter', ['unseen'], 400, 100);
        entity.setGazeState(true);
        const initialHp = entity.hp;
        entity.takeDamage(1);
        expect(entity.hp).toBe(initialHp); // No damage
      });

      it('should be vulnerable when not observed', () => {
        const entity = createModifiedEntity('drifter', ['unseen'], 400, 100);
        entity.setGazeState(false);
        const initialHp = entity.hp;
        entity.takeDamage(1);
        expect(entity.hp).toBe(initialHp - 1);
      });

      it('should have visual fade when observed', () => {
        const entity = createModifiedEntity('drifter', ['unseen'], 400, 100);
        entity.setGazeState(true);
        expect(entity.getVisualState().faded).toBe(true);
      });
    });

    describe('Recursive Modifier', () => {
      it('should spawn weaker copy on death', () => {
        const entity = createModifiedEntity('drifter', ['recursive'], 400, 100);
        const spawnCallback = vi.fn();
        entity.onRecursiveSpawn(spawnCallback);
        entity.takeDamage(entity.hp);
        expect(spawnCallback).toHaveBeenCalled();
      });

      it('should spawn copy with reduced HP', () => {
        const entity = createModifiedEntity('drifter', ['recursive'], 400, 100);
        let spawnedHp = 0;
        entity.onRecursiveSpawn((hp) => {
          spawnedHp = hp;
        });
        entity.takeDamage(entity.hp);
        expect(spawnedHp).toBeLessThan(entity.maxHp);
      });

      it('should not spawn if already a recursive spawn', () => {
        const entity = createModifiedEntity('drifter', ['recursive'], 400, 100, { isRecursiveSpawn: true });
        const spawnCallback = vi.fn();
        entity.onRecursiveSpawn(spawnCallback);
        entity.takeDamage(entity.hp);
        expect(spawnCallback).not.toHaveBeenCalled();
      });
    });

    describe('Bureaucratic Modifier', () => {
      it('should have sequence symbols', () => {
        const entity = createModifiedEntity('drifter', ['bureaucratic'], 400, 100);
        const symbols = entity.getSequenceSymbols();
        expect(symbols.length).toBeGreaterThan(0);
      });

      it('should only take damage when hit in sequence', () => {
        const entity = createModifiedEntity('drifter', ['bureaucratic'], 400, 100);
        const symbols = entity.getSequenceSymbols();
        const initialHp = entity.hp;

        // Hit with wrong symbol
        entity.takeDamageWithSymbol(1, 'wrong_symbol');
        expect(entity.hp).toBe(initialHp);

        // Hit with correct symbol
        entity.takeDamageWithSymbol(1, symbols[0]);
        expect(entity.hp).toBe(initialHp - 1);
      });

      it('should advance sequence on correct hit', () => {
        const entity = createModifiedEntity('drifter', ['bureaucratic'], 400, 100);
        const symbols = entity.getSequenceSymbols();

        entity.takeDamageWithSymbol(1, symbols[0]);
        expect(entity.getCurrentSymbolIndex()).toBe(1);
      });
    });

    describe('Mythic Modifier', () => {
      it('should have fate shield initially', () => {
        const entity = createModifiedEntity('drifter', ['mythic'], 400, 100);
        expect(entity.hasFateShield()).toBe(true);
      });

      it('should block first hit with fate shield', () => {
        const entity = createModifiedEntity('drifter', ['mythic'], 400, 100);
        const initialHp = entity.hp;
        entity.takeDamage(1);
        expect(entity.hp).toBe(initialHp);
        expect(entity.hasFateShield()).toBe(false);
      });

      it('should take damage after fate shield broken', () => {
        const entity = createModifiedEntity('drifter', ['mythic'], 400, 100);
        entity.takeDamage(1); // Break shield
        const hpAfterShield = entity.hp;
        entity.takeDamage(1);
        expect(entity.hp).toBe(hpAfterShield - 1);
      });

      it('should have prophecy condition', () => {
        const entity = createModifiedEntity('drifter', ['mythic'], 400, 100);
        expect(entity.getProphecyCondition()).toBeDefined();
      });
    });

    describe('Simulacrum Modifier', () => {
      it('should vanish on any hit', () => {
        const entity = createModifiedEntity('drifter', ['simulacrum'], 400, 100);
        entity.takeDamage(1);
        expect(entity.isDead).toBe(true);
      });

      it('should not give score when vanishing', () => {
        const entity = createModifiedEntity('drifter', ['simulacrum'], 400, 100);
        expect(entity.givesScore()).toBe(false);
      });

      it('should have translucent visual', () => {
        const entity = createModifiedEntity('drifter', ['simulacrum'], 400, 100);
        expect(entity.getVisualState().translucent).toBe(true);
      });
    });

    describe('Apophenic Modifier', () => {
      it('should spawn trap patterns', () => {
        const entity = createModifiedEntity('drifter', ['apophenic'], 400, 100);
        entity.update(2, 400, 500);
        const traps = entity.getTrapPatterns();
        expect(traps.length).toBeGreaterThan(0);
      });

      it('should create patterns that look meaningful', () => {
        const entity = createModifiedEntity('drifter', ['apophenic'], 400, 100);
        entity.update(2, 400, 500);
        const traps = entity.getTrapPatterns();
        // Traps should have pattern type
        expect(traps[0].patternType).toBeDefined();
      });
    });

    describe('Entropy Modifier', () => {
      it('should accelerate projectiles over time', () => {
        const entity = createModifiedEntity('sniper', ['entropy'], 400, 100);
        entity.update(2, 400, 500);
        const projectiles = entity.getProjectiles();
        if (projectiles.length > 0) {
          const initialSpeed = Math.sqrt(projectiles[0].vx ** 2 + projectiles[0].vy ** 2);
          entity.update(1, 400, 500);
          const finalSpeed = Math.sqrt(projectiles[0].vx ** 2 + projectiles[0].vy ** 2);
          expect(finalSpeed).toBeGreaterThan(initialSpeed);
        }
      });

      it('should have decay visual effect', () => {
        const entity = createModifiedEntity('drifter', ['entropy'], 400, 100);
        expect(entity.getVisualState().decaying).toBe(true);
      });
    });

    describe('Koan Modifier', () => {
      it('should be defeated by wrong action', () => {
        const entity = createModifiedEntity('drifter', ['koan'], 400, 100);
        // Normal attack should not work
        entity.takeDamage(1);
        expect(entity.isDead).toBe(false);

        // "Wrong" action defeats it
        entity.performWrongAction();
        expect(entity.isDead).toBe(true);
      });

      it('should have zen visual', () => {
        const entity = createModifiedEntity('drifter', ['koan'], 400, 100);
        expect(entity.getVisualState().zenCircle).toBe(true);
      });
    });

    describe('Labyrinthine Modifier', () => {
      it('should emerge from walls', () => {
        const entity = createModifiedEntity('drifter', ['labyrinthine'], 400, 100);
        entity.setWallPosition(0, 100); // Left wall
        expect(entity.x).toBe(0);
        entity.update(1, 400, 500);
        // Should emerge from wall
        expect(entity.x).toBeGreaterThan(0);
      });

      it('should have maze pattern visual', () => {
        const entity = createModifiedEntity('drifter', ['labyrinthine'], 400, 100);
        expect(entity.getVisualState().mazePattern).toBe(true);
      });
    });

    describe('Liturgical Modifier', () => {
      it('should sync to rhythm', () => {
        const entity = createModifiedEntity('drifter', ['liturgical'], 400, 100);
        entity.setRhythm(120); // 120 BPM
        expect(entity.getRhythmBPM()).toBe(120);
      });

      it('should move on beat', () => {
        const entity = createModifiedEntity('drifter', ['liturgical'], 400, 100);
        entity.setRhythm(60); // 60 BPM = 1 beat per second

        // Off beat - should not move much
        entity.update(0.25, 400, 500);
        const offBeatY = entity.y;

        // On beat - should move
        entity.update(0.75, 400, 500); // Now at 1 second
        expect(entity.y).toBeGreaterThan(offBeatY);
      });

      it('should have musical notation visual', () => {
        const entity = createModifiedEntity('drifter', ['liturgical'], 400, 100);
        expect(entity.getVisualState().musicalNotation).toBe(true);
      });
    });

    describe('Incompleteness Modifier', () => {
      it('should not be fully defeatable', () => {
        const entity = createModifiedEntity('drifter', ['incompleteness'], 400, 100);
        entity.takeDamage(9999);
        expect(entity.isDead).toBe(false);
        expect(entity.hp).toBeGreaterThan(0);
      });

      it('should require escape to complete', () => {
        const entity = createModifiedEntity('drifter', ['incompleteness'], 400, 100);
        expect(entity.requiresEscape()).toBe(true);
      });

      it('should have infinite symbol visual', () => {
        const entity = createModifiedEntity('drifter', ['incompleteness'], 400, 100);
        expect(entity.getVisualState().infiniteSymbol).toBe(true);
      });
    });
  });

  describe('ModifierSystem', () => {
    let system: ModifierSystem;

    beforeEach(() => {
      system = new ModifierSystem();
    });

    describe('Entity Management', () => {
      it('should spawn modified entity', () => {
        const entity = system.spawn('drifter', ['observed'], 100, 50);
        expect(entity).toBeDefined();
        expect(system.getEntities()).toContain(entity);
      });

      it('should spawn entity with multiple modifiers', () => {
        const entity = system.spawn('chaser', ['observed', 'recursive'], 100, 50);
        expect(entity.modifiers).toHaveLength(2);
      });

      it('should update all entities', () => {
        const entity = system.spawn('drifter', [], 100, 0);
        const initialY = entity.y;
        system.update(1, 400, 500);
        expect(entity.y).toBeGreaterThan(initialY);
      });

      it('should remove dead entities', () => {
        const entity = system.spawn('drifter', [], 100, 50);
        entity.takeDamage(entity.hp);
        system.update(0.1, 400, 500);
        expect(system.getEntities()).not.toContain(entity);
      });

      it('should clear all entities', () => {
        system.spawn('drifter', [], 100, 50);
        system.spawn('chaser', [], 200, 50);
        system.clear();
        expect(system.getEntities()).toHaveLength(0);
      });
    });

    describe('Gaze State Management', () => {
      it('should update gaze state for all entities', () => {
        const entity1 = system.spawn('drifter', ['observed'], 100, 50);
        const entity2 = system.spawn('drifter', ['unseen'], 400, 50);

        system.setGazePosition(100, 50, 50); // Gaze directly on entity1

        // entity1 should be observed
        expect(entity1.isBeingObserved()).toBe(true);
        // entity2 should not be observed (too far away)
        expect(entity2.isBeingObserved()).toBe(false);
      });
    });

    describe('Rhythm Sync', () => {
      it('should sync all liturgical entities to rhythm', () => {
        const entity1 = system.spawn('drifter', ['liturgical'], 100, 50);
        const entity2 = system.spawn('drifter', ['liturgical'], 200, 50);

        system.setGlobalRhythm(120);

        expect(entity1.getRhythmBPM()).toBe(120);
        expect(entity2.getRhythmBPM()).toBe(120);
      });
    });

    describe('Recursive Spawn Handling', () => {
      it('should handle recursive spawns', () => {
        const entity = system.spawn('drifter', ['recursive'], 400, 100);
        entity.takeDamage(entity.hp);
        system.update(0.1, 400, 500);

        // Should have spawned a weaker copy
        const entities = system.getEntities();
        expect(entities.length).toBeGreaterThanOrEqual(1);
      });
    });

    describe('Statistics', () => {
      it('should track entities by modifier', () => {
        system.spawn('drifter', ['observed'], 100, 50);
        system.spawn('drifter', ['observed', 'recursive'], 200, 50);
        system.spawn('chaser', ['unseen'], 300, 50);

        expect(system.getCountByModifier('observed')).toBe(2);
        expect(system.getCountByModifier('unseen')).toBe(1);
        expect(system.getCountByModifier('recursive')).toBe(1);
      });
    });
  });
});
