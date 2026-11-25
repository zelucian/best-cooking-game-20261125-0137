// render.js — every pixel of The Golden Skillet, drawn on one canvas: the
// kitchen, the food (all original vector art), the order board, the chef,
// the HUD and the title / pause / game-over screens. No images, no fonts
// loaded from anywhere: system fonts only.

import {
  CANVAS_H,
  CANVAS_W,
  FLOOR,
  HUD_H,
  INGREDIENTS,
  PANTRY_ORDER,
  RECIPES,
  STATIONS,
  burnerRect,
  itemLabel,
  pantryBinRect,
} from './config.js';
import { ticketPatienceLeft } from './orders.js';
import { nearestStation } from './kitchen.js';

// Warm diner palette.
const C = {
  wall: '#f6e7c8',
  wallTrim: '#e0c491',
  floorA: '#d9a05b',
  floorB: '#c98f4e',
  floorLine: '#b57e42',
  counter: '#8a5a33',
  counterTop: '#a9743f',
  counterEdge: '#6e4525',
  steel: '#b9c0c7',
  steelDark: '#8b939b',
  board: '#e8c98f',
  boardDark: '#c9a35e',
  cream: '#fff8e7',
  ink: '#3a2a1a',
  muted: '#7a6a55',
  red: '#d64541',
  green: '#5da24a',
  amber: '#e8a13c',
  plate: '#fdfdf8',
  serve: '#c94f43',
};

// ---------------------------------------------------------------- helpers

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function ellipse(ctx, x, y, rx, ry) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
}

function text(ctx, str, x, y, size, color, align = 'center', weight = '700') {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px Trebuchet MS, Verdana, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(str, x, y);
}

function shadowedText(ctx, str, x, y, size, color, align = 'center', weight = '800') {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.font = `${weight} ${size}px Trebuchet MS, Verdana, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(str, x + 2, y + 3);
  ctx.restore();
  text(ctx, str, x, y, size, color, align, weight);
}

// ---------------------------------------------------------------- food art

// One ingredient, drawn at (x, y) with size s (roughly its diameter).
// chopped: drawn as three little pieces; cooked/burnt: darker + grill marks.
export function drawIngredient(ctx, item, x, y, s) {
  const def = INGREDIENTS[item.id];
  if (item.chopped) {
    drawIngredientPiece(ctx, item.id, x - s * 0.28, y + s * 0.12, s * 0.42, def, item);
    drawIngredientPiece(ctx, item.id, x + s * 0.26, y + s * 0.14, s * 0.42, def, item);
    drawIngredientPiece(ctx, item.id, x, y - s * 0.22, s * 0.42, def, item);
    return;
  }
  drawIngredientPiece(ctx, item.id, x, y, s, def, item);
}

function drawIngredientPiece(ctx, id, x, y, s, def, item) {
  const r = s / 2;
  ctx.save();
  ctx.translate(x, y);
  if (item.burnt) {
    ctx.fillStyle = '#241d18';
    ellipse(ctx, 0, 0, r, r * 0.82);
    ctx.fill();
    ctx.fillStyle = '#3a2f26';
    ellipse(ctx, -r * 0.2, -r * 0.15, r * 0.5, r * 0.35);
    ctx.fill();
    ctx.restore();
    return;
  }
  if (id === 'bun') {
    ctx.fillStyle = def.dark;
    ellipse(ctx, 0, r * 0.18, r, r * 0.62);
    ctx.fill();
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.arc(0, r * 0.1, r, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff3c9';
    for (const [dx, dy] of [[-0.45, -0.45], [0, -0.62], [0.45, -0.45], [-0.2, -0.3], [0.25, -0.28]]) {
      ellipse(ctx, dx * r, dy * r, r * 0.09, r * 0.06);
      ctx.fill();
    }
  } else if (id === 'patty') {
    ctx.fillStyle = item.cooked ? '#6e3b22' : def.color;
    roundRect(ctx, -r, -r * 0.55, s, r * 1.1, r * 0.4);
    ctx.fill();
    if (item.cooked) {
      ctx.strokeStyle = '#4a2413';
      ctx.lineWidth = Math.max(1.5, r * 0.12);
      for (const dx of [-0.45, 0, 0.45]) {
        ctx.beginPath();
        ctx.moveTo(dx * r, -r * 0.45);
        ctx.lineTo(dx * r, r * 0.45);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ellipse(ctx, -r * 0.3, -r * 0.2, r * 0.45, r * 0.18);
      ctx.fill();
    }
  } else if (id === 'lettuce') {
    ctx.fillStyle = def.dark;
    ctx.beginPath();
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r * 0.8;
      if (i === 0) ctx.moveTo(px, py);
      else {
        const pa = ((i - 0.5) / 7) * Math.PI * 2;
        ctx.quadraticCurveTo(Math.cos(pa) * r * 1.25, Math.sin(pa) * r, px, py);
      }
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = def.color;
    ellipse(ctx, 0, 0, r * 0.72, r * 0.55);
    ctx.fill();
    ctx.strokeStyle = def.dark;
    ctx.lineWidth = Math.max(1, r * 0.08);
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.4);
    ctx.lineTo(0, r * 0.4);
    ctx.stroke();
  } else if (id === 'tomato') {
    ctx.fillStyle = def.color;
    ellipse(ctx, 0, 0, r, r * 0.9);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ellipse(ctx, -r * 0.3, -r * 0.3, r * 0.4, r * 0.25);
    ctx.fill();
    ctx.fillStyle = def.dark;
    ellipse(ctx, 0, -r * 0.55, r * 0.28, r * 0.16);
    ctx.fill();
  } else if (id === 'cucumber') {
    ctx.fillStyle = def.dark;
    ellipse(ctx, 0, 0, r, r * 0.9);
    ctx.fill();
    ctx.fillStyle = '#bfe8a8';
    ellipse(ctx, 0, 0, r * 0.72, r * 0.64);
    ctx.fill();
    ctx.fillStyle = def.color;
    ellipse(ctx, 0, 0, r * 0.4, r * 0.34);
    ctx.fill();
    ctx.fillStyle = '#eef7d8';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ellipse(ctx, Math.cos(a) * r * 0.18, Math.sin(a) * r * 0.16, r * 0.07, r * 0.07);
      ctx.fill();
    }
  } else if (id === 'pasta') {
    ctx.strokeStyle = def.color;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(2, r * 0.22);
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, r * (0.35 + i * 0.28), Math.PI * 0.15 + i * 0.4, Math.PI * 1.85 + i * 0.4);
      ctx.stroke();
    }
    ctx.strokeStyle = def.dark;
    ctx.lineWidth = Math.max(1.5, r * 0.12);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.6, 0.4, 2.2);
    ctx.stroke();
  } else if (id === 'cheese') {
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.moveTo(-r, r * 0.55);
    ctx.lineTo(r, r * 0.55);
    ctx.lineTo(0, -r * 0.75);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = def.dark;
    for (const [dx, dy] of [[-0.3, 0.15], [0.25, 0.25], [0.05, -0.25]]) {
      ellipse(ctx, dx * r, dy * r, r * 0.14, r * 0.14);
      ctx.fill();
    }
  }
  ctx.restore();
}

// A finished (or half-finished) plate: a white plate with the dish composed
// on it. Burgers stack into a real burger; anything else is laid out in a row.
export function drawPlateDish(ctx, items, x, y, scale = 1) {
  const s = 46 * scale;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ellipse(ctx, 0, 6 * scale, 34 * scale, 8 * scale);
  ctx.fill();
  ctx.fillStyle = C.plate;
  ellipse(ctx, 0, 0, 34 * scale, 12 * scale);
  ctx.fill();
  ctx.strokeStyle = '#d8d2c0';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#e8e2cf';
  ellipse(ctx, 0, -1 * scale, 24 * scale, 7 * scale);
  ctx.fill();

  const ids = items.map((i) => i.id);
  const isBurgerLike = ids.includes('bun') && ids.includes('patty');
  if (isBurgerLike) {
    // Stack, bottom to top: a flat bun base, then each filling wider than
    // the bun above it so every layer reads, then the bun dome on top.
    const layers = [{ kind: 'base', size: 62 * scale }];
    for (const id of ['patty', 'cheese', 'lettuce', 'tomato']) {
      const item = items.find((i) => i.id === id);
      if (item) layers.push({ kind: 'item', item, size: (id === 'patty' ? 80 : 58) * scale });
    }
    layers.push({ kind: 'dome', size: 52 * scale });
    layers.forEach((layer, level) => {
      const yy = -4 * scale - level * 9 * scale;
      if (layer.kind === 'base') {
        ctx.fillStyle = '#d99a3d';
        ellipse(ctx, 0, yy, 31 * scale, 7 * scale);
        ctx.fill();
      } else if (layer.kind === 'dome') {
        drawIngredient(ctx, { id: 'bun', chopped: false, cooked: false }, 0, yy - 8 * scale, layer.size);
      } else {
        drawIngredient(ctx, layer.item, 0, yy - 3 * scale, layer.size);
      }
    });
  } else if (items.length > 0) {
    const w = Math.min(56, 56 / items.length + 14);
    items.forEach((item, i) => {
      const offset = (i - (items.length - 1) / 2) * w;
      drawIngredient(ctx, item, offset, -8 * scale, 30 * scale);
    });
  }
  ctx.restore();
}

// ---------------------------------------------------------------- kitchen

function drawFloor(ctx) {
  ctx.fillStyle = C.wall;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  // Checkerboard floor tiles in the kitchen.
  const tile = 46;
  for (let ty = 0; ty < Math.ceil(FLOOR.h / tile); ty++) {
    for (let tx = 0; tx < Math.ceil(FLOOR.w / tile); tx++) {
      ctx.fillStyle = (tx + ty) % 2 === 0 ? C.floorA : C.floorB;
      ctx.fillRect(FLOOR.x + tx * tile, FLOOR.y + ty * tile, tile, tile);
    }
  }
  ctx.strokeStyle = C.floorLine;
  ctx.lineWidth = 1;
  for (let tx = 0; tx <= Math.ceil(FLOOR.w / tile); tx++) {
    ctx.beginPath();
    ctx.moveTo(FLOOR.x + tx * tile, FLOOR.y);
    ctx.lineTo(FLOOR.x + tx * tile, FLOOR.y + FLOOR.h);
    ctx.stroke();
  }
  for (let ty = 0; ty <= Math.ceil(FLOOR.h / tile); ty++) {
    ctx.beginPath();
    ctx.moveTo(FLOOR.x, FLOOR.y + ty * tile);
    ctx.lineTo(FLOOR.x + FLOOR.w, FLOOR.y + ty * tile);
    ctx.stroke();
  }
  // Wall trim around the kitchen.
  ctx.strokeStyle = C.wallTrim;
  ctx.lineWidth = 4;
  ctx.strokeRect(FLOOR.x - 2, FLOOR.y - 2, FLOOR.w + 4, FLOOR.h + 4);
}

function drawCounter(ctx, rect, label, highlight) {
  ctx.fillStyle = C.counterEdge;
  roundRect(ctx, rect.x, rect.y + 4, rect.w, rect.h, 10);
  ctx.fill();
  ctx.fillStyle = C.counterTop;
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h - 4, 10);
  ctx.fill();
  ctx.fillStyle = C.counter;
  roundRect(ctx, rect.x + 4, rect.y + 10, rect.w - 8, rect.h - 18, 8);
  ctx.fill();
  if (highlight) {
    ctx.strokeStyle = '#ffd23e';
    ctx.lineWidth = 4;
    roundRect(ctx, rect.x - 2, rect.y - 2, rect.w + 4, rect.h + 2, 12);
    ctx.stroke();
  }
  text(ctx, label, rect.x + rect.w / 2, rect.y + rect.h - 12, 11, '#f6e7c8', 'center', '800');
}

function drawPantry(ctx, kitchen, now) {
  const rect = STATIONS.pantry;
  drawCounter(ctx, rect, 'PANTRY — grab an ingredient  (keys 1-7)', nearestStation(kitchen) === 'pantry');
  PANTRY_ORDER.forEach((id, i) => {
    const bin = pantryBinRect(i);
    const cx = bin.x + bin.w / 2;
    const cy = bin.y + bin.h / 2 - 6;
    const selected = kitchen.pantrySelected === i;
    if (selected) {
      ctx.fillStyle = 'rgba(255,210,62,0.25)';
      roundRect(ctx, bin.x + 4, bin.y + 4, bin.w - 8, bin.h - 8, 8);
      ctx.fill();
      ctx.strokeStyle = '#ffd23e';
      ctx.lineWidth = 3;
      roundRect(ctx, bin.x + 4, bin.y + 4, bin.w - 8, bin.h - 8, 8);
      ctx.stroke();
    }
    // A little crate of the ingredient.
    ctx.fillStyle = '#7a4a22';
    roundRect(ctx, cx - 34, cy + 8, 68, 26, 6);
    ctx.fill();
    ctx.fillStyle = '#5d3717';
    ctx.fillRect(cx - 34, cy + 8, 68, 6);
    drawIngredient(ctx, { id, chopped: false, cooked: false }, cx, cy - 4, 52);
    text(ctx, INGREDIENTS[id].name, cx, bin.y + bin.h - 26, 12, '#f6e7c8');
    text(ctx, String(i + 1), bin.x + 12, bin.y + 14, 11, 'rgba(246,231,200,0.7)', 'left');
  });
  void now;
}

function drawBoard(ctx, kitchen) {
  const rect = STATIONS.board;
  drawCounter(ctx, rect, 'CHOPPING BOARD', nearestStation(kitchen) === 'board');
  const bx = rect.x + rect.w / 2;
  const by = rect.y + rect.h / 2 - 8;
  ctx.fillStyle = C.board;
  roundRect(ctx, bx - 72, by - 34, 144, 68, 8);
  ctx.fill();
  ctx.strokeStyle = C.boardDark;
  ctx.lineWidth = 3;
  roundRect(ctx, bx - 72, by - 34, 144, 68, 8);
  ctx.stroke();
  const board = kitchen.board;
  if (board.item) {
    drawIngredient(ctx, board.item, bx, by, 56);
    if (board.chopping) {
      // Chopping progress ring + a little knife.
      const p = board.progress / 0.9;
      ctx.strokeStyle = '#ffd23e';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(bx, by, 40, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2);
      ctx.stroke();
      const wobble = Math.sin(board.progress * 40) * 4;
      ctx.save();
      ctx.translate(bx + 34, by - 26 + wobble);
      ctx.rotate(-0.5);
      ctx.fillStyle = C.steel;
      roundRect(ctx, 0, -5, 34, 10, 4);
      ctx.fill();
      ctx.fillStyle = '#3a2a1a';
      roundRect(ctx, -14, -4, 16, 8, 3);
      ctx.fill();
      ctx.restore();
      // The ring + knife say "chopping"; no text here — the station label
      // sits just below and they used to collide.
    }
  } else {
    text(ctx, 'Bring something', bx, by - 8, 12, 'rgba(255,248,231,0.75)');
    text(ctx, 'to chop — E', bx, by + 10, 12, 'rgba(255,248,231,0.75)');
  }
}

function drawStove(ctx, kitchen) {
  const rect = STATIONS.stove;
  drawCounter(ctx, rect, 'STOVE — grill & boil', nearestStation(kitchen) === 'stove');
  for (let i = 0; i < 2; i++) {
    const b = burnerRect(i);
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    ctx.fillStyle = '#2e2a26';
    roundRect(ctx, b.x, b.y, b.w, b.h, 10);
    ctx.fill();
    ctx.fillStyle = '#4a4440';
    ellipse(ctx, cx, cy, b.w / 2 - 10, b.h / 2 - 8);
    ctx.fill();
    ctx.strokeStyle = '#6a625c';
    ctx.lineWidth = 2;
    ellipse(ctx, cx, cy, b.w / 2 - 10, b.h / 2 - 8);
    ctx.stroke();
    const burner = kitchen.burners[i];
    if (burner.item) {
      // Pan or pot under the food.
      ctx.fillStyle = i === 0 ? '#8b939b' : '#5d6b7a';
      ellipse(ctx, cx, cy + 6, b.w / 2 - 4, 12);
      ctx.fill();
      drawIngredient(ctx, burner.item, cx, cy - 4, 58);
      if (burner.state === 'cooking') {
        const total = burner.item.id === 'pasta' ? 10 : 8;
        const p = Math.min(1, burner.progress / total);
        ctx.strokeStyle = '#ffd23e';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(cx, cy, b.w / 2 - 2, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2);
        ctx.stroke();
        // Steam wisps.
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 2.5;
        const t = performance.now() / 500;
        for (let k = 0; k < 2; k++) {
          const sx = cx - 14 + k * 28;
          ctx.beginPath();
          ctx.moveTo(sx, cy - 30);
          ctx.quadraticCurveTo(sx + Math.sin(t + k * 2) * 6, cy - 44, sx, cy - 56);
          ctx.stroke();
        }
      } else if (burner.state === 'ready') {
        const blink = Math.sin(performance.now() / 180) > 0;
        text(ctx, blink ? 'READY!' : 'ready', cx, cy - 52, 14, '#ffd23e', 'center', '800');
      } else if (burner.state === 'burnt') {
        text(ctx, 'BURNT!', cx, cy - 52, 14, '#ff7a6b', 'center', '800');
      }
    } else {
      text(ctx, i === 0 ? 'Grill' : 'Pot', cx, cy - 4, 13, '#8b939b');
      text(ctx, 'empty', cx, cy + 16, 11, '#6a625c');
    }
  }
}

function drawPlating(ctx, kitchen) {
  const rect = STATIONS.plating;
  drawCounter(ctx, rect, 'PLATING — build the dish here', nearestStation(kitchen) === 'plating');
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2 - 6;
  drawPlateDish(ctx, kitchen.counterPlate.items, cx, cy + 10, 1.35);
  if (kitchen.counterPlate.items.length === 0) {
    text(ctx, 'Empty plate — add ingredients with E', cx, rect.y + 26, 12, 'rgba(255,248,231,0.7)');
  }
}

function drawServe(ctx, kitchen) {
  const rect = STATIONS.serve;
  const highlight = nearestStation(kitchen) === 'serve';
  ctx.fillStyle = '#7a2f28';
  roundRect(ctx, rect.x, rect.y + 4, rect.w, rect.h, 10);
  ctx.fill();
  ctx.fillStyle = C.serve;
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h - 4, 10);
  ctx.fill();
  if (highlight) {
    ctx.strokeStyle = '#ffd23e';
    ctx.lineWidth = 4;
    roundRect(ctx, rect.x - 2, rect.y - 2, rect.w + 4, rect.h + 2, 12);
    ctx.stroke();
  }
  // The pass window: a dark opening with a bell.
  ctx.fillStyle = '#3a2a1a';
  roundRect(ctx, rect.x + 16, rect.y + 12, rect.w - 32, 56, 8);
  ctx.fill();
  ctx.fillStyle = '#ffd23e';
  ellipse(ctx, rect.x + rect.w - 40, rect.y + 30, 12, 10);
  ctx.fill();
  ctx.fillStyle = '#b97a28';
  ctx.fillRect(rect.x + rect.w - 44, rect.y + 38, 8, 6);
  text(ctx, 'SERVE WINDOW  —  ring the bell with a finished plate', rect.x + rect.w / 2, rect.y + rect.h - 14, 12, '#ffe9c9', 'center', '800');
}

function drawTrash(ctx, kitchen) {
  const rect = STATIONS.trash;
  drawCounter(ctx, rect, 'TRASH', nearestStation(kitchen) === 'trash');
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2 - 6;
  ctx.fillStyle = '#5d6b7a';
  roundRect(ctx, cx - 26, cy - 22, 52, 48, 6);
  ctx.fill();
  ctx.fillStyle = '#48545f';
  roundRect(ctx, cx - 30, cy - 28, 60, 10, 5);
  ctx.fill();
  ctx.strokeStyle = '#39434c';
  ctx.lineWidth = 3;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(cx + i * 14, cy - 14);
    ctx.lineTo(cx + i * 14, cy + 18);
    ctx.stroke();
  }
}

// ---------------------------------------------------------------- chef

function drawChef(ctx, kitchen, now) {
  const chef = kitchen.chef;
  const bob = chef.moving ? Math.sin(chef.walkPhase) * 3 : Math.sin(now * 2) * 1.2;
  const x = chef.x;
  const y = chef.y + bob * 0.4;
  ctx.save();
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ellipse(ctx, x, chef.y + 24, 24, 7);
  ctx.fill();
  // Body: white chef coat.
  ctx.fillStyle = '#fdfdf8';
  ellipse(ctx, x, y + 8, 22, 20);
  ctx.fill();
  ctx.strokeStyle = '#d8d2c0';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Apron.
  ctx.fillStyle = '#7fb3d5';
  roundRect(ctx, x - 12, y + 2, 24, 22, 6);
  ctx.fill();
  // Head.
  ctx.fillStyle = '#f2c79b';
  ellipse(ctx, x, y - 14, 15, 14);
  ctx.fill();
  // Chef hat.
  ctx.fillStyle = '#ffffff';
  ellipse(ctx, x - 9, y - 26, 9, 8);
  ctx.fill();
  ellipse(ctx, x + 9, y - 26, 9, 8);
  ctx.fill();
  ellipse(ctx, x, y - 30, 12, 9);
  ctx.fill();
  ctx.fillStyle = '#e8e2cf';
  ctx.fillRect(x - 14, y - 26, 28, 5);
  // Eyes look the way the chef faces.
  ctx.fillStyle = '#3a2a1a';
  ellipse(ctx, x - 5 + chef.dir * 2, y - 15, 1.8, 2.6);
  ctx.fill();
  ellipse(ctx, x + 5 + chef.dir * 2, y - 15, 1.8, 2.6);
  ctx.fill();
  // Feet.
  ctx.fillStyle = '#3a2a1a';
  ellipse(ctx, x - 9, y + 26 + (chef.moving ? Math.sin(chef.walkPhase) * 2 : 0), 7, 4);
  ctx.fill();
  ellipse(ctx, x + 9, y + 26 - (chef.moving ? Math.sin(chef.walkPhase) * 2 : 0), 7, 4);
  ctx.fill();
  // What the chef carries, held high.
  const hands = kitchen.hands;
  if (hands) {
    const hy = y - 52 + Math.sin(now * 3) * 2;
    if (hands.kind === 'plate') {
      drawPlateDish(ctx, hands.items, x, hy + 6, 0.9);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ellipse(ctx, x, hy, 24, 16);
      ctx.fill();
      drawIngredient(ctx, hands.item, x, hy, 40);
    }
  }
  // Click-to-move marker.
  if (kitchen.moveTarget) {
    const t = kitchen.moveTarget;
    ctx.strokeStyle = 'rgba(255,210,62,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(t.x, t.y, 10 + Math.sin(now * 6) * 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(t.x - 14, t.y);
    ctx.lineTo(t.x + 14, t.y);
    ctx.moveTo(t.x, t.y - 14);
    ctx.lineTo(t.x, t.y + 14);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- order board

function drawOrderBoard(ctx, board, now) {
  const x = 12;
  const w = 264;
  ctx.fillStyle = '#5d3a1e';
  roundRect(ctx, x, HUD_H + 12, w, CANVAS_H - HUD_H - 24, 12);
  ctx.fill();
  ctx.fillStyle = '#7a4a22';
  roundRect(ctx, x + 4, HUD_H + 16, w - 8, CANVAS_H - HUD_H - 32, 10);
  ctx.fill();
  text(ctx, '— ORDER BOARD —', x + w / 2, HUD_H + 36, 15, '#ffd23e', 'center', '800');
  text(ctx, `${board.served} served · ${board.lost} lost`, x + w / 2, HUD_H + 58, 12, '#f6e7c8');

  if (board.tickets.length === 0) {
    text(ctx, 'No orders yet.', x + w / 2, HUD_H + 140, 14, '#f6e7c8');
    text(ctx, 'Tickets pin up here', x + w / 2, HUD_H + 164, 12, 'rgba(246,231,200,0.7)');
    text(ctx, 'when diners sit down.', x + w / 2, HUD_H + 182, 12, 'rgba(246,231,200,0.7)');
  }

  board.tickets.forEach((ticket, i) => {
    const ty = HUD_H + 76 + i * 128;
    const left = ticketPatienceLeft(ticket, now);
    const recipe = RECIPES[ticket.recipeId];
    const urgent = left < 0.25;
    const flash = urgent && Math.sin(now * 8) > 0;
    ctx.fillStyle = flash ? '#fff3c9' : C.cream;
    roundRect(ctx, x + 10, ty, w - 20, 116, 10);
    ctx.fill();
    ctx.strokeStyle = urgent ? C.red : '#d8c9a3';
    ctx.lineWidth = urgent ? 3 : 2;
    roundRect(ctx, x + 10, ty, w - 20, 116, 10);
    ctx.stroke();
    // Ticket number + price.
    ctx.fillStyle = C.red;
    ellipse(ctx, x + 32, ty + 18, 13, 13);
    ctx.fill();
    text(ctx, String(ticket.id), x + 32, ty + 18, 13, '#fff', 'center', '800');
    text(ctx, recipe.name, x + 52, ty + 18, 15, C.ink, 'left', '800');
    text(ctx, `${recipe.price}c`, x + w - 24, ty + 18, 13, '#8a6d1f', 'right', '800');
    // Ingredients, in the order they are needed.
    recipe.items.forEach((item, j) => {
      const ix = x + 36 + j * 56;
      drawIngredient(ctx, item, ix, ty + 56, 44);
      text(ctx, itemLabel(item).replace('Chopped ', '').replace('Grilled ', ''), ix, ty + 86, 10, C.muted, 'center', '700');
    });
    // Patience bar.
    const barX = x + 22;
    const barW = w - 44;
    ctx.fillStyle = '#e0d5bd';
    roundRect(ctx, barX, ty + 100, barW, 9, 4);
    ctx.fill();
    const barColor = left > 0.5 ? C.green : left > 0.25 ? C.amber : C.red;
    ctx.fillStyle = barColor;
    if (left > 0) {
      roundRect(ctx, barX, ty + 100, Math.max(8, barW * left), 9, 4);
      ctx.fill();
    }
  });
}

// ---------------------------------------------------------------- HUD

function formatTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

function drawHud(ctx, state) {
  ctx.fillStyle = '#3a2a1a';
  ctx.fillRect(0, 0, CANVAS_W, HUD_H);
  ctx.fillStyle = '#5d3a1e';
  ctx.fillRect(0, HUD_H - 4, CANVAS_W, 4);

  text(ctx, 'THE GOLDEN SKILLET', 16, 22, 20, '#ffd23e', 'left', '800');
  text(ctx, 'a tiny diner · a big shift', 16, 46, 12, '#f6e7c8', 'left', '600');

  // Shift timer, centre, with a ring that drains. The ring sits clear of
  // the label underneath it.
  const remain = Math.max(0, state.shiftLeft);
  const total = state.shiftTotal;
  const cx = CANVAS_W / 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(cx, 30, 21, 0, Math.PI * 2);
  ctx.stroke();
  const frac = total > 0 ? remain / total : 0;
  ctx.strokeStyle = state.rush ? C.red : '#ffd23e';
  ctx.beginPath();
  ctx.arc(cx, 30, 21, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
  ctx.stroke();
  text(ctx, formatTime(remain), cx, 30, 15, '#fff', 'center', '800');
  text(ctx, state.rush ? 'RUSH HOUR' : 'SHIFT', cx, 58, 9, state.rush ? '#ff8a7a' : '#f6e7c8', 'center', '800');

  // Coins, served, combo — right side.
  const right = CANVAS_W - 16;
  ctx.fillStyle = '#ffd23e';
  ellipse(ctx, right - 62, 20, 10, 10);
  ctx.fill();
  ctx.fillStyle = '#b97a28';
  text(ctx, '¢', right - 62, 20, 13, '#b97a28', 'center', '800');
  text(ctx, `${state.coins}`, right - 46, 20, 18, '#ffd23e', 'left', '800');
  text(ctx, `${state.servedCount} served`, right - 150, 20, 14, '#fff8e7', 'right', '700');
  if (state.combo > 1) {
    const mult = (1 + (state.combo - 1) * 0.1).toFixed(1);
    text(ctx, `COMBO x${mult}  (${state.combo} in a row)`, right, 46, 13, '#ff9d5c', 'right', '800');
  } else {
    text(ctx, 'serve fast to build a combo', right, 46, 12, '#b9a98a', 'right', '600');
  }

  // Rush banner across the open strip between the pantry and the stations,
  // where it covers nothing.
  if (state.rush) {
    const pulse = 0.75 + Math.sin(state.clock * 6) * 0.25;
    ctx.fillStyle = `rgba(214,69,65,${pulse})`;
    roundRect(ctx, 296, 184, 776, 24, 8);
    ctx.fill();
    text(ctx, 'RUSH HOUR — orders are pouring in!', 296 + 388, 196, 14, '#fff', 'center', '800');
  }
}

// ---------------------------------------------------------------- popups & notices

function drawPopups(ctx, state) {
  for (const p of state.popups) {
    const age = state.clock - p.bornAt;
    if (age < 0 || age > 1.6) continue;
    const y = p.y - age * 46;
    const alpha = age < 1.2 ? 1 : 1 - (age - 1.2) / 0.4;
    ctx.save();
    ctx.globalAlpha = alpha;
    shadowedText(ctx, p.text, p.x, y, p.size || 22, p.color || '#ffd23e');
    ctx.restore();
  }
  const notice = state.kitchen.notice;
  if (notice && state.clock - notice.at < 1.8) {
    const chef = state.kitchen.chef;
    ctx.save();
    ctx.globalAlpha = Math.min(1, (1.8 - (state.clock - notice.at)) / 0.4);
    ctx.fillStyle = 'rgba(58,42,26,0.92)';
    const w = ctx.measureText(notice.text).width + 28;
    roundRect(ctx, chef.x - w / 2, chef.y - 96, w, 30, 8);
    ctx.fill();
    text(ctx, notice.text, chef.x, chef.y - 81, 14, '#fff8e7');
    ctx.restore();
  }
  // Interaction hint: what E does at the nearest station.
  if (state.mode === 'play') {
    const station = state.nearestStationName;
    if (station) {
      const label = {
        pantry: 'E — grab ingredient',
        board: 'E — chop / pick up',
        stove: 'E — cook / pick up',
        plating: 'E — plate / pick up plate',
        serve: 'E — serve the plate',
        trash: 'E — throw away',
      }[station];
      text(ctx, label, CANVAS_W / 2, CANVAS_H - 14, 13, 'rgba(58,42,26,0.75)', 'center', '700');
    }
  }
}

// ---------------------------------------------------------------- screens

function drawTitle(ctx, state) {
  ctx.fillStyle = 'rgba(43,30,16,0.72)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  shadowedText(ctx, 'THE GOLDEN SKILLET', CANVAS_W / 2, 150, 64, '#ffd23e');
  text(ctx, 'a tiny diner · a big shift', CANVAS_W / 2, 200, 22, '#fff8e7', 'center', '600');
  text(ctx, 'Take orders, chop, grill and plate — serve every diner before their patience runs out.', CANVAS_W / 2, 240, 17, '#f6e7c8');

  // Menu cards: the four dishes.
  const cards = [
    { id: 'burger', x: 190 },
    { id: 'salad', x: 430 },
    { id: 'pasta', x: 670 },
    { id: 'melt', x: 910 },
  ];
  for (const card of cards) {
    const recipe = RECIPES[card.id];
    ctx.fillStyle = C.cream;
    roundRect(ctx, card.x, 290, 200, 170, 12);
    ctx.fill();
    ctx.strokeStyle = '#d8c9a3';
    ctx.lineWidth = 2;
    roundRect(ctx, card.x, 290, 200, 170, 12);
    ctx.stroke();
    drawPlateDish(ctx, recipe.items, card.x + 100, 350, 1.1);
    text(ctx, recipe.name, card.x + 100, 408, 15, C.ink, 'center', '800');
    text(ctx, `${recipe.price} coins`, card.x + 100, 432, 13, '#8a6d1f', 'center', '700');
  }

  const blink = Math.sin(state.clock * 4) > -0.6;
  if (blink) shadowedText(ctx, 'PRESS ENTER OR CLICK TO START', CANVAS_W / 2, 520, 26, '#fff');
  text(ctx, 'Move: WASD / arrows · Interact: E or Space · Click a station to walk there', CANVAS_W / 2, 566, 15, '#f6e7c8');
  text(ctx, 'Pantry 1–7 picks an ingredient · M mutes · P pauses · Esc pauses', CANVAS_W / 2, 592, 15, '#f6e7c8');
  text(ctx, 'Rush hour hits mid-shift: orders arrive twice as fast.', CANVAS_W / 2, 626, 14, '#ff9d5c', 'center', '700');
}

function drawPause(ctx) {
  ctx.fillStyle = 'rgba(43,30,16,0.6)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  shadowedText(ctx, 'PAUSED', CANVAS_W / 2, CANVAS_H / 2 - 20, 52, '#fff8e7');
  text(ctx, 'Press P or Esc to keep cooking', CANVAS_W / 2, CANVAS_H / 2 + 30, 17, '#f6e7c8');
}

function drawGameOver(ctx, state) {
  ctx.fillStyle = 'rgba(43,30,16,0.78)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  shadowedText(ctx, 'SHIFT OVER!', CANVAS_W / 2, 170, 56, '#ffd23e');
  text(ctx, `You served ${state.servedCount} diners and earned ${state.coins} coins.`, CANVAS_W / 2, 230, 20, '#fff8e7');
  text(ctx, `${state.board.lost} orders walked out · best combo ${state.bestCombo} in a row`, CANVAS_W / 2, 262, 16, '#f6e7c8');
  const verdict =
    state.servedCount >= 14
      ? 'Head-chef material. The diner is yours.'
      : state.servedCount >= 8
        ? 'A solid shift — the regulars will be back.'
        : 'A tough shift. Tomorrow the pans are yours again.';
  text(ctx, verdict, CANVAS_W / 2, 300, 17, '#ff9d5c', 'center', '700');
  shadowedText(ctx, 'PRESS R TO COOK AGAIN', CANVAS_W / 2, 380, 26, '#fff');
}

// ---------------------------------------------------------------- main render

export function renderGame(ctx, state) {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  drawFloor(ctx);
  drawPantry(ctx, state.kitchen, state.clock);
  drawBoard(ctx, state.kitchen);
  drawStove(ctx, state.kitchen);
  drawPlating(ctx, state.kitchen);
  drawServe(ctx, state.kitchen);
  drawTrash(ctx, state.kitchen);
  drawOrderBoard(ctx, state.board, state.shiftTime);
  drawChef(ctx, state.kitchen, state.clock);
  drawHud(ctx, state);
  drawPopups(ctx, state);
  if (state.mode === 'title') drawTitle(ctx, state);
  else if (state.mode === 'pause') drawPause(ctx);
  else if (state.mode === 'over') drawGameOver(ctx, state);
}
