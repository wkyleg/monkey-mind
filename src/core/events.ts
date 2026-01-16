/**
 * Event emitter system for game events
 */

export type EventCallback<T = unknown> = (data: T) => void;

export interface GameEvents {
  // Game flow
  'game:start': { mode: 'campaign' | 'endless' };
  'game:pause': void;
  'game:resume': void;
  'game:over': { score: number; sector: string; cause: string };
  'game:complete': { score: number };
  
  // Player
  'player:damage': { amount: number; remaining: number };
  'player:heal': { amount: number; current: number };
  'player:death': void;
  'player:lane_change': { from: number; to: number };
  
  // Combat
  'enemy:spawn': { id: string; type: string };
  'enemy:damage': { id: string; amount: number };
  'enemy:death': { id: string; type: string; position: { x: number; y: number } };
  'boss:start': { bossId: string };
  'boss:phase': { id: string; phase: number };
  'boss:defeat': { id: string };
  'boss:defeated': { bossId: string };
  'boss:summon': { count: number };
  'projectile:fire': { type: string };
  'projectile:hit': { targetType: string };
  'weapon:fire': void;
  
  // Powerups
  'powerup:spawn': { id: string; type: string };
  'powerup:collect': { type: string; effect: string };
  'powerup:expire': { type: string };
  
  // Drops
  'drop:spawn': { type: string; x: number; y: number };
  'drop:collect': { type: string; value?: number; duration?: number };
  'upgrade:expire': { type: string };
  
  // Progression
  'wave:start': { waveId: string; number: number };
  'wave:complete': { waveId: string };
  'level:complete': { levelId: string; score: number };
  'sector:complete': { sectorId: string; score: number };
  
  // Meta
  'achievement:unlock': { id: string; name: string };
  'codex:unlock': { id: string; category: string };
  'cosmetic:unlock': { id: string; type: string };
  
  // Score
  'score:add': { amount: number; reason: string };
  'combo:increase': { count: number };
  'combo:break': { finalCount: number };
  
  // Audio
  'audio:play_sfx': { id: string; volume?: number };
  'audio:play_music': { id: string; crossfade?: boolean };
  'audio:stop_music': void;
  
  // State (for BCI integration later)
  'state:calm': { level: number };
  'state:arousal': { level: number };
}

class EventEmitter {
  private listeners: Map<string, Set<EventCallback<unknown>>> = new Map();
  private onceListeners: Map<string, Set<EventCallback<unknown>>> = new Map();
  
  /**
   * Subscribe to an event
   */
  on<K extends keyof GameEvents>(
    event: K,
    callback: EventCallback<GameEvents[K]>
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as EventCallback<unknown>);
    
    // Return unsubscribe function
    return () => this.off(event, callback);
  }
  
  /**
   * Subscribe to an event once
   */
  once<K extends keyof GameEvents>(
    event: K,
    callback: EventCallback<GameEvents[K]>
  ): void {
    if (!this.onceListeners.has(event)) {
      this.onceListeners.set(event, new Set());
    }
    this.onceListeners.get(event)!.add(callback as EventCallback<unknown>);
  }
  
  /**
   * Unsubscribe from an event
   */
  off<K extends keyof GameEvents>(
    event: K,
    callback: EventCallback<GameEvents[K]>
  ): void {
    this.listeners.get(event)?.delete(callback as EventCallback<unknown>);
    this.onceListeners.get(event)?.delete(callback as EventCallback<unknown>);
  }
  
  /**
   * Emit an event
   */
  emit<K extends keyof GameEvents>(
    event: K,
    data: GameEvents[K]
  ): void {
    // Regular listeners
    this.listeners.get(event)?.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in event handler for ${event}:`, error);
      }
    });
    
    // Once listeners
    const onceSet = this.onceListeners.get(event);
    if (onceSet) {
      onceSet.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in once handler for ${event}:`, error);
        }
      });
      onceSet.clear();
    }
  }
  
  /**
   * Remove all listeners for an event
   */
  removeAllListeners(event?: keyof GameEvents): void {
    if (event) {
      this.listeners.delete(event);
      this.onceListeners.delete(event);
    } else {
      this.listeners.clear();
      this.onceListeners.clear();
    }
  }
  
  /**
   * Get listener count for an event
   */
  listenerCount(event: keyof GameEvents): number {
    return (this.listeners.get(event)?.size ?? 0) +
           (this.onceListeners.get(event)?.size ?? 0);
  }
}

// Global event emitter instance
export const events = new EventEmitter();
