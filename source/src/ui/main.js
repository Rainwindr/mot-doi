// Giao diện: dựng lại toàn bộ #app sau mỗi thao tác (đơn giản, đủ nhanh cho game dạng chữ).
import { STRINGS, makeT } from './i18n.js';
import { COUNTRIES, byCode, tierOf } from '../data/countries.js';
import { careerById, ladderOf, COMPANIES } from '../data/careers.js';
import { entryRank, entryBonus, salaryFor, nextRank, rankName, effExp } from '../engine/career.js';
import {
  makeGame, defaultSettings, refreshEvents, loadPackText, newLife, ageUpGame, currentEvent, chooseEvent, chooseModal, continueAsChild, BUILTIN,
} from '../engine/game.js';
import { normalizePack, validatePack } from '../engine/validate.js';
import { STAT_KEYS, HIDDEN_KEYS, TRAITS, WEALTH, country, tier, personName, partner, people, addLog, polyOk } from '../engine/life.js';
import { ACTIVITIES } from '../engine/actions.js';
import { profileLine } from '../engine/love.js';
import { choiceLocked } from '../engine/events.js';
import { availableActivities, doActivity, personActions, doPersonAction, godPerson, jobOpenings, jobsLocked, applyJob, workAction, godApply, godRewind } from '../engine/actions.js';
import { RIBBONS } from '../engine/year.js';
import { PHASES, ASSETS, HOMES, CARS, INDUSTRIES, holdingValue, netWorth, savingsRate, homePrice, bizCapital, invest, divest, buyHome, sellHome, toggleRent, buyCar, sellCar, startBiz, bizAction } from '../engine/economy.js';
import { majorById, tradeById } from '../data/majors.js';
import { degreeName, stageLength } from '../engine/school.js';
import { resolveEscape, resolveCasino, resolveOlympiad, resolveRace, resolveBlackjack, resolveExam, INTERVIEW_QS } from '../engine/minigames.js';
import { SPECIALS, canJoin, specialAction, followersText } from '../engine/specials.js';
import { GOALS, goalById, checkGoals, ACHIEVEMENTS, archiveLife, emptyProfile } from '../engine/goals.js';
import { emigrate, emigrationOdds, emigrationCost, cobornName } from '../engine/crime.js';
import { ATT, attOf, attOptions, KINKS, KINK_GROUPS, kinkById, CHEST, POSITIONS, POS_LEVELS, posLevel, prof, me, firmOf, adultOK, ROM as ROM_ROLES, ROOMS } from '../engine/intimacy.js';
import { members as hMembers, inHarem, hm, titleOf, HTRAITS, HOUSES, relOf, haremActions } from '../engine/harem.js';
import { ensureTeam, teamPeople, DYN } from '../engine/world.js';
import { doHaremAction, doAll, doGodTrigger } from '../engine/actions.js';
import { dramaHaremActions, pairsOf, PAIR_ST, SCENARIOS } from '../engine/drama.js';
import { ORIENT, orientOf } from '../engine/intimacy.js';
import { pw, STATUS, statusOf, AURA, auraTier, MASKS, AUDIENCES, OFFICES, CLUB_RANKS, CLUB_NAME, RICH, PAWN_VIA, DEFEAT, pawnsOf, shadowPower, powerActions } from '../engine/power.js';
import { VOICES, voiceOf, PERS, persona, topTrait, traitLabel, traitEm, tagChoice, inCharacter, npcPartnerOf, PAIR_LABEL } from '../engine/society.js';
import { TALENTS, talentOf, HOBBIES, HABITS, habits, SPEND, LOVESTYLE, loveStyleOf, CULTURES, LEARN, PET_P, DESTS, chainsOf, diaryOf } from '../engine/growth.js';
import { doPowerAction } from '../engine/actions.js';
import { fcfg, MALE_UNLIMITED } from '../engine/fertility.js';

// ───────── Lưu trữ (an toàn khi trình duyệt chặn) ─────────
const KEY = { gate: 'motdoi.gate', settings: 'motdoi.settings', save: 'motdoi.save', packs: 'motdoi.packs', profile: 'motdoi.profile' };
const store = {
  get(k, fallback) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* bỏ qua */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* bỏ qua */ } },
};

// ───────── Trạng thái giao diện ─────────
const ui = { mini: null, queue: [], newAch: null, freshFrom: Infinity, sub: null, view: 'gate', sheet: null, modal: null, result: null, toast: null, draft: null, god: null, resetArmed: false, packMsg: null, gateErr: null, birth: false };
let settings = { ...defaultSettings(), ...store.get(KEY.settings, {}) };
let customRaw = store.get(KEY.packs, []);
let profile = { ...emptyProfile(), ...store.get(KEY.profile, {}) };
const game = makeGame(settings, loadCustom(customRaw));
const t = makeT(() => settings.lang);
const tx = (o) => (o == null ? '' : typeof o === 'string' ? o : o[settings.lang] ?? o.vi);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const $app = document.getElementById('app');

function loadCustom(list) {
  const out = [];
  for (const raw of list) if (!validatePack(raw).errors.length) out.push(normalizePack(raw));
  return out;
}

function boot(data) {
  const saved = data?.save ?? store.get(KEY.save, null);
  if (saved && saved.v === 1) game.life = saved;
  ui.view = store.get(KEY.gate, false) ? 'home' : 'gate';
  if (data?.view && data.view !== 'gate' && store.get(KEY.gate, false)) ui.view = data.view;
  if (ui.view === 'game' && !game.life) ui.view = 'home';
  applyTheme();
  render();
  loadRemotePacks();
}

// Gói nội dung đặt trong thư mục packs/ của trang (GitHub Pages): sửa trên GitHub là game tự nạp.
async function loadRemotePacks() {
  if (!/^https?:$/.test(location.protocol)) return;
  let list;
  try { const r = await fetch('packs/danh-sach.json', { cache: 'no-store' }); if (!r.ok) return; list = await r.json(); } catch { return; }
  const files = Array.isArray(list) ? list : list.files || [];
  const errs = [];
  let ok = 0;
  for (const f of files) {
    try {
      const r = await fetch(`packs/${f}`, { cache: 'no-store' });
      if (!r.ok) { errs.push(`${f}: không tìm thấy file (lỗi ${r.status})`); continue; }
      const res = loadPackText(game, await r.text());
      if (res.errors) { errs.push(`${f}:\n  ${res.errors.slice(0, 8).join('\n  ')}`); continue; }
      res.pack.remote = f;
      if (settings.packs[res.pack.manifest.id] == null) settings.packs[res.pack.manifest.id] = true;
      ok++;
    } catch (e) { errs.push(`${f}: ${e.message}`); }
  }
  ui.remote = { ok, errs };
  refreshEvents(game);
  render();
}
function persist() {
  store.set(KEY.settings, settings);
  if (game.life) store.set(KEY.save, game.life);
}
function applyTheme() { document.documentElement.lang = settings.lang; }

// ───────── Định dạng ─────────
function money(usd, life = game.life) {
  const c = life ? country(life) : byCode.US;
  const v = usd * c.rate;
  const loc = settings.lang === 'vi' ? 'vi-VN' : 'en-US';
  try {
    return new Intl.NumberFormat(loc, { style: 'currency', currency: c.cur, notation: Math.abs(v) >= 1e6 ? 'compact' : 'standard', maximumFractionDigits: Math.abs(v) >= 1e6 ? 1 : 0 }).format(v);
  } catch {
    return `${Math.round(v).toLocaleString(loc)} ${c.cur}`;
  }
}
function chipsHtml(changes = []) {
  return changes.filter(([, v]) => v).map(([k, v]) => {
    const label = k === 'money' ? money(Math.abs(v)) : k.startsWith('rel_') ? `${t('closeness')} · ${t('roles.' + k.slice(4))}` : t(k);
    const val = k === 'money' ? '' : ` ${v > 0 ? '+' : ''}${Math.round(v)}`;
    return `<span class="chip ${v > 0 ? 'up' : 'down'}">${k === 'money' ? (v > 0 ? '+' : '−') : ''}${esc(label)}${val}</span>`;
  }).join('');
}
// ───────── Emoji, thanh mức độ, avatar ─────────
const STAT_EM = { perf: '📈', salary: '💵', health: '❤️', happy: '😊', smarts: '🧠', looks: '✨', karma: '☯️', willpower: '💪', risk: '🎲', fame: '⭐', money: '💵' };
const lvlCls = (v) => (v >= 66 ? 'hi' : v >= 33 ? 'mid' : 'lo');
const lvl = (v, thin) => { const n = Math.max(0, Math.min(100, Math.round(v))); return `<div class="lvl${thin ? ' thin' : ''}"><i class="${lvlCls(n)}" style="width:${n}%"></i><span>${n}%</span></div>`; };
const bar = (v) => lvl(v);
const lvlInv = (v) => { const n = Math.max(0, Math.min(100, Math.round(v))); return `<div class="lvl"><i class="${lvlCls(100 - n)}" style="width:${n}%"></i><span>${n}%</span></div>`; };
const prog = (v) => `<div class="lvl thin"><i class="prog" style="width:${Math.max(4, Math.min(100, Math.round(v)))}%"></i></div>`;
function face(gender, age, role, alive = true, species) {
  if (role === 'pet') return species ? ({ dog: '🐶', cat: '🐱', rabbit: '🐰', parrot: '🦜', turtle: '🐢' }[species] || '🐾') : '🐾';
  if (!alive) return '🪦';
  if (age < 3) return '👶';
  const f = gender === 'female';
  if (age < 18) return f ? '👧' : '👦';
  if (age < 60) return f ? '👩' : '👨';
  return f ? '👵' : '👴';
}
const CAT_EM = { childhood: '🧸', school: '🎒', teen: '🛹', love: '💘', work: '💼', money: '💰', health: '🩺', crime: '🚨', family: '👪', random: '🎲', old_age: '🧓' };
const UID_EM = {
  'sys/pregnancy': '🤰', 'sys/affair': '💔', 'sys/after_hs': '🎓', 'sys/tax': '🧾', 'sys/partner_proposes': '💍', 'sys/move_in': '🏡', 'sys/want_kids': '👶', 'sys/partner_cheats': '💔',
  'act/ons': '🌙', 'act/intimate': '🔥', 'act/casino': '🎰', 'act/affair': '🤫', 'crime/court': '⚖️', 'prison/escape': '🏃',
  'love/profile': '📲', 'love/app': '📲', 'love/blind': '💐', 'love/gift': '🎁', 'love/date': '🍷', 'love/intimate': '🔥', 'love/adopt': '🍼', 'love/propose': '💍', 'love/wedding_size': '💒', 'love/prenup': '📜', 'love/honeymoon': '🏝️', 'love/divorce': '⚖️', 'love/nomatch': '🤷', 'school/major': '🎓', 'pet/adopt': '🐾', 'money/loan': '🏦', 'money/insure': '🛡️', 'sys/lover_ultimatum': '💔', 'sys/job_offers': '💼', 'sys/headhunt': '📞', 'school/trade': '🧰', 'school/grad': '📜',
};
const ARC_EM = { bestie: '🤜', rival: '😤', firstlove: '💌', mentor: '🎓', secret: '🗝️', pet: '🐾' };
const evEmoji = (ev) => (!ev ? null : ev.big ? '🌟' : ev.arc ? ARC_EM[ev.arc] || '📖' : UID_EM[ev.uid] || CAT_EM[ev.category] || null);
const GROUP_EM = { hobby: '🎨', fun: '🎬', shop: '🛍️', life: '🌈', pet: '🐾', money: '🏦', net: '📱', kid: '🧸', teen: '🎒', mind: '🧠', night: '🌃', love: '💘', adult: '🔞', crime: '🦹', prison: '⛓️' };
const ACT_EM = {
  post_selfie: '🤳', post_travel: '🏝️', post_food: '🍜', post_couple: '💑', post_dance: '💃', post_vlog: '🎥', post_trend: '📈', post_sexy: '🔥', post_boudoir: '📸', post_sexyvid: '🎞️', post_harem: '👑', cr_open: '🔞', cr_photo: '📷', cr_video: '🎬', cr_live: '🔴', cr_request: '💌', cr_collab: '👥', cr_close: '🔒', nudist: '🏖️', onsen: '♨️', nighttour: '🌃', yachtbuy: '🛥️', yachtparty: '🥂', secretroom: '🚪', nc_open: '🪩', nc_theme: '🎶', nc_staff: '🧑‍🍳', nc_vip: '💎', nc_adult: '🔞', nc_sell: '🏷️',
  adultshop: '🛍️', club25: '🎭', sugarfind: '💎', fling: '✈️', ropeclass: '🪢', memoir: '📓',
  language: '🗣️', instrument: '🎹', martial: '🥋', yoga: '🧘', hike: '🥾', diet: '🥗', spa: '💆', movie: '🍿', concert: '🎤', cook: '🍳', garden: '🌱', comics: '📚', boardgame: '🎲', luxury: '👜', thrift: '🧥', tattoo: '🖋️', hairdye: '💇', license: '🚗', travel: '🧳', comeout: '🏳️‍🌈', donate: '🤲', will: '📜', rename: '🪪', adopt_pet: '🐾', loan: '🏦', repay: '💳', insure: '🛡️',
  cry: '😭', toys: '🧸', mischief: '😈', cartoons: '📺', friends: '🧑‍🤝‍🧑', art: '🎨', sleepover: '🛏️', swim: '🏊', tutor: '📚', sportclub: '⚽', band: '🎸', volunteer: '🤲', chores: '🧹', games: '🎮',
  net_photo: '📸', net_video: '🎥', net_live: '📡', net_sponsor: '🤑', races: '🏇', blackjack: '🃏', social: '📱', gym: '🏋️', library: '📖', meditate: '🧘', doctor: '🩺', vacation: '✈️', surgery: '💉', bar: '🍺', club: '🪩', casino: '🎰', lottery: '🎟️', date: '💐', app: '📲', hookup: '🔥', affair: '🤫',
  hob_guitar: '🎸', hob_paint: '🖌️', hob_chess: '♟️', hob_cook: '🍳', hob_garden: '🪴', hob_photo: '📷', hob_run: '🏃', hob_write: '✍️', hob_dance: '🕺', hob_code: '👾', lifestyle: '🌿', fortune: '🔮',
  prison_escape: '🏃', prison_parole: '📝', prison_work: '🔨', prison_riot: '🔥', crime_pickpocket: '👛', crime_shoplift: '🛍️', crime_burglary: '🏚️', crime_cartheft: '🚗', crime_fraud: '💳', crime_bank: '🏦',
};
const PA_EM = { scene3: '🌙', pw_order: '📜', pw_reward: '🎁', pw_test: '🕵️', pw_free: '🕊️', pw_recruit: '♟️', pw_defeat: '⚖️', pw_heirtalk: '👶', pw_match: '💍', pw_join: '🏢', pw_heir: '👑', teachskill: '🧑‍🏫', toharem: '👑', h_promote: '⬆️', h_demote: '⬇️', h_favor: '💗', h_investigate: '🕵️', h_release: '🚪', allowup: '💸', check: '🕵️', btrip: '🏝️', bpublic: '📣', bflatter: '🙇', bdrink: '🍻', braise: '💰', bproj: '📊', breport: '📝', bobject: '✋', clunch: '🍱', chelp: '🤝', cask: '🙏', cblame: '👉', ccompete: '🏁', cprank: '🤡', hangout: '🎡', hug: '🤗', deeptalk: '🫂', favor: '🤝', invite: '🎉', gossip: '🗣️', flirtx: '😘', confessx: '💌', ixtalk: '🕯️', kink: '🗝️', pos: '📕', sext: '📱', group: '👥', clubtogether: '🎭', spoil: '💎', rules: '📜', endbaby: '✋', walk: '🦮', vet: '🩺', treat: '🦴', outing: '🎡', care: '🫶', familytrip: '🧳', inherit: '💰', read: '📖', play: '🧸', teach: '✏️', allowance: '🪙', tutor: '👩‍🏫', praise: '👏', punish: '⛔', drinks: '🍻', borrow: '🤲', lend: '💸', collect: '🧾', payback: '💵', setup: '💘', prank: '🤡', counsel: '🛋️', photo: '📸', insult: '🗯️', fight: '👊', cutoff: '✂️', seduce: '😏', trip: '🏝️', official: '💑', askopen: '🔓', closeopen: '🔐', confess: '🙏', talk: '💬', compliment: '🌹', flirt: '😘', gift: '🎁', date: '🍷', intimate: '🔥', baby: '👶', adopt: '🍼', askmoney: '💸', money: '💸', movein: '🏡', propose: '💍', wedding: '💒', vows: '💞', breakup: '💔', divorce: '⚖️', endaffair: '✋', argue: '😠', askout: '💐' };
const DANGER_PA = ['pw_defeat', 'pw_free', 'h_release', 'h_demote', 'breport', 'cblame', 'endbaby', 'breakup', 'divorce', 'argue', 'endaffair', 'insult', 'fight', 'cutoff', 'punish'];
const JOB_EM = { fast_food: '🍔', delivery: '🛵', babysitter: '🍼', retail: '🛒', waiter: '🍽️', factory: '🏭', driver: '🚕', cleaner: '🧽', bartender: '🍸', model: '📸', office_clerk: '🗂️', sales: '🤝', police: '👮', nurse: '🩹', teacher: '🧑‍🏫', marketing: '📣', accountant: '🧮', engineer: '🛠️', developer: '💻', lawyer: '⚖️', doctor: '🩺', chef: '👨‍🍳', electrician: '⚡', mechanic: '🔧', hairdresser: '💇', it_tech: '🖥️', designer: '🎨', journalist: '📰', architect: '📐', analyst: '📈', pharmacist: '💊', psychologist: '🛋️', scientist: '🔬', professor: '🧑‍🏫' };
const ASSET_EM = { savings: '🏦', index: '📊', gold: '🥇', tech: '💻', bank: '🏛️', energy: '⚡', crypto: '🪙' };
const HOME_EM = { studio: '🛏️', apartment: '🏢', house: '🏠', villa: '🏰' };
const CAR_EM = { scooter: '🛵', used: '🚙', family: '🚗', luxury: '🏎️' };
const IND_EM = { food: '🍜', fashion: '👗', bar: '🍹', tech: '💻', realestate: '🏗️' };
function toneOf(changes = []) {
  const s = changes.reduce((a, [k, v]) => a + (k === 'money' || k === 'salary' ? Math.sign(v) * 3 : k === 'risk' ? 0 : v), 0);
  return s > 4 ? 'good' : s < -4 ? 'bad' : '';
}
const li = (a, em, title, sub = '', o = {}) => `<button class="li${o.danger ? ' danger' : ''}" data-a="${a}" ${o.disabled ? 'disabled' : ''}><span class="em">${em}</span><span class="tx"><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</span><span class="chev">›</span></button>`;

// ───────── Màn hình ─────────
function viewGate() {
  return `<main class="splash pad">
    <div class="wordmark">Một<br>Đời<span>.</span></div>
    <p class="tagline">${t('tagline')}</p>
    <form class="section" data-form="gate" novalidate>
      <h2>${t('gateTitle')}</h2>
      <p class="muted">${t('gateBody')}</p>
      <div class="field"><label for="dob">${t('dob')}</label><input id="dob" type="date" required max="${new Date().toISOString().slice(0, 10)}"></div>
      ${ui.gateErr ? `<p class="err">${t(ui.gateErr)}</p>` : ''}
      <div class="row"><button class="btn primary" type="submit">${t('enter')}</button>${langSwitch()}</div>
    </form>
  </main>`;
}
const langSwitch = () => `<button type="button" class="btn small" data-a="lang">${settings.lang === 'vi' ? 'English' : 'Tiếng Việt'}</button>`;

function viewHome() {
  const L = game.life;
  const total = game.events.length;
  const packsOn = game.packs.filter((p) => settings.packs[p.manifest.id] !== false).length;
  return `<main class="splash pad">
    <div class="wordmark">Một<br>Đời<span>.</span></div>
    <p class="tagline">${t('tagline')}</p>
    <div class="menu">
      ${L && !L.dead ? `<button class="menu-card lead" data-a="continue"><span class="em">${face(L.gender, L.age)}</span><b>${t('continue')}</b><span class="muted">${esc(fullName(L))} · ${t('yearsOld', { n: L.age })} · ${country(L).flag} ${esc(tx(country(L).name))}</span></button>` : ''}
      <button class="menu-card ${L && !L.dead ? '' : 'lead'}" data-a="fate"><span class="em">🎲</span><b>${t('fate')}</b><span class="muted">${t('fateSub')}</span></button>
      <button class="menu-card" data-a="free"><span class="em">✏️</span><b>${t('free')}</b><span class="muted">${t('freeSub')}</span></button>
    </div>
    <div class="row"><button class="btn small" data-a="sheet:trophies">🏆 ${t('trophies')}</button><button class="btn small" data-a="sheet:graveyard">🪦 ${t('graveyard')}</button><button class="btn small" data-a="sheet:settings">⚙️ ${t('settings')}</button>${langSwitch()}</div>
    <p class="muted" style="font-size:12.5px">${t('eventCount', { n: total, p: packsOn })} · ${t('homeNote')}</p>
  </main>`;
}
const fullName = (life) => personName(life, { first: life.first, last: life.last });

function blankDraft() {
  const r = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  return {
    first: '', last: '', gender: 'female', country: 'VN', wealth: 'middle', orientation: 'opposite', traits: [],
    stats: { health: r(60, 100), happy: r(50, 100), smarts: r(10, 100), looks: r(10, 100), karma: r(40, 60), willpower: r(20, 80), risk: r(10, 60), fame: 0 },
  };
}
function viewCreate() {
  const d = ui.draft;
  const opt = (v, cur, label) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${esc(label)}</option>`;
  const countries = [...COUNTRIES].sort((a, b) => tx(a.name).localeCompare(tx(b.name))).map((c) => opt(c.code, d.country, `${c.flag} ${tx(c.name)}`)).join('');
  const slider = (k) => `<div class="slider"><span>${STAT_EM[k]}</span><label for="s-${k}">${t(k)}</label><input id="s-${k}" type="range" min="0" max="100" value="${d.stats[k]}" data-d="stats.${k}"><output class="mono">${d.stats[k]}</output></div>`;
  return `<main class="splash pad" style="gap:20px">
    <div class="row" style="justify-content:space-between"><h1 style="font-size:30px">${t('free')}</h1><button class="btn small" data-a="home">${t('back')}</button></div>
    <div class="grid2">
      <div class="field"><label for="c-last">${t('last')}</label><input id="c-last" value="${esc(d.last)}" data-d="last" placeholder="${t('random')}" maxlength="24"></div>
      <div class="field"><label for="c-first">${t('first')}</label><input id="c-first" value="${esc(d.first)}" data-d="first" placeholder="${t('random')}" maxlength="24"></div>
      <div class="field"><label for="c-gender">${t('gender')}</label><select id="c-gender" data-d="gender">${opt('female', d.gender, t('female'))}${opt('male', d.gender, t('male'))}</select></div>
      <div class="field"><label for="c-orient">${t('orientation')}</label><select id="c-orient" data-d="orientation">${['opposite', 'same', 'both'].map((o) => opt(o, d.orientation, t(o))).join('')}</select></div>
      <div class="field"><label for="c-country">${t('country')}</label><select id="c-country" data-d="country">${countries}</select></div>
      <div class="field"><label for="c-wealth">${t('wealth')}</label><select id="c-wealth" data-d="wealth">${WEALTH.map((w) => opt(w, d.wealth, t(w))).join('')}</select></div>
    </div>
    <div class="section"><span class="lbl" style="font-size:13px;font-weight:600">${t('traits')}</span>
      <div class="traits">${Object.entries(TRAITS).map(([k, v]) => `<label><input type="checkbox" data-trait="${k}" ${d.traits.includes(k) ? 'checked' : ''} ${!d.traits.includes(k) && d.traits.length >= 2 ? 'disabled' : ''}>${esc(tx(v.name))}</label>`).join('')}</div>
    </div>
    <div class="section"><div class="row" style="justify-content:space-between"><h3>${t('stats')}</h3><button class="btn small" data-a="draft-random">${t('randomAll')}</button></div>
      ${STAT_KEYS.map(slider).join('')}
      <h3 style="margin-top:6px">${t('hidden')}</h3>${HIDDEN_KEYS.map(slider).join('')}
    </div>
    <p class="note">${t('godNote').split('.')[0]}.</p>
    <button class="btn primary" data-a="create-free">${t('start')}</button>
  </main>`;
}

function viewGame() {
  const L = game.life;
  const c = country(L);
  const ev = !L.dead && !ui.modal && !ui.result && !ui.mini ? currentEvent(game) : null;
  const blocked = L.dead || !!ev || !!ui.modal || !!ui.result || !!ui.mini;
  const dl = ui.deltas || {};
  const stats = STAT_KEYS.map((k) => `<div class="stat"><span class="em">${STAT_EM[k]}</span><span class="nm"><span>${t(k)}</span>${dl[k] ? `<span class="delta ${dl[k] > 0 ? 'up' : 'down'}">${dl[k] > 0 ? '+' : ''}${dl[k]}</span>` : ''}</span>${lvl(L.stats[k])}</div>`).join('');
  const roleLine = L.prison ? `${t('prison')} · ${t('prisonLeft', { n: L.prison.years - L.prison.served })}` : L.fugitive ? t('fugitive') : L.special ? `${SPECIALS[L.special.id].em} ${tx(SPECIALS[L.special.id].levels[L.special.level])}` : L.job ? `${tx(rankName(L.job))}` : L.edu.stage ? stageLine(L) : L.age < 6 ? '' : L.pension ? (settings.lang === 'vi' ? 'Nghỉ hưu' : 'Retired') : t('noJob').replace('.', '');
  const shownYears = L.log.slice(-60);
  let idx = L.log.slice(0, L.log.length - shownYears.length).reduce((n, y) => n + y.items.length, 0);
  const years = shownYears.map((y) => {
    const lis = y.items.map((i) => {
      const fresh = idx++ >= ui.freshFrom;
      if (!i.text) return '';
      return `<li class="${i.tone || ''}${fresh ? ' fresh' : ''}">${i.title ? `<b class="act-title">${esc(tx(i.title))}:</b>` : ''}${esc(tx(i.text))}</li>`;
    }).join('');
    return `<section class="year"><div class="yr">${t('ageHead', { n: y.age })}</div><ul>${lis || `<li class="quiet">${t('quietYear')}</li>`}</ul></section>`;
  }).join('');
  return `<header class="topbar pad">
      <button class="avatar" data-a="sheet:self" aria-label="${t('openSelf')}">${face(L.gender, L.age, null, !L.dead)}<span class="fl">${c.flag}</span></button>
      <button class="who" data-a="sheet:self" title="${t('openSelf')}"><h1>${esc(fullName(L))}</h1><div class="sub"><span class="agechip${ui.ageTick ? ' tick' : ''}">${t('yearsOld', { n: L.age })}</span>${roleLine ? ` · ${esc(roleLine)}` : ''}${L.goals ? ` · 🎯${goalCount(L)}/3` : ''}${L.customized ? ` <span class="tag">${t('customized')}</span>` : ''}</div></button>
      <div class="purse"><small>${t('balance')}</small><b class="${L.money < 0 ? 'neg' : ''}">${money(L.money)}</b></div>
      <div class="tools">${settings.godEnabled ? `<button class="iconbtn" data-a="sheet:god" aria-label="${t('god')}" title="${t('god')}">⚡</button>` : ''}<button class="iconbtn" data-a="sheet:settings" aria-label="${t('settings')}" title="${t('settings')}">⚙️</button></div>
    </header>
    <div class="ledger pad" id="ledger">${years}</div>
    <nav class="dock pad">
      <button class="tab t-work" data-a="sheet:work"><span class="ic">💼</span>${t('tabWorkShort')}</button>
      <button class="tab t-assets" data-a="sheet:assets"><span class="ic">🏠</span>${t('tabAssetsShort')}</button>
      <button class="agebtn" data-a="ageup" ${blocked ? 'disabled' : ''} aria-label="${t('ageUp')}"><div><b>+</b><span>${t('ageBtn')}</span></div></button>
      <button class="tab t-people" data-a="sheet:people"><span class="ic">❤️</span>${t('tabPeopleShort')}</button>
      <button class="tab t-acts" data-a="sheet:acts"><span class="ic">⭐</span>${t('tabActsShort')}</button>
    </nav>
    <section class="stats pad">${stats}</section>
    ${overlays(ev)}`;
}

function resultCard(r) {
  const fx = (r.changes || []).filter(([, v]) => Math.round(v)).map(([k, v]) => {
    const name = k === 'money' ? t('money') : k.startsWith('rel_') ? `${t('closeness')} · ${t('roles.' + k.slice(4))}` : t(k);
    const em = STAT_EM[k] || (k.startsWith('rel_') ? '🤝' : '•');
    const val = k === 'money' || k === 'salary' ? `${v > 0 ? '+' : '−'}${money(Math.abs(v))}` : `${v > 0 ? '+' : ''}${Math.round(v)}`;
    return `<li class="${v > 0 ? 'up' : 'down'}"><span>${em} ${esc(name)}</span><span class="v">${val}</span></li>`;
  }).join('');
  return `<div class="overlay center" data-a="result-ok"><div class="card result ${r.tone || ''}" role="dialog" aria-modal="true">
    <div class="hero">${r.emoji || (r.tone === 'bad' ? '😕' : r.tone === 'good' ? '🎉' : '📌')}</div>
    ${r.title ? `<div class="eyebrow">${esc(tx(r.title))}</div>` : ''}
    <p class="q">${esc(tx(r.text))}</p>
    ${fx ? `<ul class="fx">${fx}</ul>` : ''}
    <button class="btn primary" data-a="result-ok">${t('okBtn')}</button></div></div>`;
}

function sheetBody() {
  if (ui.sheet.startsWith('godp:')) return sheetGodPerson(ui.sheet.slice(5));
  return ({ power: sheetPower, map: sheetMap, album: sheetAlbum, chains: sheetChains, diary: sheetDiary, trigger: sheetTrigger, collection: sheetCollection, harem: sheetHarem, work: sheetWork, people: sheetPeople, acts: sheetActs, self: sheetSelf, god: sheetGod, settings: sheetSettings, assets: sheetAssets, trophies: sheetTrophies, graveyard: sheetGraveyard }[ui.sheet] || (() => sheetPerson(ui.sheet.slice(7))))();
}

function overlays(ev) {
  const L = game.life;
  if (ui.view !== 'game' && ui.sheet) return sheetWrap(sheetBody());
  if (!L) return '';
  if (ui.birth) return centerCard(birthCard());
  if (ui.result) return (ui.sheet ? sheetWrap(sheetBody()) : '') + resultCard(ui.result);
  if (ui.mini) return `<div class="overlay center"><div class="card mini" role="dialog" aria-modal="true">${miniCard(ui.mini)}</div></div>`;
  if (L.dead && !['god', 'settings', 'trophies', 'graveyard', 'diary'].includes(ui.sheet)) return centerCard(deathCard());
  if (L.dead && ui.sheet) return sheetWrap(sheetBody());
  const shown = ui.modal ? ui.modal.ev : ev;
  if (shown) {
    const eyebrow = ui.modal && ui.modal.title ? tx(ui.modal.title) : shown.arc ? `${tx(shown.tag)} · ${shown.npcName}` : shown.big ? t('bigMoment') : t('ageHead', { n: L.age });
    if (shown.big && ui.lastBig !== shown.uid) { ui.lastBig = shown.uid; try { navigator.vibrate && navigator.vibrate([60, 40, 120]); } catch { /* bỏ qua */ } }
    const btns = shown.choices.map((c, i) => {
      const locked = choiceLocked(L, c);
      const need = locked ? Object.entries(c.requires.min || {}).map(([k, v]) => `${k === 'money' ? t('money') : t(k)} ≥ ${k === 'money' ? money(v * country(L).gdp / 100) : v}`).join(', ') : '';
      const tg = L.age >= 6 ? tagChoice(c) : null;
      const fit = tg && inCharacter(L, tg);
      const chip = tg ? `<small class="ctag${fit ? ' fit' : ''}">${traitEm(tg)} ${esc(tx(traitLabel(tg)))}${fit ? ` · ${t('inChar')}` : ''}</small>` : '';
      return `<button class="choice${locked ? ' locked' : ''}" data-a="choose:${i}" ${locked ? 'disabled' : ''}>${locked ? '🔒 ' : ''}${esc(tx(c.label))}${chip}${locked ? `<small>${t('needs')}: ${esc(need)}</small>` : ''}</button>`;
    }).join('');
    const kind = shown.big ? ' big' : shown.arc ? ' arc' : '';
    const em = evEmoji(shown) || (ui.modal && ui.modal.emoji) || '📌';
    return `<div class="overlay center"><div class="card${kind}" role="dialog" aria-modal="true"><div class="hero">${em}</div><div class="eyebrow">${esc(eyebrow)}</div><p class="q">${esc(tx(shown.text))}</p><div class="choices">${btns}</div></div></div>`;
  }
  if (!ui.sheet) return '';
  return sheetWrap(sheetBody());
}
const centerCard = (inner) => `<div class="overlay center"><div class="card" role="dialog" aria-modal="true">${inner}</div></div>`;
const sheetWrap = (inner) => `<div class="overlay" data-a="close-bg"><div class="sheet pad" role="dialog" aria-modal="true">${inner}</div></div>`;
const head = (title, color = 'var(--sky)', back = null) => `<div class="sheet-head" style="--hd:${color}">${back != null ? `<button class="bk" data-a="${back}" aria-label="${t('back')}">‹</button>` : ''}<h2>${title}</h2><button class="x" data-a="close" aria-label="${t('close')}">✕</button></div>`;

function birthCard() {
  const L = game.life;
  const c = country(L);
  const mom = people(L, 'mother')[0];
  const dad = people(L, 'father')[0];
  const sibs = people(L, 'sibling').length;
  return `<div class="hero">👶</div><div class="eyebrow">${t('oneIn')}</div>
    <div class="passport">
      <div class="row"><span class="flag" style="font-size:40px;line-height:1">${c.flag}</span><div><div class="big">${esc(fullName(L))}</div><div class="muted">${esc(tx(c.name))} · ${t(L.gender)}</div></div></div>
      <dl class="kv">
        <dt>💰 ${t('wealth')}</dt><dd>${t(L.wealth)}</dd>
        <dt>👩 ${t('roles.mother')}</dt><dd>${mom ? `${esc(personName(L, mom))}, ${mom.age}` : '—'}</dd>
        <dt>👨 ${t('roles.father')}</dt><dd>${dad ? `${esc(personName(L, dad))}, ${dad.age}` : '—'}</dd>
        <dt>🧒 ${t('roles.sibling')}</dt><dd>${sibs}</dd>
        <dt>⏳ ${t('lifeExp')}</dt><dd class="mono">${c.life}</dd>
        <dt>🌍 ${t('incomeTier')}</dt><dd>${t('tiers.' + tierOf(c))}</dd>
      </dl>
    </div>
    ${L.goals ? `<div class="section"><h3>🎯 ${t('goals')}</h3>${goalsBlock(L, true)}</div>` : ''}
    <button class="btn primary" data-a="birth-ok">${t('start')}</button>`;
}

function deathCard() {
  const L = game.life;
  const c = country(L);
  const kids = people(L, 'child');
  const max = Math.max(L.age, c.life) + 5;
  const ribs = (L.ribbons || []).map((r) => `<div class="rib"><b>${esc(tx(RIBBONS[r].name))}</b><small>${esc(tx(RIBBONS[r].why))}</small></div>`).join('');
  const canRewind = settings.godEnabled && L.snapshots.length && L.counts.rewinds < 3;
  return `<div class="tomb">
      <div class="stone">🪦</div>
      <h2>${esc(fullName(L))}</h2>
      <div class="years">${c.flag} ${t('diedAt', { age: L.age })} · ${esc(tx(L.cause))}</div>
      ${L.customized ? `<span class="tag">${t('customized')}</span>` : ''}
      <div class="lifebar"><span class="muted">${t('vsAvg', { c: esc(tx(c.name)) })}: ${L.age} / ${c.life} ${t('years')}</span>
        <div class="track"><div class="you" style="width:${(L.age / max) * 100}%"></div><div class="avg" style="left:${(c.life / max) * 100}%"></div></div></div>
      <dl class="kv" style="width:100%">
        <dt>${t('eduLevel')}</dt><dd>${t(EDU_LBL[L.edu.level])}</dd>
        <dt>${t('netWorth')}</dt><dd class="mono">${money(netWorth(L))}</dd>
        <dt>${t('kids')}</dt><dd>${L.counts.children}</dd>
        <dt>${t('partners')}</dt><dd>${L.counts.partners}</dd>
      </dl>
      ${L.goals ? `<div style="width:100%;text-align:left">${goalsBlock(L)}</div>` : ''}
      ${ui.newAch && ui.newAch.length ? `<div class="box newach" style="width:100%"><b>🏆 ${t('newAch')}</b>${ui.newAch.map((a) => `<div class="row" style="justify-content:center"><span style="font-size:22px">${a.em}</span><b>${esc(tx(a.name))}</b></div>`).join('')}</div>` : ''}
      ${L.funeral && L.funeral.length ? `<div class="box funeral" style="width:100%;text-align:left"><b>🕯️ ${t('funeral')}</b>${L.funeral.map((x) => `<p class="note" style="margin:6px 0 0">${esc(tx(x))}</p>`).join('')}</div>` : ''}
      <div class="eyebrow">${t('ribbons')}</div>
      <div class="stamps">${ribs}</div>
      ${lifeChart(L)}
      ${milesBlock(L)}
      <details class="box" style="width:100%;text-align:left"><summary><b>📖 ${t('diary')}</b></summary>${diaryHtml(L)}</details>
      <div style="width:100%;text-align:left">${cobornBlock(L)}</div>
      <div class="choices" style="width:100%">
        <button class="btn primary" data-a="fate">${t('newLife')}</button>
        ${kids.filter((k) => k.alive).sort((a, b) => (b.id === L.pw?.heirId) - (a.id === L.pw?.heirId)).map((k) => `<button class="btn${k.id === L.pw?.heirId ? ' primary' : ''}" data-a="heir:${k.id}">${k.id === L.pw?.heirId ? '👑 ' : ''}${t('heir')}: ${esc(personName(L, k))} (${k.age})</button>`).join('')}
        ${canRewind ? `<button class="btn" data-a="rewind">⚡ ${t('rewind')} (${t('rewindLeft', { n: 3 - L.counts.rewinds })})</button>` : ''}
        <div class="row" style="justify-content:center"><button class="btn small" data-a="sheet:graveyard">🪦 ${t('graveyard')}</button><button class="btn small" data-a="sheet:trophies">🏆 ${t('trophies')}</button><button class="btn small" data-a="home">${t('menu')}</button></div>
      </div>
    </div>`;
}

/** Biểu đồ sức khỏe và hạnh phúc qua từng năm, chấm dấu mốc ở dải dưới. */
function lifeChart(L) {
  const h = (L.hist || []).filter((p) => p && typeof p.age === 'number');
  if (h.length < 3) return '';
  const W = 360, H = 190, x0 = 26, x1 = W - 84, y0 = 12, y1 = H - 44;
  const maxAge = Math.max(10, h[h.length - 1].age);
  const X = (a) => x0 + (a / maxAge) * (x1 - x0);
  const Y = (v) => y1 - (v / 100) * (y1 - y0);
  const line = (k) => h.map((p, i) => `${i ? 'L' : 'M'}${X(p.age).toFixed(1)} ${Y(p[k]).toFixed(1)}`).join('');
  const step = maxAge > 60 ? 20 : 10;
  const ticks = [];
  for (let a = 0; a <= maxAge; a += step) ticks.push(a);
  const last = h[h.length - 1];
  let ly = { health: Y(last.health), happy: Y(last.happy) };
  if (Math.abs(ly.health - ly.happy) < 15) { const mid = (ly.health + ly.happy) / 2; const up = ly.health < ly.happy ? 'health' : 'happy'; ly[up] = mid - 7; ly[up === 'health' ? 'happy' : 'health'] = mid + 7; }
  const miles = (L.miles || []).map((m) => `<g><circle cx="${X(m.age).toFixed(1)}" cy="${H - 22}" r="4.5" fill="${m.tone === 'bad' ? 'var(--muted)' : 'var(--ink)'}" stroke="var(--sheet)" stroke-width="2"/><title>${m.age}: ${esc(tx(m.text))}</title></g>`).join('');
  const hits = h.map((p) => `<rect x="${(X(p.age) - (x1 - x0) / maxAge / 2).toFixed(1)}" y="${y0}" width="${Math.max(2, (x1 - x0) / maxAge).toFixed(1)}" height="${y1 - y0}" fill="transparent"><title>${t('age')} ${p.age} · ${t('health')} ${p.health} · ${t('happy')} ${p.happy}</title></rect>`).join('');
  return `<figure class="lifechart">
    <figcaption><span class="eyebrow">${t('lifeChart')}</span><span class="legend"><i style="background:var(--chart-health)"></i>${t('health')}<i style="background:var(--chart-happy)"></i>${t('happy')}<i class="dot"></i>${t('milestones')}</span></figcaption>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${t('lifeChart')}">
      ${[25, 50, 75].map((v) => `<line x1="${x0}" x2="${x1}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--rule)" stroke-width="1"/><text x="${x0 - 6}" y="${Y(v) + 4}" text-anchor="end" class="ax">${v}</text>`).join('')}
      <line x1="${x0}" x2="${x1}" y1="${y1}" y2="${y1}" stroke="var(--rule)" stroke-width="1.5"/>
      ${ticks.map((a) => `<text x="${X(a)}" y="${y1 + 16}" text-anchor="middle" class="ax">${a}</text>`).join('')}
      <line x1="${x0}" x2="${x1}" y1="${H - 22}" y2="${H - 22}" stroke="var(--rule)" stroke-width="1" stroke-dasharray="2 4"/>
      <path d="${line('happy')}" fill="none" stroke="var(--chart-happy)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      <path d="${line('health')}" fill="none" stroke="var(--chart-health)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="${X(last.age)}" cy="${Y(last.health)}" r="4" fill="var(--chart-health)" stroke="var(--sheet)" stroke-width="2"/>
      <circle cx="${X(last.age)}" cy="${Y(last.happy)}" r="4" fill="var(--chart-happy)" stroke="var(--sheet)" stroke-width="2"/>
      <text x="${x1 + 10}" y="${ly.health + 4}" class="lbl">${t('health')} ${last.health}</text>
      <text x="${x1 + 10}" y="${ly.happy + 4}" class="lbl">${t('happy')} ${last.happy}</text>
      ${hits}${miles}
    </svg></figure>`;
}
function milesBlock(L) {
  const m = L.miles || [];
  if (!m.length) return '';
  return `<div class="section" style="width:100%;text-align:left"><h3>${t('milestones')}</h3><ol class="miles">${m.map((x) => `<li class="${x.tone || ''}"><span class="mono">${x.age}</span>${esc(tx(x.text))}</li>`).join('')}</ol></div>`;
}

// ───────── Trò chơi nhỏ ─────────
const MZ = 11; // ô vuông 11×11 (5×5 phòng)
function makeMaze(guards, extraMoves) {
  const g = Array.from({ length: MZ }, () => Array(MZ).fill(1));
  const stack = [[1, MZ - 2]];
  g[MZ - 2][1] = 0;
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const nb = [[2, 0], [-2, 0], [0, 2], [0, -2]].map(([dx, dy]) => [x + dx, y + dy, dx, dy]).filter(([nx, ny]) => nx > 0 && ny > 0 && nx < MZ - 1 && ny < MZ - 1 && g[ny][nx] === 1);
    if (!nb.length) { stack.pop(); continue; }
    const [nx, ny, dx, dy] = nb[Math.floor(Math.random() * nb.length)];
    g[y + dy / 2][x + dx / 2] = 0; g[ny][nx] = 0; stack.push([nx, ny]);
  }
  for (let i = 0; i < 9; i++) { const x = 1 + Math.floor(Math.random() * (MZ - 2)), y = 1 + Math.floor(Math.random() * (MZ - 2)); if ((x + y) % 2 === 1) g[y][x] = 0; }
  const exit = [MZ - 2, 1];
  const dist = bfs(g, exit);
  const start = [1, MZ - 2];
  const gs = [];
  const cands = [];
  for (let y = 1; y < MZ - 1; y++) for (let x = 1; x < MZ - 1; x++) if (!g[y][x] && Math.abs(x - start[0]) + Math.abs(y - start[1]) > 7 && !(x === exit[0] && y === exit[1])) cands.push([x, y]);
  for (let i = 0; i < guards && cands.length; i++) gs.push(cands.splice(Math.floor(Math.random() * cands.length), 1)[0]);
  return { kind: 'maze', g, p: start, exit, guards: gs, left: (dist[start[1]][start[0]] || 20) + extraMoves, msg: null };
}
function bfs(g, [sx, sy]) {
  const d = g.map((r) => r.map(() => null));
  d[sy][sx] = 0;
  const q = [[sx, sy]];
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (g[ny] && g[ny][nx] === 0 && d[ny][nx] == null) { d[ny][nx] = d[y][x] + 1; q.push([nx, ny]); }
    }
  }
  return d;
}
function mazeMove(m, dir) {
  const [dx, dy] = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
  const nx = m.p[0] + dx, ny = m.p[1] + dy;
  if (m.g[ny]?.[nx] !== 0) return null;
  m.p = [nx, ny];
  m.left--;
  if (nx === m.exit[0] && ny === m.exit[1]) return 'win';
  const toP = bfs(m.g, m.p);
  for (const gd of m.guards) {
    if (gd[0] === nx && gd[1] === ny) return 'caught';
    if (Math.random() < 0.55) {
      const opts = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => [gd[0] + a, gd[1] + b]).filter(([x, y]) => m.g[y]?.[x] === 0);
      opts.sort((a, b) => (toP[a[1]][a[0]] ?? 99) - (toP[b[1]][b[0]] ?? 99));
      const pickIt = Math.random() < 0.8 ? opts[0] : opts[Math.floor(Math.random() * opts.length)];
      if (pickIt) { gd[0] = pickIt[0]; gd[1] = pickIt[1]; }
    }
    if (gd[0] === nx && gd[1] === ny) return 'caught';
  }
  if (m.left <= 0) return 'caught';
  return null;
}
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS = ['♠', '♥', '♦', '♣'];
const drawCard = () => ({ v: 1 + Math.floor(Math.random() * 13), s: SUITS[Math.floor(Math.random() * 4)] });
function makeQuiz(total, level) {
  const qs = [];
  const r = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  for (let i = 0; i < total; i++) {
    let q, a;
    const k = level === 0 ? r(0, 1) : level === 1 ? r(0, 2) : r(1, 3);
    if (k === 0) { const x = r(level ? 12 : 2, level ? 89 : 12), y = r(level ? 11 : 1, level ? 59 : 9); q = `${x} + ${y}`; a = x + y; }
    else if (k === 1) { const x = r(level ? 30 : 8, level ? 99 : 20), y = r(level ? 11 : 1, x - 1); q = `${x} − ${y}`; a = x - y; }
    else if (k === 2) { const x = r(3, level > 1 ? 19 : 9), y = r(3, 9); q = `${x} × ${y}`; a = x * y; }
    else { const y = r(3, 12), a0 = r(3, 15); q = `${a0 * y} ÷ ${y}`; a = a0; }
    const opts = new Set([a]);
    while (opts.size < 4) opts.add(Math.max(0, a + r(-10, 10) || a + opts.size));
    qs.push({ q, a, opts: [...opts].sort(() => Math.random() - 0.5) });
  }
  return { kind: 'quiz', qs, i: 0, score: 0, t: 8, total, last: null };
}
let quizTimer = null;
function startQuizTimer() {
  clearInterval(quizTimer);
  quizTimer = setInterval(() => {
    const m = ui.mini;
    if (!m || (m.kind !== 'quiz' && m.kind !== 'exam')) { clearInterval(quizTimer); return; }
    m.t--;
    const el = document.querySelector('.mg-timer');
    if (el) { el.textContent = `⏱ ${m.t}s`; el.classList.toggle('hot', m.t <= 3); }
    if (m.t <= 0) quizAnswer(null);
  }, 1000);
}
function quizAnswer(v) {
  const m = ui.mini;
  const q = m.qs[m.i];
  const ok = v === q.a;
  if (ok) m.score++;
  m.last = ok ? 'ok' : 'no';
  m.i++;
  m.t = 8;
  if (m.i >= m.qs.length) { clearInterval(quizTimer); finishMini(m.kind === 'exam' ? resolveExam(game.life, m.score, m.total) : resolveOlympiad(game.life, m.score, m.total)); }
  persist();
  render();
}
function initMini(spec, title, emoji) {
  const m2 = initMini2(spec, title, emoji);
  if (m2) return m2;
  if (spec.kind === 'maze') return { ...makeMaze(spec.guards || 1, 10), title, emoji: emoji || '🏃' };
  if (spec.kind === 'cards') return { kind: 'cards', bets: spec.bets, bet: null, card: null, pot: 0, streak: 0, msg: null, title, emoji: emoji || '🎰' };
  if (spec.kind === 'quiz') { const m = { ...makeQuiz(spec.total, spec.level), title, emoji: emoji || '🏆' }; setTimeout(startQuizTimer, 0); return m; }
  return null;
}
function finishMini(r) {
  const m = ui.mini;
  ui.mini = null;
  clearInterval(quizTimer);
  if (r) record(r, m.title, false, m.emoji);
}
function mgClick(a, b) {
  const m = ui.mini;
  const L = game.life;
  if (!m) return;
  if (a !== 'quit' && mgClick2(m, a, b)) return;
  if (a === 'quit') {
    if (m.kind === 'maze') { finishMini({ text: { vi: 'Bạn lặng lẽ quay về phòng giam trước khi ai đó phát hiện.', en: 'You quietly slip back to your cell before anyone notices.' }, changes: [], tone: '' }); return; }
    if (m.kind === 'cards' && m.bet) { finishMini(resolveCasino(L, m.bet, m.pot)); return; }
    finishMini(null); return;
  }
  if (m.kind === 'maze') {
    const out = mazeMove(m, a);
    if (out === 'win') finishMini(resolveEscape(L, true));
    else if (out === 'caught') finishMini(resolveEscape(L, false));
  } else if (m.kind === 'cards') {
    if (a === 'bet') {
      const u = Number(b);
      if (L.money < u * country(L).gdp / 100) { m.msg = { vi: 'Bạn không đủ tiền cho mức cược này.', en: "You can't cover that bet." }; return; }
      m.bet = u; m.pot = u; m.card = drawCard(); m.msg = null; return;
    }
    if (a === 'cash') { finishMini(resolveCasino(L, m.bet, m.pot)); return; }
    const next = drawCard();
    if (next.v === m.card.v) { m.card = next; m.msg = { vi: 'Bằng nhau! Rút lá khác.', en: 'A tie! Draw again.' }; return; }
    const ok = a === 'hi' ? next.v > m.card.v : next.v < m.card.v;
    m.prev = m.card; m.card = next;
    if (!ok) { m.pot = 0; m.lost = true; finishMini(resolveCasino(L, m.bet, 0)); return; }
    m.pot *= 2; m.streak++; m.msg = { vi: `Đúng! Tiền cược nhân đôi.`, en: 'Correct! Pot doubled.' };
    if (m.streak >= 5) finishMini(resolveCasino(L, m.bet, m.pot));
  } else if ((m.kind === 'quiz' || m.kind === 'exam') && a === 'ans') {
    quizAnswer(Number(b));
  }
}
function miniCard(m) {
  const L = game.life;
  const unitMoney = (u) => money(u * country(L).gdp / 100);
  const c2 = miniCard2(m);
  if (c2) return c2;
  if (m.kind === 'maze') {
    const cells = [];
    for (let y = 0; y < MZ; y++) for (let x = 0; x < MZ; x++) {
      const isP = m.p[0] === x && m.p[1] === y;
      const isG = m.guards.some((g) => g[0] === x && g[1] === y);
      const isE = m.exit[0] === x && m.exit[1] === y;
      cells.push(`<i class="${m.g[y][x] ? 'w' : ''}">${isP ? '🧍' : isG ? '👮' : isE ? '🚪' : ''}</i>`);
    }
    return `<div class="hero">🏃</div><div class="eyebrow">${t('mgMaze')}</div><p class="q small">${t('mgMazeHelp')}</p>
      <div class="mg-top"><span>👣 ${t('mgMoves', { n: m.left })}</span><span>👮 ×${m.guards.length}</span></div>
      <div class="maze" style="--n:${MZ}">${cells.join('')}</div>
      <div class="pad4"><span></span><button class="kbtn" data-a="mg:up" aria-label="up">⬆️</button><span></span><button class="kbtn" data-a="mg:left" aria-label="left">⬅️</button><button class="kbtn" data-a="mg:down" aria-label="down">⬇️</button><button class="kbtn" data-a="mg:right" aria-label="right">➡️</button></div>
      <button class="btn small" data-a="mg:quit">${t('mgGiveUp')}</button>`;
  }
  if (m.kind === 'cards') {
    const card = (c) => c ? `<div class="pcard ${c.s === '♥' || c.s === '♦' ? 'red' : ''}"><b>${RANKS[c.v - 1]}</b><span>${c.s}</span></div>` : '';
    if (!m.bet) return `<div class="hero">🎰</div><div class="eyebrow">${t('mgCards')}</div><p class="q small">${t('mgCardsHelp')}</p>${m.msg ? `<p class="err" style="text-align:center;margin:0">${esc(tx(m.msg))}</p>` : ''}
      <div class="choices">${m.bets.map((u, i) => `<button class="choice" data-a="mg:bet:${u}">${i ? '💰💰' : '💰'} ${t('mgBet')} ${unitMoney(u)}</button>`).join('')}<button class="btn small" data-a="mg:quit">${t('mgLeave')}</button></div>`;
    return `<div class="eyebrow">${t('mgCards')}</div>
      <div class="mg-top"><span>${t('mgPot')}: <b class="mono">${unitMoney(m.pot)}</b></span><span>🔥 ×${m.streak}</span></div>
      <div class="cardrow">${m.prev ? `<div class="ghost">${card(m.prev)}</div>` : ''}${card(m.card)}</div>
      ${m.msg ? `<p class="q small" style="color:var(--good)">${esc(tx(m.msg))}</p>` : `<p class="q small">${t('mgNext')}</p>`}
      <div class="grid2"><button class="choice" data-a="mg:hi">⬆️ ${t('mgHi')}</button><button class="choice" data-a="mg:lo">⬇️ ${t('mgLo')}</button></div>
      ${m.streak ? `<button class="btn primary" data-a="mg:cash">💵 ${t('mgCash')} ${unitMoney(m.pot)}</button>` : ''}`;
  }
  if (m.kind === 'quiz' || m.kind === 'exam') {
    const q = m.qs[Math.min(m.i, m.qs.length - 1)];
    return `<div class="hero">${m.kind === 'exam' ? '📝' : '🏆'}</div><div class="eyebrow">${t(m.kind === 'exam' ? 'mgExam' : 'mgQuiz')}</div>
      <div class="mg-top"><span>${t('mgQ', { n: m.i + 1, m: m.total })} · ✅ ${m.score}</span><span class="mg-timer${m.t <= 3 ? ' hot' : ''}">⏱ ${m.t}s</span></div>
      ${m.last ? `<p class="q small" style="color:${m.last === 'ok' ? 'var(--good)' : 'var(--bad)'}">${m.last === 'ok' ? '✅' : '❌'}</p>` : ''}
      <p class="quizq mono">${q.q} = ?</p>
      <div class="grid2">${q.opts.map((o) => `<button class="choice mono" data-a="mg:ans:${o}">${o}</button>`).join('')}</div>`;
  }
  return '';
}

// ───────── Trò chơi nhỏ: đua ngựa, xì dách, phỏng vấn, luyện thi ─────────
const HORSES = [['Gió', 'Wind', 2], ['Sấm', 'Thunder', 3], ['Mây Trắng', 'White Cloud', 4], ['Bánh Bao', 'Dumpling', 6], ['Ông Già', 'Old Timer', 10]];
let raceTimer = null;
function startRace(m) {
  const w = HORSES.map((h) => 1 / h[2]);
  const tot = w.reduce((a, b) => a + b, 0);
  let r = Math.random() * tot, win = 0;
  for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) { win = i; break; } }
  m.winner = win;
  m.pos = HORSES.map(() => 0);
  m.running = true;
  clearInterval(raceTimer);
  raceTimer = setInterval(() => {
    const mm = ui.mini;
    if (!mm || mm.kind !== 'race') { clearInterval(raceTimer); return; }
    mm.pos = mm.pos.map((p, i) => Math.min(100, p + Math.random() * 9 + (i === mm.winner ? 3.2 : 1.5)));
    const lead = mm.pos.indexOf(Math.max(...mm.pos));
    if (mm.pos[lead] >= 100) {
      if (lead !== mm.winner) { mm.pos[mm.winner] = 100; mm.pos[lead] = 98.5; }
      clearInterval(raceTimer);
      mm.running = false;
      setTimeout(() => { const h = HORSES[mm.pick]; finishMini(resolveRace(game.life, mm.bet, mm.pick === mm.winner, h[2], settings.lang === 'vi' ? h[0] : h[1])); persist(); render(); }, 700);
    }
    document.querySelectorAll('.lane i').forEach((el, i) => { el.style.left = `calc(${mm.pos[i]}% - 26px)`; });
  }, 120);
}
function bjValue(cards) {
  let v = 0, aces = 0;
  for (const c of cards) { if (c.v === 1) { aces++; v += 11; } else v += Math.min(10, c.v); }
  while (v > 21 && aces) { v -= 10; aces--; }
  return v;
}
function bjFinish(m) {
  const pv = bjValue(m.player);
  while (bjValue(m.dealer) < 17) m.dealer.push(drawCard());
  const dv = bjValue(m.dealer);
  m.reveal = true;
  const out = pv > 21 ? 'lose' : dv > 21 || pv > dv ? 'win' : pv === dv ? 'push' : 'lose';
  setTimeout(() => { finishMini(resolveBlackjack(game.life, m.bet, out)); persist(); render(); }, 900);
}
function initMini2(spec, title, emoji) {
  if (spec.kind === 'race') return { kind: 'race', bet: null, pick: null, pos: HORSES.map(() => 0), title, emoji: emoji || '🏇' };
  if (spec.kind === 'blackjack') return { kind: 'blackjack', bets: spec.bets, bet: null, player: [], dealer: [], title, emoji: emoji || '🃏' };
  if (spec.kind === 'interview') {
    const pool = [...INTERVIEW_QS].sort(() => Math.random() - 0.5).slice(0, 3);
    return { kind: 'interview', job: spec.job, qs: pool.map((q) => ({ q: q.q, a: [...q.a].sort(() => Math.random() - 0.5) })), i: 0, score: 0, title, emoji: emoji || '🤝' };
  }
  if (spec.kind === 'exam') { const m = { ...makeQuiz(spec.total, spec.level), kind: 'exam', title, emoji: emoji || '📝' }; setTimeout(startQuizTimer, 0); return m; }
  return null;
}
function mgClick2(m, a, b) {
  const L = game.life;
  if (m.kind === 'race') {
    if (a === 'bet') { const uu = Number(b); if (L.money < uu * country(L).gdp / 100) { m.msg = { vi: 'Bạn không đủ tiền cho mức cược này.', en: "You can't cover that bet." }; return true; } m.bet = uu; m.msg = null; return true; }
    if (a === 'horse' && m.bet && !m.running) { m.pick = Number(b); setTimeout(() => startRace(m), 50); m.running = true; return true; }
    return true;
  }
  if (m.kind === 'blackjack') {
    if (a === 'bet') { const uu = Number(b); if (L.money < uu * country(L).gdp / 100) { m.msg = { vi: 'Bạn không đủ tiền cho mức cược này.', en: "You can't cover that bet." }; return true; } m.bet = uu; m.player = [drawCard(), drawCard()]; m.dealer = [drawCard(), drawCard()]; m.msg = null; if (bjValue(m.player) === 21) { m.reveal = true; setTimeout(() => { finishMini(resolveBlackjack(L, m.bet, bjValue(m.dealer) === 21 ? 'push' : 'bj')); persist(); render(); }, 900); } return true; }
    if (a === 'hit') { m.player.push(drawCard()); if (bjValue(m.player) > 21) { m.reveal = true; m.done = true; setTimeout(() => { finishMini(resolveBlackjack(L, m.bet, 'lose')); persist(); render(); }, 900); } return true; }
    if (a === 'stand') { m.done = true; bjFinish(m); return true; }
    return true;
  }
  if (m.kind === 'interview' && a === 'ans') {
    const q = m.qs[m.i];
    m.score += q.a[Number(b)].s;
    m.i++;
    if (m.i >= m.qs.length) {
      const ratio = m.score / m.qs.length;
      const r = applyJob(L, m.job, { interview: ratio });
      finishMini(r);
    }
    return true;
  }
  return false;
}
function miniCard2(m) {
  const L = game.life;
  const unitMoney = (u2) => money(u2 * country(L).gdp / 100);
  if (m.kind === 'race') {
    if (!m.bet) return `<div class="hero">🏇</div><div class="eyebrow">${t('mgRace')}</div><p class="q small">${t('mgRaceHelp')}</p>${m.msg ? `<p class="err" style="text-align:center;margin:0">${esc(tx(m.msg))}</p>` : ''}<div class="choices">${[5, 25].map((u2, i) => `<button class="choice" data-a="mg:bet:${u2}">${i ? '💰💰' : '💰'} ${t('mgBet')} ${unitMoney(u2)}</button>`).join('')}<button class="btn small" data-a="mg:quit">${t('mgLeave')}</button></div>`;
    const lanes = HORSES.map((h, i) => `<div class="lane${m.pick === i ? ' mine' : ''}"><span class="hn">${settings.lang === 'vi' ? h[0] : h[1]} · x${h[2]}</span><i style="left:calc(${m.pos[i]}% - 26px)">🏇</i></div>`).join('');
    return `<div class="eyebrow">${t('mgRace')} · ${t('mgBet')} ${unitMoney(m.bet)}</div>${m.pick == null ? `<p class="q small">${t('mgPickHorse')}</p><div class="choices">${HORSES.map((h, i) => `<button class="choice" data-a="mg:horse:${i}">🐎 ${settings.lang === 'vi' ? h[0] : h[1]} · ${t('mgOdds')} x${h[2]}</button>`).join('')}</div>` : `<div class="track">${lanes}</div>`}`;
  }
  if (m.kind === 'blackjack') {
    const card = (c, hide) => hide ? `<div class="pcard back"><b>?</b></div>` : `<div class="pcard sm ${c.s === '♥' || c.s === '♦' ? 'red' : ''}"><b>${RANKS[c.v - 1]}</b><span>${c.s}</span></div>`;
    if (!m.bet) return `<div class="hero">🃏</div><div class="eyebrow">${t('mgBJ')}</div><p class="q small">${t('mgBJHelp')}</p>${m.msg ? `<p class="err" style="text-align:center;margin:0">${esc(tx(m.msg))}</p>` : ''}<div class="choices">${m.bets.map((u2, i) => `<button class="choice" data-a="mg:bet:${u2}">${i ? '💰💰' : '💰'} ${t('mgBet')} ${unitMoney(u2)}</button>`).join('')}<button class="btn small" data-a="mg:quit">${t('mgLeave')}</button></div>`;
    return `<div class="eyebrow">${t('mgBJ')} · ${t('mgBet')} ${unitMoney(m.bet)}</div>
      <div class="mg-top"><span>${t('mgDealer')}</span><span>${m.reveal ? bjValue(m.dealer) : '?'}</span></div><div class="cardrow">${m.dealer.map((c, i) => card(c, i === 1 && !m.reveal)).join('')}</div>
      <div class="mg-top"><span>${t('mgYou')}</span><span>${bjValue(m.player)}</span></div><div class="cardrow">${m.player.map((c) => card(c)).join('')}</div>
      ${!m.reveal && !m.done ? `<div class="grid2"><button class="choice" data-a="mg:hit">➕ ${t('mgHit')}</button><button class="choice" data-a="mg:stand">✋ ${t('mgStand')}</button></div>` : ''}`;
  }
  if (m.kind === 'interview') {
    const q = m.qs[Math.min(m.i, m.qs.length - 1)];
    return `<div class="hero">🤝</div><div class="eyebrow">${t('mgInterview')} · ${t('mgQ', { n: m.i + 1, m: m.qs.length })}</div><p class="q">${esc(tx(q.q))}</p><div class="choices">${q.a.map((x, i) => `<button class="choice" data-a="mg:ans:${i}">${esc(tx(x.t))}</button>`).join('')}</div>`;
  }
  return '';
}

// ───────── Mục tiêu, thành tựu, nghĩa trang ─────────
function goalsBlock(L, compact) {
  if (!L.goals) return '';
  const rows = L.goals.map((g) => { const d = goalById[g.id]; return d ? `<li class="${g.done != null ? 'done' : ''}"><span class="gem">${g.done != null ? '✅' : d.em}</span><span>${esc(tx(d.name))}${g.done != null ? ` <small class="muted">· ${t('age')} ${g.done}</small>` : ''}</span></li>` : ''; }).join('');
  return `<div class="${compact ? 'goals compact' : 'box'}">${compact ? '' : `<b>🎯 ${t('goals')}</b>`}<ul class="goallist">${rows}</ul></div>`;
}
const goalCount = (L) => (L.goals || []).filter((g) => g.done != null).length;
function sheetTrophies() {
  const got = Object.keys(profile.ach).length;
  const ribIds = Object.keys(RIBBONS);
  const ribGot = ribIds.filter((r) => profile.ribbons[r]).length;
  const ach = ACHIEVEMENTS.map((a) => { const on = !!profile.ach[a.id]; return `<div class="item ${on ? '' : 'dead'}"><span class="avatar sm">${on ? a.em : '🔒'}</span><div class="main"><b>${esc(tx(a.name))}</b><small>${esc(tx(a.why))}</small></div></div>`; }).join('');
  const ribs = ribIds.map((r) => { const n = profile.ribbons[r] || 0; return `<div class="rib ${n ? '' : 'off'}"><b>${n ? esc(tx(RIBBONS[r].name)) : '???'}</b><small>${n ? `${esc(tx(RIBBONS[r].why))} · ×${n}` : esc(tx(RIBBONS[r].why))}</small></div>`; }).join('');
  return `${head(`🏆 ${t('trophies')}`, '#a16207')}
    <dl class="kv"><dt>🪦</dt><dd>${t('livesLived', { n: profile.lives.length })}</dd><dt>🌍</dt><dd>${t('countriesBorn', { n: profile.countries.length })}</dd><dt>🎯</dt><dd>${t('goalsTotal', { n: profile.goalsDone })}</dd><dt>🏆</dt><dd>${t('achCount', { n: got, m: ACHIEVEMENTS.length })}</dd></dl>
    <div class="section"><h3>🏆 ${t('trophies')}</h3><div class="list">${ach}</div></div>
    <div class="section"><h3>🎀 ${t('ribbonBook')} · ${t('ribbonCount', { n: ribGot, m: ribIds.length })}</h3><div class="stamps">${ribs}</div></div>`;
}
function sheetGraveyard() {
  if (!profile.lives.length) return head(`🪦 ${t('graveyard')}`, '#475569') + `<p class="note">${t('noGraves')}</p>`;
  const rows = profile.lives.map((x) => {
    const c = byCode[x.country] || byCode.US;
    const rib = (x.ribbons || []).slice(0, 3).map((r) => (RIBBONS[r] ? tx(RIBBONS[r].name) : '')).filter(Boolean).join(', ');
    return `<div class="item"><span class="avatar sm">🪦<span class="fl" style="font-size:14px">${c.flag}</span></span><div class="main"><b>${esc(`${x.last} ${x.first}`.trim())}</b><small>${t('diedAt', { age: x.age })} · ${esc(tx(x.cause))}${rib ? ` · 🎀 ${esc(rib)}` : ''}${x.custom ? ` · ${t('customized')}` : ''}</small></div><div class="side"><span class="mono">${x.goals}/3 🎯</span>${(x.gen || 1) > 1 ? `<span>${t('gen', { n: x.gen })}</span>` : ''}</div></div>`;
  }).join('');
  return `${head(`🪦 ${t('graveyard')}`, '#475569')}<p class="muted" style="margin:0">${t('livesLived', { n: profile.lives.length })}</p><div class="list">${rows}</div>`;
}

// ───────── Bảng trượt ─────────
const EDU_LBL = { none: 'eduNone', highschool: 'eduHs', bachelor: 'eduBa', master: 'eduMa', phd: 'eduPhd' };
const STAGE_EM = { primary: '🏫', secondary: '🏫', uni: '🎓', grad: '🎓', trade: '🧰' };
function stageLine(L) {
  const e = L.edu;
  if (e.stage === 'uni') return `${majorById[e.major]?.em || '🎓'} ${tx(majorById[e.major]?.name) || t('uni')}`;
  if (e.stage === 'grad') return `${majorById[e.major]?.em || '🎓'} ${t(e.gradLevel === 'phd' ? 'eduPhd' : 'eduMa')} · ${tx(majorById[e.major]?.name)}`;
  if (e.stage === 'trade') return `${tradeById[e.trade]?.em || '🧰'} ${tx(tradeById[e.trade]?.name)}`;
  return e.stage ? t(e.stage) : '';
}
function needText(m) {
  if (m.trade) return t('needTrade', { x: tx(tradeById[m.trade].name) });
  const lvl = t(EDU_LBL[m.level]);
  const majors = m.major ? m.major.slice(0, 2).map((x) => tx(majorById[x].name)).join(' / ') : t('anyMajor');
  return t('needDegree', { x: `${lvl} ${majors}` });
}
function sheetWork() {
  const L = game.life;
  const e = L.edu;
  let html = head(`💼 ${t('tabWork')}`, 'var(--b-work)');
  if (L.prison) return html + `<dl class="kv"><dt>⛓️ ${t('prison')}</dt><dd>${t('prisonLeft', { n: L.prison.years - L.prison.served })}</dd><dt>${t('cause')}</dt><dd>${esc(tx(L.prison.crime))}</dd></dl><p class="note">${t('prisonNote')}</p>`;
  // Hồ sơ học tập
  const degs = (e.degrees || []).map((d) => `<li>🎓 ${esc(tx(degreeName(d)))}${d.honors ? ` <span class="tag">${t('honors')}</span>` : ''}</li>`).concat((e.trades || []).map((x) => `<li>${tradeById[x].em} ${t('trade')}: ${esc(tx(tradeById[x].name))}</li>`)).join('');
  html += `<dl class="kv"><dt>🎓 ${t('eduLevel')}</dt><dd>${t(EDU_LBL[e.level])}</dd>
    ${e.stage ? `<dt>${STAGE_EM[e.stage]} ${t('school')}</dt><dd>${esc(stageLine(L))}</dd>` : ''}
    ${['uni', 'grad', 'trade'].includes(e.stage) ? `<dt>⏳ ${t('yearOf', { n: e.years + 1, m: stageLength(L) })}</dt><dd>${prog(((e.years + 0.5) / stageLength(L)) * 100)}</dd>` : ''}
    ${e.stage && e.stage !== 'trade' ? `<dt>📝 ${t('gpa')}</dt><dd>${lvl(e.gpa)}</dd>` : ''}
    ${e.scholarship ? `<dt>🏅</dt><dd>${t('scholarship')}</dd>` : ''}${e.intern ? `<dt>🗂️</dt><dd>${t('internTag')}</dd>` : ''}</dl>
    ${degs ? `<div class="box"><b>${t('degrees')}</b><ul class="degs">${degs}</ul></div>` : ''}`;
  if (e.stage === 'primary' || e.stage === 'secondary') {
    html += `<div class="section"><h3>${t('school')}</h3><div class="list">${li('w:study', '📚', t('study'))}${li('w:skip', '🛹', t('skip'))}${e.stage === 'secondary' ? li('w:olympiad', '🏆', t('olympiad')) : ''}${e.stage === 'secondary' && L.age >= 15 ? li('w:exam', '📝', t('examPrep'), t('examPrepSub')) : ''}${L.age >= 16 ? li('w:dropout', '🚪', t('dropout'), '', { danger: true }) : ''}</div></div>`;
  } else if (e.stage === 'uni' || e.stage === 'grad') {
    html += `<div class="section"><h3>${t('student')}</h3><div class="list">${li('w:study', '📚', t('study'))}${li('w:skip', '🛌', t('skip'))}${li('w:club', '🎭', t('club'))}${li('w:parttime', '☕', t('parttime'))}${!e.scholarship ? li('w:scholar', '🏅', t('scholar')) : ''}${e.stage === 'uni' && !e.exchanged ? li('w:exchange', '✈️', t('exchange')) : ''}${e.years + 1 >= stageLength(L) - 1 ? li('w:intern', '🗂️', t('intern')) : ''}${e.stage === 'uni' ? li('w:switch', '🔀', t('switchMajor')) : ''}${li('w:dropout', '🚪', t('dropout'), '', { danger: true })}</div></div>`;
  } else if (e.stage === 'trade') {
    html += `<div class="section"><h3>${t('trade')}</h3><div class="list">${li('w:study', '🧰', t('study'))}${li('w:parttime', '☕', t('parttime'))}${li('w:dropout', '🚪', t('dropout'), '', { danger: true })}</div></div>`;
  } else if (L.age >= 17 && e.level !== 'none') {
    html += `<div class="section"><h3>${t('studyOptions')}</h3><div class="list">${li('w:exam', '📝', t('examPrep'), t('examPrepSub'))}${li('w:uni', '🎓', t('enrolUni'), t('uniSub'))}${li('w:trade', '🧰', t('enrolTrade'), t('tradeSub'))}${['bachelor', 'master', 'phd'].includes(e.level) ? li('w:grad', '📜', t('enrolGrad'), t('gradSub')) : ''}</div></div>`;
  }
  if (L.job) html += jobBlock(L);
  if (L.job && L.team) { const tp = teamPeople(L); if (tp.length) html += `<div class="section"><h3>🏢 ${t('workplace')}</h3><div class="list">${tp.map((p) => personRow(L, p)).join('')}</div></div>`; }
  html += specialBlock(L);
  if (L.age < 15) return html + `<p class="note">${t('tooYoung')}</p>`;
  if (!L.job) {
    const list = jobOpenings(L).map((c) => {
      const req = Object.entries(c.min).map(([k, v]) => `${STAT_EM[k] || ''}${v}+`).join(' ');
      const rk = entryRank(L, c.id, entryBonus(L, c.id));
      const pay = salaryFor(L, c.id, rk, 'mid', false);
      return li(`job:${c.id}`, JOB_EM[c.id] || '💼', esc(tx(ladderOf(c.id)[rk].name)), `${esc(tx(c.title))} · ${money(pay)}${req ? ` · ${t('needs')}: ${req}` : ''}`);
    }).join('');
    html += `<div class="section"><h3>${t('openings')}</h3><div class="list">${list}</div></div>`;
    const locked = jobsLocked(L);
    if (locked.length) html += `<div class="section"><h3>🔒 ${t('lockedJobs')}</h3><div class="list">${locked.map(([c, m]) => li('noop', JOB_EM[c.id] || '💼', esc(tx(c.title)), `${money(c.pay * country(L).gdp)} · ${esc(needText(m))}`, { disabled: true })).join('')}</div></div>`;
  }
  return html;
}

function jobBlock(L) {
  const j = L.job;
  const c = careerById[j.id];
  const lad = ladderOf(j.id);
  const co = COMPANIES[j.company || 'mid'];
  const nx = nextRank(L);
  const ok = (b) => (b ? '✅' : '⬜');
  const next = nx.top ? `<p class="note" style="margin:0">🏔️ ${t('topRank')}</p>` : `<div class="box"><b>⬆️ ${t('nextRank')}: ${esc(tx(nx.rank.name))}</b>
      <ul class="goallist"><li><span class="gem">${ok(nx.yearsHave >= nx.yearsNeed)}</span><span>⏳ ${t('needYears', { a: nx.yearsHave, b: nx.yearsNeed })}</span></li>
      <li><span class="gem">${ok(j.perf >= nx.perfNeed)}</span><span>📈 ${t('needPerf', { n: nx.perfNeed })}</span></li>
      ${nx.rank.need ? `<li><span class="gem">${ok(!nx.need)}</span><span>🎓 ${nx.rank.need.edu ? t(nx.rank.need.edu === 'phd' ? 'eduPhd' : 'eduMa') : `${STAT_EM[Object.keys(nx.rank.need)[0]]} ${Object.values(nx.rank.need)[0]}+`}</span></li>` : ''}</ul></div>`;
  const steps = lad.map((r, i) => `<li class="${i < j.level ? 'done' : i === j.level ? 'cur' : ''}"><span class="gem">${i < j.level ? '✅' : i === j.level ? '📍' : '🔒'}</span><span>${esc(tx(r.name))}<small class="muted"> · ${r.y ? t('yrsShort', { n: r.y }) : t('entry')} · ×${r.m}</small></span></li>`).join('');
  return `<div class="section"><h3>${t('job')}</h3>
    <div class="profile"><span class="avatar">${JOB_EM[j.id] || '💼'}</span><div class="tx"><b>${esc(tx(rankName(j)))}</b><small class="muted">${esc(tx(c.title))} · ${co.em} ${esc(tx(co.name))}</small><small class="muted">💵 ${money(j.salary)}/${t('yearWord')} · ⏳ ${t('expYears', { n: effExp(L, j.id) })}</small></div></div>
    <dl class="kv"><dt>📈 ${t('perf')}</dt><dd>${lvl(j.perf)}</dd>${j.culture && CULTURES[j.culture] ? `<dt>${CULTURES[j.culture].em} ${t('culture')}</dt><dd>${esc(tx(CULTURES[j.culture].name))}</dd>` : ''}${L.prorep != null ? `<dt>🏅 ${t('prorep')}</dt><dd>${lvl(L.prorep)}</dd>` : ''}</dl>
    ${next}
    <div class="list">${li('w:hard', '💪', t('workHard'))}${!nx.top ? li('w:promote', '⬆️', t('promoteAsk'), nx.eligible ? t('promoteReady') : '') : ''}${li('w:raise', '💰', t('raise'))}${li('w:overtime', '⏰', t('overtime'))}${li('w:bossdrinks', '🍻', t('bossdrinks'))}${li('w:transfer', '🔁', t('transfer'))}${li('w:leave', '🏖️', t('leaveWork'))}${li('w:strike', '✊', t('strike'))}${li('w:whistle', '📣', t('whistle'))}${li('w:quit', '🚪', t('quit'), '', { danger: true })}</div>
    <details class="box"><summary><b>🪜 ${t('ladder')}</b></summary><ul class="goallist ladder">${steps}</ul></details></div>`;
}
function specialBlock(L) {
  const sp = L.special;
  if (sp) {
    const s = SPECIALS[sp.id];
    return `<div class="section"><h3>🌟 ${t('special')}</h3>
      <div class="profile"><span class="avatar">${s.em}</span><div class="tx"><b>${esc(tx(s.levels[sp.level]))}</b><small class="muted">${esc(tx(s.name))} · ${t('levelOf', { n: sp.level + 1, m: s.levels.length })} · ~${money(s.pay[sp.level] * country(L).gdp)}</small></div></div>
      <dl class="kv"><dt>📈 ${t('perf')}</dt><dd>${lvl(sp.perf)}</dd><dt>⭐ ${t('fame')}</dt><dd>${lvl(L.stats.fame)}</dd></dl>
      <div class="list">${li('sp:big', '🚀', esc(tx(s.big)))}${li('sp:train', '🏋️', esc(tx(s.train)))}${li('sp:promo', '🎙️', esc(tx(s.promo)))}${li('sp:quit', '🚪', t('quitSpecial'), '', { danger: true })}</div></div>`;
  }
  if (L.age < 14 || L.prison) return '';
  const rows = Object.entries(SPECIALS).filter(([, s]) => !s.adult || settings.adult25).map(([id, s]) => li(`sp:join:${id}`, s.em, esc(tx(s.join)), `${esc(tx(s.name))} · ${STAT_EM[s.stat]} ${s.req}+ · ${t('ageRange', { a: s.minAge, b: s.maxAge })}`, { disabled: !canJoin(L, id, settings) })).join('');
  return `<div class="section"><h3>🌟 ${t('special')}</h3><div class="list">${rows}</div></div>`;
}
const roleName = (L, p) => t(p.role === 'lover' && polyOk(L) ? 'roles.loverPoly' : 'roles.' + p.role);
function personRow(L, p) {
  return `<button class="item ${p.alive ? '' : 'dead'}" data-a="person:${p.id}"><span class="avatar sm">${face(p.gender, p.age, p.role, p.alive, p.species)}</span><div class="main"><b>${esc(personName(L, p))}</b><small>${roleName(L, p)} · ${p.age}${p.alive ? '' : ' †'}</small></div><div class="side">${p.alive ? lvl(p.closeness) : ''}</div></button>`;
}
function sheetPeople() {
  const L = game.life;
  const groups = [
    ['love', '💘', ['spouse', 'partner', 'lover'], (p) => !p.baby],
    ['sugarGroup', '💎', ['lover', 'partner'], (p) => p.baby],
    ['family', '👪', ['mother', 'father', 'sibling', 'half', 'pet']],
    ['children', '🧒', ['child']],
    ['friends', '🤝', ['bestie', 'friend']],
    ['others', '👥', ['boss', 'mentor', 'teacher', 'rival', 'coworker', 'neighbor', 'contact', 'ex']],
  ];
  let html = head(`❤️ ${t('tabPeople')}`, 'var(--b-people)');
  const hn = hMembers(L).length;
  html += `<div class="list">${li('doall', '⚡', t('doAll'), t('doAllSub'))}${settings.adult25 && L.age >= 18 ? li('sheet:harem', '👑', t('harem'), hn ? `${hn} ${t('membersN')} · ${t('harmony')} ${Math.round(L.harem.harmony)}` : t('haremNone')) : ''}</div>`;
  for (const [g, em, roles, f] of groups) {
    if (g === 'sugarGroup' && !settings.adult25) continue;
    const list = L.people.filter((p) => !p.cut && roles.includes(p.role) && (!f || f(p)) && (p.alive || g !== 'others')).sort((a, b) => roles.indexOf(a.role) - roles.indexOf(b.role));
    if (!list.length && g !== 'love') continue;
    html += `<div class="section"><h3>${em} ${t(g)}</h3>${list.length ? `<div class="list">${list.slice(-12).map((p) => personRow(L, p)).join('')}</div>` : `<p class="note">${t('alone')}</p>`}</div>`;
  }
  return html;
}
function sheetHarem() {
  const L = game.life;
  let html = head(`👑 ${t('harem')}`, '#9d174d', 'sheet:people');
  if (!settings.adult25 || L.age < 18) return html + `<p class="note">${t('haremLocked')}</p>`;
  const ms = hMembers(L);
  const acts = haremActions(L, settings).concat(dramaHaremActions(L, settings));
  const btns = acts.length ? `<div class="list">${acts.map(([k, em, lb]) => li(`h:${k}`, em, esc(tx(lb)))).join('')}</div>` : '';
  if (!ms.length) return html + `<p class="note">${t('haremIntro')}</p>` + (btns || `<p class="note">${t('haremNeed')}</p>`);
  const h = L.harem;
  const H = HOUSES[h.house];
  const hd = L.people.find((p) => p.id === h.head);
  html += `<dl class="kv"><dt>🕊️ ${t('harmony')}</dt><dd>${lvl(h.harmony)}</dd><dt>${H.em} ${t('house')}</dt><dd>${esc(tx(H.name))} · ${ms.length}/${H.cap === 99 ? '∞' : H.cap}</dd><dt>💸 ${t('costYear')}</dt><dd class="mono">${money((15 * ms.length * country(L).gdp) / 100)}</dd><dt>👑 ${t('headP')}</dt><dd>${hd ? esc(personName(L, hd)) : '—'}</dd><dt>⚖️ ${t('structure')}</dt><dd>${t(h.structure === 'rank' ? 'sRank' : 'sEqual')}</dd></dl>`;
  html += btns;
  const mood = (v) => (v >= 60 ? '😊' : v >= 30 ? '😐' : '😤');
  const rows = ms.slice().sort((a, b) => hm(a).rank - hm(b).rank || hm(b).favor - hm(a).favor).map((p) => {
    const x = hm(p);
    const tr = x.known || settings.godEnabled ? `${HTRAITS[x.trait].em} ` : '';
    return `<button class="item" data-a="person:${p.id}"><span class="avatar sm">${face(p.gender, p.age, p.role, p.alive)}</span><div class="main"><b>${tr}${esc(personName(L, p))} ${mood(x.mood)}</b><small>${esc(tx(titleOf(p)))} · ${p.age}${p.baby ? ' · 💎' : ''}</small></div><div class="side">${lvl(x.favor, true)}</div></button>`;
  }).join('');
  html += `<div class="section"><h3>💗 ${t('membersT')} · ${t('hfavor')}</h3><div class="list">${rows}</div></div>`;
  const pairs = [];
  for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) pairs.push([ms[i], ms[j], relOf(L, ms[i], ms[j])]);
  const bad = pairs.filter((x) => x[2] <= -25).sort((a, b) => a[2] - b[2]).slice(0, 4);
  const good = pairs.filter((x) => x[2] >= 25).sort((a, b) => b[2] - a[2]).slice(0, 4);
  const couples = pairsOf(L, settings.godEnabled);
  if (couples.length) html += `<div class="section"><h3>💞 ${t('couples')}</h3><div class="list">${couples.map(([a, b, pr]) => `<div class="li"><span class="em">${PAIR_ST[pr.st].em}</span><span class="tx"><b>${esc(personName(L, a))} & ${esc(personName(L, b))}</b><small>${esc(tx(PAIR_ST[pr.st].name))}${pr.room ? ' · 🛏️' : ''}</small></span><span class="side">${lvl(pr.love, true)}</span></div>`).join('')}</div></div>`;
  if (bad.length || good.length) {
    html += `<div class="section"><h3>🕸️ ${t('relations')}</h3><div class="list">${bad.map(([a, b]) => li(`h:reconcile:${a.id},${b.id}`, '⚔️', `${esc(personName(L, a))} – ${esc(personName(L, b))}`, `${t('relJealous')} · ${t('reconcile')}`)).join('')}${good.map(([a, b]) => `<div class="li"><span class="em">💞</span><span class="tx"><b>${esc(personName(L, a))} – ${esc(personName(L, b))}</b><small>${t('relClose')}</small></span></div>`).join('')}</div></div>`;
  }
  return html;
}
function sheetPerson(id) {
  const L = game.life;
  const p = L.people.find((x) => x.id === id);
  if (!p) return head('—');
  const acts = personActions(L, p, settings).map(([k, label]) => li(`pa:${p.id}:${k}`, PA_EM[k] || '•', esc(tx(label)), '', { danger: DANGER_PA.includes(k) })).join('');
  const romantic = ['partner', 'spouse', 'lover'].includes(p.role);
  const status = p.role === 'spouse' ? `${t('married')}${L.marriage && L.marriage.spouseId === p.id && L.marriage.prenup ? ` · ${t('prenupYes')}` : ''}` : p.engaged ? t('engaged') : p.cohab ? t('cohab') : '';
  return `${head(esc(personName(L, p)), 'var(--b-people)', 'sheet:people')}
    <div class="profile"><span class="avatar lg">${face(p.gender, p.age, p.role, p.alive, p.species)}</span><div class="tx"><b>${esc(personName(L, p))}</b><small class="muted">${roleName(L, p)} · ${t(p.gender)} · ${p.age}${p.alive ? '' : ' †'}</small>${status ? `<span class="tag">${status}</span>` : ''}</div></div>
    <dl class="kv"><dt>🤝 ${t('closeness')}</dt><dd>${lvl(p.closeness)}</dd><dt>✨ ${t('looks')}</dt><dd>${lvl(p.looks)}</dd><dt>🧠 ${t('smarts')}</dt><dd>${lvl(p.smarts)}</dd>
    ${p.age >= 18 ? `<dt>💼 ${t('job')}</dt><dd>${p.job ? esc(tx(p.job)) : t('unemployed')}</dd>${p.income ? `<dt>💵 ${t('salary')}</dt><dd class="mono">${money(p.income)}</dd>` : ''}${p.wealth ? `<dt>💰 ${t('netWorth')}</dt><dd class="mono">${money(p.wealth)}</dd>` : ''}` : ''}
    ${romantic ? `<dt>⏳ ${t('together')}</dt><dd>${p.years || 0} ${t('years')}</dd>` : ''}
    ${p.alive && p.role !== 'pet' && (settings.godEnabled || p.attKnown) ? `<dt>💭 ${t('attitude')}</dt><dd>${ATT[attOf(p)].em} ${esc(tx(ATT[attOf(p)].name))}</dd>` : ''}
    ${p.alive && p.role !== 'pet' && settings.godEnabled ? `<dt>🪨 ${t('firm')}</dt><dd>${lvl(firmOf(p))}</dd>` : ''}
    ${p.alive && p.age >= 18 && p.role !== 'pet' && (p.orientKnown || settings.godEnabled) ? `<dt>🧭 ${t('orient')}</dt><dd>${ORIENT[orientOf(L, p)].em} ${esc(tx(ORIENT[orientOf(L, p)].name))}</dd>` : ''}</dl>
    ${personExtraKv(L, p)}
    ${intimateKv(L, p)}
    ${knownKv(L, p)}
    ${acts ? `<div class="list">${acts}</div>` : ''}
    ${settings.godEnabled && p.alive ? `<div class="list">${li(`godp:${p.id}`, '⚡', t('godPerson'), t('godPersonSub'))}</div>` : ''}`;
}
function intimateKv(L, p) {
  if (!settings.adult25 || p.age < 18 || !settings.godEnabled || !p.alive) return '';
  return `<dl class="kv"><dt>💞 ${t('poly')}</dt><dd>${lvl(p.poly ?? 30)}</dd><dt>🔥 ${t('skill')}</dt><dd>${lvl(p.skill ?? 50)}</dd><dt>🌱 ${t('fert')}</dt><dd>${lvl(p.fert ?? 70)}</dd>${p.gender === 'male' ? `<dt>📏 ${t('size')}</dt><dd>${lvl(p.size ?? 50)}</dd>` : ''}<dt>🔒 ${t('fidelity')}</dt><dd>${lvl(p.fidelity ?? 60)}</dd><dt>😤 ${t('jealous')}</dt><dd>${lvl(p.crazy ?? 50)}</dd></dl>`;
}
function knownKv(L, p) {
  if (!settings.adult25 || !p.ix || p.age < 18 || L.age < 18 || !ROM_ROLES.includes(p.role)) return '';
  const x = p.ix;
  const nmK = (ids) => ids.map((k) => esc(tx(kinkById[k].name))).join(', ');
  const rows = [];
  if (x.known.length) rows.push(`<dt>♥ ${t('likes')}</dt><dd>${nmK(x.known)}</dd>`);
  if (x.knownLim.length) rows.push(`<dt>⛔ ${t('limits')}</dt><dd>${nmK(x.knownLim)}</dd>`);
  if (x.fav != null) rows.push(`<dt>⭐ ${t('favPos')}</dt><dd>${esc(tx(POSITIONS[x.fav]))}</dd>`);
  if (p.baby) {
    rows.push(`<dt>💎 ${t('allowance')}</dt><dd class="mono">${money(p.allow || 0)}</dd>`);
    if (p.term != null && p.term < 50) rows.push(`<dt>⏳ ${t('term')}</dt><dd>${p.term}</dd>`);
    if (p.sinKnown || settings.godEnabled) rows.push(`<dt>💖 ${t('sincere')}</dt><dd>${lvl(x.sincere)}</dd>`);
  }
  if (x.dyn && DYN[x.dyn]) rows.push(`<dt>🎚️ ${t('dyn')}</dt><dd>${DYN[x.dyn].em} ${esc(tx(DYN[x.dyn].name))}</dd>`);
  if (inHarem(L, p)) {
    const h = hm(p);
    rows.push(`<dt>👑 ${t('hRank')}</dt><dd>${esc(tx(titleOf(p)))}</dd><dt>💗 ${t('hfavor')}</dt><dd>${lvl(h.favor)}</dd><dt>🙂 ${t('hmood')}</dt><dd>${lvl(h.mood)}</dd>`);
    if (h.known || settings.godEnabled) rows.push(`<dt>🧬 ${t('hTrait')}</dt><dd>${HTRAITS[h.trait].em} ${esc(tx(HTRAITS[h.trait].name))}</dd>`);
  }
  return rows.length ? `<dl class="kv">${rows.join('')}</dl>` : '';
}
function sheetGodPerson(id) {
  const L = game.life;
  const p = L.people.find((x) => x.id === id);
  if (!p) return head('—');
  const g = ui.godp || {};
  const sl = (k, em) => `<div class="slider"><span>${em}</span><label for="gp-${k}">${t(k === 'crazy' ? 'jealous' : k === 'closeness' ? 'closeness' : k === 'jeal' ? 'jealNet' : k)}</label><input id="gp-${k}" type="range" min="0" max="100" value="${g[k] ?? 50}" data-gp="${k}"><output class="mono">${g[k] ?? 50}</output></div>`;
  const adult = p.age >= 18 && settings.adult25;
  const attSel = `<div class="field"><label for="gp-att">💭 ${t('attitude')}</label><select id="gp-att" data-gps="att">${attOptions(L, p).map((k) => `<option value="${k}" ${g.att === k ? 'selected' : ''}>${ATT[k].em} ${esc(tx(ATT[k].name))}</option>`).join('')}</select></div>`;
  const chk = (k, label) => `<label class="toggle" for="gpc-${k}"><span><b>${label}</b></span><input id="gpc-${k}" type="checkbox" data-gpc="${k}" ${g[k] ? 'checked' : ''}></label>`;
  const kinkRows = adult ? KINK_GROUPS.map(([gid, em, gl]) => `<div class="kgrp"><b>${em} ${esc(tx(gl))}</b>${KINKS.filter((k) => k.grp === gid).map((k) => `<div class="krow"><span>${esc(tx(k.name))}</span><select data-gpk="${k.id}" aria-label="${esc(tx(k.name))}"><option value="" ${!g.kinks[k.id] ? 'selected' : ''}>—</option><option value="want" ${g.kinks[k.id] === 'want' ? 'selected' : ''}>♥ ${t('kWant')}</option><option value="never" ${g.kinks[k.id] === 'never' ? 'selected' : ''}>⛔ ${t('kNever')}</option></select></div>`).join('')}</div>`).join('') : '';
  const favSel = adult ? `<div class="field"><label for="gp-fav">⭐ ${t('favPos')}</label><select id="gp-fav" data-gps="fav"><option value="">—</option>${POSITIONS.map((q, i) => `<option value="${i}" ${String(g.fav) === String(i) ? 'selected' : ''}>${esc(tx(POS_LEVELS[posLevel(i)]))} · ${esc(tx(q))}</option>`).join('')}</select></div>` : '';
  return `${head(`⚡ ${esc(personName(L, p))}`, '#a16207', `person:${p.id}`)}
    <p class="note">${t('godPersonNote')}</p>
    <div class="box">${sl('closeness', '🤝')}${sl('looks', '✨')}${sl('smarts', '🧠')}</div>
    <div class="section"><h3>💭 ${t('attitudeTitle')}</h3><div class="box">${attSel}${p.age >= 18 ? `<div class="field"><label for="gps-orient">🧭 ${t('orient')}</label><select id="gps-orient" data-gps="orient">${Object.entries(ORIENT).map(([k, o]) => `<option value="${k}" ${g.orient === k ? 'selected' : ''}>${o.em} ${esc(tx(o.name))}</option>`).join('')}</select></div>` : ''}${sl('firm', '🪨')}<p class="note" style="margin:0">${t('firmNote')}</p></div></div>
    ${adult ? `<div class="section"><h3>🔞 ${t('intimateStats')}</h3><div class="box">${sl('poly', '💞')}${sl('skill', '🔥')}${sl('fert', '🌱')}${p.gender === 'male' ? sl('size', '📏') : ''}${sl('fidelity', '🔒')}${sl('crazy', '😤')}${sl('chem', '🧪')}${sl('fire', '🔥')}${sl('libido', '💓')}${sl('flex', '🤸')}${p.role === 'lover' ? sl('jeal', '👀') : ''}${p.baby ? sl('sincere', '💎') : ''}${p.role === 'lover' ? chk('knows', t('knowsOthers')) : ''}${favSel}</div></div>
    <div class="section"><details class="box"><summary><b>🗝️ ${t('kinksTitle')}</b></summary>${kinkRows}${chk('reveal', t('revealAll'))}</details></div>
    ${godExtra(L, p, g, sl, chk)}` : ''}
    ${godPersonPower(L, p, g, sl, chk)}
    <button class="btn primary" data-a="godp-apply:${p.id}">${t('godApply')}</button>`;
}
function godExtra(L, p, g, sl, chk) {
  const sel = (k, label, opts) => `<div class="field"><label for="gps-${k}">${label}</label><select id="gps-${k}" data-gps="${k}">${opts.map(([v, lb]) => `<option value="${v}" ${String(g[k] ?? '') === String(v) ? 'selected' : ''}>${esc(lb)}</option>`).join('')}</select></div>`;
  let html = `<div class="section"><h3>🎚️ ${t('dyn')}</h3><div class="box">${sel('dyn', t('dyn'), [['', '—'], ...Object.entries(DYN).map(([k, d]) => [k, `${d.em} ${tx(d.name)}`])])}</div></div>`;
  if (inHarem(L, p)) {
    const others = hMembers(L).filter((q) => q !== p);
    html += `<div class="section"><h3>👑 ${t('harem')}</h3><div class="box">
      ${sel('htrait', t('hTrait'), Object.entries(HTRAITS).map(([k, d]) => [k, `${d.em} ${tx(d.name)}`]))}
      ${sel('hrank', t('hRank'), [0, 1, 2, 3].map((r) => [r, tx(titleOf({ ...p, hm: { ...p.hm, rank: r } }))]))}
      ${sl('hfavor', '💗')}${sl('hmood', '🙂')}${chk('hknown', t('hknown'))}
      ${others.map((q) => `<div class="slider"><span>🤝</span><label for="gpr-${q.id}">${esc(personName(L, q))}</label><input id="gpr-${q.id}" type="range" min="0" max="100" value="${g.hrel[q.id] ?? 50}" data-gpr="${q.id}"><output class="mono">${g.hrel[q.id] ?? 50}</output></div>`).join('')}
      ${others.length ? `<p class="note" style="margin:0">${t('hRelNote')}</p>` : ''}
      ${others.length ? `${sel('pairWith', t('pairWith'), [['', '—'], ...others.map((q) => [q.id, personName(L, q)])])}${sel('pairSt', t('pairSt'), Object.entries(PAIR_ST).map(([k, d]) => [k, `${d.em} ${tx(d.name)}`]))}${chk('pairClear', t('pairClear'))}` : ''}
      ${chk('leaveHarem', t('leaveHarem'))}</div></div>`;
  } else if (adultOK(L, p)) html += `<div class="section"><div class="box">${chk('joinHarem', t('joinHarem'))}</div></div>`;
  if (p.baby) html += `<div class="section"><h3>💎 ${t('sugarGroup')}</h3><div class="box">
      <div class="field"><label for="gpn-allowPct">${t('allowPct')}</label><input id="gpn-allowPct" type="number" min="0" step="1" value="${g.allowPct}" data-gpn="allowPct"></div>
      <div class="slider"><span>⏳</span><label for="gp-term">${t('term')}</label><input id="gp-term" type="range" min="1" max="10" value="${g.term}" data-gp="term"><output class="mono">${g.term}</output></div>
      ${chk('sinKnown', t('sinKnown'))}</div></div>`;
  return html;
}
const ACT_GROUPS = ['prison', 'kid', 'teen', 'mind', 'hobby', 'fun', 'shop', 'life', 'pet', 'net', 'night', 'love', 'adult', 'money', 'crime'];
function sheetActs() {
  const L = game.life;
  const acts = availableActivities(L, settings);
  const groups = ACT_GROUPS.filter((g) => acts.some((a) => a.group === g));
  const g = groups.includes(ui.sub) ? ui.sub : groups.length === 1 ? groups[0] : null;
  if (!g) {
    let html = head(`⭐ ${t('tabActs')}`, 'var(--b-acts)');
    html += `<div class="list">${groups.map((x) => {
      const list = acts.filter((a) => a.group === x);
      const sub = x === 'net' ? `${followersText(L.social?.followers)} ${t('followers')}` : list.slice(0, 3).map((a) => tx(a.label)).join(', ') + (list.length > 3 ? '…' : '');
      return li(`sub:${x}`, GROUP_EM[x], t('actGroups.' + x), esc(sub));
    }).join('')}</div>`;
    return html;
  }
  let html = head(`${GROUP_EM[g]} ${t('actGroups.' + g)}`, 'var(--b-acts)', groups.length > 1 ? 'sub:' : null);
  if (L.prison) html += `<p class="note">${t('prisonNote')}</p>`;
  if (g === 'net') html += `<div class="profile"><span class="avatar">📱</span><div class="tx"><b>${followersText(L.social?.followers)} ${t('followers')}</b><small class="muted">${t('netHelp')}</small></div></div>`;
  html += `<div class="list">${acts.filter((a) => a.group === g).map((a) => li(`act:${a.id}`, ACT_EM[a.id] || GROUP_EM[g], esc(tx(a.label)), a.hobby ? `${t('lvShort')} ${L.hob?.[a.hobby]?.lv || 0}/10${L.hob?.[a.hobby] ? ` · ${L.hob[a.hobby].xp} XP` : ''}` : a.units ? `${t('cost')}: ${money(a.units * country(L).gdp / 100)}` : '')).join('')}</div>`;
  return html;
}
function sheetSelf() {
  const L = game.life;
  const c = country(L);
  const showHidden = settings.godEnabled;
  const row = (k) => `<div class="stat"><span class="em">${STAT_EM[k]}</span><span class="nm">${t(k)}</span>${lvl(L.stats[k])}</div>`;
  return `${head(`${face(L.gender, L.age)} ${t('tabSelf')}`, '#475569')}
    <div class="profile"><span class="avatar lg">${face(L.gender, L.age)}<span class="fl">${c.flag}</span></span><div class="tx"><b>${esc(fullName(L))}</b><small class="muted">${t('yearsOld', { n: L.age })} · ${t(L.gender)} · ${esc(tx(c.name))}</small></div></div>
    ${goalsBlock(L)}
    ${meLinks(L)}
    <div class="box">${STAT_KEYS.map(row).join('')}</div>
    <div class="section"><h3>${t('hidden')}</h3>${showHidden ? `<div class="box">${HIDDEN_KEYS.map(row).join('')}</div>` : `<p class="note">${t('hiddenNote')}</p>`}</div>
    <dl class="kv">
      <dt>🌍 ${t('country')}</dt><dd>${c.flag} ${esc(tx(c.name))}</dd>
      <dt>⏳ ${t('lifeExp')}</dt><dd class="mono">${c.life}</dd>
      <dt>📊 ${t('incomeTier')}</dt><dd>${t('tiers.' + tierOf(c))}</dd>
      <dt>💰 ${t('wealth')}</dt><dd>${t(L.wealth)}</dd>
      <dt>💘 ${t('orientation')}</dt><dd>${t(L.orientation)}</dd>
      <dt>🧬 ${t('traits')}</dt><dd>${L.traits.length ? L.traits.map((k) => esc(tx(TRAITS[k].name))).join(', ') : t('traitsNone')}</dd>
      ${L.pregnancy && L.pregnancy.carrier === 'self' ? `<dt>🤰 ${t('pregnant')}</dt><dd>✓</dd>` : ''}
      ${L.ill ? `<dt>🤒 ${t('ill')}</dt><dd>${esc(tx(L.ill.name))}</dd>` : ''}
      ${L.record ? `<dt>📁 ${t('record')}</dt><dd>✓</dd>` : ''}
    </dl>
    ${meBlock(L)}
    ${privateBlock(L)}
    ${newsBlock(L)}
    <div class="list">${li('sheet:collection', '📚', t('collection'), t('collectionSub'))}</div>
    ${L.age >= 18 && !L.prison ? emigrateBlock(L) : ''}
    ${cobornBlock(L)}`;
}
function newsBlock(L) {
  if (!L.news || !L.news.length) return '';
  const rows = L.news.slice(-6).reverse().map((n) => `<details class="box news"><summary><b>📰 ${t('ageHead', { n: n.age })} · ${esc(tx(n.head))}</b></summary>${n.items.map((x) => `<p class="note" style="margin:6px 0 0">• ${esc(tx(x))}</p>`).join('')}${n.rumor ? `<p class="note" style="margin:6px 0 0">🗣️ ${esc(tx(n.rumor))}</p>` : ''}</details>`).join('');
  return `<div class="section"><h3>📰 ${t('newspaper')}</h3>${rows}</div>`;
}
function privateBlock(L) {
  if (!settings.adult25 || L.age < 18 || !L.ix) return '';
  const m = L.ix;
  const chest = m.chest.length ? m.chest.map((k) => `<span title="${esc(tx(CHEST[k].name))}">${CHEST[k].em}</span>`).join(' ') : t('none');
  return `<div class="section"><h3>🔞 ${t('privateLife')}</h3><dl class="kv">
    <dt>📕 ${t('positions')}</dt><dd class="mono">${m.pos.length}/36</dd>
    <dt>🗝️ ${t('tried')}</dt><dd class="mono">${m.tried.length}/${KINKS.length}</dd>
    <dt>🧰 ${t('chest')}</dt><dd>${chest}</dd>
    <dt>💓 ${t('libido')}</dt><dd>${lvl(m.libido)}</dd>
    <dt>🤸 ${t('flex')}</dt><dd>${lvl(m.flex)}</dd>
    <dt>🌹 ${t('charm')}</dt><dd>${lvl(m.charm)}</dd>
    <dt>💍 ${t('loyal')}</dt><dd>${lvl(m.loyal)}</dd>
    <dt>📰 ${t('scandal')}</dt><dd>${lvl(m.scandal)}</dd>
    ${(m.lc || []).length ? `<dt>🌍 ${t('loverMap')}</dt><dd>${m.lc.map((c) => byCode[c]?.flag || '').join(' ')} (${m.lc.length})</dd>` : ''}
    ${m.portrait ? `<dt>🖼️ ${t('portrait')}</dt><dd>${t(m.portrait === 'harem' ? 'portraitHarem' : 'portraitSelf')}</dd>` : ''}
    ${m.club ? `<dt>🎭 ${t('clubCard')}</dt><dd>✓</dd>` : ''}
  </dl></div>`;
}
function emigrateBlock(L) {
  const sel = ui.emig && ui.emig !== L.country ? ui.emig : COUNTRIES.find((c) => c.code !== L.country).code;
  ui.emig = sel;
  const opts = [...COUNTRIES].filter((c) => c.code !== L.country).sort((a, b) => tx(a.name).localeCompare(tx(b.name))).map((c) => `<option value="${c.code}" ${c.code === sel ? 'selected' : ''}>${c.flag} ${esc(tx(c.name))}</option>`).join('');
  return `<div class="section"><h3>✈️ ${t('emigrate')}</h3><div class="box">
    <div class="field"><label for="emig">${t('emigrateTo')}</label><select id="emig" data-emig="1">${opts}</select></div>
    <dl class="kv" style="box-shadow:none;padding:0"><dt>${t('odds')}</dt><dd class="mono">${Math.round(emigrationOdds(L, sel) * 100)}%</dd><dt>${t('feeLbl')}</dt><dd class="mono">${money(emigrationCost(sel))}</dd><dt>${t('lifeExp')}</dt><dd class="mono">${byCode[sel].life}</dd><dt>${t('incomeTier')}</dt><dd>${t('tiers.' + tierOf(byCode[sel]))}</dd></dl>
    <button class="btn primary" data-a="emigrate">✈️ ${t('emigrate')}</button></div></div>`;
}
function cobornBlock(L) {
  if (!L.coborns || !L.coborns.length) return '';
  return `<div class="section"><h3>👥 ${t('coborns')}</h3><div class="list">${L.coborns.map((cb) => {
    const c = byCode[cb.country];
    const last = cb.notes.length ? tx(cb.notes[cb.notes.length - 1]) : '';
    return `<div class="item ${cb.alive ? '' : 'dead'}"><span class="avatar sm">${face(cb.gender, cb.age, null, cb.alive)}<span class="fl" style="font-size:14px">${c.flag}</span></span><div class="main"><b>${esc(cobornName(cb))}</b><small>${esc(tx(c.name))} · ${cb.alive ? `${cb.age} · ${t('cbAlive')}` : t('cbDead')}${last ? ` · ${esc(last)}` : ''}</small></div><div class="side">${cb.kids ? `${cb.kids} ${t('kids').toLowerCase()}` : ''}</div></div>`;
  }).join('')}</div></div>`;
}

function sheetAssets() {
  const L = game.life;
  const e = L.econ;
  const gdp = country(L).gdp;
  const ph = PHASES[e.phase];
  const PH_EM = { growth: '📈', peak: '⛰️', recession: '📉', crisis: '🔥' };
  const top = (back) => head(`🏠 ${t('tabAssets')}`, 'var(--b-assets)', back);
  const summary = `<dl class="kv"><dt>💵 ${t('cash')}</dt><dd class="mono">${money(L.money)}</dd><dt>💰 ${t('netWorth2')}</dt><dd class="mono">${money(netWorth(L))}</dd><dt>${PH_EM[e.phase] || '🌍'} ${t('economy')}</dt><dd style="color:${e.phase === 'growth' ? 'var(--good)' : e.phase === 'crisis' || e.phase === 'recession' ? 'var(--bad)' : 'var(--gold)'}">${esc(tx(ph.name))}</dd></dl>`;
  if (L.age < 18) return top() + summary + `<p class="note">${t('minorAssets')}</p>`;
  const loansLeft = (L.loans || []).reduce((s, x) => s + x.left, 0);
  const finBox = loansLeft > 0 || L.insurance?.health || L.insurance?.life ? `<dl class="kv">${loansLeft > 0 ? `<dt>🏦 ${t('loanLeft')}</dt><dd class="mono" style="color:var(--bad)">${money(loansLeft)}</dd>` : ''}${L.insurance?.health ? `<dt>🛡️</dt><dd>${t('insHealth')}</dd>` : ''}${L.insurance?.life ? `<dt>🛡️</dt><dd>${t('insLife')}</dd>` : ''}</dl>` : '';
  const sub = ['inv', 'homes', 'cars', 'biz'].includes(ui.sub) ? ui.sub : null;
  const item = (em, title, small, btns) => `<div class="item stack"><span class="em" style="width:40px;height:40px;border-radius:12px;background:var(--soft);display:grid;place-items:center;font-size:22px;flex:none">${em}</span><div class="main"><b>${title}</b><small>${small}</small></div><div class="row" style="flex-wrap:nowrap">${btns}</div></div>`;
  if (!sub) {
    const invTotal = Object.keys(ASSETS).reduce((s, k) => s + holdingValue(L, k), 0);
    const b = L.biz;
    return top() + summary + finBox + `<div class="list">
      ${li('sub:inv', '📈', t('invest'), invTotal > 0 ? t('holdTotal', { v: money(invTotal) }) : t('noneYet'))}
      ${li('sub:homes', '🏠', t('homes'), L.homes.length ? t('owned', { n: L.homes.length }) : t('noneYet'))}
      ${li('sub:cars', '🚗', t('cars'), L.cars.length ? t('owned', { n: L.cars.length }) : t('noneYet'))}
      ${li('sub:biz', '🏢', t('business'), b ? `${esc(tx(INDUSTRIES.find((x) => x.id === b.ind).name))} · ${money(b.value)}` : t('noneYet'))}
    </div>`;
  }
  let html = head(`${{ inv: '📈', homes: '🏠', cars: '🚗', biz: '🏢' }[sub]} ${t({ inv: 'invest', homes: 'homes', cars: 'cars', biz: 'business' }[sub])}`, 'var(--b-assets)', 'sub:') + `<dl class="kv"><dt>💵 ${t('cash')}</dt><dd class="mono">${money(L.money)}</dd></dl>`;
  if (sub === 'inv') {
    html += `<div class="list">${Object.entries(ASSETS).map(([k, a]) => {
      const v = holdingValue(L, k);
      const sub2 = k === 'savings' ? t('rate', { r: Math.round(savingsRate(L) * 100) }) : `${esc(tx(a.risk))} · ${Math.round(e.prices[k])}`;
      return item(ASSET_EM[k] || '📈', esc(tx(a.name)), `${sub2}${v > 0 ? ` · ${t('holding')} <span class="mono">${money(v)}</span>` : ''}`, `<button class="btn small" data-a="inv:${k}:0.1">${t('buy10')}</button><button class="btn small" data-a="inv:${k}:0.5">${t('buy50')}</button>${v > 0 ? `<button class="btn small danger" data-a="div:${k}">${t('sellAll')}</button>` : ''}`);
    }).join('')}</div>`;
  } else if (sub === 'homes') {
    const owned = L.homes.map((h, i) => {
      const d = HOMES.find((x) => x.id === h.id);
      return item(HOME_EM[h.id] || '🏠', `${esc(tx(d.name))} ✓`, `<span class="mono">${money(h.value)}</span>${h.debt > 0 ? ` · ${t('debt')} <span class="mono">${money(h.debt)}</span>` : ''} · ${h.rented ? t('rented') : t('living')}`, `<button class="btn small" data-a="home-rent:${i}">${h.rented ? t('moveIn') : t('rentOut')}</button><button class="btn small danger" data-a="home-sell:${i}">${t('sell')}</button>`);
    }).join('');
    const market = HOMES.map((h) => item(HOME_EM[h.id] || '🏠', esc(tx(h.name)), `<span class="mono">${money(homePrice(L, h))}</span>`, `<button class="btn small" data-a="home-buy:${h.id}:0">${t('buyCash')}</button><button class="btn small" data-a="home-buy:${h.id}:1">${t('buyLoan')}</button>`)).join('');
    if (owned) html += `<div class="list">${owned}</div>`;
    html += `<div class="list">${market}</div>`;
  } else if (sub === 'cars') {
    const owned = L.cars.map((c, i) => item(CAR_EM[c.id] || '🚗', `${esc(tx(CARS.find((x) => x.id === c.id).name))} ✓`, `<span class="mono">${money(c.value)}</span>`, `<button class="btn small danger" data-a="car-sell:${i}">${t('sell')}</button>`)).join('');
    if (owned) html += `<div class="list">${owned}</div>`;
    html += `<div class="list">${CARS.map((c) => item(CAR_EM[c.id] || '🚗', esc(tx(c.name)), `<span class="mono">${money(c.x * gdp)}</span>`, `<button class="btn small" data-a="car-buy:${c.id}">${t('buyCash')}</button>`)).join('')}</div>`;
  } else if (L.biz) {
    const b = L.biz;
    const ind = INDUSTRIES.find((x) => x.id === b.ind);
    html += `<div class="profile"><span class="avatar">${IND_EM[b.ind] || '🏢'}</span><div class="tx"><b>${esc(tx(ind.name))}</b>${b.evade ? `<small style="color:var(--bad)">${t('evading')}</small>` : ''}</div></div>
      <dl class="kv"><dt>🏷️ ${t('bizValue')}</dt><dd class="mono">${money(b.value)}</dd><dt>📊 ${t('lastProfit')}</dt><dd class="mono" style="color:${b.lastProfit >= 0 ? 'var(--good)' : 'var(--bad)'}">${money(b.lastProfit)}</dd></dl>
      <div class="list">${li('biz:invest', '💸', t('bizInvest'))}${li('biz:marketing', '📣', t('marketing'))}${li('biz:evade', '🧾', b.evade ? t('evadeOff') : t('evadeOn'))}${li('biz:sell', '🤝', t('bizSell'))}${li('biz:close', '🔒', t('bizClose'), '', { danger: true })}</div>`;
  } else {
    html += `<div class="list">${INDUSTRIES.map((ind) => li(`biz-start:${ind.id}`, IND_EM[ind.id] || '🏢', esc(tx(ind.name)), `${t('capital')}: <span class="mono">${money(bizCapital(L, ind))}</span>`)).join('')}</div>`;
  }
  return html;
}
function sheetGod() {
  const L = game.life;
  if (!settings.godEnabled) return head(`⚡ ${t('god')}`, '#a16207') + `<p class="note">${t('godOff')}</p>`;
  const g = ui.god;
  const c = country(L);
  const slider = (k) => `<div class="slider"><span>${STAT_EM[k]}</span><label for="g-${k}">${t(k)}</label><input id="g-${k}" type="range" min="0" max="100" value="${g.stats[k]}" data-g="${k}"><output class="mono">${g.stats[k]}</output></div>`;
  const countries = [...COUNTRIES].sort((a, b) => tx(a.name).localeCompare(tx(b.name))).map((x) => `<option value="${x.code}" ${x.code === L.country ? 'selected' : ''}>${x.flag} ${esc(tx(x.name))}</option>`).join('');
  return `${head(`⚡ ${t('god')}`, '#a16207')}
    <p class="note">${t('godNote')}</p>
    ${L.dead ? '' : `<div class="box">${STAT_KEYS.map(slider).join('')}</div><div class="section"><h3>${t('hidden')}</h3><div class="box">${HIDDEN_KEYS.map(slider).join('')}</div></div>
    ${settings.adult25 && L.age >= 18 ? `<div class="section"><h3>🔞 ${t('intimateStats')}</h3><div class="box">${['skill', 'fert'].concat(L.gender === 'male' ? ['size'] : []).map((k) => `<div class="slider"><span>${{ skill: '🔥', fert: '🌱', size: '📏' }[k]}</span><label for="gb-${k}">${t(k)}</label><input id="gb-${k}" type="range" min="0" max="100" value="${g.body[k] ?? 50}" data-gb="${k}"><output class="mono">${g.body[k] ?? 50}</output></div>`).join('')}${[['libido', '💓'], ['flex', '🤸'], ['charm', '🌹'], ['loyal', '💍'], ['scandal', '📰']].map(([k, em]) => `<div class="slider"><span>${em}</span><label for="gx-${k}">${t(k)}</label><input id="gx-${k}" type="range" min="0" max="100" value="${g.ix[k]}" data-gx="${k}"><output class="mono">${g.ix[k]}</output></div>`).join('')}</div></div>
    <div class="section"><details class="box"><summary><b>🧰 ${t('chest')}</b></summary><div class="traits">${Object.entries(CHEST).map(([k, it]) => `<label><input type="checkbox" data-gxc="${k}" ${g.ix.chest.includes(k) ? 'checked' : ''}>${it.em} ${esc(tx(it.name))}</label>`).join('')}</div>
      ${[['allPos', t('allPos')], ['club', t('clubCard')], ['rope', t('ropeDone')]].map(([k, lb]) => `<label class="toggle" for="gxb-${k}"><span><b>${lb}</b></span><input id="gxb-${k}" type="checkbox" data-gxb="${k}" ${g.ix[k] ? 'checked' : ''}></label>`).join('')}</details></div>
    ${godSelfExtra(L, g)}` : ''}
    ${godPowerExtra(L, g)}
    <div class="box"><div class="field"><label for="g-money">💵 ${t('money')} (${c.cur})</label><input id="g-money" type="number" step="1" value="${Math.round(g.money)}" data-gm="1"></div></div>
    <button class="btn primary" data-a="god-apply">${t('godApply')}</button>
    <div class="list">${li('god-cure', '💊', t('cure'))}${li('god-debt', '🧾', t('clearDebt'))}</div>
    <div class="box"><div class="field"><label for="g-country">🌍 ${t('moveCountry')}</label><div class="row" style="flex-wrap:nowrap"><select id="g-country" style="flex:1;min-width:0">${countries}</select><button class="btn small" data-a="god-move">${t('confirm')}</button></div></div></div>`}
    <button class="btn" data-a="rewind" ${L.snapshots.length && L.counts.rewinds < 3 ? '' : 'disabled'}>⏪ ${t('rewind')} · ${t('rewindLeft', { n: 3 - L.counts.rewinds })}</button>`;
}
function godSelfExtra(L, g) {
  const sel = (grp, k, label, opts) => `<div class="field"><label for="g${grp}-${k}">${label}</label><select id="g${grp}-${k}" data-g${grp}s="${k}">${opts.map(([v, lb]) => `<option value="${v}" ${String(g[grp === 'h' ? 'harem' : 'world'][k] ?? '') === String(v) ? 'selected' : ''}>${esc(lb)}</option>`).join('')}</select></div>`;
  const tog = (grp, k, label) => `<label class="toggle" for="g${grp}c-${k}"><span><b>${label}</b></span><input id="g${grp}c-${k}" type="checkbox" data-g${grp}c="${k}" ${g[grp === 'h' ? 'harem' : 'world'][k] ? 'checked' : ''}></label>`;
  const num = (k, label) => `<div class="field"><label for="gwn-${k}">${label}</label><input id="gwn-${k}" type="number" min="0" step="1" value="${g.world[k] ?? 0}" data-gwn="${k}"></div>`;
  let html = '';
  const ms = hMembers(L);
  if (ms.length) html += `<div class="section"><details class="box"><summary><b>👑 ${t('harem')}</b></summary>
    <div class="slider"><span>🕊️</span><label for="gh-harmony">${t('harmony')}</label><input id="gh-harmony" type="range" min="0" max="100" value="${g.harem.harmony}" data-gh="harmony"><output class="mono">${g.harem.harmony}</output></div>
    ${sel('h', 'head', t('headP'), ms.map((p) => [p.id, personName(L, p)]))}
    ${sel('h', 'structure', t('structure'), [['rank', t('sRank')], ['equal', t('sEqual')]])}
    ${sel('h', 'house', t('house'), Object.entries(HOUSES).map(([k, H]) => [k, `${H.em} ${tx(H.name)}`]))}
    ${sel('h', 'protect', t('protectDef'), [['each', t('pEach')], ['always', t('pAlways')], ['never', t('pNever')]])}
    ${tog('h', 'cungdau', t('cungdau'))}</details></div>`;
  html += `<div class="section"><details class="box"><summary><b>🌍 ${t('worldGod')}</b></summary>
    ${tog('w', 'yacht', t('yacht'))}
    ${sel('w', 'room', t('room'), [['', '—'], ...Object.entries(ROOMS).map(([k, r]) => [k, `${r.em} ${tx(r.name)}`])])}
    ${num('followers', t('followersN'))}${num('creatorSubs', t('creatorSubs'))}
    ${L.nclub ? `<div class="slider"><span>🪩</span><label for="gw-clubRep">${t('clubRep')}</label><input id="gw-clubRep" type="range" min="0" max="100" value="${g.world.clubRep}" data-gw="clubRep"><output class="mono">${g.world.clubRep}</output></div>${num('clubStaff', t('clubStaff'))}` : ''}
  </details></div>
  <div class="section"><details class="box"><summary><b>🧭 ${t('dramaGod')}</b></summary>
    <div class="field"><label for="gds-orientation">🧭 ${t('myOrient')}</label><select id="gds-orientation" data-gds="orientation">${[['opposite', t('opposite')], ['same', t('same')], ['both', t('both')]].map(([v, lb]) => `<option value="${v}" ${g.drama.orientation === v ? 'selected' : ''}>${lb}</option>`).join('')}</select></div>
    ${[['pole', t('poleDone')], ...(ms.length ? [['allowPairs', t('allowPairs')], ['nude', t('nudeRule')], ['jacuzzi', t('jacuzziHave')], ['vowed', t('vowedDone')]] : [])].map(([k, lb]) => `<label class="toggle" for="gdc-${k}"><span><b>${lb}</b></span><input id="gdc-${k}" type="checkbox" data-gdc="${k}" ${g.drama[k] ? 'checked' : ''}></label>`).join('')}
    <div class="field"><label for="gds-portrait">🖼️ ${t('portrait')}</label><select id="gds-portrait" data-gds="portrait">${[['', '—'], ['self', t('portraitSelf')], ['harem', t('portraitHarem')]].map(([v, lb]) => `<option value="${v}" ${(g.drama.portrait || '') === v ? 'selected' : ''}>${lb}</option>`).join('')}</select></div>
  </details></div>
  <div class="list">${li('god-unlock', '🔓', t('unlockAll'), t('unlockAllSub'))}${li('sheet:trigger', '🎬', t('triggerTitle'), t('triggerSub'))}</div>`;
  return html;
}
function sheetTrigger() {
  const L = game.life;
  let html = head(`🎬 ${t('triggerTitle')}`, '#a16207', 'sheet:god');
  if (!settings.godEnabled || !L || L.dead) return html + `<p class="note">${t('godOff')}</p>`;
  html += `<p class="note">${t('triggerNote')}</p>`;
  const FATED = [['oneroom', { vi: 'Chỉ còn một phòng', en: 'Only one room left' }], ['elevator', { vi: 'Kẹt thang máy với người cũ', en: 'Stuck in a lift with your ex' }], ['wedding', { vi: 'Đám cưới người cũ', en: "Your ex's wedding" }], ['enemies', { vi: 'Kẻ thù thành người tình', en: 'Enemies to lovers' }], ['reunion', { vi: 'Họp lớp 20 năm', en: '20-year reunion' }]];
  html += `<div class="section"><h3>✨ ${t('fatedNights')}</h3><div class="list">${FATED.map(([k, lb]) => li(`trig:fated:${k}`, '🌙', esc(tx(lb)))).join('')}</div></div>`;
  html += `<div class="section"><h3>🎭 ${t('scenarios')}</h3><div class="list">${SCENARIOS.map((sc) => { const seen = (settings.seen || []).includes(`sc/${sc.id}/1`); return li(`trig:${sc.id}`, seen ? '✅' : '🎬', esc(tx(sc.title)), `${t('needs')}: ${esc(tx(sc.req))}`); }).join('')}</div></div>`;
  return html;
}
function sheetCollection() {
  const seen = new Set(settings.seen || []);
  let html = head(`📚 ${t('collection')}`, '#475569', game.life ? 'sheet:self' : null);
  const rows = game.packs.filter((p) => settings.packs[p.manifest.id] !== false).map((p) => { const n = p.events.filter((e) => seen.has(e.uid)).length; return `<div class="li"><span class="em">📦</span><span class="tx"><b>${esc(tx(p.manifest.name))}</b><small>${n}/${p.events.length} · ${p.manifest.rating}</small></span><span class="side">${lvl((n / Math.max(1, p.events.length)) * 100, true)}</span></div>`; }).join('');
  const sn = SCENARIOS.filter((sc) => seen.has(`sc/${sc.id}/1`)).length;
  html += `<div class="list"><div class="li"><span class="em">🎭</span><span class="tx"><b>${t('scenarios')}</b><small>${sn}/${SCENARIOS.length}</small></span><span class="side">${lvl((sn / SCENARIOS.length) * 100, true)}</span></div>${rows}</div>`;
  html += `<div class="section"><h3>🎭 ${t('scenarios')}</h3><div class="list">${SCENARIOS.map((sc) => `<div class="li"><span class="em">${seen.has(`sc/${sc.id}/1`) ? '✅' : '❔'}</span><span class="tx"><b>${seen.has(`sc/${sc.id}/1`) ? esc(tx(sc.title)) : '???'}</b></span></div>`).join('')}</div></div>`;
  return html;
}
function sheetSettings() {
  const tog = (k, title, sub) => `<label class="toggle" for="set-${k}"><span><b>${title}</b><small>${sub}</small></span><input id="set-${k}" type="checkbox" data-set="${k}" ${settings[k] ? 'checked' : ''}></label>`;
  const packs = game.packs.map((p) => `<div class="item"><div class="main"><b>${esc(tx(p.manifest.name))}</b><small>${p.events.length} ${t('events')} · ${p.manifest.rating} · ${p.builtin ? t('builtin') : p.remote ? `GitHub · ${esc(p.remote)}` : t('custom')}</small></div>${p.builtin || p.remote ? '' : `<button class="btn small danger" data-a="pack-del:${esc(p.manifest.id)}">${t('removePack')}</button>`}<input type="checkbox" aria-label="${esc(tx(p.manifest.name))}" data-pack="${esc(p.manifest.id)}" ${settings.packs[p.manifest.id] !== false ? 'checked' : ''} style="width:22px;height:22px;accent-color:var(--b-age-d)"></div>`).join('');
  const m = ui.packMsg;
  return `${head(`⚙️ ${t('settings')}`, '#475569')}
    <div class="toggle"><span><b>🌐 ${t('lang')}</b></span>${langSwitch()}</div>
    ${tog('adult25', `🔞 ${t('adult25')}`, t('adult25Sub'))}
    ${tog('alwaysProtect', `🛡️ ${t('protect')}`, t('protectSub'))}
    ${tog('godEnabled', `⚡ ${t('godToggle')}`, t('godToggleSub'))}
    <div class="box"><div class="field"><label for="setsel-eventFreq">🎲 ${t('eventFreq')}</label><select id="setsel-eventFreq" data-setsel="eventFreq">${[['low', t('freqLow')], ['mid', t('freqMid')], ['high', t('freqHigh')], ['max', t('freqMax')]].map(([v, lb]) => `<option value="${v}" ${(settings.eventFreq || 'mid') === v ? 'selected' : ''}>${lb}</option>`).join('')}</select></div><p class="note" style="margin:0">${t('eventFreqNote')}</p></div>
    <div class="list">${li('sheet:collection', '📚', t('collection'), t('collectionSub'))}</div>
    <div class="section"><h3>📦 ${t('packs')}</h3>${ui.remote ? `<p class="note">🐙 ${t('remotePacks', { n: ui.remote.ok })}</p>${ui.remote.errs.length ? `<p class="err" style="margin:0">${t('remoteErr')}</p><div class="errors">${esc(ui.remote.errs.join('\n'))}</div>` : ''}` : ''}<div class="list">${packs}</div>
      <div class="box"><div class="field"><label for="packfile">${t('loadPack')}</label><input id="packfile" type="file" accept=".json,.txt,application/json"></div>
      ${m ? (m.ok ? `<p style="color:var(--good);font-weight:700;margin:0">${esc(m.ok)}</p>` : `<p class="err" style="margin:0">${t('packErr')}</p><div class="errors">${esc(m.errors.slice(0, 30).join('\n'))}</div>`) : ''}</div>
    </div>
    ${game.life ? `<button class="btn danger" data-a="reset">🗑️ ${ui.resetArmed ? t('resetConfirm') : t('resetSave')}</button>` : ''}`;
}

// ───────── Đợt 4: Bản thân, Quyền lực, Bản đồ quan hệ, Album, Chuỗi, Nhật ký ─────────
function meBlock(L) {
  const tt = topTrait(L);
  const t0 = talentOf(L);
  const rows = [`<dt>${traitEm(tt)} ${t('personality')}</dt><dd>${esc(tx(traitLabel(tt)))}</dd>`];
  if (t0.known || settings.godEnabled) rows.push(`<dt>${TALENTS[t0.id].em} ${t('talent')}</dt><dd>${esc(tx(TALENTS[t0.id].name))}${t0.known ? '' : ` · ${t('hiddenYet')}`}</dd>`);
  if (L.age >= 18) { const ls = LOVESTYLE[loveStyleOf(L)]; rows.push(`<dt>${ls.em} ${t('loveStyle')}</dt><dd>${esc(tx(ls.name))}</dd>`); }
  if (L.prorep != null) rows.push(`<dt>🏅 ${t('prorep')}</dt><dd>${lvl(L.prorep)}</dd>`);
  if (L.age >= 18) { const st = statusOf(L); const au = auraTier(L); rows.push(`<dt>${STATUS[st].em} ${t('socStatus')}</dt><dd>${esc(tx(STATUS[st].name))}</dd><dt>${AURA[au].em} ${t('aura')}</dt><dd>${esc(tx(AURA[au].name))}</dd>`); }
  if (L.legacyIn) rows.push(`<dt>🏯 ${t('legacy')}</dt><dd>${lvl(L.legacyIn)}</dd>`);
  if ((L.visited || []).length) rows.push(`<dt>🧳 ${t('visited')}</dt><dd>${L.visited.map((id) => DESTS.find((d) => d[0] === id)?.[1] || '').join(' ')} (${L.visited.length})</dd>`);
  const hob = Object.entries(L.hob || {}).filter(([, h]) => h.lv > 0);
  if (hob.length) rows.push(`<dt>🎨 ${t('hobbies')}</dt><dd>${hob.map(([id, h]) => `${HOBBIES[id].em}${h.lv}`).join(' ')}</dd>`);
  if (settings.adult25 && (L.ix?.learned || []).length) rows.push(`<dt>🎓 ${t('learned')}</dt><dd>${L.ix.learned.map((k) => LEARN[k]?.em || '').join(' ')}</dd>`);
  const spend = L.age >= 18 ? `<div class="box"><div class="field"><label for="spend">💸 ${t('spendStyle')}</label><select id="spend" data-spend="1">${Object.entries(SPEND).map(([k, s]) => `<option value="${k}" ${(L.spend || 'balanced') === k ? 'selected' : ''}>${s.em} ${esc(tx(s.name))}</option>`).join('')}</select></div></div>` : '';
  const H = L.age >= 12 ? habits(L) : null;
  const hab = H ? `<details class="box"><summary><b>🌿 ${t('lifestyle')}</b></summary>${Object.entries(HABITS).map(([k, h]) => `<div class="stat"><span class="em">${h.em}</span><span class="nm">${esc(tx(h.name))}</span>${lvl(H[k])}</div>`).join('')}<p class="note" style="margin:6px 0 0">${t('lifestyleNote')}</p></details>` : '';
  return `<div class="section"><h3>🧭 ${t('aboutYou')}</h3><dl class="kv">${rows.join('')}</dl>${spend}${hab}</div>`;
}
function meLinks(L) {
  const pwSub = L.age >= 18 ? `${STATUS[statusOf(L)].em} ${tx(STATUS[statusOf(L)].name)}` : '';
  return `<div class="list">${L.age >= 18 ? li('sheet:power', '🏛️', t('powerT'), esc(pwSub)) : ''}${li('sheet:map', '🕸️', t('relMap'), t('relMapSub'))}${li('sheet:album', '📸', t('album'), `${(L.album || []).length} ${t('moments')}`)}${li('sheet:chains', '🧵', t('chains'), t('chainsSub'))}${li('sheet:diary', '📖', t('diary'), t('diarySub'))}</div>`;
}
function sheetPower() {
  const L = game.life;
  let html = head(`🏛️ ${t('powerT')}`, '#7c2d12', 'sheet:self');
  if (L.age < 18) return html + `<p class="note">${t('powerYoung')}</p>`;
  const P = pw(L);
  const st = statusOf(L);
  const au = auraTier(L);
  const S = P.shadow;
  const heir = P.heirId && L.people.find((p) => p.id === P.heirId);
  html += `<dl class="kv"><dt>${STATUS[st].em} ${t('socStatus')}</dt><dd>${esc(tx(STATUS[st].name))} · ${st}/6</dd>
    <dt>${AURA[au].em} ${t('aura')}</dt><dd>${esc(tx(AURA[au].name))} · ${au}/4</dd>
    <dt>🪙 ${t('influence')}</dt><dd>${lvl(P.infl)}</dd>
    ${P.office ? `<dt>🏛️ ${t('office')}</dt><dd>${esc(tx(OFFICES[P.office].name))} · ${t('termLeft', { n: P.term })}</dd><dt>📊 ${t('approval')}</dt><dd>${lvl(P.approval)}</dd>` : P.held ? `<dt>🏛️ ${t('officeHeld')}</dt><dd>${esc(tx(OFFICES[P.held].name))}</dd>` : ''}
    ${P.club ? `<dt>🕯️ ${esc(tx(CLUB_NAME))}</dt><dd>${esc(tx(CLUB_RANKS[P.club.rank]))}</dd>` : ''}
    ${P.press ? `<dt>📰 ${t('press')}</dt><dd>${esc(tx(P.press.name))}</dd>` : ''}
    ${P.clan ? `<dt>🏯 ${t('clan')} ${esc(L.last)}</dt><dd>${lvl(P.clan.prestige)}</dd>` : ''}
    ${heir ? `<dt>👑 ${t('successor')}</dt><dd>${esc(personName(L, heir))}</dd>` : ''}
    ${S && !S.ended ? `<dt>♟️ ${t('shadowPower')}</dt><dd>${lvl(shadowPower(L))}</dd><dt>👁️ ${t('exposure')}</dt><dd>${lvlInv(S.exp)}</dd><dt>🏢 ${t('frontCos')}</dt><dd class="mono">${S.biz}</dd><dt>🌹 ${t('loveNet')}</dt><dd class="mono">${S.love}</dd>` : S && S.ended ? `<dt>♟️ ${t('shadowPower')}</dt><dd>${t('shadowEnded_' + S.ended)}</dd>` : ''}
  </dl>`;
  const acts = powerActions(L);
  if (acts.length) html += `<div class="list">${acts.map(([k, em, lb, sub]) => li(`pw:${k}`, em, esc(tx(lb)), sub ? esc(tx(sub)) : '')).join('')}</div>`;
  const rich = [P.rich.jet && `${RICH.jet.em} ${tx(RICH.jet.name)}`, P.rich.island && `${RICH.island.em} ${tx(RICH.island.name)}`, P.rich.art.length && `${RICH.art.em} ×${P.rich.art.length}`, ...P.rich.villas.map((v) => `${RICH.villa.em} ${tx(v)}`)].filter(Boolean);
  if (rich.length) html += `<div class="section"><h3>💎 ${t('ultraRich')}</h3><div class="box">${rich.map((x) => `<p class="note" style="margin:2px 0">${esc(x)}</p>`).join('')}</div></div>`;
  html += `<div class="section"><h3>🎭 ${t('masks')}</h3><div class="box">${Object.entries(AUDIENCES).map(([a, lb]) => `<div class="field"><label for="mask-${a}">${esc(tx(lb))}</label><select id="mask-${a}" data-mask="${a}">${Object.entries(MASKS).map(([k, m]) => `<option value="${k}" ${P.masks[a] === k ? 'selected' : ''}>${m.em} ${esc(tx(m.name))}</option>`).join('')}</select></div>`).join('')}<p class="note" style="margin:0">${t('masksNote')}</p></div></div>`;
  const pawns = pawnsOf(L);
  if (S && !S.ended) html += `<div class="section"><h3>♟️ ${t('pawns')} · ${pawns.length}</h3>${pawns.length ? `<div class="list">${pawns.map((p) => `<button class="item" data-a="person:${p.id}"><span class="avatar sm">${face(p.gender, p.age, p.role, p.alive)}</span><div class="main"><b>${PAWN_VIA[p.pawn.via].em} ${esc(personName(L, p))}</b><small>${p.post ? esc(tx(p.post)) + ' · ' : ''}${t('pLoyal')} ${Math.round(p.pawn.loyal)} · ${t('depend')} ${Math.round(p.pawn.dep)}</small></div><div class="side">${lvl(p.pawn.loyal, true)}</div></button>`).join('')}</div>` : `<p class="note">${t('pawnsNone')}</p>`}</div>`;
  return html;
}
function sheetMap() {
  const L = game.life;
  let html = head(`🕸️ ${t('relMap')}`, '#0f766e', 'sheet:self');
  const ppl = L.people.filter((p) => p.alive && !p.cut).sort((a, b) => b.closeness - a.closeness).slice(0, 28);
  if (!ppl.length) return html + `<p class="note">${t('alone')}</p>`;
  const W = 360, C = 180;
  const inner = ppl.filter((p) => ['partner', 'spouse', 'lover', 'mother', 'father', 'sibling', 'half', 'child', 'bestie'].includes(p.role));
  const outer = ppl.filter((p) => !inner.includes(p));
  const pos = {};
  const place = (list, r, off) => list.forEach((p, i) => { const a = off + (i / Math.max(1, list.length)) * Math.PI * 2; pos[p.id] = [C + r * Math.cos(a), C + r * Math.sin(a)]; });
  place(inner, 82, -Math.PI / 2);
  place(outer, 150, -Math.PI / 2 + 0.2);
  const col = (p) => { const a = attOf(p); if (['hate', 'rival'].includes(a)) return 'var(--bad)'; if (ROM_ROLES.includes(p.role)) return '#db2777'; if (['mother', 'father', 'sibling', 'half', 'child', 'pet'].includes(p.role)) return '#2563eb'; if (['friend', 'bestie'].includes(p.role)) return 'var(--good)'; if (p.pawn) return '#a16207'; return '#94a3b8'; };
  let lines = '';
  for (const p of ppl) { const [x, y] = pos[p.id]; lines += `<line x1="${C}" y1="${C}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${col(p)}" stroke-width="${(0.6 + p.closeness / 35).toFixed(1)}" stroke-opacity="0.55"/>`; }
  for (const pr of (L.soc?.pairs || []).filter((x) => x.st !== 'split')) { const a = pos[pr.a]; const b = pos[pr.b]; if (a && b) lines += `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="#7c3aed" stroke-width="1.6" stroke-dasharray="4 3"/>`; }
  for (const [a, b] of pairsOf(L, settings.godEnabled)) { const pa = pos[a.id]; const pb = pos[b.id]; if (pa && pb) lines += `<line x1="${pa[0].toFixed(1)}" y1="${pa[1].toFixed(1)}" x2="${pb[0].toFixed(1)}" y2="${pb[1].toFixed(1)}" stroke="#db2777" stroke-width="1.6" stroke-dasharray="2 3"/>`; }
  for (const f of (L.soc?.feuds || [])) { const a = pos[f.a]; const b = pos[f.b]; if (a && b) lines += `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="var(--bad)" stroke-width="1.4" stroke-dasharray="1 3"/>`; }
  const nodes = ppl.map((p) => { const [x, y] = pos[p.id]; const nm2 = esc(p.first.length > 9 ? p.first.slice(0, 8) + '…' : p.first); return `<g class="mnode" data-a="person:${p.id}" role="button" tabindex="0" aria-label="${esc(personName(L, p))}"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="15" fill="var(--sheet)" stroke="${col(p)}" stroke-width="2.4"/><text x="${x.toFixed(1)}" y="${(y + 5).toFixed(1)}" text-anchor="middle" font-size="14">${face(p.gender, p.age, p.role, true, p.species)}</text><text x="${x.toFixed(1)}" y="${(y + 27).toFixed(1)}" text-anchor="middle" font-size="9" fill="var(--ink)">${nm2}</text></g>`; }).join('');
  html += `<div class="box" style="padding:6px"><svg class="relmap" viewBox="0 0 ${W} ${W}" width="100%" role="img" aria-label="${t('relMap')}">${lines}<circle cx="${C}" cy="${C}" r="20" fill="var(--b-age)" /><text x="${C}" y="${C + 6}" text-anchor="middle" font-size="18">${face(L.gender, L.age)}</text>${nodes}</svg></div>`;
  html += `<div class="box mapkey"><span style="color:#db2777">━ ${t('mkLove')}</span><span style="color:#2563eb">━ ${t('mkFamily')}</span><span style="color:var(--good)">━ ${t('mkFriend')}</span><span style="color:var(--bad)">━ ${t('mkEnemy')}</span><span style="color:#a16207">━ ${t('mkPawn')}</span><span style="color:#7c3aed">┅ ${t('mkNpc')}</span></div><p class="note">${t('mapNote')}</p>`;
  return html;
}
function sheetAlbum() {
  const L = game.life;
  let html = head(`📸 ${t('album')}`, '#be185d', 'sheet:self');
  const al = (L.album || []).slice().reverse();
  if (!al.length) return html + `<p class="note">${t('albumEmpty')}</p>`;
  html += `<div class="list">${al.map((m) => { const p = m.pid && L.people.find((x) => x.id === m.pid); return `<${p ? `button class="li" data-a="person:${p.id}"` : 'div class="li"'}><span class="em">${m.em}</span><span class="tx"><b>${esc(tx(m.text))}</b><small>${t('ageHead', { n: m.age })}${p ? ` · ${esc(personName(L, p))}` : ''}</small></span></${p ? 'button' : 'div'}>`; }).join('')}</div>`;
  return html;
}
function sheetChains() {
  const L = game.life;
  let html = head(`🧵 ${t('chains')}`, '#4338ca', 'sheet:self');
  const cs = chainsOf(L, settings);
  if (!cs.length) return html + `<p class="note">${t('chainsEmpty')}</p>`;
  html += `<div class="list">${cs.map((c) => `<div class="li"><span class="em">${c.em}</span><span class="tx"><b>${esc(tx(c.title))}</b><small>💡 ${esc(tx(c.hint))}</small></span></div>`).join('')}</div>`;
  return html;
}
function diaryHtml(L) { return diaryOf(L).map((d) => `<div class="box diary"><b>${esc(tx(d.h))}</b><p class="note" style="margin:6px 0 0">${esc(tx(d.t))}</p></div>`).join(''); }
function sheetDiary() {
  const L = game.life;
  return head(`📖 ${t('diary')}`, '#78350f', L.dead ? null : 'sheet:self') + diaryHtml(L);
}
function personExtraKv(L, p) {
  const rows = [];
  if (p.alive && p.age >= 6 && p.role !== 'pet') rows.push(`<dt>🗣️ ${t('voice')}</dt><dd>${VOICES[voiceOf(p)].em} ${esc(tx(VOICES[voiceOf(p)].name))}</dd>`);
  const np = npcPartnerOf(L, p);
  if (np && np.p) rows.push(`<dt>💑 ${t('npcPartner')}</dt><dd>${esc(personName(L, np.p))} · ${esc(tx(PAIR_LABEL[np.st]))}</dd>`);
  else if (p.mate) rows.push(`<dt>💑 ${t('npcPartner')}</dt><dd>${esc(p.mate)}</dd>`);
  if (p.abroad) rows.push(`<dt>✈️ ${t('livesAbroad')}</dt><dd>${esc(tx(p.abroad))}</dd>`);
  if (p.pawn) rows.push(`<dt>♟️ ${t('pawnT')}</dt><dd>${PAWN_VIA[p.pawn.via].em} ${esc(tx(PAWN_VIA[p.pawn.via].name))}${p.post ? ` · ${esc(tx(p.post))}` : ''}</dd>${p.pawnKnown || settings.godEnabled ? `<dt>🫱 ${t('pLoyal')}</dt><dd>${lvl(p.pawn.loyal)}</dd><dt>🔗 ${t('depend')}</dt><dd>${lvl(p.pawn.dep)}</dd>` : ''}`);
  if (p.defeated) rows.push(`<dt>♟️ ${t('defeatedBy')}</dt><dd>${esc(tx(DEFEAT[p.defeated]))}</dd>`);
  if (p.role === 'pet' && p.persona && PET_P[p.persona]) rows.push(`<dt>🐾 ${t('petPersona')}</dt><dd>${PET_P[p.persona].em} ${esc(tx(PET_P[p.persona].name))}</dd>`);
  if (p.role === 'child' && p.talent && TALENTS[p.talent]) rows.push(`<dt>🌟 ${t('talent')}</dt><dd>${TALENTS[p.talent].em} ${esc(tx(TALENTS[p.talent].name))}</dd>`);
  if (p.wed) rows.push(`<dt>💍 ${t('marriedInto')}</dt><dd>${esc(tx(p.wed))}</dd>`);
  if (p.inCompany) rows.push(`<dt>🏢 ${t('familyCo')}</dt><dd>✓</dd>`);
  if (p.taughtYou && LEARN[p.taughtYou] && (settings.adult25 || !LEARN[p.taughtYou].adult)) rows.push(`<dt>🎓 ${t('taughtYou')}</dt><dd>${LEARN[p.taughtYou].em} ${esc(tx(LEARN[p.taughtYou].name))}</dd>`);
  if (p.journo) rows.push(`<dt>🕵️</dt><dd>${t('journoTag')}</dd>`);
  return rows.length ? `<dl class="kv">${rows.join('')}</dl>` : '';
}
function godPowerExtra(L, g) {
  const P = g.power, G = g.growth, Pe = g.persona;
  const rng = (attr, obj, k, em, label, min = 0, max = 100) => `<div class="slider"><span>${em}</span><label for="${attr}-${k}">${label}</label><input id="${attr}-${k}" type="range" min="${min}" max="${max}" value="${obj[k]}" data-${attr}="${k}"><output class="mono">${attr === 'gpw' && k === 'maleMax' && obj[k] >= MALE_UNLIMITED ? '∞' : obj[k]}</output></div>`;
  const sel = (attr, obj, k, label, opts) => `<div class="field"><label for="${attr}-${k}">${label}</label><select id="${attr}-${k}" data-${attr}="${k}">${opts.map(([v, lb]) => `<option value="${v}" ${String(obj[k] ?? '') === String(v) ? 'selected' : ''}>${esc(lb)}</option>`).join('')}</select></div>`;
  const tog = (attr, obj, k, label) => `<label class="toggle" for="${attr}-${k}"><span><b>${label}</b></span><input id="${attr}-${k}" type="checkbox" data-${attr}="${k}" ${obj[k] ? 'checked' : ''}></label>`;
  const num = (attr, obj, k, label) => `<div class="field"><label for="${attr}-${k}">${label}</label><input id="${attr}-${k}" type="number" min="0" step="1" value="${obj[k] ?? 0}" data-${attr}="${k}"></div>`;
  const kids = L.people.filter((p) => p.role === 'child' && p.alive);
  let html = `<div class="section"><details class="box"><summary><b>🏛️ ${t('godPower')}</b></summary>
    ${rng('gpw', P, 'infl', '🪙', t('influence'))}
    ${sel('gpws', P, 'statusGod', `${t('socStatus')}`, [['', t('auto')], ...STATUS.map((s, i) => [i, `${s.em} ${tx(s.name)}`])])}
    ${sel('gpws', P, 'aura', `${t('aura')}`, [['', t('auto')], ...AURA.map((s, i) => [i, `${s.em} ${tx(s.name)}`])])}
    ${sel('gpws', P, 'office', t('office'), OFFICES.map((o, i) => [i, tx(o.name)]))}
    ${rng('gpw', P, 'approval', '📊', t('approval'))}
    ${sel('gpws', P, 'press', t('press'), [['', '—'], ['paper', '📰'], ['tv', '📺']])}
    ${sel('gpws', P, 'clubRank', tx(CLUB_NAME), [['', '—'], ...CLUB_RANKS.map((r, i) => [i, tx(r)])])}
    ${tog('gpwc', P, 'jet', `${RICH.jet.em} ${tx(RICH.jet.name)}`)}${tog('gpwc', P, 'island', `${RICH.island.em} ${tx(RICH.island.name)}`)}
    ${tog('gpwc', P, 'clanOn', `🏯 ${t('clan')}`)}${rng('gpw', P, 'clanPrestige', '🏯', t('clanPrestige'))}${tog('gpwc', P, 'company', `🏢 ${t('familyCo')}`)}
    ${kids.length ? sel('gpws', P, 'heirId', t('successor'), [['', '—'], ...kids.map((k) => [k.id, personName(L, k)])]) : ''}
    ${Object.entries(AUDIENCES).map(([a, lb]) => `<div class="field"><label for="gpm-${a}">🎭 ${esc(tx(lb))}</label><select id="gpm-${a}" data-gpm="${a}">${Object.entries(MASKS).map(([k, m]) => `<option value="${k}" ${P.masks[a] === k ? 'selected' : ''}>${m.em} ${esc(tx(m.name))}</option>`).join('')}</select></div>`).join('')}
    ${tog('gpwc', P, 'shadowOn', `♟️ ${t('shadowOn')}`)}${rng('gpw', P, 'exposure', '👁️', t('exposure'))}${num('gpwn', P, 'shadowBiz', `🏢 ${t('frontCos')}`)}${num('gpwn', P, 'shadowLove', `🌹 ${t('loveNet')}`)}${tog('gpwc', P, 'council', `🕯️ ${t('councilNow')}`)}
  </details></div>
  <div class="section"><details class="box"><summary><b>👶 ${t('godFertility')}</b></summary>
    ${tog('gpwc', P, 'heirAll', `👶 ${t('heirAll')}`)}<p class="note" style="margin:0">${t('heirAllNote')}</p>
    ${rng('gpw', P, 'maleMax', '🧔', t('maleMax'), 50, MALE_UNLIMITED)}${tog('gpwc', P, 'noDecline', t('noDecline'))}
    ${rng('gpw', P, 'carrierMax', '🤰', t('carrierMax'), 40, 55)}<p class="note" style="margin:0">${t('fertNote')}</p>
  </details></div>
  <div class="section"><details class="box"><summary><b>🌱 ${t('godGrowth')}</b></summary>
    ${Object.entries(PERS).map(([k, x]) => rng('gpe', Pe, k, x.em, `${tx(x.neg)} ↔ ${tx(x.name)}`)).join('')}
    ${sel('ggs', G, 'talent', t('talent'), Object.entries(TALENTS).map(([k, x]) => [k, `${x.em} ${tx(x.name)}`]))}${tog('ggc', G, 'talentKnown', t('talentKnown'))}
    ${rng('ggr', G, 'prorep', '🏅', t('prorep'))}
    ${sel('ggs', G, 'spend', t('spendStyle'), Object.entries(SPEND).map(([k, x]) => [k, `${x.em} ${tx(x.name)}`]))}
    ${L.job ? sel('ggs', G, 'culture', t('culture'), Object.entries(CULTURES).map(([k, x]) => [k, `${x.em} ${tx(x.name)}`])) : ''}
    ${L.startup ? sel('ggs', G, 'startupStage', t('startupStage'), [0, 1, 2, 3, 4, 5].map((i) => [i, `${i + 1}/6`])) : ''}
    ${rng('ggr', G, 'legacyIn', '🏯', t('legacy'))}
    ${Object.entries(HABITS).map(([k, h]) => `<div class="slider"><span>${h.em}</span><label for="ggh-${k}">${esc(tx(h.name))}</label><input id="ggh-${k}" type="range" min="0" max="100" value="${G.habits[k]}" data-ggh="${k}"><output class="mono">${G.habits[k]}</output></div>`).join('')}
    ${Object.entries(HOBBIES).map(([k, h]) => `<div class="field"><label for="ggb-${k}">${h.em} ${esc(tx(h.name))}</label><select id="ggb-${k}" data-ggb="${k}">${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => `<option value="${i}" ${G.hob[k] === i ? 'selected' : ''}>${t('lvShort')} ${i}</option>`).join('')}</select></div>`).join('')}
    ${tog('ggc', G, 'learnAll', t('learnAll'))}${tog('ggc', G, 'visitAll', t('visitAll'))}
  </details></div>`;
  return html;
}
function godPersonPower(L, p, g, sl, chk) {
  const sel = (k, label, opts) => `<div class="field"><label for="gps-${k}">${label}</label><select id="gps-${k}" data-gps="${k}">${opts.map(([v, lb]) => `<option value="${v}" ${String(g[k] ?? '') === String(v) ? 'selected' : ''}>${esc(lb)}</option>`).join('')}</select></div>`;
  let html = '';
  const parts = [];
  if (p.age >= 6 && p.role !== 'pet') parts.push(sel('voice', `🗣️ ${t('voice')}`, Object.entries(VOICES).map(([k, v]) => [k, `${v.em} ${tx(v.name)}`])));
  if (p.role === 'pet') parts.push(sel('petPersona', `🐾 ${t('petPersona')}`, Object.entries(PET_P).map(([k, v]) => [k, `${v.em} ${tx(v.name)}`])));
  if (p.role === 'child') parts.push(sel('childTalent', `🌟 ${t('talent')}`, [['', '—'], ...Object.entries(TALENTS).map(([k, v]) => [k, `${v.em} ${tx(v.name)}`])]));
  if (p.age >= 18) parts.push(`${chk('pawn', `♟️ ${t('makePawn')}`)}${sel('pawnVia', t('pawnVia'), Object.entries(PAWN_VIA).map(([k, v]) => [k, `${v.em} ${tx(v.name)}`]))}${sl('pawnLoyal', '🫱')}${sl('pawnDep', '🔗')}`);
  if (adultOK(L, p)) parts.push(chk('contract', `📝 ${t('contractT')}`));
  if (parts.length) html = `<div class="section"><h3>🏛️ ${t('godPersonPower')}</h3><div class="box">${parts.join('')}</div></div>`;
  return html;
}

// ───────── Vẽ lại ─────────
let lastLogKey = '';
function render() {
  const body = ui.view === 'gate' ? viewGate() : ui.view === 'home' ? viewHome() + overlays() : ui.view === 'create' ? viewCreate() : viewGame();
  $app.innerHTML = body;
  const led = document.getElementById('ledger');
  if (led) {
    const key = `${game.life.age}:${game.life.log.at(-1)?.items.length}`;
    if (key !== lastLogKey) { led.scrollTop = led.scrollHeight; lastLogKey = key; }
    else led.scrollTop = ui.scroll ?? led.scrollHeight;
  }
}
// Mỗi hành động thành một dòng trong nhật ký. Hành động không đổi gì (thiếu tiền, hết lượt…) chỉ báo ngay trong bảng.
const itemCount = (life) => (life ? life.log.reduce((n, y) => n + y.items.length, 0) : 0);
const fingerprint = (life) => (life ? JSON.stringify({ ...life, yearActs: 0, snapshots: 0, rng: 0, log: 0 }) + itemCount(life) : '');
let before = { fp: '', n: 0 };
function annotateLast(changes, title) {
  const y = game.life.log.at(-1);
  const it = y && y.items.at(-1);
  if (!it) return;
  const ch = (changes || []).filter(([, v]) => v).map(([k, v]) => [k, Math.round(v)]);
  if (ch.length) it.changes = ch;
  if (title) it.title = title;
}
// Kết quả mọi hành động hiện thành hộp giữa màn hình (chạm là tắt), đồng thời ghi vào nhật ký.
function record(r, title, keepSheet, emoji) {
  if (!r) return;
  const L = game.life;
  if (r.event) { ui.sheet = null; ui.modal = { ev: r.event, title, emoji }; return; }
  if (r.mini) { ui.sheet = null; ui.mini = initMini(r.mini, title, emoji); return; }
  if (fingerprint(L) === before.fp) { ui.result = { text: r.text, tone: r.tone || 'bad', title, emoji: r.tone === 'good' ? emoji : '🙅' }; return; }
  if (itemCount(L) === before.n) addLog(L, r.text, r.tone);
  annotateLast(r.changes, title);
  ui.result = { text: r.text, changes: r.changes, tone: r.tone || toneOf(r.changes), title, emoji };
  if (!keepSheet) ui.sheet = null;
}
const W_LABEL = { exam: 'examPrep', overtime: 'overtime', bossdrinks: 'bossdrinks', transfer: 'transfer', leave: 'leaveWork', strike: 'strike', whistle: 'whistle', promote: 'promoteAsk', study: 'study', skip: 'skip', dropout: 'dropout', uni: 'enrolUni', trade: 'enrolTrade', grad: 'enrolGrad', switch: 'switchMajor', club: 'club', parttime: 'parttime', scholar: 'scholar', exchange: 'exchange', intern: 'intern', olympiad: 'olympiad', hard: 'workHard', raise: 'raise', quit: 'quit' };

// ───────── Sự kiện người dùng ─────────
$app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-a]');
  if (!el) return;
  const a = el.dataset.a;
  if (a === 'close-bg') { if (e.target === el) { ui.sheet = null; render(); } return; }
  const led = document.getElementById('ledger');
  ui.scroll = led ? led.scrollTop : null;
  const [cmd, arg, arg2] = a.split(':');
  const L = game.life;
  const UI_ONLY = ['sheet', 'close', 'person', 'lang', 'home', 'result-ok', 'sub', 'godp'];
  if (L && !UI_ONLY.includes(cmd)) { before = { fp: fingerprint(L), n: itemCount(L), stats: { ...L.stats }, life: L, age: L.age }; ui.freshFrom = before.n; }
  ui.ageTick = false;
  switch (cmd) {
    case 'lang': settings.lang = settings.lang === 'vi' ? 'en' : 'vi'; applyTheme(); break;
    case 'home': ui.view = 'home'; ui.sheet = null; break;
    case 'continue': ui.view = 'game'; break;
    case 'fate': newLife(game, { mode: 'fate' }); ui.view = 'game'; ui.birth = true; ui.sheet = null; ui.modal = null; ui.result = null; ui.queue = []; ui.freshFrom = 0; break;
    case 'free': ui.draft = blankDraft(); ui.view = 'create'; break;
    case 'draft-random': { const d = blankDraft(); ui.draft.stats = d.stats; break; }
    case 'create-free': newLife(game, { mode: 'free', ...ui.draft, first: ui.draft.first.trim() || undefined, last: ui.draft.last.trim() || undefined }); ui.view = 'game'; ui.birth = true; break;
    case 'birth-ok': ui.birth = false; break;
    case 'result-ok': ui.result = ui.queue.shift() || null; break;
    case 'mg': mgClick(arg, arg2); break;
    case 'sp': record(specialAction(L, arg, arg2, settings), { vi: STRINGS.vi.special, en: STRINGS.en.special }, true, arg2 ? SPECIALS[arg2]?.em : L.special ? SPECIALS[L.special.id].em : '🌟'); break;
    case 'sub': ui.sub = arg || null; break;
    case 'ageup': ui.sheet = null; ageUpGame(game); break;
    case 'choose': {
      const idx = Number(arg);
      if (ui.modal) {
        const m = ui.modal;
        const r = chooseModal(game, m.ev, idx);
        if (itemCount(L) > before.n) annotateLast(r.changes, m.title);
        ui.modal = r.next ? { ev: r.next, title: m.title, emoji: m.emoji } : null;
        if (!r.next && r.outcome.text) ui.result = { text: r.outcome.text, changes: r.changes, tone: toneOf(r.changes), title: m.title, emoji: evEmoji(m.ev) || m.emoji };
      } else {
        const r = chooseEvent(game, idx);
        if (r) {
          const title = r.event.arc ? { vi: `${r.event.tag.vi} · ${r.event.npcName}`, en: `${r.event.tag.en} · ${r.event.npcName}` } : r.event.big ? { vi: STRINGS.vi.bigMoment, en: STRINGS.en.bigMoment } : null;
          annotateLast(r.changes, title);
          if (r.outcome.text) ui.result = { text: r.outcome.text, changes: r.changes, tone: toneOf(r.changes), title, emoji: evEmoji(r.event) };
        }
      }
      break;
    }
    case 'sheet':
      ui.sheet = arg; ui.resetArmed = false; ui.packMsg = null; ui.sub = null;
      if (arg === 'work' && L) ensureTeam(L);
      if (arg === 'god' && L) { const m = me(L); ui.god = { stats: { ...L.stats }, money: L.money * country(L).rate, body: { fert: L.fert ?? 70, skill: L.skill ?? 50, size: L.size ?? 50 }, ix: { libido: m.libido, flex: m.flex, charm: m.charm, loyal: m.loyal, scandal: m.scandal, chest: [...m.chest], allPos: false, club: m.club, rope: m.rope }, drama: { orientation: L.orientation, pole: !!m.pole, portrait: m.portrait || '', allowPairs: L.harem ? L.harem.allowPairs !== false : true, nude: !!L.harem?.nude, jacuzzi: !!L.harem?.jacuzzi, vowed: !!L.harem?.vowed }, harem: L.harem ? { harmony: Math.round(L.harem.harmony), head: L.harem.head, structure: L.harem.structure, house: L.harem.house, protect: L.harem.protect || 'each', cungdau: L.harem.cungdau } : {}, world: { yacht: !!m.yacht, room: m.room || '', followers: L.social?.followers || 0, creatorSubs: L.creator?.subs || 0, clubRep: L.nclub?.rep ?? 0, clubStaff: L.nclub?.staff ?? 0 } };
        const P = pw(L); const F = fcfg(L); const H = habits(L); const pe = persona(L);
        ui.god.power = { infl: Math.round(P.infl), statusGod: P.statusGod ?? '', aura: P.aura ?? '', office: P.office, approval: Math.round(P.approval), press: P.press?.kind || '', clubRank: P.club ? P.club.rank : '', jet: P.rich.jet, island: P.rich.island, clanOn: !!P.clan, clanPrestige: Math.round(P.clan?.prestige ?? 20), company: !!P.clan?.company, heirId: P.heirId || '', masks: { ...P.masks }, shadowOn: !!(P.shadow && !P.shadow.ended), exposure: Math.round(P.shadow?.exp ?? 5), shadowBiz: P.shadow?.biz ?? 0, shadowLove: P.shadow?.love ?? 0, council: false, heirAll: !!P.heirAll, maleMax: F.maleMax, noDecline: F.noDecline, carrierMax: F.carrierMax };
        ui.god.persona = { kind: Math.round(pe.kind), wild: Math.round(pe.wild), brave: Math.round(pe.brave), clever: Math.round(pe.clever) };
        ui.god.growth = { talent: talentOf(L).id, talentKnown: talentOf(L).known, prorep: Math.round(L.prorep ?? 30), spend: L.spend || 'balanced', culture: L.job?.culture || '', startupStage: L.startup?.stage ?? 0, legacyIn: Math.round(L.legacyIn || 0), habits: Object.fromEntries(Object.keys(HABITS).map((k) => [k, Math.round(H[k])])), hob: Object.fromEntries(Object.keys(HOBBIES).map((k) => [k, L.hob?.[k]?.lv || 0])), learnAll: false, visitAll: false }; }
      break;
    case 'close': ui.sheet = null; break;
    case 'person': ui.sheet = `person:${arg}`; break;
    case 'godp': {
      const p = L.people.find((x) => x.id === arg);
      if (p) {
        ui.godp = { orient: p.age >= 18 ? orientOf(L, p) : undefined, closeness: p.closeness, looks: p.looks, smarts: p.smarts, poly: p.poly ?? 30, skill: p.skill ?? 50, fert: p.fert ?? 70, size: p.size ?? 50, fidelity: p.fidelity ?? 60, crazy: p.crazy ?? 50, firm: firmOf(p), att: attOf(p), kinks: {}, voice: p.age >= 6 && p.role !== 'pet' ? voiceOf(p) : undefined, petPersona: p.role === 'pet' ? p.persona || 'lazy' : undefined, childTalent: p.role === 'child' ? p.talent || '' : undefined, pawn: p.age >= 18 ? !!p.pawn : undefined, pawnVia: p.pawn?.via || 'favor', pawnLoyal: Math.round(p.pawn?.loyal ?? 60), pawnDep: Math.round(p.pawn?.dep ?? 50), contract: !!p.contract };
        if (p.age >= 18) {
          const x = prof(p);
          Object.assign(ui.godp, { chem: x.chem, fire: x.fire, libido: x.libido, flex: x.flex, jeal: x.jeal, sincere: x.sincere, knows: x.knows, fav: x.fav ?? '', reveal: false });
          for (const k of x.kinks) ui.godp.kinks[k] = 'want';
          for (const k of x.limits) ui.godp.kinks[k] = 'never';
          ui.godp.dyn = x.dyn || '';
          ui.godp.hrel = {};
          if (inHarem(L, p)) { const h = hm(p); const myPair = pairsOf(L, true).find(([a, b]) => a === p || b === p); Object.assign(ui.godp, { htrait: h.trait, hrank: h.rank, hfavor: Math.round(h.favor), hmood: Math.round(h.mood), hknown: h.known, pairWith: myPair ? (myPair[0] === p ? myPair[1].id : myPair[0].id) : '', pairSt: myPair ? myPair[2].st : 'blessed', pairClear: false }); for (const q of hMembers(L)) if (q !== p) ui.godp.hrel[q.id] = Math.round(relOf(L, p, q) / 2 + 50); }
          if (p.baby) Object.assign(ui.godp, { allowPct: Math.round((p.allow || 0) / (country(L).gdp / 100)), term: Math.min(10, Math.max(1, p.term ?? 3)), sinKnown: !!p.sinKnown });
        }
        ui.sheet = `godp:${arg}`;
      }
      break;
    }
    case 'godp-apply': { const gv = { ...ui.godp }; if (gv.hrel && !Object.keys(gv.hrel).length) delete gv.hrel; const gp = L.people.find((x) => x.id === arg); if (gp && gp.age < 18) { delete gv.kinks; } godPerson(L, arg, gv); } ui.sheet = `person:${arg}`; ui.result = { text: t('godDone'), tone: 'good', emoji: '⚡' }; break;
    case 'pa': {
      const p = L.people.find((x) => x.id === arg);
      const lab = p && personActions(L, p, settings).find(([k]) => k === arg2);
      record(doPersonAction(L, settings, arg, arg2), lab ? { vi: `${lab[1].vi} · ${personName(L, p)}`, en: `${lab[1].en} · ${personName(L, p)}` } : null, true, PA_EM[arg2]);
      break;
    }
    case 'act': {
      const r0 = doActivity(L, settings, arg);
      if (r0 && r0.input === 'rename') {
        let nv = null;
        try { nv = window.prompt(t('renamePrompt'), L.first); } catch { nv = null; }
        if (nv && nv.trim()) { const old = L.first; L.first = nv.trim().slice(0, 24); addLog(L, { vi: `Bạn đổi tên từ ${old} thành ${L.first}.`, en: `You change your name from ${old} to ${L.first}.` }); ui.result = { text: { vi: `Từ giờ bạn tên là ${L.first}.`, en: `From now on, you're ${L.first}.` }, tone: 'good', emoji: '🪪' }; ui.sheet = null; }
        break;
      }
      record(r0, ACTIVITIES.find((x) => x.id === arg)?.label, false, ACT_EM[arg]);
      break;
    }
    case 'job': record(applyJob(L, arg), { vi: `${STRINGS.vi.apply}: ${careerById[arg].title.vi}`, en: `${STRINGS.en.apply}: ${careerById[arg].title.en}` }, false, JOB_EM[arg]); break;
    case 'w': record(workAction(L, arg), { vi: STRINGS.vi[W_LABEL[arg]], en: STRINGS.en[W_LABEL[arg]] }, false, { exam: '📝', overtime: '⏰', bossdrinks: '🍻', transfer: '🔁', leave: '🏖️', strike: '✊', whistle: '📣', promote: '⬆️', study: '📚', skip: '🛹', dropout: '🚪', uni: '🎓', trade: '🧰', grad: '📜', switch: '🔀', club: '🎭', parttime: '☕', scholar: '🏅', exchange: '✈️', intern: '🗂️', olympiad: '🏆', hard: '💪', raise: '💰', quit: '🚪' }[arg]); break;
    case 'god-apply': godApply(L, { stats: ui.god.stats, money: ui.god.money / country(L).rate, body: ui.god.body, ix: settings.adult25 && L.age >= 18 ? ui.god.ix : undefined, harem: settings.adult25 && L.harem ? ui.god.harem : undefined, world: settings.adult25 && L.age >= 18 ? ui.god.world : undefined, drama: ui.god.drama, power: ui.god.power, persona: ui.god.persona, growth: { ...ui.god.growth, culture: ui.god.growth.culture || undefined, startupStage: L.startup ? ui.god.growth.startupStage : undefined } }); ui.sheet = null; ui.result = { text: t('godDone'), tone: 'good', emoji: '⚡' }; break;
    case 'god-unlock': godApply(L, { unlockAll: true }); ui.sheet = null; ui.result = { text: t('unlockDone'), tone: 'good', emoji: '🔓' }; break;
    case 'doall': record(doAll(L, settings), { vi: STRINGS.vi.doAll, en: STRINGS.en.doAll }, true, '⚡'); break;
    case 'trig': {
      const id = arg === 'fated' ? `fated:${arg2}` : arg;
      const r = doGodTrigger(L, settings, id);
      if (r.ok) { ui.sheet = null; } else ui.result = { text: r.req ? { vi: `${STRINGS.vi.needs}: ${r.req.vi}`, en: `${STRINGS.en.needs}: ${r.req.en}` } : t('triggerFail'), tone: 'bad', emoji: '🎬' };
      break;
    }
    case 'h': record(doHaremAction(L, settings, arg, arg2), { vi: STRINGS.vi.harem, en: STRINGS.en.harem }, true, '👑'); break;
    case 'pw': { const act = arg2 ? `${arg}:${arg2}` : arg; record(doPowerAction(L, settings, act), { vi: STRINGS.vi.powerT, en: STRINGS.en.powerT }, true, '🏛️'); break; }
    case 'god-cure': godApply(L, { cure: true }); ui.god.stats = { ...L.stats }; ui.result = { text: t('cure'), tone: 'good', emoji: '💊' }; break;
    case 'god-debt': godApply(L, { clearDebt: true }); ui.god.money = L.money * country(L).rate; ui.result = { text: t('clearDebt'), tone: 'good', emoji: '🧾' }; break;
    case 'god-move': { const v = document.getElementById('g-country').value; godApply(L, { country: v }); ui.god.money = L.money * country(L).rate; ui.result = { text: `${byCode[v].flag} ${tx(byCode[v].name)}`, tone: 'good', emoji: '🌍' }; break; }
    case 'rewind': { const prev = godRewind(L); if (prev) { game.life = prev; ui.sheet = null; ui.modal = null; ui.result = null; addLog(prev, { vi: '⚡ Quay lại 1 năm.', en: '⚡ Rewound one year.' }); ui.freshFrom = itemCount(prev) - 1; } break; }
    case 'heir': continueAsChild(game, arg); ui.sheet = null; ui.result = null; break;
    case 'inv': record(invest(L, arg, Math.max(0, L.money) * Number(arg2)), { vi: STRINGS.vi.invest, en: STRINGS.en.invest }, true, ASSET_EM[arg]); break;
    case 'div': record(divest(L, arg), { vi: STRINGS.vi.invest, en: STRINGS.en.invest }, true, ASSET_EM[arg]); break;
    case 'home-buy': record(buyHome(L, arg, arg2 === '1'), { vi: STRINGS.vi.homes, en: STRINGS.en.homes }, true, HOME_EM[arg] || '🏠'); break;
    case 'home-sell': record(sellHome(L, Number(arg)), { vi: STRINGS.vi.homes, en: STRINGS.en.homes }, true, '🏷️'); break;
    case 'home-rent': record(toggleRent(L, Number(arg)), { vi: STRINGS.vi.homes, en: STRINGS.en.homes }, true, '🔑'); break;
    case 'car-buy': record(buyCar(L, arg), { vi: STRINGS.vi.cars, en: STRINGS.en.cars }, true, CAR_EM[arg] || '🚗'); break;
    case 'car-sell': record(sellCar(L, Number(arg)), { vi: STRINGS.vi.cars, en: STRINGS.en.cars }, true, '🏷️'); break;
    case 'biz-start': record(startBiz(L, arg), { vi: STRINGS.vi.business, en: STRINGS.en.business }, true, IND_EM[arg] || '🏢'); break;
    case 'biz': record(bizAction(L, arg), { vi: STRINGS.vi.business, en: STRINGS.en.business }, true, '🏢'); break;
    case 'emigrate': record(emigrate(L, ui.emig), { vi: STRINGS.vi.emigrate, en: STRINGS.en.emigrate }, false, '✈️'); break;
    case 'pack-del':
      customRaw = customRaw.filter((p) => p.manifest.id !== arg);
      store.set(KEY.packs, customRaw);
      game.packs = game.packs.filter((p) => p.builtin || p.manifest.id !== arg);
      refreshEvents(game);
      break;
    case 'reset':
      if (!ui.resetArmed) { ui.resetArmed = true; break; }
      game.life = null; store.del(KEY.save); ui.resetArmed = false; ui.sheet = null; ui.view = 'home';
      break;
  }
  if (before.life && before.life === game.life && before.stats && !UI_ONLY.includes(cmd)) {
    const d = {};
    for (const k of STAT_KEYS) { const v = game.life.stats[k] - before.stats[k]; if (v) d[k] = v; }
    ui.deltas = d;
    ui.ageTick = game.life.age !== before.age;
    before.stats = null;
  } else if (!['sheet', 'close', 'person', 'result-ok', 'sub'].includes(cmd)) ui.deltas = null;
  afterAction(cmd);
  persist();
  render();
});
function afterAction(cmd) {
  const L = game.life;
  if (!L || ui.view !== 'game' || ui.birth) return;
  const fresh = cmd === 'result-ok' ? [] : checkGoals(L);
  if (fresh.length) {
    const pop = { emoji: '🎯', title: { vi: STRINGS.vi.goalDone, en: STRINGS.en.goalDone }, text: { vi: fresh.map((g) => `${g.em} ${g.name.vi}`).join('\n'), en: fresh.map((g) => `${g.em} ${g.name.en}`).join('\n') }, tone: 'good' };
    if (ui.result) ui.queue.push(pop); else ui.result = pop;
  }
  if (L.dead && !L.archived) {
    L.archived = true;
    ui.newAch = archiveLife(profile, L);
    store.set(KEY.profile, profile);
  } else if (!L.dead) ui.newAch = null;
}

$app.addEventListener('input', (e) => {
  const el = e.target;
  if (el.dataset.d) {
    const path = el.dataset.d.split('.');
    if (path[0] === 'stats') { ui.draft.stats[path[1]] = Number(el.value); el.nextElementSibling.textContent = el.value; }
    else ui.draft[path[0]] = el.value;
  } else if (el.dataset.g) {
    ui.god.stats[el.dataset.g] = Number(el.value);
    el.nextElementSibling.textContent = el.value;
  } else if (el.dataset.gp) {
    ui.godp[el.dataset.gp] = Number(el.value);
    el.nextElementSibling.textContent = el.value;
  } else if (el.dataset.gpr) {
    ui.godp.hrel[el.dataset.gpr] = Number(el.value);
    el.nextElementSibling.textContent = el.value;
  } else if (el.dataset.gh) {
    ui.god.harem[el.dataset.gh] = Number(el.value);
    el.nextElementSibling.textContent = el.value;
  } else if (el.dataset.gw) {
    ui.god.world[el.dataset.gw] = Number(el.value);
    el.nextElementSibling.textContent = el.value;
  } else if (el.dataset.gwn) {
    ui.god.world[el.dataset.gwn] = Number(el.value) || 0;
  } else if (el.dataset.gpn) {
    ui.godp[el.dataset.gpn] = Number(el.value) || 0;
  } else if (el.dataset.gx) {
    ui.god.ix[el.dataset.gx] = Number(el.value);
    el.nextElementSibling.textContent = el.value;
  } else if (el.dataset.gb) {
    ui.god.body[el.dataset.gb] = Number(el.value);
    el.nextElementSibling.textContent = el.value;
  } else if (el.dataset.gm) {
    ui.god.money = Number(el.value) || 0;
  } else if (el.dataset.gpw) {
    ui.god.power[el.dataset.gpw] = Number(el.value);
    el.nextElementSibling.textContent = el.dataset.gpw === 'maleMax' && Number(el.value) >= MALE_UNLIMITED ? '∞' : el.value;
  } else if (el.dataset.gpwn) {
    ui.god.power[el.dataset.gpwn] = Number(el.value) || 0;
  } else if (el.dataset.gpe) {
    ui.god.persona[el.dataset.gpe] = Number(el.value);
    el.nextElementSibling.textContent = el.value;
  } else if (el.dataset.ggr) {
    ui.god.growth[el.dataset.ggr] = Number(el.value);
    el.nextElementSibling.textContent = el.value;
  } else if (el.dataset.ggh) {
    ui.god.growth.habits[el.dataset.ggh] = Number(el.value);
    el.nextElementSibling.textContent = el.value;
  }
});

$app.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset.trait) {
    const k = el.dataset.trait;
    ui.draft.traits = el.checked ? [...new Set([...ui.draft.traits, k])].slice(0, 2) : ui.draft.traits.filter((x) => x !== k);
    render();
  } else if (el.dataset.gps) {
    ui.godp[el.dataset.gps] = el.value;
  } else if (el.dataset.gpk) {
    ui.godp.kinks[el.dataset.gpk] = el.value;
  } else if (el.dataset.gpc) {
    ui.godp[el.dataset.gpc] = el.checked;
  } else if (el.dataset.gxc) {
    const k = el.dataset.gxc;
    ui.god.ix.chest = el.checked ? [...new Set([...ui.god.ix.chest, k])] : ui.god.ix.chest.filter((x) => x !== k);
  } else if (el.dataset.gxb) {
    ui.god.ix[el.dataset.gxb] = el.checked;
  } else if (el.dataset.gds) {
    ui.god.drama[el.dataset.gds] = el.value;
  } else if (el.dataset.gdc) {
    ui.god.drama[el.dataset.gdc] = el.checked;
  } else if (el.dataset.setsel) {
    settings[el.dataset.setsel] = el.value;
    persist();
    render();
  } else if (el.dataset.gpws) {
    ui.god.power[el.dataset.gpws] = el.value;
  } else if (el.dataset.gpwc) {
    ui.god.power[el.dataset.gpwc] = el.checked;
  } else if (el.dataset.gpm) {
    ui.god.power.masks[el.dataset.gpm] = el.value;
  } else if (el.dataset.ggs) {
    ui.god.growth[el.dataset.ggs] = el.value;
  } else if (el.dataset.ggc) {
    ui.god.growth[el.dataset.ggc] = el.checked;
  } else if (el.dataset.ggb) {
    ui.god.growth.hob[el.dataset.ggb] = Number(el.value);
  } else if (el.dataset.spend && game.life) {
    record(doPowerAction(game.life, settings, `spend:${el.value}`), { vi: STRINGS.vi.spendStyle, en: STRINGS.en.spendStyle }, true, '💸');
    persist();
    render();
  } else if (el.dataset.mask && game.life) {
    record(doPowerAction(game.life, settings, `mask:${el.dataset.mask}`, el.value), { vi: STRINGS.vi.masks, en: STRINGS.en.masks }, true, '🎭');
    persist();
    render();
  } else if (el.dataset.ghs) {
    ui.god.harem[el.dataset.ghs] = el.value;
  } else if (el.dataset.ghc) {
    ui.god.harem[el.dataset.ghc] = el.checked;
  } else if (el.dataset.gws) {
    ui.god.world[el.dataset.gws] = el.value;
  } else if (el.dataset.gwc) {
    ui.god.world[el.dataset.gwc] = el.checked;
  } else if (el.dataset.set) {
    settings[el.dataset.set] = el.checked;
    persist();
    render();
  } else if (el.dataset.pack) {
    settings.packs[el.dataset.pack] = el.checked;
    refreshEvents(game);
    persist();
    render();
  } else if (el.id === 'packfile' && el.files[0]) {
    const reader = new FileReader();
    reader.onload = () => {
      const r = loadPackText(game, String(reader.result));
      if (r.errors) ui.packMsg = { errors: r.errors };
      else {
        customRaw = customRaw.filter((p) => p.manifest.id !== r.raw.manifest.id).concat(r.raw);
        store.set(KEY.packs, customRaw);
        settings.packs[r.pack.manifest.id] = true;
        refreshEvents(game);
        ui.packMsg = { ok: t('packOk', { name: tx(r.pack.manifest.name), n: r.pack.events.length }) };
      }
      persist();
      render();
    };
    reader.readAsText(el.files[0]);
  } else if (el.dataset.emig) {
    ui.emig = el.value;
    render();
  } else if (el.dataset.d) {
    ui.draft[el.dataset.d] = el.value;
  }
});

$app.addEventListener('submit', (e) => {
  e.preventDefault();
  if (e.target.dataset.form !== 'gate') return;
  const v = document.getElementById('dob').value;
  const d = new Date(v);
  if (!v || Number.isNaN(d.getTime()) || d.getFullYear() < 1900) { ui.gateErr = 'gateBad'; render(); return; }
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--;
  if (age < 25) { ui.gateErr = 'gateNo'; render(); return; }
  store.set(KEY.gate, true);
  ui.gateErr = null;
  ui.view = 'home';
  render();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.matches && e.target.matches('[role="button"][data-a]')) { e.target.click(); return; }
  if (ui.mini && ui.mini.kind === 'maze') { const d = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[e.key]; if (d) { e.preventDefault(); before = { fp: fingerprint(game.life), n: itemCount(game.life) }; mgClick(d); persist(); render(); return; } }
  if (e.key === 'Escape' && ui.result) { ui.result = null; render(); return; }
  if (e.key === 'Escape' && ui.sheet) { ui.sheet = null; render(); }
});

// Giữ ván đang chơi khi trang được cập nhật
window.claude?.hot?.snapshot?.(() => ({ save: game.life, view: ui.view }));
if (window.claude?.hot?.ready) window.claude.hot.ready(boot);
else boot(window.claude?.hot?.data ?? {});

export { STRINGS, BUILTIN, partner, tier };
