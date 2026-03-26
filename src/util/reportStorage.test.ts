/**
 * Report storage tests — persistence, retrieval, cap, and download.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionReport } from '../gameplay/sessionRecorder';
import { localStorageMock } from '../test/setup';
import { downloadReport, getReport, getReports, saveReport } from './reportStorage';

const STORAGE_KEY = 'monkey-mind-reports';
const MAX_REPORTS = 30;

function createMockReport(overrides: Partial<SessionReport> = {}): SessionReport {
  return {
    levelId: 'test-level',
    levelTitle: 'Test Level',
    actName: 'Test Act',
    startTime: 1_700_000_000_000,
    endTime: 1_700_000_060_000,
    durationMs: 60_000,
    samples: [],
    finalScore: 1000,
    maxCombo: 5,
    damagesTaken: 2,
    enemiesKilled: 10,
    alphaBumps: 1,
    dominantState: 'calm',
    avgCalm: 0.5,
    avgArousal: 0.4,
    avgBpm: 72,
    peakBpm: 90,
    minBpm: 65,
    netCalmChange: 0.1,
    netArousalChange: -0.05,
    ...overrides,
  };
}

describe('reportStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('saveReport', () => {
    it('should save to localStorage', () => {
      const report = createMockReport();

      saveReport(report);

      expect(localStorageMock.setItem).toHaveBeenCalledWith(STORAGE_KEY, JSON.stringify([report]));
      expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify([report]));
    });

    it('should cap at MAX_REPORTS (30)', () => {
      for (let i = 0; i < MAX_REPORTS + 1; i++) {
        saveReport(createMockReport({ levelId: 'lvl', startTime: 1000 + i }));
      }

      const reports = getReports();
      expect(reports).toHaveLength(MAX_REPORTS);
      expect(reports[0]?.startTime).toBe(1001);
      expect(reports[MAX_REPORTS - 1]?.startTime).toBe(1000 + MAX_REPORTS);
    });
  });

  describe('getReports', () => {
    it('should return saved reports', () => {
      const a = createMockReport({ levelId: 'a', startTime: 1 });
      const b = createMockReport({ levelId: 'b', startTime: 2 });
      saveReport(a);
      saveReport(b);

      expect(getReports()).toEqual([a, b]);
    });

    it('should return empty array when no reports exist', () => {
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
      expect(getReports()).toEqual([]);
    });
  });

  describe('getReport', () => {
    it('should find specific report by levelId and startTime', () => {
      const match = createMockReport({ levelId: 'level-a', startTime: 42 });
      const other = createMockReport({ levelId: 'level-b', startTime: 99 });
      saveReport(match);
      saveReport(other);

      expect(getReport('level-a', 42)).toEqual(match);
      expect(getReport('level-b', 99)).toEqual(other);
      expect(getReport('level-a', 99)).toBeNull();
      expect(getReport('missing', 42)).toBeNull();
    });
  });

  describe('downloadReport', () => {
    it('should create a blob URL and trigger download', () => {
      const report = createMockReport({ levelId: 'my-level', startTime: 12345 });
      const createObjectURL = vi.fn(() => 'blob:mock-url');
      const revokeObjectURL = vi.fn();
      vi.stubGlobal('URL', {
        ...URL,
        createObjectURL,
        revokeObjectURL,
      });

      const clickSpy = vi.fn();
      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'a') {
          return {
            href: '',
            download: '',
            click: clickSpy,
          } as unknown as HTMLAnchorElement;
        }
        return originalCreateElement(tag);
      });
      const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((n) => n);
      const removeSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((n) => n);

      downloadReport(report);

      expect(createObjectURL).toHaveBeenCalledTimes(1);
      const blobArg = (createObjectURL.mock.calls as unknown[][])[0]?.[0];
      expect(blobArg).toBeInstanceOf(Blob);
      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(appendSpy).toHaveBeenCalledTimes(1);
      expect(removeSpy).toHaveBeenCalledTimes(1);
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });
  });
});
