import { DEV_MODE } from '../config';
import { events } from '../core/events';
import { MockBCIProvider } from './bciMock';
import { type EEGProviderState, ElataEEGProvider } from './eegProvider';
import type { InputManager } from './input';
import { ElataRppgProvider, type RppgProviderState } from './rppgProvider';

export interface NeuroState {
  source: 'eeg' | 'rppg' | 'mock' | 'none';
  calm: number;
  arousal: number;
  bpm: number | null;
  bpmQuality: number;
  signalQuality: number;
  eegConnected: boolean;
  cameraActive: boolean;
  alphaPower: number | null;
  betaPower: number | null;
  thetaPower: number | null;
  deltaPower: number | null;
  gammaPower: number | null;
  alphaBump: boolean;
  hrvRmssd: number | null;
  respirationRate: number | null;
  baselineBpm: number | null;
  baselineDelta: number | null;
  calmnessState: string | null;
  alphaPeakFreq: number | null;
  alphaBumpState: string | null;
}

const DEFAULT_EEG_STATE: Readonly<EEGProviderState> = {
  connected: false,
  reconnecting: false,
  calm: null,
  arousal: null,
  alphaPower: null,
  betaPower: null,
  thetaPower: null,
  deltaPower: null,
  gammaPower: null,
  alphaBump: false,
  signalQuality: 0,
  calmnessState: null,
  alphaBetaRatio: null,
  alphaPeakFreq: null,
  alphaPeakSnr: null,
  alphaBumpState: null,
  batteryLevel: null,
  lastAccelMagnitude: null,
  bandPowerHistory: [],
};

const DEFAULT_RPPG_STATE: Readonly<RppgProviderState> = {
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

const NEURO_EMA_ALPHA = 0.08;
const NEURO_LOG_INTERVAL = 10;

export class NeuroManager {
  private eegProvider: ElataEEGProvider;
  private rppgProvider: ElataRppgProvider;
  private mockProvider: MockBCIProvider;
  private mockEnabled = false;
  private wasmReady = false;
  private previousSource: NeuroState['source'] = 'none';
  private smoothedCalm = 0;
  private smoothedArousal = 0;
  private totalTime = 0;
  private lastNeuroLogTime = 0;

  private state: NeuroState = {
    source: 'none',
    calm: 0,
    arousal: 0,
    bpm: null,
    bpmQuality: 0,
    signalQuality: 0,
    eegConnected: false,
    cameraActive: false,
    alphaPower: null,
    betaPower: null,
    thetaPower: null,
    deltaPower: null,
    gammaPower: null,
    alphaBump: false,
    hrvRmssd: null,
    respirationRate: null,
    baselineBpm: null,
    baselineDelta: null,
    calmnessState: null,
    alphaPeakFreq: null,
    alphaBumpState: null,
  };

  constructor() {
    this.eegProvider = new ElataEEGProvider();
    this.rppgProvider = new ElataRppgProvider();
    this.mockProvider = new MockBCIProvider();

    this.eegProvider.setCallbacks(
      () => {
        events.emit('neuro:disconnected', { source: 'eeg', reason: 'BLE disconnected' });
      },
      () => {
        events.emit('neuro:reconnected', { source: 'eeg' });
      },
    );

    this.rppgProvider.setCallbacks(() => {
      events.emit('neuro:camera_quality_low', undefined);
    });
  }

  async initWasm(): Promise<void> {
    try {
      await this.eegProvider.initAsync();
      this.wasmReady = true;
      console.log('[Neuro] WASM init succeeded — EEG features ready');
    } catch (err) {
      console.warn('[Neuro] WASM init failed — EEG features disabled:', err);
      this.wasmReady = false;
    }
  }

  async connectHeadband(): Promise<boolean> {
    if (!this.wasmReady) {
      console.warn('[Neuro] WASM not ready, cannot connect headband — initWasm() may have failed');
      return false;
    }
    console.log('[Neuro] Connecting headband...');
    const success = await this.eegProvider.connect();
    this.state.eegConnected = success;
    console.log('[Neuro] Headband connection result:', success);
    return success;
  }

  async enableCamera(): Promise<boolean> {
    console.log('[Neuro] Enabling camera...');
    const success = await this.rppgProvider.enable();
    this.state.cameraActive = success;
    console.log('[Neuro] Camera enable result:', success);
    return success;
  }

  disableCamera(): void {
    this.rppgProvider.disable();
    this.state.cameraActive = false;
  }

  enableMock(): void {
    if (!DEV_MODE) return;
    this.mockEnabled = true;
  }

  disableMock(): void {
    this.mockEnabled = false;
  }

  isMockEnabled(): boolean {
    return this.mockEnabled;
  }

  hasActiveSource(): boolean {
    return this.state.source !== 'none';
  }

  registerProviders(inputManager: InputManager): void {
    inputManager.addProvider(this.eegProvider);
    inputManager.addProvider(this.rppgProvider);
    inputManager.addProvider(this.mockProvider);
  }

  getHeadbandErrorMessage(): string {
    return this.eegProvider.getErrorMessage();
  }

  getCameraErrorMessage(): string {
    return this.rppgProvider.getErrorMessage();
  }

  isWasmReady(): boolean {
    return this.wasmReady;
  }

  update(dt: number): void {
    this.totalTime += dt;

    let eegState: Readonly<EEGProviderState>;
    let rppgState: Readonly<RppgProviderState>;

    try {
      eegState = this.eegProvider.getState();
    } catch {
      eegState = DEFAULT_EEG_STATE;
    }

    try {
      rppgState = this.rppgProvider.getState();
    } catch {
      rppgState = DEFAULT_RPPG_STATE;
    }

    let source: NeuroState['source'] = 'none';

    const eegHasData = eegState.connected && (eegState.calm !== null || eegState.alphaPower !== null);

    let rawCalm = 0;
    let rawArousal = 0;

    if (eegHasData) {
      source = 'eeg';
      rawCalm = eegState.calm ?? 0;
      rawArousal = eegState.arousal ?? 0;
      this.state.signalQuality = eegState.signalQuality;
      this.state.alphaBump = eegState.alphaBump;
      this.state.calmnessState = eegState.calmnessState;
      this.state.alphaPeakFreq = eegState.alphaPeakFreq;
      this.state.alphaBumpState = eegState.alphaBumpState;
    } else if (rppgState.active) {
      source = 'rppg';
      rawArousal = rppgState.arousal ?? 0;
      rawCalm = this.mockProvider.getCurrentCalm();
      this.state.signalQuality = rppgState.quality;
      this.state.alphaBump = false;
      this.state.calmnessState = null;
      this.state.alphaPeakFreq = null;
      this.state.alphaBumpState = null;
    } else if (this.mockEnabled) {
      source = 'mock';
      rawCalm = this.mockProvider.getCurrentCalm();
      rawArousal = this.mockProvider.getCurrentArousal();
      this.state.signalQuality = 1;
      this.state.alphaBump = false;
      this.state.calmnessState = null;
      this.state.alphaPeakFreq = null;
      this.state.alphaBumpState = null;
    } else {
      rawCalm = 0;
      rawArousal = 0;
      this.state.signalQuality = 0;
      this.state.calmnessState = null;
      this.state.alphaPeakFreq = null;
      this.state.alphaBumpState = null;
    }

    // EMA smooth calm and arousal to reduce visual jitter
    this.smoothedCalm = this.smoothedCalm * (1 - NEURO_EMA_ALPHA) + rawCalm * NEURO_EMA_ALPHA;
    this.smoothedArousal = this.smoothedArousal * (1 - NEURO_EMA_ALPHA) + rawArousal * NEURO_EMA_ALPHA;
    this.state.calm = this.smoothedCalm;
    this.state.arousal = this.smoothedArousal;

    // Always pass EEG band powers through when headband is connected, regardless of source
    if (eegState.connected) {
      this.state.alphaPower = eegState.alphaPower;
      this.state.betaPower = eegState.betaPower;
      this.state.thetaPower = eegState.thetaPower;
      this.state.deltaPower = eegState.deltaPower;
      this.state.gammaPower = eegState.gammaPower;
    } else {
      this.state.alphaPower = null;
      this.state.betaPower = null;
      this.state.thetaPower = null;
      this.state.deltaPower = null;
      this.state.gammaPower = null;
    }

    // BPM always from rPPG when camera is active
    if (rppgState.active) {
      this.state.bpm = rppgState.bpm;
      this.state.bpmQuality = rppgState.quality;
      this.state.hrvRmssd = rppgState.hrvRmssd;
      this.state.respirationRate = rppgState.respirationRate;
      this.state.baselineBpm = rppgState.baselineBpm;
      this.state.baselineDelta = rppgState.baselineDelta;
    } else {
      this.state.bpm = null;
      this.state.bpmQuality = 0;
      this.state.hrvRmssd = null;
      this.state.respirationRate = null;
      this.state.baselineBpm = null;
      this.state.baselineDelta = null;
    }

    this.state.source = source;
    this.state.eegConnected = eegState.connected;
    this.state.cameraActive = rppgState.active;

    if (source !== this.previousSource) {
      console.log('[Neuro] Source changed:', this.previousSource, '->', source, {
        eegConnected: eegState.connected,
        eegCalm: eegState.calm,
        eegAlpha: eegState.alphaPower,
        eegFrames: this.eegProvider.getFrameCount(),
        eegDecodeErrors: this.eegProvider.getDecodeErrorCount(),
        rppgActive: rppgState.active,
        rppgBpm: rppgState.bpm,
      });
      events.emit('neuro:source_changed', { from: this.previousSource, to: source });
      this.previousSource = source;
    }

    if (eegState.alphaBump) {
      events.emit('neuro:alpha_bump', undefined);
    }

    // Throttled periodic pipeline state log
    if (this.totalTime - this.lastNeuroLogTime >= NEURO_LOG_INTERVAL) {
      this.lastNeuroLogTime = this.totalTime;
      console.log('[Neuro] Pipeline state', {
        source,
        eegConnected: eegState.connected,
        eegFrames: this.eegProvider.getFrameCount(),
        eegDecodeErrors: this.eegProvider.getDecodeErrorCount(),
        eegModelsReady: this.eegProvider.isModelsReady(),
        eegCalm: eegState.calm?.toFixed?.(2) ?? null,
        eegAlpha: eegState.alphaPower?.toFixed?.(2) ?? null,
        rppgActive: rppgState.active,
        rppgBpm: rppgState.bpm?.toFixed?.(1) ?? null,
        rppgDisplayBpm: rppgState.displayBpm,
        rppgQuality: rppgState.quality.toFixed(2),
        wasmReady: this.wasmReady,
      });
    }

    try {
      this.mockProvider.update(dt);
    } catch {
      /* swallow */
    }
  }

  getState(): Readonly<NeuroState> {
    return this.state;
  }

  getEEGProvider(): ElataEEGProvider {
    return this.eegProvider;
  }

  getRppgProvider(): ElataRppgProvider {
    return this.rppgProvider;
  }

  getCameraVideoElement(): HTMLVideoElement | null {
    return this.rppgProvider.getVideoElement();
  }

  getMockProvider(): MockBCIProvider {
    return this.mockProvider;
  }

  destroy(): void {
    this.eegProvider.destroy();
    this.rppgProvider.destroy();
    this.mockProvider.destroy();
  }
}
