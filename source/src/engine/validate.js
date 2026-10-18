// Kiểm tra gói nội dung. Dùng chung cho game (khi nạp gói) và scripts/pack-lint.mjs.
// Gói chỉ là dữ liệu: mọi khóa lạ đều là lỗi, không âm thầm bỏ qua.

export const RATINGS = ['all', '18+', '25+'];
export const CATEGORIES = ['childhood', 'school', 'teen', 'love', 'work', 'money', 'health', 'crime', 'family', 'random', 'old_age'];
export const STATS = ['health', 'happy', 'smarts', 'looks', 'karma', 'willpower', 'risk', 'fame'];
export const REL_KEYS = ['mother', 'father', 'sibling', 'partner', 'spouse', 'child', 'friend', 'boss'];
const BOOL_REQ = ['retired', 'ill', 'inSchool', 'employed', 'hasPartner', 'married', 'hasChildren', 'inPrison', 'addicted', 'pregnant', 'hasAffair', 'hasBusiness', 'ownsHome', 'fugitive', 'hasRecord', 'engaged', 'cohabiting'];
const SPECIAL_EFFECTS = ['pregnancyChance', 'newContact', 'startAffair', 'affairExposed', 'breakup', 'divorce', 'cure', 'retire', 'loseJob'];
const OUTCOME_KEYS = ['chance', 'effects', 'text', 'setFlags', 'clearFlags', 'newContact'];
const EVENT_KEYS = ['id', 'category', 'age', 'weight', 'once', 'rating', 'requires', 'text', 'choices', 'effects', 'setFlags', 'clearFlags', 'sensitive', 'big'];
import { ILLNESS_IDS } from '../data/illness.js';
import { CAREERS } from '../data/careers.js';
const CAREER_IDS = CAREERS.map((c) => c.id);
export const EDU_STAGES = ['primary', 'secondary', 'uni', 'grad', 'trade'];
export const MAJOR_IDS = ['cs', 'engineering', 'medicine', 'nursing', 'law', 'business', 'finance', 'science', 'architecture', 'psychology', 'comms', 'education', 'arts'];
export const STAT_CAP = 30;
export const MONEY_CAP = 500;

const rank = (r) => RATINGS.indexOf(r);
const isRel = (k) => k.startsWith('rel_') && REL_KEYS.includes(k.slice(4));
const hasText = (t) => t && typeof t.vi === 'string' && t.vi.trim() && typeof t.en === 'string' && t.en.trim();

function checkEffects(where, effects, errors, warnings) {
  if (effects == null) return;
  if (typeof effects !== 'object') return errors.push(`${where}: effects phải là object`);
  for (const [k, v] of Object.entries(effects)) {
    if (STATS.includes(k) || isRel(k)) {
      if (typeof v !== 'number') errors.push(`${where}: ${k} phải là số`);
      else if (Math.abs(v) > STAT_CAP) warnings.push(`${where}: ${k}=${v} vượt ±${STAT_CAP}, game sẽ cắt về giới hạn`);
    } else if (k === 'money') {
      if (typeof v !== 'number') errors.push(`${where}: money phải là số`);
      else if (Math.abs(v) > MONEY_CAP) warnings.push(`${where}: money=${v} vượt ±${MONEY_CAP}, game sẽ cắt về giới hạn`);
    } else if (k === 'jobPerf' || k === 'salaryPct') {
      if (typeof v !== 'number' || Math.abs(v) > 50) errors.push(`${where}: ${k} phải là số trong khoảng ±50`);
    } else if (k === 'illness') {
      if (!ILLNESS_IDS.includes(v)) errors.push(`${where}: illness phải là một trong ${ILLNESS_IDS.join(', ')}`);
    } else if (k === 'pregnancyChance') {
      if (typeof v !== 'number' || v < 0 || v > 1) errors.push(`${where}: pregnancyChance phải từ 0 đến 1`);
    } else if (!SPECIAL_EFFECTS.includes(k)) {
      errors.push(`${where}: khóa hiệu ứng lạ "${k}"`);
    }
  }
}

function checkRequires(where, req, errors) {
  if (req == null) return;
  for (const [k, v] of Object.entries(req)) {
    if (k === 'gender' || k === 'partnerGender') {
      if (!['male', 'female', 'any'].includes(v)) errors.push(`${where}: ${k} không hợp lệ`);
    } else if (BOOL_REQ.includes(k)) {
      if (typeof v !== 'boolean') errors.push(`${where}: ${k} phải là true/false`);
    } else if (k === 'incomeTier') {
      if (!Array.isArray(v) || v.some((x) => !['low', 'mid', 'high'].includes(x))) errors.push(`${where}: incomeTier không hợp lệ`);
    } else if (k === 'min' || k === 'max') {
      for (const s of Object.keys(v)) {
        if (!(STATS.includes(s) || isRel(s) || s === 'money' || s === 'age')) errors.push(`${where}: ${k}.${s} không phải chỉ số hợp lệ`);
      }
    } else if (k === 'job') {
      if (!Array.isArray(v) || v.some((x) => !CAREER_IDS.includes(x))) errors.push(`${where}: job phải là mảng mã nghề: ${CAREER_IDS.join(', ')}`);
    } else if (k === 'childAge') {
      if (!Array.isArray(v) || v.length !== 2 || v.some((x) => typeof x !== 'number')) errors.push(`${where}: childAge phải là [tuổi_min, tuổi_max]`);
    } else if (k === 'eduStage') {
      if (!Array.isArray(v) || v.some((x) => !EDU_STAGES.includes(x))) errors.push(`${where}: eduStage phải là mảng trong ${EDU_STAGES.join(', ')}`);
    } else if (k === 'major') {
      if (!Array.isArray(v) || v.some((x) => !MAJOR_IDS.includes(x))) errors.push(`${where}: major phải là mảng trong ${MAJOR_IDS.join(', ')}`);
    } else if (k === 'flags' || k === 'notFlags') {
      if (!Array.isArray(v)) errors.push(`${where}: ${k} phải là mảng`);
    } else {
      errors.push(`${where}: điều kiện lạ "${k}"`);
    }
  }
}

/** Trả về { errors, warnings }. Gói có lỗi thì không được nạp. */
export function validatePack(pack) {
  const errors = [];
  const warnings = [];
  const m = pack?.manifest;
  if (!m) errors.push('thiếu manifest');
  else {
    if (!m.id || !/^[a-z0-9_.-]+$/.test(m.id)) errors.push('manifest.id thiếu hoặc có ký tự lạ');
    if (!hasText(m.name)) errors.push('manifest.name cần đủ vi và en');
    if (!RATINGS.includes(m.rating)) errors.push('manifest.rating phải là all, 18+ hoặc 25+');
  }
  if (!Array.isArray(pack?.events)) {
    errors.push('thiếu danh sách events');
    return { errors, warnings };
  }
  const ids = new Set();
  pack.events.forEach((ev, i) => {
    const w = `events[${i}] ${ev?.id ?? ''}`.trim();
    for (const k of Object.keys(ev)) if (!EVENT_KEYS.includes(k)) errors.push(`${w}: khóa lạ "${k}"`);
    if (!ev.id || !/^[a-z0-9_]+$/.test(ev.id)) errors.push(`${w}: id phải là snake_case`);
    if (ids.has(ev.id)) errors.push(`${w}: id bị trùng`);
    ids.add(ev.id);
    if (!CATEGORIES.includes(ev.category)) errors.push(`${w}: category lạ "${ev.category}"`);
    const [a0, a1] = Array.isArray(ev.age) ? ev.age : [];
    if (typeof a0 !== 'number' || typeof a1 !== 'number' || a0 < 0 || a1 > 120 || a0 > a1) errors.push(`${w}: age phải là [min, max] hợp lệ`);
    if (typeof ev.weight !== 'number' || ev.weight < 1 || ev.weight > 10) errors.push(`${w}: weight phải từ 1 đến 10`);
    if (!RATINGS.includes(ev.rating)) errors.push(`${w}: rating không hợp lệ`);
    else if (m && RATINGS.includes(m.rating) && rank(ev.rating) > rank(m.rating)) errors.push(`${w}: rating cao hơn rating của gói`);
    if (!hasText(ev.text)) errors.push(`${w}: text cần đủ vi và en`);

    // Luật an toàn cố định: nội dung tình cảm/người lớn chỉ dành cho nhân vật từ 18 tuổi.
    const adultTheme = ev.category === 'love' || ev.rating === '25+';
    if (adultTheme && typeof a0 === 'number' && a0 < 18) errors.push(`${w}: sự kiện tình cảm/25+ phải có tuổi tối thiểu từ 18`);
    if (ev.requires?.min?.age != null && ev.requires.min.age < 18 && adultTheme) errors.push(`${w}: requires.min.age phải từ 18`);
    if (ev.sensitive != null && ev.sensitive !== 'suicide') errors.push(`${w}: sensitive chỉ nhận "suicide"`);

    checkRequires(w, ev.requires, errors);
    if (ev.choices) {
      if (!Array.isArray(ev.choices) || ev.choices.length < 1 || ev.choices.length > 4) errors.push(`${w}: cần 1–4 lựa chọn`);
      (ev.choices || []).forEach((c, j) => {
        const cw = `${w} › lựa chọn ${j + 1}`;
        if (!hasText(c.label)) errors.push(`${cw}: label cần đủ vi và en`);
        if (c.requires) { for (const k of Object.keys(c.requires)) if (k !== 'min' && k !== 'max') errors.push(`${cw}: requires của lựa chọn chỉ nhận min/max`); checkRequires(cw, c.requires, errors); }
        if (!Array.isArray(c.outcomes) || !c.outcomes.length) return errors.push(`${cw}: thiếu outcomes`);
        const sum = c.outcomes.reduce((s, o) => s + (o.chance ?? 0), 0);
        if (Math.abs(sum - 1) > 0.011) errors.push(`${cw}: tổng chance = ${sum.toFixed(2)}, phải bằng 1`);
        c.outcomes.forEach((o, k) => {
          const ow = `${cw} › kết quả ${k + 1}`;
          for (const key of Object.keys(o)) if (!OUTCOME_KEYS.includes(key)) errors.push(`${ow}: khóa lạ "${key}"`);
          checkEffects(ow, o.effects, errors, warnings);
          if (o.text && !hasText(o.text)) errors.push(`${ow}: text cần đủ vi và en`);
          if (!o.text) warnings.push(`${ow}: nên có text`);
        });
      });
    } else {
      checkEffects(w, ev.effects, errors, warnings);
    }
  });
  return { errors, warnings };
}

/** Chuẩn hóa gói đã qua kiểm tra: gắn tiền tố id, gom khóa đặt sai chỗ, cắt hiệu ứng về giới hạn. */
export function normalizePack(pack) {
  const prefix = pack.manifest.id;
  const clamp = (v, c) => Math.max(-c, Math.min(c, v));
  const fixEffects = (e = {}) => {
    const out = {};
    for (const [k, v] of Object.entries(e)) {
      if (STATS.includes(k) || k.startsWith('rel_')) out[k] = clamp(v, STAT_CAP);
      else if (k === 'money') out[k] = clamp(v, MONEY_CAP);
      else out[k] = v;
    }
    return out;
  };
  return {
    manifest: { ...pack.manifest },
    events: pack.events.map((ev) => ({
      ...ev,
      uid: `${prefix}/${ev.id}`,
      pack: prefix,
      effects: ev.effects ? fixEffects(ev.effects) : undefined,
      choices: ev.choices?.map((c) => ({
        ...c,
        outcomes: c.outcomes.map((o) => {
          const effects = fixEffects(o.effects);
          if (o.newContact && !effects.newContact) effects.newContact = o.newContact;
          return { ...o, effects };
        }),
      })),
    })),
  };
}
