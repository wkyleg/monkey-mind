import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NeuroState } from '../engine/neuroManager';
import { SessionRecorder } from './sessionRecorder';

/** Minimal valid NeuroState for SessionRecorder.sample() — self-contained for tests. */
function mockNeuro(overrides: Partial<NeuroState> = {}): NeuroState {
  return {
    source: 'mock',
    calm: 0.5,
    arousal: 0.4,
    bpm: 72,
    bpmQuality: 1,
    signalQuality: 1,
    eegConnected: false,
    cameraActive: false,
    alphaPower: 0.4,
    betaPower: 0.3,
    thetaPower: 0.2,
    deltaPower: 0.1,
    gammaPower: 0.05,
    alphaBump: false,
    hrvRmssd: 42,
    respirationRate: null,
    baselineBpm: null,
    baselineDelta: null,
    calmnessState: 'steady',
    alphaPeakFreq: null,
    alphaBumpState: null,
    ...overrides,
  };
}

describe('SessionRecorder', () => {
  let recorder: SessionRecorder;
  let nowMs: number;

  beforeEach(() => {
    recorder = new SessionRecorder();
    nowMs = 10_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => nowMs);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('start()', () => {
    it('should initialize recording state (metadata, active, cleared counters)', () => {
      nowMs = 1000;
      recorder.start('lvl_zoo', 'Zoo Escape', 'Act I');

      expect(recorder.isActive()).toBe(true);

      recorder.recordDamage();
      recorder.recordKill();
      recorder.recordAlphaBump();

      const report = recorder.stop(999);
      expect(report.levelId).toBe('lvl_zoo');
      expect(report.levelTitle).toBe('Zoo Escape');
      expect(report.actName).toBe('Act I');
      expect(report.startTime).toBe(1000);
      expect(report.samples).toEqual([]);
      expect(report.finalScore).toBe(999);
      expect(report.damagesTaken).toBe(1);
      expect(report.enemiesKilled).toBe(1);
      expect(report.alphaBumps).toBe(1);
      expect(report.maxCombo).toBe(0);
    });
  });

  describe('isActive()', () => {
    it('should return false before start and after stop, true after start', () => {
      expect(recorder.isActive()).toBe(false);

      recorder.start('a', 'b', 'c');
      expect(recorder.isActive()).toBe(true);

      recorder.stop(0);
      expect(recorder.isActive()).toBe(false);
    });
  });

  describe('sample()', () => {
    it('should not record samples when not active', () => {
      const neuro = mockNeuro();
      recorder.sample(1, neuro, 10, 0, 0, 100, 100);

      const report = recorder.stop(0);
      expect(report.samples).toHaveLength(0);
    });

    it('should record samples at SAMPLE_INTERVAL (1 second of dt)', () => {
      recorder.start('x', 'y', 'z');
      const neuro = mockNeuro();

      recorder.sample(0.4, neuro, 1, 0, 0, 100, 100);
      recorder.sample(0.4, neuro, 2, 0, 0, 100, 100);
      expect(recorder.stop(0).samples).toHaveLength(0);

      recorder.start('x', 'y', 'z');
      recorder.sample(0.99, neuro, 1, 0, 0, 100, 100);
      recorder.sample(0.02, neuro, 2, 0, 0, 100, 100);
      const one = recorder.stop(0).samples;
      expect(one).toHaveLength(1);
      expect(one[0].score).toBe(2);

      recorder.start('x', 'y', 'z');
      recorder.sample(1, neuro, 5, 0, 0, 100, 100);
      recorder.sample(1, neuro, 6, 0, 0, 100, 100);
      expect(recorder.stop(0).samples).toHaveLength(2);
    });

    it('should track max combo across sample() calls (even when no sample row is pushed yet)', () => {
      recorder.start('x', 'y', 'z');
      const neuro = mockNeuro();

      recorder.sample(0.01, neuro, 0, 3, 0, 100, 100);
      recorder.sample(0.01, neuro, 0, 7, 0, 100, 100);
      recorder.sample(1, neuro, 0, 2, 0, 100, 100);

      expect(recorder.stop(0).maxCombo).toBe(7);
    });
  });

  describe('recordDamage()', () => {
    it('should increment damage counter while active', () => {
      recorder.start('x', 'y', 'z');
      recorder.recordDamage();
      recorder.recordDamage();
      recorder.recordDamage();

      expect(recorder.stop(0).damagesTaken).toBe(3);
    });

    it('should not increment when never started or after stop', () => {
      recorder.recordDamage();
      recorder.recordDamage();
      expect(recorder.stop(0).damagesTaken).toBe(0);

      const r = new SessionRecorder();
      r.start('a', 'b', 'c');
      r.recordDamage();
      expect(r.stop(0).damagesTaken).toBe(1);
      r.recordDamage();
      expect(r.stop(0).damagesTaken).toBe(1);
    });
  });

  describe('recordKill()', () => {
    it('should increment kill counter while active', () => {
      recorder.start('x', 'y', 'z');
      recorder.recordKill();
      expect(recorder.stop(0).enemiesKilled).toBe(1);
    });
  });

  describe('recordAlphaBump()', () => {
    it('should increment alpha bump counter while active', () => {
      recorder.start('x', 'y', 'z');
      recorder.recordAlphaBump();
      recorder.recordAlphaBump();
      expect(recorder.stop(0).alphaBumps).toBe(2);
    });
  });

  describe('stop()', () => {
    it('should return a complete SessionReport with all expected stats', () => {
      const start = 5000;
      nowMs = start;
      recorder.start('lid', 'Title', 'ActName');

      nowMs = start + 2500;
      const neuro = mockNeuro({ calm: 0.2, arousal: 0.8 });
      recorder.sample(1, neuro, 10, 1, 42, 80, 100);
      recorder.sample(1, neuro, 20, 2, 43, 79, 100);

      recorder.recordDamage();
      recorder.recordKill();
      recorder.recordAlphaBump();

      nowMs = start + 5000;
      const report = recorder.stop(12345);

      expect(report.levelId).toBe('lid');
      expect(report.levelTitle).toBe('Title');
      expect(report.actName).toBe('ActName');
      expect(report.startTime).toBe(start);
      expect(report.endTime).toBe(start + 5000);
      expect(report.durationMs).toBe(5000);
      expect(report.samples).toHaveLength(2);
      expect(report.finalScore).toBe(12345);
      expect(report.maxCombo).toBe(2);
      expect(report.damagesTaken).toBe(1);
      expect(report.enemiesKilled).toBe(1);
      expect(report.alphaBumps).toBe(1);
      expect(typeof report.dominantState).toBe('string');
      expect(typeof report.avgCalm).toBe('number');
      expect(typeof report.avgArousal).toBe('number');
      expect(report).toHaveProperty('avgBpm');
      expect(report).toHaveProperty('peakBpm');
      expect(report).toHaveProperty('minBpm');
      expect(typeof report.netCalmChange).toBe('number');
      expect(typeof report.netArousalChange).toBe('number');
    });

    it('should compute correct avgBpm, peakBpm, minBpm from samples with bpm', () => {
      recorder.start('x', 'y', 'z');

      recorder.sample(1, mockNeuro({ bpm: 60 }), 0, 0, 0, 100, 100);
      recorder.sample(1, mockNeuro({ bpm: 100 }), 0, 0, 0, 100, 100);
      recorder.sample(1, mockNeuro({ bpm: 80 }), 0, 0, 0, 100, 100);

      const { avgBpm, peakBpm, minBpm } = recorder.stop(0);
      expect(avgBpm).toBeCloseTo(80, 5);
      expect(peakBpm).toBe(100);
      expect(minBpm).toBe(60);
    });

    it('should use null avgBpm and null peak/min when no sample has bpm', () => {
      recorder.start('x', 'y', 'z');
      recorder.sample(1, mockNeuro({ bpm: null }), 0, 0, 0, 100, 100);

      const { avgBpm, peakBpm, minBpm } = recorder.stop(0);
      expect(avgBpm).toBeNull();
      expect(peakBpm).toBeNull();
      expect(minBpm).toBeNull();
    });

    it('should compute netCalmChange and netArousalChange from first vs last window', () => {
      recorder.start('x', 'y', 'z');

      for (let i = 0; i < 5; i++) {
        recorder.sample(1, mockNeuro({ calm: 0, arousal: 10 }), 0, 0, 0, 100, 100);
      }
      for (let i = 0; i < 5; i++) {
        recorder.sample(1, mockNeuro({ calm: 10, arousal: 0 }), 0, 0, 0, 100, 100);
      }

      const { netCalmChange, netArousalChange } = recorder.stop(0);
      expect(netCalmChange).toBe(10);
      expect(netArousalChange).toBe(-10);
    });

    it('should compute dominantState as the band with greatest total power', () => {
      recorder.start('x', 'y', 'z');
      recorder.sample(1, mockNeuro({ alphaPower: 9, betaPower: 2, thetaPower: 1 }), 0, 0, 0, 100, 100);
      expect(recorder.stop(0).dominantState).toBe('ALPHA — relaxed focus');

      recorder.start('x', 'y', 'z');
      recorder.sample(1, mockNeuro({ alphaPower: 1, betaPower: 10, thetaPower: 2 }), 0, 0, 0, 100, 100);
      expect(recorder.stop(0).dominantState).toBe('BETA — active thinking');

      recorder.start('x', 'y', 'z');
      recorder.sample(1, mockNeuro({ alphaPower: 1, betaPower: 2, thetaPower: 20 }), 0, 0, 0, 100, 100);
      expect(recorder.stop(0).dominantState).toBe('THETA — deep relaxation');
    });

    it('should set dominantState to No EEG data when all band powers are zero', () => {
      recorder.start('x', 'y', 'z');
      recorder.sample(1, mockNeuro({ alphaPower: 0, betaPower: 0, thetaPower: 0 }), 0, 0, 0, 100, 100);
      expect(recorder.stop(0).dominantState).toBe('No EEG data');
    });
  });

  describe('health tracking', () => {
    it('should include health and healthMax on each recorded sample', () => {
      recorder.start('x', 'y', 'z');
      recorder.sample(1, mockNeuro(), 0, 0, 0, 73, 120);
      recorder.sample(1, mockNeuro(), 0, 0, 0, 50, 120);

      const { samples } = recorder.stop(0);
      expect(samples[0].health).toBe(73);
      expect(samples[0].healthMax).toBe(120);
      expect(samples[1].health).toBe(50);
      expect(samples[1].healthMax).toBe(120);
    });
  });
});
