// Điều phối: gói nội dung, đời hiện tại, hàng đợi sự kiện.
import { L } from './util.js';
import { validatePack, normalizePack } from './validate.js';
import { createLife, addLog, people, personName, byId, milestone } from './life.js';
import { ageUp, die, recordHistory } from './year.js';
import { pickOutcome, applyOutcome, applyEffects, buildSysEvent, applySys, resolveEngineFlags } from './events.js';
import { initEconomy, netWorth } from './economy.js';
import { createCoborns, buildCrimeSys, applyCrimeSys } from './crime.js';
import { buildLoveSys, applyLoveSys } from './love.js';
import { buildArcEvent, applyArc } from './arcs.js';
import { choiceLocked } from './events.js';
import { assignGoals } from './goals.js';
import { buildCareerSys } from './career.js';
import big from '../data/packs/core_big.json';
import love from '../data/packs/love_core.json';
import coreLife from '../data/packs/core_life.json';
import core from '../data/packs/core.json';
import adult from '../data/packs/adult_intimate_life.json';
import ons from '../data/packs/one_night_stands.json';
import uni from '../data/packs/university_life.json';
import kinks from '../data/packs/private_kinks.json';
import school from '../data/packs/school_life.json';
import weird from '../data/packs/core_weird.json';
import workPack from '../data/packs/work_life.json';
import oldPack from '../data/packs/old_age.json';
import healthPack from '../data/packs/health.json';
import parentPack from '../data/packs/parenting.json';
import afterDark from '../data/packs/after_dark.json';

export const BUILTIN = [core, coreLife, school, weird, workPack, oldPack, healthPack, parentPack, afterDark, big, love, uni, ons, adult, kinks].map((p) => ({ ...normalizePack(p), builtin: true }));

export function defaultSettings() {
  return { lang: 'vi', adult25: false, alwaysProtect: true, godEnabled: true, packs: {}, packWeight: {} };
}

export function makeGame(settings, customPacks = []) {
  const game = { settings, packs: [...BUILTIN, ...customPacks], life: null, events: [] };
  refreshEvents(game);
  return game;
}

export function refreshEvents(game) {
  game.events = game.packs.filter((p) => game.settings.packs[p.manifest.id] !== false).flatMap((p) => p.events);
  game.byUid = Object.fromEntries(game.packs.flatMap((p) => p.events).map((e) => [e.uid, e]));
}

/** Nạp gói từ chuỗi JSON. Trả về { pack } hoặc { errors }. */
export function loadPackText(game, text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { errors: [`JSON lỗi: ${e.message}`] };
  }
  const { errors, warnings } = validatePack(raw);
  if (errors.length) return { errors, warnings };
  if (BUILTIN.some((p) => p.manifest.id === raw.manifest.id)) return { errors: ['Trùng id với gói có sẵn trong game'] };
  const pack = normalizePack(raw);
  game.packs = game.packs.filter((p) => p.manifest.id !== pack.manifest.id).concat(pack);
  refreshEvents(game);
  return { pack, warnings, raw };
}

export function newLife(game, opts) {
  game.life = createLife(opts);
  game.life.birthCountry = game.life.country;
  game.life.gen = 1;
  assignGoals(game.life);
  initEconomy(game.life);
  createCoborns(game.life);
  recordHistory(game.life);
  return game.life;
}

/** +1 tuổi rồi tự xử lý các sự kiện không có lựa chọn. */
export function ageUpGame(game) {
  const life = game.life;
  if (!ageUp(life, game.events, game.settings)) return false;
  autoResolve(game);
  return true;
}

function autoResolve(game) {
  const life = game.life;
  while (life.queue.length) {
    const item = life.queue[0];
    if (item.sys) return;
    const ev = game.byUid[item.uid];
    if (!ev) { life.queue.shift(); continue; }
    if (ev.choices) return;
    life.queue.shift();
    if (ev.once) life.done.push(ev.uid);
    applyEffects(life, ev.effects);
    for (const f of ev.clearFlags || []) delete life.flags[f];
    for (const f of ev.setFlags || []) life.flags[f] = life.age;
    addLog(life, ev.text);
  }
}

/** Sự kiện đang chờ người chơi trả lời (đã dựng sẵn để hiển thị), hoặc null. */
export function currentEvent(game) {
  const life = game.life;
  if (!life || life.dead) return null;
  while (life.queue.length) {
    const item = life.queue[0];
    if (item.sys) {
      const ev = buildSysEvent(life, item, game.settings) || buildCrimeSys(life, item) || buildLoveSys(life, item) || buildArcEvent(life, item) || buildCareerSys(life, item);
      if (ev && ev.choices.every((c) => choiceLocked(life, c))) ev.choices = ev.choices.map((c, i) => (i === ev.choices.length - 1 ? { ...c, requires: undefined } : c));
      if (ev) return ev;
      life.queue.shift();
      autoResolve(game);
      continue;
    }
    const ev = game.byUid[item.uid];
    if (ev && ev.choices) return ev;
    if (ev) { autoResolve(game); continue; }
    life.queue.shift();
  }
  return null;
}

/** Trả lời sự kiện đầu hàng đợi. */
export function chooseEvent(game, idx) {
  const life = game.life;
  const ev = currentEvent(game);
  if (!ev) return null;
  const choice = ev.choices[idx];
  if (!choice || choiceLocked(life, choice)) return null;
  const outcome = pickOutcome(life, choice.outcomes);
  life.queue.shift();
  let changes;
  if (ev.sys) {
    changes = applyEffects(life, outcome.effects);
    if (outcome.sys) applySys(life, outcome.sys);
    if (outcome.sysCrime) applyCrimeSys(life, outcome.sysCrime);
    if (outcome.sysLove) applyLoveSys(life, outcome.sysLove);
    if (outcome.run) outcome.run(life);
    if (ev.arc) applyArc(life, ev.arc, outcome);
  } else {
    if (ev.once) life.done.push(ev.uid);
    changes = applyOutcome(life, ev, outcome, game.settings);
  }
  addLog(life, ev.text);
  if (outcome.text) addLog(life, outcome.text, tone(changes));
  if (ev.big && outcome.text) milestone(life, outcome.text, tone(changes) || 'good');
  autoResolve(game);
  checkHealthDeath(life);
  return { event: ev, choice, outcome, changes };
}

/** Trả lời một cảnh do hành động tạo ra (hộp đêm, hẹn hò...). */
export function chooseModal(game, ev, idx) {
  const life = game.life;
  const outcome = pickOutcome(life, ev.choices[idx].outcomes);
  const changes = applyEffects(life, outcome.effects);
  if (outcome.run) outcome.run(life);
  resolveEngineFlags(life);
  if (outcome.text) addLog(life, outcome.text, tone(changes));
  checkHealthDeath(life);
  const next = outcome.next && !life.dead ? outcome.next(life) : null;
  return { event: ev, outcome, changes, next };
}

function checkHealthDeath(life) {
  if (!life.dead && life.stats.health <= 0) die(life, L('kiệt sức', 'exhaustion'));
}

function tone(changes = []) {
  const score = changes.reduce((s, [k, v]) => s + (k === 'money' || k === 'salary' ? Math.sign(v) * 3 : k === 'risk' ? 0 : v), 0);
  return score > 4 ? 'good' : score < -4 ? 'bad' : undefined;
}

/** Sống tiếp bằng một người con: thừa kế 70% tài sản sau thuế. */
export function continueAsChild(game, childId) {
  const old = game.life;
  const kid = byId(old, childId);
  if (!kid || !kid.alive) return null;
  const life = createLife({ mode: 'free', country: old.country, gender: kid.gender, first: kid.first, last: kid.last, wealth: old.money > 20 * 1000 ? 'well' : old.wealth, seed: (old.rng ^ 0x5bd1e995) >>> 0 });
  life.age = kid.age;
  life.customized = old.customized;
  life.mode = 'heir';
  life.gen = (old.gen || 1) + 1;
  life.birthCountry = old.country;
  assignGoals(life);
  initEconomy(life);
  if (old.econ) life.econ = old.econ;
  life.coborns = [];
  life.money = Math.max(0, netWorth(old)) * 0.7;
  life.stats.smarts = kid.smarts;
  life.stats.looks = kid.looks;
  life.people = life.people.filter((p) => p.role !== 'mother' && p.role !== 'father');
  for (const sib of people(old, 'child')) if (sib.id !== kid.id) life.people.push({ ...sib, role: 'sibling', closeness: 60 });
  if (kid.age >= 6 && kid.age < 18) life.edu.stage = kid.age >= 11 ? 'secondary' : 'primary';
  if (kid.age >= 18) life.edu.level = 'highschool';
  life.log = [{ age: kid.age, items: [{ text: L(`Bạn là ${personName(old, kid)}, con của ${old.first}. Bạn được thừa kế tài sản sau thuế.`, `You are ${personName(old, kid)}, child of ${old.first}. You inherit the estate after taxes.`) }] }];
  game.life = life;
  return life;
}
