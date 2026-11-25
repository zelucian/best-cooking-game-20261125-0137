// kitchen.js — the kitchen itself: the chef, the stations, and everything the
// player does with their hands. Pure logic, no DOM and no drawing; main.js
// turns the events it returns into sounds, popups and score.

import {
  CHEF_RADIUS,
  CHEF_SPEED,
  CHEF_START,
  CHOP_SECONDS,
  FLOOR,
  INGREDIENTS,
  PANTRY_ORDER,
  PASTA_BURN_SECONDS,
  PASTA_COOK_SECONDS,
  PATTY_BURN_SECONDS,
  PATTY_COOK_SECONDS,
  STATIONS,
  pantryBinRect,
} from './config.js';

export function createKitchen() {
  return {
    chef: { x: CHEF_START.x, y: CHEF_START.y, dir: 1, moving: false, walkPhase: 0 },
    // Where a click told the chef to walk: the waypoints of the route, the
    // final one in moveTarget, and the station to use on arrival (or null).
    movePath: [],
    moveTarget: null,
    moveTargetStation: null,
    moveStuckTime: 0,
    moveLastDist: Infinity,
    // What the chef carries: null, {kind:'item', item} or {kind:'plate', items}.
    hands: null,
    pantrySelected: 0,
    // The chopping board: {item, progress, chopping} or {item: null}.
    board: { item: null, progress: 0, chopping: false },
    // Two burners: {item, progress, state} where state is
    // 'empty' | 'cooking' | 'ready' | 'burnt'.
    burners: [
      { item: null, progress: 0, state: 'empty' },
      { item: null, progress: 0, state: 'empty' },
    ],
    // The plate resting on the plating counter.
    counterPlate: { items: [] },
    // Last rejected action, for a shake/toast: {text, at} or null.
    notice: null,
  };
}

// ---------------------------------------------------------------- geometry

function rectsOverlapCircle(cx, cy, r, rect) {
  const nx = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const ny = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

function stationRects() {
  return Object.values(STATIONS);
}

// Is (x, y) a walkable spot for the chef's centre, with clearance r?
function walkableR(x, y, r) {
  if (x < FLOOR.x + r || x > FLOOR.x + FLOOR.w - r) return false;
  if (y < FLOOR.y + r || y > FLOOR.y + FLOOR.h - r) return false;
  for (const rect of stationRects()) {
    if (rectsOverlapCircle(x, y, r, rect)) return false;
  }
  return true;
}

// Is (x, y) a walkable spot for the chef's centre?
function walkable(x, y) {
  return walkableR(x, y, CHEF_RADIUS);
}

// The nearest station to the chef, within reach (48px beyond its edge).
export function nearestStation(kitchen) {
  const { x, y } = kitchen.chef;
  let best = null;
  let bestDist = Infinity;
  for (const [name, rect] of Object.entries(STATIONS)) {
    const nx = Math.max(rect.x, Math.min(x, rect.x + rect.w));
    const ny = Math.max(rect.y, Math.min(y, rect.y + rect.h));
    const d = Math.hypot(x - nx, y - ny);
    if (d < bestDist) {
      bestDist = d;
      best = name;
    }
  }
  return bestDist <= 48 ? best : null;
}

// A point just outside a station's edge, closest to the chef: where the chef
// stands to use it. The counters sit edge to edge (plating against serve,
// serve against trash, board against stove), so the side the chef is on is
// often inside the next counter: try all four sides and take the nearest
// one the chef can actually stand on.
export function stationApproachPoint(kitchen, stationName) {
  const rect = STATIONS[stationName];
  const { x, y } = kitchen.chef;
  const candidates = [
    { x: rect.x - CHEF_RADIUS - 4, y: Math.max(rect.y + 10, Math.min(y, rect.y + rect.h - 10)) },
    { x: rect.x + rect.w + CHEF_RADIUS + 4, y: Math.max(rect.y + 10, Math.min(y, rect.y + rect.h - 10)) },
    { x: Math.max(rect.x + 10, Math.min(x, rect.x + rect.w - 10)), y: rect.y - CHEF_RADIUS - 4 },
    { x: Math.max(rect.x + 10, Math.min(x, rect.x + rect.w - 10)), y: rect.y + rect.h + CHEF_RADIUS + 4 },
  ];
  const standable = candidates.filter((p) => walkable(p.x, p.y));
  const pool = standable.length > 0 ? standable : candidates;
  let best = pool[0];
  let bestDist = Infinity;
  for (const p of pool) {
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  }
  return best;
}

// ---------------------------------------------------------------- pathfinding

// Click-to-move walks a real route: the counters leave only narrow passages
// (west of the board/stove, the strip above the bottom counters), so a
// straight line to a station often runs through a counter and the chef would
// stall against it forever. BFS on a coarse grid over the floor, with every
// leg verified clear, finds a route around them.
const PATH_GRID = 24;

function segmentClear(x0, y0, x1, y1) {
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.ceil(dist / 6));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (!walkable(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false;
  }
  return true;
}

function gridCols() {
  return Math.ceil(FLOOR.w / PATH_GRID);
}

function gridRows() {
  return Math.ceil(FLOOR.h / PATH_GRID);
}

function cellCenter(gx, gy) {
  return { x: FLOOR.x + gx * PATH_GRID + PATH_GRID / 2, y: FLOOR.y + gy * PATH_GRID + PATH_GRID / 2 };
}

function cellAt(x, y) {
  return {
    gx: Math.max(0, Math.min(gridCols() - 1, Math.floor((x - FLOOR.x) / PATH_GRID))),
    gy: Math.max(0, Math.min(gridRows() - 1, Math.floor((y - FLOOR.y) / PATH_GRID))),
  };
}

function cellWalkable(gx, gy) {
  const p = cellCenter(gx, gy);
  return walkable(p.x, p.y);
}

// Route from (sx, sy) to (tx, ty): a list of waypoints ending at the target.
// Falls back to [target] when no grid route exists (the caller then walks
// straight at it, as before).
export function findPath(sx, sy, tx, ty) {
  const start = cellAt(sx, sy);
  // The target's own cell centre may sit inside a counter even when the
  // target itself is standable, so end at the nearest walkable cell with a
  // clear line to the target.
  let end = null;
  let endDist = Infinity;
  for (let gy = 0; gy < gridRows(); gy++) {
    for (let gx = 0; gx < gridCols(); gx++) {
      if (!cellWalkable(gx, gy)) continue;
      const p = cellCenter(gx, gy);
      const d = Math.hypot(p.x - tx, p.y - ty);
      if (d < endDist && segmentClear(p.x, p.y, tx, ty)) {
        endDist = d;
        end = { gx, gy };
      }
    }
  }
  if (!end) return [{ x: tx, y: ty }];
  const key = (gx, gy) => gy * gridCols() + gx;
  const prev = new Map();
  const seen = new Set([key(start.gx, start.gy)]);
  const queue = [{ gx: start.gx, gy: start.gy }];
  let found = false;
  while (queue.length > 0) {
    const cur = queue.shift();
    if (cur.gx === end.gx && cur.gy === end.gy) {
      found = true;
      break;
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cur.gx + dx;
      const ny = cur.gy + dy;
      if (nx < 0 || ny < 0 || nx >= gridCols() || ny >= gridRows()) continue;
      if (seen.has(key(nx, ny)) || !cellWalkable(nx, ny)) continue;
      const a = cellCenter(cur.gx, cur.gy);
      const b = cellCenter(nx, ny);
      if (!segmentClear(a.x, a.y, b.x, b.y)) continue;
      seen.add(key(nx, ny));
      prev.set(key(nx, ny), cur);
      queue.push({ gx: nx, gy: ny });
    }
  }
  if (!found) return [{ x: tx, y: ty }];
  const cells = [];
  let cur = end;
  while (!(cur.gx === start.gx && cur.gy === start.gy)) {
    cells.unshift(cur);
    cur = prev.get(key(cur.gx, cur.gy));
  }
  const points = cells.map((c) => cellCenter(c.gx, c.gy));
  points.push({ x: tx, y: ty });
  // Smooth: from each waypoint, jump to the furthest later one with a clear
  // line, so the chef walks straight diagonals instead of grid zig-zags.
  const smooth = [];
  let i = 0;
  const from = { x: sx, y: sy };
  while (i < points.length) {
    let j = points.length - 1;
    const base = smooth.length > 0 ? smooth[smooth.length - 1] : from;
    while (j > i && !segmentClear(base.x, base.y, points[j].x, points[j].y)) j--;
    smooth.push(points[j]);
    i = j + 1;
  }
  return smooth;
}

// Set the chef walking: waypoints from findPath, plus the station to use
// on arrival (or null for a plain floor click).
function startRoute(kitchen, target, station) {
  const path = findPath(kitchen.chef.x, kitchen.chef.y, target.x, target.y);
  kitchen.movePath = path;
  kitchen.moveTarget = path[path.length - 1];
  kitchen.moveTargetStation = station || null;
  kitchen.moveStuckTime = 0;
  kitchen.moveLastDist = Infinity;
}

// ---------------------------------------------------------------- movement

// Move the chef by (dx, dy) for dt seconds, sliding along counters.
function moveChef(kitchen, dx, dy, dt) {
  const chef = kitchen.chef;
  const nx = chef.x + dx * CHEF_SPEED * dt;
  const ny = chef.y + dy * CHEF_SPEED * dt;
  if (walkable(nx, chef.y)) chef.x = nx;
  if (walkable(chef.x, ny)) chef.y = ny;
  const moved = Math.abs(dx) + Math.abs(dy) > 0;
  chef.moving = moved;
  if (moved) {
    if (dx !== 0) chef.dir = dx > 0 ? 1 : -1;
    chef.walkPhase += dt * 10;
  }
}

// Walk along the route's waypoints; returns true when the final one is
// reached. If the chef stops making progress toward a waypoint (wedged on
// a corner the grid did not see), drop that waypoint and carry on.
function walkToTarget(kitchen, dt) {
  if (kitchen.movePath.length === 0) return false;
  const target = kitchen.movePath[0];
  const chef = kitchen.chef;
  const dx = target.x - chef.x;
  const dy = target.y - chef.y;
  const dist = Math.hypot(dx, dy);
  if (dist < kitchen.moveLastDist - 0.5) {
    kitchen.moveStuckTime = 0;
  } else {
    kitchen.moveStuckTime += dt;
  }
  kitchen.moveLastDist = dist;
  if (kitchen.moveStuckTime > 1.5) {
    // Wedged: skip this waypoint. The route or the arrival below still
    // stands, so the walk ends instead of stalling forever.
    kitchen.movePath.shift();
    kitchen.moveStuckTime = 0;
    kitchen.moveLastDist = Infinity;
    if (kitchen.movePath.length === 0) {
      kitchen.moveTarget = null;
      chef.moving = false;
      return true;
    }
    return false;
  }
  if (dist < 6) {
    kitchen.movePath.shift();
    kitchen.moveLastDist = Infinity;
    kitchen.moveStuckTime = 0;
    if (kitchen.movePath.length === 0) {
      kitchen.moveTarget = null;
      chef.moving = false;
      return true;
    }
    return false;
  }
  moveChef(kitchen, dx / dist, dy / dist, dt);
  return false;
}

// ---------------------------------------------------------------- hands

function handsItem(kitchen) {
  return kitchen.hands && kitchen.hands.kind === 'item' ? kitchen.hands.item : null;
}

function handsPlate(kitchen) {
  return kitchen.hands && kitchen.hands.kind === 'plate' ? kitchen.hands : null;
}

function setNotice(kitchen, text, now) {
  kitchen.notice = { text, at: now };
}

// ---------------------------------------------------------------- cooking times

function cookSeconds(item) {
  return item.id === 'pasta' ? PASTA_COOK_SECONDS : PATTY_COOK_SECONDS;
}

function burnSeconds(item) {
  return item.id === 'pasta' ? PASTA_BURN_SECONDS : PATTY_BURN_SECONDS;
}

// ---------------------------------------------------------------- update

// Advance chopping and cooking. Returns events for main.js.
export function updateKitchen(kitchen, dt, now) {
  const events = [];
  // Click-to-move: walk the route, then use the station on arrival.
  if (kitchen.movePath.length > 0) {
    const arrived = walkToTarget(kitchen, dt);
    if (arrived && kitchen.moveTargetStation) {
      const station = kitchen.moveTargetStation;
      kitchen.moveTargetStation = null;
      events.push(...interact(kitchen, station, now));
    }
  }
  // Chopping progresses once started, even if the chef steps away.
  const board = kitchen.board;
  if (board.chopping && board.item) {
    board.progress += dt;
    if (Math.floor(board.progress * 4) !== Math.floor((board.progress - dt) * 4)) {
      events.push({ type: 'chop-tick' });
    }
    if (board.progress >= CHOP_SECONDS) {
      board.item = { ...board.item, chopped: true };
      board.chopping = false;
      board.progress = 0;
      events.push({ type: 'chopped', item: board.item });
    }
  }
  // Burners cook, then burn.
  for (let i = 0; i < kitchen.burners.length; i++) {
    const burner = kitchen.burners[i];
    if (burner.state === 'cooking' && burner.item) {
      burner.progress += dt;
      if (burner.progress >= cookSeconds(burner.item)) {
        burner.state = 'ready';
        burner.progress = 0;
        events.push({ type: 'cooked', burner: i, item: burner.item });
      }
    } else if (burner.state === 'ready' && burner.item) {
      burner.progress += dt;
      if (burner.progress >= burnSeconds(burner.item) - cookSeconds(burner.item)) {
        burner.state = 'burnt';
        events.push({ type: 'burnt', burner: i, item: burner.item });
      }
    }
  }
  return events;
}

// Keyboard movement: input is {x, y} in -1..1. Cancels click-to-move.
export function moveChefByInput(kitchen, input, dt) {
  if (input.x !== 0 || input.y !== 0) {
    kitchen.movePath = [];
    kitchen.moveTarget = null;
    kitchen.moveTargetStation = null;
  }
  moveChef(kitchen, input.x, input.y, dt);
}

// Tell the chef to walk to a point (a mouse click on the floor).
export function clickMoveTo(kitchen, x, y) {
  if (!walkable(x, y)) return;
  startRoute(kitchen, { x, y }, null);
}

// Tell the chef to walk to a station and use it on arrival.
export function clickStation(kitchen, stationName) {
  const point = stationApproachPoint(kitchen, stationName);
  startRoute(kitchen, point, stationName);
}

// Which pantry bin, if any, is under point (x, y)?
export function pantryBinAt(x, y) {
  for (let i = 0; i < PANTRY_ORDER.length; i++) {
    const r = pantryBinRect(i);
    if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return i;
  }
  return -1;
}

// Which station, if any, is under point (x, y)?
export function stationAt(x, y) {
  for (const [name, rect] of Object.entries(STATIONS)) {
    if (x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h) return name;
  }
  return null;
}

// ---------------------------------------------------------------- interact

// Use a station. Returns events for main.js.
export function interact(kitchen, station, now) {
  const events = [];
  const item = handsItem(kitchen);
  const plate = handsPlate(kitchen);

  if (station === 'pantry') {
    if (kitchen.hands) {
      setNotice(kitchen, 'Hands full!', now);
      events.push({ type: 'reject', text: 'Hands full!' });
      return events;
    }
    const id = PANTRY_ORDER[kitchen.pantrySelected];
    kitchen.hands = { kind: 'item', item: { id, chopped: false, cooked: false } };
    events.push({ type: 'grabbed', item: kitchen.hands.item });
    return events;
  }

  if (station === 'board') {
    const board = kitchen.board;
    if (board.chopping) return events;
    if (item && INGREDIENTS[item.id].chop && !item.chopped) {
      board.item = item;
      board.progress = 0;
      board.chopping = true;
      kitchen.hands = null;
      events.push({ type: 'chop-start', item });
      return events;
    }
    if (board.item && !kitchen.hands) {
      kitchen.hands = { kind: 'item', item: board.item };
      board.item = null;
      events.push({ type: 'grabbed', item: kitchen.hands.item });
      return events;
    }
    if (item) {
      setNotice(kitchen, 'This cannot be chopped', now);
      events.push({ type: 'reject', text: 'This cannot be chopped' });
    }
    return events;
  }

  if (station === 'stove') {
    if (item && INGREDIENTS[item.id].cook && !item.cooked) {
      // Patties grill on burner 0, pasta boils in the pot on burner 1; fall
      // back to whichever burner is free when the right one is busy.
      const preferred = item.id === 'pasta' ? 1 : 0;
      const free =
        kitchen.burners[preferred].state === 'empty'
          ? preferred
          : kitchen.burners[1 - preferred].state === 'empty'
            ? 1 - preferred
            : -1;
      if (free < 0) {
        setNotice(kitchen, 'Both burners are busy', now);
        events.push({ type: 'reject', text: 'Both burners are busy' });
        return events;
      }
      kitchen.burners[free] = { item, progress: 0, state: 'cooking' };
      kitchen.hands = null;
      events.push({ type: 'cook-start', burner: free, item });
      return events;
    }
    if (!kitchen.hands) {
      const ready = kitchen.burners.findIndex((b) => b.state === 'ready' || b.state === 'burnt');
      if (ready >= 0) {
        const burner = kitchen.burners[ready];
        const cooked = burner.state === 'ready';
        const burnt = burner.state === 'burnt';
        kitchen.hands = { kind: 'item', item: { ...burner.item, cooked, burnt } };
        kitchen.burners[ready] = { item: null, progress: 0, state: 'empty' };
        events.push({ type: 'grabbed', item: kitchen.hands.item });
        return events;
      }
    }
    if (item) {
      setNotice(kitchen, 'This does not cook', now);
      events.push({ type: 'reject', text: 'This does not cook' });
    }
    return events;
  }

  if (station === 'plating') {
    if (item) {
      if (item.burnt) {
        setNotice(kitchen, 'Burnt! Throw it away', now);
        events.push({ type: 'reject', text: 'Burnt! Throw it away' });
        return events;
      }
      if (!item.cooked && INGREDIENTS[item.id].cook) {
        // A raw patty or raw pasta never goes on a plate; it needs the stove first.
        setNotice(kitchen, 'Cook it first!', now);
        events.push({ type: 'reject', text: 'Cook it first!' });
        return events;
      }
      kitchen.counterPlate.items.push(item);
      kitchen.hands = null;
      events.push({ type: 'plated', item });
      return events;
    }
    if (plate) {
      kitchen.counterPlate.items = [...plate.items];
      kitchen.hands = null;
      events.push({ type: 'plate-put-down' });
      return events;
    }
    // Empty hands: pick the plate up.
    kitchen.hands = { kind: 'plate', items: [...kitchen.counterPlate.items] };
    kitchen.counterPlate.items = [];
    events.push({ type: 'plate-picked-up' });
    return events;
  }

  if (station === 'serve') {
    if (plate) {
      events.push({ type: 'serve-attempt', plate: plate.items });
      return events;
    }
    if (item) {
      setNotice(kitchen, 'Serve a finished plate, not an ingredient', now);
      events.push({ type: 'reject', text: 'Serve a finished plate' });
    }
    return events;
  }

  if (station === 'trash') {
    if (plate) {
      kitchen.hands = { kind: 'plate', items: [] };
      events.push({ type: 'trashed-plate' });
      return events;
    }
    if (item) {
      kitchen.hands = null;
      events.push({ type: 'trashed', item });
      return events;
    }
    return events;
  }

  return events;
}

// Drop what the chef carries (used when a plate is served).
export function clearHands(kitchen) {
  kitchen.hands = null;
}

// Is anything cooking right now (for the sizzle loop)?
export function anythingCooking(kitchen) {
  return kitchen.burners.some((b) => b.state === 'cooking');
}
