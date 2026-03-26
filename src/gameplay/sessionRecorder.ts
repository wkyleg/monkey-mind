import type { NeuroState } from '../engine/neuroManager';

export interface SessionSample {
  t: number;
  calm: number;
  arousal: number;
  alpha: number;
  beta: number;
  theta: number;
  delta: number;
  gamma: number;
  bpm: number | null;
  hrv: number | null;
  score: number;
  combo: number;
  playerX: number;
  calmnessState: string | null;
  health: number;
  healthMax: number;
}

export interface SessionReport {
  levelId: string;
  levelTitle: string;
  actName: string;
  startTime: number;
  endTime: number;
  durationMs: number;
  samples: SessionSample[];
  finalScore: number;
  maxCombo: number;
  damagesTaken: number;
  enemiesKilled: number;
  alphaBumps: number;
  dominantState: string;
  avgCalm: number;
  avgArousal: number;
  avgBpm: number | null;
  peakBpm: number | null;
  minBpm: number | null;
  netCalmChange: number;
  netArousalChange: number;
}

const SAMPLE_INTERVAL = 1;

export class SessionRecorder {
  private samples: SessionSample[] = [];
  private sampleTimer = 0;
  private startTime = 0;
  private levelId = '';
  private levelTitle = '';
  private actName = '';
  private active = false;
  private damagesTaken = 0;
  private enemiesKilled = 0;
  private alphaBumps = 0;
  private maxCombo = 0;

  start(levelId: string, levelTitle: string, actName: string): void {
    this.samples = [];
    this.sampleTimer = 0;
    this.startTime = Date.now();
    this.levelId = levelId;
    this.levelTitle = levelTitle;
    this.actName = actName;
    this.active = true;
    this.damagesTaken = 0;
    this.enemiesKilled = 0;
    this.alphaBumps = 0;
    this.maxCombo = 0;
  }

  sample(
    dt: number,
    neuro: NeuroState,
    score: number,
    combo: number,
    playerX: number,
    health: number,
    healthMax: number,
  ): void {
    if (!this.active) return;
    this.sampleTimer += dt;
    if (combo > this.maxCombo) this.maxCombo = combo;
    if (this.sampleTimer < SAMPLE_INTERVAL) return;
    this.sampleTimer -= SAMPLE_INTERVAL;

    this.samples.push({
      t: (Date.now() - this.startTime) / 1000,
      calm: neuro.calm,
      arousal: neuro.arousal,
      alpha: neuro.alphaPower ?? 0,
      beta: neuro.betaPower ?? 0,
      theta: neuro.thetaPower ?? 0,
      delta: neuro.deltaPower ?? 0,
      gamma: neuro.gammaPower ?? 0,
      bpm: neuro.bpm,
      hrv: neuro.hrvRmssd,
      score,
      combo,
      playerX,
      calmnessState: neuro.calmnessState,
      health,
      healthMax,
    });
  }

  recordDamage(): void {
    if (this.active) this.damagesTaken++;
  }

  recordKill(): void {
    if (this.active) this.enemiesKilled++;
  }

  recordAlphaBump(): void {
    if (this.active) this.alphaBumps++;
  }

  isActive(): boolean {
    return this.active;
  }

  stop(finalScore: number): SessionReport {
    this.active = false;
    const endTime = Date.now();
    const durationMs = endTime - this.startTime;
    const s = this.samples;

    let avgCalm = 0;
    let avgArousal = 0;
    let bpmSum = 0;
    let bpmCount = 0;
    let peakBpm: number | null = null;
    let minBpm: number | null = null;

    for (const sample of s) {
      avgCalm += sample.calm;
      avgArousal += sample.arousal;
      if (sample.bpm != null) {
        bpmSum += sample.bpm;
        bpmCount++;
        if (peakBpm === null || sample.bpm > peakBpm) peakBpm = sample.bpm;
        if (minBpm === null || sample.bpm < minBpm) minBpm = sample.bpm;
      }
    }

    const n = s.length || 1;
    avgCalm /= n;
    avgArousal /= n;
    const avgBpm = bpmCount > 0 ? bpmSum / bpmCount : null;

    // Net change: average of first 5s vs last 5s
    const windowSize = Math.min(5, Math.floor(n / 2)) || 1;
    const firstCalm = s.slice(0, windowSize).reduce((a, v) => a + v.calm, 0) / windowSize;
    const lastCalm = s.slice(-windowSize).reduce((a, v) => a + v.calm, 0) / windowSize;
    const firstArousal = s.slice(0, windowSize).reduce((a, v) => a + v.arousal, 0) / windowSize;
    const lastArousal = s.slice(-windowSize).reduce((a, v) => a + v.arousal, 0) / windowSize;

    // Dominant brain state
    let alphaTotal = 0,
      betaTotal = 0,
      thetaTotal = 0;
    for (const sample of s) {
      alphaTotal += sample.alpha;
      betaTotal += sample.beta;
      thetaTotal += sample.theta;
    }
    const bands = [
      { name: 'ALPHA — relaxed focus', val: alphaTotal },
      { name: 'BETA — active thinking', val: betaTotal },
      { name: 'THETA — deep relaxation', val: thetaTotal },
    ];
    bands.sort((a, b) => b.val - a.val);
    const dominantState = bands[0]?.val > 0 ? bands[0].name : 'No EEG data';

    return {
      levelId: this.levelId,
      levelTitle: this.levelTitle,
      actName: this.actName,
      startTime: this.startTime,
      endTime,
      durationMs,
      samples: s,
      finalScore: finalScore,
      maxCombo: this.maxCombo,
      damagesTaken: this.damagesTaken,
      enemiesKilled: this.enemiesKilled,
      alphaBumps: this.alphaBumps,
      dominantState,
      avgCalm,
      avgArousal,
      avgBpm,
      peakBpm,
      minBpm,
      netCalmChange: lastCalm - firstCalm,
      netArousalChange: lastArousal - firstArousal,
    };
  }
}
