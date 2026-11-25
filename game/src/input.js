// input.js — keyboard and mouse, turned into game actions. The canvas listens;
// main.js decides what each action does in the current mode.

import { PANTRY_ORDER } from './config.js';

export function createInput() {
  return {
    keys: new Set(),
    // Mouse position in canvas pixels (set by main.js after scaling).
    mouse: { x: 0, y: 0 },
    // Queued one-shot actions, drained by main.js each frame:
    // {type:'interact'} | {type:'click', x, y} | {type:'start'} | ...
    queue: [],
  };
}

// Movement vector from held keys, normalised.
export function movementVector(input) {
  let x = 0;
  let y = 0;
  if (input.keys.has('ArrowLeft') || input.keys.has('KeyA')) x -= 1;
  if (input.keys.has('ArrowRight') || input.keys.has('KeyD')) x += 1;
  if (input.keys.has('ArrowUp') || input.keys.has('KeyW')) y -= 1;
  if (input.keys.has('ArrowDown') || input.keys.has('KeyS')) y += 1;
  if (x !== 0 && y !== 0) {
    x *= Math.SQRT1_2;
    y *= Math.SQRT1_2;
  }
  return { x, y };
}

export function attachInput(canvas, input, callbacks) {
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
    if (e.repeat) return;
    input.keys.add(e.code);
    if (e.code === 'KeyE' || e.code === 'Space') input.queue.push({ type: 'interact' });
    else if (e.code === 'Enter') input.queue.push({ type: 'start' });
    else if (e.code === 'KeyR') input.queue.push({ type: 'restart' });
    else if (e.code === 'KeyP' || e.code === 'Escape') input.queue.push({ type: 'pause' });
    else if (e.code === 'KeyM') input.queue.push({ type: 'mute' });
    else if (/^Digit[1-7]$/.test(e.code)) {
      const n = Number(e.code.slice(5));
      if (n >= 1 && n <= PANTRY_ORDER.length) input.queue.push({ type: 'pantry', index: n - 1 });
    }
    if (callbacks.onKey) callbacks.onKey(e.code);
  });
  window.addEventListener('keyup', (e) => {
    input.keys.delete(e.code);
  });
  window.addEventListener('blur', () => {
    input.keys.clear();
  });

  function canvasPoint(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  }
  canvas.addEventListener('mousemove', (e) => {
    const p = canvasPoint(e);
    input.mouse.x = p.x;
    input.mouse.y = p.y;
  });
  canvas.addEventListener('mousedown', (e) => {
    const p = canvasPoint(e);
    input.mouse.x = p.x;
    input.mouse.y = p.y;
    input.queue.push({ type: 'click', x: p.x, y: p.y, button: e.button });
  });
}
