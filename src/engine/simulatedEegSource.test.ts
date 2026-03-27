import { afterEach, describe, expect, it, vi } from 'vitest';
import { SimulatedEegSource } from './simulatedEegSource';

describe('SimulatedEegSource', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits eeg frames with sample-major data and expected channel count', () => {
    vi.useFakeTimers();
    const src = new SimulatedEegSource();
    const seen: unknown[] = [];

    src.start((frame) => {
      seen.push(frame);
    });

    vi.advanceTimersByTime(150);
    src.stop();

    expect(seen.length).toBeGreaterThan(0);
    const frame = seen[0] as Record<string, unknown>;
    expect(frame.type).toBe('eeg');
    expect(frame.fs).toBe(256);
    expect(frame.channels).toEqual(['TP9', 'AF7', 'AF8', 'TP10']);
    expect(Array.isArray(frame.data)).toBe(true);
    const data = frame.data as number[][];
    expect(data.length).toBeGreaterThan(0);
    expect(Array.isArray(data[0])).toBe(true);
    expect(data[0].length).toBe(4);
  });

  it('generates 32 samples per chunk', () => {
    vi.useFakeTimers();
    const src = new SimulatedEegSource();
    const seen: unknown[] = [];

    src.start((frame) => {
      seen.push(frame);
    });

    vi.advanceTimersByTime(200);
    src.stop();

    const frame = seen[0] as { data: number[][] };
    expect(frame.data).toHaveLength(32);
  });

  it('stop() clears the timer', () => {
    vi.useFakeTimers();
    const src = new SimulatedEegSource();
    const seen: unknown[] = [];

    src.start((frame) => {
      seen.push(frame);
    });

    vi.advanceTimersByTime(150);
    const countAfterStart = seen.length;

    src.stop();
    vi.advanceTimersByTime(500);

    expect(seen.length).toBe(countAfterStart);
  });

  it('start() stops previous timer before starting new one', () => {
    vi.useFakeTimers();
    const src = new SimulatedEegSource();
    const seen1: unknown[] = [];
    const seen2: unknown[] = [];

    src.start((frame) => seen1.push(frame));
    vi.advanceTimersByTime(150);
    const count1 = seen1.length;

    src.start((frame) => seen2.push(frame));
    vi.advanceTimersByTime(150);
    src.stop();

    expect(count1).toBeGreaterThan(0);
    expect(seen2.length).toBeGreaterThan(0);
    expect(seen1.length).toBe(count1);
  });

  it('generates finite numeric values in each sample', () => {
    vi.useFakeTimers();
    const src = new SimulatedEegSource();
    let frame: { data: number[][] } | null = null;

    src.start((f) => {
      if (!frame) frame = f as { data: number[][] };
    });

    vi.advanceTimersByTime(150);
    src.stop();

    expect(frame).not.toBeNull();
    for (const sample of frame!.data) {
      for (const val of sample) {
        expect(typeof val).toBe('number');
        expect(Number.isFinite(val)).toBe(true);
      }
    }
  });

  it('includes a timestamp in each frame', () => {
    vi.useFakeTimers();
    const src = new SimulatedEegSource();
    let frame: { timestamp?: number } | null = null;

    src.start((f) => {
      if (!frame) frame = f as { timestamp?: number };
    });

    vi.advanceTimersByTime(150);
    src.stop();

    expect(frame).not.toBeNull();
    expect(typeof frame!.timestamp).toBe('number');
    expect(frame!.timestamp).toBeGreaterThan(0);
  });
});
