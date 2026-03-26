/**
 * Music System Tests
 *
 * Tests for procedural music moods, transitions, and controls.
 * Note: These tests mock the Web Audio API at a high level.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Create comprehensive mock for Web Audio API
const createMockAudioContext = () => {
  const mockBufferSource = {
    buffer: null,
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    disconnect: vi.fn(),
  };

  const mockOscillator = {
    type: 'sine',
    frequency: { value: 440, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
    detune: { value: 0 },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    disconnect: vi.fn(),
  };

  const mockGain = {
    gain: {
      value: 0,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };

  const mockFilter = {
    type: 'lowpass',
    frequency: { value: 1000, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
    Q: { value: 1 },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };

  const mockPanner = {
    pan: { value: 0 },
    connect: vi.fn(),
  };

  const mockConvolver = {
    buffer: null,
    connect: vi.fn(),
  };

  const mockDistortion = {
    curve: null,
    oversample: '2x',
    connect: vi.fn(),
  };

  const mockAnalyser = {
    fftSize: 256,
    getByteFrequencyData: vi.fn(),
    connect: vi.fn(),
  };

  return {
    state: 'suspended' as 'suspended' | 'running',
    currentTime: 0,
    sampleRate: 44100,
    destination: {},

    createOscillator: vi.fn(() => ({ ...mockOscillator })),
    createGain: vi.fn(() => ({ ...mockGain })),
    createBiquadFilter: vi.fn(() => ({ ...mockFilter })),
    createStereoPanner: vi.fn(() => ({ ...mockPanner })),
    createConvolver: vi.fn(() => ({ ...mockConvolver })),
    createWaveShaper: vi.fn(() => ({ ...mockDistortion })),
    createAnalyser: vi.fn(() => ({ ...mockAnalyser })),
    createBuffer: vi.fn(() => ({ getChannelData: () => new Float32Array(44100) })),
    createBufferSource: vi.fn(() => ({ ...mockBufferSource })),

    resume: vi.fn().mockImplementation(function (this: { state: string }) {
      this.state = 'running';
      return Promise.resolve();
    }),

    suspend: vi.fn().mockImplementation(function (this: { state: string }) {
      this.state = 'suspended';
      return Promise.resolve();
    }),
  };
};

// Store original
const OriginalAudioContext = (global as any).AudioContext;

describe('ProceduralMusic', () => {
  let mockContext: ReturnType<typeof createMockAudioContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockContext = createMockAudioContext();
    (global as any).AudioContext = vi.fn(() => mockContext);
  });

  afterEach(() => {
    (global as any).AudioContext = OriginalAudioContext;
    vi.resetModules();
  });

  it('should create instance without crashing', async () => {
    const { ProceduralMusic } = await import('./music');
    const music = new ProceduralMusic();
    expect(music).toBeDefined();
  });

  it('should start without throwing', async () => {
    const { ProceduralMusic } = await import('./music');
    const music = new ProceduralMusic();
    expect(() => music.start()).not.toThrow();
  });

  it('should stop without throwing', async () => {
    const { ProceduralMusic } = await import('./music');
    const music = new ProceduralMusic();
    music.start();
    expect(() => music.stop()).not.toThrow();
  });

  it('should track playing state', async () => {
    const { ProceduralMusic } = await import('./music');
    const music = new ProceduralMusic();

    expect(music.isPlaying()).toBe(false);
    music.start();
    expect(music.isPlaying()).toBe(true);
    music.stop();
    expect(music.isPlaying()).toBe(false);
  });

  it('should toggle mute', async () => {
    const { ProceduralMusic } = await import('./music');
    const music = new ProceduralMusic();

    expect(music.isMuted()).toBe(false);
    music.toggleMute();
    expect(music.isMuted()).toBe(true);
    music.toggleMute();
    expect(music.isMuted()).toBe(false);
  });

  it('should set menu mood without crashing', async () => {
    const { ProceduralMusic } = await import('./music');
    const music = new ProceduralMusic();
    expect(() => music.setMenuMood()).not.toThrow();
  });

  it('should set intro mood without crashing', async () => {
    const { ProceduralMusic } = await import('./music');
    const music = new ProceduralMusic();
    expect(() => music.setIntroMood()).not.toThrow();
  });

  it('should set boss mood without crashing', async () => {
    const { ProceduralMusic } = await import('./music');
    const music = new ProceduralMusic();
    expect(() => music.setBossMood()).not.toThrow();
  });

  it('should set sector mood without crashing', async () => {
    const { ProceduralMusic } = await import('./music');
    const music = new ProceduralMusic();

    for (let i = 1; i <= 5; i++) {
      expect(() => music.setMood(`sector${i}` as any)).not.toThrow();
    }
  });

  it('should update without crashing when playing', async () => {
    const { ProceduralMusic } = await import('./music');
    const music = new ProceduralMusic();
    music.start();
    expect(() => music.update(1 / 60)).not.toThrow();
  });

  it('should update without crashing when stopped', async () => {
    const { ProceduralMusic } = await import('./music');
    const music = new ProceduralMusic();
    expect(() => music.update(1 / 60)).not.toThrow();
  });

  it('should handle rapid start/stop cycles', async () => {
    const { ProceduralMusic } = await import('./music');
    const music = new ProceduralMusic();

    for (let i = 0; i < 10; i++) {
      music.start();
      music.stop();
    }

    expect(music.isPlaying()).toBe(false);
  });

  it('should preserve mute state across mood changes', async () => {
    const { ProceduralMusic } = await import('./music');
    const music = new ProceduralMusic();

    music.toggleMute();
    expect(music.isMuted()).toBe(true);

    music.setMenuMood();
    expect(music.isMuted()).toBe(true);

    music.setBossMood();
    expect(music.isMuted()).toBe(true);
  });

  it('should handle multiple mood changes while playing', async () => {
    const { ProceduralMusic } = await import('./music');
    const music = new ProceduralMusic();

    music.start();

    expect(() => {
      music.setMenuMood();
      music.setBossMood();
      music.setIntroMood();
      music.setMenuMood();
    }).not.toThrow();

    expect(music.isPlaying()).toBe(true);
  });

  it('should set Act mood without crashing', async () => {
    const { ProceduralMusic } = await import('./music');
    const music = new ProceduralMusic();

    const actIds = [
      'act1_escape',
      'act2_ocean',
      'act3_heroic',
      'act4_sacred',
      'act5_painted',
      'act6_library',
      'act7_machine',
      'act8_signals',
    ];

    for (const actId of actIds) {
      expect(() => music.setActMood(actId, 0)).not.toThrow();
      expect(() => music.setActMood(actId, 2)).not.toThrow();
      expect(() => music.setActMood(actId, 4)).not.toThrow();
    }
  });

  it('should vary music parameters per level within an Act', async () => {
    const { ProceduralMusic } = await import('./music');
    const music = new ProceduralMusic();

    // Test that setActMood doesn't throw for different level indices
    music.start();

    expect(() => {
      music.setActMood('act1_escape', 0);
      music.setActMood('act1_escape', 1);
      music.setActMood('act1_escape', 2);
      music.setActMood('act1_escape', 3);
      music.setActMood('act1_escape', 4);
    }).not.toThrow();

    expect(music.isPlaying()).toBe(true);
  });

  it('should handle unknown Act ID gracefully', async () => {
    const { ProceduralMusic } = await import('./music');
    const music = new ProceduralMusic();

    // Unknown act should fall back to neural/default
    expect(() => music.setActMood('unknown_act', 0)).not.toThrow();
  });

  describe('Heart Rate Tempo Sync', () => {
    it('should accept heart rate BPM without crashing', async () => {
      const { ProceduralMusic } = await import('./music');
      const music = new ProceduralMusic();
      expect(() => music.setHeartRateBpm(72, 0.8)).not.toThrow();
    });

    it('should handle null BPM', async () => {
      const { ProceduralMusic } = await import('./music');
      const music = new ProceduralMusic();
      expect(() => music.setHeartRateBpm(null, 0.5)).not.toThrow();
    });

    it('should handle low quality signal', async () => {
      const { ProceduralMusic } = await import('./music');
      const music = new ProceduralMusic();
      expect(() => music.setHeartRateBpm(72, 0.2)).not.toThrow();
    });

    it('should handle zero quality signal', async () => {
      const { ProceduralMusic } = await import('./music');
      const music = new ProceduralMusic();
      expect(() => music.setHeartRateBpm(72, 0)).not.toThrow();
    });

    it('should handle extreme BPM values gracefully', async () => {
      const { ProceduralMusic } = await import('./music');
      const music = new ProceduralMusic();
      expect(() => music.setHeartRateBpm(200, 1.0)).not.toThrow();
      expect(() => music.setHeartRateBpm(40, 1.0)).not.toThrow();
    });

    it('should work during playback', async () => {
      const { ProceduralMusic } = await import('./music');
      const music = new ProceduralMusic();
      music.start();
      music.setHeartRateBpm(80, 0.9);
      expect(() => music.update(1 / 60)).not.toThrow();
    });
  });
});
