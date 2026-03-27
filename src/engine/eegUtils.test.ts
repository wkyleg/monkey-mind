import { describe, expect, it } from 'vitest';
import {
  asChannelMajor,
  averageBands,
  computeBandPowersFallback,
  type EegBands,
  extractBandsFromWasmResult,
} from './eegUtils';

describe('asChannelMajor', () => {
  it('returns empty array for empty input', () => {
    expect(asChannelMajor([])).toEqual([]);
  });

  it('returns empty array for non-array input', () => {
    expect(asChannelMajor(null as unknown as number[][])).toEqual([]);
  });

  it('returns channel-major data unchanged when outer dimension matches expected channels', () => {
    const data = [
      [1, 2, 3],
      [4, 5, 6],
    ];
    const out = asChannelMajor(data, 2);
    expect(out).toEqual(data);
  });

  it('transposes sample-major data to channel-major', () => {
    const data = [
      [1, 4],
      [2, 5],
      [3, 6],
    ];
    const out = asChannelMajor(data, 2);
    expect(out).toEqual([
      [1, 2, 3],
      [4, 5, 6],
    ]);
  });

  it('uses heuristic when no expectedChannels provided', () => {
    const sampleMajor = [
      [10, 20, 30, 40],
      [11, 21, 31, 41],
      [12, 22, 32, 42],
      [13, 23, 33, 43],
      [14, 24, 34, 44],
    ];
    const result = asChannelMajor(sampleMajor);
    expect(result).toHaveLength(4);
    expect(result[0]).toEqual([10, 11, 12, 13, 14]);
    expect(result[3]).toEqual([40, 41, 42, 43, 44]);
  });

  it('handles square frame with expectedChannels by transposing', () => {
    const data = [
      [1, 2],
      [3, 4],
    ];
    const out = asChannelMajor(data, 2);
    expect(out).toEqual([
      [1, 3],
      [2, 4],
    ]);
  });
});

describe('averageBands', () => {
  it('returns null for empty input', () => {
    expect(averageBands([])).toBeNull();
  });

  it('returns the same bands for single channel', () => {
    const bands: EegBands = { delta: 1, theta: 2, alpha: 3, beta: 4, gamma: 5 };
    const result = averageBands([bands]);
    expect(result).toEqual(bands);
  });

  it('averages across multiple channels', () => {
    const ch1: EegBands = { delta: 2, theta: 4, alpha: 6, beta: 8, gamma: 10 };
    const ch2: EegBands = { delta: 4, theta: 6, alpha: 8, beta: 10, gamma: 12 };
    const result = averageBands([ch1, ch2]);
    expect(result).toEqual({ delta: 3, theta: 5, alpha: 7, beta: 9, gamma: 11 });
  });

  it('averages three channels correctly', () => {
    const channels: EegBands[] = [
      { delta: 3, theta: 6, alpha: 9, beta: 12, gamma: 15 },
      { delta: 6, theta: 9, alpha: 12, beta: 15, gamma: 18 },
      { delta: 9, theta: 12, alpha: 15, beta: 18, gamma: 21 },
    ];
    const result = averageBands(channels)!;
    expect(result.delta).toBe(6);
    expect(result.theta).toBe(9);
    expect(result.alpha).toBe(12);
    expect(result.beta).toBe(15);
    expect(result.gamma).toBe(18);
  });
});

describe('extractBandsFromWasmResult', () => {
  it('extracts valid band values', () => {
    const result = extractBandsFromWasmResult({
      delta: 1.5,
      theta: 2.5,
      alpha: 3.5,
      beta: 4.5,
      gamma: 5.5,
    });
    expect(result).toEqual({
      delta: 1.5,
      theta: 2.5,
      alpha: 3.5,
      beta: 4.5,
      gamma: 5.5,
    });
  });

  it('replaces missing fields with 0', () => {
    const result = extractBandsFromWasmResult({});
    expect(result).toEqual({ delta: 0, theta: 0, alpha: 0, beta: 0, gamma: 0 });
  });

  it('replaces NaN values with 0', () => {
    const result = extractBandsFromWasmResult({
      delta: NaN,
      theta: Infinity,
      alpha: -Infinity,
      beta: 'not a number',
      gamma: null,
    });
    expect(result).toEqual({ delta: 0, theta: 0, alpha: 0, beta: 0, gamma: 0 });
  });
});

describe('computeBandPowersFallback', () => {
  it('returns zeros for empty samples', () => {
    const result = computeBandPowersFallback([], 256);
    expect(result).toEqual({ delta: 0, theta: 0, alpha: 0, beta: 0, gamma: 0 });
  });

  it('detects a 10 Hz sine wave in the alpha band', () => {
    const sampleRate = 256;
    const numSamples = 256;
    const freq = 10;
    const samples: number[] = [];
    for (let i = 0; i < numSamples; i++) {
      samples.push(Math.sin((2 * Math.PI * freq * i) / sampleRate));
    }
    const result = computeBandPowersFallback(samples, sampleRate);
    expect(result.alpha).toBeGreaterThan(0);
    expect(result.alpha).toBeGreaterThan(result.delta);
    expect(result.alpha).toBeGreaterThan(result.theta);
    expect(result.alpha).toBeGreaterThan(result.beta);
    expect(result.alpha).toBeGreaterThan(result.gamma);
  });

  it('detects a 20 Hz sine wave in the beta band', () => {
    const sampleRate = 256;
    const numSamples = 256;
    const freq = 20;
    const samples: number[] = [];
    for (let i = 0; i < numSamples; i++) {
      samples.push(Math.sin((2 * Math.PI * freq * i) / sampleRate));
    }
    const result = computeBandPowersFallback(samples, sampleRate);
    expect(result.beta).toBeGreaterThan(0);
    expect(result.beta).toBeGreaterThan(result.delta);
    expect(result.beta).toBeGreaterThan(result.theta);
    expect(result.beta).toBeGreaterThan(result.alpha);
  });

  it('returns finite values for random input', () => {
    const samples = Array.from({ length: 128 }, () => Math.random() * 2 - 1);
    const result = computeBandPowersFallback(samples, 256);
    for (const band of ['delta', 'theta', 'alpha', 'beta', 'gamma'] as const) {
      expect(Number.isFinite(result[band])).toBe(true);
      expect(result[band]).toBeGreaterThanOrEqual(0);
    }
  });
});
