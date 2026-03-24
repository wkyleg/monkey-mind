/**
 * Procedural industrial music generator
 * Creates dark, atmospheric beats inspired by Nine Inch Nails / Crystal Castles
 * Enhanced with longer phrases, randomization, and evolving elements
 * Now with advanced scales, modes, and cultural music styles
 */

import { storage } from '../core/storage';

// ============================================================================
// MUSICAL SCALES AND MODES
// ============================================================================

/**
 * Scale definitions - semitone intervals from root
 * Each scale is an array of semitone offsets (0 = root)
 */
export const SCALES: Record<string, number[]> = {
  // Western modes (church modes)
  ionian: [0, 2, 4, 5, 7, 9, 11], // Major scale
  dorian: [0, 2, 3, 5, 7, 9, 10], // Minor with raised 6th
  phrygian: [0, 1, 3, 5, 7, 8, 10], // Minor with flat 2nd
  lydian: [0, 2, 4, 6, 7, 9, 11], // Major with raised 4th
  mixolydian: [0, 2, 4, 5, 7, 9, 10], // Major with flat 7th
  aeolian: [0, 2, 3, 5, 7, 8, 10], // Natural minor
  locrian: [0, 1, 3, 5, 6, 8, 10], // Diminished

  // Harmonic variants
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  melodicMinor: [0, 2, 3, 5, 7, 9, 11],
  phrygianDominant: [0, 1, 4, 5, 7, 8, 10], // Spanish/Flamenco
  doubleHarmonic: [0, 1, 4, 5, 7, 8, 11], // Byzantine/Arabic

  // Symmetric scales
  wholeTone: [0, 2, 4, 6, 8, 10],
  diminished: [0, 2, 3, 5, 6, 8, 9, 11], // Whole-half diminished
  augmented: [0, 3, 4, 7, 8, 11],

  // Pentatonic scales
  pentatonicMajor: [0, 2, 4, 7, 9],
  pentatonicMinor: [0, 3, 5, 7, 10],
  blues: [0, 3, 5, 6, 7, 10],

  // Japanese scales
  hirajoshi: [0, 2, 3, 7, 8],
  insen: [0, 1, 5, 7, 10],
  iwato: [0, 1, 5, 6, 10],
  kumoi: [0, 2, 3, 7, 9],

  // Indonesian (Gamelan)
  pelog: [0, 1, 3, 7, 8],
  slendro: [0, 2, 5, 7, 9],

  // Indian (Raga approximations)
  bhairav: [0, 1, 4, 5, 7, 8, 11], // Morning raga
  kafi: [0, 2, 3, 5, 7, 9, 10], // Similar to Dorian
  purvi: [0, 1, 4, 6, 7, 8, 11], // Evening raga
  marwa: [0, 1, 4, 6, 7, 9, 11], // Twilight raga
  todi: [0, 1, 3, 6, 7, 8, 11], // Somber raga

  // Middle Eastern
  hijaz: [0, 1, 4, 5, 7, 8, 10],
  nikriz: [0, 1, 4, 6, 7, 9, 10],
  saba: [0, 1, 3, 4, 7, 8, 10],

  // Experimental / Atonal
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  tritone: [0, 6],
  quartal: [0, 5, 10], // Stacked 4ths
};

/**
 * Chord progressions by mood/style
 * Values are ratios relative to root (1 = unison)
 */
export const CHORD_PROGRESSIONS_BY_STYLE: Record<string, number[][]> = {
  // Dark/Industrial
  dark: [
    [1, 1.5, 1.25, 1.33], // i - v - iv - bVII
    [1, 1.125, 1.25, 1.5], // i - bII - iv - v
    [1, 1.33, 1.125, 1.25], // i - bVII - bII - iv
  ],
  // Heroic/Epic
  heroic: [
    [1, 1.25, 1.5, 1.33], // I - IV - V - bVII
    [1, 1.5, 1.25, 1.125], // I - V - IV - II
    [1, 1.33, 1.5, 1.25], // I - bVII - V - IV
  ],
  // Sacred/Spiritual
  sacred: [
    [1, 1.25, 1.2, 1.33], // I - IV - iii - bVII
    [1, 1.5, 1.33, 1.25], // I - V - bVII - IV
    [1, 1.2, 1.5, 1.25], // I - iii - V - IV
  ],
  // Mysterious/Ambient
  mysterious: [
    [1, Math.SQRT2, 1.25, 1.125], // Tritone-based
    [1, 1.189, Math.SQRT2, 1.68], // Minor 3rds
    [1, 1.33, 1.5, 1.78], // Ascending
  ],
  // Aggressive
  aggressive: [
    [1, 1.125, 1.33, 1.5], // i - bII - bVII - v
    [1, Math.SQRT2, 1.125, 1.33], // Tritone chaos
    [1, 1.5, 1.125, Math.SQRT2], // Dissonant
  ],
};

/**
 * Melodic patterns (semitone offsets)
 */
export const MELODY_PATTERNS_EXTENDED: Record<string, number[][]> = {
  ascending: [
    [0, 2, 4, 7],
    [0, 3, 5, 7],
    [0, 2, 5, 7, 12],
  ],
  descending: [
    [12, 7, 5, 0],
    [7, 5, 3, 0],
    [12, 10, 7, 5, 0],
  ],
  arpeggio: [
    [0, 4, 7, 12],
    [0, 3, 7, 12],
    [0, 5, 7, 12],
  ],
  pentatonic: [
    [0, 2, 4, 7, 9],
    [0, 3, 5, 7, 10],
    [7, 5, 3, 0, -5],
  ],
  chromatic: [
    [0, 1, 2, 3],
    [0, -1, 0, 1, 0],
    [0, 1, 3, 4, 6],
  ],
  modal: [
    [0, 1, 3, 5, 7], // Phrygian feel
    [0, 2, 4, 6, 7], // Lydian feel
    [0, 2, 3, 5, 7, 10], // Dorian feel
  ],
};

/**
 * Get frequency for a note in a scale
 * @param rootFreq The root frequency (e.g., 220 for A3)
 * @param scale The scale to use
 * @param degree The scale degree (0-indexed)
 * @param octave Octave offset (-1, 0, 1, etc.)
 */
export function getScaleFrequency(rootFreq: number, scale: number[], degree: number, octave: number = 0): number {
  // Wrap degree to scale length
  const scaleLength = scale.length;
  const wrappedDegree = ((degree % scaleLength) + scaleLength) % scaleLength;
  const additionalOctaves = Math.floor(degree / scaleLength);

  // Calculate semitones from root
  const semitones = scale[wrappedDegree] + (octave + additionalOctaves) * 12;

  // Convert semitones to frequency ratio
  return rootFreq * 2 ** (semitones / 12);
}

/**
 * Generate a chord from a scale
 * @param rootFreq The root frequency
 * @param scale The scale to use
 * @param rootDegree The starting degree in the scale
 * @param intervals Array of scale degree offsets (e.g., [0, 2, 4] for triad)
 */
export function getScaleChord(
  rootFreq: number,
  scale: number[],
  rootDegree: number,
  intervals: number[] = [0, 2, 4],
): number[] {
  return intervals.map((interval) => getScaleFrequency(rootFreq, scale, rootDegree + interval));
}

// ============================================================================
// MUSIC PARAMS AND TYPES
// ============================================================================

type SectorMood =
  | 'neural'
  | 'reef'
  | 'pantheon'
  | 'projects'
  | 'bloom'
  | 'boss'
  | 'menu'
  | 'intro'
  | 'escape'
  | 'ocean'
  | 'heroic'
  | 'sacred'
  | 'painted'
  | 'library'
  | 'machine'
  | 'signals';

interface MusicParams {
  tempo: number;
  bassFreq: number;
  padNote: number;
  droneNote: number;
  intensity: number;
  // Sector-specific character
  filterCutoff: number;
  detuneAmount: number;
  noiseType: 'lowpass' | 'highpass' | 'bandpass';
  useReverb: boolean;
  distortionAmount: number;
}

const SECTOR_PARAMS: Record<SectorMood, MusicParams> = {
  neural: {
    tempo: 110,
    bassFreq: 40,
    padNote: 220,
    droneNote: 55,
    intensity: 0.3,
    filterCutoff: 400,
    detuneAmount: 3,
    noiseType: 'lowpass',
    useReverb: false,
    distortionAmount: 0.2,
  },
  reef: {
    tempo: 95,
    bassFreq: 35,
    padNote: 196,
    droneNote: 49,
    intensity: 0.4,
    filterCutoff: 600,
    detuneAmount: 8,
    noiseType: 'bandpass',
    useReverb: true,
    distortionAmount: 0.1,
  },
  pantheon: {
    tempo: 85,
    bassFreq: 30,
    padNote: 174.6,
    droneNote: 43.65,
    intensity: 0.5,
    filterCutoff: 800,
    detuneAmount: 12,
    noiseType: 'lowpass',
    useReverb: true,
    distortionAmount: 0.15,
  },
  projects: {
    tempo: 125,
    bassFreq: 45,
    padNote: 233.08,
    droneNote: 58.27,
    intensity: 0.7,
    filterCutoff: 1200,
    detuneAmount: 5,
    noiseType: 'highpass',
    useReverb: false,
    distortionAmount: 0.5,
  },
  bloom: {
    tempo: 140,
    bassFreq: 50,
    padNote: 261.63,
    droneNote: 65.41,
    intensity: 0.9,
    filterCutoff: 2000,
    detuneAmount: 20,
    noiseType: 'bandpass',
    useReverb: true,
    distortionAmount: 0.4,
  },
  boss: {
    tempo: 140,
    bassFreq: 35,
    padNote: 146.83,
    droneNote: 36.71,
    intensity: 1.0,
    filterCutoff: 1500,
    detuneAmount: 7,
    noiseType: 'highpass',
    useReverb: false,
    distortionAmount: 0.6,
  },
  menu: {
    tempo: 70,
    bassFreq: 30,
    padNote: 110,
    droneNote: 27.5,
    intensity: 0.15,
    filterCutoff: 300,
    detuneAmount: 15,
    noiseType: 'lowpass',
    useReverb: true,
    distortionAmount: 0.05,
  },
  intro: {
    tempo: 60,
    bassFreq: 25,
    padNote: 82.4,
    droneNote: 41.2,
    intensity: 0.1,
    filterCutoff: 200,
    detuneAmount: 20,
    noiseType: 'lowpass',
    useReverb: true,
    distortionAmount: 0.02,
  },

  // Act 1: Escape - Clinical, sterile, tense lab environment
  escape: {
    tempo: 115,
    bassFreq: 38,
    padNote: 196, // G3 - clinical, neutral
    droneNote: 49, // G1
    intensity: 0.35,
    filterCutoff: 350,
    detuneAmount: 2, // Minimal - sterile sound
    noiseType: 'highpass',
    useReverb: false, // No reverb - tight, clinical
    distortionAmount: 0.15,
  },

  // Act 2: Ocean - Deep, flowing, bioluminescent underwater
  ocean: {
    tempo: 88,
    bassFreq: 32,
    padNote: 164.81, // E3 - flowing, oceanic
    droneNote: 41.2, // E1
    intensity: 0.4,
    filterCutoff: 700,
    detuneAmount: 12, // Wavy, flowing detune
    noiseType: 'bandpass',
    useReverb: true, // Deep reverb
    distortionAmount: 0.08,
  },

  // Act 3: Heroic - Epic, Greek, mythological grandeur
  heroic: {
    tempo: 100,
    bassFreq: 36,
    padNote: 220, // A3 - heroic, triumphant
    droneNote: 55, // A1
    intensity: 0.5,
    filterCutoff: 900,
    detuneAmount: 8,
    noiseType: 'lowpass',
    useReverb: true,
    distortionAmount: 0.12,
  },

  // Act 4: Sacred - Spiritual, reverent, golden
  sacred: {
    tempo: 75,
    bassFreq: 29.14, // Bb0
    padNote: 233.08, // Bb3 - sacred, church-like
    droneNote: 58.27, // Bb1
    intensity: 0.45,
    filterCutoff: 600,
    detuneAmount: 15, // Slightly detuned, ancient feel
    noiseType: 'lowpass',
    useReverb: true, // Cathedral reverb
    distortionAmount: 0.05,
  },

  // Act 5: Painted - Colorful, artistic, surreal
  painted: {
    tempo: 105,
    bassFreq: 43.65, // F1
    padNote: 174.61, // F3 - playful, artistic
    droneNote: 43.65,
    intensity: 0.55,
    filterCutoff: 1100,
    detuneAmount: 18, // Colorful, varied
    noiseType: 'bandpass',
    useReverb: true,
    distortionAmount: 0.2,
  },

  // Act 6: Library - Thoughtful, philosophical, paradoxical
  library: {
    tempo: 82,
    bassFreq: 34.65, // C#1
    padNote: 138.59, // C#3 - mysterious, intellectual
    droneNote: 34.65,
    intensity: 0.4,
    filterCutoff: 500,
    detuneAmount: 10,
    noiseType: 'lowpass',
    useReverb: true,
    distortionAmount: 0.1,
  },

  // Act 7: Machine - Industrial, mechanical, grinding
  machine: {
    tempo: 130,
    bassFreq: 46.25, // F#1
    padNote: 185, // F#3 - metallic, industrial
    droneNote: 46.25,
    intensity: 0.75,
    filterCutoff: 1400,
    detuneAmount: 4, // Precise, mechanical
    noiseType: 'highpass',
    useReverb: false, // Tight, industrial
    distortionAmount: 0.55,
  },

  // Act 8: Signals - Paranoid, cosmic, static-filled
  signals: {
    tempo: 95,
    bassFreq: 27.5, // A0 - deep, cosmic
    padNote: 110, // A2 - eerie, distant
    droneNote: 27.5,
    intensity: 0.6,
    filterCutoff: 800,
    detuneAmount: 25, // Unstable, glitchy
    noiseType: 'bandpass',
    useReverb: true,
    distortionAmount: 0.35,
  },
};

// Extended chord progressions for variety
const CHORD_PROGRESSIONS = [
  [1, 1.5, 1.25, 1.33], // i - v - iv - bVII
  [1, 1.33, 1.5, 1.25], // i - bVII - v - iv
  [1, 1.25, 1.33, 1.5], // i - iv - bVII - v
  [1, 1.125, 1.25, 1.33], // i - bII - iv - bVII
  [1, 1.5, 1.33, 1.25], // i - v - bVII - iv
  [1, 1.33, 1.25, 1.125], // i - bVII - iv - bII
];

// Melodic patterns for synth stabs
const MELODY_PATTERNS = [
  [0, 7, 12, 7],
  [0, 5, 7, 12],
  [0, 3, 7, 10],
  [0, 7, 5, 3],
  [0, 12, 10, 7],
];

export class ProceduralMusic {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private playing: boolean = false;
  private muted: boolean = false;
  private mood: SectorMood = 'neural';
  private params: MusicParams = SECTOR_PARAMS.neural;

  // Audio nodes
  private bassOsc: OscillatorNode | null = null;
  private bassGain: GainNode | null = null;
  private droneOsc: OscillatorNode | null = null;
  private droneOsc2: OscillatorNode | null = null;
  private droneGain: GainNode | null = null;
  private padOsc: OscillatorNode | null = null;
  private padOsc2: OscillatorNode | null = null;
  private padOsc3: OscillatorNode | null = null;
  private padGain: GainNode | null = null;
  private padFilter: BiquadFilterNode | null = null;
  private noiseSource: AudioBufferSourceNode | null = null;
  private noiseGain: GainNode | null = null;
  private noiseFilter: BiquadFilterNode | null = null;

  // Rhythm tracking - extended to 64 beats
  private beatTimer: number = 0;
  private beatInterval: number = 0;
  private currentBeat: number = 0;
  private currentMeasure: number = 0;
  private lastKickTime: number = 0;
  private lastSnareTime: number = 0;
  private lastGlitchTime: number = 0;

  // Musical state for variety
  private currentProgression: number[] = CHORD_PROGRESSIONS[0];
  private currentMelody: number[] = MELODY_PATTERNS[0];
  private phraseCount: number = 0;
  private totalTime: number = 0;
  private inBreakdown: boolean = false;
  private breakdownTimer: number = 0;
  private filterSweepPhase: number = 0;

  // Combat intensity (affects layers)
  private combatIntensity: number = 0;
  private targetIntensity: number = 0;

  // Scale and mode system
  private currentScale: number[] = SCALES.aeolian;
  private rootNote: number = 55; // A1 (55 Hz)
  private _currentStyle: string = 'dark'; // Underscore prefix: value is set but style affects progression selection

  /**
   * Set the current musical scale
   * @param scaleName Name of the scale from SCALES
   */
  setScale(scaleName: string): void {
    if (SCALES[scaleName]) {
      this.currentScale = SCALES[scaleName];
    } else {
      console.warn(`Unknown scale: ${scaleName}, using aeolian`);
      this.currentScale = SCALES.aeolian;
    }
  }

  /**
   * Get available scale names
   */
  getAvailableScales(): string[] {
    return Object.keys(SCALES);
  }

  /**
   * Set the musical style for chord progressions
   */
  setStyle(styleName: string): void {
    if (CHORD_PROGRESSIONS_BY_STYLE[styleName]) {
      this._currentStyle = styleName;
      // Pick a random progression from this style
      const progressions = CHORD_PROGRESSIONS_BY_STYLE[styleName];
      this.currentProgression = progressions[Math.floor(Math.random() * progressions.length)];
    }
  }

  /**
   * Get current style name
   */
  getStyle(): string {
    return this._currentStyle;
  }

  /**
   * Set the root note frequency
   */
  setRootNote(frequency: number): void {
    this.rootNote = frequency;
  }

  /**
   * Get a frequency from the current scale
   */
  private getScaleNote(degree: number, octave: number = 0): number {
    return getScaleFrequency(this.rootNote, this.currentScale, degree, octave);
  }

  /**
   * Get a chord from the current scale
   */
  private getScaleChordFreqs(rootDegree: number, intervals: number[] = [0, 2, 4]): number[] {
    return getScaleChord(this.rootNote, this.currentScale, rootDegree, intervals);
  }

  /**
   * Initialize the audio context
   */
  init(): void {
    const initContext = (): void => {
      if (this.context) return;

      try {
        this.context = new AudioContext();
        this.masterGain = this.context.createGain();
        this.masterGain.connect(this.context.destination);
        this.updateVolume();

        window.removeEventListener('click', initContext);
        window.removeEventListener('keydown', initContext);
        window.removeEventListener('touchstart', initContext);
      } catch (e) {
        console.warn('Failed to create AudioContext:', e);
      }
    };

    window.addEventListener('click', initContext);
    window.addEventListener('keydown', initContext);
    window.addEventListener('touchstart', initContext);
  }

  /**
   * Update volume from settings
   */
  updateVolume(): void {
    if (this.masterGain) {
      const volume = this.muted ? 0 : storage.settings.musicVolume * storage.settings.masterVolume * 0.5;
      this.masterGain.gain.value = volume;
    }
  }

  /**
   * Toggle mute state
   */
  toggleMute(): boolean {
    this.muted = !this.muted;
    this.updateVolume();
    return this.muted;
  }

  /**
   * Set mute state
   */
  setMuted(muted: boolean): void {
    this.muted = muted;
    this.updateVolume();
  }

  /**
   * Check if muted
   */
  isMuted(): boolean {
    return this.muted;
  }

  /**
   * Set the current sector mood
   */
  setMood(sectorIndex: number): void {
    const moods: SectorMood[] = ['neural', 'reef', 'pantheon', 'projects', 'bloom'];
    this.mood = moods[Math.min(sectorIndex, moods.length - 1)] || 'neural';
    this.params = { ...SECTOR_PARAMS[this.mood] };
    this.beatInterval = 60 / this.params.tempo;

    // Pick new progression and melody for this sector
    this.currentProgression = CHORD_PROGRESSIONS[sectorIndex % CHORD_PROGRESSIONS.length];
    this.currentMelody = MELODY_PATTERNS[sectorIndex % MELODY_PATTERNS.length];

    if (this.playing) {
      this.updateOscillators();
    }
  }

  /**
   * Set level within a sector for per-level variation
   */
  setLevel(sectorIndex: number, levelIndex: number): void {
    // First set the base sector mood
    const moods: SectorMood[] = ['neural', 'reef', 'pantheon', 'projects', 'bloom'];
    this.mood = moods[Math.min(sectorIndex, moods.length - 1)] || 'neural';
    const baseParams = SECTOR_PARAMS[this.mood];

    // Create modified params based on level
    this.params = { ...baseParams };

    // Vary tempo slightly per level (+3 BPM per level)
    this.params.tempo = baseParams.tempo + levelIndex * 3;
    this.beatInterval = 60 / this.params.tempo;

    // Shift filter cutoff per level (opens up as levels progress)
    this.params.filterCutoff = baseParams.filterCutoff + levelIndex * 100;

    // Increase intensity per level
    this.params.intensity = Math.min(1, baseParams.intensity + levelIndex * 0.1);

    // Vary detune slightly
    this.params.detuneAmount = baseParams.detuneAmount + levelIndex * 2;

    // Pick progression and melody based on combined sector+level
    const combinedIndex = sectorIndex * 5 + levelIndex;
    this.currentProgression = CHORD_PROGRESSIONS[combinedIndex % CHORD_PROGRESSIONS.length];
    this.currentMelody = MELODY_PATTERNS[combinedIndex % MELODY_PATTERNS.length];

    // Reset phrase tracking for fresh feel
    this.phraseCount = 0;
    this.currentBeat = 0;
    this.currentMeasure = 0;

    if (this.playing) {
      this.updateOscillators();
    }
  }

  /**
   * Set Act-specific mood for Level Bible v2
   */
  setActMood(actId: string, levelIndex: number = 0): void {
    // Map act IDs to moods
    const actMoodMap: Record<string, SectorMood> = {
      act1_escape: 'escape',
      act2_ocean: 'ocean',
      act3_heroic: 'heroic',
      act4_sacred: 'sacred',
      act5_painted: 'painted',
      act6_library: 'library',
      act7_machine: 'machine',
      act8_signals: 'signals',
    };

    const baseMood = actMoodMap[actId] || 'neural';
    this.mood = baseMood;
    const baseParams = SECTOR_PARAMS[baseMood];

    // Create modified params based on level progression
    this.params = { ...baseParams };

    // Vary tempo slightly per level (+2 BPM per level)
    this.params.tempo = baseParams.tempo + levelIndex * 2;
    this.beatInterval = 60 / this.params.tempo;

    // Filter opens up as levels progress
    this.params.filterCutoff = baseParams.filterCutoff + levelIndex * 80;

    // Intensity increases per level
    this.params.intensity = Math.min(1, baseParams.intensity + levelIndex * 0.08);

    // Detune variation per level
    this.params.detuneAmount = baseParams.detuneAmount + levelIndex * 1.5;

    // Pick progression and melody based on act + level
    const actIndex = parseInt(actId.replace(/\D/g, ''), 10) || 1;
    const combinedIndex = actIndex * 5 + levelIndex;
    this.currentProgression = CHORD_PROGRESSIONS[combinedIndex % CHORD_PROGRESSIONS.length];
    this.currentMelody = MELODY_PATTERNS[combinedIndex % MELODY_PATTERNS.length];

    // Reset phrase tracking
    this.phraseCount = 0;
    this.currentBeat = 0;
    this.currentMeasure = 0;

    if (this.playing) {
      this.updateOscillators();
    }
  }

  /**
   * Set music from level musicSeed data
   * Used for expansion levels with custom music configuration
   * Now supports advanced scales including cultural/non-western scales
   */
  setFromMusicSeed(musicSeed: {
    seed: string;
    mode: string;
    tempoRange: [number, number];
    intensity?: number;
    scale?: string; // Optional specific scale name
    style?: string; // Chord progression style
    culturalStyle?: string; // Cultural music style hint
  }): void {
    // Use the seed to create deterministic variations
    const seedNum = musicSeed.seed.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);

    // Calculate tempo from range
    const tempoRange = musicSeed.tempoRange[1] - musicSeed.tempoRange[0];
    const tempo = musicSeed.tempoRange[0] + (seedNum % tempoRange);

    // Set scale based on mode or specific scale name
    const scaleToUse = musicSeed.scale || musicSeed.mode || 'aeolian';
    this.setScale(scaleToUse);

    // Set style for chord progressions
    if (musicSeed.style) {
      this.setStyle(musicSeed.style);
    } else if (musicSeed.culturalStyle) {
      // Map cultural styles to progression styles
      const culturalToStyle: Record<string, string> = {
        ambient: 'mysterious',
        epic: 'heroic',
        dark: 'dark',
        spiritual: 'sacred',
        intense: 'aggressive',
        japanese: 'mysterious',
        indian: 'sacred',
        arabic: 'mysterious',
        gamelan: 'mysterious',
      };
      this.setStyle(culturalToStyle[musicSeed.culturalStyle] || 'dark');
    }

    // Map musical mode to base params and adjustments
    // Extended with more scales and cultural modes
    const modeParams: Record<string, { padNote: number; droneNote: number; filterCutoff: number; rootNote?: number }> =
      {
        // Western modes
        ionian: { padNote: 220, droneNote: 55, filterCutoff: 700 },
        dorian: { padNote: 196, droneNote: 49, filterCutoff: 600 },
        phrygian: { padNote: 185, droneNote: 46, filterCutoff: 500 },
        phrygianDominant: { padNote: 185, droneNote: 46, filterCutoff: 550 },
        lydian: { padNote: 220, droneNote: 55, filterCutoff: 700 },
        mixolydian: { padNote: 207, droneNote: 52, filterCutoff: 650 },
        aeolian: { padNote: 174, droneNote: 44, filterCutoff: 550 },
        locrian: { padNote: 165, droneNote: 41, filterCutoff: 450 },
        harmonicMinor: { padNote: 174, droneNote: 44, filterCutoff: 500 },
        melodicMinor: { padNote: 174, droneNote: 44, filterCutoff: 550 },

        // Symmetric scales
        wholeTone: { padNote: 220, droneNote: 55, filterCutoff: 800 },
        diminished: { padNote: 185, droneNote: 46, filterCutoff: 400 },
        chromatic: { padNote: 220, droneNote: 55, filterCutoff: 800 },

        // Pentatonic
        pentatonicMajor: { padNote: 196, droneNote: 49, filterCutoff: 600 },
        pentatonicMinor: { padNote: 174, droneNote: 44, filterCutoff: 550 },
        blues: { padNote: 174, droneNote: 44, filterCutoff: 500 },

        // Japanese scales
        hirajoshi: { padNote: 174, droneNote: 44, filterCutoff: 450, rootNote: 49 },
        insen: { padNote: 165, droneNote: 41, filterCutoff: 400, rootNote: 49 },
        iwato: { padNote: 165, droneNote: 41, filterCutoff: 380, rootNote: 49 },
        kumoi: { padNote: 174, droneNote: 44, filterCutoff: 450, rootNote: 49 },

        // Indonesian
        pelog: { padNote: 165, droneNote: 41, filterCutoff: 400, rootNote: 44 },
        slendro: { padNote: 174, droneNote: 44, filterCutoff: 450, rootNote: 44 },

        // Indian ragas
        bhairav: { padNote: 165, droneNote: 41, filterCutoff: 450, rootNote: 55 },
        kafi: { padNote: 196, droneNote: 49, filterCutoff: 500, rootNote: 55 },
        purvi: { padNote: 165, droneNote: 41, filterCutoff: 480, rootNote: 55 },
        marwa: { padNote: 165, droneNote: 41, filterCutoff: 500, rootNote: 55 },
        todi: { padNote: 155, droneNote: 39, filterCutoff: 420, rootNote: 55 },

        // Middle Eastern
        hijaz: { padNote: 185, droneNote: 46, filterCutoff: 500, rootNote: 49 },
        nikriz: { padNote: 185, droneNote: 46, filterCutoff: 520, rootNote: 49 },
        doubleHarmonic: { padNote: 185, droneNote: 46, filterCutoff: 480, rootNote: 49 },
      };

    const modeData = modeParams[scaleToUse] || modeParams.aeolian;
    const intensity = musicSeed.intensity ?? 0.5;

    // Set root note if specified in mode
    if (modeData.rootNote) {
      this.rootNote = modeData.rootNote;
    } else {
      this.rootNote = modeData.droneNote;
    }

    // Create custom params
    this.params = {
      tempo,
      bassFreq: modeData.droneNote * 0.8,
      padNote: modeData.padNote,
      droneNote: modeData.droneNote,
      intensity,
      filterCutoff: modeData.filterCutoff,
      detuneAmount: 5 + (seedNum % 8),
      noiseType: intensity > 0.6 ? 'highpass' : 'lowpass',
      useReverb: intensity < 0.7,
      distortionAmount: intensity * 0.4,
    };

    this.beatInterval = 60 / tempo;
    this.targetIntensity = intensity;

    // Use seed to pick progression and melody
    this.currentProgression = CHORD_PROGRESSIONS[seedNum % CHORD_PROGRESSIONS.length];
    this.currentMelody = MELODY_PATTERNS[seedNum % MELODY_PATTERNS.length];

    // Reset phrase tracking
    this.phraseCount = 0;
    this.currentBeat = 0;
    this.currentMeasure = 0;

    if (this.playing) {
      this.updateOscillators();
    }
  }

  /**
   * Set boss battle mood
   */
  setBossMood(): void {
    this.mood = 'boss';
    this.params = SECTOR_PARAMS.boss;
    this.beatInterval = 60 / this.params.tempo;
    this.targetIntensity = 1.0;
    this.inBreakdown = false;

    if (this.playing) {
      this.updateOscillators();
    }
  }

  /**
   * Set menu mood - slower, atmospheric ambient
   */
  setMenuMood(): void {
    this.mood = 'menu';
    this.params = SECTOR_PARAMS.menu;
    this.beatInterval = 60 / this.params.tempo;
    this.targetIntensity = 0.2;
    this.inBreakdown = false;

    if (this.playing) {
      this.updateOscillators();
    }
  }

  /**
   * Set intro/story mood - very slow, minimal, atmospheric
   */
  setIntroMood(): void {
    this.mood = 'intro';
    this.params = SECTOR_PARAMS.intro;
    this.beatInterval = 60 / this.params.tempo;
    this.targetIntensity = 0.1;
    this.inBreakdown = false;

    if (this.playing) {
      this.updateOscillators();
    }
  }

  /**
   * Set combat intensity (0-1)
   */
  setCombatIntensity(intensity: number): void {
    this.targetIntensity = Math.max(0, Math.min(1, intensity));
  }

  /**
   * Start playing music
   */
  start(): void {
    if (this.playing || !this.context || !this.masterGain) {
      if (this.context?.state === 'suspended') {
        this.context.resume();
      }
      if (this.playing) return;
    }

    if (!this.context) {
      this.context = new AudioContext();
      this.masterGain = this.context.createGain();
      this.masterGain.connect(this.context.destination);
      this.updateVolume();
    }

    this.playing = true;
    this.beatTimer = 0;
    this.currentBeat = 0;
    this.currentMeasure = 0;
    this.phraseCount = 0;
    this.totalTime = 0;
    this.beatInterval = 60 / this.params.tempo;
    this.inBreakdown = false;

    this.createDroneLayer();
    this.createPadLayer();
    this.createNoiseLayer();
  }

  /**
   * Stop playing music
   */
  stop(): void {
    if (!this.playing) return;

    this.playing = false;

    const fadeTime = 0.5;
    const now = this.context?.currentTime || 0;

    if (this.bassGain && this.context) {
      this.bassGain.gain.linearRampToValueAtTime(0, now + fadeTime);
      this.bassOsc?.stop(now + fadeTime);
    }

    if (this.droneGain && this.context) {
      this.droneGain.gain.linearRampToValueAtTime(0, now + fadeTime);
      this.droneOsc?.stop(now + fadeTime);
      this.droneOsc2?.stop(now + fadeTime);
    }

    if (this.padGain && this.context) {
      this.padGain.gain.linearRampToValueAtTime(0, now + fadeTime);
      this.padOsc?.stop(now + fadeTime);
      this.padOsc2?.stop(now + fadeTime);
      this.padOsc3?.stop(now + fadeTime);
    }

    if (this.noiseGain && this.context) {
      this.noiseGain.gain.linearRampToValueAtTime(0, now + fadeTime);
      this.noiseSource?.stop(now + fadeTime);
    }

    setTimeout(
      () => {
        this.bassOsc = null;
        this.bassGain = null;
        this.droneOsc = null;
        this.droneOsc2 = null;
        this.droneGain = null;
        this.padOsc = null;
        this.padOsc2 = null;
        this.padOsc3 = null;
        this.padGain = null;
        this.padFilter = null;
        this.noiseSource = null;
        this.noiseGain = null;
        this.noiseFilter = null;
      },
      fadeTime * 1000 + 100,
    );
  }

  /**
   * Update music (call every frame)
   */
  update(dt: number): void {
    if (!this.playing || !this.context) return;

    this.totalTime += dt;

    // Smooth combat intensity
    this.combatIntensity += (this.targetIntensity - this.combatIntensity) * dt * 2;

    // Update beat timer
    this.beatTimer += dt;

    if (this.beatTimer >= this.beatInterval) {
      this.beatTimer -= this.beatInterval;
      this.currentBeat++;

      // Track measures (now 64-beat phrases)
      if (this.currentBeat % 16 === 0) {
        this.currentMeasure++;
      }
      if (this.currentBeat % 64 === 0) {
        this.onPhraseEnd();
      }

      this.onBeat();
    }

    // Breakdown handling
    if (this.inBreakdown) {
      this.breakdownTimer += dt;
      if (this.breakdownTimer > 8) {
        // 8 second breakdowns
        this.inBreakdown = false;
        this.breakdownTimer = 0;
      }
    }

    // Filter sweep automation
    this.filterSweepPhase += dt * 0.1;
    this.updateFilterSweep();

    // Update layer volumes based on intensity
    this.updateLayerVolumes();
  }

  /**
   * Called at the end of each 64-beat phrase
   */
  private onPhraseEnd(): void {
    this.phraseCount++;

    // Every 4 phrases (~2 minutes), trigger a breakdown
    if (this.phraseCount % 4 === 0 && !this.inBreakdown && this.mood !== 'boss') {
      this.inBreakdown = true;
      this.breakdownTimer = 0;
    }

    // Occasionally change progression
    if (Math.random() < 0.3) {
      this.currentProgression = CHORD_PROGRESSIONS[Math.floor(Math.random() * CHORD_PROGRESSIONS.length)];
    }

    // Occasionally change melody
    if (Math.random() < 0.4) {
      this.currentMelody = MELODY_PATTERNS[Math.floor(Math.random() * MELODY_PATTERNS.length)];
    }
  }

  /**
   * Called on each beat
   */
  private onBeat(): void {
    const beat = this.currentBeat % 64;
    const measure = Math.floor(beat / 16);
    const beatInMeasure = beat % 16;
    const now = this.context?.currentTime || 0;

    // During breakdown, minimal elements
    if (this.inBreakdown) {
      // Only sparse kicks
      if (beatInMeasure === 0 && measure % 2 === 0) {
        this.playKick(now, 0.3);
      }
      // Occasional glitch
      if (Math.random() < 0.05) {
        this.playGlitch(now);
      }
      return;
    }

    // Standard kick pattern with variations
    const kickPattern = this.getKickPattern(measure);
    if (kickPattern[beatInMeasure]) {
      this.playKick(now, 0.4 + this.combatIntensity * 0.3);
    }

    // Stochastic hi-hat
    if (this.combatIntensity > 0.2) {
      const hihatProb = 0.3 + this.combatIntensity * 0.4;
      if (beatInMeasure % 2 === 1 && Math.random() < hihatProb) {
        const volume = (0.05 + Math.random() * 0.1) * this.combatIntensity;
        this.playHiHat(now, volume);
      }
    }

    // Snare with variations
    if (this.combatIntensity > 0.4) {
      const snareBeats = [4, 12];
      if (snareBeats.includes(beatInMeasure)) {
        this.playSnare(now, 0.12 + this.combatIntensity * 0.1);
      }
      // Ghost snares at high intensity
      if (this.combatIntensity > 0.7 && beatInMeasure === 10 && measure % 2 === 1) {
        this.playSnare(now, 0.06);
      }
    }

    // Bass note changes on downbeats with progression
    if (beatInMeasure === 0 && this.bassOsc) {
      const chordIndex = measure % this.currentProgression.length;
      const freq = this.params.bassFreq * this.currentProgression[chordIndex];
      this.bassOsc.frequency.setValueAtTime(freq, now);
    }

    // Melodic synth stabs at medium+ intensity
    if (this.combatIntensity > 0.5 && beatInMeasure % 4 === 0) {
      const melodyIndex = (measure + Math.floor(beatInMeasure / 4)) % this.currentMelody.length;
      if (Math.random() < 0.4) {
        this.playSynthStab(now, melodyIndex);
      }
    }

    // Occasional arpeggios at high intensity (using scale system)
    if (this.combatIntensity > 0.7 && beatInMeasure === 8 && Math.random() < 0.25) {
      const rootDegree = measure % this.currentScale.length;
      this.playArpeggio(now, rootDegree, 1);
    }

    // Occasional scale-based chord stabs
    if (this.combatIntensity > 0.6 && beatInMeasure === 0 && measure % 2 === 1 && Math.random() < 0.3) {
      const chordRoot = measure % this.currentScale.length;
      const chordFreqs = this.getScaleChordFreqs(chordRoot, [0, 2, 4]);
      this.playChordStab(now, chordFreqs);
    }

    // Occasional glitch effects
    if (now - this.lastGlitchTime > 2 && Math.random() < 0.02 * this.combatIntensity) {
      this.playGlitch(now);
      this.lastGlitchTime = now;
    }
  }

  /**
   * Play a chord stab using specific frequencies
   */
  private playChordStab(time: number, frequencies: number[]): void {
    if (!this.context || !this.masterGain) return;

    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(this.params.filterCutoff * 1.5, time);
    filter.frequency.exponentialRampToValueAtTime(300, time + 0.3);
    filter.Q.value = 2;

    gain.gain.setValueAtTime(0.05 * this.combatIntensity, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.25);

    filter.connect(gain);
    gain.connect(this.masterGain);

    frequencies.forEach((freq) => {
      const osc = this.context!.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      osc.connect(filter);
      osc.start(time);
      osc.stop(time + 0.3);
    });
  }

  /**
   * Get kick pattern for variety
   */
  private getKickPattern(measure: number): boolean[] {
    const patterns = [
      [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false], // 4/4
      [true, false, false, false, true, false, false, true, false, false, true, false, true, false, false, false], // syncopated
      [true, false, false, false, true, false, false, false, true, false, true, false, true, false, false, false], // variation
      [true, false, true, false, false, false, true, false, true, false, false, false, true, false, true, false], // double
    ];
    return patterns[measure % patterns.length];
  }

  /**
   * Play synth stab using the current scale
   */
  private playSynthStab(time: number, melodyIndex: number): void {
    if (!this.context || !this.masterGain) return;

    // Use scale-based melody generation
    const melodyPattern = this.currentMelody;
    const semitones = melodyPattern[melodyIndex % melodyPattern.length];

    // Get frequency from current scale
    const scaleDegree = Math.abs(semitones % this.currentScale.length);
    const octaveOffset = Math.floor(semitones / 12);
    const freq = this.getScaleNote(scaleDegree, octaveOffset + 1);

    const osc = this.context.createOscillator();
    const osc2 = this.context.createOscillator();
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    osc2.type = 'square';
    osc2.frequency.value = freq * 1.01;

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(this.params.filterCutoff * 2, time);
    filter.frequency.exponentialRampToValueAtTime(200, time + 0.2);
    filter.Q.value = 3;

    gain.gain.setValueAtTime(0.08 * this.combatIntensity, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.15);

    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(time);
    osc2.start(time);
    osc.stop(time + 0.2);
    osc2.stop(time + 0.2);
  }

  /**
   * Play an arpeggio using the current scale
   */
  private playArpeggio(time: number, rootDegree: number, octave: number = 0): void {
    if (!this.context || !this.masterGain) return;

    const arpeggioPattern = [0, 2, 4, 7]; // Scale degrees for arpeggio
    const noteDuration = 0.1;
    const noteGap = 0.08;

    arpeggioPattern.forEach((degree, i) => {
      const noteTime = time + i * noteGap;
      const freq = this.getScaleNote(rootDegree + degree, octave);

      const osc = this.context!.createOscillator();
      const gain = this.context!.createGain();

      osc.type = 'sine';
      osc.frequency.value = freq;

      gain.gain.setValueAtTime(0.06 * this.combatIntensity, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.01, noteTime + noteDuration);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(noteTime);
      osc.stop(noteTime + noteDuration);
    });
  }

  /**
   * Play glitch effect
   */
  private playGlitch(time: number): void {
    if (!this.context || !this.masterGain) return;

    // Random buffer of short noise
    const bufferSize = Math.floor(this.context.sampleRate * (0.02 + Math.random() * 0.05));
    const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      // Bitcrushed noise
      const sample = Math.random() * 2 - 1;
      data[i] = Math.round(sample * 4) / 4;
    }

    const source = this.context.createBufferSource();
    source.buffer = buffer;

    const gain = this.context.createGain();
    gain.gain.setValueAtTime(0.15 * this.combatIntensity, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);

    source.connect(gain);
    gain.connect(this.masterGain);

    source.start(time);
    source.stop(time + 0.1);
  }

  /**
   * Update filter sweep for movement
   */
  private updateFilterSweep(): void {
    if (!this.padFilter || !this.noiseFilter || !this.context) return;

    const now = this.context.currentTime;
    const sweepValue = Math.sin(this.filterSweepPhase) * 0.5 + 0.5;
    const baseFreq = this.params.filterCutoff;

    // Pad filter modulation
    const padFreq = baseFreq * (0.5 + sweepValue * 1.5);
    this.padFilter.frequency.linearRampToValueAtTime(padFreq, now + 0.1);

    // Noise filter modulation (inverse)
    const noiseFreq = baseFreq * (1.5 - sweepValue * 0.5);
    this.noiseFilter.frequency.linearRampToValueAtTime(noiseFreq, now + 0.1);
  }

  /**
   * Play kick drum
   */
  private playKick(time: number, volume: number = 0.5): void {
    if (!this.context || !this.masterGain) return;
    if (time - this.lastKickTime < 0.1) return;
    this.lastKickTime = time;

    const osc = this.context.createOscillator();
    const gain = this.context.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(150 + this.params.distortionAmount * 50, time);
    osc.frequency.exponentialRampToValueAtTime(30, time + 0.1);

    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);

    // Add subtle distortion for projects/boss
    if (this.params.distortionAmount > 0.3) {
      const distortion = this.context.createWaveShaper();
      const curve = new Float32Array(256);
      for (let i = 0; i < 256; i++) {
        const x = i / 128 - 1;
        curve[i] = Math.tanh(x * (1 + this.params.distortionAmount * 3));
      }
      distortion.curve = curve;
      osc.connect(distortion);
      distortion.connect(gain);
    } else {
      osc.connect(gain);
    }

    gain.connect(this.masterGain);

    osc.start(time);
    osc.stop(time + 0.2);
  }

  /**
   * Play hi-hat
   */
  private playHiHat(time: number, volume: number): void {
    if (!this.context || !this.masterGain) return;

    const bufferSize = Math.floor(this.context.sampleRate * 0.05);
    const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();

    source.buffer = buffer;
    filter.type = 'highpass';
    filter.frequency.value = 7000 + this.params.filterCutoff;

    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.04);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    source.start(time);
    source.stop(time + 0.05);
  }

  /**
   * Play snare
   */
  private playSnare(time: number, volume: number): void {
    if (!this.context || !this.masterGain) return;
    if (time - this.lastSnareTime < 0.1) return;
    this.lastSnareTime = time;

    // Noise component
    const bufferSize = Math.floor(this.context.sampleRate * 0.15);
    const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();

    source.buffer = buffer;
    filter.type = 'bandpass';
    filter.frequency.value = 2500 + this.params.filterCutoff;
    filter.Q.value = 1.5;

    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.12);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    source.start(time);
    source.stop(time + 0.15);

    // Body tone
    const bodyOsc = this.context.createOscillator();
    const bodyGain = this.context.createGain();

    bodyOsc.type = 'triangle';
    bodyOsc.frequency.setValueAtTime(180, time);
    bodyOsc.frequency.exponentialRampToValueAtTime(90, time + 0.04);

    bodyGain.gain.setValueAtTime(volume * 0.4, time);
    bodyGain.gain.exponentialRampToValueAtTime(0.01, time + 0.08);

    bodyOsc.connect(bodyGain);
    bodyGain.connect(this.masterGain);

    bodyOsc.start(time);
    bodyOsc.stop(time + 0.1);
  }

  /**
   * Create the drone layer
   */
  private createDroneLayer(): void {
    if (!this.context || !this.masterGain) return;

    // Primary drone
    this.droneOsc = this.context.createOscillator();
    this.droneOsc2 = this.context.createOscillator();
    this.droneGain = this.context.createGain();

    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 80;
    filter.Q.value = 5;

    this.droneOsc.type = 'sawtooth';
    this.droneOsc.frequency.value = this.params.droneNote;

    // Detuned second drone for thickness
    this.droneOsc2.type = 'sawtooth';
    this.droneOsc2.frequency.value = this.params.droneNote * 1.002;

    this.droneOsc.connect(filter);
    this.droneOsc2.connect(filter);
    filter.connect(this.droneGain);
    this.droneGain.connect(this.masterGain);

    this.droneGain.gain.value = 0.12;

    this.droneOsc.start();
    this.droneOsc2.start();

    // Bass oscillator
    this.bassOsc = this.context.createOscillator();
    this.bassGain = this.context.createGain();

    const bassFilter = this.context.createBiquadFilter();
    bassFilter.type = 'lowpass';
    bassFilter.frequency.value = 120;

    this.bassOsc.type = 'square';
    this.bassOsc.frequency.value = this.params.bassFreq;

    this.bassOsc.connect(bassFilter);
    bassFilter.connect(this.bassGain);
    this.bassGain.connect(this.masterGain);

    this.bassGain.gain.value = 0;

    this.bassOsc.start();
  }

  /**
   * Create the pad layer
   */
  private createPadLayer(): void {
    if (!this.context || !this.masterGain) return;

    this.padOsc = this.context.createOscillator();
    this.padOsc2 = this.context.createOscillator();
    this.padOsc3 = this.context.createOscillator();
    this.padGain = this.context.createGain();
    this.padFilter = this.context.createBiquadFilter();

    // Three detuned oscillators for rich pad
    this.padOsc.type = 'sine';
    this.padOsc.frequency.value = this.params.padNote;

    this.padOsc2.type = 'triangle';
    this.padOsc2.frequency.value = this.params.padNote * (1 + this.params.detuneAmount / 1000);

    this.padOsc3.type = 'sine';
    this.padOsc3.frequency.value = this.params.padNote * (1 - this.params.detuneAmount / 1000);

    this.padFilter.type = 'lowpass';
    this.padFilter.frequency.value = this.params.filterCutoff;
    this.padFilter.Q.value = 2;

    this.padOsc.connect(this.padFilter);
    this.padOsc2.connect(this.padFilter);
    this.padOsc3.connect(this.padFilter);
    this.padFilter.connect(this.padGain);
    this.padGain.connect(this.masterGain);

    this.padGain.gain.value = 0.06;

    this.padOsc.start();
    this.padOsc2.start();
    this.padOsc3.start();
  }

  /**
   * Create the noise layer
   */
  private createNoiseLayer(): void {
    if (!this.context || !this.masterGain) return;

    const bufferSize = this.context.sampleRate * 2;
    const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    this.noiseSource = this.context.createBufferSource();
    this.noiseSource.buffer = buffer;
    this.noiseSource.loop = true;

    this.noiseFilter = this.context.createBiquadFilter();
    this.noiseFilter.type = this.params.noiseType;
    this.noiseFilter.frequency.value = this.params.filterCutoff;

    this.noiseGain = this.context.createGain();
    this.noiseGain.gain.value = 0.015;

    this.noiseSource.connect(this.noiseFilter);
    this.noiseFilter.connect(this.noiseGain);
    this.noiseGain.connect(this.masterGain);

    this.noiseSource.start();
  }

  /**
   * Update oscillator frequencies for current mood
   */
  private updateOscillators(): void {
    const now = this.context?.currentTime || 0;
    const transitionTime = 2;

    if (this.droneOsc && this.droneOsc2) {
      this.droneOsc.frequency.linearRampToValueAtTime(this.params.droneNote, now + transitionTime);
      this.droneOsc2.frequency.linearRampToValueAtTime(this.params.droneNote * 1.002, now + transitionTime);
    }

    if (this.bassOsc) {
      this.bassOsc.frequency.linearRampToValueAtTime(this.params.bassFreq, now + transitionTime);
    }

    if (this.padOsc && this.padOsc2 && this.padOsc3) {
      this.padOsc.frequency.linearRampToValueAtTime(this.params.padNote, now + transitionTime);
      this.padOsc2.frequency.linearRampToValueAtTime(
        this.params.padNote * (1 + this.params.detuneAmount / 1000),
        now + transitionTime,
      );
      this.padOsc3.frequency.linearRampToValueAtTime(
        this.params.padNote * (1 - this.params.detuneAmount / 1000),
        now + transitionTime,
      );
    }

    if (this.padFilter) {
      this.padFilter.frequency.linearRampToValueAtTime(this.params.filterCutoff, now + transitionTime);
    }

    if (this.noiseFilter) {
      this.noiseFilter.type = this.params.noiseType;
      this.noiseFilter.frequency.linearRampToValueAtTime(this.params.filterCutoff, now + transitionTime);
    }

    this.beatInterval = 60 / this.params.tempo;
  }

  /**
   * Update layer volumes based on combat intensity
   */
  private updateLayerVolumes(): void {
    if (!this.context) return;
    const now = this.context.currentTime;

    // During breakdown, reduce everything
    const breakdownMod = this.inBreakdown ? 0.3 : 1;

    // Bass comes in with intensity
    if (this.bassGain) {
      const bassVolume = this.combatIntensity * 0.18 * breakdownMod;
      this.bassGain.gain.linearRampToValueAtTime(bassVolume, now + 0.1);
    }

    // Pad gets louder
    if (this.padGain) {
      const padVolume = (0.04 + this.combatIntensity * 0.08) * breakdownMod;
      this.padGain.gain.linearRampToValueAtTime(padVolume, now + 0.1);
    }

    // Noise increases with intensity
    if (this.noiseGain) {
      const noiseVolume = (0.01 + this.combatIntensity * 0.03) * breakdownMod;
      this.noiseGain.gain.linearRampToValueAtTime(noiseVolume, now + 0.1);
    }

    // Drone stays relatively constant
    if (this.droneGain) {
      const droneVolume = (0.1 + this.combatIntensity * 0.05) * breakdownMod;
      this.droneGain.gain.linearRampToValueAtTime(droneVolume, now + 0.1);
    }
  }

  /**
   * Check if music is currently playing
   */
  isPlaying(): boolean {
    return this.playing;
  }
}

// Global music instance
export const proceduralMusic = new ProceduralMusic();
