/**
 * Generates the reward feedback tones shipped in `assets/sounds/`.
 *
 * The assets are committed, so this script is provenance + regeneration, not
 * a build step: it writes deterministic 16-bit PCM WAVs (no external audio
 * dependency, no licensing surface). Run with `node scripts/generate-reward-sounds.mjs`.
 *
 * Sound design brief (Refero: Brilliant/Duolingo reward feedback):
 * - `reward-quest`  — short two-note rising chime for a completed daily quest.
 * - `reward-level`  — four-note major arpeggio for a level-up / badge unlock.
 * Both are quiet, fast-attack, and decay fully so overlapping rewards do not
 * stack into noise. Routine check-offs stay silent by design.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SAMPLE_RATE = 44100;
const OUTPUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'sounds');

/** Equal-tempered frequency for a note name like `C5`. */
function noteFrequency(note) {
  const match = /^([A-G])(#?)(\d)$/.exec(note);
  if (!match) throw new Error(`Unsupported note: ${note}`);
  const [, letter, sharp, octave] = match;
  const semitones = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const midi = 12 * (Number(octave) + 1) + semitones[letter] + (sharp ? 1 : 0);
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Render a sequence of tones into a mono PCM buffer.
 * Each voice: fast attack, exponential decay, a little second-harmonic
 * shimmer so the tone reads as "reward" rather than a test tone.
 */
function renderTones(voices) {
  const totalSeconds = voices.reduce((sum, voice) => sum + voice.seconds, 0);
  const samples = new Float32Array(Math.ceil(totalSeconds * SAMPLE_RATE));
  let cursor = 0;

  for (const voice of voices) {
    const length = Math.ceil(voice.seconds * SAMPLE_RATE);
    const frequency = noteFrequency(voice.note);
    const attackSamples = Math.max(1, Math.round(0.008 * SAMPLE_RATE));
    for (let index = 0; index < length; index += 1) {
      const progress = index / length;
      const envelope =
        (index < attackSamples ? index / attackSamples : 1) * Math.exp(-4.2 * progress);
      const time = index / SAMPLE_RATE;
      const fundamental = Math.sin(2 * Math.PI * frequency * time);
      const shimmer = 0.22 * Math.sin(4 * Math.PI * frequency * time);
      const tail =
        Math.exp(-6 * progress) * 0.12 * Math.sin(2 * Math.PI * (frequency * 1.5) * time);
      samples[cursor + index] = (fundamental + shimmer + tail) * envelope * voice.gain;
    }
    cursor += length;
  }

  return samples;
}

function toWav(samples) {
  const dataBytes = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataBytes);
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write('WAVE', 8, 'ascii');
  buffer.write('fmt ', 12, 'ascii');
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(dataBytes, 40);
  for (let index = 0; index < samples.length; index += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[index]));
    buffer.writeInt16LE(Math.round(clamped * 32767 * 0.6), 44 + index * 2);
  }
  return buffer;
}

const CLIPS = {
  'reward-quest': [
    { note: 'E5', seconds: 0.12, gain: 0.9 },
    { note: 'A5', seconds: 0.26, gain: 0.85 },
  ],
  'reward-level': [
    { note: 'C5', seconds: 0.1, gain: 0.8 },
    { note: 'E5', seconds: 0.1, gain: 0.85 },
    { note: 'G5', seconds: 0.12, gain: 0.9 },
    { note: 'C6', seconds: 0.34, gain: 0.95 },
  ],
};

mkdirSync(OUTPUT_DIR, { recursive: true });
for (const [name, voices] of Object.entries(CLIPS)) {
  const file = join(OUTPUT_DIR, `${name}.wav`);
  const wav = toWav(renderTones(voices));
  writeFileSync(file, wav);
  console.log(`[sounds] wrote ${file} (${wav.length} bytes)`);
}
