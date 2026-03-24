import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hud, type HudState } from './hud';

vi.mock('../config', () => ({
  CONFIG: {
    COLORS: {
      PRIMARY: '#00cccc',
      ACCENT: '#ff3300',
      SECONDARY: '#8844ff',
      PASSION: '#ff2255',
      DANGER: '#ff0044',
      TEXT_LIGHT: '#cccccc',
      TEXT_DIM: '#666666',
    },
    CANVAS_WIDTH: 1280,
    CANVAS_HEIGHT: 720,
  },
}));

const createHudState = (overrides: Partial<HudState> = {}): HudState => ({
  score: 0,
  combo: 0,
  wave: 1,
  sector: 'sector1',
  sectorName: 'Neural Cage',
  powerupActive: null,
  powerupTimeRemaining: 0,
  calmLevel: 0.5,
  arousalLevel: 0.5,
  ...overrides,
});

/** Read private fields for logic-only unit tests */
function getHudInternals(hud: Hud) {
  return hud as unknown as {
    time: number;
    scoreDisplay: number;
    lastScore: number;
    scorePulse: number;
    levelTitleText: string;
    levelSubtitleText: string;
    levelRuleHint: string;
    levelTitleTimer: number;
    _isMuted: boolean;
  };
}

describe('Hud', () => {
  let hud: Hud;

  beforeEach(() => {
    hud = new Hud();
  });

  it('constructs an instance', () => {
    expect(hud).toBeInstanceOf(Hud);
  });

  describe('update', () => {
    it('increments internal time', () => {
      const state = createHudState();
      hud.update(0.25, state);
      hud.update(0.25, state);
      expect(getHudInternals(hud).time).toBeCloseTo(0.5, 5);
    });

    it('animates scoreDisplay toward state.score', () => {
      const state = createHudState({ score: 50 });
      const dt = 0.001;
      for (let i = 0; i < 30; i++) {
        hud.update(dt, state);
      }
      const { scoreDisplay } = getHudInternals(hud);
      expect(scoreDisplay).toBeGreaterThan(0);
      expect(scoreDisplay).toBeLessThanOrEqual(50);
      for (let i = 0; i < 200; i++) {
        hud.update(dt, state);
      }
      expect(getHudInternals(hud).scoreDisplay).toBe(50);
    });

    it('sets scorePulse when score changes', () => {
      const state0 = createHudState({ score: 0 });
      hud.update(0.01, state0);
      expect(getHudInternals(hud).scorePulse).toBe(0);

      const state100 = createHudState({ score: 100 });
      hud.update(0.0001, state100);
      expect(getHudInternals(hud).scorePulse).toBeGreaterThan(0);
    });
  });

  describe('showLevelTitle', () => {
    it('sets title (and subtitle/rule hint) and starts the timer', () => {
      hud.showLevelTitle('Act I', 'The Cave', 'Stay calm');
      const internal = getHudInternals(hud);
      expect(internal.levelTitleText).toBe('Act I');
      expect(internal.levelSubtitleText).toBe('The Cave');
      expect(internal.levelRuleHint).toBe('Stay calm');
      expect(internal.levelTitleTimer).toBe(4);
      expect(hud.isShowingLevelTitle()).toBe(true);
    });
  });

  describe('isShowingLevelTitle', () => {
    it('is true after showLevelTitle and false after the timer expires', () => {
      hud.showLevelTitle('Level');
      expect(hud.isShowingLevelTitle()).toBe(true);

      hud.update(4.0, createHudState());
      expect(hud.isShowingLevelTitle()).toBe(false);
    });
  });

  describe('isPauseButtonClicked', () => {
    it('returns false when coordinates are outside default bounds (0,0,0,0)', () => {
      expect(hud.isPauseButtonClicked(50, 50)).toBe(false);
    });
  });

  describe('isMuteButtonClicked', () => {
    it('returns false when coordinates are outside default bounds (0,0,0,0)', () => {
      expect(hud.isMuteButtonClicked(50, 50)).toBe(false);
    });
  });

  describe('setMuteState', () => {
    it('stores mute state', () => {
      hud.setMuteState(true);
      expect(getHudInternals(hud)._isMuted).toBe(true);
      hud.setMuteState(false);
      expect(getHudInternals(hud)._isMuted).toBe(false);
    });
  });

  describe('reset', () => {
    it('resets scoreDisplay, lastScore, scorePulse, and time to 0', () => {
      hud.update(1, createHudState({ score: 200 }));
      hud.update(0.5, createHudState({ score: 500 }));

      hud.reset();

      const internal = getHudInternals(hud);
      expect(internal.scoreDisplay).toBe(0);
      expect(internal.lastScore).toBe(0);
      expect(internal.scorePulse).toBe(0);
      expect(internal.time).toBe(0);
    });
  });
});
