// Seeded RNG (mulberry32) — determinism for ?shot= poses and bot behaviour.
// Game logic never calls Math.random or Date.now; only textures use Math.random
// for speckle, which does not affect simulation.
export function mulberry32(seed) {
  let a = (seed >>> 0) || 1;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function makeRng(seed) {
  const next = mulberry32(seed);
  return {
    next,
    range(min, max) { return min + next() * (max - min); },
    int(min, max) { return Math.floor(min + next() * (max - min + 1)); },
    pick(arr) { return arr[Math.floor(next() * arr.length)]; },
    chance(p) { return next() < p; },
    // Box-Muller-ish gaussian in [-1,1] for aim error.
    gauss() { return (next() + next() + next() - 1.5) / 1.5; },
  };
}
