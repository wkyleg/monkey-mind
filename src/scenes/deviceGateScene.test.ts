import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeviceGateScene } from './deviceGateScene';

vi.mock('../util/math', () => ({
  oscillate: vi.fn(() => 0),
  lerp: vi.fn((a: number, _b: number, _t: number) => a),
  clamp: vi.fn((v: number, min: number, max: number) => Math.min(max, Math.max(min, v))),
}));

const mockNeuroManager = {
  hasActiveSource: vi.fn(() => false),
  enableCamera: vi.fn(() => Promise.resolve(true)),
  connectHeadband: vi.fn(() => Promise.resolve(true)),
  enableMock: vi.fn(),
  disableMock: vi.fn(),
  isWasmReady: vi.fn(() => true),
  getHeadbandErrorMessage: vi.fn(() => 'Headband connection failed'),
  getCameraErrorMessage: vi.fn(() => 'Camera connection failed'),
  getState: vi.fn(() => ({
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
    alphaBump: false,
  })),
};

const mockSceneManager = {
  pop: vi.fn(),
  push: vi.fn(),
};

const mockGame = {
  getNeuroManager: () => mockNeuroManager,
  getScenes: () => mockSceneManager,
} as any;

describe('DeviceGateScene', () => {
  let scene: DeviceGateScene;

  beforeEach(() => {
    scene = new DeviceGateScene(mockGame);
    vi.clearAllMocks();
  });

  it('should be an overlay', () => {
    expect(scene.isOverlay).toBe(true);
  });

  it('should not throw on enter', () => {
    expect(() => scene.enter()).not.toThrow();
  });

  it('should not throw on exit', () => {
    expect(() => scene.exit()).not.toThrow();
  });

  describe('Navigation', () => {
    it('should pop on cancel after cooldown', () => {
      scene.enter();
      // First tick exhausts the cooldown
      scene.update(0.5, { menuAxis: 0, confirm: false, cancel: false } as any);
      // Second tick processes the cancel
      scene.update(0.016, { menuAxis: 0, confirm: false, cancel: true } as any);
      expect(mockSceneManager.pop).toHaveBeenCalled();
    });

    it('should not pop during cooldown', () => {
      scene.enter();
      scene.update(0.1, { menuAxis: 0, confirm: false, cancel: true } as any);
      expect(mockSceneManager.pop).not.toHaveBeenCalled();
    });
  });
});
