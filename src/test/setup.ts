/**
 * Vitest global test setup
 *
 * This file runs before each test file to set up the testing environment.
 */

import { beforeEach, vi } from 'vitest';

// Mock Canvas 2D context for rendering tests
class MockCanvasRenderingContext2D {
  canvas = { width: 800, height: 600 };
  fillStyle = '';
  strokeStyle = '';
  lineWidth = 1;
  font = '';
  textAlign = 'left' as CanvasTextAlign;
  textBaseline = 'top' as CanvasTextBaseline;
  globalAlpha = 1;
  shadowColor = '';
  shadowBlur = 0;
  shadowOffsetX = 0;
  shadowOffsetY = 0;

  save = vi.fn();
  restore = vi.fn();
  fillRect = vi.fn();
  strokeRect = vi.fn();
  clearRect = vi.fn();
  beginPath = vi.fn();
  closePath = vi.fn();
  moveTo = vi.fn();
  lineTo = vi.fn();
  arc = vi.fn();
  fill = vi.fn();
  stroke = vi.fn();
  fillText = vi.fn();
  strokeText = vi.fn();
  measureText = vi.fn(() => ({ width: 100 }));
  drawImage = vi.fn();
  translate = vi.fn();
  rotate = vi.fn();
  scale = vi.fn();
  setTransform = vi.fn();
  resetTransform = vi.fn();
  createLinearGradient = vi.fn(() => ({
    addColorStop: vi.fn(),
  }));
  createRadialGradient = vi.fn(() => ({
    addColorStop: vi.fn(),
  }));
  clip = vi.fn();
  quadraticCurveTo = vi.fn();
  bezierCurveTo = vi.fn();
  rect = vi.fn();
  arcTo = vi.fn();
  ellipse = vi.fn();
  isPointInPath = vi.fn(() => false);
  isPointInStroke = vi.fn(() => false);
  getImageData = vi.fn(() => ({
    data: new Uint8ClampedArray(800 * 600 * 4),
    width: 800,
    height: 600,
  }));
  putImageData = vi.fn();
  createImageData = vi.fn(() => ({
    data: new Uint8ClampedArray(800 * 600 * 4),
    width: 800,
    height: 600,
  }));
  setLineDash = vi.fn();
  getLineDash = vi.fn(() => []);
  lineDashOffset = 0;
}

// Mock HTMLCanvasElement
const originalGetContext = HTMLCanvasElement.prototype.getContext;
// @ts-expect-error - Mocking getContext with simplified signature
HTMLCanvasElement.prototype.getContext = function (contextId: string) {
  if (contextId === '2d') {
    return new MockCanvasRenderingContext2D() as unknown as CanvasRenderingContext2D;
  }
  return originalGetContext.call(this, contextId as '2d');
};

// Mock AudioContext for audio tests
class MockAudioContext {
  currentTime = 0;
  destination = { maxChannelCount: 2 };
  sampleRate = 44100;
  state = 'running' as AudioContextState;

  createOscillator = vi.fn(() => ({
    type: 'sine',
    frequency: { value: 440, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    detune: { value: 0, setValueAtTime: vi.fn() },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    disconnect: vi.fn(),
  }));

  createGain = vi.fn(() => ({
    gain: {
      value: 1,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
  }));

  createBiquadFilter = vi.fn(() => ({
    type: 'lowpass',
    frequency: { value: 1000, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    Q: { value: 1, setValueAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
  }));

  createDynamicsCompressor = vi.fn(() => ({
    threshold: { value: -24 },
    knee: { value: 30 },
    ratio: { value: 12 },
    attack: { value: 0.003 },
    release: { value: 0.25 },
    connect: vi.fn(),
    disconnect: vi.fn(),
  }));

  createWaveShaper = vi.fn(() => ({
    curve: null,
    oversample: 'none',
    connect: vi.fn(),
    disconnect: vi.fn(),
  }));

  createBufferSource = vi.fn(() => ({
    buffer: null,
    loop: false,
    playbackRate: { value: 1 },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    disconnect: vi.fn(),
  }));

  createBuffer = vi.fn((channels: number, length: number, sampleRate: number) => ({
    numberOfChannels: channels,
    length,
    sampleRate,
    duration: length / sampleRate,
    getChannelData: vi.fn(() => new Float32Array(length)),
  }));

  decodeAudioData = vi.fn();
  resume = vi.fn(() => Promise.resolve());
  suspend = vi.fn(() => Promise.resolve());
  close = vi.fn(() => Promise.resolve());
}

// @ts-expect-error - Mock global AudioContext
globalThis.AudioContext = MockAudioContext;
// @ts-expect-error - Mock webkit prefix
globalThis.webkitAudioContext = MockAudioContext;

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((i: number) => Object.keys(store)[i] || null),
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
});

// Mock requestAnimationFrame
globalThis.requestAnimationFrame = vi.fn((callback) => {
  return setTimeout(() => callback(performance.now()), 16) as unknown as number;
});

globalThis.cancelAnimationFrame = vi.fn((id) => {
  clearTimeout(id);
});

// Mock navigator.getGamepads
Object.defineProperty(navigator, 'getGamepads', {
  value: vi.fn(() => [null, null, null, null]),
  writable: true,
});

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
  localStorageMock.clear();
});

// Export mocks for use in tests
export { localStorageMock, MockAudioContext, MockCanvasRenderingContext2D };
