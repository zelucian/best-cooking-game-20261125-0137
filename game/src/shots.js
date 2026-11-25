// shots.js — deterministic staged scenes for screenshots: ?shot=title|play|
// rush|serve&seed=7. Each builds a real game state (real tickets, real
// plates, real cooking) at a frozen clock, so headless Chrome can capture the
// exact moment. Nothing here is fake art: every pixel is the game's own render.

import { SHIFT_SECONDS, TICKET_PATIENCE } from './config.js';
import { createTicket } from './orders.js';
import { mulberry32 } from './random.js';

// A ticket born so that `left` of its patience remains at shift-time `now`.
function stagedTicket(recipeId, now, left, id) {
  const ticket = createTicket(recipeId, now - (1 - left) * TICKET_PATIENCE);
  ticket.id = id;
  return ticket;
}

function plateOf(...specs) {
  return specs.map(([id, flags]) => ({ id, chopped: !!flags?.chopped, cooked: !!flags?.cooked }));
}

export function stageShot(state, shot, seed) {
  const rng = mulberry32(seed);
  state.rng = rng;
  state.clock = 12; // frozen mid-animation so the scene feels alive, not blank
  state.mode = 'play';
  state.popups = [];

  if (shot === 'title') {
    state.mode = 'title';
    state.clock = 4;
    state.shiftTime = 0;
    state.shiftLeft = SHIFT_SECONDS;
    return;
  }

  if (shot === 'play') {
    // Mid-shift, mid-assembly: three tickets on the board, a patty grilling,
    // a burger half-built on the plating counter, the chef chopping a tomato.
    state.shiftTime = 46;
    state.shiftLeft = SHIFT_SECONDS - 46;
    state.coins = 240;
    state.servedCount = 3;
    state.combo = 2;
    state.lastServeAt = 40;
    state.board.tickets = [
      stagedTicket('burger', 46, 0.72, 4),
      stagedTicket('salad', 46, 0.55, 5),
      stagedTicket('pasta', 46, 0.85, 6),
    ];
    state.board.served = 3;
    const k = state.kitchen;
    // West of the board, facing it: clear of the CHOPPING BOARD label.
    k.chef.x = 1050;
    k.chef.y = 295;
    k.chef.dir = 1;
    k.hands = { kind: 'item', item: { id: 'tomato', chopped: true, cooked: false } };
    k.board.item = { id: 'lettuce', chopped: false, cooked: false };
    k.board.chopping = true;
    k.board.progress = 0.55;
    k.burners[0] = { item: { id: 'patty', chopped: false, cooked: false }, progress: 5, state: 'cooking' };
    k.burners[1] = { item: null, progress: 0, state: 'empty' };
    k.counterPlate.items = plateOf(
      ['bun', {}],
      ['patty', { cooked: true }],
    );
    k.pantrySelected = 2;
    state.nearestStationName = 'board';
    state.popups.push({ text: 'Chopping…', x: 940, y: 250, bornAt: 11.4, color: '#fff8e7', size: 15 });
    return;
  }

  if (shot === 'rush') {
    // Rush hour: the board is full, patience is low, the chef hurries a
    // finished plate to the serve window while a patty waits on the grill.
    state.shiftTime = 88;
    state.shiftLeft = SHIFT_SECONDS - 88;
    state.rush = true;
    state.rushAnnounced = true;
    state.coins = 620;
    state.servedCount = 7;
    state.combo = 4;
    state.lastServeAt = 84;
    state.board.tickets = [
      stagedTicket('burger', 88, 0.18, 9),
      stagedTicket('melt', 88, 0.32, 10),
      stagedTicket('salad', 88, 0.5, 11),
      stagedTicket('pasta', 88, 0.62, 12),
      stagedTicket('burger', 88, 0.78, 13),
    ];
    state.board.served = 7;
    const k = state.kitchen;
    k.chef.x = 830;
    k.chef.y = 600;
    k.chef.dir = 1;
    k.hands = { kind: 'plate', items: plateOf(['bun', {}], ['patty', { cooked: true }], ['lettuce', { chopped: true }], ['tomato', { chopped: true }]) };
    k.board.item = { id: 'cucumber', chopped: true, cooked: false };
    k.burners[0] = { item: { id: 'patty', chopped: false, cooked: true }, progress: 2, state: 'ready' };
    k.burners[1] = { item: { id: 'pasta', chopped: false, cooked: false }, progress: 6, state: 'cooking' };
    k.counterPlate.items = plateOf(['lettuce', { chopped: true }]);
    k.pantrySelected = 0;
    state.nearestStationName = 'serve';
    state.popups.push({ text: 'RUSH HOUR!', x: 640, y: 300, bornAt: 11.2, color: '#ff8a7a', size: 34 });
    return;
  }

  if (shot === 'serve') {
    // The serve moment: the chef rings the bell with a finished burger, the
    // ticket is about to clear, coins fly.
    state.shiftTime = 30;
    state.shiftLeft = SHIFT_SECONDS - 30;
    state.coins = 540;
    state.servedCount = 5;
    state.combo = 3;
    state.lastServeAt = 26;
    state.board.tickets = [
      stagedTicket('burger', 30, 0.66, 7),
      stagedTicket('salad', 30, 0.8, 8),
    ];
    state.board.served = 5;
    const k = state.kitchen;
    k.chef.x = 868;
    k.chef.y = 600;
    k.chef.dir = 1;
    k.hands = { kind: 'plate', items: plateOf(['bun', {}], ['patty', { cooked: true }], ['lettuce', { chopped: true }], ['tomato', { chopped: true }]) };
    k.counterPlate.items = [];
    k.burners[0] = { item: null, progress: 0, state: 'empty' };
    k.burners[1] = { item: null, progress: 0, state: 'empty' };
    state.nearestStationName = 'serve';
    state.popups.push({ text: 'SERVED! +180', x: 990, y: 632, bornAt: 11.3, color: '#ffd23e', size: 26 });
    state.popups.push({ text: 'COMBO x1.2', x: 990, y: 600, bornAt: 11.3, color: '#ff9d5c', size: 18 });
    return;
  }

  // Unknown ?shot=: fall back to the title screen.
  state.mode = 'title';
}
