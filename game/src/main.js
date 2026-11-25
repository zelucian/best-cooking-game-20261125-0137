// main.js — The Golden Skillet's entry point: the game loop, the shift timer,
// scoring and combos, and the glue between input, kitchen, orders and render.
// Open game/index.html in a desktop browser; add ?shot=title|play|rush|serve
// &seed=7 for a deterministic staged screenshot.

import {
  CANVAS_H,
  CANVAS_W,
  COMBO_CAP,
  COMBO_STEP,
  COMBO_WINDOW,
  RECIPES,
  RUSH_END,
  RUSH_START,
  SHIFT_SECONDS,
} from './config.js';
import { mulberry32 } from './random.js';
import { createOrderBoard, findMatchingTicket, serveTicket, ticketPatienceLeft, updateOrderBoard } from './orders.js';
import {
  anythingCooking,
  clearHands,
  clickMoveTo,
  clickStation,
  createKitchen,
  interact,
  moveChefByInput,
  nearestStation,
  pantryBinAt,
  stationAt,
  updateKitchen,
} from './kitchen.js';
import {
  setMuted,
  setSizzle,
  sfxBurn,
  sfxChopDone,
  sfxChopTick,
  sfxClick,
  sfxCoin,
  sfxCookDone,
  sfxGrab,
  sfxMiss,
  sfxPlace,
  sfxReject,
  sfxRushBell,
  sfxServe,
} from './audio.js';
import { attachInput, createInput, movementVector } from './input.js';
import { renderGame } from './render.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = CANVAS_W;
canvas.height = CANVAS_H;

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seed = Number(params.get('seed') ?? 7) || 7;

export function createGameState(seedValue) {
  const rng = mulberry32(seedValue);
  return {
    mode: 'title', // 'title' | 'play' | 'pause' | 'over'
    clock: 0,
    shiftTime: 0,
    shiftTotal: SHIFT_SECONDS,
    shiftLeft: SHIFT_SECONDS,
    rush: false,
    rushAnnounced: false,
    coins: 0,
    servedCount: 0,
    combo: 0,
    bestCombo: 0,
    lastServeAt: -Infinity,
    kitchen: createKitchen(),
    board: createOrderBoard(rng),
    popups: [],
    nearestStationName: null,
    rng,
    muted: false,
  };
}

const state = createGameState(seed);
const input = createInput();

attachInput(canvas, input, {});

// ---------------------------------------------------------------- scoring

function addPopup(text, x, y, color = '#ffd23e', size = 22) {
  state.popups.push({ text, x, y, bornAt: state.clock, color, size });
  if (state.popups.length > 12) state.popups.shift();
}

function servePlate(plateItems) {
  const ticket = findMatchingTicket(state.board, plateItems);
  if (!ticket) {
    sfxReject();
    state.kitchen.notice = { text: 'No order wants this dish', at: state.clock };
    return;
  }
  const recipe = RECIPES[ticket.recipeId];
  // Patience bonus: up to +50% for a fast serve. Combo: +10% a serve, capped.
  const patienceLeft = ticketPatienceLeft(ticket, state.shiftTime);
  const speedBonus = 1 + Math.max(0, Math.min(1, patienceLeft)) * 0.5;
  if (state.shiftTime - state.lastServeAt <= COMBO_WINDOW) state.combo += 1;
  else state.combo = 1;
  state.bestCombo = Math.max(state.bestCombo, state.combo);
  state.lastServeAt = state.shiftTime;
  const comboMult = Math.min(COMBO_CAP, 1 + (state.combo - 1) * COMBO_STEP);
  const earned = Math.round(recipe.price * speedBonus * comboMult);
  state.coins += earned;
  state.servedCount += 1;
  serveTicket(state.board, ticket);
  clearHands(state.kitchen);
  const serveX = 868;
  const serveY = 700;
  addPopup(`SERVED! +${earned}`, serveX, serveY - 40, '#ffd23e', 26);
  if (state.combo > 1) addPopup(`COMBO x${comboMult.toFixed(1)}`, serveX, serveY - 72, '#ff9d5c', 18);
  sfxServe();
  setTimeout(() => sfxCoin(), 180);
}

// ---------------------------------------------------------------- events

function handleKitchenEvents(events) {
  for (const ev of events) {
    if (ev.type === 'grabbed') sfxGrab();
    else if (ev.type === 'chop-start') sfxChopTick();
    else if (ev.type === 'chop-tick') sfxChopTick();
    else if (ev.type === 'chopped') {
      sfxChopDone();
      addPopup('Chopped!', state.kitchen.chef.x, state.kitchen.chef.y - 70, '#bfe8a8', 16);
    } else if (ev.type === 'cook-start') sfxPlace();
    else if (ev.type === 'cooked') {
      sfxCookDone();
      addPopup('Ready!', 1178, 420, '#ffd23e', 16);
    } else if (ev.type === 'burnt') {
      sfxBurn();
      addPopup('Burnt!', 1178, 420, '#ff7a6b', 18);
    } else if (ev.type === 'plated') sfxPlace();
    else if (ev.type === 'plate-picked-up' || ev.type === 'plate-put-down') sfxGrab();
    else if (ev.type === 'trashed' || ev.type === 'trashed-plate') sfxPlace();
    else if (ev.type === 'reject') sfxReject();
    else if (ev.type === 'serve-attempt') servePlate(ev.plate);
  }
}

function handleBoardEvents(events) {
  for (const ev of events) {
    if (ev.type === 'spawned') {
      sfxClick();
      // Over the open floor, clear of the board header and the pantry: the
      // popup's rise used to cross both.
      addPopup('New order!', 400, 260, '#fff8e7', 15);
    } else if (ev.type === 'lost') {
      sfxMiss();
      state.combo = 0;
      addPopup('Order lost…', 400, 260, '#ff7a6b', 16);
    }
  }
}

// ---------------------------------------------------------------- actions

function startShift() {
  const fresh = createGameState((Math.random() * 1e9) | 0);
  Object.assign(state, fresh);
  state.mode = 'play';
}

function interactNearest() {
  const station = nearestStation(state.kitchen);
  if (!station) return;
  handleKitchenEvents(interact(state.kitchen, station, state.clock));
}

function handleClick(x, y) {
  if (state.mode === 'title') {
    startShift();
    return;
  }
  if (state.mode === 'over') return;
  if (state.mode !== 'play') return;
  const bin = pantryBinAt(x, y);
  if (bin >= 0) {
    state.kitchen.pantrySelected = bin;
    clickStation(state.kitchen, 'pantry');
    return;
  }
  const station = stationAt(x, y);
  if (station) {
    clickStation(state.kitchen, station);
    return;
  }
  clickMoveTo(state.kitchen, x, y);
}

function drainQueue() {
  for (const action of input.queue.splice(0)) {
    if (action.type === 'interact') {
      if (state.mode === 'play') interactNearest();
    } else if (action.type === 'start') {
      if (state.mode === 'title') startShift();
      else if (state.mode === 'over') startShift();
    } else if (action.type === 'restart') {
      if (state.mode === 'over' || state.mode === 'play') startShift();
    } else if (action.type === 'pause') {
      if (state.mode === 'play') state.mode = 'pause';
      else if (state.mode === 'pause') state.mode = 'play';
    } else if (action.type === 'mute') {
      state.muted = !state.muted;
      setMuted(state.muted);
    } else if (action.type === 'pantry') {
      state.kitchen.pantrySelected = action.index;
    } else if (action.type === 'click') {
      handleClick(action.x, action.y);
    }
  }
}

// ---------------------------------------------------------------- loop

let lastNow = performance.now();

function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - lastNow) / 1000));
  lastNow = now;
  state.clock += dt;

  if (state.mode === 'play') {
    state.shiftTime += dt;
    state.shiftLeft = Math.max(0, SHIFT_SECONDS - state.shiftTime);
    const inRush = state.shiftTime >= RUSH_START && state.shiftTime < RUSH_END;
    if (inRush && !state.rush) {
      state.rush = true;
      if (!state.rushAnnounced) {
        state.rushAnnounced = true;
        sfxRushBell();
        addPopup('RUSH HOUR!', CANVAS_W / 2, 300, '#ff8a7a', 34);
      }
    } else if (!inRush && state.rush) {
      state.rush = false;
    }
    drainQueue();
    moveChefByInput(state.kitchen, movementVector(input), dt);
    handleKitchenEvents(updateKitchen(state.kitchen, dt, state.clock));
    handleBoardEvents(updateOrderBoard(state.board, dt, state.shiftTime, state.rush));
    state.nearestStationName = nearestStation(state.kitchen);
    setSizzle(anythingCooking(state.kitchen));
    if (state.shiftLeft <= 0) {
      state.mode = 'over';
      setSizzle(false);
    }
  } else if (state.mode === 'title' || state.mode === 'over') {
    drainQueue();
  } else if (state.mode === 'pause') {
    drainQueue();
  }

  renderGame(ctx, state);
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- boot

if (shotName) {
  // Deterministic staged screenshot: freeze the scene and paint one frame.
  stageShot(state, shotName, seed);
  renderGame(ctx, state);
} else {
  requestAnimationFrame(frame);
}
