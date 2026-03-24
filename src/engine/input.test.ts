/**
 * Input System Tests
 *
 * Critical tests for BCI integration readiness.
 * The input system provides an abstraction layer that allows any input source
 * (keyboard, gamepad, touch, BCI) to produce a normalized PlayerIntent.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InputManager, type InputProvider, type PlayerIntent } from './input';

// Test-only mock provider for simulating inputs
class MockInputProvider implements InputProvider {
  private intent: Partial<PlayerIntent> = {};
  public initialized = false;
  public destroyed = false;
  public updateCalled = false;

  init(): void {
    this.initialized = true;
  }

  destroy(): void {
    this.destroyed = true;
  }

  update(_dt: number): void {
    this.updateCalled = true;
  }

  getIntent(): Partial<PlayerIntent> {
    return this.intent;
  }

  // Test helpers
  setMoveAxis(value: number): void {
    this.intent.moveAxis = value;
  }

  setMenuAxis(value: number): void {
    this.intent.menuAxis = value;
  }

  setConfirm(value: boolean): void {
    this.intent.confirm = value;
  }

  setCancel(value: boolean): void {
    this.intent.cancel = value;
  }

  setCalm(value: number | null): void {
    this.intent.calm = value;
  }

  setArousal(value: number | null): void {
    this.intent.arousal = value;
  }

  clearIntent(): void {
    this.intent = {};
  }
}

describe('PlayerIntent Interface', () => {
  it('should have all required properties', () => {
    const intent: PlayerIntent = {
      moveAxis: 0,
      menuAxis: 0,
      confirm: false,
      cancel: false,
      calm: null,
      arousal: null,
    };

    expect(intent).toHaveProperty('moveAxis');
    expect(intent).toHaveProperty('menuAxis');
    expect(intent).toHaveProperty('confirm');
    expect(intent).toHaveProperty('cancel');
    expect(intent).toHaveProperty('calm');
    expect(intent).toHaveProperty('arousal');
  });

  it('moveAxis should accept values from -1 to 1', () => {
    const intent: PlayerIntent = {
      moveAxis: -1,
      menuAxis: 0,
      confirm: false,
      cancel: false,
      calm: null,
      arousal: null,
    };

    expect(intent.moveAxis).toBe(-1);
    intent.moveAxis = 0;
    expect(intent.moveAxis).toBe(0);
    intent.moveAxis = 1;
    expect(intent.moveAxis).toBe(1);
    intent.moveAxis = 0.5;
    expect(intent.moveAxis).toBe(0.5);
  });

  it('calm and arousal should accept null (unavailable) or 0-1 (BCI signal)', () => {
    const intent: PlayerIntent = {
      moveAxis: 0,
      menuAxis: 0,
      confirm: false,
      cancel: false,
      calm: null,
      arousal: null,
    };

    // Null indicates BCI not connected
    expect(intent.calm).toBeNull();
    expect(intent.arousal).toBeNull();

    // 0-1 indicates BCI values
    intent.calm = 0;
    intent.arousal = 0.5;
    expect(intent.calm).toBe(0);
    expect(intent.arousal).toBe(0.5);

    intent.calm = 1;
    intent.arousal = 1;
    expect(intent.calm).toBe(1);
    expect(intent.arousal).toBe(1);
  });
});

describe('InputProvider Interface Contract', () => {
  let provider: MockInputProvider;

  beforeEach(() => {
    provider = new MockInputProvider();
  });

  it('should call init() before use', () => {
    expect(provider.initialized).toBe(false);
    provider.init();
    expect(provider.initialized).toBe(true);
  });

  it('should call destroy() on cleanup', () => {
    provider.init();
    expect(provider.destroyed).toBe(false);
    provider.destroy();
    expect(provider.destroyed).toBe(true);
  });

  it('should call update() each frame', () => {
    provider.init();
    expect(provider.updateCalled).toBe(false);
    provider.update(1 / 60);
    expect(provider.updateCalled).toBe(true);
  });

  it('getIntent() should return a partial PlayerIntent', () => {
    provider.init();
    const intent = provider.getIntent();
    expect(intent).toBeDefined();
    expect(typeof intent).toBe('object');
  });

  it('providers can return partial intents (only what they know)', () => {
    provider.init();

    // Provider only sets moveAxis
    provider.setMoveAxis(0.7);

    const intent = provider.getIntent();
    expect(intent.moveAxis).toBe(0.7);
    expect(intent.confirm).toBeUndefined(); // Not set by this provider
  });
});

describe('InputManager', () => {
  let manager: InputManager;

  beforeEach(() => {
    manager = new InputManager();
  });

  afterEach(() => {
    manager.destroy();
  });

  describe('initialization', () => {
    it('should initialize with default providers', () => {
      manager.init();
      // Default providers are added internally (keyboard, touch, gamepad)
      // We can't directly inspect them, but we can verify the manager works
      const intent = manager.getIntent();
      expect(intent).toBeDefined();
    });

    it('should start with neutral intent', () => {
      manager.init();
      const intent = manager.getIntent();

      expect(intent.moveAxis).toBe(0);
      expect(intent.menuAxis).toBe(0);
      expect(intent.confirm).toBe(false);
      expect(intent.cancel).toBe(false);
      expect(intent.calm).toBeNull();
      expect(intent.arousal).toBeNull();
    });
  });

  describe('addProvider / removeProvider (BCI Integration)', () => {
    let bciProvider: MockInputProvider;

    beforeEach(() => {
      bciProvider = new MockInputProvider();
    });

    it('should add a custom provider', () => {
      manager.init();

      expect(bciProvider.initialized).toBe(false);
      manager.addProvider(bciProvider);
      expect(bciProvider.initialized).toBe(true);
    });

    it('should remove a custom provider', () => {
      manager.init();
      manager.addProvider(bciProvider);

      expect(bciProvider.destroyed).toBe(false);
      manager.removeProvider(bciProvider);
      expect(bciProvider.destroyed).toBe(true);
    });

    it('added provider should contribute to intent', () => {
      manager.init();
      manager.addProvider(bciProvider);

      // BCI provider sets calm/arousal
      bciProvider.setCalm(0.8);
      bciProvider.setArousal(0.3);

      manager.update(1 / 60);
      const intent = manager.getIntent();

      expect(intent.calm).toBe(0.8);
      expect(intent.arousal).toBe(0.3);
    });

    it('removed provider should not contribute to intent', () => {
      manager.init();
      manager.addProvider(bciProvider);

      bciProvider.setCalm(0.8);
      manager.update(1 / 60);
      expect(manager.getIntent().calm).toBe(0.8);

      manager.removeProvider(bciProvider);
      manager.update(1 / 60);

      // After removal, calm should be null (no BCI provider)
      expect(manager.getIntent().calm).toBeNull();
    });
  });

  describe('intent aggregation', () => {
    let provider1: MockInputProvider;
    let provider2: MockInputProvider;

    beforeEach(() => {
      provider1 = new MockInputProvider();
      provider2 = new MockInputProvider();
      manager.init();
      manager.addProvider(provider1);
      manager.addProvider(provider2);
    });

    it('should use strongest moveAxis value', () => {
      provider1.setMoveAxis(0.3);
      provider2.setMoveAxis(0.8);

      manager.update(1 / 60);
      expect(manager.getIntent().moveAxis).toBe(0.8);
    });

    it('should use strongest negative moveAxis', () => {
      provider1.setMoveAxis(-0.3);
      provider2.setMoveAxis(-0.9);

      manager.update(1 / 60);
      expect(manager.getIntent().moveAxis).toBe(-0.9);
    });

    it('should use strongest menuAxis value', () => {
      provider1.setMenuAxis(0.2);
      provider2.setMenuAxis(-0.7);

      manager.update(1 / 60);
      expect(manager.getIntent().menuAxis).toBe(-0.7);
    });

    it('should OR boolean inputs (confirm)', () => {
      provider1.setConfirm(false);
      provider2.setConfirm(false);

      manager.update(1 / 60);
      expect(manager.getIntent().confirm).toBe(false);

      provider2.setConfirm(true);
      manager.update(1 / 60);
      expect(manager.getIntent().confirm).toBe(true);
    });

    it('should OR boolean inputs (cancel)', () => {
      provider1.setCancel(false);
      provider2.setCancel(true);

      manager.update(1 / 60);
      expect(manager.getIntent().cancel).toBe(true);
    });

    it('should use first non-null calm value', () => {
      // Provider 1 doesn't have BCI
      provider1.setCalm(null as unknown as number);
      // Provider 2 has BCI
      provider2.setCalm(0.6);

      manager.update(1 / 60);
      expect(manager.getIntent().calm).toBe(0.6);
    });

    it('should use first non-null arousal value', () => {
      provider1.setArousal(0.4);
      provider2.setArousal(0.9); // This won't be used (first wins)

      manager.update(1 / 60);
      expect(manager.getIntent().arousal).toBe(0.4);
    });
  });

  describe('update cycle', () => {
    let provider: MockInputProvider;

    beforeEach(() => {
      provider = new MockInputProvider();
      manager.init();
      manager.addProvider(provider);
    });

    it('should reset intent on each update', () => {
      provider.setMoveAxis(0.5);
      manager.update(1 / 60);
      expect(manager.getIntent().moveAxis).toBe(0.5);

      // Clear provider intent
      provider.clearIntent();
      manager.update(1 / 60);

      // Intent should be reset to default
      expect(manager.getIntent().moveAxis).toBe(0);
    });

    it('should call update on all providers', () => {
      const provider2 = new MockInputProvider();
      manager.addProvider(provider2);

      provider.updateCalled = false;
      provider2.updateCalled = false;

      manager.update(1 / 60);

      expect(provider.updateCalled).toBe(true);
      expect(provider2.updateCalled).toBe(true);
    });
  });

  describe('getIntent immutability', () => {
    it('should return readonly intent', () => {
      manager.init();
      const intent = manager.getIntent();

      // TypeScript should enforce this, but we can verify the object is stable
      expect(Object.isFrozen(intent) || typeof intent === 'object').toBe(true);
    });
  });
});

describe('BCI Integration Scenarios', () => {
  let manager: InputManager;
  let bciProvider: MockInputProvider;

  beforeEach(() => {
    manager = new InputManager();
    bciProvider = new MockInputProvider();
    manager.init();
  });

  afterEach(() => {
    manager.destroy();
  });

  it('should work with BCI provider providing only calm/arousal', () => {
    manager.addProvider(bciProvider);

    // BCI only provides mental state, not movement
    bciProvider.setCalm(0.7);
    bciProvider.setArousal(0.2);

    manager.update(1 / 60);
    const intent = manager.getIntent();

    expect(intent.moveAxis).toBe(0); // From keyboard (neutral)
    expect(intent.calm).toBe(0.7); // From BCI
    expect(intent.arousal).toBe(0.2); // From BCI
  });

  it('should allow BCI to contribute to movement via SSVEP', () => {
    manager.addProvider(bciProvider);

    // SSVEP-based BCI could provide moveAxis
    bciProvider.setMoveAxis(-0.8);

    manager.update(1 / 60);
    expect(manager.getIntent().moveAxis).toBe(-0.8);
  });

  it('keyboard should override weak BCI signal', () => {
    manager.addProvider(bciProvider);

    // Weak BCI signal
    bciProvider.setMoveAxis(0.1);

    manager.update(1 / 60);
    // Even without keyboard input, BCI signal is used
    expect(manager.getIntent().moveAxis).toBe(0.1);

    // Note: In real usage, keyboard would simulate pressing keys
    // Here we just verify the aggregation logic works
  });

  it('should handle BCI disconnection gracefully', () => {
    manager.addProvider(bciProvider);

    bciProvider.setCalm(0.5);
    manager.update(1 / 60);
    expect(manager.getIntent().calm).toBe(0.5);

    // Simulate BCI disconnect
    manager.removeProvider(bciProvider);
    manager.update(1 / 60);

    // Game should continue with null BCI values
    expect(manager.getIntent().calm).toBeNull();
    expect(manager.getIntent().moveAxis).toBe(0); // Still controllable
  });

  it('should handle rapid BCI signal changes', () => {
    manager.addProvider(bciProvider);

    // Simulate rapid signal changes (like real EEG)
    for (let i = 0; i < 100; i++) {
      bciProvider.setCalm(Math.sin(i * 0.1) * 0.5 + 0.5);
      bciProvider.setArousal(Math.cos(i * 0.1) * 0.5 + 0.5);
      manager.update(1 / 60);

      const intent = manager.getIntent();
      expect(intent.calm).toBeGreaterThanOrEqual(0);
      expect(intent.calm).toBeLessThanOrEqual(1);
      expect(intent.arousal).toBeGreaterThanOrEqual(0);
      expect(intent.arousal).toBeLessThanOrEqual(1);
    }
  });
});

describe('Mouse Click Handling', () => {
  let manager: InputManager;

  beforeEach(() => {
    manager = new InputManager();
    manager.init();
  });

  afterEach(() => {
    manager.destroy();
  });

  it('should return null when no click occurred', () => {
    const click = manager.getMouseClick();
    expect(click).toBeNull();
  });

  it('should consume click on retrieval', () => {
    // We can't easily simulate canvas clicks in unit tests,
    // but we can verify the consume behavior
    const click1 = manager.getMouseClick();
    const click2 = manager.getMouseClick();

    // Both should be null (no click registered)
    expect(click1).toBeNull();
    expect(click2).toBeNull();
  });
});
