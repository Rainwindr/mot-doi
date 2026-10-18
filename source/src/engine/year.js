// Vòng +1 tuổi: già đi, học, làm, tiền, quan hệ, tử vong, bốc sự kiện.
import { higherEdYear } from './school.js';
import { specialYear } from './specials.js';
import { careerYear } from './career.js';
import { financeYear, petYear } from './extras.js';
import { EDU_RANK } from '../data/careers.js';
import { L, clamp, rand, chance, randint, pick } from './util.js';
import { careerById } from '../data/careers.js';
import { country, tier, unit, partner, people, byId, personName, addLog, clearFlag, milestone, lovers, polyOk } from './life.js';
import { FLAG_TTL, pickYearEvents } from './events.js';
import { economyYear, netWorth, livesInOwnHome } from './economy.js';
import { prisonYear, cobornYear } from './crime.js';
import { loveYear } from './love.js';
import { ixYear, funeral } from './intimacy.js';
import { haremYear, haremFuneral } from './harem.js';
import { worldYear } from './world.js';
import { arcYear } from './arcs.js';

/** Xác suất chết trong năm. */
export function mortality(life, age = life.age, health = life.stats.health) {
  const c = country(life);
  let q;
  if (age === 0) q = (c.u5 / 1000) * 0.65;
  else if (age < 5) q = (c.u5 / 1000) * 0.09;
  else if (age < 15) q = 0.0004 * (c.u5 / 10);
  else if (age < 40) q = 0.0012 * (82 / c.life) ** 3;
  else q = 0.02 * Math.exp(0.09 * (age - (c.life - 6.5)));
  const healthFactor = 0.55 + ((100 - health) / 100) * 1.6;
  q *= healthFactor;
  if (life.addicted) q *= 1.5;
  if (health < 20) q += ((20 - health) / 100) * 0.6;
  if (health <= 0) q = Math.max(q, 0.6);
  return clamp(q, 0, 0.95);
}

const CAUSES = {
  infant: [L('biến chứng sau sinh', 'birth complications'), L('viêm phổi', 'pneumonia'), L('sốt rét', 'malaria'), L('tiêu chảy cấp', 'severe diarrhoea')],
  young: [L('tai nạn giao thông', 'a traffic accident'), L('đuối nước', 'drowning'), L('một cơn bệnh hiếm gặp', 'a rare illness'), L('ngã từ trên cao', 'a fall')],
  mid: [L('đau tim', 'a heart attack'), L('ung thư', 'cancer'), L('đột quỵ', 'a stroke'), L('tai nạn giao thông', 'a traffic accident')],
  old: [L('tuổi già', 'old age'), L('suy tim', 'heart failure'), L('viêm phổi', 'pneumonia'), L('đột quỵ', 'a stroke'), L('ung thư', 'cancer')],
};
function causeFor(life) {
  const a = life.age;
  return pick(life, a < 5 ? CAUSES.infant : a < 35 ? CAUSES.young : a < 70 ? CAUSES.mid : CAUSES.old);
}

function natural(life) {
  const s = life.stats;
  const a = life.age;
  if (a > 40) s.health = clamp(s.health - randint(life, 0, a > 65 ? 4 : 2));
  else if (a < 18) s.health = clamp(s.health + randint(life, -1, 2));
  if (a > 35) s.looks = clamp(s.looks - randint(life, 0, a > 60 ? 2 : 1));
  else if (a >= 12 && a <= 20) s.looks = clamp(s.looks + randint(life, -3, 3));
  s.happy = clamp(s.happy + Math.round((55 - s.happy) * 0.15) + randint(life, -3, 3));
  if (life.traits.includes('genius') && a < 25) s.smarts = clamp(s.smarts + 1);
  if (life.ill) {
    s.health = clamp(s.health - life.ill.drain);
    if (life.ill.mood) s.happy = clamp(s.happy - life.ill.mood);
    if (life.ill.smarts) s.smarts = clamp(s.smarts - life.ill.smarts);
    if (life.ill.cure != null && chance(life, life.ill.cure * 0.3)) {
      addLog(life, L(`Bệnh ${life.ill.name.vi} của bạn thuyên giảm hẳn.`, `Your ${life.ill.name.en} goes into remission.`), 'good');
      life.ill = null;
    }
  }
}

function school(life) {
  const e = life.edu;
  const s = life.stats;
  const a = life.age;
  const t = tier(life);
  if (a === 6 && !e.stage && e.level === 'none') {
    e.stage = 'primary';
    addLog(life, L('Bạn bắt đầu đi học tiểu học.', 'You start primary school.'));
  } else if (a === 11 && e.stage === 'primary') {
    e.stage = 'secondary';
    addLog(life, L('Bạn lên trung học.', 'You move up to secondary school.'));
  }
  if (e.stage === 'primary' || e.stage === 'secondary') {
    s.smarts = clamp(s.smarts + randint(life, 0, 2));
    e.gpa = clamp(Math.round(e.gpa * 0.6 + s.smarts * 0.4 + randint(life, -8, 8)));
    const dropRisk = { low: 0.05, mid: 0.015, high: 0.004 }[t] * (life.wealth === 'poor' ? 2 : 1);
    if (a >= 12 && a <= 16 && chance(life, dropRisk)) {
      e.stage = null;
      addLog(life, L('Gia đình khó khăn, bạn phải nghỉ học để phụ giúp bố mẹ.', 'Money is tight. You leave school to help your family.'), 'bad');
      return;
    }
    if (a === 18 && e.stage === 'secondary') {
      e.stage = null;
      if (e.gpa >= 35 || chance(life, 0.5)) {
        e.level = 'highschool';
        milestone(life, L('Tốt nghiệp trung học', 'Finished high school'), 'good');
        life.queue.push({ sys: 'after_highschool' });
      } else {
        addLog(life, L('Bạn không đủ điểm tốt nghiệp trung học.', 'You fail to graduate from high school.'), 'bad');
      }
    }
  } else if (e.stage === 'uni' || e.stage === 'grad' || e.stage === 'trade') {
    higherEdYear(life);
  }
}

function work(life) {
  const j = life.job;
  const gdp = country(life).gdp;
  const adult = life.age >= 18 && !life.prison && !(['uni', 'grad', 'trade'].includes(life.edu.stage) && life.wealth !== 'poor');
  if (j) {
    life.money += j.salary;
    careerYear(life);
    if (life.job && (life.age >= 70 || 'retire_now' in life.flags)) {
      life.pension = Math.round(life.job.salary * 0.4);
      addLog(life, L('Bạn nghỉ hưu.', 'You retire.'), 'good');
      milestone(life, L('Nghỉ hưu', 'Retired'), 'good');
      life.job = null;
      clearFlag(life, 'retire_now');
    }
  }
  life.money += life.pension;
  if (adult) {
    const income = (j ? j.salary : 0) + life.pension;
    const withParents = people(life, 'mother').length + people(life, 'father').length > 0;
    const cost = Math.max(income ? 0.3 * gdp : withParents ? 0.05 * gdp : 0.15 * gdp, 0.6 * income);
    life.money -= life.econ && livesInOwnHome(life) ? cost * 0.75 : cost;
  }
  for (const k of people(life, 'child')) if (k.supportOnly && k.age < 18) life.money -= 0.08 * gdp;
  if (life.money < -2 * gdp && chance(life, 0.3)) {
    life.stats.happy = clamp(life.stats.happy - 10);
    addLog(life, L('Chủ nợ gọi điện đòi tiền liên tục.', 'Debt collectors keep calling.'), 'bad');
  }
}

function relations(life) {
  for (const p of life.people) {
    if (!p.alive) continue;
    p.age++;
    if (p.role !== 'child') p.closeness = clamp(p.closeness + Math.round((50 - p.closeness) * 0.05) + randint(life, -3, 1));
    const fake = { ...life, age: p.age, stats: { ...life.stats, health: 60 }, addicted: false };
    if (p.role !== 'pet' && p.age > 3 && chance(life, mortality(fake, p.age, 60))) {
      p.alive = false;
      const tag = { mother: L('Mẹ', 'Your mother'), father: L('Bố', 'Your father'), spouse: L('Vợ/chồng', 'Your spouse'), partner: L('Người yêu', 'Your partner'), child: L('Con', 'Your child'), sibling: L('Anh/chị/em', 'Your sibling') }[p.role];
      if (p.role === 'spouse') { life.flags.widowed = life.age; life.marriage = null; }
      if (tag) {
        life.stats.happy = clamp(life.stats.happy - (p.role === 'child' ? 30 : 15));
        addLog(life, L(`${tag.vi} ${personName(life, p)} qua đời ở tuổi ${p.age}.`, `${tag.en} ${personName(life, p)} dies at age ${p.age}.`), 'bad');
        if (['mother', 'father', 'spouse', 'child'].includes(p.role)) milestone(life, L(`${tag.vi} qua đời`, `${tag.en} died`), 'bad');
      }
    }
  }
  const pt = partner(life);
  if (pt) {
    pt.closeness = clamp(pt.closeness - randint(life, 0, 3));
    if (pt.closeness < 15 && chance(life, 0.4)) {
      const wasSpouse = pt.role === 'spouse';
      pt.role = 'ex';
      life.flags.recent_breakup = life.age;
      if (wasSpouse) life.counts.divorces++;
      addLog(life, L(`${personName(life, pt)} chia tay bạn vì cảm thấy bị bỏ bê.`, `${personName(life, pt)} leaves you, feeling neglected.`), 'bad');
    }
  }
  const ls = lovers(life);
  if (ls.length) {
    const gdp = country(life).gdp;
    life.money -= 0.03 * gdp * ls.length;
    if (ls.length >= 2 && !polyOk(life)) { life.stats.happy = clamp(life.stats.happy - (ls.length - 1)); life.stats.willpower = clamp(life.stats.willpower - 1); }
    if (polyOk(life)) life.counts.polyYears = (life.counts.polyYears || 0) + 1;
    const pt = partner(life);
    if (pt && !polyOk(life)) {
      const yrs = life.age - Math.min(...ls.map((x) => x.loverSince ?? life.age));
      const p = clamp(0.06 * ls.length + 0.03 * yrs - life.stats.willpower / 800 + life.stats.risk / 600 + (pt.cohab ? 0.03 : 0) - life.stats.smarts / 1000, 0.03, 0.85);
      if (chance(life, p)) life.queue.unshift({ sys: 'affair_exposed' });
    }
    for (const lv of ls) if ((lv.crazy ?? 50) > 85 && lv.closeness > 70 && pt && !polyOk(life) && chance(life, 0.08)) { life.queue.push({ sys: 'lover_ultimatum', id: lv.id }); break; }
  }
}

function expireFlags(life) {
  for (const [f, ttl] of Object.entries(FLAG_TTL)) if (f in life.flags && life.age - life.flags[f] > ttl) delete life.flags[f];
}

/** +1 tuổi. Trả về false nếu chưa thể (còn sự kiện chưa trả lời hoặc đã chết). */
export function ageUp(life, events, settings) {
  if (life.dead || life.queue.length) return false;
  life.snapshots.push(JSON.stringify({ ...life, snapshots: [] }));
  if (life.snapshots.length > 3) life.snapshots.shift();
  life.age++;
  life.yearActs = {};
  addLog(life, null);
  life.log[life.log.length - 1].items.pop();
  natural(life);
  school(life);
  work(life);
  specialYear(life);
  financeYear(life);
  petYear(life);
  relations(life);
  prisonYear(life);
  economyYear(life);
  loveYear(life);
  ixYear(life, settings);
  haremYear(life, settings);
  worldYear(life, settings);
  arcYear(life);
  cobornYear(life, mortality);
  life.counts.maxMoney = Math.max(life.counts.maxMoney, netWorth(life));
  if (life.biz) life.counts.maxBiz = Math.max(life.counts.maxBiz || 0, life.biz.value);
  if (life.pregnancy && life.pregnancy.age < life.age) life.queue.unshift({ sys: 'pregnancy' });
  if (chance(life, mortality(life))) {
    die(life);
    return true;
  }
  expireFlags(life);
  for (const u of pickYearEvents(life, events, settings)) life.queue.push({ uid: u });
  recordHistory(life);
  return true;
}

export function recordHistory(life) {
  life.hist = life.hist || [];
  life.hist.push({ age: life.age, health: life.stats.health, happy: life.stats.happy, smarts: life.stats.smarts, looks: life.stats.looks, worth: Math.round(netWorth(life)) });
}

export function die(life, cause) {
  recordHistory(life);
  life.dead = true;
  life.queue = [];
  life.cause = cause || causeFor(life);
  addLog(life, L(`Bạn qua đời ở tuổi ${life.age} vì ${life.cause.vi}.`, `You die at age ${life.age} from ${life.cause.en}.`), 'bad');
  funeral(life);
  const hf = haremFuneral(life);
  if (hf) { (life.funeral ||= []).push(hf); addLog(life, hf); }
  life.ribbons = ribbonsFor(life);
}

// ───────── Ribbon tổng kết đời ─────────
export const RIBBONS = {
  loaded: { name: L('Đại gia', 'Loaded'), why: L('Tài sản vượt 200 lần thu nhập trung bình', 'Wealth above 200× the average income') },
  rich: { name: L('Khá giả', 'Well-off'), why: L('Tài sản vượt 20 lần thu nhập trung bình', 'Wealth above 20× the average income') },
  academic: { name: L('Học giả', 'Academic'), why: L('Có bằng đại học và trí tuệ cao', 'A degree and high smarts') },
  fertile: { name: L('Con đàn cháu đống', 'Fertile'), why: L('Có từ 4 con trở lên', 'Four or more children') },
  heartbreaker: { name: L('Kẻ phản bội', 'Heartbreaker'), why: L('Ngoại tình bị phát hiện', 'An affair came to light') },
  casanova: { name: L('Cao thủ bắt cá', 'Smooth operator'), why: L('Có 3 người tình cùng lúc mà chưa từng bị lộ', 'Had 3 lovers at once and never got caught') },
  bigheart: { name: L('Trái tim rộng', 'Big heart'), why: L('Sống đa ái công khai trên 10 năm', 'Lived openly polyamorous for over 10 years') },
  caught: { name: L('Bị bắt tại trận', 'Caught red-handed'), why: L('Bị lộ cùng lúc từ 2 người tình trở lên', 'Exposed with two or more lovers at once') },
  playboy: { name: L('Phong lưu', 'Free spirit'), why: L('Từ 8 cuộc tình một đêm trở lên', 'Eight or more one-night stands') },
  longlived: { name: L('Trường thọ', 'Long-lived'), why: L('Sống hơn tuổi thọ trung bình 15 năm', 'Outlived the national average by 15 years') },
  saint: { name: L('Người tốt', 'Saint'), why: L('Karma trên 85', 'Karma above 85') },
  famous: { name: L('Người nổi tiếng', 'Famous'), why: L('Danh tiếng trên 70', 'Fame above 70') },
  lazy: { name: L('Lười biếng', 'Lazy'), why: L('Chưa từng đi làm', 'Never held a job') },
  short: { name: L('Đời ngắn ngủi', 'Brief'), why: L('Mất trước 18 tuổi', 'Died before 18') },
  jailbird: { name: L('Chim lồng', 'Jailbird'), why: L('Ngồi tù từ 10 năm trở lên', 'Ten or more years behind bars') },
  houdini: { name: L('Houdini', 'Houdini'), why: L('Vượt ngục từ 3 lần', 'Escaped prison three or more times') },
  thief: { name: L('Tay anh chị', 'Outlaw'), why: L('Phạm tội từ 10 lần', 'Ten or more crimes') },
  cunning: { name: L('Cáo già', 'Cunning'), why: L('Vượt ngục rồi trốn ra nước ngoài', 'Escaped prison and fled abroad') },
  tycoon: { name: L('Ông trùm', 'Tycoon'), why: L('Từng điều hành công ty lớn', 'Built a big company') },
  nomad: { name: L('Du mục', 'Nomad'), why: L('Sống ở từ 3 nước', 'Lived in three or more countries') },
  golddigger: { name: L('Đào mỏ', 'Gold digger'), why: L('Cưới hoặc hẹn hò nhiều người giàu', 'Married or dated big money') },
  devoted: { name: L('Thủy chung', 'Devoted'), why: L('Một cuộc hôn nhân kéo dài 40 năm', 'One marriage lasting 40 years') },
  serial: { name: L('Hôn nhân chớp nhoáng', 'Serial spouse'), why: L('Ly hôn từ 3 lần', 'Divorced three or more times') },
  nolimits: { name: L('Không có gì là cấm', 'Nothing off-limits'), why: L('Đã thử từ 20 điều mới trở lên', 'Tried 20 or more new things') },
  carer: { name: L('Bậc thầy chăm sóc', 'Aftercare expert'), why: L('Chăm sóc người ấy sau cảnh từ 30 lần', 'Gave aftercare 30 or more times') },
  posmaster: { name: L('Bậc thầy sổ tay', 'Handbook master'), why: L('Đã thử đủ 36/36 tư thế', 'Tried all 36 positions') },
  sugarlegend: { name: L('Sugar huyền thoại', 'Sugar legend'), why: L('Bao bọc từ 5 sugar baby', 'Kept five or more sugar babies') },
  harem: { name: L('Hậu cung', 'Harem'), why: L('Giữ hậu cung từ 4 người trở lên trong 10 năm', 'Kept a harem of 4+ for 10 years') },
  peace: { name: L('Thái bình thịnh trị', 'Golden age'), why: L('Hậu cung trên 5 năm, Hòa hợp chưa bao giờ dưới 50', 'A harem for 5+ years, harmony never below 50') },
  coup: { name: L('Sống sót qua cung đấu', 'Survived the palace intrigue'), why: L('Dập tắt một cuộc đảo chính trong nhà', 'Crushed a coup at home') },
  island: { name: L('Chủ đảo', 'Island ruler'), why: L('Có hậu cung trên đảo riêng', 'Kept a harem on a private island') },
  crowdfuneral: { name: L('Đám tang đông nhất', 'Packed funeral'), why: L('Từ 5 người tình dự đám tang', 'Five or more lovers at the funeral') },
  mediocre: { name: L('Bình thường', 'Ordinary'), why: L('Một đời không có gì đặc biệt', 'An unremarkable life') },
};

export function ribbonsFor(life) {
  const gdp = country(life).gdp;
  const r = [];
  if (life.age < 18) r.push('short');
  if (life.counts.maxMoney > 200 * gdp) r.push('loaded');
  else if (life.counts.maxMoney > 20 * gdp) r.push('rich');
  if (EDU_RANK[life.edu.level] >= 2 && life.stats.smarts >= 80) r.push('academic');
  if (life.counts.children >= 4) r.push('fertile');
  if (life.counts.affairsExposed > 0) r.push('heartbreaker');
  if ((life.counts.maxLovers || 0) >= 3 && !life.counts.affairsExposed && !life.counts.multiExposed) r.push('casanova');
  if ((life.counts.polyYears || 0) >= 10) r.push('bigheart');
  if (life.counts.multiExposed) r.push('caught');
  if (life.counts.ons >= 8) r.push('playboy');
  if (life.age >= country(life).life + 15) r.push('longlived');
  if (life.stats.karma > 85) r.push('saint');
  if (life.stats.fame > 70) r.push('famous');
  if (life.age >= 30 && !life.jobHistory && !life.counts.businesses) r.push('lazy');
  if ((life.counts.prisonYears || 0) >= 10) r.push('jailbird');
  if ((life.counts.escapes || 0) >= 3) r.push('houdini');
  if ((life.counts.crimes || 0) >= 10) r.push('thief');
  if (life.counts.cunning) r.push('cunning');
  if ((life.counts.moves || 0) >= 2) r.push('nomad');
  if ((life.counts.sugarMarried || 0) >= 1 || (life.counts.sugar || 0) >= 2) r.push('golddigger');
  if (life.marriage && life.age - life.marriage.since >= 40 && !life.counts.affairsExposed) r.push('devoted');
  if (life.counts.divorces >= 3) r.push('serial');
  if ((life.counts.maxBiz || 0) > 50 * gdp) r.push('tycoon');
  const ix = life.ix;
  if (ix) {
    if (ix.tried.length >= 20) r.push('nolimits');
    if (ix.care >= 30) r.push('carer');
    if (ix.pos.length >= 36) r.push('posmaster');
    if (ix.babies >= 5) r.push('sugarlegend');
  }
  if ((life.counts.funeralLovers || 0) >= 5) r.push('crowdfuneral');
  const hh = life.harem;
  if (hh) {
    if (hh.years4 >= 10) r.push('harem');
    if (hh.years >= 5 && hh.minHarm >= 50) r.push('peace');
    if (hh.coup) r.push('coup');
    if (hh.house === 'island' && hh.members.length) r.push('island');
  }
  // Đời tùy chỉnh (God Mode / Tự do) không nhận ribbon khó
  const HARD = ['loaded', 'academic', 'longlived', 'saint', 'famous', 'tycoon', 'houdini', 'cunning'];
  const out = life.customized ? r.filter((k) => !HARD.includes(k)) : r;
  if (!out.length) out.push('mediocre');
  return out;
}
