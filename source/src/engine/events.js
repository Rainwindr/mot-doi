// Sự kiện: lọc theo điều kiện, áp dụng kết quả, và các sự kiện hệ thống (mang thai, ngoại tình bị lộ, sau tốt nghiệp...).
import { L, clamp, rand, chance, randint, pick, weighted } from './util.js';
import { STATS } from './validate.js';
import { portfolioValue } from './economy.js';
import { majorEvent, tradeEvent } from './school.js';
import { illnessById } from '../data/illness.js';
import {
  country, tier, unit, partner, spouse, people, byId, randomPerson, partnerGender, personName,
  addLog, setFlag, clearFlag, readStat, adjustRel, milestone,
} from './life.js';

// Cờ tạm thời: hết hạn sau số năm này nếu không sự kiện nào xóa.
export const FLAG_TTL = { recent_intimate: 1, recent_breakup: 2, ons_potential: 2, ons_happened: 3, ons_awkward: 2, uni_ons: 2, uni_party_met: 2, widowed: 3 };
const INTIMATE_FLAGS = ['recent_intimate', 'ons_happened', 'uni_ons', 'uni_intimate'];
const ONS_FLAGS = ['ons_happened', 'uni_ons'];

export function eligible(ev, life, settings) {
  if (ev.rating === '25+' && !settings.adult25) return false;
  if (life.age < ev.age[0] || life.age > ev.age[1]) return false;
  if (ev.once && life.done.includes(ev.uid)) return false;
  const r = ev.requires || {};
  if (r.gender && r.gender !== 'any' && r.gender !== life.gender) return false;
  if (r.partnerGender && r.partnerGender !== 'any') {
    const pt = partner(life);
    if (!pt || pt.gender !== r.partnerGender) return false;
  }
  const bools = {
    inSchool: !!life.edu.stage,
    employed: !!life.job,
    hasPartner: !!partner(life),
    married: !!spouse(life),
    hasChildren: people(life, 'child').length > 0,
    inPrison: !!life.prison,
    hasBusiness: !!life.biz,
    ownsHome: (life.homes || []).length > 0,
    fugitive: !!life.fugitive,
    hasRecord: !!life.record,
    engaged: !!partner(life)?.engaged,
    cohabiting: !!partner(life)?.cohab,
    addicted: !!life.addicted,
    pregnant: !!(life.pregnancy && life.pregnancy.carrier === 'self'),
    hasAffair: !!life.affair,
  };
  for (const k of Object.keys(bools)) if (k in r && r[k] !== bools[k]) return false;
  if (r.incomeTier && !r.incomeTier.includes(tier(life))) return false;
  if (r.eduStage && !r.eduStage.includes(life.edu.stage)) return false;
  if (r.job && !(life.job && r.job.includes(life.job.id))) return false;
  if ('retired' in r && r.retired !== (!life.job && life.pension > 0)) return false;
  if ('ill' in r && r.ill !== !!life.ill) return false;
  if (r.childAge && !people(life, 'child').some((k) => k.alive && k.age >= r.childAge[0] && k.age <= r.childAge[1])) return false;
  if (r.major && !(r.major.includes(life.edu.major) || (life.edu.degrees || []).some((d) => r.major.includes(d.major)))) return false;
  for (const [k, v] of Object.entries(r.min || {})) if (readStat(life, k) < v) return false;
  for (const [k, v] of Object.entries(r.max || {})) if (readStat(life, k) > v) return false;
  for (const f of r.flags || []) if (!(f in life.flags)) return false;
  for (const f of r.notFlags || []) if (f in life.flags) return false;
  if (ev.choices && ev.choices.every((c) => choiceLocked(life, c))) return false;
  return true;
}

/** Lựa chọn bị khóa khi chưa đủ chỉ số (requires.min / requires.max của lựa chọn). */
export function choiceLocked(life, c) {
  const r = c && c.requires;
  if (!r) return false;
  for (const [k, v] of Object.entries(r.min || {})) if (readStat(life, k) < v) return true;
  for (const [k, v] of Object.entries(r.max || {})) if (readStat(life, k) > v) return true;
  return false;
}

/** Bốc 0–2 sự kiện cho năm nay. Trọng số được chuẩn hóa theo gói để gói lớn không lấn át gói khác. */
export function pickYearEvents(life, events, settings) {
  const pool = events.filter((e) => eligible(e, life, settings));
  if (!pool.length) return [];
  const perPack = {};
  for (const e of pool) perPack[e.pack] = (perPack[e.pack] || 0) + e.weight;
  const w = (e) => (e.weight / perPack[e.pack]) * Math.sqrt(perPack[e.pack]) * (settings.packWeight?.[e.pack] ?? 1) * (e.big ? 0.22 : 1);
  const n = weighted(life, [0, 1, 2], (k) => [6, 54, 40][k]);
  const out = [];
  const left = [...pool];
  for (let i = 0; i < n && left.length; i++) {
    const e = weighted(life, left, w);
    out.push(e.uid);
    left.splice(left.indexOf(e), 1);
  }
  return out;
}

export function pickOutcome(life, outcomes) {
  let r = rand(life);
  for (const o of outcomes) {
    r -= o.chance;
    if (r <= 0) return o;
  }
  return outcomes[outcomes.length - 1];
}

function ensureContact(life) {
  let c = life.lastContactId && byId(life, life.lastContactId);
  if (!c || !c.alive) c = newContact(life);
  return c;
}
export function newContact(life) {
  const age = clamp(life.age + randint(life, -6, 6), 18, 90);
  const p = randomPerson(life, life, { role: 'contact', gender: partnerGender(life, life), age, closeness: 30 });
  life.people.push(p);
  life.lastContactId = p.id;
  return p;
}

/** Thụ thai: cần một nam một nữ, người mang thai dưới 48 tuổi. Chưa báo tin cho đến năm sau. */
export function tryConceive(life, other, p) {
  if (!other || life.pregnancy || other.gender === life.gender) return false;
  const carrierAge = life.gender === 'female' ? life.age : other.age;
  if (carrierAge > 48 || carrierAge < 18) return false;
  const ageFactor = carrierAge > 40 ? 0.35 : carrierAge > 35 ? 0.7 : 1;
  if (!chance(life, p * ageFactor)) return false;
  life.pregnancy = { carrier: life.gender === 'female' ? 'self' : 'other', otherId: other.id, age: life.age };
  return true;
}

export const protectChance = (protect) => (protect ? 0.02 : 0.18);

/** Áp dụng effects (đã chuẩn hóa) lên đời. Trả về danh sách thay đổi để hiển thị. */
export function applyEffects(life, effects = {}, ctx = {}) {
  const changes = [];
  for (const [k, v] of Object.entries(effects)) {
    if (STATS.includes(k)) {
      const before = life.stats[k];
      life.stats[k] = clamp(before + v);
      if (life.stats[k] !== before) changes.push([k, life.stats[k] - before]);
    } else if (k === 'money') {
      life.money += v * unit(life);
      changes.push(['money', v * unit(life)]);
    } else if (k.startsWith('rel_')) {
      adjustRel(life, k.slice(4), v);
      changes.push([k, v]);
    }
  }
  if (effects.jobPerf && life.job) { life.job.perf = clamp(life.job.perf + effects.jobPerf); changes.push(['perf', effects.jobPerf]); }
  if (effects.salaryPct && life.job) { const d = Math.round(life.job.salary * effects.salaryPct / 100); life.job.salary += d; changes.push(['salary', d]); }
  if (effects.illness && illnessById[effects.illness] && !life.ill) { const x = illnessById[effects.illness]; life.ill = { id: x.id, name: x.name, drain: x.drain, mood: x.mood, smarts: x.smarts, cure: x.cure }; addLog(life, L(`Bạn được chẩn đoán ${x.name.vi}.`, `You're diagnosed with ${x.name.en}.`), 'bad'); }
  if (effects.cure && life.ill) life.ill = null;
  if (effects.retire && life.job) life.flags.retire_now = life.age;
  if (effects.loseJob && life.job) { life.job = null; addLog(life, L('Bạn mất việc.', 'You lose your job.'), 'bad'); }
  if (effects.newContact) {
    newContact(life);
    life.counts.ons++;
  }
  if (effects.breakup) breakUp(life, 'event');
  if (effects.divorce) breakUp(life, 'event');
  if (effects.startAffair) startAffair(life);
  if (effects.affairExposed && life.affair) life.queue.unshift({ sys: 'affair_exposed' });
  if (effects.pregnancyChance != null) {
    const other = ctx.ons ? ensureContact(life) : partner(life) || ensureContact(life);
    tryConceive(life, other, effects.pregnancyChance);
  }
  return changes;
}

/** Áp dụng một kết quả của sự kiện gói. */
export function applyOutcome(life, ev, outcome, settings) {
  const sets = outcome.setFlags || [];
  const ons = sets.some((f) => ONS_FLAGS.includes(f));
  if (ons && !outcome.effects?.newContact) {
    newContact(life);
    life.counts.ons++;
  }
  const changes = applyEffects(life, outcome.effects, { ons });
  for (const f of outcome.clearFlags || []) clearFlag(life, f);
  for (const f of sets) setFlag(life, f);
  // Cảnh thân mật không ghi rõ biện pháp: dùng cài đặt "Luôn dùng biện pháp".
  if (outcome.effects?.pregnancyChance == null && sets.some((f) => INTIMATE_FLAGS.includes(f))) {
    const other = ons ? ensureContact(life) : partner(life) || ensureContact(life);
    tryConceive(life, other, protectChance(settings.alwaysProtect));
  }
  resolveEngineFlags(life);
  return changes;
}

/** Gói bật cờ "in_relationship"/"uni_dating" nghĩa là thành người yêu chính thức. */
export function resolveEngineFlags(life) {
  for (const f of ['in_relationship', 'uni_dating']) {
    if (!(f in life.flags)) continue;
    clearFlag(life, f);
    if (partner(life)) continue;
    const c = life.lastContactId && byId(life, life.lastContactId);
    const p = c && c.alive && c.role === 'contact' ? c : randomPerson(life, life, { role: 'partner', gender: partnerGender(life, life), age: clamp(life.age + randint(life, -4, 4), 18, 90) });
    if (!life.people.includes(p)) life.people.push(p);
    p.role = 'partner';
    p.closeness = Math.max(p.closeness, 65);
    life.counts.partners++;
    addLog(life, L(`Bạn và ${personName(life, p)} chính thức là người yêu.`, `You and ${personName(life, p)} are officially together.`), 'good');
  }
}

export function breakUp(life, why, factor = 1) {
  const p = partner(life);
  if (!p) return;
  const wasSpouse = p.role === 'spouse';
  p.role = 'ex';
  p.engaged = false;
  p.cohab = false;
  p.closeness = Math.min(p.closeness, 25);
  setFlag(life, 'recent_breakup');
  clearFlag(life, 'long_distance');
  if (wasSpouse) {
    life.counts.divorces++;
    const m = life.marriage || {};
    const liquid = Math.max(0, life.money) + (life.port ? portfolioValue(life) : 0);
    const kept = m.prenup ? Math.min(liquid, m.worthAtWedding || 0) : 0;
    const loss = Math.max(0, (liquid - kept) * 0.5 * factor);
    takeAssets(life, loss);
    let home = '';
    if (!m.prenup && life.homes && life.homes.length) {
      const i = life.homes.reduce((b, h, k, a) => (h.value > a[b].value ? k : b), 0);
      life.homes.splice(i, 1);
      home = ' ';
    }
    life.marriage = null;
    milestone(life, L(`Ly hôn với ${personName(life, p)}`, `Divorced ${personName(life, p)}`), 'bad');
    addLog(life, L(`Bạn và ${personName(life, p)} ly hôn.${m.prenup ? ' Hợp đồng tiền hôn nhân bảo vệ tài sản trước khi cưới của bạn.' : ' Tài sản bị chia đôi.'}${home ? ' Người kia giữ căn nhà.' : ''}`, `You and ${personName(life, p)} divorce.${m.prenup ? ' Your prenup protects what you had before the wedding.' : ' Assets are split in half.'}${home ? ' They keep the house.' : ''}`), 'bad');
    if (why === 'affair') for (const k of people(life, 'child')) if (k.otherParentId === p.id && k.age < 18) { k.closeness = clamp(k.closeness - 20); k.custodyLost = true; }
  } else {
    addLog(life, L(`Bạn và ${personName(life, p)} chia tay.`, `You and ${personName(life, p)} break up.`), 'bad');
  }
}

/** Trừ tài sản lưu động: tiền mặt trước, thiếu thì bán bớt danh mục đầu tư. */
function takeAssets(life, amount) {
  const cash = Math.max(0, life.money);
  const fromCash = Math.min(cash, amount);
  life.money -= fromCash;
  let rest = amount - fromCash;
  if (rest > 0 && life.port) {
    const total = portfolioValue(life);
    if (total > 0) {
      const keep = Math.max(0, 1 - rest / total);
      life.port.savings *= keep;
      for (const k of Object.keys(life.port.units)) life.port.units[k] *= keep;
    }
  }
}

export function startAffair(life) {
  if (life.affair || !partner(life)) return null;
  const p = randomPerson(life, life, { role: 'lover', gender: partnerGender(life, life), age: clamp(life.age + randint(life, -8, 6), 18, 90), closeness: 55 });
  life.people.push(p);
  life.affair = { id: p.id, since: life.age };
  setFlag(life, 'has_affair');
  return p;
}

export function addChild(life, otherId) {
  const other = byId(life, otherId);
  const kid = randomPerson(life, life, { role: 'child', age: 0, last: life.last, closeness: 75 });
  kid.otherParentId = otherId;
  kid.outOfWedlock = !(other && other.role === 'spouse');
  life.people.push(kid);
  life.counts.children++;
  milestone(life, L(`Có con: ${personName(life, kid)}`, `Became a parent: ${personName(life, kid)}`), 'good');
  return kid;
}

// ───────── Sự kiện hệ thống (không đến từ gói, có hành động riêng) ─────────

export function buildSysEvent(life, item, settings) {
  const c = country(life);
  if (item.sys === 'pregnancy') {
    const preg = life.pregnancy;
    const other = byId(life, preg.otherId);
    const name = other ? personName(life, other) : L('người kia', 'the other person').vi;
    const ons = other && (other.role === 'contact' || other.role === 'ex');
    if (preg.carrier === 'self') {
      const choices = [
        { label: L('Giữ và nuôi con', 'Keep the baby'), outcomes: [{ chance: 1, sys: 'baby_keep', effects: { happy: 10, money: -20 }, text: L('Vài tháng sau, bạn đón đứa con đầu lòng.', 'Months later, you welcome your baby.') }] },
        { label: L('Cho con làm con nuôi', 'Choose adoption'), outcomes: [{ chance: 1, sys: 'baby_adopt', effects: { happy: -6 }, text: L('Một gia đình khác sẽ nuôi đứa bé.', 'Another family will raise the baby.') }] },
      ];
      if (c.abortion) choices.push({ label: L('Chấm dứt thai kỳ', 'End the pregnancy'), outcomes: [{ chance: 1, sys: 'baby_end', effects: { happy: -4, health: -2 }, text: L('Bạn đưa ra quyết định của mình.', 'You make your own decision.') }] });
      return {
        uid: 'sys/pregnancy', sys: true,
        text: L(`Bạn phát hiện mình có thai ngoài ý muốn. Cha đứa bé là ${name}${ons ? ', người bạn chỉ mới gặp' : ''}.`, `You find out you're unexpectedly pregnant. The father is ${name}${ons ? ', someone you barely know' : ''}.`),
        choices,
      };
    }
    return {
      uid: 'sys/pregnancy', sys: true,
      text: L(`${name} báo tin đang mang thai con của bạn.`, `${name} tells you they're pregnant with your child.`),
      choices: [
        { label: L('Cùng nuôi con', 'Raise the child together'), outcomes: [{ chance: 1, sys: 'baby_keep', effects: { happy: 6, money: -15 }, text: L('Bạn trở thành cha mẹ.', 'You become a parent.') }] },
        { label: L('Chỉ chu cấp tiền', 'Pay child support only'), outcomes: [{ chance: 1, sys: 'baby_support', effects: { karma: -2 }, text: L('Mỗi năm bạn sẽ gửi tiền nuôi con.', 'You will send child support every year.') }] },
        { label: L('Phủ nhận', 'Deny it'), outcomes: [
          { chance: 0.5, sys: 'baby_denied', effects: { karma: -10, happy: -3 }, text: L('Họ cắt đứt liên lạc với bạn.', 'They cut off all contact.') },
          { chance: 0.5, sys: 'baby_support', effects: { karma: -12, fame: -5, money: -30 }, text: L('Xét nghiệm ADN chứng minh bạn là cha. Tòa buộc bạn chu cấp.', 'A DNA test proves it. The court orders child support.') },
        ] },
      ],
    };
  }
  if (item.sys === 'affair_exposed') {
    const sp = partner(life);
    const lover = life.affair && byId(life, life.affair.id);
    const sn = sp ? personName(life, sp) : '';
    return {
      uid: 'sys/affair', sys: true,
      text: L(`${sn} phát hiện bạn ngoại tình với ${lover ? personName(life, lover) : 'người khác'}.`, `${sn} finds out about your affair with ${lover ? personName(life, lover) : 'someone else'}.`),
      choices: [
        { label: L('Quỳ xuống xin tha thứ', 'Beg for forgiveness'), outcomes: [
          { chance: 0.45, sys: 'affair_forgiven', effects: { rel_partner: -30, happy: -8 }, text: L('Họ tha thứ, nhưng niềm tin đã sứt mẻ.', 'They forgive you, but the trust is broken.') },
          { chance: 0.55, sys: 'affair_split', effects: { happy: -15 }, text: L('Họ thu dọn đồ đạc và rời đi.', 'They pack their things and leave.') },
        ] },
        { label: L('Chọn người tình', 'Choose your lover'), outcomes: [{ chance: 1, sys: 'affair_switch', effects: { karma: -10, happy: 4 }, text: L('Bạn rời đi để sống với người tình.', 'You leave to be with your lover.') }] },
        { label: L('Chối đến cùng', 'Deny everything'), outcomes: [
          { chance: 0.3, sys: 'affair_denied', effects: { karma: -6 }, text: L('Không hiểu sao họ tin bạn.', 'Somehow, they believe you.') },
          { chance: 0.7, sys: 'affair_split', effects: { happy: -15, fame: -5 }, text: L('Ảnh chụp màn hình tin nhắn lan khắp mạng.', 'Screenshots of your messages spread online.') },
        ] },
      ],
    };
  }
  if (item.sys === 'after_highschool') {
    return {
      uid: 'sys/after_hs', sys: true,
      text: L('Bạn tốt nghiệp trung học. Bố mẹ hỏi "Giờ tính sao?" bằng giọng của người đã tính sẵn cho bạn.', 'You graduate from high school. Your parents ask "So, what now?" in the voice of people who already decided.'),
      choices: [
        { label: L('🎓 Thi vào đại học', '🎓 Apply to university'), outcomes: [{ chance: 1, sys: 'pick_major', effects: {}, text: L('Bạn ngồi xem danh sách ngành học.', 'You sit down with the list of majors.') }] },
        { label: L('🧰 Học trường nghề', '🧰 Go to trade school'), outcomes: [{ chance: 1, sys: 'pick_trade', effects: {}, text: L('Bạn tìm hiểu các trường nghề.', 'You look into trade schools.') }] },
        { label: L('💼 Đi làm luôn', '💼 Start working'), outcomes: [{ chance: 1, sys: 'job_offers', effects: { willpower: 4 }, text: L('Bạn quyết định đi làm luôn.', 'You decide to start working.') }] },
        { label: L('🎒 Nghỉ một năm đi chơi', '🎒 Take a gap year'), outcomes: [{ chance: 1, effects: { happy: 12, smarts: 2 }, text: L('Một năm để "tìm lại bản thân". Bạn tìm thấy chủ yếu là các quán ăn ngon.', 'A year to "find yourself". Mostly you find good street food.') }] },
      ],
    };
  }
  if (item.sys === 'pick_major') return { ...majorEvent(life), sys: true };
  if (item.sys === 'pick_trade') return { ...tradeEvent(life), sys: true };
  return null;
}

/** Hành động của sự kiện hệ thống sau khi đã chọn. */
export function applySys(life, sysKey) {
  const preg = life.pregnancy;
  switch (sysKey) {
    case 'baby_keep': {
      const kid = addChild(life, preg.otherId);
      const other = byId(life, preg.otherId);
      if (other) other.closeness = clamp(other.closeness + 10);
      addLog(life, L(`Con của bạn, ${personName(life, kid)}, chào đời.`, `Your child, ${personName(life, kid)}, is born.`), 'good');
      life.pregnancy = null;
      break;
    }
    case 'baby_support': {
      const kid = addChild(life, preg.otherId);
      kid.supportOnly = true;
      kid.closeness = 30;
      addLog(life, L(`${personName(life, kid)} chào đời. Bạn chu cấp tiền nuôi con mỗi năm.`, `${personName(life, kid)} is born. You pay child support each year.`));
      life.pregnancy = null;
      break;
    }
    case 'baby_adopt':
    case 'baby_end':
    case 'baby_denied':
      life.pregnancy = null;
      break;
    case 'affair_forgiven':
      endAffair(life);
      break;
    case 'affair_split':
      life.counts.affairsExposed++;
      breakUp(life, 'affair');
      endAffair(life);
      break;
    case 'affair_switch': {
      life.counts.affairsExposed++;
      const lover = life.affair && byId(life, life.affair.id);
      breakUp(life, 'affair');
      life.affair = null;
      clearFlag(life, 'has_affair');
      if (lover) { lover.role = 'partner'; lover.closeness = 70; life.counts.partners++; }
      break;
    }
    case 'affair_denied':
      break;
    case 'uni_start':
      life.edu.stage = 'uni';
      life.edu.years = 0;
      break;
    case 'pick_major':
    case 'pick_trade':
    case 'job_offers':
      life.queue.unshift({ sys: sysKey });
      break;
  }
}

function endAffair(life) {
  const lover = life.affair && byId(life, life.affair.id);
  if (lover) { lover.role = 'ex'; lover.closeness = 20; }
  life.affair = null;
  clearFlag(life, 'has_affair');
}

export { pick };
