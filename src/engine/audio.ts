/**
 * WebAudio manager with calm/passion layer mixing
 */

import { storage } from '../core/storage';

export interface AudioTrack {
  id: string;
  audio: HTMLAudioElement;
  volume: number;
  loop: boolean;
}

export class AudioManager {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  private musicTracks: Map<string, AudioTrack> = new Map();
  private currentMusic: string | null = null;

  // Calm/Passion layer mixing
  private calmLayer: AudioTrack | null = null;
  private passionLayer: AudioTrack | null = null;
  private tension: number = 0; // 0 = calm, 1 = passion

  init(): void {
    // Create audio context on first user interaction
    const initContext = (): void => {
      if (this.context) return;

      this.context = new AudioContext();
      this.masterGain = this.context.createGain();
      this.musicGain = this.context.createGain();
      this.sfxGain = this.context.createGain();

      this.masterGain.connect(this.context.destination);
      this.musicGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);

      // Apply saved settings
      this.updateVolumes();

      // Remove listeners after init
      window.removeEventListener('click', initContext);
      window.removeEventListener('keydown', initContext);
      window.removeEventListener('touchstart', initContext);
    };

    window.addEventListener('click', initContext);
    window.addEventListener('keydown', initContext);
    window.addEventListener('touchstart', initContext);
  }

  /**
   * Update volume levels from settings
   */
  updateVolumes(): void {
    const settings = storage.settings;
    if (this.masterGain) {
      this.masterGain.gain.value = settings.masterVolume;
    }
    if (this.musicGain) {
      this.musicGain.gain.value = settings.musicVolume;
    }
    if (this.sfxGain) {
      this.sfxGain.gain.value = settings.sfxVolume;
    }
  }

  /**
   * Update loop for calm/passion mixing
   */
  update(_dt: number): void {
    // Update layer volumes based on tension
    if (this.calmLayer) {
      this.calmLayer.audio.volume = (1 - this.tension) * storage.settings.musicVolume;
    }
    if (this.passionLayer) {
      this.passionLayer.audio.volume = this.tension * storage.settings.musicVolume;
    }
  }

  /**
   * Set tension level (0 = calm, 1 = passion)
   */
  setTension(value: number): void {
    this.tension = Math.max(0, Math.min(1, value));
  }

  /**
   * Get current tension level
   */
  getTension(): number {
    return this.tension;
  }

  /**
   * Load a music track
   */
  loadMusic(id: string, url: string, loop: boolean = true): void {
    const audio = new Audio(url);
    audio.loop = loop;
    audio.preload = 'auto';

    this.musicTracks.set(id, {
      id,
      audio,
      volume: 1,
      loop,
    });
  }

  /**
   * Play a music track
   */
  playMusic(id: string, crossfade: boolean = true): void {
    const track = this.musicTracks.get(id);
    if (!track) {
      console.warn(`Music track not found: ${id}`);
      return;
    }

    if (crossfade && this.currentMusic) {
      // Fade out current
      const current = this.musicTracks.get(this.currentMusic);
      if (current) {
        this.fadeOut(current.audio, 500);
      }
    } else if (this.currentMusic) {
      // Stop current immediately
      const current = this.musicTracks.get(this.currentMusic);
      if (current) {
        current.audio.pause();
        current.audio.currentTime = 0;
      }
    }

    // Start new track
    track.audio.volume = storage.settings.musicVolume * storage.settings.masterVolume;
    track.audio.play().catch(console.error);
    this.currentMusic = id;
  }

  /**
   * Stop current music
   */
  stopMusic(fadeMs: number = 500): void {
    if (this.currentMusic) {
      const track = this.musicTracks.get(this.currentMusic);
      if (track) {
        this.fadeOut(track.audio, fadeMs);
      }
      this.currentMusic = null;
    }
  }

  /**
   * Play both calm and passion layers
   */
  playLayers(calmUrl: string, passionUrl: string): void {
    // Load calm layer
    const calmAudio = new Audio(calmUrl);
    calmAudio.loop = true;
    this.calmLayer = { id: 'calm', audio: calmAudio, volume: 1, loop: true };

    // Load passion layer
    const passionAudio = new Audio(passionUrl);
    passionAudio.loop = true;
    this.passionLayer = { id: 'passion', audio: passionAudio, volume: 0, loop: true };

    // Start both
    calmAudio.play().catch(console.error);
    passionAudio.play().catch(console.error);
  }

  /**
   * Stop both layers
   */
  stopLayers(): void {
    if (this.calmLayer) {
      this.calmLayer.audio.pause();
      this.calmLayer = null;
    }
    if (this.passionLayer) {
      this.passionLayer.audio.pause();
      this.passionLayer = null;
    }
  }

  /**
   * Play a sound effect
   */
  playSfx(id: string, volume: number = 1): void {
    // For now, just play from URL
    // In production, would use pre-loaded sounds
    const base = import.meta.env.BASE_URL ?? '/';
    const audio = new Audio(`${base}audio/sfx_${id}.ogg`);
    audio.volume = volume * storage.settings.sfxVolume * storage.settings.masterVolume;
    audio.play().catch(() => {
      // Silent fail - audio might not be loaded yet
    });
  }

  /**
   * Play a tone (for procedural SFX)
   */
  playTone(frequency: number, duration: number, type: OscillatorType = 'sine', volume: number = 0.3): void {
    if (!this.context || !this.sfxGain) return;

    const oscillator = this.context.createOscillator();
    const gainNode = this.context.createGain();

    oscillator.type = type;
    oscillator.frequency.value = frequency;

    gainNode.gain.setValueAtTime(volume, this.context.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(this.sfxGain);

    oscillator.start();
    oscillator.stop(this.context.currentTime + duration);
  }

  /**
   * Play industrial noise burst - muted version
   */
  private playNoiseBurst(duration: number, filterFreq: number, volume: number): void {
    if (!this.context || !this.sfxGain) return;

    const bufferSize = Math.floor(this.context.sampleRate * duration);
    const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = this.context.createBufferSource();
    source.buffer = buffer;

    // Bandpass filter for character
    const filter = this.context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = Math.min(filterFreq, 2000); // Cap frequency for muted sound
    filter.Q.value = 1.5;

    // Additional low-pass to mute high frequencies
    const lowpass = this.context.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 1800;

    const gain = this.context.createGain();
    const now = this.context.currentTime;
    gain.gain.setValueAtTime(volume * 0.6, now); // Reduced volume
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    source.connect(filter);
    filter.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(this.sfxGain);

    source.start(now);
    source.stop(now + duration);
  }

  /**
   * Play a "banana throw" sound - muted industrial thud
   */
  playBananaThrow(): void {
    if (!this.context || !this.sfxGain) return;

    const now = this.context.currentTime;

    // Muted low frequency thump
    const thump = this.context.createOscillator();
    const thumpGain = this.context.createGain();
    const thumpFilter = this.context.createBiquadFilter();

    thump.type = 'sine';
    thump.frequency.setValueAtTime(60, now);
    thump.frequency.exponentialRampToValueAtTime(25, now + 0.04);

    thumpFilter.type = 'lowpass';
    thumpFilter.frequency.value = 200;

    thumpGain.gain.setValueAtTime(0.1, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.01, now + 0.04);

    thump.connect(thumpFilter);
    thumpFilter.connect(thumpGain);
    thumpGain.connect(this.sfxGain);
    thump.start(now);
    thump.stop(now + 0.04);

    // Very short muted click
    this.playNoiseBurst(0.015, 1200, 0.06);
  }

  /**
   * Play a "hit" sound - muted metallic impact
   */
  playHit(): void {
    if (!this.context || !this.sfxGain) return;

    const now = this.context.currentTime;

    // Muted metallic tone
    const osc1 = this.context.createOscillator();
    const gainNode = this.context.createGain();

    // Low-pass filter for muted sound
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1200;
    filter.Q.value = 0.7;

    // Mild distortion
    const distortion = this.context.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = i / 128 - 1;
      curve[i] = Math.tanh(x * 2);
    }
    distortion.curve = curve;

    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(800, now);
    osc1.frequency.exponentialRampToValueAtTime(150, now + 0.06);

    gainNode.gain.setValueAtTime(0.12, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

    osc1.connect(distortion);
    distortion.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.sfxGain);

    osc1.start(now);
    osc1.stop(now + 0.08);

    // Muted noise layer
    this.playNoiseBurst(0.05, 1500, 0.08);
  }

  /**
   * Play a "powerup" sound - muted industrial hum
   */
  playPowerup(): void {
    if (!this.context || !this.sfxGain) return;

    const now = this.context.currentTime;

    // Muted rising hum
    const osc = this.context.createOscillator();
    const gainNode = this.context.createGain();

    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(150, now);
    filter.frequency.exponentialRampToValueAtTime(800, now + 0.25);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.exponentialRampToValueAtTime(250, now + 0.25);

    gainNode.gain.setValueAtTime(0.1, now);
    gainNode.gain.setValueAtTime(0.12, now + 0.12);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.3);

    // Subtle crackle
    for (let i = 0; i < 2; i++) {
      setTimeout(() => this.playNoiseBurst(0.02, 1500, 0.04), i * 80);
    }
  }

  /**
   * Play a "death" sound - muted descending tone
   */
  playDeath(): void {
    if (!this.context || !this.sfxGain) return;

    const now = this.context.currentTime;

    // Muted descending tone
    const osc = this.context.createOscillator();
    const gainNode = this.context.createGain();

    // Low-pass filter
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600;

    // Mild distortion
    const distortion = this.context.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = i / 128 - 1;
      curve[i] = Math.tanh(x * 2);
    }
    distortion.curve = curve;

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.5);

    gainNode.gain.setValueAtTime(0.15, now);
    gainNode.gain.linearRampToValueAtTime(0.18, now + 0.08);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.55);

    osc.connect(distortion);
    distortion.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.55);

    // Muted static layers
    for (let i = 0; i < 3; i++) {
      setTimeout(() => this.playNoiseBurst(0.08, 1000 - i * 150, 0.06), i * 100);
    }
  }

  /**
   * Play enemy death sound - muted mechanical click
   */
  playEnemyDeath(): void {
    if (!this.context || !this.sfxGain) return;

    const now = this.context.currentTime;

    // Quick muted click
    const osc = this.context.createOscillator();
    const gainNode = this.context.createGain();

    // Low-pass filter
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.05);

    gainNode.gain.setValueAtTime(0.08, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.06);

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.06);

    // Subtle noise
    this.playNoiseBurst(0.03, 1200, 0.05);
  }

  private fadeOut(audio: HTMLAudioElement, durationMs: number): void {
    const startVolume = audio.volume;
    const steps = 20;
    const stepDuration = durationMs / steps;
    const volumeStep = startVolume / steps;

    let step = 0;
    const interval = setInterval(() => {
      step++;
      audio.volume = Math.max(0, startVolume - volumeStep * step);

      if (step >= steps) {
        clearInterval(interval);
        audio.pause();
        audio.currentTime = 0;
        audio.volume = startVolume;
      }
    }, stepDuration);
  }
}
