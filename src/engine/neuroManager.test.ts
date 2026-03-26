import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NeuroManager } from './neuroManager';

vi.mock('../core/events', () => ({
  events: {
    emit: vi.fn(),
    on: vi.fn(() => () => {}),
    off: vi.fn(),
  },
}));

vi.mock('@elata-biosciences/eeg-web', () => ({
  initEegWasm: vi.fn(),
  WasmCalmnessModel: vi.fn().mockImplementation(() => ({
    process: vi.fn(),
    score: vi.fn(() => 0.5),
    min_samples: vi.fn(() => 64),
  })),
  WasmAlphaBumpDetector: vi.fn().mockImplementation(() => ({
    process: vi.fn(() => false),
    min_samples: vi.fn(() => 64),
  })),
  WasmAlphaPeakModel: vi.fn().mockImplementation(() => ({
    process: vi.fn(() => null),
    min_samples: vi.fn(() => 64),
  })),
  band_powers: vi.fn(() => ({ alpha: 10, beta: 15, theta: 8, delta: 5, gamma: 2 })),
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

vi.mock('@elata-biosciences/rppg-web', () => ({
  MediaPipeFrameSource: vi.fn().mockImplementation(() => ({
    start: vi.fn(),
    stop: vi.fn(),
  })),
  RppgProcessor: vi.fn().mockImplementation(() => ({
    getMetrics: vi.fn(() => ({ bpm: 72, signal_quality: 0.8, confidence: 0.8 })),
  })),
  DemoRunner: vi.fn().mockImplementation(() => ({
    start: vi.fn(),
    stop: vi.fn(),
  })),
  loadWasmBackend: vi.fn(() => Promise.resolve(null)),
}));

describe('NeuroManager', () => {
  let neuroManager: NeuroManager;

  beforeEach(() => {
    neuroManager = new NeuroManager();
    vi.clearAllMocks();
  });

  describe('Initial state', () => {
    it('should start with "none" source', () => {
      const state = neuroManager.getState();
      expect(state.source).toBe('none');
    });

    it('should start disconnected', () => {
      const state = neuroManager.getState();
      expect(state.eegConnected).toBe(false);
      expect(state.cameraActive).toBe(false);
    });

    it('should start with zero signals', () => {
      const state = neuroManager.getState();
      expect(state.calm).toBe(0);
      expect(state.arousal).toBe(0);
      expect(state.bpm).toBeNull();
    });

    it('should start with mock disabled', () => {
      expect(neuroManager.isMockEnabled()).toBe(false);
    });

    it('should not have an active source initially', () => {
      expect(neuroManager.hasActiveSource()).toBe(false);
    });
  });

  describe('Mock provider', () => {
    it('should enable mock explicitly', () => {
      neuroManager.enableMock();
      expect(neuroManager.isMockEnabled()).toBe(true);
    });

    it('should disable mock', () => {
      neuroManager.enableMock();
      neuroManager.disableMock();
      expect(neuroManager.isMockEnabled()).toBe(false);
    });

    it('should provide mock values when enabled and updated', () => {
      neuroManager.enableMock();
      neuroManager.update(0.1);
      const state = neuroManager.getState();
      expect(state.source).toBe('mock');
    });

    it('should report active source when mock is enabled', () => {
      neuroManager.enableMock();
      neuroManager.update(0.1);
      expect(neuroManager.hasActiveSource()).toBe(true);
    });

    it('should stay at "none" source when mock is disabled and no devices connected', () => {
      neuroManager.update(0.1);
      const state = neuroManager.getState();
      expect(state.source).toBe('none');
    });
  });

  describe('State management', () => {
    it('should return readonly state', () => {
      const state = neuroManager.getState();
      expect(state).toBeDefined();
      expect(typeof state.calm).toBe('number');
      expect(typeof state.arousal).toBe('number');
    });

    it('should have correct state shape', () => {
      const state = neuroManager.getState();
      expect(state).toHaveProperty('source');
      expect(state).toHaveProperty('calm');
      expect(state).toHaveProperty('arousal');
      expect(state).toHaveProperty('bpm');
      expect(state).toHaveProperty('bpmQuality');
      expect(state).toHaveProperty('signalQuality');
      expect(state).toHaveProperty('eegConnected');
      expect(state).toHaveProperty('cameraActive');
      expect(state).toHaveProperty('alphaPower');
      expect(state).toHaveProperty('betaPower');
      expect(state).toHaveProperty('thetaPower');
      expect(state).toHaveProperty('alphaBump');
    });
  });

  describe('Error handling', () => {
    it('should not crash update() if providers throw', () => {
      neuroManager.enableMock();
      expect(() => neuroManager.update(0.016)).not.toThrow();
    });
  });

  describe('Error messages', () => {
    it('should return headband error message', () => {
      const msg = neuroManager.getHeadbandErrorMessage();
      expect(typeof msg).toBe('string');
      expect(msg.length).toBeGreaterThan(0);
    });

    it('should return camera error message', () => {
      const msg = neuroManager.getCameraErrorMessage();
      expect(typeof msg).toBe('string');
      expect(msg.length).toBeGreaterThan(0);
    });
  });

  describe('WASM ready', () => {
    it('should report wasm not ready initially', () => {
      expect(neuroManager.isWasmReady()).toBe(false);
    });
  });

  describe('Camera control', () => {
    it('should disable camera without error', () => {
      expect(() => neuroManager.disableCamera()).not.toThrow();
    });
  });

  describe('Provider access', () => {
    it('should expose EEG provider', () => {
      expect(neuroManager.getEEGProvider()).toBeDefined();
    });

    it('should expose rPPG provider', () => {
      expect(neuroManager.getRppgProvider()).toBeDefined();
    });

    it('should expose mock provider', () => {
      expect(neuroManager.getMockProvider()).toBeDefined();
    });
  });

  describe('Destroy', () => {
    it('should not throw on destroy', () => {
      expect(() => neuroManager.destroy()).not.toThrow();
    });
  });

  describe('Expanded state shape', () => {
    it('should have deltaPower in state', () => {
      expect(neuroManager.getState()).toHaveProperty('deltaPower');
    });

    it('should have gammaPower in state', () => {
      expect(neuroManager.getState()).toHaveProperty('gammaPower');
    });

    it('should have hrvRmssd in state', () => {
      expect(neuroManager.getState()).toHaveProperty('hrvRmssd');
    });

    it('should have respirationRate in state', () => {
      expect(neuroManager.getState()).toHaveProperty('respirationRate');
    });

    it('should have baselineBpm in state', () => {
      expect(neuroManager.getState()).toHaveProperty('baselineBpm');
    });

    it('should have baselineDelta in state', () => {
      expect(neuroManager.getState()).toHaveProperty('baselineDelta');
    });

    it('should have calmnessState in state', () => {
      expect(neuroManager.getState()).toHaveProperty('calmnessState');
    });

    it('should have alphaPeakFreq in state', () => {
      expect(neuroManager.getState()).toHaveProperty('alphaPeakFreq');
    });

    it('should have alphaBumpState in state', () => {
      expect(neuroManager.getState()).toHaveProperty('alphaBumpState');
    });
  });

  describe('Null metrics when no devices connected', () => {
    it('should have null band powers without EEG', () => {
      neuroManager.update(0.1);
      const state = neuroManager.getState();
      expect(state.alphaPower).toBeNull();
      expect(state.betaPower).toBeNull();
      expect(state.thetaPower).toBeNull();
      expect(state.deltaPower).toBeNull();
      expect(state.gammaPower).toBeNull();
    });

    it('should have null rPPG metrics without camera', () => {
      neuroManager.update(0.1);
      const state = neuroManager.getState();
      expect(state.hrvRmssd).toBeNull();
      expect(state.respirationRate).toBeNull();
      expect(state.baselineBpm).toBeNull();
      expect(state.baselineDelta).toBeNull();
    });

    it('should have null BPM without camera', () => {
      neuroManager.update(0.1);
      const state = neuroManager.getState();
      expect(state.bpm).toBeNull();
      expect(state.bpmQuality).toBe(0);
    });
  });

  describe('Camera video element', () => {
    it('should return null video element when no camera', () => {
      expect(neuroManager.getCameraVideoElement()).toBeNull();
    });
  });

  describe('WASM init logging', () => {
    it('should set wasmReady to true on successful initWasm', async () => {
      await neuroManager.initWasm();
      expect(neuroManager.isWasmReady()).toBe(true);
    });

    it('should log WASM init success', async () => {
      const logSpy = vi.spyOn(console, 'log');
      await neuroManager.initWasm();
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[Neuro] WASM init succeeded'));
      logSpy.mockRestore();
    });
  });

  describe('Source transition logging', () => {
    it('should log when source changes to mock', () => {
      const logSpy = vi.spyOn(console, 'log');
      neuroManager.enableMock();
      neuroManager.update(0.1);
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Neuro] Source changed:'),
        'none',
        '->',
        'mock',
        expect.any(Object),
      );
      logSpy.mockRestore();
    });
  });

  describe('EEG provider accessors', () => {
    it('should expose decode error count from EEG provider', () => {
      const eeg = neuroManager.getEEGProvider();
      expect(eeg.getDecodeErrorCount()).toBe(0);
    });

    it('should expose models ready state from EEG provider', () => {
      const eeg = neuroManager.getEEGProvider();
      expect(eeg.isModelsReady()).toBe(false);
    });

    it('should have models ready after initWasm', async () => {
      await neuroManager.initWasm();
      const eeg = neuroManager.getEEGProvider();
      expect(eeg.isModelsReady()).toBe(true);
    });

    it('should expose battery level from EEG provider', () => {
      const eeg = neuroManager.getEEGProvider();
      expect(eeg.getBatteryLevel()).toBeNull();
    });

    it('should expose reconnect count from EEG provider', () => {
      const eeg = neuroManager.getEEGProvider();
      expect(eeg.getReconnectCount()).toBe(0);
    });

    it('should expose reconnecting state from EEG provider', () => {
      const eeg = neuroManager.getEEGProvider();
      expect(eeg.isReconnecting()).toBe(false);
    });

    it('should expose reconnect attempt from EEG provider', () => {
      const eeg = neuroManager.getEEGProvider();
      expect(eeg.getReconnectAttempt()).toBe(0);
    });
  });
});
