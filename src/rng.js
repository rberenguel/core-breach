// Mulberry32 — fast, decent-quality 32-bit seeded PRNG
let _seed = 0;

export const rng = {
  init(seed) {
    _seed = seed >>> 0;
  },
  random() {
    _seed = (_seed + 0x6D2B79F5) >>> 0;
    let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  }
};
