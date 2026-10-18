// Tội phạm, nhà tù, truy nã, di cư, và 4 người sinh cùng giây.
import { L, clamp, rand, chance, randint, pick, weighted } from './util.js';
import { COUNTRIES, byCode, tierOf, NAMES, FAMILY_FIRST } from '../data/countries.js';
import { country, unit, partner, spouse, people, addLog, personName, milestone } from './life.js';

// Không có hướng dẫn thực tế: chỉ là nhãn, xác suất và hậu quả.
export const CRIMES = [
  { id: 'pickpocket', name: L('Móc túi', 'Pickpocket'), gain: [1, 5], catch: 0.2, years: [0, 1] },
  { id: 'shoplift', name: L('Trộm đồ trong siêu thị', 'Shoplift'), gain: [1, 4], catch: 0.25, years: [0, 1] },
  { id: 'burglary', name: L('Đột nhập nhà dân', 'Burglary'), gain: [10, 40], catch: 0.35, years: [1, 4] },
  { id: 'cartheft', name: L('Trộm xe', 'Steal a car'), gain: [20, 60], catch: 0.4, years: [2, 5] },
  { id: 'fraud', name: L('Lừa đảo đầu tư', 'Investment fraud'), gain: [40, 200], catch: 0.3, years: [3, 8], smarts: 55 },
  { id: 'bank', name: L('Cướp ngân hàng', 'Rob a bank'), gain: [200, 500], catch: 0.65, years: [8, 20] },
];

export const inPrison = (life) => !!life.prison;

function sentence(life, years, crime) {
  years = Math.max(1, Math.round(years));
  life.prison = { years, served: 0, crime };
  life.record = true;
  life.fugitive = false;
  if (life.job) { life.job = null; }
  life.edu.stage = null;
  life.affair = null;
  milestone(life, L(`Vào tù ${years} năm`, `Sent to prison for ${years} years`), 'bad');
  addLog(life, L(`Tòa tuyên án ${years} năm tù vì tội ${crime.vi.toLowerCase()}.`, `You're sentenced to ${years} years for ${crime.en.toLowerCase()}.`), 'bad');
}

/** Phạm tội: trả về kết quả hoặc một cảnh ra tòa có lựa chọn. */
export function commitCrime(life, id) {
  const c = CRIMES.find((x) => x.id === id);
  if (!c || life.prison) return null;
  const key = `crime:${id}`;
  const n = (life.yearActs[key] = (life.yearActs[key] || 0) + 1);
  if (n > 2) return { text: L('Bạn nên nằm im một thời gian.', 'You should lie low for a while.'), changes: [] };
  if (c.smarts && life.stats.smarts < c.smarts) return { text: L('Bạn không đủ hiểu biết để làm việc này.', "You're not smart enough to pull this off."), changes: [], tone: 'bad' };
  life.counts.crimes = (life.counts.crimes || 0) + 1;
  life.stats.karma = clamp(life.stats.karma - randint(life, 3, 8));
  life.stats.risk = clamp(life.stats.risk + 3);
  const p = clamp(c.catch + (life.fugitive ? 0.1 : 0) - life.stats.smarts / 600 - life.stats.risk / 800, 0.05, 0.9);
  if (!chance(life, p)) {
    const u = randint(life, c.gain[0], c.gain[1]);
    life.money += u * unit(life);
    return { text: L(`Trót lọt. Không ai phát hiện.`, 'You get away with it.'), changes: [['money', u * unit(life)], ['karma', -5]], tone: 'good' };
  }
  const base = randint(life, c.years[0], c.years[1]);
  if (base === 0) {
    life.record = true;
    life.money -= 5 * unit(life);
    return { text: L('Bạn bị bắt quả tang, phải nộp phạt và có tiền án.', 'Caught red-handed. You pay a fine and get a record.'), changes: [['money', -5 * unit(life)]], tone: 'bad' };
  }
  const lawyerCost = 30;
  return {
    event: {
      uid: 'crime/court',
      text: L(`Bạn bị bắt vì ${c.name.vi.toLowerCase()} và phải ra tòa.`, `You're arrested for ${c.name.en.toLowerCase()} and must face court.`),
      choices: [
        { label: L('Thuê luật sư giỏi', 'Hire a top lawyer'), outcomes: [
          { chance: 0.45, effects: { money: -lawyerCost, happy: 10 }, text: L('Luật sư tìm ra kẽ hở. Bạn được tha bổng!', 'Your lawyer finds a loophole. Acquitted!'), run: (lf) => { lf.record = true; } },
          { chance: 0.55, effects: { money: -lawyerCost }, text: L('Án được giảm một nửa.', 'Your sentence is halved.'), run: (lf) => sentence(lf, base / 2, c.name) },
        ] },
        { label: L('Dùng luật sư được chỉ định', 'Take the public defender'), outcomes: [
          { chance: 0.15, effects: { happy: 8 }, text: L('Bất ngờ, bạn được tha bổng.', 'Surprisingly, you walk free.'), run: (lf) => { lf.record = true; } },
          { chance: 0.85, effects: { happy: -10 }, text: L('Bạn nhận đủ mức án.', 'You get the full sentence.'), run: (lf) => sentence(lf, base, c.name) },
        ] },
        { label: L('Nhận tội để được khoan hồng', 'Plead guilty for leniency'), outcomes: [
          { chance: 1, effects: { karma: 4, happy: -6 }, text: L('Tòa ghi nhận thái độ thành khẩn.', 'The court notes your remorse.'), run: (lf) => sentence(lf, base * 0.65, c.name) },
        ] },
      ],
    },
  };
}

// Hành động trong tù
export function prisonAction(life, act) {
  const pr = life.prison;
  if (!pr) return null;
  const key = `prison:${act}`;
  const n = (life.yearActs[key] = (life.yearActs[key] || 0) + 1);
  if (n > 1) return { text: L('Năm nay bạn đã thử rồi.', "You've already tried this year."), changes: [] };
  switch (act) {
    case 'escape':
      return { mini: { kind: 'maze', guards: pr.years - pr.served > 6 ? 2 : 1, moves: 22 } };
    case 'parole': {
      if (pr.served < pr.years / 2) return { text: L('Bạn cần thụ án ít nhất một nửa mới được xin ân xá.', 'You must serve at least half your sentence first.'), changes: [] };
      if (chance(life, clamp(life.stats.karma / 140, 0.05, 0.75))) {
        life.prison = null;
        addLog(life, L('Hội đồng chấp thuận ân xá. Bạn được ra tù sớm.', 'The parole board approves. You are released early.'), 'good');
        return { text: L('Bạn được ân xá!', 'Parole granted!'), changes: [['happy', 15]], tone: 'good' };
      }
      return { text: L('Đơn xin ân xá bị bác.', 'Parole denied.'), changes: [], tone: 'bad' };
    }
    case 'riot':
      if (chance(life, 0.3)) { pr.years += 1; return { text: L('Cuộc bạo loạn bị dập tắt. Bạn bị cộng thêm 1 năm.', 'The riot is crushed. You get one more year.'), changes: [['health', -8]], tone: 'bad' }; }
      life.stats.happy = clamp(life.stats.happy + 6);
      return { text: L('Cả khu giam hô vang. Bạn thấy mình còn sống.', 'The whole block roars. You feel alive.'), changes: [['happy', 6]] };
    case 'work':
      life.money += 2 * unit(life);
      life.stats.karma = clamp(life.stats.karma + 2);
      return { text: L('Bạn làm việc trong xưởng của trại giam.', 'You work in the prison workshop.'), changes: [['money', 2 * unit(life)]] };
  }
  return null;
}

/** Phần nhà tù/truy nã của vòng +1 tuổi. */
export function prisonYear(life) {
  const pr = life.prison;
  if (pr) {
    pr.served++;
    life.counts.prisonYears = (life.counts.prisonYears || 0) + 1;
    life.stats.happy = clamp(life.stats.happy - 4);
    const pt = partner(life);
    if (pt) {
      pt.closeness = clamp(pt.closeness - 8);
      if (chance(life, pt.role === 'spouse' ? 0.15 : 0.3)) {
        const wasSpouse = pt.role === 'spouse';
        pt.role = 'ex';
        if (wasSpouse) life.counts.divorces++;
        addLog(life, L(`${personName(life, pt)} không chờ được nữa và rời bỏ bạn.`, `${personName(life, pt)} can't wait any longer and leaves you.`), 'bad');
      }
    }
    if (pr.served >= pr.years) {
      life.prison = null;
      addLog(life, L('Bạn mãn hạn tù và bước ra ngoài.', 'You complete your sentence and walk free.'), 'good');
    }
  } else if (life.fugitive && chance(life, 0.18)) {
    addLog(life, L('Cảnh sát tìm ra nơi bạn lẩn trốn.', 'The police track you down.'), 'bad');
    sentence(life, randint(life, 3, 8), L('vượt ngục', 'escaping prison'));
  }
}

// ───────── Di cư ─────────
export function emigrationOdds(life, code) {
  const from = country(life);
  const to = byCode[code];
  let p = 0.45 + (life.stats.smarts - 50) / 200 + (['bachelor', 'master', 'phd'].includes(life.edu.level) ? 0.15 : 0);
  if (tierOf(to) === 'high' && tierOf(from) !== 'high') p -= 0.25;
  if (life.record) p -= 0.2;
  if (life.money > 3 * to.gdp) p += 0.1;
  return clamp(p, 0.05, 0.9);
}
export const emigrationCost = (code) => 0.3 * byCode[code].gdp;

export function emigrate(life, code) {
  const to = byCode[code];
  if (!to || code === life.country) return null;
  if (life.age < 18) return { text: L('Bạn chưa đủ tuổi tự di cư.', "You're too young to emigrate alone."), changes: [], tone: 'bad' };
  if (life.prison) return { text: L('Không thể khi đang ngồi tù.', 'Not while in prison.'), changes: [], tone: 'bad' };
  if ((life.yearActs.emigrate = (life.yearActs.emigrate || 0) + 1) > 1) return { text: L('Mỗi năm chỉ nộp hồ sơ được một lần.', 'You can only apply once a year.'), changes: [] };
  const cost = emigrationCost(code);
  if (life.money < cost) return { text: L('Bạn không đủ tiền làm hồ sơ và vé máy bay.', "You can't afford the visa and flights."), changes: [], tone: 'bad' };
  if (!chance(life, emigrationOdds(life, code))) {
    life.money -= cost / 2;
    return { text: L(`Hồ sơ thị thực đi ${to.name.vi} bị từ chối.`, `Your visa for ${to.name.en} is refused.`), changes: [['money', -cost / 2]], tone: 'bad' };
  }
  const from = country(life);
  life.money -= cost;
  life.country = code;
  life.job = null;
  life.counts.moves = (life.counts.moves || 0) + 1;
  if (life.fugitive) { life.fugitive = false; life.counts.cunning = true; }
  for (const p of people(life)) if (!['spouse', 'partner', 'child'].includes(p.role)) p.closeness = clamp(p.closeness - 10);
  milestone(life, L(`Di cư sang ${to.name.vi}`, `Emigrated to ${to.name.en}`), 'good');
  addLog(life, L(`Bạn rời ${from.name.vi} để bắt đầu cuộc sống mới ở ${to.name.vi}.`, `You leave ${from.name.en} for a new life in ${to.name.en}.`), 'good');
  return { text: L(`Chào mừng đến ${to.name.vi}!`, `Welcome to ${to.name.en}!`), changes: [['money', -cost]], tone: 'good' };
}

// ───────── 4 người sinh cùng giây ─────────
export function createCoborns(life) {
  const list = [];
  for (let i = 0; i < 4; i++) {
    const c = weighted(life, COUNTRIES, (x) => x.births);
    const g = chance(life, 0.5) ? 'male' : 'female';
    const pool = NAMES[c.region];
    list.push({ first: pick(life, g === 'male' ? pool.m : pool.f), last: pick(life, pool.last), gender: g, country: c.code, alive: true, age: 0, edu: 'none', job: false, married: false, kids: 0, notes: [] });
  }
  life.coborns = list;
}
export const cobornName = (cb) => (FAMILY_FIRST.has(byCode[cb.country].region) ? `${cb.last} ${cb.first}` : `${cb.first} ${cb.last}`);

export function cobornYear(life, mortality) {
  for (const cb of life.coborns || []) {
    if (!cb.alive) continue;
    cb.age = life.age;
    const c = byCode[cb.country];
    const t = tierOf(c);
    const fake = { country: cb.country, age: cb.age, stats: { health: 70 }, addicted: false };
    if (chance(life, mortality(fake, cb.age, 70))) {
      cb.alive = false;
      cb.notes.push(L(`Mất năm ${cb.age} tuổi`, `Died at ${cb.age}`));
      continue;
    }
    if (cb.age === 18) {
      const ba = { low: 0.08, mid: 0.3, high: 0.45 }[t];
      const hs = { low: 0.5, mid: 0.8, high: 0.95 }[t];
      const r = rand(life);
      cb.edu = r < ba ? 'bachelor' : r < hs ? 'highschool' : 'none';
      if (cb.edu === 'bachelor') cb.notes.push(L('Vào đại học', 'Went to university'));
      else if (cb.edu === 'none') cb.notes.push(L('Nghỉ học sớm để đi làm', 'Left school early to work'));
    }
    if (!cb.job && cb.age >= 16 && cb.age <= 30 && chance(life, 0.25)) { cb.job = true; cb.notes.push(L(`Có việc làm năm ${cb.age} tuổi`, `Got a job at ${cb.age}`)); }
    if (!cb.married && cb.age >= 18 && cb.age <= 45 && chance(life, t === 'low' ? 0.09 : 0.05)) { cb.married = true; cb.notes.push(L(`Kết hôn năm ${cb.age} tuổi`, `Married at ${cb.age}`)); }
    if (cb.married && cb.age <= 42 && chance(life, t === 'low' ? 0.22 : 0.1)) cb.kids++;
  }
}

// ───────── Sự kiện hệ thống ─────────
export function buildCrimeSys(life, item) {
  if (item.sys === 'tax_evasion') {
    return {
      uid: 'sys/tax', sys: true,
      text: L('Cơ quan điều tra phát hiện công ty bạn khai thiếu doanh thu nhiều năm.', 'Investigators find your company has under-reported revenue for years.'),
      choices: [
        { label: L('Nộp phạt và truy thu', 'Pay the fines and back taxes'), outcomes: [{ chance: 1, sysCrime: 'tax_pay', effects: { happy: -10, karma: 3 }, text: L('Bạn mất một khoản lớn nhưng giữ được tự do.', 'It costs a fortune, but you stay free.') }] },
        { label: L('Chối bỏ trách nhiệm', 'Deny everything'), outcomes: [
          { chance: 0.35, sysCrime: 'tax_escape', effects: { karma: -6 }, text: L('Hồ sơ bị chìm xuồng.', 'The case quietly disappears.') },
          { chance: 0.65, sysCrime: 'tax_jail', effects: { happy: -15, fame: -10 }, text: L('Bạn bị truy tố tội trốn thuế.', "You're prosecuted for tax evasion.") },
        ] },
      ],
    };
  }
  return null;
}
export function applyCrimeSys(life, key) {
  const b = life.biz;
  if (key === 'tax_pay') { const fine = b ? b.value * 0.3 : 0; life.money -= fine; if (b) b.evade = false; }
  if (key === 'tax_escape' && b) b.evade = false;
  if (key === 'tax_jail') { if (b) { life.money += b.value * 0.2; life.biz = null; } sentence(life, randint(life, 2, 6), L('trốn thuế', 'tax evasion')); }
}
