// Tạo nhân vật và các hàm về con người trong đời.
import { COUNTRIES, byCode, tierOf, NAMES, FAMILY_FIRST } from '../data/countries.js';
import { L, clamp, rand, chance, randint, pick, weighted, uid } from './util.js';
import { CAREERS } from '../data/careers.js';

export const STAT_KEYS = ['health', 'happy', 'smarts', 'looks'];
export const HIDDEN_KEYS = ['karma', 'willpower', 'risk', 'fame'];
export const WEALTH = ['poor', 'middle', 'well', 'rich'];
export const TRAITS = {
  genius: { name: L('Thông minh bẩm sinh', 'Born genius'), boost: { smarts: 20 } },
  charming: { name: L('Quyến rũ', 'Charming'), boost: { looks: 15, happy: 5 } },
  athletic: { name: L('Khỏe như vâm', 'Athletic'), boost: { health: 15 } },
  party: { name: L('Thích tiệc tùng', 'Party animal'), boost: { risk: 20, happy: 5 } },
  stoic: { name: L('Lì đòn', 'Stoic'), boost: { willpower: 20 } },
};

export const country = (life) => byCode[life.country];
export const tier = (life) => tierOf(country(life));
/** 1 đơn vị tiền trong gói = 1% thu nhập năm trung bình của nước đó (tính bằng USD). */
export const unit = (life) => country(life).gdp / 100;

export function fullName(p, region) {
  return (FAMILY_FIRST.has(region) ? `${p.last} ${p.first}` : `${p.first} ${p.last}`).trim();
}
export const personName = (life, p) => fullName(p, country(life).region);

export function randomPerson(s, life, { role, gender, age, last, closeness = 60 }) {
  const pool = NAMES[country(life).region];
  const g = gender ?? (chance(s, 0.5) ? 'male' : 'female');
  let id = uid(s);
  while ((life.people || []).some((q) => q.id === id)) id = uid(s);
  const p = {
    id,
    role,
    gender: g,
    first: pick(s, g === 'male' ? pool.m : pool.f),
    last: last ?? pick(s, pool.last),
    age,
    closeness,
    looks: randint(s, 20, 100),
    smarts: randint(s, 10, 100),
    alive: true,
    poly: Math.round(rand(s) ** 2 * 100),
    fert: randint(s, 40, 95),
    skill: randint(s, 20, 90),
  };
  if (g === 'male') p.size = randint(s, 20, 90);
  if (age >= 18) enrichAdult(s, life, p);
  return p;
}

/** Hồ sơ người lớn: nghề, thu nhập, tài sản, độ chung thủy, độ "điên". */
export function enrichAdult(s, life, p, kind) {
  const gdp = country(life).gdp;
  const jobless = chance(s, 0.15);
  const c = jobless ? null : pick(s, CAREERS.filter((x) => p.smarts >= (x.min.smarts || 0)));
  p.job = c ? c.title : null;
  p.income = c ? Math.round(c.pay * gdp * (0.8 + rand(s) * 0.6)) : 0;
  p.wealth = Math.round(gdp * Math.max(0, (p.age - 18) / 10) * (0.3 + rand(s) * 2));
  p.fidelity = randint(s, 20, 100);
  p.crazy = randint(s, 0, 100);
  if (kind === 'sugar') {
    p.age = Math.max(p.age, life.age + randint(s, 20, 35));
    p.wealth = Math.round(gdp * randint(s, 150, 600));
    p.income = Math.round(gdp * randint(s, 8, 30));
    p.job = pick(s, [L('Chủ tịch tập đoàn', 'Company chairman'), L('Nhà đầu tư', 'Investor'), L('Chủ chuỗi khách sạn', 'Hotel chain owner'), L('Bác sĩ thẩm mỹ', 'Cosmetic surgeon')]);
    p.sugar = true;
  }
  return p;
}

/** Giới tính người mà nhân vật có thể hẹn hò, theo xu hướng đã chọn. */
export function partnerGender(s, life) {
  const opp = life.gender === 'male' ? 'female' : 'male';
  if (life.orientation === 'same') return life.gender;
  if (life.orientation === 'both') return chance(s, 0.5) ? opp : life.gender;
  return opp;
}

export const people = (life, role) => life.people.filter((p) => p.alive && (!role || p.role === role));
export const partner = (life) => life.people.find((p) => p.alive && (p.role === 'spouse' || p.role === 'partner'));
export const spouse = (life) => life.people.find((p) => p.alive && p.role === 'spouse');
export const byId = (life, id) => life.people.find((p) => p.id === id);

function rollStats(s, t) {
  const healthBase = t === 'low' ? 55 : 65;
  return {
    health: randint(s, healthBase, 100),
    happy: randint(s, 50, 100),
    smarts: randint(s, 10, 100),
    looks: randint(s, 10, 100),
    karma: randint(s, 40, 60),
    willpower: randint(s, 20, 80),
    risk: randint(s, 10, 60),
    fame: 0,
  };
}

const WEALTH_ODDS = { low: [55, 35, 8, 2], mid: [30, 50, 15, 5], high: [12, 55, 25, 8] };

/**
 * Tạo một đời mới.
 * opts.mode: 'fate' (Số phận — mọi thứ random theo dữ liệu) | 'free' (Tự do — dùng các giá trị người chơi chọn)
 */
export function createLife(opts = {}) {
  const s = { rng: (opts.seed ?? Math.floor(Math.random() * 2 ** 32)) >>> 0 };
  const seed = s.rng;
  const free = opts.mode === 'free';
  const c = free && opts.country ? byCode[opts.country] : weighted(s, COUNTRIES, (x) => x.births);
  const t = tierOf(c);
  const gender = free && opts.gender ? opts.gender : chance(s, 0.5) ? 'male' : 'female';
  const wealthIdx = WEALTH_ODDS[t];
  const wealth = free && opts.wealth ? opts.wealth : weighted(s, WEALTH, (w) => wealthIdx[WEALTH.indexOf(w)]);
  const stats = rollStats(s, t);
  const traits = free ? (opts.traits ?? []).slice(0, 2) : chance(s, 0.6) ? [pick(s, Object.keys(TRAITS))] : [];
  for (const tr of traits) for (const [k, v] of Object.entries(TRAITS[tr].boost)) stats[k] = clamp(stats[k] + v);
  if (free && opts.stats) for (const [k, v] of Object.entries(opts.stats)) stats[k] = clamp(Number(v));
  const orientation = free && opts.orientation ? opts.orientation : weighted(s, ['opposite', 'same', 'both'], (o) => ({ opposite: 90, same: 5, both: 5 })[o]);

  const pool = NAMES[c.region];
  const last = free && opts.last ? opts.last : pick(s, pool.last);
  const first = free && opts.first ? opts.first : pick(s, gender === 'male' ? pool.m : pool.f);

  const life = {
    v: 1,
    seed,
    rng: s.rng,
    mode: free ? 'free' : 'fate',
    customized: free,
    first,
    last,
    gender,
    orientation,
    country: c.code,
    wealth,
    traits,
    age: 0,
    stats,
    money: 0,
    edu: { level: 'none', stage: null, gpa: 50, years: 0 },
    job: null,
    jobHistory: 0,
    pension: 0,
    people: [],
    flags: {},
    done: [],
    pregnancy: null,
    affair: null,
    fert: randint(s, 45, 95),
    skill: randint(s, 20, 80),
    counts: { ons: 0, partners: 0, affairsExposed: 0, divorces: 0, children: 0, godUses: 0, rewinds: 0, maxMoney: 0 },
    addicted: false,
    ill: null,
    yearActs: {},
    queue: [],
    log: [],
    snapshots: [],
    dead: false,
    cause: null,
  };

  // Gia đình
  const momAge = t === 'low' ? randint(s, 17, 34) : randint(s, 21, 40);
  life.people.push(randomPerson(s, life, { role: 'mother', gender: 'female', age: momAge, closeness: randint(s, 55, 95) }));
  life.people.push(randomPerson(s, life, { role: 'father', gender: 'male', age: momAge + randint(s, 0, 7), last, closeness: randint(s, 45, 95) }));
  const sibMax = t === 'low' ? 4 : 2;
  const sibs = randint(s, 0, sibMax);
  for (let i = 0; i < sibs; i++) life.people.push(randomPerson(s, life, { role: 'sibling', age: randint(s, 1, Math.max(1, momAge - 17)), last, closeness: randint(s, 40, 90) }));

  life.log.push({
    age: 0,
    items: [
      { text: L(`Bạn chào đời tại ${c.name.vi}${gender === 'male' ? ', là con trai' : ', là con gái'}.`, `You are born in ${c.name.en} as a ${gender === 'male' ? 'boy' : 'girl'}.`) },
      { text: wealthLine(wealth) },
    ],
  });
  life.rng = s.rng; // tiếp nối dòng số ngẫu nhiên, tránh trùng id với người nhà
  return life;
}

export function wealthLine(w) {
  return {
    poor: L('Gia đình bạn nghèo, bữa ăn nào cũng phải tính toán.', 'Your family is poor and every meal is counted.'),
    middle: L('Gia đình bạn có cuộc sống bình thường, đủ ăn đủ mặc.', 'Your family gets by, with enough to eat and wear.'),
    well: L('Gia đình bạn khá giả.', 'Your family is comfortably off.'),
    rich: L('Bạn sinh ra trong một gia đình giàu có.', 'You are born into a wealthy family.'),
  }[w];
}

export function addLog(life, text, tone) {
  let year = life.log[life.log.length - 1];
  if (!year || year.age !== life.age) {
    year = { age: life.age, items: [] };
    life.log.push(year);
  }
  year.items.push(tone ? { text, tone } : { text });
}

/** Dấu mốc của đời: hiện ở màn qua đời. */
export function milestone(life, text, tone) {
  (life.miles = life.miles || []).push({ age: life.age, text, tone });
}

const INTIMATE_TICK = new Set(['recent_intimate', 'ons_happened', 'uni_intimate', 'uni_ons']);
export function setFlag(life, f) {
  life.flags[f] = life.age;
  if (INTIMATE_TICK.has(f)) life.ixTick = (life.ixTick || 0) + 1;
}
export function clearFlag(life, f) {
  delete life.flags[f];
}

/** Giá trị một chỉ số theo tên dùng trong gói: chỉ số, money (đơn vị), age, rel_<vai>. */
export function readStat(life, key) {
  if (key === 'age') return life.age;
  if (key === 'money') return life.money / unit(life);
  if (key.startsWith('rel_')) {
    const role = key.slice(4);
    const p = role === 'partner' ? partner(life) : life.people.find((x) => x.alive && x.role === role);
    return p ? p.closeness : 0;
  }
  return life.stats[key] ?? 0;
}

export function adjustRel(life, role, delta) {
  const targets = role === 'partner' ? [partner(life)].filter(Boolean) : people(life, role);
  for (const p of targets) p.closeness = clamp(p.closeness + delta);
}

export { rand };

// ───────── Người tình (không giới hạn số lượng) ─────────
export const lovers = (life) => life.people.filter((p) => p.role === 'lover' && p.alive);
export const polyOk = (life) => 'open_rel' in life.flags;
export function syncAffair(life) {
  const ls = lovers(life);
  if (!ls.length) { life.affair = null; delete life.flags.has_affair; return; }
  const last = ls.reduce((a, b) => ((b.loverSince ?? 0) >= (a.loverSince ?? 0) ? b : a));
  life.affair = { id: last.id, since: Math.min(...ls.map((x) => x.loverSince ?? life.age)) };
  if (!('has_affair' in life.flags)) life.flags.has_affair = life.age;
  life.counts.maxLovers = Math.max(life.counts.maxLovers || 0, ls.length);
}
export function makeLover(life, p) {
  p.role = 'lover';
  p.loverSince = life.age;
  p.closeness = Math.max(p.closeness, 55);
  syncAffair(life);
}
export function endLover(life, p, cap = 20) {
  p.role = 'ex';
  p.closeness = Math.min(p.closeness, cap);
  syncAffair(life);
}
export function endAllLovers(life) {
  for (const p of lovers(life)) { p.role = 'ex'; p.closeness = Math.min(p.closeness, 20); }
  syncAffair(life);
}
/** Ai có thể quyến rũ: người lớn ngoài gia đình. Không bao giờ có bố mẹ, anh chị em, con cái, thú cưng hay người dưới 18. */
export const SEDUCIBLE = ['friend', 'bestie', 'contact', 'ex', 'rival', 'mentor', 'coworker', 'neighbor', 'boss'];
export const canSeduce = (life, p) => p.alive && life.age >= 18 && p.age >= 18 && SEDUCIBLE.includes(p.role);
