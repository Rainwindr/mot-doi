// Mục 343: khả năng sinh sản theo tuổi. Nam: đỉnh 20–40, giảm dần sau 40, rất thấp sau 90.
// Người mang thai mặc định 18–48 tuổi; God Mode nâng tối đa 55.
import { clamp } from './util.js';

export const MALE_UNLIMITED = 121;
export function fcfg(life) {
  if (!life.fcfg) life.fcfg = { maleMax: MALE_UNLIMITED, noDecline: false, carrierMax: 48 };
  return life.fcfg;
}
/** Hệ số theo tuổi của nam (0..1), có tính Sức khỏe và chỉ số sinh sản. */
export function maleFactor(life, age, fert = 70, health = 60) {
  const c = fcfg(life);
  if (age < 18) return 0;
  if (c.maleMax < MALE_UNLIMITED && age > c.maleMax) return 0;
  let f = c.noDecline ? 1 : age <= 40 ? 1 : age <= 50 ? 0.85 : age <= 60 ? 0.65 : age <= 70 ? 0.42 : age <= 80 ? 0.22 : age <= 90 ? 0.08 : 0.025;
  // Sức khỏe tốt và sinh lực cao làm đường cong thoải hơn
  f += (1 - f) * clamp((fert - 70) / 100 + (health - 60) / 200, 0, 0.5);
  return clamp(f, 0, 1);
}
/** Hệ số theo tuổi của người mang thai. */
export function carrierFactor(life, age) {
  const c = fcfg(life);
  if (age < 18 || age > c.carrierMax) return 0;
  return age > 50 ? 0.06 : age > 44 ? 0.15 : age > 40 ? 0.35 : age > 35 ? 0.7 : 1;
}
export function canCarry(life, age) { return carrierFactor(life, age) > 0; }
