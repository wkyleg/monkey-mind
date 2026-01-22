/**
 * Procedural industrial music generator
 * Creates dark, atmospheric beats inspired by Nine Inch Nails / Crystal Castles
 * Enhanced with longer phrases, randomization, and evolving elements
 */

import { storage } from '../core/storage';

type SectorMood = 'neural' | 'reef' | 'pantheon' | 'projects' | 'bloom' | 'boss' | 'menu' | 'intro';

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
};

// Extended chord progressions for variety
const CHORD_PROGRESSIONS = [
  [1, 1.5, 1.25, 1.33],           // i - v - iv - bVII
  [1, 1.33, 1.5, 1.25],           // i - bVII - v - iv
  [1, 1.25, 1.33, 1.5],           // i - iv - bVII - v
  [1, 1.125, 1.25, 1.33],         // i - bII - iv - bVII
  [1, 1.5, 1.33, 1.25],           // i - v - bVII - iv
  [1, 1.33, 1.25, 1.125],         // i - bVII - iv - bII
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
  private inBreakdown: boolean = false;
  private breakdownTimer: number = 0;
  private filterSweepPhase: number = 0;
  
  // Combat intensity (affects layers)
  private combatIntensity: number = 0;
  private targetIntensity: number = 0;
  
  // Time tracking for evolution
  private totalTime: number = 0;
  
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
    this.params.tempo = baseParams.tempo + (levelIndex * 3);
    this.beatInterval = 60 / this.params.tempo;
    
    // Shift filter cutoff per level (opens up as levels progress)
    this.params.filterCutoff = baseParams.filterCutoff + (levelIndex * 100);
    
    // Increase intensity per level
    this.params.intensity = Math.min(1, baseParams.intensity + (levelIndex * 0.1));
    
    // Vary detune slightly
    this.params.detuneAmount = baseParams.detuneAmount + (levelIndex * 2);
    
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
    
    setTimeout(() => {
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
    }, fadeTime * 1000 + 100);
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
      if (this.breakdownTimer > 8) { // 8 second breakdowns
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
    
    // Occasional glitch effects
    if (now - this.lastGlitchTime > 2 && Math.random() < 0.02 * this.combatIntensity) {
      this.playGlitch(now);
      this.lastGlitchTime = now;
    }
  }
  
  /**
   * Get kick pattern for variety
   */
  private getKickPattern(measure: number): boolean[] {
    const patterns = [
      [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false],  // 4/4
      [true, false, false, false, true, false, false, true, false, false, true, false, true, false, false, false],   // syncopated
      [true, false, false, false, true, false, false, false, true, false, true, false, true, false, false, false],   // variation
      [true, false, true, false, false, false, true, false, true, false, false, false, true, false, true, false],    // double
    ];
    return patterns[measure % patterns.length];
  }
  
  /**
   * Play synth stab
   */
  private playSynthStab(time: number, melodyIndex: number): void {
    if (!this.context || !this.masterGain) return;
    
    const semitones = this.currentMelody[melodyIndex % this.currentMelody.length];
    const freq = this.params.padNote * Math.pow(2, semitones / 12);
    
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
        const x = (i / 128) - 1;
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
      this.padOsc2.frequency.linearRampToValueAtTime(this.params.padNote * (1 + this.params.detuneAmount / 1000), now + transitionTime);
      this.padOsc3.frequency.linearRampToValueAtTime(this.params.padNote * (1 - this.params.detuneAmount / 1000), now + transitionTime);
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
