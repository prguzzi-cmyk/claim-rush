import { Component, OnInit, OnDestroy, Output, EventEmitter, Input } from '@angular/core';

const PANEL_DURATION_MS = 2500;
const TOTAL_PANELS = 4;

/** localStorage key for the user's intro audio preference */
const AUDIO_PREF_KEY = 'cc-intro-audio';

/** Audio file paths (tried in order) */
const AUDIO_FILES = [
  'assets/sounds/command-center-startup.mp3',
  'assets/sounds/command-center-startup.wav',
];

/** Playback volume (30–40% range) */
const AUDIO_VOLUME = 0.35;

/** Fade-in duration — 0.5 seconds */
const FADE_IN_MS = 500;

/** Fade-out duration — 1 second before dashboard loads */
const FADE_OUT_MS = 1000;

@Component({
  selector: 'app-command-center-intro',
  templateUrl: './command-center-intro.component.html',
  styleUrls: ['./command-center-intro.component.scss'],
  standalone: false,
})
export class CommandCenterIntroComponent implements OnInit, OnDestroy {
  @Output() introComplete = new EventEmitter<void>();

  /**
   * Whether audio is allowed for this intro invocation.
   * Audio plays only on: first login, demo mode, or manual "Launch" click.
   */
  @Input() allowAudio = false;

  activePanel = 0;
  exiting = false;
  soundEnabled = true;
  private timer: any = null;

  // File-based audio
  private audioEl: HTMLAudioElement | null = null;
  private fadeInterval: any = null;
  private fadeInInterval: any = null;

  // Web Audio API fallback
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  // Animated data for panels
  mapMarkers: { x: number; y: number; type: string; delay: number }[] = [];
  aiCallRows: { name: string; status: string; delay: number }[] = [];
  recoveryValue = 0;
  private recoveryInterval: any = null;
  agentTerritories: { cx: number; cy: number; r: number; delay: number; state: string }[] = [];

  ngOnInit(): void {
    // Restore audio preference (default: ON on first launch)
    const savedPref = localStorage.getItem(AUDIO_PREF_KEY);
    if (savedPref === 'off') {
      this.soundEnabled = false;
    }

    this.generateMapMarkers();
    this.generateAiCallRows();
    this.generateAgentTerritories();
    this.startSequence();

    if (this.allowAudio && this.soundEnabled) {
      this.playAudio();
    }
  }

  ngOnDestroy(): void {
    this.clearTimers();
    this.stopAudioImmediate();
  }

  skip(): void {
    this.clearTimers();
    this.fadeOutAudio();
    this.exitIntro();
  }

  toggleSound(): void {
    this.soundEnabled = !this.soundEnabled;
    localStorage.setItem(AUDIO_PREF_KEY, this.soundEnabled ? 'on' : 'off');

    if (this.soundEnabled && this.allowAudio) {
      this.playAudio();
    } else if (!this.soundEnabled) {
      this.fadeOutAudio();
    }
  }

  // ═══════════════════════════════════════════════
  // AUDIO PLAYBACK — File-based with synth fallback
  // ═══════════════════════════════════════════════

  private playAudio(): void {
    this.tryFileAudio(0);
  }

  /** Try each audio file in order, fall back to synthesis if all fail */
  private tryFileAudio(index: number): void {
    if (index >= AUDIO_FILES.length) {
      this.playSynthFallback();
      return;
    }

    try {
      this.audioEl = new Audio(AUDIO_FILES[index]);
      this.audioEl.volume = 0; // Start silent for fade-in
      this.audioEl.preload = 'auto';

      const playPromise = this.audioEl.play();
      if (playPromise) {
        playPromise
          .then(() => this.fadeInAudio())
          .catch(() => {
            this.audioEl = null;
            this.tryFileAudio(index + 1);
          });
      }
    } catch {
      this.audioEl = null;
      this.tryFileAudio(index + 1);
    }
  }

  /** Fade audio in over FADE_IN_MS (0.5s) */
  private fadeInAudio(): void {
    if (!this.audioEl) return;

    const steps = 15;
    const stepMs = FADE_IN_MS / steps;
    let step = 0;

    this.fadeInInterval = setInterval(() => {
      step++;
      if (!this.audioEl) {
        clearInterval(this.fadeInInterval);
        this.fadeInInterval = null;
        return;
      }
      // Ease-in curve
      const progress = step / steps;
      this.audioEl.volume = AUDIO_VOLUME * Math.pow(progress, 1.5);

      if (step >= steps) {
        clearInterval(this.fadeInInterval);
        this.fadeInInterval = null;
        this.audioEl.volume = AUDIO_VOLUME;
      }
    }, stepMs);
  }

  /** Fade audio out over FADE_OUT_MS (1s) when the dashboard loads */
  private fadeOutAudio(): void {
    // Stop any fade-in in progress
    if (this.fadeInInterval) {
      clearInterval(this.fadeInInterval);
      this.fadeInInterval = null;
    }

    if (this.audioEl && !this.audioEl.paused) {
      const startVol = this.audioEl.volume;
      const steps = 25;
      const stepMs = FADE_OUT_MS / steps;
      let step = 0;

      this.fadeInterval = setInterval(() => {
        step++;
        if (!this.audioEl) {
          clearInterval(this.fadeInterval);
          this.fadeInterval = null;
          return;
        }
        const progress = step / steps;
        // Exponential fade for natural decay
        this.audioEl.volume = startVol * Math.pow(1 - progress, 2);

        if (step >= steps) {
          clearInterval(this.fadeInterval);
          this.fadeInterval = null;
          this.audioEl.pause();
          this.audioEl = null;
        }
      }, stepMs);
      return;
    }

    // Fade out synth audio
    if (this.audioCtx && this.masterGain) {
      try {
        const now = this.audioCtx.currentTime;
        this.masterGain.gain.cancelScheduledValues(now);
        this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
        this.masterGain.gain.exponentialRampToValueAtTime(0.001, now + FADE_OUT_MS / 1000);
        setTimeout(() => this.cleanupSynth(), FADE_OUT_MS + 100);
      } catch {
        this.cleanupSynth();
      }
    }
  }

  private stopAudioImmediate(): void {
    if (this.fadeInInterval) {
      clearInterval(this.fadeInInterval);
      this.fadeInInterval = null;
    }
    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
      this.fadeInterval = null;
    }
    if (this.audioEl) {
      try {
        this.audioEl.pause();
        this.audioEl.currentTime = 0;
      } catch { /* ignore */ }
      this.audioEl = null;
    }
    this.cleanupSynth();
  }

  private cleanupSynth(): void {
    if (this.audioCtx) {
      try {
        if (this.audioCtx.state !== 'closed') this.audioCtx.close();
      } catch { /* ignore */ }
      this.audioCtx = null;
      this.masterGain = null;
    }
  }

  // ═══════════════════════════════════════════════
  // WEB AUDIO SYNTHESIS FALLBACK
  // ═══════════════════════════════════════════════
  //
  // Beethoven-style classical orchestral — 9 seconds
  //   0.0–3.0s  Cello/bass tremolo (C minor foundation)
  //   1.5–5.0s  Violin ascending theme (C4→C5 heroic scale)
  //   3.0–6.0s  French horn fanfare (C major resolution)
  //   4.5–7.5s  Full orchestra tutti
  //   7.5–9.0s  Majestic sustain + hall reverb fade

  private playSynthFallback(): void {
    try {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const ctx = this.audioCtx;
      const now = ctx.currentTime;

      // Master gain: 0.5s fade-in, hold, 1s fade-out at end
      this.masterGain = ctx.createGain();
      this.masterGain.gain.setValueAtTime(0, now);
      this.masterGain.gain.linearRampToValueAtTime(AUDIO_VOLUME, now + 0.5);
      this.masterGain.gain.setValueAtTime(AUDIO_VOLUME, now + 8.0);
      this.masterGain.gain.exponentialRampToValueAtTime(0.001, now + 9.0);
      this.masterGain.connect(ctx.destination);

      // Concert hall reverb via delay
      const reverbDelay = ctx.createDelay();
      reverbDelay.delayTime.value = 0.08;
      const reverbGain = ctx.createGain();
      reverbGain.gain.value = 0.20;
      const reverbFilter = ctx.createBiquadFilter();
      reverbFilter.type = 'lowpass';
      reverbFilter.frequency.value = 2500;
      reverbDelay.connect(reverbGain);
      reverbGain.connect(reverbFilter);
      reverbFilter.connect(reverbDelay);
      reverbFilter.connect(this.masterGain);

      // Helper: create a filtered oscillator
      const makeVoice = (
        type: OscillatorType, freq: number,
        start: number, end: number,
        vol: number, filterFreq: number = 3000,
        detune: number = 0,
      ) => {
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.value = freq;
        osc.detune.value = detune;

        const flt = ctx.createBiquadFilter();
        flt.type = 'lowpass';
        flt.frequency.value = filterFreq;
        flt.Q.value = 0.7;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(vol, start + 0.2);
        gain.gain.setValueAtTime(vol, end - 0.4);
        gain.gain.exponentialRampToValueAtTime(0.001, end);

        osc.connect(flt);
        flt.connect(gain);
        gain.connect(this.masterGain!);
        gain.connect(reverbDelay);
        osc.start(start);
        osc.stop(end + 0.2);
      };

      // ── Section 1: Cellos & basses (0.0–3.5s) — C minor tremolo ──
      makeVoice('sawtooth', 130.81, now, now + 3.5, 0.20, 1200);       // C3
      makeVoice('sawtooth', 130.81, now, now + 3.5, 0.08, 1000, 4);    // C3 detuned
      makeVoice('sawtooth', 155.56, now, now + 3.5, 0.14, 1100);       // Eb3
      makeVoice('sawtooth', 196.00, now, now + 3.5, 0.16, 1200);       // G3
      makeVoice('sine', 65.41, now, now + 3.5, 0.18, 800);             // Bass C2

      // ── Section 2: Violins ascending (1.5–5.5s) — heroic scale ──
      const scaleNotes = [261.63, 293.66, 311.13, 349.23, 392.00, 466.16, 523.25];
      const noteLen = 0.55;
      for (let n = 0; n < scaleNotes.length; n++) {
        const nStart = now + 1.5 + n * noteLen;
        const nEnd = nStart + noteLen + 0.15;
        makeVoice('sawtooth', scaleNotes[n], nStart, nEnd, 0.16, 2500 + n * 300);
        makeVoice('sawtooth', scaleNotes[n], nStart, nEnd, 0.06, 2200 + n * 200, 3);
        // Viola octave below
        makeVoice('sawtooth', scaleNotes[n] / 2, nStart, nEnd, 0.08, 1500);
      }

      // ── Section 3: French horns (3.0–6.5s) — C major fanfare ──
      makeVoice('square', 261.63, now + 3.0, now + 6.5, 0.10, 1800);   // C4
      makeVoice('square', 329.63, now + 3.0, now + 6.5, 0.08, 1600);   // E4
      makeVoice('square', 392.00, now + 3.0, now + 6.5, 0.09, 1700);   // G4
      makeVoice('sine', 261.63, now + 3.0, now + 6.5, 0.08, 2000);     // fundamental

      // ── Section 4: Full tutti (4.5–8.0s) — triumphant ──
      makeVoice('sawtooth', 261.63, now + 4.5, now + 8.0, 0.12, 3500);  // C4
      makeVoice('sawtooth', 329.63, now + 4.5, now + 8.0, 0.10, 3200);  // E4
      makeVoice('sawtooth', 392.00, now + 4.5, now + 8.0, 0.11, 3400);  // G4
      makeVoice('sawtooth', 523.25, now + 4.5, now + 8.0, 0.08, 4000);  // C5
      makeVoice('sine', 659.26, now + 4.5, now + 8.0, 0.05, 4500);     // E5
      makeVoice('sine', 65.41, now + 4.5, now + 8.0, 0.12, 600);       // Bass C2
      makeVoice('sine', 130.81, now + 4.5, now + 8.0, 0.08, 800);      // C3

      // Trumpet accents
      makeVoice('sine', 523.25, now + 4.5, now + 7.5, 0.06, 5000);
      makeVoice('sine', 1046.50, now + 4.5, now + 7.0, 0.03, 6000);

      // ── Timpani hits ──
      const timpaniTimes = [0.0, 1.5, 3.0, 4.5, 5.5];
      for (const ht of timpaniTimes) {
        const tOsc = ctx.createOscillator();
        tOsc.type = 'sine';
        tOsc.frequency.value = 65.41;
        const tGain = ctx.createGain();
        tGain.gain.setValueAtTime(0, now + ht);
        tGain.gain.linearRampToValueAtTime(0.25, now + ht + 0.015);
        tGain.gain.exponentialRampToValueAtTime(0.001, now + ht + 1.0);
        tOsc.connect(tGain);
        tGain.connect(this.masterGain);
        tOsc.start(now + ht);
        tOsc.stop(now + ht + 1.2);
      }

    } catch (e) {
      console.warn('Intro audio unavailable:', e);
    }
  }

  // ═══════════════════════════════════════════════
  // PANEL SEQUENCING
  // ═══════════════════════════════════════════════

  private startSequence(): void {
    this.activePanel = 0;
    this.startPanelAnimations();

    this.timer = setInterval(() => {
      if (this.activePanel < TOTAL_PANELS - 1) {
        this.activePanel++;
        this.startPanelAnimations();
      } else {
        this.clearTimers();
        this.exitIntro();
      }
    }, PANEL_DURATION_MS);
  }

  private startPanelAnimations(): void {
    if (this.activePanel === 2) {
      this.animateRecoveryValue();
    }
  }

  private animateRecoveryValue(): void {
    this.recoveryValue = 0;
    const target = 847500;
    const steps = 40;
    let step = 0;

    this.recoveryInterval = setInterval(() => {
      step++;
      const progress = step / steps;
      const eased = 1 - Math.pow(1 - progress, 3);
      this.recoveryValue = Math.round(target * eased);

      if (step >= steps) {
        this.recoveryValue = target;
        clearInterval(this.recoveryInterval);
        this.recoveryInterval = null;
      }
    }, PANEL_DURATION_MS / steps);
  }

  private exitIntro(): void {
    this.exiting = true;
    this.fadeOutAudio(); // 1-second fade before dashboard
    setTimeout(() => {
      this.introComplete.emit();
    }, 600);
  }

  private clearTimers(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.recoveryInterval) {
      clearInterval(this.recoveryInterval);
      this.recoveryInterval = null;
    }
  }

  // ═══════════════════════════════════════════════
  // DATA GENERATORS
  // ═══════════════════════════════════════════════

  private generateMapMarkers(): void {
    const types = ['fire', 'storm', 'crime', 'fire', 'storm', 'fire', 'crime', 'storm', 'fire', 'fire', 'storm', 'crime', 'fire', 'fire', 'storm'];
    this.mapMarkers = types.map((type, i) => ({
      x: 10 + Math.random() * 80,
      y: 15 + Math.random() * 65,
      type,
      delay: i * 0.15,
    }));
  }

  private generateAiCallRows(): void {
    this.aiCallRows = [
      { name: 'Sarah Chen — Dallas, TX', status: 'qualified', delay: 0.2 },
      { name: 'James Wilson — Fort Worth, TX', status: 'ringing', delay: 0.5 },
      { name: 'Maria Gonzalez — Houston, TX', status: 'qualified', delay: 0.8 },
      { name: 'Robert Kim — Austin, TX', status: 'in-progress', delay: 1.1 },
      { name: 'Patricia Hernandez — San Antonio, TX', status: 'qualified', delay: 1.4 },
      { name: 'David Martinez — Arlington, TX', status: 'ringing', delay: 1.7 },
    ];
  }

  private generateAgentTerritories(): void {
    this.agentTerritories = [
      { cx: 25, cy: 45, r: 12, delay: 0.1, state: 'TX' },
      { cx: 70, cy: 35, r: 10, delay: 0.3, state: 'FL' },
      { cx: 50, cy: 25, r: 9, delay: 0.5, state: 'GA' },
      { cx: 35, cy: 30, r: 11, delay: 0.7, state: 'LA' },
      { cx: 60, cy: 55, r: 8, delay: 0.9, state: 'NC' },
      { cx: 45, cy: 60, r: 10, delay: 1.1, state: 'AL' },
      { cx: 80, cy: 50, r: 9, delay: 1.3, state: 'SC' },
      { cx: 20, cy: 60, r: 7, delay: 1.5, state: 'MS' },
    ];
  }

  fmtCurrency(val: number): string {
    return '$' + val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  getProgressWidth(): string {
    return ((this.activePanel + 1) / TOTAL_PANELS * 100) + '%';
  }
}
