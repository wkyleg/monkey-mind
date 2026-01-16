/**
 * Player System Tests
 * 
 * Tests for player movement, health, and intent processing.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Player } from './player';
import { PlayerIntent } from '../engine/input';
import { events } from '../core/events';
import { CONFIG } from '../config';

// Mock events
vi.mock('../core/events', () => ({
  events: {
    emit: vi.fn(),
    on: vi.fn(() => () => {}),
    off: vi.fn(),
  },
}));

// Helper to create neutral intent
const neutralIntent = (): PlayerIntent => ({
  moveAxis: 0,
  menuAxis: 0,
  confirm: false,
  cancel: false,
  calm: null,
  arousal: null,
});

describe('Player', () => {
  const screenWidth = 800;
  const screenHeight = 600;
  const laneCount = CONFIG.LANES;
  
  let player: Player;
  
  beforeEach(() => {
    vi.clearAllMocks();
    player = new Player(screenWidth, screenHeight, laneCount);
  });
  
  describe('Construction', () => {
    it('should start in center lane', () => {
      const centerLane = Math.floor(laneCount / 2);
      expect(player.targetLane).toBe(centerLane);
    });
    
    it('should have player faction', () => {
      expect(player.faction).toBe('player');
    });
    
    it('should have player tag', () => {
      expect(player.hasTag('player')).toBe(true);
    });
    
    it('should have health', () => {
      expect(player.health).toBeDefined();
      expect(player.health!.current).toBe(3);
      expect(player.health!.max).toBe(3);
    });
    
    it('should have collider', () => {
      expect(player.collider).toBeDefined();
      expect(player.collider!.type).toBe('circle');
    });
    
    it('should position at correct Y based on config', () => {
      const expectedY = screenHeight * CONFIG.PLAYER_Y_POSITION;
      expect(player.transform.y).toBe(expectedY);
    });
  });
  
  describe('Lane Movement', () => {
    it('should move left on negative moveAxis', () => {
      const initialLane = player.targetLane;
      
      const intent = { ...neutralIntent(), moveAxis: -1 };
      player.updateFromIntent(intent, 0.1);
      
      expect(player.targetLane).toBe(initialLane - 1);
    });
    
    it('should move right on positive moveAxis', () => {
      const initialLane = player.targetLane;
      
      const intent = { ...neutralIntent(), moveAxis: 1 };
      player.updateFromIntent(intent, 0.1);
      
      expect(player.targetLane).toBe(initialLane + 1);
    });
    
    it('should not move past leftmost lane', () => {
      // Move to leftmost
      player.targetLane = 0;
      
      const intent = { ...neutralIntent(), moveAxis: -1 };
      player.updateFromIntent(intent, 0.1);
      
      expect(player.targetLane).toBe(0);
    });
    
    it('should not move past rightmost lane', () => {
      // Move to rightmost
      player.targetLane = laneCount - 1;
      
      const intent = { ...neutralIntent(), moveAxis: 1 };
      player.updateFromIntent(intent, 0.1);
      
      expect(player.targetLane).toBe(laneCount - 1);
    });
    
    it('should emit lane_change event', () => {
      const initialLane = player.targetLane;
      
      const intent = { ...neutralIntent(), moveAxis: 1 };
      player.updateFromIntent(intent, 0.1);
      
      expect(events.emit).toHaveBeenCalledWith('player:lane_change', {
        from: initialLane,
        to: initialLane + 1,
      });
    });
    
    it('should respect lane switch cooldown', () => {
      const initialLane = player.targetLane;
      
      // First move
      const intent = { ...neutralIntent(), moveAxis: 1 };
      player.updateFromIntent(intent, 0.01); // Very short dt
      
      expect(player.targetLane).toBe(initialLane + 1);
      
      // Immediate second move should be blocked
      player.updateFromIntent(intent, 0.01);
      expect(player.targetLane).toBe(initialLane + 1); // Still same lane
    });
    
    it('should allow move after cooldown expires', () => {
      const initialLane = player.targetLane;
      
      const intent = { ...neutralIntent(), moveAxis: 1 };
      
      // First move
      player.updateFromIntent(intent, 0.01);
      expect(player.targetLane).toBe(initialLane + 1);
      
      // Wait for cooldown (with continuous held input)
      player.updateFromIntent(intent, 0.2); // More than cooldown
      expect(player.targetLane).toBe(initialLane + 2);
    });
    
    it('should smoothly interpolate position', () => {
      // Move right
      const intent = { ...neutralIntent(), moveAxis: 1 };
      player.updateFromIntent(intent, 0.01);
      
      // Position should not instantly snap to target
      const targetX = player.getLaneX(player.targetLane);
      expect(player.transform.x).not.toBe(targetX);
      
      // After several updates, should get closer
      for (let i = 0; i < 60; i++) {
        player.updateFromIntent(neutralIntent(), 1/60);
      }
      
      // Should be close to target (exponential smoothing)
      expect(Math.abs(player.transform.x - targetX)).toBeLessThan(1);
    });
  });
  
  describe('Fire System', () => {
    it('should start unable to fire (timer starts at 0)', () => {
      // Fire timer starts at 0, needs to reach fireRate before firing
      expect(player.canFire()).toBe(false);
    });
    
    it('should allow fire after cooldown completes', () => {
      // Update to fill the fire timer
      player.updateFromIntent(neutralIntent(), CONFIG.BANANA_FIRE_RATE + 0.01);
      
      expect(player.canFire()).toBe(true);
    });
    
    it('should reset timer after firing', () => {
      // Fill timer first
      player.updateFromIntent(neutralIntent(), CONFIG.BANANA_FIRE_RATE + 0.01);
      player.canFire(); // Fires and resets
      
      expect(player.canFire()).toBe(false); // Can't fire immediately
    });
    
    it('should allow fire again after another cooldown', () => {
      // Fill timer and fire
      player.updateFromIntent(neutralIntent(), CONFIG.BANANA_FIRE_RATE + 0.01);
      player.canFire();
      
      // Wait for another cooldown
      player.updateFromIntent(neutralIntent(), CONFIG.BANANA_FIRE_RATE + 0.01);
      
      expect(player.canFire()).toBe(true);
    });
  });
  
  describe('Damage System', () => {
    it('should take damage', () => {
      const initialHealth = player.health!.current;
      
      player.onDamage(1);
      
      expect(player.health!.current).toBe(initialHealth - 1);
    });
    
    it('should emit damage event', () => {
      player.onDamage(1);
      
      expect(events.emit).toHaveBeenCalledWith('player:damage', {
        amount: 1,
        remaining: 2,
      });
    });
    
    it('should emit death event when killed', () => {
      player.health!.current = 1;
      
      player.onDamage(1);
      
      expect(events.emit).toHaveBeenCalledWith('player:death', undefined);
    });
    
    it('should become invulnerable after damage', () => {
      player.onDamage(1);
      
      expect(player.health!.invulnerable).toBe(true);
    });
    
    it('should not take damage when shielded', () => {
      player.setShield(true);
      const initialHealth = player.health!.current;
      
      player.onDamage(1);
      
      expect(player.health!.current).toBe(initialHealth);
    });
    
    it('should heal', () => {
      player.health!.current = 1;
      
      player.heal(1);
      
      expect(player.health!.current).toBe(2);
    });
    
    it('should not heal above max', () => {
      player.heal(10);
      
      expect(player.health!.current).toBe(3);
    });
  });
  
  describe('Invulnerability', () => {
    it('should not take damage while invulnerable', () => {
      player.setInvulnerable(1.0);
      const initialHealth = player.health!.current;
      
      player.takeDamage(1);
      
      expect(player.health!.current).toBe(initialHealth);
    });
    
    it('should expire after duration', () => {
      player.setInvulnerable(0.5);
      
      // Update past duration
      player.updateFromIntent(neutralIntent(), 0.6);
      
      expect(player.health!.invulnerable).toBe(false);
    });
  });
  
  describe('Powerup States', () => {
    it('should toggle shield', () => {
      expect(player.hasShield()).toBe(false);
      
      player.setShield(true);
      expect(player.hasShield()).toBe(true);
      
      player.setShield(false);
      expect(player.hasShield()).toBe(false);
    });
    
    it('should toggle fury', () => {
      expect(player.hasFury()).toBe(false);
      
      player.setFury(true);
      expect(player.hasFury()).toBe(true);
    });
  });
  
  describe('Position Helpers', () => {
    it('should calculate lane X position', () => {
      const laneWidth = screenWidth / (laneCount + 1);
      const leftBound = laneWidth;
      
      expect(player.getLaneX(0)).toBe(leftBound);
      expect(player.getLaneX(1)).toBe(leftBound + laneWidth);
    });
    
    it('should return center position', () => {
      const center = player.getCenter();
      
      expect(center.x).toBe(player.transform.x);
      expect(center.y).toBe(player.transform.y);
    });
  });
  
  describe('Edge-Triggered Input', () => {
    it('should require release before next lane switch', () => {
      const initialLane = player.targetLane;
      
      // Press right
      let intent = { ...neutralIntent(), moveAxis: 1 };
      player.updateFromIntent(intent, 0.01);
      expect(player.targetLane).toBe(initialLane + 1);
      
      // Release
      intent = neutralIntent();
      player.updateFromIntent(intent, 0.01);
      
      // Press right again
      intent = { ...neutralIntent(), moveAxis: 1 };
      player.updateFromIntent(intent, 0.01);
      expect(player.targetLane).toBe(initialLane + 2);
    });
    
    it('should not move on weak input', () => {
      const initialLane = player.targetLane;
      
      // Weak input (less than threshold)
      const intent = { ...neutralIntent(), moveAxis: 0.3 };
      player.updateFromIntent(intent, 0.1);
      
      expect(player.targetLane).toBe(initialLane);
    });
  });
});

describe('Player BCI Integration', () => {
  let player: Player;
  
  beforeEach(() => {
    vi.clearAllMocks();
    player = new Player(800, 600, CONFIG.LANES);
  });
  
  it('should respond to BCI-like movement signals', () => {
    const initialLane = player.targetLane;
    
    // Simulate BCI providing move signal
    const intent: PlayerIntent = {
      moveAxis: 0.8, // Strong right signal
      menuAxis: 0,
      confirm: false,
      cancel: false,
      calm: 0.6,
      arousal: 0.3,
    };
    
    player.updateFromIntent(intent, 0.1);
    
    expect(player.targetLane).toBe(initialLane + 1);
  });
  
  it('should handle BCI calm state (future: could affect shield)', () => {
    // Currently calm/arousal don't directly affect player
    // This test documents the expected integration point
    const intent: PlayerIntent = {
      moveAxis: 0,
      menuAxis: 0,
      confirm: false,
      cancel: false,
      calm: 0.9, // High calm from BCI
      arousal: 0.1,
    };
    
    // Player should still update normally
    player.updateFromIntent(intent, 0.1);
    
    // Future: High calm could trigger shield or defensive abilities
    expect(player.active).toBe(true);
  });
  
  it('should handle BCI arousal state (future: could affect fury)', () => {
    const intent: PlayerIntent = {
      moveAxis: 0,
      menuAxis: 0,
      confirm: false,
      cancel: false,
      calm: 0.2,
      arousal: 0.9, // High arousal from BCI
    };
    
    player.updateFromIntent(intent, 0.1);
    
    // Future: High arousal could trigger fury or offensive abilities
    expect(player.active).toBe(true);
  });
});
