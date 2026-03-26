/**
 * Input System with BCI-Ready Abstraction
 *
 * This module provides a unified input abstraction layer that allows the game
 * to accept input from multiple sources: keyboard, gamepad, touch, and future
 * BCI (Brain-Computer Interface) devices.
 *
 * ## Architecture
 *
 * The system uses a provider pattern where each input source implements the
 * `InputProvider` interface. The `InputManager` aggregates all providers and
 * produces a unified `PlayerIntent` that gameplay systems consume.
 *
 * ```
 * ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
 * │ KeyboardProvider│     │ GamepadProvider │     │ BCIProvider     │
 * └────────┬────────┘     └────────┬────────┘     └────────┬────────┘
 *          │                       │                       │
 *          │     Partial<Intent>   │     Partial<Intent>   │
 *          └───────────────────────┼───────────────────────┘
 *                                  ▼
 *                        ┌─────────────────┐
 *                        │  InputManager   │
 *                        │  (aggregation)  │
 *                        └────────┬────────┘
 *                                 │
 *                                 ▼  Unified PlayerIntent
 *                        ┌─────────────────┐
 *                        │  Game Systems   │
 *                        └─────────────────┘
 * ```
 *
 * ## BCI Integration Guide
 *
 * To add BCI input support:
 *
 * 1. Create a class implementing `InputProvider`
 * 2. In `getIntent()`, return `{ calm, arousal }` values from EEG analysis
 * 3. Optionally return `moveAxis` for SSVEP-based movement
 * 4. Register with `game.getInput().addProvider(bciProvider)`
 *
 * @example
 * ```typescript
 * class EEGProvider implements InputProvider {
 *   private device: EEGDevice;
 *
 *   init(): void {
 *     this.device = new EEGDevice();
 *     this.device.connect();
 *   }
 *
 *   getIntent(): Partial<PlayerIntent> {
 *     const { alpha, beta } = this.device.getBandPowers();
 *     return {
 *       calm: normalizeAlpha(alpha),     // 0-1
 *       arousal: normalizeBeta(beta),    // 0-1
 *     };
 *   }
 *
 *   update(_dt: number): void {}
 *   destroy(): void { this.device.disconnect(); }
 * }
 * ```
 *
 * @module engine/input
 */

/**
 * Canonical player intent - the unified output consumed by gameplay systems.
 *
 * All input providers contribute to this intent. The `InputManager` aggregates
 * them using these rules:
 * - `moveAxis`, `menuAxis`: Strongest absolute value wins
 * - `confirm`, `cancel`: OR'd together (any provider can trigger)
 * - `calm`, `arousal`: First non-null value wins
 *
 * @interface PlayerIntent
 */
export interface PlayerIntent {
  /**
   * Horizontal movement axis for gameplay.
   * Range: -1 (full left) to 1 (full right), 0 = neutral.
   *
   * Sources:
   * - Keyboard: Arrow keys, A/D
   * - Gamepad: Left stick X, D-pad
   * - Touch: Swipe direction
   * - BCI: SSVEP gaze direction (left/right targets)
   */
  moveAxis: number;

  /**
   * Vertical menu navigation axis.
   * Range: -1 (up) to 1 (down), 0 = neutral.
   *
   * Sources:
   * - Keyboard: Arrow keys, W/S
   * - Gamepad: Left stick Y, D-pad
   */
  menuAxis: number;

  /**
   * Confirm/accept action (start game, select option).
   *
   * Sources:
   * - Keyboard: Space, Enter
   * - Gamepad: A button
   * - Touch: Tap
   */
  confirm: boolean;

  /**
   * Cancel/back action (return to menu, close dialogs).
   *
   * Sources:
   * - Keyboard: Escape, P
   * - Gamepad: B button
   * - Touch: Double-tap
   */
  cancel: boolean;

  /**
   * Pause game action (separate from cancel for more flexibility).
   *
   * Sources:
   * - Keyboard: Space, Escape, P
   * - Gamepad: Start button
   */
  pause?: boolean;

  /**
   * Mute/unmute audio toggle.
   *
   * Sources:
   * - Keyboard: M
   */
  mute?: boolean;

  /**
   * Toggle debug overlay.
   *
   * Sources:
   * - Keyboard: Backtick
   */
  debugToggle?: boolean;

  /**
   * Calm/relaxation level from BCI.
   * Range: 0 (agitated) to 1 (deeply relaxed), null if BCI unavailable.
   *
   * Signal source: Alpha wave power (8-12 Hz)
   * - High alpha = relaxed, meditative state
   * - Low alpha = alert, stressed state
   *
   * Gameplay effects:
   * - Powers "Calm" abilities (shield, beam)
   * - May unlock defensive powerups
   */
  calm: number | null;

  /**
   * Arousal/excitement level from BCI.
   * Range: 0 (drowsy) to 1 (highly alert), null if BCI unavailable.
   *
   * Signal source: Beta wave power (13-30 Hz)
   * - High beta = alert, focused, excited
   * - Low beta = drowsy, unfocused
   *
   * Gameplay effects:
   * - Powers "Passion" abilities (fury, explosive bananas)
   * - May unlock offensive powerups
   */
  arousal: number | null;
}

/**
 * Input provider interface for all input sources.
 *
 * Implement this interface to add a new input source (e.g., BCI device).
 * Providers only need to return the intent properties they know about;
 * the `InputManager` handles aggregation and defaults.
 *
 * ## Lifecycle
 *
 * 1. `init()` - Called when provider is added to `InputManager`
 * 2. `getIntent()` - Called each frame before `update()`
 * 3. `update(dt)` - Called each frame after `getIntent()`
 * 4. `destroy()` - Called when provider is removed or game ends
 *
 * ## BCI Provider Implementation Notes
 *
 * - Return `calm` and `arousal` as normalized 0-1 values
 * - Apply smoothing/filtering to reduce noise
 * - Handle device disconnection gracefully
 * - Return `{}` (empty intent) if device is not ready
 * - Consider implementing signal quality indicators
 *
 * @interface InputProvider
 */
export interface InputProvider {
  /**
   * Initialize the provider (connect to device, add event listeners, etc.)
   */
  init(): void;

  /**
   * Update provider state. Called after `getIntent()` each frame.
   * Use this to clear edge-triggered states (e.g., "just pressed" flags).
   *
   * @param dt - Delta time in seconds since last frame
   */
  update(dt: number): void;

  /**
   * Get the current input intent from this provider.
   * Return only the properties this provider knows about.
   *
   * @returns Partial intent with known values
   */
  getIntent(): Partial<PlayerIntent>;

  /**
   * Clean up resources (disconnect device, remove event listeners, etc.)
   */
  destroy(): void;
}

/**
 * Keyboard input provider
 */
class KeyboardProvider implements InputProvider {
  private keys: Set<string> = new Set();
  private justPressed: Set<string> = new Set();

  init(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (!this.keys.has(e.code)) {
      this.justPressed.add(e.code);
    }
    this.keys.add(e.code);

    // Prevent default for game keys
    if (
      ['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Escape', 'KeyP', 'KeyM', 'Backquote'].includes(
        e.code,
      )
    ) {
      e.preventDefault();
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  update(_dt: number): void {
    // Clear just pressed after update
    this.justPressed.clear();
  }

  getIntent(): Partial<PlayerIntent> {
    let moveAxis = 0;
    if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) {
      moveAxis -= 1;
    }
    if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) {
      moveAxis += 1;
    }

    let menuAxis = 0;
    if (this.keys.has('ArrowUp') || this.keys.has('KeyW')) {
      menuAxis -= 1;
    }
    if (this.keys.has('ArrowDown') || this.keys.has('KeyS')) {
      menuAxis += 1;
    }

    return {
      moveAxis,
      menuAxis,
      confirm: this.justPressed.has('Space') || this.justPressed.has('Enter'),
      cancel: this.justPressed.has('Escape') || this.justPressed.has('KeyP'),
      pause: this.justPressed.has('Space') || this.justPressed.has('Escape') || this.justPressed.has('KeyP'),
      mute: this.justPressed.has('KeyM'),
      debugToggle: this.justPressed.has('Backquote'),
    };
  }
}

/**
 * Touch input provider
 */
class TouchProvider implements InputProvider {
  private touchStartX: number = 0;
  private touchCurrentX: number = 0;
  private isTouching: boolean = false;
  private swipeThreshold: number = 30;
  private tapped: boolean = false;
  private doubleTapped: boolean = false;
  private lastTapTime: number = 0;

  init(): void {
    window.addEventListener('touchstart', this.onTouchStart, { passive: false });
    window.addEventListener('touchmove', this.onTouchMove, { passive: false });
    window.addEventListener('touchend', this.onTouchEnd, { passive: false });
  }

  destroy(): void {
    window.removeEventListener('touchstart', this.onTouchStart);
    window.removeEventListener('touchmove', this.onTouchMove);
    window.removeEventListener('touchend', this.onTouchEnd);
  }

  private onTouchStart = (e: TouchEvent): void => {
    e.preventDefault();
    const touch = e.touches[0];
    this.touchStartX = touch.clientX;
    this.touchCurrentX = touch.clientX;
    this.isTouching = true;
  };

  private onTouchMove = (e: TouchEvent): void => {
    e.preventDefault();
    if (!this.isTouching) return;
    const touch = e.touches[0];
    this.touchCurrentX = touch.clientX;
  };

  private onTouchEnd = (e: TouchEvent): void => {
    e.preventDefault();
    const now = Date.now();
    const deltaX = this.touchCurrentX - this.touchStartX;

    // Check for tap vs swipe
    if (Math.abs(deltaX) < this.swipeThreshold) {
      if (now - this.lastTapTime < 300) {
        this.doubleTapped = true;
      } else {
        this.tapped = true;
      }
      this.lastTapTime = now;
    }

    this.isTouching = false;
  };

  update(_dt: number): void {
    this.tapped = false;
    this.doubleTapped = false;
  }

  getIntent(): Partial<PlayerIntent> {
    let moveAxis = 0;

    if (this.isTouching) {
      const deltaX = this.touchCurrentX - this.touchStartX;
      if (deltaX < -this.swipeThreshold) {
        moveAxis = -1;
      } else if (deltaX > this.swipeThreshold) {
        moveAxis = 1;
      }
    }

    return {
      moveAxis,
      confirm: this.tapped,
      cancel: this.doubleTapped,
    };
  }
}

/**
 * Gamepad input provider
 */
class GamepadProvider implements InputProvider {
  private gamepad: Gamepad | null = null;
  private previousButtons: boolean[] = [];

  init(): void {
    window.addEventListener('gamepadconnected', this.onGamepadConnected);
    window.addEventListener('gamepaddisconnected', this.onGamepadDisconnected);
  }

  destroy(): void {
    window.removeEventListener('gamepadconnected', this.onGamepadConnected);
    window.removeEventListener('gamepaddisconnected', this.onGamepadDisconnected);
  }

  private onGamepadConnected = (e: GamepadEvent): void => {
    console.log('Gamepad connected:', e.gamepad.id);
    this.gamepad = e.gamepad;
    this.previousButtons = new Array(e.gamepad.buttons.length).fill(false);
  };

  private onGamepadDisconnected = (): void => {
    console.log('Gamepad disconnected');
    this.gamepad = null;
    this.previousButtons = [];
  };

  update(_dt: number): void {
    // Update gamepad state
    const gamepads = navigator.getGamepads();
    for (const gp of gamepads) {
      if (gp) {
        this.gamepad = gp;
        break;
      }
    }

    // Store previous button states
    if (this.gamepad) {
      this.previousButtons = this.gamepad.buttons.map((b) => b.pressed);
    }
  }

  private buttonJustPressed(index: number): boolean {
    if (!this.gamepad) return false;
    return this.gamepad.buttons[index]?.pressed && !this.previousButtons[index];
  }

  getIntent(): Partial<PlayerIntent> {
    if (!this.gamepad) return {};

    // Left stick X axis or D-pad
    let moveAxis = this.gamepad.axes[0] || 0;
    let menuAxis = this.gamepad.axes[1] || 0; // Y axis for menu

    // D-pad fallback
    if (this.gamepad.buttons[14]?.pressed) moveAxis = -1; // Left
    if (this.gamepad.buttons[15]?.pressed) moveAxis = 1; // Right
    if (this.gamepad.buttons[12]?.pressed) menuAxis = -1; // Up
    if (this.gamepad.buttons[13]?.pressed) menuAxis = 1; // Down

    // Dead zone
    if (Math.abs(moveAxis) < 0.2) moveAxis = 0;
    if (Math.abs(menuAxis) < 0.2) menuAxis = 0;

    return {
      moveAxis,
      menuAxis,
      confirm: this.buttonJustPressed(0), // A button
      cancel: this.buttonJustPressed(1), // B button
    };
  }
}

// Debug signal provider for testing BCI integration - reserved for future use
// class DebugSignalProvider implements InputProvider { ... }

/**
 * Input manager that aggregates all providers
 */
export class InputManager {
  private providers: InputProvider[] = [];
  private intent: PlayerIntent = {
    moveAxis: 0,
    menuAxis: 0,
    confirm: false,
    cancel: false,
    calm: null,
    arousal: null,
  };

  // Mouse click tracking
  private mouseClick: { x: number; y: number } | null = null;
  private mousePos: { x: number; y: number } | null = null;
  private wheelDelta = 0;
  private canvas: HTMLCanvasElement | null = null;

  // Reserved for future BCI integration
  // private debugProvider?: DebugSignalProvider;

  init(): void {
    // Add default providers
    const keyboard = new KeyboardProvider();
    const touch = new TouchProvider();
    const gamepad = new GamepadProvider();

    keyboard.init();
    touch.init();
    gamepad.init();

    this.providers.push(keyboard, touch, gamepad);

    // Debug provider (disabled by default)
    // this.debugProvider = new DebugSignalProvider();
    // this.debugProvider.init();
    // this.providers.push(this.debugProvider);
  }

  /**
   * Set the canvas for mouse click coordinate conversion
   */
  setCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    canvas.addEventListener('click', this.onCanvasClick);
    canvas.addEventListener('mousemove', this.onCanvasMouseMove);
    canvas.addEventListener('wheel', this.onCanvasWheel, { passive: false });
  }

  private onCanvasWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.wheelDelta += e.deltaY;
  };

  getWheelDelta(): number {
    const d = this.wheelDelta;
    this.wheelDelta = 0;
    return d;
  }

  private onCanvasClick = (e: MouseEvent): void => {
    if (!this.canvas) return;

    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    this.mouseClick = {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  private onCanvasMouseMove = (e: MouseEvent): void => {
    if (!this.canvas) return;

    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    this.mousePos = {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  destroy(): void {
    for (const provider of this.providers) {
      provider.destroy();
    }
    this.providers = [];

    if (this.canvas) {
      this.canvas.removeEventListener('click', this.onCanvasClick);
      this.canvas.removeEventListener('mousemove', this.onCanvasMouseMove);
      this.canvas = null;
    }
  }

  update(dt: number): void {
    // Reset intent
    this.intent = {
      moveAxis: 0,
      menuAxis: 0,
      confirm: false,
      cancel: false,
      calm: null,
      arousal: null,
    };

    // Aggregate all providers FIRST (before clearing just-pressed states)
    for (const provider of this.providers) {
      const partial = provider.getIntent();

      // Use strongest non-zero moveAxis
      if (partial.moveAxis !== undefined && Math.abs(partial.moveAxis) > Math.abs(this.intent.moveAxis)) {
        this.intent.moveAxis = partial.moveAxis;
      }

      // Use strongest non-zero menuAxis
      if (partial.menuAxis !== undefined && Math.abs(partial.menuAxis) > Math.abs(this.intent.menuAxis)) {
        this.intent.menuAxis = partial.menuAxis;
      }

      // OR boolean inputs
      if (partial.confirm) this.intent.confirm = true;
      if (partial.cancel) this.intent.cancel = true;

      // Use first non-null signal values
      if (partial.calm !== undefined && this.intent.calm === null) {
        this.intent.calm = partial.calm;
      }
      if (partial.arousal !== undefined && this.intent.arousal === null) {
        this.intent.arousal = partial.arousal;
      }
    }

    // THEN update providers (this clears just-pressed states for next frame)
    for (const provider of this.providers) {
      provider.update(dt);
    }
  }

  getIntent(): Readonly<PlayerIntent> {
    return this.intent;
  }

  /**
   * Get and consume mouse click (returns null if no click this frame)
   */
  getMouseClick(): { x: number; y: number } | null {
    const click = this.mouseClick;
    this.mouseClick = null;
    return click;
  }

  getMousePos(): { x: number; y: number } | null {
    return this.mousePos;
  }

  // For BCI integration later
  addProvider(provider: InputProvider): void {
    provider.init();
    this.providers.push(provider);
  }

  removeProvider(provider: InputProvider): void {
    const index = this.providers.indexOf(provider);
    if (index !== -1) {
      provider.destroy();
      this.providers.splice(index, 1);
    }
  }
}
