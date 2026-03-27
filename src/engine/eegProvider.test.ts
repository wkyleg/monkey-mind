import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ElataEEGProvider } from './eegProvider';

const mockCalmnessProcess = vi.fn(() => ({
  percentage: () => 65,
  state_description: () => 'calm',
  alpha_beta_ratio: 1.5,
}));
const mockAlphaBumpProcess = vi.fn(() => ({ is_high: () => false, state: 'low' }));
const mockAlphaPeakProcess = vi.fn(() => ({ peak_frequency: 10.2, snr: 3.5 }));
const mockBandPowers = vi.fn(() => ({ alpha: 10, beta: 15, theta: 8, delta: 5, gamma: 2 }));

vi.mock('@elata-biosciences/eeg-web', () => ({
  initEegWasm: vi.fn(),
  WasmCalmnessModel: vi.fn().mockImplementation(() => ({
    process: mockCalmnessProcess,
    min_samples: vi.fn(() => 64),
  })),
  WasmAlphaBumpDetector: vi.fn().mockImplementation(() => ({
    process: mockAlphaBumpProcess,
    min_samples: vi.fn(() => 64),
  })),
  WasmAlphaPeakModel: vi.fn().mockImplementation(() => ({
    process: mockAlphaPeakProcess,
    min_samples: vi.fn(() => 64),
  })),
  band_powers: mockBandPowers,
  AthenaWasmDecoder: vi.fn(),
}));

interface MockTransport {
  connect: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  onStatus: ((status: Record<string, unknown>) => void) | null;
  onFrame: ((frame: Record<string, unknown>) => void) | null;
  device: null;
}

let lastMockTransport: MockTransport;

vi.mock('@elata-biosciences/eeg-web-ble', () => ({
  BleTransport: vi.fn().mockImplementation(() => {
    lastMockTransport = {
      connect: vi.fn().mockResolvedValue(undefined),
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn(),
      disconnect: vi.fn(),
      onStatus: null,
      onFrame: null,
      device: null,
    };
    return lastMockTransport;
  }),
}));

function makeEegFrame(samples: number[], sampleRateHz = 256) {
  return {
    eeg: { samples, sampleRateHz },
  };
}

function makeMultiChannelEegFrame(sampleMajor: number[][], sampleRateHz = 256) {
  return {
    eeg: { samples: sampleMajor, sampleRateHz },
  };
}

async function initAndConnect(provider: ElataEEGProvider): Promise<MockTransport> {
  await provider.initAsync();
  Object.defineProperty(globalThis, 'navigator', {
    value: { bluetooth: {} },
    configurable: true,
    writable: true,
  });
  await provider.connect();
  return lastMockTransport;
}

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

  describe('Frame processing', () => {
    it('populates band powers after receiving enough samples', async () => {
      const transport = await initAndConnect(provider);
      const samples = Array.from({ length: 128 }, (_, i) => Math.sin(i * 0.1));
      transport.onFrame!(makeEegFrame(samples));

      const state = provider.getState();
      expect(state.alphaPower).not.toBeNull();
      expect(state.betaPower).not.toBeNull();
      expect(state.thetaPower).not.toBeNull();
      expect(state.deltaPower).not.toBeNull();
      expect(state.gammaPower).not.toBeNull();
    });

    it('accumulates samples across multiple frames before running analysis', async () => {
      const transport = await initAndConnect(provider);

      // MIN_ANALYSIS_SAMPLES is 64; send chunks that stay below until the last one
      transport.onFrame!(makeEegFrame(Array.from({ length: 20 }, () => 1)));
      expect(provider.getState().alphaPower).toBeNull();

      transport.onFrame!(makeEegFrame(Array.from({ length: 20 }, () => 1)));
      expect(provider.getState().alphaPower).toBeNull();

      // 20 + 20 + 30 = 70, now crosses the 64-sample threshold
      transport.onFrame!(makeEegFrame(Array.from({ length: 30 }, () => 1)));
      expect(provider.getState().alphaPower).not.toBeNull();
    });

    it('increments frameCount for each frame with valid EEG data', async () => {
      const transport = await initAndConnect(provider);
      expect(provider.getFrameCount()).toBe(0);

      transport.onFrame!(makeEegFrame([1, 2, 3]));
      expect(provider.getFrameCount()).toBe(1);

      transport.onFrame!(makeEegFrame([4, 5, 6]));
      expect(provider.getFrameCount()).toBe(2);
    });

    it('sets calm and arousal from WASM model results', async () => {
      const transport = await initAndConnect(provider);
      const samples = Array.from({ length: 128 }, (_, i) => Math.sin(i * 0.1));
      transport.onFrame!(makeEegFrame(samples));

      const state = provider.getState();
      expect(state.calm).toBe(0.65);
      expect(state.calmnessState).toBe('calm');
      expect(state.alphaBetaRatio).toBe(1.5);
    });

    it('sets alphaPeak values from WASM model', async () => {
      const transport = await initAndConnect(provider);
      const samples = Array.from({ length: 128 }, (_, i) => Math.sin(i * 0.1));
      transport.onFrame!(makeEegFrame(samples));

      const state = provider.getState();
      expect(state.alphaPeakFreq).toBe(10.2);
      expect(state.alphaPeakSnr).toBe(3.5);
    });

    it('extracts channel 0 from multi-channel sample-major data', async () => {
      const transport = await initAndConnect(provider);
      const sampleMajor = Array.from({ length: 128 }, (_, i) => [
        Math.sin(i * 0.1),
        Math.sin(i * 0.2),
        Math.sin(i * 0.3),
        Math.sin(i * 0.4),
      ]);
      transport.onFrame!(makeMultiChannelEegFrame(sampleMajor));

      expect(provider.getFrameCount()).toBe(1);
      expect(provider.getState().alphaPower).not.toBeNull();
    });

    it('handles frames with no eeg property by incrementing emptyDecodeCount', async () => {
      const transport = await initAndConnect(provider);
      transport.onFrame!({ noEeg: true });

      expect(provider.getEmptyDecodeCount()).toBe(1);
      expect(provider.getFrameCount()).toBe(0);
    });

    it('handles frames with empty samples by incrementing emptyDecodeCount', async () => {
      const transport = await initAndConnect(provider);
      transport.onFrame!({ eeg: { samples: [] } });

      expect(provider.getEmptyDecodeCount()).toBe(1);
      expect(provider.getFrameCount()).toBe(0);
    });

    it('increments bleNotificationCount on every frame', async () => {
      const transport = await initAndConnect(provider);
      transport.onFrame!(makeEegFrame([1]));
      transport.onFrame!({ noEeg: true });
      transport.onFrame!(makeEegFrame([2]));

      expect(provider.getBleNotificationCount()).toBe(3);
    });
  });

  describe('Battery extraction', () => {
    it('extracts battery level from frame battery samples', async () => {
      const transport = await initAndConnect(provider);
      transport.onFrame!({
        eeg: { samples: [1, 2, 3] },
        battery: { samples: [72] },
      });

      expect(provider.getBatteryLevel()).toBe(72);
    });

    it('clamps battery to 0-100 range', async () => {
      const transport = await initAndConnect(provider);
      transport.onFrame!({
        eeg: { samples: [1] },
        battery: { samples: [150] },
      });
      expect(provider.getBatteryLevel()).toBe(100);

      transport.onFrame!({
        eeg: { samples: [1] },
        battery: { samples: [-10] },
      });
      // Negative values are filtered by the >= 0 check, so battery stays at 100
      expect(provider.getBatteryLevel()).toBe(100);
    });

    it('uses last sample from battery array', async () => {
      const transport = await initAndConnect(provider);
      transport.onFrame!({
        eeg: { samples: [1] },
        battery: { samples: [50, 55, 60] },
      });
      expect(provider.getBatteryLevel()).toBe(60);
    });
  });

  describe('Accelerometer extraction', () => {
    it('computes accel magnitude from accgyro samples', async () => {
      const transport = await initAndConnect(provider);
      transport.onFrame!({
        eeg: { samples: [1] },
        accgyro: { samples: [[3, 4, 0]] },
      });
      expect(provider.getState().lastAccelMagnitude).toBeCloseTo(5, 5);
    });
  });

  describe('Sample buffer management', () => {
    it('caps buffer at 256 samples, evicting old ones', async () => {
      const transport = await initAndConnect(provider);
      transport.onFrame!(makeEegFrame(Array.from({ length: 300 }, (_, i) => i)));

      const recent = provider.getRecentSamples();
      expect(recent.length).toBeLessThanOrEqual(256);
      expect(recent[recent.length - 1]).toBe(299);
    });

    it('accumulates samples from successive frames', async () => {
      const transport = await initAndConnect(provider);
      transport.onFrame!(makeEegFrame([10, 20, 30]));
      transport.onFrame!(makeEegFrame([40, 50]));

      const recent = provider.getRecentSamples();
      expect(recent).toEqual([10, 20, 30, 40, 50]);
    });
  });

  describe('Error classification', () => {
    it('classifies "globally disabled" as no_bluetooth', async () => {
      await provider.initAsync();
      Object.defineProperty(globalThis, 'navigator', {
        value: { bluetooth: {} },
        configurable: true,
        writable: true,
      });

      const { BleTransport } = await import('@elata-biosciences/eeg-web-ble');
      (BleTransport as ReturnType<typeof vi.fn>).mockImplementationOnce(() => ({
        connect: vi.fn().mockRejectedValue(new Error('Bluetooth globally disabled')),
        start: vi.fn(),
        stop: vi.fn(),
        disconnect: vi.fn(),
        onStatus: null,
        onFrame: null,
      }));

      await provider.connect();
      expect(provider.getLastError()).toBe('no_bluetooth');
    });

    it('classifies "permission denied" as permission_denied', async () => {
      await provider.initAsync();
      Object.defineProperty(globalThis, 'navigator', {
        value: { bluetooth: {} },
        configurable: true,
        writable: true,
      });

      const { BleTransport } = await import('@elata-biosciences/eeg-web-ble');
      (BleTransport as ReturnType<typeof vi.fn>).mockImplementationOnce(() => ({
        connect: vi.fn().mockRejectedValue(new Error('User denied permission')),
        start: vi.fn(),
        stop: vi.fn(),
        disconnect: vi.fn(),
        onStatus: null,
        onFrame: null,
      }));

      await provider.connect();
      expect(provider.getLastError()).toBe('permission_denied');
    });

    it('classifies "not found" as not_found', async () => {
      await provider.initAsync();
      Object.defineProperty(globalThis, 'navigator', {
        value: { bluetooth: {} },
        configurable: true,
        writable: true,
      });

      const { BleTransport } = await import('@elata-biosciences/eeg-web-ble');
      (BleTransport as ReturnType<typeof vi.fn>).mockImplementationOnce(() => ({
        connect: vi.fn().mockRejectedValue(new Error('User cancelled the requestDevice() chooser')),
        start: vi.fn(),
        stop: vi.fn(),
        disconnect: vi.fn(),
        onStatus: null,
        onFrame: null,
      }));

      await provider.connect();
      expect(provider.getLastError()).toBe('not_found');
    });

    it('classifies unknown errors as unknown', async () => {
      await provider.initAsync();
      Object.defineProperty(globalThis, 'navigator', {
        value: { bluetooth: {} },
        configurable: true,
        writable: true,
      });

      const { BleTransport } = await import('@elata-biosciences/eeg-web-ble');
      (BleTransport as ReturnType<typeof vi.fn>).mockImplementationOnce(() => ({
        connect: vi.fn().mockRejectedValue(new Error('Something went wrong')),
        start: vi.fn(),
        stop: vi.fn(),
        disconnect: vi.fn(),
        onStatus: null,
        onFrame: null,
      }));

      await provider.connect();
      expect(provider.getLastError()).toBe('unknown');
    });
  });

  describe('Reconnect logic', () => {
    it('schedules reconnect on recoverable disconnect', async () => {
      vi.useFakeTimers();
      const transport = await initAndConnect(provider);

      transport.onStatus!({ state: 'disconnected', recoverable: true });

      expect(provider.getState().reconnecting).toBe(true);
      expect(provider.isConnected()).toBe(false);
      vi.useRealTimers();
    });

    it('calls onDisconnect when not recoverable', async () => {
      const onDisconnect = vi.fn();
      provider.setCallbacks(onDisconnect, vi.fn());
      const transport = await initAndConnect(provider);

      transport.onStatus!({ state: 'disconnected', recoverable: false });

      expect(onDisconnect).toHaveBeenCalled();
      expect(provider.getState().reconnecting).toBe(false);
    });

    it('updates state on transport connected status', async () => {
      const onReconnect = vi.fn();
      provider.setCallbacks(vi.fn(), onReconnect);
      const transport = await initAndConnect(provider);

      transport.onStatus!({ state: 'disconnected', recoverable: false });
      expect(provider.isConnected()).toBe(false);

      transport.onStatus!({ state: 'connected' });
      expect(provider.isConnected()).toBe(true);
      expect(onReconnect).toHaveBeenCalled();
    });
  });

  describe('Signal quality', () => {
    it('increases signal quality as buffer fills', async () => {
      const transport = await initAndConnect(provider);
      transport.onFrame!(makeEegFrame(Array.from({ length: 32 }, () => 1)));

      const q = provider.getState().signalQuality;
      expect(q).toBeGreaterThan(0);
      expect(q).toBeLessThan(1);
    });
  });

  describe('Destroy after connect', () => {
    it('cleans up transport and state on destroy', async () => {
      const transport = await initAndConnect(provider);
      provider.destroy();

      expect(provider.isConnected()).toBe(false);
      expect(provider.getState().connected).toBe(false);
      expect(provider.getState().reconnecting).toBe(false);
      expect(transport.stop).toHaveBeenCalled();
      expect(transport.disconnect).toHaveBeenCalled();
    });
  });

  describe('Pub/sub subscribeState', () => {
    it('subscriber receives current state immediately on subscribe', () => {
      const cb = vi.fn();
      provider.subscribeState(cb);
      expect(cb).toHaveBeenCalledTimes(1);
      expect(cb).toHaveBeenCalledWith(provider.getState());
    });

    it('subscriber receives updates when frames are processed', async () => {
      const transport = await initAndConnect(provider);
      const cb = vi.fn();
      provider.subscribeState(cb);
      cb.mockClear();

      const samples = Array.from({ length: 128 }, (_, i) => Math.sin(i * 0.1));
      transport.onFrame!(makeEegFrame(samples));

      expect(cb).toHaveBeenCalled();
      const lastCall = cb.mock.calls[cb.mock.calls.length - 1][0];
      expect(lastCall.alphaPower).not.toBeNull();
    });

    it('unsubscribe stops delivery', async () => {
      const transport = await initAndConnect(provider);
      const cb = vi.fn();
      const unsub = provider.subscribeState(cb);
      cb.mockClear();

      unsub();

      transport.onFrame!(makeEegFrame(Array.from({ length: 128 }, () => 1)));
      expect(cb).not.toHaveBeenCalled();
    });

    it('multiple subscribers each receive updates independently', async () => {
      const transport = await initAndConnect(provider);
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      provider.subscribeState(cb1);
      provider.subscribeState(cb2);
      cb1.mockClear();
      cb2.mockClear();

      transport.onFrame!(makeEegFrame(Array.from({ length: 128 }, () => 1)));

      expect(cb1).toHaveBeenCalled();
      expect(cb2).toHaveBeenCalled();
    });

    it('unsubscribing one does not affect the other', async () => {
      const transport = await initAndConnect(provider);
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      const unsub1 = provider.subscribeState(cb1);
      provider.subscribeState(cb2);
      cb1.mockClear();
      cb2.mockClear();

      unsub1();
      transport.onFrame!(makeEegFrame(Array.from({ length: 128 }, () => 1)));

      expect(cb1).not.toHaveBeenCalled();
      expect(cb2).toHaveBeenCalled();
    });

    it('subscriber receives updates on status changes', async () => {
      const transport = await initAndConnect(provider);
      const cb = vi.fn();
      provider.subscribeState(cb);
      cb.mockClear();

      transport.onStatus!({ state: 'disconnected', recoverable: false });

      expect(cb).toHaveBeenCalled();
      const lastCall = cb.mock.calls[cb.mock.calls.length - 1][0];
      expect(lastCall.connected).toBe(false);
    });
  });
});
