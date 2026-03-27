import type { InputProvider, PlayerIntent } from './input';
import type { RppgProcessor, Metrics, Backend, DemoRunner } from '@elata-biosciences/rppg-web';
import logger from './logger';

export interface RppgDebugMetrics {
  spectralBpm: number | null;
  acfBpm: number | null;
  peaksBpm: number | null;
  bayesBpm: number | null;
  bayesConfidence: number;
  fusedBpm: number | null;
  fusedSource: string;
  resolvedBpm: number | null;
  calibrationTrained: boolean;
  winningSources: string[];
  aliasFlag: boolean;
  harmonicCorrected: boolean;
  preCorrectBpm: number | null;
}

export interface RppgProviderState {
  active: boolean;
  bpm: number | null;
  displayBpm: number | null;
  rawBpm: number | null;
  smoothedBpm: number | null;
  lastValidBpm: number | null;
  lastValidBpmAge: number;
  quality: number;
  confidence: number;
  arousal: number | null;
  calibrationProgress: number;
  warmupComplete: boolean;
  activeTime: number;
  videoWidth: number;
  videoHeight: number;
  hrvRmssd: number | null;
  respirationRate: number | null;
  baselineBpm: number | null;
  baselineDelta: number | null;
  debugMetrics: RppgDebugMetrics | null;
  bpmHistory: number[];
}

export type RppgError = 'permission_denied' | 'no_camera' | 'init_failed' | 'unknown';

const MIN_BPM = 60;
const MAX_BPM = 120;
const QUALITY_THRESHOLD = 0.4;
const LOW_QUALITY_TIMEOUT = 3;
const WARMUP_SECONDS = 15;
const BPM_STALE_TIMEOUT = 30_000;
const EMA_ALPHA = 0.05;
const BPM_HISTORY_SIZE = 120;
const BPM_HISTORY_INTERVAL = 0.5;
const LOG_INTERVAL = 5;

export class ElataRppgProvider implements InputProvider {
  private processor: RppgProcessor | null = null;
  private runner: DemoRunner | null = null;
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private active = false;
  private lowQualityTimer = 0;
  private lastError: RppgError | null = null;
  private activeTime = 0;
  private smoothedBpm: number | null = null;
  private lastValidBpm: number | null = null;
  private lastValidBpmTime = 0;
  private warmupComplete = false;
  private lastLogTime = 0;
  private lastQualityHigh = false;
  private bpmHistory: number[] = [];
  private bpmHistoryTimer = 0;
  private state: RppgProviderState = {
    active: false,
    bpm: null,
    displayBpm: null,
    rawBpm: null,
    smoothedBpm: null,
    lastValidBpm: null,
    lastValidBpmAge: 0,
    quality: 0,
    confidence: 0,
    arousal: null,
    calibrationProgress: 0,
    warmupComplete: false,
    activeTime: 0,
    videoWidth: 0,
    videoHeight: 0,
    hrvRmssd: null,
    respirationRate: null,
    baselineBpm: null,
    baselineDelta: null,
    debugMetrics: null,
    bpmHistory: [],
  };

  private onQualityLow?: () => void;

  setCallbacks(onQualityLow: () => void): void {
    this.onQualityLow = onQualityLow;
  }

  async enable(): Promise<boolean> {
    // If already active, disable first
    if (this.active) {
      this.disable();
    }

    let stream: MediaStream | null = null;
    try {
      const rppg = await import('@elata-biosciences/rppg-web');

      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 320, height: 240 },
      });
      this.stream = stream;

      const video = document.createElement('video');
      video.srcObject = stream;
      video.playsInline = true;
      await video.play();
      this.video = video;

      let backend: Backend | null;
      try {
        backend = await rppg.loadWasmBackend();
      } catch {
        backend = null;
      }

      const source = new rppg.MediaPipeFrameSource(video);

      if (backend) {
        this.processor = new rppg.RppgProcessor(backend, 30);
      } else {
        // Provide a backend with no-op pipeline stubs. The SDK's pushSampleRgbMeta chains
        // down to pushSample, which throws if push_sample doesn't exist. With these stubs,
        // the WASM pipeline methods are called (as no-ops) and then pushLocalSample stores
        // the data for the built-in JS spectral/ACF/peak BPM algorithms.
        const noopPipeline = {
          push_sample: () => {},
          push_sample_rgb: () => {},
          push_sample_rgb_meta: () => {},
          get_metrics: () => ({ bpm: null, confidence: 0, signal_quality: 0 }),
          enable_tracker: () => {},
        };
        this.processor = new rppg.RppgProcessor({ newPipeline: () => noopPipeline } as Backend, 30);
        logger.info('rPPG', 'WASM backend unavailable — using JS-only signal processing');
      }

      this.runner = new rppg.DemoRunner(source, this.processor, {
        useSkinMask: true,
      });

      await this.runner.start();
      this.active = true;
      this.state.active = true;
      this.lastError = null;
      logger.info('rPPG', 'Camera enabled', {
        resolution: `${video.videoWidth}x${video.videoHeight}`,
        wasmBackend: !!backend,
      });
      return true;
    } catch (err: unknown) {
      logger.error('rPPG', 'Camera enable failed', err);
      this.lastError = this.classifyError(err);

      // Clean up any resources obtained before the failure
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      this.stream = null;
      this.video = null;
      this.processor = null;
      this.runner = null;
      this.active = false;
      this.state.active = false;
      return false;
    }
  }

  disable(): void {
    if (this.runner) {
      try {
        this.runner.stop?.();
      } catch {
        /* swallow */
      }
      this.runner = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.video) {
      this.video.srcObject = null;
      this.video = null;
    }
    this.processor = null;
    this.active = false;
    this.activeTime = 0;
    this.smoothedBpm = null;
    this.lastValidBpm = null;
    this.lastValidBpmTime = 0;
    this.warmupComplete = false;
    this.bpmHistory = [];
    this.bpmHistoryTimer = 0;
    this.state.active = false;
    this.state.bpm = null;
    this.state.displayBpm = null;
    this.state.rawBpm = null;
    this.state.smoothedBpm = null;
    this.state.bpmHistory = [];
    this.state.lastValidBpm = null;
    this.state.lastValidBpmAge = 0;
    this.state.quality = 0;
    this.state.confidence = 0;
    this.state.arousal = null;
    this.state.calibrationProgress = 0;
    this.state.warmupComplete = false;
    this.state.activeTime = 0;
    this.state.videoWidth = 0;
    this.state.videoHeight = 0;
    this.state.hrvRmssd = null;
    this.state.respirationRate = null;
    this.state.baselineBpm = null;
    this.state.baselineDelta = null;
    this.state.debugMetrics = null;
    this.lowQualityTimer = 0;
  }

  private classifyError(err: unknown): RppgError {
    const msg = String((err as { message?: string })?.message ?? err ?? '').toLowerCase();
    if (msg.includes('permission') || msg.includes('denied') || msg.includes('notallowed')) {
      return 'permission_denied';
    }
    if (msg.includes('notfound') || msg.includes('no video') || msg.includes('device not found')) {
      return 'no_camera';
    }
    return 'unknown';
  }

  getLastError(): RppgError | null {
    return this.lastError;
  }

  getErrorMessage(): string {
    switch (this.lastError) {
      case 'permission_denied':
        return 'Camera permission denied — check browser settings';
      case 'no_camera':
        return 'No camera detected';
      case 'init_failed':
        return 'Camera initialization failed';
      default:
        return 'Camera connection failed';
    }
  }

  init(): void {}

  update(dt: number): void {
    if (!this.active || !this.processor) return;

    this.activeTime += dt;
    this.state.activeTime = this.activeTime;

    const CALIBRATION_SECONDS = 8;
    this.state.calibrationProgress = Math.min(1, this.activeTime / CALIBRATION_SECONDS);

    if (!this.warmupComplete && this.activeTime >= WARMUP_SECONDS) {
      this.warmupComplete = true;
      this.state.warmupComplete = true;
      this.lowQualityTimer = 0;
    }

    if (this.video) {
      this.state.videoWidth = this.video.videoWidth;
      this.state.videoHeight = this.video.videoHeight;
    }

    try {
      const metrics = this.processor.getMetrics();
      const rawBpm = metrics.bpm ?? null;
      this.state.rawBpm = rawBpm;
      this.state.quality = Math.max(metrics.signal_quality ?? 0, metrics.confidence ?? 0);
      this.state.confidence = metrics.confidence ?? 0;

      this.state.hrvRmssd = metrics.hrv_rmssd ?? null;
      this.state.respirationRate = metrics.respiration_rate ?? null;
      this.state.baselineBpm = metrics.baseline_bpm ?? null;
      this.state.baselineDelta = metrics.baseline_delta ?? null;

      let harmonicCorrected = false;
      let preCorrectBpm: number | null = null;
      let effectiveBpm = rawBpm;

      if (rawBpm !== null && rawBpm > 0) {
        const { correctedBpm, wasHarmonic } = this.detectAndCorrectHarmonic(rawBpm, metrics);
        if (wasHarmonic) {
          harmonicCorrected = true;
          preCorrectBpm = rawBpm;
          effectiveBpm = correctedBpm;
        }
      }

      this.state.debugMetrics = {
        spectralBpm: metrics.spectral_bpm ?? null,
        acfBpm: metrics.acf_bpm ?? null,
        peaksBpm: metrics.peaks_bpm ?? null,
        bayesBpm: metrics.bayes_bpm ?? null,
        bayesConfidence: metrics.bayes_confidence ?? 0,
        fusedBpm: metrics.fused_bpm ?? null,
        fusedSource: metrics.fused_source ?? 'none',
        resolvedBpm: metrics.resolved_bpm ?? null,
        calibrationTrained: metrics.calibration_trained ?? false,
        winningSources: metrics.winning_sources ?? [],
        aliasFlag: metrics.alias_flag ?? false,
        harmonicCorrected,
        preCorrectBpm,
      };

      if (effectiveBpm !== null && effectiveBpm > 0) {
        this.smoothedBpm = this.smoothedBpm
          ? this.smoothedBpm * (1 - EMA_ALPHA) + effectiveBpm * EMA_ALPHA
          : effectiveBpm;
        this.state.smoothedBpm = this.smoothedBpm;
        this.state.bpm = this.smoothedBpm;
        this.state.calibrationProgress = 1;

        this.bpmHistoryTimer += dt;
        if (this.bpmHistoryTimer >= BPM_HISTORY_INTERVAL) {
          this.bpmHistoryTimer = 0;
          this.bpmHistory.push(this.smoothedBpm!);
          if (this.bpmHistory.length > BPM_HISTORY_SIZE) {
            this.bpmHistory.shift();
          }
          this.state.bpmHistory = this.bpmHistory;
        }

        this.state.displayBpm = this.computeDisplayBpm();
      }

      if (this.state.quality >= QUALITY_THRESHOLD && this.state.bpm !== null) {
        this.lastValidBpm = this.state.bpm;
        this.lastValidBpmTime = Date.now();
        this.state.lastValidBpm = this.lastValidBpm;

        const normalized = (this.state.bpm - MIN_BPM) / (MAX_BPM - MIN_BPM);
        this.state.arousal = Math.max(0, Math.min(1, normalized));
        this.lowQualityTimer = 0;
      } else {
        this.lowQualityTimer += dt;

        // Use last known BPM if within staleness window
        const bpmAge = Date.now() - this.lastValidBpmTime;
        this.state.lastValidBpmAge = bpmAge;
        if (this.lastValidBpm !== null && bpmAge < BPM_STALE_TIMEOUT) {
          this.state.bpm = this.lastValidBpm;
        } else if (bpmAge >= BPM_STALE_TIMEOUT) {
          this.state.bpm = null;
          this.lastValidBpm = null;
          this.state.lastValidBpm = null;
        }

        if (this.lowQualityTimer > LOW_QUALITY_TIMEOUT && this.warmupComplete) {
          this.state.arousal = null;
          this.onQualityLow?.();
        }
      }

      // Quality transition logging
      const qualityHigh = this.state.quality >= QUALITY_THRESHOLD;
      if (qualityHigh !== this.lastQualityHigh) {
        logger.info('rPPG', `Quality transition: ${this.lastQualityHigh ? 'HIGH' : 'LOW'} -> ${qualityHigh ? 'HIGH' : 'LOW'}`);
        this.lastQualityHigh = qualityHigh;
      }

      // Throttled periodic logging
      if (this.activeTime - this.lastLogTime >= LOG_INTERVAL) {
        this.lastLogTime = this.activeTime;
        logger.debug('rPPG', 'Status', {
          rawBpm: this.state.rawBpm,
          smoothedBpm: this.smoothedBpm?.toFixed(1),
          displayBpm: this.state.displayBpm,
          quality: this.state.quality.toFixed(2),
          confidence: this.state.confidence.toFixed(2),
          activeTime: this.activeTime.toFixed(1),
          warmup: this.warmupComplete,
          hrvRmssd: this.state.hrvRmssd?.toFixed(1),
          respRate: this.state.respirationRate?.toFixed(1),
          baselineBpm: this.state.baselineBpm?.toFixed(0),
          spectralBpm: this.state.debugMetrics?.spectralBpm,
          acfBpm: this.state.debugMetrics?.acfBpm,
          peaksBpm: this.state.debugMetrics?.peaksBpm,
          bayesBpm: this.state.debugMetrics?.bayesBpm,
          fusedBpm: this.state.debugMetrics?.fusedBpm,
          fusedSource: this.state.debugMetrics?.fusedSource,
          harmonicCorrected: this.state.debugMetrics?.harmonicCorrected,
          aliasFlag: this.state.debugMetrics?.aliasFlag,
        });
      }
    } catch (err) {
      logger.warn('rPPG', 'Metrics error', err);
      this.state.quality = 0;
    }
  }

  /**
   * Detects harmonic doubling only when there's strong evidence the SDK locked
   * onto the 2nd harmonic. The JS-only spectral path can force 2x when the
   * fundamental is below 85 BPM and the harmonic ratio exceeds 0.35.
   *
   * To avoid over-correction (e.g., halving a legitimate ~95 BPM reading),
   * we require 3+ votes AND that the "fundamental" candidate is supported by
   * at least two reliable estimators (those above 50 BPM).
   */
  private detectAndCorrectHarmonic(rawBpm: number, metrics: Metrics): { correctedBpm: number; wasHarmonic: boolean } {
    const spectral = metrics.spectral_bpm ?? null;
    const acf = metrics.acf_bpm ?? null;
    const peaks = metrics.peaks_bpm ?? null;
    const bayes = metrics.bayes_bpm ?? null;
    const aliasFlag = metrics.alias_flag ?? false;

    const halfBpm = rawBpm / 2;
    const isInDoubleRange = rawBpm >= 100 && rawBpm <= 140;
    const halfIsPhysiological = halfBpm >= 50 && halfBpm <= 75;

    if (!isInDoubleRange || !halfIsPhysiological) {
      return { correctedBpm: rawBpm, wasHarmonic: false };
    }

    let harmonicVotes = 0;

    if (aliasFlag) harmonicVotes++;

    // Only count spectral/ACF divergence when BOTH are in a reliable range (>50 BPM)
    if (spectral !== null && acf !== null && spectral >= 50 && acf >= 50) {
      const ratio = Math.max(spectral, acf) / Math.min(spectral, acf);
      if (ratio > 1.7 && ratio < 2.3) harmonicVotes++;
    }

    // Only count reliable estimators (>50 BPM) near the fundamental
    const reliableEstimators = [spectral, acf, peaks, bayes].filter((b): b is number => b !== null && b >= 50);
    const nearHalf = reliableEstimators.filter((b) => Math.abs(b - halfBpm) < 6);
    if (nearHalf.length >= 2) harmonicVotes += 2;
    else if (nearHalf.length === 1) harmonicVotes++;

    if (bayes !== null && bayes >= 50 && bayes < rawBpm * 0.65) harmonicVotes++;

    if (harmonicVotes >= 3) {
      logger.info('rPPG', 'Harmonic doubling corrected', {
        rawBpm: rawBpm.toFixed(1),
        correctedBpm: halfBpm.toFixed(1),
        votes: harmonicVotes,
        spectral,
        acf,
        peaks,
        bayes,
        aliasFlag,
      });
      return { correctedBpm: halfBpm, wasHarmonic: true };
    }

    return { correctedBpm: rawBpm, wasHarmonic: false };
  }

  private computeDisplayBpm(): number | null {
    if (this.bpmHistory.length === 0) return this.smoothedBpm;
    let weightedSum = 0;
    let totalWeight = 0;
    for (let i = 0; i < this.bpmHistory.length; i++) {
      const weight = i + 1;
      weightedSum += this.bpmHistory[i] * weight;
      totalWeight += weight;
    }
    return Math.round(weightedSum / totalWeight);
  }

  getIntent(): Partial<PlayerIntent> {
    if (!this.active || this.state.arousal === null) {
      return {};
    }
    return {
      arousal: this.state.arousal,
    };
  }

  destroy(): void {
    this.disable();
  }

  getState(): Readonly<RppgProviderState> {
    return this.state;
  }

  isActive(): boolean {
    return this.active;
  }

  getVideoElement(): HTMLVideoElement | null {
    return this.video;
  }
}
