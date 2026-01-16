/**
 * Entity System Tests
 * 
 * Tests for the Entity class and EntityPool management.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Entity, EntityPool } from './entity';

describe('Entity', () => {
  describe('Construction', () => {
    it('should create entity with position', () => {
      const entity = new Entity(100, 200);
      
      expect(entity.transform.x).toBe(100);
      expect(entity.transform.y).toBe(200);
    });
    
    it('should have unique IDs', () => {
      const e1 = new Entity(0, 0);
      const e2 = new Entity(0, 0);
      const e3 = new Entity(0, 0);
      
      expect(e1.id).not.toBe(e2.id);
      expect(e2.id).not.toBe(e3.id);
      expect(e1.id).not.toBe(e3.id);
    });
    
    it('should default to neutral faction', () => {
      const entity = new Entity(0, 0);
      expect(entity.faction).toBe('neutral');
    });
    
    it('should accept custom faction', () => {
      const player = new Entity(0, 0, 'player');
      const enemy = new Entity(0, 0, 'enemy');
      
      expect(player.faction).toBe('player');
      expect(enemy.faction).toBe('enemy');
    });
    
    it('should accept initial tags', () => {
      const entity = new Entity(0, 0, 'enemy', ['boss', 'tier4']);
      
      expect(entity.hasTag('boss')).toBe(true);
      expect(entity.hasTag('tier4')).toBe(true);
      expect(entity.hasTag('minion')).toBe(false);
    });
    
    it('should start as active', () => {
      const entity = new Entity(0, 0);
      expect(entity.active).toBe(true);
    });
    
    it('should initialize transform with zero velocity', () => {
      const entity = new Entity(50, 100);
      
      expect(entity.transform.vx).toBe(0);
      expect(entity.transform.vy).toBe(0);
      expect(entity.transform.rotation).toBe(0);
      expect(entity.transform.lane).toBe(0);
    });
  });
  
  describe('Components', () => {
    let entity: Entity;
    
    beforeEach(() => {
      entity = new Entity(0, 0);
    });
    
    it('should set renderable component', () => {
      entity.setRenderable({
        type: 'circle',
        color: '#ff0000',
        radius: 20,
      });
      
      expect(entity.renderable).toBeDefined();
      expect(entity.renderable!.type).toBe('circle');
      expect(entity.renderable!.color).toBe('#ff0000');
      expect(entity.renderable!.radius).toBe(20);
    });
    
    it('should set collider component', () => {
      entity.setCollider({
        type: 'circle',
        radius: 15,
      });
      
      expect(entity.collider).toBeDefined();
      expect(entity.collider!.type).toBe('circle');
      expect(entity.collider!.radius).toBe(15);
    });
    
    it('should set health component', () => {
      entity.setHealth(100);
      
      expect(entity.health).toBeDefined();
      expect(entity.health!.max).toBe(100);
      expect(entity.health!.current).toBe(100);
      expect(entity.health!.invulnerable).toBe(false);
    });
    
    it('should set health with custom current value', () => {
      entity.setHealth(100, 50);
      
      expect(entity.health!.max).toBe(100);
      expect(entity.health!.current).toBe(50);
    });
    
    it('should chain component setters', () => {
      entity
        .setRenderable({ type: 'circle', color: '#fff' })
        .setCollider({ type: 'circle', radius: 10 })
        .setHealth(50)
        .setVelocity(100, -50);
      
      expect(entity.renderable).toBeDefined();
      expect(entity.collider).toBeDefined();
      expect(entity.health).toBeDefined();
      expect(entity.transform.vx).toBe(100);
      expect(entity.transform.vy).toBe(-50);
    });
  });
  
  describe('Tags', () => {
    let entity: Entity;
    
    beforeEach(() => {
      entity = new Entity(0, 0);
    });
    
    it('should add tags', () => {
      entity.addTag('flying');
      expect(entity.hasTag('flying')).toBe(true);
    });
    
    it('should remove tags', () => {
      entity.addTag('poisoned');
      expect(entity.hasTag('poisoned')).toBe(true);
      
      entity.removeTag('poisoned');
      expect(entity.hasTag('poisoned')).toBe(false);
    });
    
    it('should handle multiple tags', () => {
      entity.addTag('boss').addTag('phase2').addTag('enraged');
      
      expect(entity.hasTag('boss')).toBe(true);
      expect(entity.hasTag('phase2')).toBe(true);
      expect(entity.hasTag('enraged')).toBe(true);
    });
  });
  
  describe('Custom Data', () => {
    let entity: Entity;
    
    beforeEach(() => {
      entity = new Entity(0, 0);
    });
    
    it('should store and retrieve data', () => {
      entity.setData('spawnTime', 12345);
      expect(entity.getData<number>('spawnTime')).toBe(12345);
    });
    
    it('should return default value for missing data', () => {
      expect(entity.getData('missing', 'default')).toBe('default');
    });
    
    it('should store complex data', () => {
      const pattern = { type: 'sine', amplitude: 50, frequency: 2 };
      entity.setData('movementPattern', pattern);
      
      const retrieved = entity.getData<typeof pattern>('movementPattern');
      expect(retrieved).toEqual(pattern);
    });
  });
  
  describe('Lifecycle', () => {
    it('should mark entity as inactive on destroy', () => {
      const entity = new Entity(0, 0);
      expect(entity.active).toBe(true);
      
      entity.destroy();
      expect(entity.active).toBe(false);
    });
    
    it('isAlive should check health when present', () => {
      const entity = new Entity(0, 0);
      entity.setHealth(100);
      
      expect(entity.isAlive()).toBe(true);
      
      entity.health!.current = 0;
      expect(entity.isAlive()).toBe(false);
    });
    
    it('isAlive should check active when no health', () => {
      const entity = new Entity(0, 0);
      
      expect(entity.isAlive()).toBe(true);
      
      entity.destroy();
      expect(entity.isAlive()).toBe(false);
    });
  });
  
  describe('Damage System', () => {
    let entity: Entity;
    
    beforeEach(() => {
      entity = new Entity(0, 0);
      entity.setHealth(100);
    });
    
    it('should take damage', () => {
      entity.takeDamage(30);
      expect(entity.health!.current).toBe(70);
    });
    
    it('should return true when killed', () => {
      const killed = entity.takeDamage(100);
      expect(killed).toBe(true);
      expect(entity.health!.current).toBe(0);
    });
    
    it('should return false when still alive', () => {
      const killed = entity.takeDamage(50);
      expect(killed).toBe(false);
      expect(entity.health!.current).toBe(50);
    });
    
    it('should not go below 0', () => {
      entity.takeDamage(150);
      expect(entity.health!.current).toBe(0);
    });
    
    it('should not take damage when invulnerable', () => {
      entity.setInvulnerable(1.0);
      
      const killed = entity.takeDamage(100);
      expect(killed).toBe(false);
      expect(entity.health!.current).toBe(100);
    });
    
    it('should heal', () => {
      entity.takeDamage(50);
      entity.heal(20);
      expect(entity.health!.current).toBe(70);
    });
    
    it('should not heal above max', () => {
      entity.heal(50);
      expect(entity.health!.current).toBe(100);
    });
    
    it('should set invulnerability with duration', () => {
      entity.setInvulnerable(2.0);
      
      expect(entity.health!.invulnerable).toBe(true);
      expect(entity.health!.invulnerableTime).toBe(2.0);
    });
  });
  
  describe('Position Helpers', () => {
    it('should get center for circle entity', () => {
      const entity = new Entity(100, 200);
      entity.setRenderable({ type: 'circle', color: '#fff', radius: 20 });
      
      const center = entity.getCenter();
      expect(center.x).toBe(100);
      expect(center.y).toBe(200);
    });
    
    it('should get center for rect entity', () => {
      const entity = new Entity(100, 200);
      entity.setRenderable({ type: 'rect', color: '#fff', width: 50, height: 30 });
      
      const center = entity.getCenter();
      expect(center.x).toBe(125);
      expect(center.y).toBe(215);
    });
    
    it('should calculate distance between entities', () => {
      const e1 = new Entity(0, 0);
      const e2 = new Entity(3, 4); // 3-4-5 triangle
      
      const distance = e1.distanceTo(e2);
      expect(distance).toBe(5);
    });
    
    it('should calculate zero distance for same position', () => {
      const e1 = new Entity(100, 100);
      const e2 = new Entity(100, 100);
      
      expect(e1.distanceTo(e2)).toBe(0);
    });
  });
});

describe('EntityPool', () => {
  let pool: EntityPool;
  
  beforeEach(() => {
    pool = new EntityPool();
  });
  
  describe('Basic Operations', () => {
    it('should add entities', () => {
      const entity = new Entity(0, 0);
      pool.add(entity);
      
      expect(pool.count()).toBe(1);
    });
    
    it('should remove entities', () => {
      const entity = new Entity(0, 0);
      pool.add(entity);
      pool.remove(entity);
      
      expect(pool.count()).toBe(0);
    });
    
    it('should get all entities', () => {
      pool.add(new Entity(0, 0));
      pool.add(new Entity(10, 10));
      pool.add(new Entity(20, 20));
      
      expect(pool.getAll().length).toBe(3);
    });
    
    it('should clear all entities', () => {
      pool.add(new Entity(0, 0));
      pool.add(new Entity(10, 10));
      
      pool.clear();
      
      expect(pool.count()).toBe(0);
    });
  });
  
  describe('Filtering', () => {
    beforeEach(() => {
      const player = new Entity(0, 0, 'player', ['hero']);
      const enemy1 = new Entity(10, 10, 'enemy', ['tier1']);
      const enemy2 = new Entity(20, 20, 'enemy', ['tier2', 'boss']);
      const projectile = new Entity(30, 30, 'projectile');
      
      pool.add(player);
      pool.add(enemy1);
      pool.add(enemy2);
      pool.add(projectile);
    });
    
    it('should get active entities only', () => {
      const all = pool.getAll();
      all[1].destroy(); // Destroy enemy1
      
      expect(pool.getActive().length).toBe(3);
    });
    
    it('should filter by faction', () => {
      const enemies = pool.getByFaction('enemy');
      expect(enemies.length).toBe(2);
    });
    
    it('should filter by tag', () => {
      const bosses = pool.getByTag('boss');
      expect(bosses.length).toBe(1);
    });
    
    it('should find by ID', () => {
      const all = pool.getAll();
      const found = pool.getById(all[0].id);
      
      expect(found).toBeDefined();
      expect(found!.faction).toBe('player');
    });
    
    it('should return undefined for non-existent ID', () => {
      const found = pool.getById(99999);
      expect(found).toBeUndefined();
    });
  });
  
  describe('Cleanup', () => {
    it('should remove inactive entities on cleanup', () => {
      const e1 = new Entity(0, 0);
      const e2 = new Entity(10, 10);
      const e3 = new Entity(20, 20);
      
      pool.add(e1);
      pool.add(e2);
      pool.add(e3);
      
      e1.destroy();
      e3.destroy();
      
      expect(pool.count()).toBe(3);
      
      pool.cleanup();
      
      expect(pool.count()).toBe(1);
      expect(pool.getAll()[0]).toBe(e2);
    });
    
    it('should report correct active count', () => {
      pool.add(new Entity(0, 0));
      pool.add(new Entity(10, 10));
      
      const inactive = new Entity(20, 20);
      inactive.destroy();
      pool.add(inactive);
      
      expect(pool.count()).toBe(3);
      expect(pool.activeCount()).toBe(2);
    });
  });
});
