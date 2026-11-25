// orders.js — the order board: tickets arrive, wait with a draining patience
// bar, and are served (or lost) by matching a plate exactly. Pure logic, no DOM.

import {
  MAX_TICKETS,
  ORDER_INTERVAL_CALM,
  ORDER_INTERVAL_RUSH,
  RECIPES,
  RECIPE_ORDER,
  TICKET_PATIENCE,
  itemsMatch,
} from './config.js';
import { pick } from './random.js';

let nextTicketId = 1;

export function createTicket(recipeId, now) {
  return {
    id: nextTicketId++,
    recipeId,
    bornAt: now,
    patience: TICKET_PATIENCE,
    // Patience drains 1 per second; a ticket is lost at 0.
    state: 'waiting', // 'waiting' | 'served' | 'lost'
  };
}

// Patience left, 0..1 (clamped: a ticket cannot have more than full patience).
export function ticketPatienceLeft(ticket, now) {
  const elapsed = now - ticket.bornAt;
  return Math.max(0, Math.min(1, 1 - elapsed / ticket.patience));
}

export function createOrderBoard(rng) {
  return {
    rng,
    tickets: [],
    spawnIn: 4, // first ticket arrives 4 seconds into the shift
    served: 0,
    lost: 0,
  };
}

// Choose the next recipe: avoid repeating the last ticket's recipe twice in
// a row so the board asks for variety.
function nextRecipeId(board) {
  const last = board.tickets.length > 0 ? board.tickets[board.tickets.length - 1].recipeId : null;
  let id = pick(board.rng, RECIPE_ORDER);
  let guard = 0;
  while (id === last && guard < 6) {
    id = pick(board.rng, RECIPE_ORDER);
    guard++;
  }
  return id;
}

// Advance the board by dt seconds. Returns events: {type:'spawned'|'lost', ticket}.
export function updateOrderBoard(board, dt, now, rush) {
  const events = [];
  board.spawnIn -= dt;
  if (board.spawnIn <= 0 && board.tickets.length < MAX_TICKETS) {
    const ticket = createTicket(nextRecipeId(board), now);
    board.tickets.push(ticket);
    events.push({ type: 'spawned', ticket });
    board.spawnIn = rush ? ORDER_INTERVAL_RUSH : ORDER_INTERVAL_CALM;
    // A little jitter so tickets never arrive on a metronome.
    board.spawnIn += (board.rng() - 0.5) * 2;
  } else if (board.spawnIn <= 0) {
    board.spawnIn = 2;
  }
  for (const ticket of board.tickets) {
    if (ticket.state === 'waiting' && ticketPatienceLeft(ticket, now) <= 0) {
      ticket.state = 'lost';
      board.lost++;
      events.push({ type: 'lost', ticket });
    }
  }
  board.tickets = board.tickets.filter((t) => t.state === 'waiting');
  return events;
}

// Find the waiting ticket a plate completes, if any. The earliest ticket
// wins when two ask for the same dish.
export function findMatchingTicket(board, plateItems) {
  for (const ticket of board.tickets) {
    if (ticket.state !== 'waiting') continue;
    if (itemsMatch(plateItems, RECIPES[ticket.recipeId].items)) return ticket;
  }
  return null;
}

// Mark a ticket served and count it.
export function serveTicket(board, ticket) {
  ticket.state = 'served';
  board.served++;
  board.tickets = board.tickets.filter((t) => t !== ticket);
}
