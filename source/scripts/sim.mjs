// Mô phỏng nhiều đời ngẫu nhiên để kiểm tra lỗi và cân bằng tuổi thọ.
import { makeGame, defaultSettings, newLife, ageUpGame, currentEvent, chooseEvent, chooseModal } from '../src/engine/game.js';
import { availableActivities, doActivity, workAction, applyJob, jobOpenings } from '../src/engine/actions.js';
import { country } from '../src/engine/life.js';
import { invest, divest, buyHome, buyCar, startBiz, bizAction, ASSETS, HOMES, CARS, INDUSTRIES, netWorth } from '../src/engine/economy.js';
import { emigrate } from '../src/engine/crime.js';
import { COUNTRIES } from '../src/data/countries.js';
import { partnerActionList, partnerAction } from '../src/engine/love.js';
import { partner } from '../src/engine/life.js';
import { choiceLocked } from '../src/engine/events.js';
import { autoPlay } from '../src/engine/minigames.js';
import { SPECIALS, specialAction, canJoin, socialAction } from '../src/engine/specials.js';
import { checkGoals, archiveLife, emptyProfile } from '../src/engine/goals.js';
const profile = emptyProfile(); let goalsHit = 0;
const pickOpen = (life, ev) => { const ok = ev.choices.map((c, i) => [c, i]).filter(([c]) => !choiceLocked(life, c)); return ok.length ? R(ok)[1] : 0; };
let specTop = 0, maxFollow = 0; const arcDone = {}; let stuck = 0; const degs = {}; const jobs = {};
let marriages = 0, divorces = 0, prenups = 0, sugar = 0, adopted = 0;
const R = (a) => a[Math.floor(Math.random() * a.length)];
let jailed = 0, escaped = 0, bizs = 0, homes = 0, moved = 0, worthMax = 0, cobornDead = 0;

const N = Number(process.argv[2]) || 2000;
const st = { ...defaultSettings(), adult25: true, alwaysProtect: false };
if (process.env.NOPACKS) for (const id of process.env.NOPACKS.split(',')) st.packs[id] = false;
const game = makeGame(st);
const byC = {};
let errs = 0, withKids = 0, kids = 0, evCount = 0, ons = 0, affairs = 0, grads = 0;
const seen = new Set();
for (let i = 0; i < N; i++) {
  const life = newLife(game, { mode: 'fate', seed: i + 1 });
  try {
    let guard = 0;
    while (!life.dead && guard++ < 200) {
      ageUpGame(game);
      let ev, g2 = 0;
      while ((ev = currentEvent(game)) && g2++ < 10) {
        evCount++;
        seen.add(ev.uid);
        chooseEvent(game, pickOpen(life, ev));
      }
      if (life.age >= 6 && life.age <= 65 && !life.dead) {
        const r = workAction(life, R(['promote', 'promote', 'hard', 'uni', 'trade', 'grad', 'club', 'scholar', 'intern', 'switch', 'study', 'parttime', 'exchange', 'olympiad']));
        if (r && r.mini) autoPlay(life, r.mini);
        if (r && r.event) { const ok = r.event.choices.map((c, i) => [c, i]).filter(([c]) => !choiceLocked(life, c)); chooseModal(game, r.event, ok.length ? R(ok)[1] : r.event.choices.length - 1); }
        if (!life.job && life.age >= 18 && !life.edu.stage) { const o = jobOpenings(life); if (o.length) applyJob(life, R(o).id); }
      }
      goalsHit += checkGoals(life).length;
      if (!life.dead && life.age >= 14) {
        if (!life.special && !life.job && Math.random() < 0.15) { const id = R(Object.keys(SPECIALS)); if (canJoin(life, id, st)) specialAction(life, 'join', id, st); }
        if (life.special) specialAction(life, R(['train', 'big', 'promo', 'train', 'big']));
        if (Math.random() < 0.3) socialAction(life, R(['photo', 'video', 'live', 'sponsor']));
      }
      const acts = availableActivities(life);
      if (life.age >= 18 && !life.dead) {
        const roll = Math.random();
        if (roll < 0.15) invest(life, R(Object.keys(ASSETS)), Math.max(0, life.money) * 0.3);
        else if (roll < 0.18) divest(life, R(Object.keys(ASSETS)));
        else if (roll < 0.21) buyHome(life, R(HOMES).id, Math.random() < 0.5);
        else if (roll < 0.23) buyCar(life, R(CARS).id);
        else if (roll < 0.26) startBiz(life, R(INDUSTRIES).id);
        else if (roll < 0.3 && life.biz) bizAction(life, R(['invest', 'marketing', 'evade', 'sell', 'close']));
        else if (roll < 0.31) emigrate(life, R(COUNTRIES).code);
      }
      const pt = partner(life);
      if (pt && !life.dead) {
        for (let k = 0; k < 2; k++) {
          const list = partnerActionList(life, pt);
          if (!list.length) break;
          let r = partnerAction(life, st, pt, R(list)[0]);
          let g = 0;
          while (r && r.event && g++ < 6) {
            const m = chooseModal(game, r.event, Math.floor(Math.random() * r.event.choices.length));
            r = m.next ? { event: m.next } : null;
          }
          if (life.marriage && life.marriage.prenup) prenups++;
        }
      }
      for (let k = 0; k < 2 && acts.length; k++) {
        const r = doActivity(life, st, acts[Math.floor(Math.random() * acts.length)].id);
        if (r && r.mini) autoPlay(life, r.mini);
        if (r && r.event) chooseModal(game, r.event, Math.floor(Math.random() * r.event.choices.length));
      }
    }
    if (!life.dead) stuck++;
    archiveLife(profile, life);
    for (const [k, v] of Object.entries(life.arcs || {})) if (v.done) arcDone[k] = (arcDone[k] || 0) + 1;
    const c = country(life).code;
    (byC[c] ||= []).push(life.age);
    kids += life.counts.children;
    if (life.counts.children) withKids++;
    ons += life.counts.ons;
    marriages += life.counts.marriages || 0; divorces += life.counts.divorces; sugar += life.counts.sugar || 0; adopted += life.people.filter((x) => x.adopted).length;
    if (life.counts.prisonYears) jailed++;
    if (life.counts.escapes) escaped++;
    if (life.counts.businesses) bizs++;
    if (life.homes.length) homes++;
    if (life.counts.moves) moved++;
    cobornDead += life.coborns.filter((c) => !c.alive).length;
    if (isNaN(netWorth(life))) throw new Error('NaN net worth');
    affairs += life.counts.affairsExposed;
    if (['bachelor', 'master', 'phd'].includes(life.edu.level)) grads++;
    for (const d of life.edu.degrees || []) degs[d.level + ':' + d.major] = (degs[d.level + ':' + d.major] || 0) + 1;
    for (const x of life.edu.trades || []) degs['trade:' + x] = (degs['trade:' + x] || 0) + 1;
    if (life.job) jobs[life.job.id + ':' + life.job.level] = (jobs[life.job.id + ':' + life.job.level] || 0) + 1;
    if (life.counts.specialTop) specTop++;
    maxFollow = Math.max(maxFollow, life.social?.followers || 0);
  } catch (e) {
    errs++;
    if (errs < 4) console.error(e);
  }
}
const total = game.events.length;
console.log('degrees', JSON.stringify(degs));
console.log('max followers', maxFollow);
console.log('goals hit', goalsHit, 'of', N * 3, '· achievements', Object.keys(profile.ach).join(','), '· ribbons', Object.keys(profile.ribbons).length);
console.log('jobs at death', JSON.stringify(jobs));
console.log('stuck lives', stuck, '· arcs finished', JSON.stringify(arcDone));
console.log(`marriages ${marriages} · divorces ${divorces} · prenup-years ${prenups} · sugar partners ${sugar} · adopted kids ${adopted}`);
console.log(`jailed ${jailed} · escaped ${escaped} · businesses ${bizs} · homeowners ${homes} · emigrated ${moved} · coborn deaths ${cobornDead}`);
console.log(`errors ${errs} · events shown ${evCount} · distinct ${seen.size}/${total} · lives with kids ${withKids} · kids ${kids} · ONS ${ons} · affairs exposed ${affairs} · grads ${grads}`);
const rows = Object.entries(byC).map(([c, a]) => [c, a.length, (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1), country({ country: c }).life]).sort((a, b) => b[1] - a[1]).slice(0, 12);
console.log('country\tn\tavg death\tdata life exp');
for (const r of rows) console.log(r.join('\t'));
