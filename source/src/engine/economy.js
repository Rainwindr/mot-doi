// Kinh tế: chu kỳ toàn cầu, đầu tư, nhà, xe, công ty. Mọi giá trị tiền tính bằng USD.
import { L, clamp, rand, chance, randint, pick } from './util.js';
import { country, tier, addLog, people, milestone } from './life.js';

// ───────── Chu kỳ kinh tế ─────────
export const PHASES = {
  growth: { name: L('Tăng trưởng', 'Growth'), ret: 0.08, house: 0.05, biz: 0.06, years: [3, 7] },
  peak: { name: L('Đỉnh', 'Peak'), ret: 0.03, house: 0.03, biz: 0.03, years: [1, 2] },
  recession: { name: L('Suy thoái', 'Recession'), ret: -0.1, house: -0.04, biz: -0.06, years: [1, 2] },
  crisis: { name: L('Khủng hoảng', 'Crisis'), ret: -0.3, house: -0.15, biz: -0.18, years: [1, 2] },
};
const NEXT = { growth: 'peak', peak: 'recession', recession: 'growth', crisis: 'growth' };

// Tài sản đầu tư. price là chỉ số trừu tượng (khởi điểm 100); số lượng nắm giữ = USD bỏ vào / giá lúc mua.
export const ASSETS = {
  savings: { name: L('Tiết kiệm ngân hàng', 'Savings account'), risk: L('An toàn', 'Safe') },
  index: { name: L('Quỹ chỉ số', 'Index fund'), risk: L('Vừa', 'Medium') },
  gold: { name: L('Vàng', 'Gold'), risk: L('Thấp–vừa', 'Low–medium') },
  tech: { name: L('Cổ phiếu Novatek', 'Novatek shares'), risk: L('Cao', 'High'), sector: L('Công nghệ', 'Tech') },
  bank: { name: L('Cổ phiếu Ngân hàng Hưng Phát', 'Hung Phat Bank shares'), risk: L('Vừa–cao', 'Medium–high'), sector: L('Ngân hàng', 'Banking') },
  energy: { name: L('Cổ phiếu Năng lượng Sao Mai', 'Sao Mai Energy shares'), risk: L('Vừa–cao', 'Medium–high'), sector: L('Năng lượng', 'Energy') },
  crypto: { name: L('Tiền mã hóa', 'Crypto'), risk: L('Rất cao', 'Very high') },
};
const BETA = { index: 1, tech: 1.6, bank: 1.2, energy: 0.9 };
const VOL = { index: 0.1, tech: 0.32, bank: 0.22, energy: 0.2 };

export const HOMES = [
  { id: 'studio', name: L('Căn hộ studio', 'Studio flat'), x: 3 },
  { id: 'apartment', name: L('Căn hộ 2 phòng ngủ', 'Two-bed apartment'), x: 6 },
  { id: 'house', name: L('Nhà phố', 'Townhouse'), x: 12 },
  { id: 'villa', name: L('Biệt thự', 'Villa'), x: 40 },
];
export const CARS = [
  { id: 'scooter', name: L('Xe máy', 'Scooter'), x: 0.15, looks: 0, happy: 3 },
  { id: 'used', name: L('Ô tô cũ', 'Used car'), x: 0.5, looks: 1, happy: 5 },
  { id: 'family', name: L('Ô tô gia đình', 'Family car'), x: 1.2, looks: 2, happy: 7 },
  { id: 'luxury', name: L('Xe sang', 'Luxury car'), x: 4, looks: 5, happy: 12 },
];
export const INDUSTRIES = [
  { id: 'food', name: L('Quán ăn', 'Restaurant'), x: 0.6, mean: 0.06, vol: 0.18 },
  { id: 'fashion', name: L('Cửa hàng thời trang', 'Fashion boutique'), x: 0.8, mean: 0.05, vol: 0.22 },
  { id: 'bar', name: L('Quán bar', 'Bar'), x: 1, mean: 0.07, vol: 0.25 },
  { id: 'tech', name: L('Công ty công nghệ', 'Tech startup'), x: 1.5, mean: 0.04, vol: 0.45 },
  { id: 'realestate', name: L('Công ty bất động sản', 'Property firm'), x: 3, mean: 0.06, vol: 0.2 },
];
export const MORTGAGE_RATE = 0.06;

// Phân phối chuẩn xấp xỉ (tổng 3 số đều).
const noise = (s, sd) => ((rand(s) + rand(s) + rand(s)) / 1.5 - 1) * sd * 1.73;

export function initEconomy(life) {
  life.econ = { phase: 'growth', left: randint(life, 2, 6), prices: { index: 100, gold: 100, tech: 100, bank: 100, energy: 100, crypto: 100 }, house: 1, history: [] };
  life.port = { savings: 0, units: {} };
  life.homes = [];
  life.cars = [];
  life.biz = null;
}

/** Cập nhật thị trường mỗi năm. Trả về lợi nhuận quỹ chỉ số để ghi nhật ký. */
function marketYear(life) {
  const e = life.econ;
  if (--e.left <= 0) {
    e.phase = e.phase === 'peak' && chance(life, 0.25) ? 'crisis' : NEXT[e.phase];
    const [a, b] = PHASES[e.phase].years;
    e.left = randint(life, a, b);
    addLog(life, L(`Kinh tế thế giới bước vào giai đoạn ${PHASES[e.phase].name.vi.toLowerCase()}.`, `The world economy enters a ${PHASES[e.phase].name.en.toLowerCase()}.`), e.phase === 'growth' ? 'good' : e.phase === 'crisis' ? 'bad' : undefined);
  }
  const ph = PHASES[e.phase];
  const p = e.prices;
  const base = ph.ret;
  for (const k of ['index', 'tech', 'bank', 'energy']) {
    let r = base * BETA[k] + noise(life, VOL[k]);
    if (k !== 'index' && chance(life, 0.02)) r = -0.7; // bê bối, phá sản một phần
    p[k] = Math.max(1, p[k] * (1 + r));
  }
  p.gold = Math.max(1, p.gold * (1 + (e.phase === 'recession' || e.phase === 'crisis' ? 0.08 : 0.01) + noise(life, 0.08)));
  const cr = chance(life, 0.15) ? -0.7 : 0.15 + noise(life, 0.6);
  p.crypto = Math.max(0.5, p.crypto * (1 + cr));
  e.house = Math.max(0.3, e.house * (1 + ph.house + noise(life, 0.04)));
  e.history.push({ age: life.age, phase: e.phase, index: Math.round(p.index) });
  if (e.history.length > 40) e.history.shift();
}

export const savingsRate = (life) => ({ low: 0.06, mid: 0.04, high: 0.02 })[tier(life)];
export const holdingValue = (life, k) => (k === 'savings' ? life.port.savings : (life.port.units[k] || 0) * life.econ.prices[k]);
export const portfolioValue = (life) => Object.keys(ASSETS).reduce((s, k) => s + holdingValue(life, k), 0);
export const homesValue = (life) => life.homes.reduce((s, h) => s + h.value - h.debt, 0);
export const carsValue = (life) => life.cars.reduce((s, c) => s + c.value, 0);
export function netWorth(life) {
  if (!life.econ) return life.money;
  return life.money + portfolioValue(life) + homesValue(life) + carsValue(life) + (life.biz ? life.biz.value : 0);
}
export const livesInOwnHome = (life) => life.homes.some((h) => !h.rented);

/** Phần kinh tế của vòng +1 tuổi. */
export function economyYear(life) {
  if (!life.econ) initEconomy(life);
  marketYear(life);
  const gdp = country(life).gdp;
  // Lãi tiết kiệm
  life.port.savings *= 1 + savingsRate(life);
  // Nhà: giá theo thị trường, trả nợ vay, thu tiền thuê
  for (const h of life.homes) {
    h.value = Math.round(h.base * life.econ.house);
    if (h.debt > 0) {
      const pay = Math.min(h.debt, h.debt * MORTGAGE_RATE + h.loan * 0.05);
      life.money -= pay;
      h.debt = Math.max(0, h.debt - (pay - h.debt * MORTGAGE_RATE));
    }
    life.money -= h.value * 0.01; // phí duy trì
    if (h.rented) life.money += h.value * 0.05;
  }
  // Xe mất giá
  for (const c of life.cars) { c.value *= 0.85; life.money -= c.value * 0.05; }
  // Công ty
  const b = life.biz;
  if (b) {
    const ind = INDUSTRIES.find((i) => i.id === b.ind);
    const r = ind.mean + PHASES[life.econ.phase].biz + (life.stats.smarts - 50) / 500 + (b.boost || 0) + noise(life, ind.vol);
    const profit = b.value * r;
    b.boost = 0;
    b.years++;
    b.lastProfit = profit;
    b.value = Math.max(0, b.value + profit * 0.5);
    const payout = profit > 0 ? profit * 0.5 : 0;
    life.money += payout;
    if (b.evade && profit > 0) {
      life.money += profit * 0.15;
      if (chance(life, 0.18)) { life.queue.unshift({ sys: 'tax_evasion' }); }
    }
    if (b.value < b.start * 0.1) {
      milestone(life, L('Công ty phá sản', 'Company went bankrupt'), 'bad');
      addLog(life, L(`${ind.name.vi} của bạn phá sản.`, `Your ${ind.name.en.toLowerCase()} goes bankrupt.`), 'bad');
      life.stats.happy = clamp(life.stats.happy - 15);
      life.counts.bankrupt = (life.counts.bankrupt || 0) + 1;
      life.biz = null;
    } else if (b.years % 3 === 0) {
      addLog(life, L(`Công ty của bạn ${profit >= 0 ? 'có lãi' : 'thua lỗ'} năm nay, định giá khoảng ${Math.round(b.value / gdp * 10) / 10} lần thu nhập trung bình.`, `Your company ${profit >= 0 ? 'turned a profit' : 'lost money'} this year, now valued at about ${Math.round(b.value / gdp * 10) / 10}× the average income.`), profit >= 0 ? 'good' : 'bad');
    }
  }
}

// ───────── Hành động người chơi ─────────
const ok = (text, tone) => ({ text, changes: [], tone });

export function invest(life, key, usd) {
  usd = Math.min(usd, life.money);
  if (usd <= 0) return ok(L('Bạn không có tiền mặt để đầu tư.', 'You have no cash to invest.'), 'bad');
  life.money -= usd;
  if (key === 'savings') life.port.savings += usd;
  else life.port.units[key] = (life.port.units[key] || 0) + usd / life.econ.prices[key];
  return { text: L(`Bạn bỏ tiền vào ${ASSETS[key].name.vi.toLowerCase()}.`, `You put money into ${ASSETS[key].name.en.toLowerCase()}.`), changes: [['money', -usd]] };
}
export function divest(life, key) {
  const v = holdingValue(life, key);
  if (v <= 0) return ok(L('Bạn không nắm giữ khoản này.', "You don't hold this."));
  if (key === 'savings') life.port.savings = 0;
  else life.port.units[key] = 0;
  life.money += v;
  return { text: L(`Bạn bán toàn bộ ${ASSETS[key].name.vi.toLowerCase()}.`, `You sell all your ${ASSETS[key].name.en.toLowerCase()}.`), changes: [['money', v]] };
}

export const homePrice = (life, h) => Math.round(h.x * country(life).gdp * life.econ.house);
export function buyHome(life, id, mortgage) {
  const h = HOMES.find((x) => x.id === id);
  const price = homePrice(life, h);
  const down = mortgage ? price * 0.2 : price;
  if (life.age < 18) return ok(L('Bạn chưa đủ tuổi mua nhà.', "You're too young to buy property."), 'bad');
  if (life.money < down) return ok(L(`Bạn cần ít nhất ${mortgage ? '20% trả trước' : 'đủ tiền mặt'}.`, `You need ${mortgage ? 'a 20% deposit' : 'the full price in cash'}.`), 'bad');
  if (mortgage && !life.job && !life.biz) return ok(L('Ngân hàng không cho vay khi bạn không có thu nhập.', "The bank won't lend without an income."), 'bad');
  if (mortgage && life.record && chance(life, 0.5)) return ok(L('Ngân hàng từ chối vì tiền án của bạn.', 'The bank refuses because of your criminal record.'), 'bad');
  life.money -= down;
  const debt = price - down;
  life.homes.push({ id, base: Math.round(price / life.econ.house), value: price, debt, loan: debt, rented: false });
  milestone(life, L(`Mua ${h.name.vi.toLowerCase()}`, `Bought a ${h.name.en.toLowerCase()}`), 'good');
  addLog(life, L(`Bạn mua ${h.name.vi.toLowerCase()}${mortgage ? ' bằng vay thế chấp' : ''}.`, `You buy a ${h.name.en.toLowerCase()}${mortgage ? ' with a mortgage' : ''}.`), 'good');
  life.stats.happy = clamp(life.stats.happy + 10);
  return { text: L(`Bạn có ${h.name.vi.toLowerCase()} mới!`, `You've bought a ${h.name.en.toLowerCase()}!`), changes: [['money', -down], ['happy', 10]], tone: 'good' };
}
export function sellHome(life, idx) {
  const h = life.homes[idx];
  if (!h) return null;
  const net = h.value * 0.97 - h.debt;
  life.money += net;
  life.homes.splice(idx, 1);
  return { text: L('Bạn bán căn nhà.', 'You sell the property.'), changes: [['money', net]] };
}
export function toggleRent(life, idx) {
  const h = life.homes[idx];
  if (!h) return null;
  h.rented = !h.rented;
  return ok(h.rented ? L('Bạn cho thuê căn nhà, mỗi năm thu khoảng 5% giá trị.', 'You rent it out for about 5% of its value a year.') : L('Bạn dọn về ở căn nhà này.', 'You move into this property.'));
}

export function buyCar(life, id) {
  const c = CARS.find((x) => x.id === id);
  const price = c.x * country(life).gdp;
  if (life.age < 16) return ok(L('Bạn chưa đủ tuổi.', "You're too young."), 'bad');
  if (life.money < price) return ok(L('Bạn không đủ tiền.', "You can't afford it."), 'bad');
  life.money -= price;
  life.cars.push({ id, value: price });
  life.stats.happy = clamp(life.stats.happy + c.happy);
  life.stats.looks = clamp(life.stats.looks + c.looks);
  return { text: L(`Bạn mua ${c.name.vi.toLowerCase()}.`, `You buy a ${c.name.en.toLowerCase()}.`), changes: [['money', -price], ['happy', c.happy]], tone: 'good' };
}
export function sellCar(life, idx) {
  const c = life.cars[idx];
  if (!c) return null;
  life.money += c.value * 0.9;
  life.cars.splice(idx, 1);
  return { text: L('Bạn bán chiếc xe.', 'You sell the vehicle.'), changes: [['money', c.value * 0.9]] };
}

export const bizCapital = (life, ind) => ind.x * country(life).gdp;
export function startBiz(life, id) {
  const ind = INDUSTRIES.find((x) => x.id === id);
  const cap = bizCapital(life, ind);
  if (life.age < 18) return ok(L('Bạn chưa đủ tuổi mở công ty.', "You're too young to start a company."), 'bad');
  if (life.biz) return ok(L('Bạn đang điều hành một công ty rồi.', 'You already run a company.'));
  if (life.prison) return ok(L('Không thể khi đang ngồi tù.', 'Not while in prison.'), 'bad');
  if (life.money < cap) return ok(L('Bạn không đủ vốn.', "You don't have the capital."), 'bad');
  life.money -= cap;
  life.biz = { ind: id, value: cap, start: cap, years: 0, boost: 0, evade: false, lastProfit: 0 };
  life.counts.businesses = (life.counts.businesses || 0) + 1;
  milestone(life, L(`Mở ${ind.name.vi.toLowerCase()}`, `Opened a ${ind.name.en.toLowerCase()}`), 'good');
  addLog(life, L(`Bạn mở ${ind.name.vi.toLowerCase()}.`, `You open a ${ind.name.en.toLowerCase()}.`), 'good');
  return { text: L(`${ind.name.vi} của bạn khai trương!`, `Your ${ind.name.en.toLowerCase()} opens its doors!`), changes: [['money', -cap]], tone: 'good' };
}
export function bizAction(life, act) {
  const b = life.biz;
  if (!b) return null;
  const gdp = country(life).gdp;
  const key = `biz:${act}`;
  const n = (life.yearActs[key] = (life.yearActs[key] || 0) + 1);
  switch (act) {
    case 'invest': {
      const amt = Math.min(life.money, 0.5 * gdp);
      if (amt <= 0) return ok(L('Bạn không có tiền mặt.', 'No cash available.'), 'bad');
      life.money -= amt; b.value += amt; b.start += amt * 0.5;
      return { text: L('Bạn rót thêm vốn vào công ty.', 'You inject more capital.'), changes: [['money', -amt]] };
    }
    case 'marketing': {
      if (n > 1) return ok(L('Năm nay đã chạy quảng cáo rồi.', 'You already ran a campaign this year.'));
      const amt = b.value * 0.05;
      if (life.money < amt) return ok(L('Bạn không đủ tiền chạy quảng cáo.', "You can't afford a campaign."), 'bad');
      life.money -= amt; b.boost = 0.06 + rand(life) * 0.06;
      return { text: L('Chiến dịch quảng cáo bắt đầu. Kết quả sẽ thấy vào năm sau.', 'The campaign launches. Results show next year.'), changes: [['money', -amt]] };
    }
    case 'evade':
      b.evade = !b.evade;
      if (b.evade) life.stats.karma = clamp(life.stats.karma - 8);
      return ok(b.evade ? L('Bạn bắt đầu khai thiếu doanh thu. Lời nhiều hơn, nhưng có thể bị điều tra.', 'You start under-reporting revenue. More profit, but you may be investigated.') : L('Bạn quay lại khai thuế đầy đủ.', 'You go back to paying full taxes.'), b.evade ? 'bad' : undefined);
    case 'sell': {
      const v = b.value * 0.9;
      life.money += v; life.biz = null;
      addLog(life, L('Bạn bán lại công ty.', 'You sell your company.'), 'good');
      return { text: L('Bạn bán công ty.', 'You sell the company.'), changes: [['money', v]], tone: 'good' };
    }
    case 'close': {
      const v = b.value * 0.3;
      life.money += v; life.biz = null;
      addLog(life, L('Bạn đóng cửa công ty.', 'You close your company.'));
      return { text: L('Bạn đóng cửa công ty, thu về một ít tiền thanh lý.', 'You close the company and recover a little.'), changes: [['money', v]] };
    }
  }
  return null;
}

export { people, pick };
