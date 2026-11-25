// config.js — every constant of The Golden Skillet: canvas, stations, ingredients, recipes.
// Nothing here touches the DOM; kitchen.js and orders.js read this to build the game.

export const CANVAS_W = 1280;
export const CANVAS_H = 800;

export const HUD_H = 64;

// A full shift lasts three minutes of play. The middle minute is rush hour.
export const SHIFT_SECONDS = 180;
export const RUSH_START = 60;
export const RUSH_END = 120;

// Order pacing: seconds between new tickets, calm vs rush.
export const ORDER_INTERVAL_CALM = 13;
export const ORDER_INTERVAL_RUSH = 6.5;
export const MAX_TICKETS = 5;
export const TICKET_PATIENCE = 60;

// Chopping and cooking times, in seconds.
export const CHOP_SECONDS = 0.9;
export const PATTY_COOK_SECONDS = 8;
export const PATTY_BURN_SECONDS = 15;
export const PASTA_COOK_SECONDS = 10;
export const PASTA_BURN_SECONDS = 17;

// Combo: serving within this many seconds of the last serve keeps the streak alive.
export const COMBO_WINDOW = 20;
export const COMBO_STEP = 0.1;
export const COMBO_CAP = 2.0;

// ---------------------------------------------------------------- ingredients

// kind: what the item is. chop: it can be chopped at the board. cook: it cooks
// on the stove ('grill' or 'pot'). cookedFrom: the item a raw one becomes.
export const INGREDIENTS = {
  bun:      { name: 'Bun',        color: '#e8a94e', dark: '#b97a28', chop: false, cook: null,   price: 10 },
  patty:    { name: 'Patty',      color: '#c65a4a', dark: '#8e3527', chop: false, cook: 'grill', price: 25 },
  lettuce:  { name: 'Lettuce',    color: '#7dc24a', dark: '#4d8a26', chop: true,  cook: null,   price: 8 },
  tomato:   { name: 'Tomato',     color: '#e5484d', dark: '#a92c30', chop: true,  cook: null,   price: 10 },
  cucumber: { name: 'Cucumber',   color: '#5fb878', dark: '#2f7d4a', chop: true,  cook: null,   price: 8 },
  pasta:    { name: 'Pasta',      color: '#f2c14e', dark: '#c08a1e', chop: false, cook: 'pot',   price: 15 },
  cheese:   { name: 'Cheese',     color: '#ffd23e', dark: '#d9a400', chop: false, cook: null,   price: 12 },
};

// The pantry bins, left to right across the top counter.
export const PANTRY_ORDER = ['bun', 'patty', 'lettuce', 'tomato', 'cucumber', 'pasta', 'cheese'];

// A chopped item keeps its id with a "chopped " prefix in the name; a cooked
// item is the same id with cooked: true. The helpers below normalise both.
export function itemLabel(item) {
  if (!item) return '';
  const base = INGREDIENTS[item.id].name;
  if (item.cooked) return `Grilled ${base}`;
  if (item.chopped) return `Chopped ${base}`;
  return base;
}

// Two item lists match when they hold the same ids with the same cooked/chopped
// flags, in any order.
export function itemsMatch(a, b) {
  if (a.length !== b.length) return false;
  const key = (it) => `${it.id}|${it.chopped ? 1 : 0}|${it.cooked ? 1 : 0}`;
  const sorted = (list) => list.map(key).sort().join(',');
  return sorted(a) === sorted(b);
}

// ---------------------------------------------------------------- recipes

// Each recipe is a dish: the items a plate must hold, in any order, and its
// base price in coins. Steps are derived from the items (chop, grill, boil).
export const RECIPES = {
  burger: {
    name: 'Classic Burger',
    short: 'Burger',
    price: 100,
    items: [
      { id: 'bun', chopped: false, cooked: false },
      { id: 'patty', chopped: false, cooked: true },
      { id: 'lettuce', chopped: true, cooked: false },
      { id: 'tomato', chopped: true, cooked: false },
    ],
  },
  salad: {
    name: 'Garden Salad',
    short: 'Salad',
    price: 80,
    items: [
      { id: 'lettuce', chopped: true, cooked: false },
      { id: 'tomato', chopped: true, cooked: false },
      { id: 'cucumber', chopped: true, cooked: false },
    ],
  },
  pasta: {
    name: 'Tomato Pasta',
    short: 'Pasta',
    price: 90,
    items: [
      { id: 'pasta', chopped: false, cooked: true },
      { id: 'tomato', chopped: true, cooked: false },
    ],
  },
  melt: {
    name: 'Cheese Melt Burger',
    short: 'Cheese Melt',
    price: 120,
    items: [
      { id: 'bun', chopped: false, cooked: false },
      { id: 'patty', chopped: false, cooked: true },
      { id: 'cheese', chopped: false, cooked: false },
      { id: 'lettuce', chopped: true, cooked: false },
    ],
  },
};

export const RECIPE_ORDER = ['burger', 'salad', 'pasta', 'melt'];

// ---------------------------------------------------------------- stations

// Station rectangles on the kitchen floor (canvas coordinates). The order
// board lives on the left; the kitchen occupies the rest.
export const STATIONS = {
  pantry:  { x: 296,  y: 76,  w: 972, h: 104, label: 'PANTRY' },
  board:   { x: 1088, y: 208, w: 180, h: 122, label: 'CHOPPING BOARD' },
  stove:   { x: 1088, y: 358, w: 180, h: 202, label: 'STOVE' },
  plating: { x: 296,  y: 648, w: 404, h: 120, label: 'PLATING' },
  serve:   { x: 724,  y: 648, w: 288, h: 120, label: 'SERVE WINDOW' },
  trash:   { x: 1036, y: 648, w: 140, h: 120, label: 'TRASH' },
};

// The floor the chef can walk on: everything inside the kitchen walls except
// the station rectangles.
export const FLOOR = { x: 288, y: 76, w: 980, h: 692 };

// Pantry bins are slices of the pantry counter, one per ingredient.
export function pantryBinRect(index) {
  const s = STATIONS.pantry;
  const n = PANTRY_ORDER.length;
  const w = s.w / n;
  return { x: s.x + index * w, y: s.y, w, h: s.h };
}

// The stove's two burners, left and right.
export function burnerRect(index) {
  const s = STATIONS.stove;
  const w = s.w / 2;
  return { x: s.x + index * w + 14, y: s.y + 52, w: w - 28, h: 108 };
}

// Where the chef starts a shift.
export const CHEF_START = { x: 700, y: 430 };
export const CHEF_RADIUS = 22;
export const CHEF_SPEED = 300;
