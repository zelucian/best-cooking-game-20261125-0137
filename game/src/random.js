// random.js — a tiny seeded random number generator (mulberry32) so staged
// screenshots and order dealing are reproducible from a seed, and the live
// game can be seeded too. No Math.random anywhere in the game logic.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Pick one element of an array with the given rng.
export function pick(rng, array) {
  return array[Math.floor(rng() * array.length)];
}

// A random integer in [min, max].
export function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}
