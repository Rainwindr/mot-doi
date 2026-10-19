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

/** Tần suất sự kiện (mục 190): phân bố số sự kiện gói mỗi năm, hệ số sự kiện hệ thống, giới hạn mỗi năm, số năm bảo đảm. */
export const FREQ = {
  low: { n: [20, 60, 20, 0, 0], m: 0.6, cap: 1, g: 25 },
  mid: { n: [6, 54, 40, 0, 0], m: 1, cap: 2, g: 15 },
  high: { n: [0, 30, 50, 20, 0], m: 1.8, cap: 2, g: 8 },
  max: { n: [0, 0, 40, 40, 20], m: 3, cap: 3, g: 4 },
};
export const freqOf = (st) => FREQ[st?.eventFreq] || FREQ.mid;
/** Ghi nhận đã gặp một sự kiện (tính trên mọi đời, lưu trong cài đặt). */
export function markSeen(st, uid) {
  if (!st || !uid) return;
  st.seen ||= [];
  if (!st.seen.includes(uid)) st.seen.push(uid);
}
