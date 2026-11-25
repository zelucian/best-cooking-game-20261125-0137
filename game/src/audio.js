// audio.js — all sound is synthesized with the Web Audio API; no audio files.
// Short blips and noise bursts: a chop tick, a sizzle, a serve ding, a miss
// buzz, a coin chime and the rush-hour bell. Mute with M.

let ctx = null;
let muted = false;
let sizzleNode = null;

export function setMuted(value) {
  muted = value;
  if (sizzleNode) sizzleNode.gain.value = muted ? 0 : 0.03;
}

export function isMuted() {
  return muted;
}

// Lazily created on the first user gesture (browsers block audio before one).
function audioContext() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq, dur, type = 'sine', vol = 0.12, when = 0, slideTo = null) {
  if (muted) return;
  const ac = audioContext();
  if (!ac) return;
  const t = ac.currentTime + when;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(dur, vol = 0.08, when = 0, filterFreq = 1800) {
  if (muted) return;
  const ac = audioContext();
  if (!ac) return;
  const t = ac.currentTime + when;
  const len = Math.max(1, Math.floor(ac.sampleRate * dur));
  const buffer = ac.createBuffer(1, len, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = filterFreq;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(gain).connect(ac.destination);
  src.start(t);
}

export function sfxGrab() {
  tone(520, 0.07, 'triangle', 0.08);
}

export function sfxChopTick() {
  noise(0.05, 0.16, 0, 2600);
  tone(180, 0.05, 'square', 0.05);
}

export function sfxChopDone() {
  tone(660, 0.09, 'triangle', 0.1);
  tone(880, 0.12, 'triangle', 0.1, 0.07);
}

export function sfxPlace() {
  tone(300, 0.08, 'triangle', 0.09, 0, 210);
}

export function sfxCookDone() {
  tone(740, 0.12, 'sine', 0.1);
  tone(988, 0.16, 'sine', 0.1, 0.1);
}

export function sfxBurn() {
  tone(220, 0.3, 'sawtooth', 0.07, 0, 110);
}

export function sfxServe() {
  tone(784, 0.1, 'triangle', 0.11);
  tone(1046, 0.14, 'triangle', 0.11, 0.09);
  tone(1318, 0.2, 'triangle', 0.1, 0.18);
}

export function sfxCoin() {
  tone(1318, 0.08, 'square', 0.05);
  tone(1760, 0.14, 'square', 0.05, 0.06);
}

export function sfxMiss() {
  tone(196, 0.28, 'sawtooth', 0.09, 0, 130);
}

export function sfxReject() {
  tone(140, 0.12, 'square', 0.08);
  tone(140, 0.12, 'square', 0.08, 0.14);
}

export function sfxRushBell() {
  tone(1046, 0.18, 'triangle', 0.12);
  tone(1046, 0.18, 'triangle', 0.12, 0.22);
  tone(1568, 0.3, 'triangle', 0.12, 0.44);
}

export function sfxClick() {
  tone(700, 0.05, 'triangle', 0.07);
}

// A soft looping sizzle while anything cooks on the stove.
export function setSizzle(on) {
  const ac = audioContext();
  if (!ac) return;
  if (on && !sizzleNode) {
    const len = ac.sampleRate;
    const buffer = ac.createBuffer(1, len, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const filter = ac.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 4000;
    const gain = ac.createGain();
    gain.gain.value = muted ? 0 : 0.03;
    src.connect(filter).connect(gain).connect(ac.destination);
    src.start();
    sizzleNode = { src, gain };
  } else if (!on && sizzleNode) {
    try {
      sizzleNode.src.stop();
    } catch {
      // Already stopped.
    }
    sizzleNode = null;
  }
}
