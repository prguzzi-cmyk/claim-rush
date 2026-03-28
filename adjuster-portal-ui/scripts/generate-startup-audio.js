#!/usr/bin/env node

/**
 * Command Center Startup Audio — Beethoven-Style Classical Orchestral
 *
 * 9-second orchestral intro inspired by Beethoven symphonic style.
 * Original composition — not a copy of any existing work.
 *
 * Orchestration:
 *   Cellos & Basses    — Low string foundation with tremolo bowing
 *   Violas & Violins   — Ascending melodic line and harmonic fill
 *   French Horns       — Heroic fanfare motif
 *   Trumpets           — Bright accents on the climax
 *   Timpani            — Rhythmic punctuation
 *   Full Tutti         — Triumphant C-major resolution
 *
 * Structure:
 *   0.0–2.5s   Cellos/basses: low tremolo building tension (C minor)
 *   1.5–4.5s   Violins: ascending heroic theme (C-Eb-F-G-Ab-Bb-C)
 *   3.0–5.5s   French horns: fanfare power chords (C major resolution)
 *   4.5–7.5s   Full orchestra tutti — triumphant, powerful
 *   7.0–9.0s   Majestic sustain → hall reverb fade
 *
 * Run:  node scripts/generate-startup-audio.js
 */

const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 44100;
const DURATION = 9.0;
const NUM_SAMPLES = Math.ceil(SAMPLE_RATE * DURATION);
const NUM_CHANNELS = 2;

const left = new Float32Array(NUM_SAMPLES);
const right = new Float32Array(NUM_SAMPLES);

// ═══════════════════════════════════════════════════════
// INSTRUMENT SIMULATION
// ═══════════════════════════════════════════════════════

function sine(freq, t, phase = 0) {
  return Math.sin(2 * Math.PI * freq * t + phase);
}

function sawBandLimited(freq, t, harmonics = 12) {
  // Band-limited sawtooth — sounds like bowed strings
  let s = 0;
  for (let k = 1; k <= harmonics; k++) {
    s += Math.sin(2 * Math.PI * freq * k * t) / k * (k % 2 === 0 ? -1 : 1);
  }
  return s * (2 / Math.PI);
}

function squareBandLimited(freq, t, harmonics = 8) {
  // Band-limited square — base for brass/horn sound
  let s = 0;
  for (let k = 0; k < harmonics; k++) {
    const h = 2 * k + 1;
    s += Math.sin(2 * Math.PI * freq * h * t) / h;
  }
  return s * (4 / Math.PI);
}

// ── Envelope shapes ──

function envADSR(t, a, d, s, r, total) {
  if (t < 0 || t > total) return 0;
  if (t < a) return t / a;
  if (t < a + d) return 1.0 - (1.0 - s) * ((t - a) / d);
  if (t < total - r) return s;
  return s * (1.0 - (t - (total - r)) / r);
}

function envSwell(t, dur) {
  // Orchestral swell: slow rise to peak at 70%, then sustain
  const peak = dur * 0.7;
  if (t < 0 || t > dur) return 0;
  if (t < peak) return Math.pow(t / peak, 1.5);
  return 1.0 - 0.2 * ((t - peak) / (dur - peak));
}

function lerp(a, b, t) {
  return a + (b - a) * Math.min(1, Math.max(0, t));
}

// ── Lowpass filter (two-pole for warmer rolloff) ──
function createFilter() {
  let y1 = 0, y2 = 0;
  return function(sample, cutoffNorm) {
    const c = Math.min(0.99, cutoffNorm);
    const r = 0.35; // resonance
    y1 += c * (sample - y1 + r * (y1 - y2));
    y2 += c * (y1 - y2);
    return y2;
  };
}

// ── String ensemble (multiple detuned sawtooth voices) ──
function stringSection(freq, t, voices = 4) {
  let s = 0;
  const detunes = [-4, -1.5, 1.5, 4]; // cents of detuning
  for (let v = 0; v < voices; v++) {
    const detunedFreq = freq * Math.pow(2, (detunes[v] || 0) / 1200);
    s += sawBandLimited(detunedFreq, t, 10);
  }
  return s / voices;
}

// ── French horn (filtered square + sine fundamental) ──
function horn(freq, t) {
  const sq = squareBandLimited(freq, t, 6) * 0.5;
  const fundamental = sine(freq, t) * 0.5;
  return sq + fundamental;
}

// ── Timpani (sine with noise burst) ──
function timpani(freq, t, hitTime) {
  const dt = t - hitTime;
  if (dt < 0 || dt > 1.5) return 0;
  const env = dt < 0.01 ? dt / 0.01 : Math.exp(-dt * 4);
  const tone = sine(freq, t) * 0.8;
  // Noise burst on attack
  const noise = dt < 0.04 ? (Math.random() * 2 - 1) * (1 - dt / 0.04) : 0;
  return (tone + noise * 0.3) * env;
}

// ═══════════════════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════════════════

console.log('Generating Beethoven-style classical orchestral intro (9s)...');

// Note frequencies
const C2 = 65.41, C3 = 130.81, Eb3 = 155.56, G3 = 196.00;
const C4 = 261.63, D4 = 293.66, Eb4 = 311.13, E4 = 329.63;
const F4 = 349.23, G4 = 392.00, Ab4 = 415.30, Bb4 = 466.16;
const C5 = 523.25, E5 = 659.26, G5 = 783.99;

// Filters for each section
const celloFilterL = createFilter();
const celloFilterR = createFilter();
const violinFilterL = createFilter();
const violinFilterR = createFilter();
const hornFilterL = createFilter();
const hornFilterR = createFilter();

// Reverb: multi-tap delay network (concert hall simulation)
const TAPS = [
  { delay: Math.round(0.031 * SAMPLE_RATE), gain: 0.30 },
  { delay: Math.round(0.059 * SAMPLE_RATE), gain: 0.25 },
  { delay: Math.round(0.097 * SAMPLE_RATE), gain: 0.20 },
  { delay: Math.round(0.137 * SAMPLE_RATE), gain: 0.15 },
  { delay: Math.round(0.179 * SAMPLE_RATE), gain: 0.10 },
];
const reverbBufL = new Float32Array(NUM_SAMPLES);
const reverbBufR = new Float32Array(NUM_SAMPLES);
const reverbLpL = createFilter();
const reverbLpR = createFilter();

// Timpani hit times (rhythmic punctuation)
const timpaniHits = [0.0, 1.5, 3.0, 4.5, 5.5, 6.2];

for (let i = 0; i < NUM_SAMPLES; i++) {
  const t = i / SAMPLE_RATE;
  let L = 0, R = 0;

  // ─── SECTION 1: Cellos & basses tremolo (0.0–3.5s) ───
  // Low C-minor foundation with tremolo (rapid bow changes)
  if (t < 3.5) {
    const env = envADSR(t, 0.4, 0.3, 0.7, 0.8, 3.5);
    // Tremolo: amplitude modulation at ~8Hz
    const tremolo = 0.7 + 0.3 * sine(8, t);

    const cello1 = stringSection(C3, t, 3) * 0.25;       // C3
    const cello2 = stringSection(Eb3, t, 3) * 0.18;      // Eb3
    const cello3 = stringSection(G3, t, 3) * 0.20;       // G3
    const bass = sine(C2, t) * 0.22;                       // Double bass C2

    const cellos = (cello1 + cello2 + cello3 + bass) * env * tremolo;

    // Filter: dark at start, opens slightly
    const cutoff = lerp(800, 2000, t / 3.5) / SAMPLE_RATE;
    L += celloFilterL(cellos, cutoff);
    R += celloFilterR(cellos * 0.92, cutoff * 0.95);
  }

  // ─── SECTION 2: Violins ascending heroic theme (1.5–5.5s) ───
  // Rising melodic line: C4 → D4 → Eb4 → F4 → G4 → Ab4 → Bb4 → C5
  if (t >= 1.5 && t < 5.5) {
    const vt = t - 1.5;
    const dur = 4.0;
    const env = envADSR(vt, 0.3, 0.2, 0.85, 0.6, dur);

    // Step through ascending scale (each note ~0.5s)
    const notes = [C4, D4, Eb4, F4, G4, Ab4, Bb4, C5];
    const noteIdx = Math.min(Math.floor(vt / 0.5), notes.length - 1);
    const noteFreq = notes[noteIdx];
    // Smooth portamento between notes
    const nextIdx = Math.min(noteIdx + 1, notes.length - 1);
    const noteFrac = (vt / 0.5) % 1;
    const glideFreq = noteFrac > 0.85
      ? lerp(noteFreq, notes[nextIdx], (noteFrac - 0.85) / 0.15)
      : noteFreq;

    const vln1 = stringSection(glideFreq, t, 4) * 0.22;
    // Harmony: third above (softer)
    const harmFreq = glideFreq * 1.2; // approximate major third
    const vln2 = stringSection(harmFreq, t, 3) * 0.10;
    // Viola doubling octave lower
    const viola = stringSection(glideFreq / 2, t, 3) * 0.12;

    const violins = (vln1 + vln2 + viola) * env;

    // Filter opens with the crescendo
    const vCut = lerp(1200, 4500, vt / dur) / SAMPLE_RATE;
    L += violinFilterL(violins, vCut);
    R += violinFilterR(violins * 1.05, vCut * 1.02); // slight stereo spread
  }

  // ─── SECTION 3: French horns fanfare (3.0–6.5s) ───
  // Heroic brass: C major power chord resolution
  if (t >= 3.0 && t < 6.5) {
    const ht = t - 3.0;
    const dur = 3.5;
    const env = envADSR(ht, 0.15, 0.3, 0.75, 0.8, dur);

    // Horn chord: C4 + E4 + G4 (C major — resolving from C minor)
    const h1 = horn(C4, t) * 0.18;
    const h2 = horn(E4, t) * 0.14;
    const h3 = horn(G4, t) * 0.16;
    // Second horn pair slightly detuned for width
    const h4 = horn(C4 * 1.002, t) * 0.08;

    const horns = (h1 + h2 + h3 + h4) * env;

    const hCut = lerp(600, 3500, ht / dur) / SAMPLE_RATE;
    L += hornFilterL(horns, hCut) * 0.85;
    R += hornFilterR(horns, hCut) * 1.15; // horns slightly right
  }

  // ─── SECTION 4: Full orchestra tutti (4.5–8.0s) ───
  // Triumphant C major — all sections combined with trumpets
  if (t >= 4.5 && t < 8.0) {
    const ft = t - 4.5;
    const dur = 3.5;
    const env = envSwell(ft, dur);

    // Full strings: C major chord across registers
    const s1 = stringSection(C4, t, 4) * 0.14;
    const s2 = stringSection(E4, t, 4) * 0.11;
    const s3 = stringSection(G4, t, 4) * 0.12;
    const s4 = stringSection(C5, t, 3) * 0.09;
    // High violins singing
    const s5 = stringSection(E5, t, 3) * 0.06;
    const s6 = stringSection(G5, t, 2) * 0.04;

    // Bass reinforcement
    const bassOct = sine(C2, t) * 0.15 + sine(C3, t) * 0.10;

    // Trumpet accents (bright, heroic)
    const trp1 = sine(C5, t) * 0.08 + sine(C5 * 2, t) * 0.03;
    const trp2 = sine(G4, t) * 0.06 + sine(G4 * 2, t) * 0.02;
    const trumpets = (trp1 + trp2) * envADSR(ft, 0.08, 0.2, 0.6, 0.5, dur);

    const tutti = (s1 + s2 + s3 + s4 + s5 + s6 + bassOct + trumpets) * env;

    L += tutti;
    R += tutti;
  }

  // ─── TIMPANI ───
  for (const hitTime of timpaniHits) {
    if (t >= hitTime && t < hitTime + 1.5) {
      const tim = timpani(C2, t, hitTime) * 0.20;
      L += tim;
      R += tim;
    }
  }

  // ─── REVERB: multi-tap delay (concert hall) ───
  let reverbL = 0, reverbR = 0;
  for (const tap of TAPS) {
    if (i >= tap.delay) {
      reverbL += reverbBufL[i - tap.delay] * tap.gain;
      reverbR += reverbBufR[i - tap.delay] * tap.gain;
    }
  }
  // Lowpass the reverb for warmth
  reverbL = reverbLpL(reverbL, 0.08);
  reverbR = reverbLpR(reverbR, 0.07);

  L += reverbL * 0.35;
  R += reverbR * 0.35;

  reverbBufL[i] = L;
  reverbBufR[i] = R;

  // ─── MASTER ENVELOPE: 0.5s fade-in, 1.0s fade-out ───
  let master = 1.0;
  if (t < 0.5) {
    master = t / 0.5; // 0.5s fade in
  } else if (t > 8.0) {
    master = Math.max(0, 1.0 - (t - 8.0) / 1.0); // 1.0s fade out
  }

  left[i] = L * master;
  right[i] = R * master;
}

// ── Normalize ──
let peak = 0;
for (let i = 0; i < NUM_SAMPLES; i++) {
  peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
}
if (peak > 0) {
  const norm = 0.88 / peak;
  for (let i = 0; i < NUM_SAMPLES; i++) {
    left[i] *= norm;
    right[i] *= norm;
  }
}

// ═══════════════════════════════════════════════════════
// WRITE WAV
// ═══════════════════════════════════════════════════════

function writeWav(leftCh, rightCh, sampleRate, filePath) {
  const numSamples = leftCh.length;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = NUM_CHANNELS * bytesPerSample;
  const dataSize = numSamples * blockAlign;
  const fileSize = 44 + dataSize;

  const buffer = Buffer.alloc(fileSize);
  let offset = 0;

  buffer.write('RIFF', offset); offset += 4;
  buffer.writeUInt32LE(fileSize - 8, offset); offset += 4;
  buffer.write('WAVE', offset); offset += 4;

  buffer.write('fmt ', offset); offset += 4;
  buffer.writeUInt32LE(16, offset); offset += 4;
  buffer.writeUInt16LE(1, offset); offset += 2;
  buffer.writeUInt16LE(NUM_CHANNELS, offset); offset += 2;
  buffer.writeUInt32LE(sampleRate, offset); offset += 4;
  buffer.writeUInt32LE(sampleRate * blockAlign, offset); offset += 4;
  buffer.writeUInt16LE(blockAlign, offset); offset += 2;
  buffer.writeUInt16LE(bitsPerSample, offset); offset += 2;

  buffer.write('data', offset); offset += 4;
  buffer.writeUInt32LE(dataSize, offset); offset += 4;

  for (let i = 0; i < numSamples; i++) {
    const l = Math.max(-1, Math.min(1, leftCh[i]));
    const r = Math.max(-1, Math.min(1, rightCh[i]));
    buffer.writeInt16LE(Math.round(l * 32767), offset); offset += 2;
    buffer.writeInt16LE(Math.round(r * 32767), offset); offset += 2;
  }

  fs.writeFileSync(filePath, buffer);
  const kb = (fileSize / 1024).toFixed(0);
  console.log(`Written: ${filePath} (${kb} KB, ${DURATION}s)`);
}

const outDir = path.join(__dirname, '..', 'src', 'assets', 'sounds');
const wavPath = path.join(outDir, 'command-center-startup.wav');

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

writeWav(left, right, SAMPLE_RATE, wavPath);

// Try to create AAC via macOS afconvert
const mp3Path = path.join(outDir, 'command-center-startup.mp3');
try {
  const { execSync } = require('child_process');
  execSync(`afconvert "${wavPath}" -o "${mp3Path}" -f mp4f -d aac -b 128000`, { stdio: 'pipe' });
  console.log(`Written: ${mp3Path} (AAC)`);
} catch {
  // Copy WAV as mp3 fallback — component handles format detection
  fs.copyFileSync(wavPath, mp3Path);
  console.log(`Written: ${mp3Path} (WAV copy — install ffmpeg for real MP3)`);
}

console.log('\nDone. To produce a true MP3:');
console.log(`  ffmpeg -i "${wavPath}" -codec:a libmp3lame -b:a 192k "${mp3Path}"`);
