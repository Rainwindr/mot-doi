// Tiện ích dùng chung: chữ song ngữ, RNG có seed, giới hạn số.
export const L = (vi, en) => ({ vi, en });
export const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

// mulberry32 — trạng thái lưu trong state.rng để tái hiện được một đời từ seed.
export function rand(state) {
  let t = (state.rng = (state.rng + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const chance = (s, p) => rand(s) < p;
export const randint = (s, a, b) => a + Math.floor(rand(s) * (b - a + 1));
export const pick = (s, arr) => arr[Math.floor(rand(s) * arr.length)];
export function weighted(s, items, w) {
  const total = items.reduce((t, x) => t + w(x), 0);
  let r = rand(s) * total;
  for (const x of items) {
    r -= w(x);
    if (r <= 0) return x;
  }
  return items[items.length - 1];
}
export const uid = (s) => Math.floor(rand(s) * 1e9).toString(36);
