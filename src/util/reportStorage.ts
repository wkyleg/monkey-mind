import type { SessionReport } from '../gameplay/sessionRecorder';

const STORAGE_KEY = 'monkey-mind-reports';
const MAX_REPORTS = 30;

export function saveReport(report: SessionReport): void {
  try {
    const existing = getReports();
    existing.push(report);
    while (existing.length > MAX_REPORTS) existing.shift();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  } catch (e) {
    console.warn('[ReportStorage] Failed to save report:', e);
  }
}

export function getReports(): SessionReport[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SessionReport[];
  } catch {
    return [];
  }
}

export function getReport(levelId: string, timestamp: number): SessionReport | null {
  const reports = getReports();
  return reports.find((r) => r.levelId === levelId && r.startTime === timestamp) ?? null;
}

export function downloadReport(report: SessionReport): void {
  const json = JSON.stringify(report, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `monkey-mind-${report.levelId}-${report.startTime}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
