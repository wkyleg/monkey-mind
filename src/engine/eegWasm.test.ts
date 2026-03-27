import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@elata-biosciences/eeg-web', () => ({
  initEegWasm: vi.fn(),
}));

vi.mock('@elata-biosciences/eeg-web/wasm/eeg_wasm_bg.wasm?url', () => ({
  default: 'mock-wasm-url',
}));

describe('eegWasm', () => {
  let initEegWasm: typeof import('./eegWasm').initEegWasm;
  let isEegWasmReady: typeof import('./eegWasm').isEegWasmReady;
  let getEegWasmInitError: typeof import('./eegWasm').getEegWasmInitError;
  let sdkInit: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    const sdk = await import('@elata-biosciences/eeg-web');
    sdkInit = sdk.initEegWasm as ReturnType<typeof vi.fn>;
    sdkInit.mockReset();
    const mod = await import('./eegWasm');
    initEegWasm = mod.initEegWasm;
    isEegWasmReady = mod.isEegWasmReady;
    getEegWasmInitError = mod.getEegWasmInitError;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts not ready', () => {
    expect(isEegWasmReady()).toBe(false);
  });

  it('returns true on successful init', async () => {
    sdkInit.mockResolvedValue(undefined);
    const result = await initEegWasm();
    expect(result).toBe(true);
    expect(isEegWasmReady()).toBe(true);
  });

  it('calls SDK initEegWasm with the wasm URL', async () => {
    sdkInit.mockResolvedValue(undefined);
    await initEegWasm();
    expect(sdkInit).toHaveBeenCalledWith({ module_or_path: 'mock-wasm-url' });
  });

  it('is idempotent — second call returns cached result', async () => {
    sdkInit.mockResolvedValue(undefined);
    await initEegWasm();
    await initEegWasm();
    expect(sdkInit).toHaveBeenCalledTimes(1);
  });

  it('returns false and captures error on failure', async () => {
    const err = new Error('wasm load failed');
    sdkInit.mockRejectedValue(err);
    const result = await initEegWasm();
    expect(result).toBe(false);
    expect(isEegWasmReady()).toBe(false);
    expect(getEegWasmInitError()).toBe(err);
  });

  it('does not throw on init failure', async () => {
    sdkInit.mockRejectedValue(new Error('boom'));
    await expect(initEegWasm()).resolves.toBe(false);
  });
});
