import type { InputProvider, PlayerIntent } from './input';

export interface BandPowerSnapshot {
  alpha: number;
  beta: number;
  theta: number;
  delta: number;
  gamma: number;
}

export interface EEGProviderState {
  connected: boolean;
  reconnecting: boolean;
  calm: number | null;
  arousal: number | null;
  alphaPower: number | null;
  betaPower: number | null;
  thetaPower: number | null;
  deltaPower: number | null;
  gammaPower: number | null;
  alphaBump: boolean;
  signalQuality: number;
  calmnessState: string | null;
  alphaBetaRatio: number | null;
  alphaPeakFreq: number | null;
  alphaPeakSnr: number | null;
  alphaBumpState: string | null;
  batteryLevel: number | null;
  lastAccelMagnitude: number | null;
  bandPowerHistory: BandPowerSnapshot[];
}

export type EEGError = 'no_bluetooth' | 'permission_denied' | 'not_found' | 'wasm_not_ready' | 'unknown';

const MAX_RECONNECT_ATTEMPTS = 5;
const MAX_RECONNECT_DELAY_MS = 30000;
const EEG_SAMPLE_BUFFER_SIZE = 256;
const MIN_ANALYSIS_SAMPLES = 64;
const BAND_HISTORY_SIZE = 60;
const BAND_HISTORY_INTERVAL = 0.5;
const LOG_INTERVAL_MS = 5000;
const EARLY_FRAME_LOG_LIMIT = 3;
const NO_FRAME_WARN_MS = 5000;

export class ElataEEGProvider implements InputProvider {
  private transport: any = null;
  private calmnessModel: any = null;
  private alphaBumpDetector: any = null;
  private alphaPeakModel: any = null;
  private eegModule: any = null;
  private connected = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private lastError: EEGError | null = null;
  private recentSamples: number[] = [];
  private frameCount = 0;
  private lastLogTime = 0;
  private decodeErrorCount = 0;
  private modelsReady = false;
  private connectTime = 0;
  private noFrameWarned = false;
  private bleNotificationCount = 0;
  private emptyDecodeCount = 0;
  private reconnectCount = 0;
  private storedDevice: any = null;
  private sampleRate = 256;
  private state: EEGProviderState = {
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

  private bandHistoryTimer = 0;
  private onDisconnect?: () => void;
  private onReconnect?: () => void;

  setCallbacks(onDisconnect: () => void, onReconnect: () => void): void {
    this.onDisconnect = onDisconnect;
    this.onReconnect = onReconnect;
  }

  async initAsync(): Promise<void> {
    const eegWeb = await import('@elata-biosciences/eeg-web');
    await eegWeb.initEegWasm();
    this.eegModule = eegWeb;

    // Workaround: SDK's museDevice.js uses asNumberArray(wasmGet(output, "eeg_samples"))
    // but eeg_samples getter returns Float32Array, and asNumberArray uses Array.isArray()
    // which is false for TypedArrays. Patch the prototype to return regular Arrays.
    try {
      this.patchAthenaWasmOutput(eegWeb);
    } catch (e) {
      console.warn('[EEG] Float32Array patch failed (non-fatal):', e);
    }

    this.calmnessModel = new eegWeb.WasmCalmnessModel(256, 1);
    this.alphaBumpDetector = new eegWeb.WasmAlphaBumpDetector(256, 1);
    this.alphaPeakModel = new eegWeb.WasmAlphaPeakModel(256, 1);
    this.modelsReady = true;

    const minSamples = {
      calmness: this.calmnessModel.min_samples?.() ?? 'N/A',
      alphaBump: this.alphaBumpDetector.min_samples?.() ?? 'N/A',
      alphaPeak: this.alphaPeakModel.min_samples?.() ?? 'N/A',
    };
    console.log('[EEG] WASM models initialized:', {
      calmnessModel: !!this.calmnessModel,
      alphaBumpDetector: !!this.alphaBumpDetector,
      alphaPeakModel: !!this.alphaPeakModel,
      eegModule: !!this.eegModule,
      minSamples,
      bufferSize: EEG_SAMPLE_BUFFER_SIZE,
      minAnalysis: MIN_ANALYSIS_SAMPLES,
    });
  }

  private patchAthenaWasmOutput(eegWeb: any): void {
    const AthenaWasmOutput = eegWeb.AthenaWasmOutput;
    if (!AthenaWasmOutput) {
      console.warn('[EEG] AthenaWasmOutput not found — cannot apply Float32Array patch');
      return;
    }

    const proto = AthenaWasmOutput.prototype;
    const floatArrayProps = ['eeg_samples', 'optics_samples', 'accgyro_samples', 'battery_samples'];
    let patched = 0;

    for (const prop of floatArrayProps) {
      const descriptor = Object.getOwnPropertyDescriptor(proto, prop);
      if (descriptor?.get) {
        const originalGet = descriptor.get;
        Object.defineProperty(proto, prop, {
          get() {
            const result = originalGet.call(this);
            if (result && typeof result[Symbol.iterator] === 'function' && !Array.isArray(result)) {
              return Array.from(result);
            }
            return result;
          },
          configurable: true,
        });
        patched++;
      }
    }

    console.log(`[EEG] Patched ${patched} AthenaWasmOutput Float32Array getters → Array`);
  }

  async connect(): Promise<boolean> {
    try {
      if (!(navigator as Navigator & { bluetooth?: unknown }).bluetooth) {
        this.lastError = 'no_bluetooth';
        console.warn('[EEG] Web Bluetooth not available');
        return false;
      }

      const eegWeb = await import('@elata-biosciences/eeg-web');
      const eegBle = await import('@elata-biosciences/eeg-web-ble');

      // Tear down any existing transport before creating a new one
      if (this.transport) {
        try {
          this.transport.stop?.();
        } catch {
          /* swallow */
        }
        try {
          this.transport.disconnect?.();
        } catch {
          /* swallow */
        }
        this.transport = null;
      }

      this.decodeErrorCount = 0;
      this.bleNotificationCount = 0;
      this.emptyDecodeCount = 0;
      this.frameCount = 0;
      this.noFrameWarned = false;
      this.state.reconnecting = false;

      console.log('[EEG] Creating BleTransport with AthenaWasmDecoder factory...');

      this.transport = new eegBle.BleTransport({
        sourceName: 'monkey-mind',
        deviceOptions: {
          athenaDecoderFactory: () => {
            try {
              console.log('[EEG] Instantiating AthenaWasmDecoder...');
              const decoder = new eegWeb.AthenaWasmDecoder();
              console.log(
                '[EEG] AthenaWasmDecoder created OK — methods:',
                Object.getOwnPropertyNames(Object.getPrototypeOf(decoder)),
              );
              return decoder;
            } catch (err) {
              console.error('[EEG] AthenaWasmDecoder construction FAILED:', err);
              throw err;
            }
          },
          logger: (msg: string) => {
            if (msg.toLowerCase().includes('error') || msg.toLowerCase().includes('fail')) {
              this.decodeErrorCount++;
              console.warn('[EEG:BLE]', msg);
            } else {
              console.log('[EEG:BLE]', msg);
            }
          },
        },
      });

      this.transport.onStatus = (status: any) => {
        console.log('[EEG] Transport status:', status.state, status.reason ?? '', status.errorCode ?? '');
        if (status.state === 'connected') {
          this.connected = true;
          this.state.connected = true;
          this.state.reconnecting = false;
          this.reconnectAttempts = 0;
          this.connectTime = Date.now();
          this.onReconnect?.();
        } else if (status.state === 'streaming') {
          console.log('[EEG] BLE streaming started — waiting for frames');
          this.connectTime = Date.now();
        } else if (status.state === 'disconnected') {
          this.connected = false;
          this.state.connected = false;
          this.state.signalQuality = 0;

          if (status.recoverable && this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            this.state.reconnecting = true;
            const delay = Math.min(2000 * 2 ** this.reconnectAttempts, MAX_RECONNECT_DELAY_MS);
            this.reconnectTimer = setTimeout(() => this.reconnect(), delay);
          } else {
            this.state.reconnecting = false;
            this.onDisconnect?.();
          }
        }
      };

      this.transport.onFrame = (frame: any) => {
        this.processFrame(frame);
      };

      console.log('[EEG] Calling transport.connect()...');
      await this.transport.connect();
      console.log('[EEG] transport.connect() resolved — calling transport.start()...');

      // Log device info between connect and start to understand the protocol
      try {
        const boardInfo = this.transport.getBoardInfo?.();
        const charInfo = this.transport.getCharacteristicInfo?.();
        const isAthena = this.transport.getIsAthena?.();
        console.log('[EEG] Device info:', {
          isAthena,
          protocol: boardInfo?.protocol,
          deviceName: boardInfo?.device_name,
          sampleRate: boardInfo?.sample_rate_hz,
          channelCount: boardInfo?.channel_count,
          eegChannels: boardInfo?.eeg_channel_names,
          opticsChannels: boardInfo?.optics_channel_count,
        });
        console.log('[EEG] Characteristics found:', charInfo?.characteristics?.length, charInfo?.characteristics);
      } catch (e) {
        console.warn('[EEG] Could not read device info:', e);
      }

      await this.transport.start();
      this.connected = true;
      this.state.connected = true;
      this.lastError = null;
      this.reconnectAttempts = 0;
      this.connectTime = Date.now();

      // Store BluetoothDevice reference for GATT-level reconnect
      try {
        this.storedDevice = this.transport.device?.device ?? null;
        if (this.storedDevice) {
          console.log('[EEG] Stored BluetoothDevice for reconnect:', this.storedDevice.name);
        }
      } catch {
        this.storedDevice = null;
      }

      console.log('[EEG] Connected and started — modelsReady:', this.modelsReady, 'wasmModule:', !!this.eegModule);
      return true;
    } catch (err: any) {
      console.error('[EEG] Connection failed:', err);
      console.warn('[EEG] Error classified as:', this.classifyError(err));
      this.lastError = this.classifyError(err);
      this.connected = false;
      this.state.connected = false;
      return false;
    }
  }

  private async reconnect(): Promise<void> {
    this.reconnectAttempts++;
    this.reconnectCount++;
    this.state.reconnecting = true;
    console.log(`[EEG] Reconnect attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`);

    try {
      // Try GATT-level reconnect first (no user gesture needed for paired device)
      if (this.storedDevice?.gatt) {
        console.log('[EEG] Attempting GATT reconnect on stored device:', this.storedDevice.name);
        await this.storedDevice.gatt.connect();
        console.log('[EEG] GATT reconnected — restarting stream');
        await this.transport.start();
        this.connected = true;
        this.state.connected = true;
        this.state.reconnecting = false;
        this.reconnectAttempts = 0;
        this.connectTime = Date.now();
        console.log('[EEG] Reconnected via GATT successfully');
        this.onReconnect?.();
        return;
      }

      // Fallback: full transport reconnect (may fail without user gesture)
      if (this.transport) {
        await this.transport.connect();
        await this.transport.start();
        this.connected = true;
        this.state.connected = true;
        this.state.reconnecting = false;
        this.reconnectAttempts = 0;
        this.connectTime = Date.now();
        this.onReconnect?.();
        return;
      }
    } catch (err) {
      console.warn(`[EEG] Reconnect attempt ${this.reconnectAttempts} failed:`, err);
    }

    if (this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      const delay = Math.min(2000 * 2 ** this.reconnectAttempts, MAX_RECONNECT_DELAY_MS);
      console.log(`[EEG] Scheduling retry in ${delay}ms`);
      this.reconnectTimer = setTimeout(() => this.reconnect(), delay);
    } else {
      console.warn('[EEG] Max reconnect attempts reached — giving up');
      this.state.reconnecting = false;
      this.onDisconnect?.();
    }
  }

  private classifyError(err: any): EEGError {
    const msg = String(err?.message ?? err ?? '').toLowerCase();
    if (msg.includes('globally disabled')) {
      return 'no_bluetooth';
    }
    if (msg.includes('bluetooth') && (msg.includes('not found') || msg.includes('not available'))) {
      return 'no_bluetooth';
    }
    if (msg.includes('permission') || msg.includes('denied') || msg.includes('blocked') || msg.includes('notallowed')) {
      return 'permission_denied';
    }
    if (
      msg.includes('notfound') ||
      msg.includes('not found') ||
      msg.includes('no device') ||
      msg.includes('cancelled') ||
      msg.includes('canceled')
    ) {
      return 'not_found';
    }
    return 'unknown';
  }

  getLastError(): EEGError | null {
    return this.lastError;
  }

  getErrorMessage(): string {
    switch (this.lastError) {
      case 'no_bluetooth':
        return 'Web Bluetooth not enabled — see setup instructions below';
      case 'permission_denied':
        return 'Bluetooth blocked — click the lock/site-settings icon in the address bar to allow';
      case 'not_found':
        return "Headband not found — make sure it's powered on, nearby, and not connected to another app";
      case 'wasm_not_ready':
        return 'EEG processing not ready — try refreshing the page';
      default:
        return 'Headband connection failed — check that Bluetooth is on and headband is powered';
    }
  }

  private processFrame(frame: any): void {
    const isEarlyFrame = this.frameCount < EARLY_FRAME_LOG_LIMIT;

    if (this.frameCount === 0) {
      console.log('[EEG] First frame received:', {
        keys: Object.keys(frame),
        hasEeg: !!frame?.eeg,
        hasSamples: !!frame?.eeg?.samples,
        sampleCount: frame?.eeg?.samples?.length,
        channelCount: frame?.eeg?.channelCount,
        channelNames: frame?.eeg?.channelNames,
        sampleRate: frame?.eeg?.sampleRateHz,
        source: frame?.source,
        schemaVersion: frame?.schemaVersion,
        hasBattery: !!frame?.battery,
        hasAccgyro: !!frame?.accgyro,
        hasOptics: !!frame?.optics,
      });
    }

    this.bleNotificationCount++;

    // Extract battery data from Athena frames
    this.extractAuxData(frame);

    const eeg = frame?.eeg;
    if (!eeg) {
      this.emptyDecodeCount++;
      if (this.emptyDecodeCount <= 5) {
        console.warn(
          '[EEG] Frame has no eeg property. Keys:',
          Object.keys(frame),
          'emptyCount:',
          this.emptyDecodeCount,
        );
      }
      return;
    }

    const samples = eeg.samples ?? eeg.data;
    if (!samples || samples.length === 0) {
      this.emptyDecodeCount++;
      if (this.emptyDecodeCount <= 5) {
        console.warn('[EEG] Frame eeg has no samples. Keys:', Object.keys(eeg), 'emptyCount:', this.emptyDecodeCount);
      }
      return;
    }

    this.frameCount++;

    let channelSamples: number[];
    if (Array.isArray(samples[0])) {
      channelSamples = samples.map((row: number[]) => row[0]);
    } else {
      channelSamples = samples as number[];
    }

    if (isEarlyFrame) {
      console.log(
        `[EEG] Frame #${this.frameCount}: ${channelSamples.length} samples, range [${Math.min(...channelSamples).toFixed(1)}, ${Math.max(...channelSamples).toFixed(1)}]`,
      );
    }

    this.sampleRate = eeg.sampleRateHz ?? eeg.sampleRate ?? 256;

    // Append to accumulated buffer
    for (const s of channelSamples) {
      this.recentSamples.push(s);
    }
    if (this.recentSamples.length > EEG_SAMPLE_BUFFER_SIZE) {
      this.recentSamples.splice(0, this.recentSamples.length - EEG_SAMPLE_BUFFER_SIZE);
    }

    // Only run WASM analysis once we have enough accumulated samples
    if (this.recentSamples.length < MIN_ANALYSIS_SAMPLES) {
      if (isEarlyFrame) {
        console.log(`[EEG] Accumulating samples: ${this.recentSamples.length}/${MIN_ANALYSIS_SAMPLES}`);
      }
      this.state.signalQuality = Math.min(1, this.recentSamples.length / EEG_SAMPLE_BUFFER_SIZE);
      return;
    }

    // Build Float32Array from the full accumulated buffer for WASM
    const bufferF32 = new Float32Array(this.recentSamples);

    try {
      if (this.calmnessModel) {
        const result = this.calmnessModel.process(bufferF32);
        if (result) {
          this.state.calm = Math.max(0, Math.min(1, result.percentage() / 100));
          try {
            this.state.calmnessState = result.state_description();
          } catch {
            this.state.calmnessState = null;
          }
          this.state.alphaBetaRatio = result.alpha_beta_ratio ?? null;
          if (isEarlyFrame) {
            console.log('[EEG] Calmness result:', {
              calm: this.state.calm,
              state: this.state.calmnessState,
              ratio: this.state.alphaBetaRatio,
            });
          }
        } else if (isEarlyFrame) {
          console.log(`[EEG] Calmness model returned null (buffer: ${this.recentSamples.length} samples)`);
        }
      } else if (isEarlyFrame) {
        console.warn('[EEG] calmnessModel is null — WASM models not initialized');
      }

      if (this.alphaBumpDetector) {
        const result = this.alphaBumpDetector.process(bufferF32);
        this.state.alphaBump = result?.is_high() ?? false;
        try {
          this.state.alphaBumpState = result?.state ?? null;
        } catch {
          this.state.alphaBumpState = null;
        }
      }

      if (this.alphaPeakModel) {
        const result = this.alphaPeakModel.process(bufferF32);
        if (result) {
          this.state.alphaPeakFreq = result.peak_frequency ?? null;
          this.state.alphaPeakSnr = result.snr ?? null;
        }
      }

      if (this.eegModule) {
        const powers = this.eegModule.band_powers(bufferF32, this.sampleRate);
        // Normalize alpha/beta/theta/gamma relative to their own sum (excluding delta)
        // Delta dominates in consumer EEG due to DC offset and 1/f slope, making other bands invisible
        const abTotal = powers.alpha + powers.beta + powers.theta + powers.gamma || 1;
        this.state.alphaPower = powers.alpha / abTotal;
        this.state.betaPower = powers.beta / abTotal;
        this.state.thetaPower = powers.theta / abTotal;
        this.state.gammaPower = powers.gamma / abTotal;
        const fullTotal = powers.alpha + powers.beta + powers.theta + powers.delta + powers.gamma || 1;
        this.state.deltaPower = powers.delta / fullTotal;
        this.state.arousal = Math.min(1, Math.max(0, powers.beta / abTotal));
        if (isEarlyFrame) {
          console.log('[EEG] Band powers normalized (excl-delta, buffer:', this.recentSamples.length, 'samples):', {
            alpha: this.state.alphaPower.toFixed(3),
            beta: this.state.betaPower.toFixed(3),
            theta: this.state.thetaPower.toFixed(3),
            gamma: this.state.gammaPower.toFixed(3),
            delta: this.state.deltaPower.toFixed(3),
            rawAbTotal: abTotal.toFixed(1),
            rawFullTotal: fullTotal.toFixed(1),
          });
        }
      } else if (isEarlyFrame) {
        console.warn('[EEG] eegModule is null — cannot compute band powers');
      }

      this.state.signalQuality = Math.min(1, this.recentSamples.length / EEG_SAMPLE_BUFFER_SIZE);

      this.recordBandPowerSnapshot();

      const now = Date.now();
      if (now - this.lastLogTime >= LOG_INTERVAL_MS) {
        this.lastLogTime = now;
        console.log('[EEG] Status', {
          frames: this.frameCount,
          buffer: this.recentSamples.length,
          decodeErrors: this.decodeErrorCount,
          modelsReady: this.modelsReady,
          calm: this.state.calm?.toFixed(2),
          calmnessState: this.state.calmnessState,
          arousal: this.state.arousal?.toFixed(2),
          alpha: this.state.alphaPower?.toFixed(2),
          beta: this.state.betaPower?.toFixed(2),
          theta: this.state.thetaPower?.toFixed(2),
          delta: this.state.deltaPower?.toFixed(2),
          gamma: this.state.gammaPower?.toFixed(2),
          alphaPeakFreq: this.state.alphaPeakFreq?.toFixed(1),
          alphaBumpState: this.state.alphaBumpState,
          signalQuality: this.state.signalQuality.toFixed(2),
          battery: this.state.batteryLevel,
          sampleRate: this.sampleRate,
        });
      }
    } catch (err) {
      console.warn('[EEG] Frame processing error:', err);
    }
  }

  private extractAuxData(frame: any): void {
    // Battery level from Athena frames
    if (frame?.battery?.samples) {
      const batSamples = frame.battery.samples;
      if (batSamples.length > 0) {
        const rawBattery = batSamples[batSamples.length - 1];
        if (typeof rawBattery === 'number' && rawBattery >= 0) {
          const prev = this.state.batteryLevel;
          this.state.batteryLevel = Math.round(Math.max(0, Math.min(100, rawBattery)));
          if (prev === null || Math.abs(this.state.batteryLevel - prev) >= 5) {
            console.log('[EEG] Battery:', this.state.batteryLevel + '%');
          }
        }
      }
    }

    // Accelerometer/gyro magnitude for motion detection
    if (frame?.accgyro?.samples) {
      const rows = frame.accgyro.samples;
      if (rows.length > 0) {
        const lastRow = rows[rows.length - 1];
        if (Array.isArray(lastRow) && lastRow.length >= 3) {
          const [ax, ay, az] = lastRow;
          this.state.lastAccelMagnitude = Math.sqrt(ax * ax + ay * ay + az * az);
        }
      }
    }
  }

  init(): void {}

  update(_dt: number): void {
    this.state.alphaBump = false;

    if (this.connected && this.connectTime > 0) {
      const elapsed = Date.now() - this.connectTime;

      if (this.frameCount === 0 && elapsed >= NO_FRAME_WARN_MS) {
        if (!this.noFrameWarned) {
          this.noFrameWarned = true;
          console.warn('[EEG] ⚠ Connected for', (elapsed / 1000).toFixed(1), 's but ZERO EEG frames received.', {
            bleNotifications: this.bleNotificationCount,
            emptyDecodes: this.emptyDecodeCount,
            decodeErrors: this.decodeErrorCount,
            modelsReady: this.modelsReady,
            transportExists: !!this.transport,
          });
          if (this.bleNotificationCount === 0) {
            console.warn(
              '[EEG] BLE notifications never arrived. The headband may not be streaming, or GATT subscriptions failed. Try: power cycle headband, refresh page, reconnect.',
            );
          } else if (this.emptyDecodeCount > 0) {
            console.warn(
              '[EEG] BLE notifications arrived but decoder returned empty EEG data.',
              this.emptyDecodeCount,
              'empty decodes.',
            );
          }
        }
        // Repeat warning every 10 seconds while still 0 frames
        if (elapsed > 0 && Math.floor(elapsed / 10000) > Math.floor((elapsed - _dt * 1000) / 10000)) {
          console.warn(
            '[EEG] Still 0 frames after',
            (elapsed / 1000).toFixed(0),
            's. notifications:',
            this.bleNotificationCount,
            'empty:',
            this.emptyDecodeCount,
            'errors:',
            this.decodeErrorCount,
          );
        }
      }
    }
  }

  getIntent(): Partial<PlayerIntent> {
    if (!this.connected) return {};
    if (this.state.calm === null && this.state.arousal === null) return {};
    return {
      calm: this.state.calm ?? undefined,
      arousal: this.state.arousal ?? undefined,
    };
  }

  destroy(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.transport) {
      try {
        this.transport.stop?.();
      } catch {
        /* swallow */
      }
      try {
        this.transport.disconnect?.();
      } catch {
        /* swallow */
      }
      this.transport = null;
    }
    this.storedDevice = null;
    this.connected = false;
    this.state.connected = false;
    this.state.reconnecting = false;
    this.reconnectAttempts = 0;
  }

  getState(): Readonly<EEGProviderState> {
    return this.state;
  }

  isConnected(): boolean {
    return this.connected;
  }

  getRecentSamples(): number[] {
    return this.recentSamples;
  }

  getFrameCount(): number {
    return this.frameCount;
  }

  getDecodeErrorCount(): number {
    return this.decodeErrorCount;
  }

  getBleNotificationCount(): number {
    return this.bleNotificationCount;
  }

  getEmptyDecodeCount(): number {
    return this.emptyDecodeCount;
  }

  isModelsReady(): boolean {
    return this.modelsReady;
  }

  getReconnectCount(): number {
    return this.reconnectCount;
  }

  getReconnectAttempt(): number {
    return this.reconnectAttempts;
  }

  isReconnecting(): boolean {
    return this.state.reconnecting;
  }

  getBatteryLevel(): number | null {
    return this.state.batteryLevel;
  }

  getBandPowerHistory(): BandPowerSnapshot[] {
    return this.state.bandPowerHistory;
  }

  private recordBandPowerSnapshot(): void {
    const now = performance.now() / 1000;
    if (now - this.bandHistoryTimer < BAND_HISTORY_INTERVAL) return;
    this.bandHistoryTimer = now;

    const { alphaPower, betaPower, thetaPower, deltaPower, gammaPower } = this.state;
    if (alphaPower === null) return;

    this.state.bandPowerHistory.push({
      alpha: alphaPower ?? 0,
      beta: betaPower ?? 0,
      theta: thetaPower ?? 0,
      delta: deltaPower ?? 0,
      gamma: gammaPower ?? 0,
    });

    if (this.state.bandPowerHistory.length > BAND_HISTORY_SIZE) {
      this.state.bandPowerHistory.shift();
    }
  }
}
