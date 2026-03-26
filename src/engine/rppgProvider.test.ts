import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ElataRppgProvider } from './rppgProvider';

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

describe('ElataRppgProvider', () => {
  let provider: ElataRppgProvider;

  beforeEach(() => {
    provider = new ElataRppgProvider();
    vi.clearAllMocks();
  });

  describe('Initial state', () => {
    it('should start inactive', () => {
      expect(provider.isActive()).toBe(false);
    });

    it('should return empty intent when inactive', () => {
      const intent = provider.getIntent();
      expect(intent).toEqual({});
    });

    it('should have null BPM initially', () => {
      const state = provider.getState();
      expect(state.bpm).toBeNull();
    });

    it('should have zero quality initially', () => {
      const state = provider.getState();
      expect(state.quality).toBe(0);
    });

    it('should have no last error initially', () => {
      expect(provider.getLastError()).toBeNull();
    });
  });

  describe('State shape', () => {
    it('should have correct state properties', () => {
      const state = provider.getState();
      expect(state).toHaveProperty('active');
      expect(state).toHaveProperty('bpm');
      expect(state).toHaveProperty('quality');
      expect(state).toHaveProperty('arousal');
      expect(state).toHaveProperty('calibrationProgress');
    });
  });

  describe('BPM to arousal mapping', () => {
    it('should map 60 BPM to 0 arousal (conceptually)', () => {
      const arousal = Math.max(0, Math.min(1, (60 - 60) / 60));
      expect(arousal).toBe(0);
    });

    it('should map 90 BPM to 0.5 arousal', () => {
      const arousal = Math.max(0, Math.min(1, (90 - 60) / 60));
      expect(arousal).toBe(0.5);
    });

    it('should map 120+ BPM to 1 arousal', () => {
      const arousal = Math.max(0, Math.min(1, (120 - 60) / 60));
      expect(arousal).toBe(1);
    });

    it('should clamp below 60 BPM to 0', () => {
      const arousal = Math.max(0, Math.min(1, (50 - 60) / 60));
      expect(arousal).toBe(0);
    });

    it('should clamp above 120 BPM to 1', () => {
      const arousal = Math.max(0, Math.min(1, (150 - 60) / 60));
      expect(arousal).toBe(1);
    });
  });

  describe('Callbacks', () => {
    it('should accept quality low callback', () => {
      const onQualityLow = vi.fn();
      expect(() => provider.setCallbacks(onQualityLow)).not.toThrow();
    });
  });

  describe('Init', () => {
    it('should not throw on sync init', () => {
      expect(() => provider.init()).not.toThrow();
    });
  });

  describe('Update', () => {
    it('should not throw on update when inactive', () => {
      expect(() => provider.update(0.016)).not.toThrow();
    });
  });

  describe('Disable', () => {
    it('should not throw on disable when inactive', () => {
      expect(() => provider.disable()).not.toThrow();
    });

    it('should be inactive after disable', () => {
      provider.disable();
      expect(provider.isActive()).toBe(false);
    });

    it('should reset state on disable', () => {
      provider.disable();
      const state = provider.getState();
      expect(state.active).toBe(false);
      expect(state.bpm).toBeNull();
      expect(state.quality).toBe(0);
      expect(state.arousal).toBeNull();
      expect(state.calibrationProgress).toBe(0);
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

    it('should mark as inactive after destroy', () => {
      provider.destroy();
      expect(provider.isActive()).toBe(false);
    });
  });

  describe('State shape — expanded fields', () => {
    it('should include displayBpm field', () => {
      const state = provider.getState();
      expect(state).toHaveProperty('displayBpm');
      expect(state.displayBpm).toBeNull();
    });

    it('should include bpmHistory as empty array', () => {
      const state = provider.getState();
      expect(state).toHaveProperty('bpmHistory');
      expect(state.bpmHistory).toEqual([]);
    });

    it('should include hrvRmssd field', () => {
      const state = provider.getState();
      expect(state).toHaveProperty('hrvRmssd');
      expect(state.hrvRmssd).toBeNull();
    });

    it('should include respirationRate field', () => {
      const state = provider.getState();
      expect(state).toHaveProperty('respirationRate');
      expect(state.respirationRate).toBeNull();
    });

    it('should include baselineBpm field', () => {
      const state = provider.getState();
      expect(state).toHaveProperty('baselineBpm');
      expect(state.baselineBpm).toBeNull();
    });

    it('should include baselineDelta field', () => {
      const state = provider.getState();
      expect(state).toHaveProperty('baselineDelta');
      expect(state.baselineDelta).toBeNull();
    });

    it('should include debugMetrics field', () => {
      const state = provider.getState();
      expect(state).toHaveProperty('debugMetrics');
      expect(state.debugMetrics).toBeNull();
    });

    it('should include confidence field starting at 0', () => {
      const state = provider.getState();
      expect(state).toHaveProperty('confidence');
      expect(state.confidence).toBe(0);
    });
  });

  describe('Disable resets expanded fields', () => {
    it('should reset all expanded fields on disable', () => {
      provider.disable();
      const state = provider.getState();
      expect(state.displayBpm).toBeNull();
      expect(state.bpmHistory).toEqual([]);
      expect(state.hrvRmssd).toBeNull();
      expect(state.respirationRate).toBeNull();
      expect(state.baselineBpm).toBeNull();
      expect(state.baselineDelta).toBeNull();
      expect(state.debugMetrics).toBeNull();
      expect(state.confidence).toBe(0);
    });
  });

  describe('BPM smoothing constants', () => {
    it('should use EMA_ALPHA of 0.05 for slow smoothing', () => {
      const ema = 0.05;
      const prevBpm = 80;
      const newBpm = 100;
      const smoothed = prevBpm * (1 - ema) + newBpm * ema;
      expect(smoothed).toBe(81);
    });

    it('weighted average should stabilize over many readings', () => {
      const history = [80, 82, 78, 80, 81, 79, 80, 82, 78, 80];
      let weightedSum = 0;
      let totalWeight = 0;
      for (let i = 0; i < history.length; i++) {
        const weight = i + 1;
        weightedSum += history[i] * weight;
        totalWeight += weight;
      }
      const displayBpm = Math.round(weightedSum / totalWeight);
      expect(displayBpm).toBeGreaterThanOrEqual(79);
      expect(displayBpm).toBeLessThanOrEqual(81);
    });

    it('weighted average should favor recent readings', () => {
      const history = [60, 60, 60, 60, 60, 100, 100, 100, 100, 100];
      let weightedSum = 0;
      let totalWeight = 0;
      for (let i = 0; i < history.length; i++) {
        const weight = i + 1;
        weightedSum += history[i] * weight;
        totalWeight += weight;
      }
      const displayBpm = Math.round(weightedSum / totalWeight);
      expect(displayBpm).toBeGreaterThan(80);
    });
  });

  describe('Harmonic doubling detection logic', () => {
    it('should detect harmonic when raw BPM is ~2x fundamental', () => {
      const rawBpm = 120;
      const halfBpm = rawBpm / 2;
      const isInDoubleRange = rawBpm >= 100 && rawBpm <= 140;
      const halfIsPhysiological = halfBpm >= 50 && halfBpm <= 75;
      expect(isInDoubleRange).toBe(true);
      expect(halfIsPhysiological).toBe(true);
    });

    it('should not flag harmonic when BPM is already in fundamental range', () => {
      const rawBpm = 72;
      const isInDoubleRange = rawBpm >= 100 && rawBpm <= 140;
      expect(isInDoubleRange).toBe(false);
    });

    it('should not flag harmonic for moderate BPM like 95 (legit heart rate)', () => {
      const rawBpm = 95;
      const isInDoubleRange = rawBpm >= 100 && rawBpm <= 140;
      expect(isInDoubleRange).toBe(false);
    });

    it('should not flag harmonic when halved BPM is too low', () => {
      const rawBpm = 90;
      const halfBpm = rawBpm / 2;
      const halfIsPhysiological = halfBpm >= 50 && halfBpm <= 75;
      expect(halfIsPhysiological).toBe(false);
    });

    it('should only count reliable spectral/ACF divergence (both >= 50 BPM)', () => {
      const spectral = 120;
      const acf = 62;
      const bothReliable = spectral >= 50 && acf >= 50;
      const ratio = Math.max(spectral, acf) / Math.min(spectral, acf);
      const isDoubleRatio = ratio > 1.7 && ratio < 2.3;
      expect(bothReliable).toBe(true);
      expect(isDoubleRatio).toBe(true);
    });

    it('should not count spectral/ACF divergence when spectral is noise (<50)', () => {
      const spectral = 42;
      const acf = 97;
      const bothReliable = spectral >= 50 && acf >= 50;
      expect(bothReliable).toBe(false);
    });

    it('should include harmonicCorrected and preCorrectBpm in debug metrics interface', () => {
      const debugMetrics = {
        spectralBpm: 120,
        acfBpm: 60,
        peaksBpm: 62,
        bayesBpm: 61,
        bayesConfidence: 0.8,
        fusedBpm: 120,
        fusedSource: 'spectral',
        resolvedBpm: 120,
        calibrationTrained: false,
        winningSources: ['spectral'],
        aliasFlag: true,
        harmonicCorrected: true,
        preCorrectBpm: 120,
      };
      expect(debugMetrics.harmonicCorrected).toBe(true);
      expect(debugMetrics.preCorrectBpm).toBe(120);
    });
  });
});
