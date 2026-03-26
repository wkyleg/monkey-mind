import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ElataEEGProvider } from './eegProvider';

vi.mock('@elata-biosciences/eeg-web', () => ({
  initEegWasm: vi.fn(),
  WasmCalmnessModel: vi.fn().mockImplementation(() => ({
    process: vi.fn(() => ({ percentage: () => 65, state_description: () => 'calm', alpha_beta_ratio: 1.5 })),
    min_samples: vi.fn(() => 64),
  })),
  WasmAlphaBumpDetector: vi.fn().mockImplementation(() => ({
    process: vi.fn(() => ({ is_bump: () => false, state: 'low' })),
    min_samples: vi.fn(() => 64),
  })),
  WasmAlphaPeakModel: vi.fn().mockImplementation(() => ({
    process: vi.fn(() => ({ peak_frequency: 10.2, snr: 3.5 })),
    min_samples: vi.fn(() => 64),
  })),
  band_powers: vi.fn(() => ({ alpha: 10, beta: 15, theta: 8, delta: 5, gamma: 2 })),
  AthenaWasmDecoder: vi.fn(),
}));

vi.mock('@elata-biosciences/eeg-web-ble', () => ({
  BleTransport: vi.fn().mockImplementation(() => ({
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    disconnect: vi.fn(),
    onStatus: null,
    onFrame: null,
  })),
}));

describe('ElataEEGProvider', () => {
  let provider: ElataEEGProvider;

  beforeEach(() => {
    provider = new ElataEEGProvider();
    vi.clearAllMocks();
  });

  describe('Initial state', () => {
    it('should start disconnected', () => {
      expect(provider.isConnected()).toBe(false);
    });

    it('should return empty intent when disconnected', () => {
      const intent = provider.getIntent();
      expect(intent).toEqual({});
    });

    it('should have null band powers initially', () => {
      const state = provider.getState();
      expect(state.alphaPower).toBeNull();
      expect(state.betaPower).toBeNull();
      expect(state.thetaPower).toBeNull();
    });

    it('should have no last error initially', () => {
      expect(provider.getLastError()).toBeNull();
    });
  });

  describe('State shape', () => {
    it('should have correct state properties', () => {
      const state = provider.getState();
      expect(state).toHaveProperty('connected');
      expect(state).toHaveProperty('calm');
      expect(state).toHaveProperty('arousal');
      expect(state).toHaveProperty('alphaPower');
      expect(state).toHaveProperty('betaPower');
      expect(state).toHaveProperty('thetaPower');
      expect(state).toHaveProperty('alphaBump');
      expect(state).toHaveProperty('signalQuality');
    });
  });

  describe('Callbacks', () => {
    it('should accept disconnect/reconnect callbacks', () => {
      const onDisconnect = vi.fn();
      const onReconnect = vi.fn();
      expect(() => provider.setCallbacks(onDisconnect, onReconnect)).not.toThrow();
    });
  });

  describe('Init', () => {
    it('should not throw on sync init', () => {
      expect(() => provider.init()).not.toThrow();
    });

    it('should resolve async init', async () => {
      await expect(provider.initAsync()).resolves.toBeUndefined();
    });
  });

  describe('Update', () => {
    it('should not throw on update', () => {
      expect(() => provider.update(0.016)).not.toThrow();
    });
  });

  describe('Error messages', () => {
    it('should return a human-readable error message', () => {
      const msg = provider.getErrorMessage();
      expect(typeof msg).toBe('string');
      expect(msg.length).toBeGreaterThan(0);
    });
  });

  describe('Destroy', () => {
    it('should not throw on destroy', () => {
      expect(() => provider.destroy()).not.toThrow();
    });

    it('should mark as disconnected after destroy', () => {
      provider.destroy();
      expect(provider.isConnected()).toBe(false);
    });
  });

  describe('Expanded state fields', () => {
    it('should have deltaPower initially null', () => {
      expect(provider.getState().deltaPower).toBeNull();
    });

    it('should have gammaPower initially null', () => {
      expect(provider.getState().gammaPower).toBeNull();
    });

    it('should have calmnessState initially null', () => {
      expect(provider.getState().calmnessState).toBeNull();
    });

    it('should have alphaPeakFreq initially null', () => {
      expect(provider.getState().alphaPeakFreq).toBeNull();
    });

    it('should have alphaBumpState initially null', () => {
      expect(provider.getState().alphaBumpState).toBeNull();
    });

    it('should have alphaBetaRatio initially null', () => {
      expect(provider.getState().alphaBetaRatio).toBeNull();
    });
  });

  describe('Intent', () => {
    it('should return empty intent when arousal and calm are both null', () => {
      expect(provider.getIntent()).toEqual({});
    });
  });

  describe('Sample buffer', () => {
    it('should start with empty recent samples', () => {
      expect(provider.getRecentSamples()).toEqual([]);
    });

    it('should start with zero frame count', () => {
      expect(provider.getFrameCount()).toBe(0);
    });
  });

  describe('Decode error tracking', () => {
    it('should start with zero decode errors', () => {
      expect(provider.getDecodeErrorCount()).toBe(0);
    });
  });

  describe('Models ready state', () => {
    it('should start with models not ready', () => {
      expect(provider.isModelsReady()).toBe(false);
    });

    it('should mark models ready after initAsync', async () => {
      await provider.initAsync();
      expect(provider.isModelsReady()).toBe(true);
    });
  });

  describe('Battery and reconnect state', () => {
    it('should have null battery level initially', () => {
      expect(provider.getBatteryLevel()).toBeNull();
    });

    it('should have batteryLevel in state', () => {
      expect(provider.getState().batteryLevel).toBeNull();
    });

    it('should have lastAccelMagnitude in state', () => {
      expect(provider.getState().lastAccelMagnitude).toBeNull();
    });

    it('should start not reconnecting', () => {
      expect(provider.isReconnecting()).toBe(false);
    });

    it('should have reconnecting in state', () => {
      expect(provider.getState().reconnecting).toBe(false);
    });

    it('should start with zero reconnect count', () => {
      expect(provider.getReconnectCount()).toBe(0);
    });

    it('should start with zero reconnect attempt', () => {
      expect(provider.getReconnectAttempt()).toBe(0);
    });

    it('should start with zero BLE notification count', () => {
      expect(provider.getBleNotificationCount()).toBe(0);
    });

    it('should start with zero empty decode count', () => {
      expect(provider.getEmptyDecodeCount()).toBe(0);
    });
  });

  describe('State shape - expanded fields', () => {
    it('should include reconnecting and battery in state', () => {
      const state = provider.getState();
      expect(state).toHaveProperty('reconnecting');
      expect(state).toHaveProperty('batteryLevel');
      expect(state).toHaveProperty('lastAccelMagnitude');
    });
  });
});
