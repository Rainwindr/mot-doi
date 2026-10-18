// Đợt 2: nơi làm việc (57), mạng xã hội mở rộng (58), kênh 18+ (52), resort khỏa thân (38), onsen (42),
// du thuyền (64), tour đêm (65), con sau 18 năm (66), hộp đêm (77), kiểu quan hệ (81), phòng bí mật (88),
// sugar baby (59), nút "Làm tất cả" và God Mode mở khóa tất cả.
import { L, clamp, rand, chance, randint, pick } from './util.js';
import { unit, partner, people, byId, randomPerson, partnerGender, personName, addLog, setFlag, lovers, polyOk, endLover, milestone } from './life.js';
import { applyEffects } from './events.js';
import { gainFollowers, followersText } from './specials.js';
import { prof, me, agree, adultOK, attOf, ROM, CHEST, POSITIONS, ROOMS } from './intimacy.js';
import { members, inHarem, hstate } from './harem.js';

const res = (text, changes = [], tone) => ({ text, changes, tone });
const nm = (life, p) => personName(life, p);
const u = (life, n) => n * unit(life);
const fx = (life, e) => applyEffects(life, e);
const oc = (text, effects = {}, run, next, ch = 1) => ({ chance: ch, text, effects, run, next });
const modal = (uid, text, choices) => ({ event: { uid, text, choices } });
const sev = (uid, text, choices) => ({ uid, sys: true, text, choices });
const on = (st, life) => !!(st && st.adult25 && life.age >= 18);
const fire = (p, d) => { const x = prof(p); x.fire = clamp(x.fire + d); };
function fresh(life, role, age, extra = {}) {
  const p = randomPerson(life, life, { role, gender: partnerGender(life, life), age: clamp(age, 18, 90), closeness: 40 });
  Object.assign(p, extra);
  life.people.push(p);
  return p;
}
const known = (life, roles) => life.people.filter((p) => adultOK(life, p) && roles.includes(p.role) && !p.cut);

// ───────── 57 · Nơi làm việc ─────────
/** Đảm bảo có sếp và đồng nghiệp cho công việc hiện tại; đổi việc thì người cũ thành người quen. */
export function ensureTeam(life) {
  const j = life.job;
  const retire = () => { if (!life.team) return; for (const id of [life.team.boss, ...life.team.mates]) { const p = byId(life, id); if (p && (p.role === 'boss' || p.role === 'coworker')) { p.role = 'contact'; p.exWork = true; } } life.team = null; };
  if (!j || life.prison) { retire(); return null; }
  const key = `${j.id}:${j.company}:${life.jobHistory || 0}`;
  if (life.team && life.team.key === key) {
    life.team.mates = life.team.mates.filter((id) => { const p = byId(life, id); return p && p.alive && p.role === 'coworker'; });
    const b = byId(life, life.team.boss);
    if (!b || !b.alive || b.role !== 'boss') life.team.boss = fresh(life, 'boss', life.age + randint(life, 5, 18)).id;
    while (life.team.mates.length < 3) life.team.mates.push(fresh(life, 'coworker', life.age + randint(life, -8, 8)).id);
    return life.team;
  }
  retire();
  const boss = fresh(life, 'boss', life.age + randint(life, 5, 18));
  boss.closeness = 45;
  const mates = [];
  for (let i = 0; i < randint(life, 3, 5); i++) mates.push(fresh(life, 'coworker', life.age + randint(life, -8, 8)).id);
  life.team = { key, boss: boss.id, mates };
  return life.team;
}
export const teamPeople = (life) => (life.team ? [byId(life, life.team.boss), ...life.team.mates.map((id) => byId(life, id))].filter((p) => p && p.alive) : []);

export function workPersonActions(life, p) {
  if (!life.job || !life.team || life.prison) return [];
  if (p.role === 'boss' && p.id === life.team.boss) return [['bflatter', L('Nịnh sếp', 'Flatter the boss')], ['bdrink', L('Mời sếp đi nhậu', 'Take the boss for drinks')], ['braise', L('Xin tăng lương', 'Ask for a raise')], ['bproj', L('Xin dự án lớn', 'Ask for a big project')], ['breport', L('Báo cáo một đồng nghiệp lên HR', 'Report a coworker to HR')], ['bobject', L('Phản đối quyết định của sếp', "Push back on the boss's decision")]];
  if (p.role === 'coworker' && life.team.mates.includes(p.id)) return [['clunch', L('Rủ ăn trưa', 'Grab lunch together')], ['chelp', L('Giúp việc', 'Help with their work')], ['cask', L('Nhờ làm hộ', 'Ask them to cover for you')], ['cblame', L('Đổ lỗi cho họ', 'Blame them')], ['ccompete', L('Tranh dự án', 'Compete for a project')], ['cprank', L('Chơi khăm ở văn phòng', 'Office prank')]];
  return [];
}
export function doWorkPersonAction(life, st, p, act, n) {
  const j = life.job;
  if (!j) return null;
  const name = nm(life, p);
  const tired = res(L('Năm nay như vậy là đủ rồi.', "That's enough for this year."), []);
  const perf = (d) => { j.perf = clamp((j.perf || 50) + d); };
  switch (act) {
    case 'bflatter': if (n > 2) return tired; if (chance(life, agree(life, p, 0.6))) { p.closeness = clamp(p.closeness + randint(life, 4, 9)); perf(3); return res(L(`${name} cười hài lòng: "Cậu tinh ý đấy."`, `${name} smiles: "You've got a good eye."`), fx(life, { happy: 1 }), 'good'); } p.closeness = clamp(p.closeness - 3); return res(L(`${name} nhíu mày: "Nịnh ít thôi, làm nhiều vào."`, `${name} frowns: "Less flattery, more work."`), [], 'bad');
    case 'bdrink': if (n > 1) return tired; if (chance(life, agree(life, p, 0.55))) { p.closeness = clamp(p.closeness + randint(life, 6, 12)); perf(4); if (adultOK(life, p) && on(st, life)) fire(p, 6); return res(L(`Ba chai rượu sau, ${name} kể cho bạn nghe chuyện cả công ty.`, `Three bottles in, ${name} tells you everyone's secrets.`), fx(life, { happy: 3, health: -1, money: -2 }), 'good'); } return res(L(`${name} từ chối: "Tối nay tôi bận."`, `${name} declines: "Busy tonight."`), []);
    case 'braise': {
      if (n > 1) return tired;
      const pr = agree(life, p, 0.15 + p.closeness / 250 + (j.perf || 50) / 250);
      if (chance(life, pr)) { const d = Math.round(j.salary * 0.1); j.salary += d; return res(L('Sếp gật đầu: lương tăng 10%.', 'The boss nods: a 10% raise.'), [['salary', d]], 'good'); }
      p.closeness = clamp(p.closeness - 5);
      return res(L(`${name} bảo "để xem cuối năm". Ai cũng biết nghĩa là không.`, `${name} says "let's see at year end". Everyone knows that means no.`), fx(life, { happy: -3 }), 'bad');
    }
    case 'bproj': if (n > 1) return tired; if (chance(life, agree(life, p, 0.3 + p.closeness / 200))) { perf(10); return res(L('Bạn được giao dự án lớn nhất năm. Áp lực, nhưng cơ hội thăng chức rõ hơn.', "You land the year's biggest project. Pressure, but promotion's in sight."), fx(life, { happy: 2, health: -2 }), 'good'); } return res(L('Dự án về tay người khác.', 'The project goes to someone else.'), fx(life, { happy: -2 }), 'bad');
    case 'bobject': if (n > 1) return tired; if (chance(life, 0.4 + life.stats.smarts / 300)) { p.closeness = clamp(p.closeness + 3); perf(5); return res(L(`${name} suy nghĩ rồi đổi quyết định theo ý bạn.`, `${name} thinks it over and changes course your way.`), fx(life, { willpower: 2 }), 'good'); } p.closeness = clamp(p.closeness - 10); perf(-5); return res(L(`${name} lạnh lùng: "Tôi là sếp hay cậu là sếp?"`, `${name}, coldly: "Am I the boss or are you?"`), [], 'bad');
    case 'breport': {
      if (n > 1) return tired;
      const ms = life.team.mates.map((id) => byId(life, id)).filter(Boolean);
      return modal('w/report', L('Báo cáo ai lên HR?', 'Report whom to HR?'), ms.map((q) => ({ label: L(nm(life, q), nm(life, q)), outcomes: [
        oc(L(`HR điều tra và ${nm(life, q)} bị cho nghỉ việc.`, `HR investigates and ${nm(life, q)} is let go.`), { karma: -3 }, (lf) => { q.role = 'contact'; q.att = 'hate'; q.exWork = true; lf.team.mates = lf.team.mates.filter((id) => id !== q.id); }, null, 0.45),
        oc(L('HR không tìm thấy gì. Cả phòng biết bạn là người báo cáo.', 'HR finds nothing. The whole office knows it was you.'), { happy: -4 }, (lf) => { q.att = 'hate'; perf(-6); for (const m of ms) m.closeness = clamp(m.closeness - 6); }, null, 0.55),
      ] })).concat([{ label: L('Thôi', 'Never mind'), outcomes: [oc(L('Bạn quyết định không làm vậy.', 'You decide against it.'))] }]));
    }
    case 'clunch': if (n > 3) return tired; if (chance(life, agree(life, p, 0.75))) { p.closeness = clamp(p.closeness + randint(life, 4, 8)); if (adultOK(life, p) && on(st, life)) fire(p, 3); return res(L(`Bạn và ${name} ăn trưa, than thở về sếp.`, `You and ${name} have lunch and complain about the boss.`), fx(life, { happy: 3 }), 'good'); } return res(L(`${name} ăn trưa tại bàn, bận quá.`, `${name} eats at their desk, swamped.`), []);
    case 'chelp': if (n > 2) return tired; p.closeness = clamp(p.closeness + randint(life, 5, 10)); if (attOf(p) === 'neutral' && chance(life, 0.2)) p.att = 'friendly'; return res(L(`Bạn giúp ${name} kịp hạn chót. Họ nợ bạn một lần.`, `You help ${name} make their deadline. They owe you one.`), fx(life, { happy: 2, health: -1 }), 'good');
    case 'cask': if (n > 1) return tired; if (chance(life, agree(life, p, 0.3 + p.closeness / 200))) { perf(4); return res(L(`${name} làm hộ phần việc của bạn. Bạn về sớm.`, `${name} covers for you. You head home early.`), fx(life, { happy: 4 }), 'good'); } p.closeness = clamp(p.closeness - 4); return res(L(`${name}: "Tự làm đi."`, `${name}: "Do it yourself."`), [], 'bad');
    case 'cblame': if (n > 1) return tired; if (chance(life, 0.55)) { perf(5); p.closeness = clamp(p.closeness - 15); p.att = attOf(p) === 'hate' ? 'hate' : 'rival'; return res(L(`Sếp tin bạn. ${name} bị khiển trách và từ nay nhìn bạn như kẻ thù.`, `The boss believes you. ${name} is reprimanded and now sees you as an enemy.`), fx(life, { karma: -5 }), 'bad'); } perf(-8); return res(L('Mọi chuyện bị lật tẩy. Bạn mới là người bị khiển trách.', "It unravels. You're the one who gets reprimanded."), fx(life, { karma: -3, happy: -4 }), 'bad');
    case 'ccompete': if (n > 1) return tired; if (chance(life, 0.35 + life.stats.smarts / 250)) { perf(8); p.att = attOf(p) === 'neutral' ? 'rival' : p.att; return res(L(`Bạn thắng dự án. ${name} bắt tay bạn, hơi chặt quá mức.`, `You win the project. ${name} shakes your hand, a little too hard.`), fx(life, { happy: 4 }), 'good'); } perf(-3); return res(L(`${name} giành được dự án.`, `${name} wins the project.`), fx(life, { happy: -3 }), 'bad');
    case 'cprank': if (n > 1) return tired; if (chance(life, 0.6)) { p.closeness = clamp(p.closeness + 4); return res(L(`Bạn bọc giấy bóng toàn bộ bàn làm việc của ${name}. Cả phòng cười nghiêng ngả.`, `You bubble-wrap ${name}'s entire desk. The office is in stitches.`), fx(life, { happy: 5 }), 'good'); } perf(-4); p.closeness = clamp(p.closeness - 6); return res(L('Sếp đi ngang qua đúng lúc. Không ai cười.', 'The boss walks by at the wrong moment. Nobody laughs.'), fx(life, { happy: -2 }), 'bad');
  }
  return null;
}
function teamYear(life) {
  const t = ensureTeam(life);
  if (!t) return;
  const boss = byId(life, t.boss);
  if (boss && life.job) life.job.perf = clamp((life.job.perf || 50) + Math.round((boss.closeness - 50) / 25));
  for (const id of t.mates) { const q = byId(life, id); if (q && attOf(q) === 'hate' && chance(life, 0.15) && life.job) { life.job.perf = clamp(life.job.perf - 5); addLog(life, L(`${nm(life, q)} lại gài bạn trước mặt sếp.`, `${nm(life, q)} sets you up in front of the boss again.`), 'bad'); } }
  if (chance(life, 0.07) && boss) { boss.role = 'contact'; boss.exWork = true; const nb = fresh(life, 'boss', life.age + randint(life, 3, 15)); t.boss = nb.id; addLog(life, L(`Phòng bạn có sếp mới: ${nm(life, nb)}.`, `Your team gets a new boss: ${nm(life, nb)}.`)); }
  else if (chance(life, 0.08) && t.mates.length) { const q = byId(life, pick(life, t.mates)); if (q) { life.stats.happy = clamp(life.stats.happy - 3); if (attOf(q) === 'neutral') q.att = 'rival'; addLog(life, L(`${nm(life, q)} được thăng chức trước bạn.`, `${nm(life, q)} gets promoted before you.`), 'bad'); } }
  else if (chance(life, 0.06) && t.mates.length) { const q = byId(life, pick(life, t.mates)); if (q) { q.role = 'contact'; q.exWork = true; t.mates = t.mates.filter((id) => id !== q.id); addLog(life, L(`${nm(life, q)} nghỉ việc. Bàn bên cạnh bỗng trống trơn.`, `${nm(life, q)} quits. The desk next to yours is suddenly empty.`)); } }
}

// ───────── 58 · Mạng xã hội mở rộng & 52 · Kênh 18+ ─────────
const POSTS = {
  selfie: { a: 13, base: [10, 40], v: 0.04, t: [L('Một tấm selfie ánh sáng vàng.', 'A golden-hour selfie.'), L('Selfie trong thang máy, góc mặt đẹp nhất.', 'A lift selfie, your best angle.')] },
  travel: { a: 13, base: [20, 70], v: 0.06, units: 5, t: [L('Ảnh du lịch, biển xanh và chiếc mũ rộng vành.', 'A travel pic: blue sea and a wide-brimmed hat.')] },
  food: { a: 13, base: [8, 30], v: 0.03, t: [L('Ảnh đồ ăn, ánh sáng đẹp, đồ ăn nguội.', 'Food pic, great light, cold food.')] },
  couple: { a: 16, base: [25, 80], v: 0.06, t: [L('Ảnh đôi lãng mạn với người ấy.', 'A romantic couple photo.')] },
  dance: { a: 13, base: [30, 120], v: 0.09, t: [L('Video nhảy theo trend mới.', 'A video of the new dance trend.')] },
  vlog: { a: 16, base: [30, 100], v: 0.06, t: [L('Vlog "một ngày của tôi", có 3 phút đầu chỉ nói chuyện.', 'A "day in my life" vlog with three minutes of chat up front.')] },
  trend: { a: 13, base: [40, 150], v: 0.12, t: [L('Video bắt trend, cắt ghép rất nhanh.', 'A trend video with lightning-fast cuts.')] },
  sexy: { a: 18, adult: true, base: [60, 200], v: 0.1, t: [L('Ảnh gợi cảm, đủ để người ta lướt lại hai lần.', 'A sultry shot, enough to make people scroll back twice.')] },
  boudoir: { a: 18, adult: true, base: [80, 260], v: 0.1, units: 8, t: [L('Bộ ảnh boudoir nghệ thuật, khéo che những chỗ cần che.', 'An artful boudoir set, everything that needs covering, covered.')] },
  sexyvid: { a: 18, adult: true, base: [100, 320], v: 0.12, t: [L('Một video gợi cảm, ánh đèn đỏ và nhạc chậm.', 'A sultry video: red light, slow music.')] },
  harem: { a: 18, adult: true, base: [150, 400], v: 0.15, when: (lf) => members(lf).length >= 2, t: [L('Ảnh "cả nhà" trên giường lớn, ai cũng đắp chung một tấm chăn.', 'A "family" photo on the big bed, everyone under one blanket.')] },
};
const POST_LABEL = {
  selfie: L('Đăng selfie', 'Post a selfie'), travel: L('Đăng ảnh du lịch', 'Post a travel photo'), food: L('Đăng ảnh đồ ăn', 'Post a food photo'), couple: L('Đăng ảnh đôi', 'Post a couple photo'),
  dance: L('Đăng video nhảy', 'Post a dance video'), vlog: L('Đăng vlog', 'Post a vlog'), trend: L('Đăng video bắt trend', 'Post a trend video'),
  sexy: L('🔞 Đăng ảnh gợi cảm', '🔞 Post a sultry photo'), boudoir: L('🔞 Đăng bộ ảnh boudoir', '🔞 Post a boudoir set'), sexyvid: L('🔞 Đăng video gợi cảm', '🔞 Post a sultry video'), harem: L('🔞 Đăng ảnh cả hậu cung', '🔞 Post a harem photo'),
};
function socialPost(life, st, kind) {
  const P = POSTS[kind];
  const n = (life.yearActs[`post:${kind}`] = (life.yearActs[`post:${kind}`] || 0) + 1);
  if (n > 2) return res(L('Thuật toán bảo bạn nghỉ ngơi đi.', 'The algorithm says take a break.'), []);
  if (P.units) life.money -= u(life, P.units);
  const { viral, g } = gainFollowers(life, randint(life, P.base[0], P.base[1]), P.v);
  const likes = Math.round(g * (3 + rand(life) * 6) + (life.social?.followers || 0) * 0.04);
  let text = L(`${pick(life, P.t).vi} ${followersText(likes)} lượt thích, +${followersText(g)} người theo dõi.${viral ? ' Bài đăng viral!' : ''}`, `${pick(life, P.t).en} ${followersText(likes)} likes, +${followersText(g)} followers.${viral ? ' It went viral!' : ''}`);
  let tone = viral ? 'good' : undefined;
  const add = (t, bad) => { text = L(`${text.vi} ${t.vi}`, `${text.en} ${t.en}`); if (bad) tone = 'bad'; };
  const pt = partner(life);
  const exes = life.people.filter((p) => p.role === 'ex' && p.alive);
  if (kind === 'couple' && pt && lovers(life).length && !polyOk(life) && chance(life, 0.15)) { add(L('Ai đó soi ra trong ảnh có đồ của người khác.', 'Someone spots another person\'s things in the background.'), true); life.queue.unshift({ sys: 'affair_exposed' }); }
  else if (exes.length && chance(life, 0.12)) { const e = pick(life, exes); add(L(`${nm(life, e)} (người cũ) thả tim.${pt ? ' Người yêu bạn thấy và hỏi lạnh lùng: "Ai đây?"' : ''}`, `${nm(life, e)} (your ex) likes it.${pt ? ' Your partner sees and asks coldly: "Who\'s this?"' : ''}`)); if (pt) pt.closeness = clamp(pt.closeness - 3); }
  else if (pt && chance(life, 0.08)) { add(L('Một người lạ bình luận "đẹp quá". Người yêu bạn ghen cả tối.', 'A stranger comments "gorgeous". Your partner sulks all evening.')); pt.closeness = clamp(pt.closeness - 2); }
  if (P.adult) {
    me(life).charm = clamp(me(life).charm + 2);
    me(life).scandal = clamp(me(life).scandal + 2);
    const parents = life.people.filter((p) => p.alive && (p.role === 'mother' || p.role === 'father'));
    if (parents.length && chance(life, 0.12)) { add(L('Bố mẹ bạn thấy bài đăng. Cuộc gọi tối đó dài và im lặng.', 'Your parents see it. That evening\'s call is long and silent.'), true); for (const p of parents) p.closeness = clamp(p.closeness - 6); }
    else if (life.job && chance(life, 0.08)) { add(L('Sếp bạn cũng theo dõi tài khoản này.', 'Turns out your boss follows this account.'), true); life.job.perf = clamp((life.job.perf || 50) - 6); }
    else if (chance(life, 0.05)) { const so = life.social; so.followers = Math.round(so.followers * 0.9); add(L('Tài khoản bị khóa ba ngày vì "vi phạm tiêu chuẩn cộng đồng".', 'Account suspended for three days for "community standards".'), true); }
    if (chance(life, 0.12)) { const f = fresh(life, 'contact', life.age + randint(life, -10, 10), { fan: true }); f.att = chance(life, 0.5) ? 'crush' : 'like'; prof(f).fire = 40; add(L(`${nm(life, f)}, một người theo dõi, nhắn riêng cho bạn rất dài.`, `${nm(life, f)}, a follower, sends you a very long DM.`)); }
    if (kind === 'harem') for (const p of members(life)) p.hm.favor = clamp(p.hm.favor + randint(life, -6, 6));
  }
  return res(text, fx(life, { happy: viral ? 8 : 2 }), tone);
}

export function creatorAction(life, st, act) {
  const c = life.creator;
  const key = `cr:${act}`;
  const n = (life.yearActs[key] = (life.yearActs[key] || 0) + 1);
  const tired = res(L('Năm nay như vậy là đủ rồi.', "That's enough for this year."), []);
  const gain = (base) => { const g = Math.round((base + (life.social?.followers || 0) * 0.002 + c.subs * 0.05) * (0.5 + life.stats.looks / 100) * (0.7 + rand(life) * 0.8)); c.subs += g; return g; };
  switch (act) {
    case 'open':
      life.creator = { subs: 0, total: 0, price: 1, exposed: false, since: life.age };
      gainFollowers(life, 50, 0.05);
      addLog(life, L('Bạn mở một kênh trả phí 18+.', 'You open an 18+ subscription channel.'));
      return res(L('Kênh trả phí 18+ của bạn chính thức mở. Bài đầu tiên được ghim.', 'Your 18+ subscription channel is live. First post pinned.'), fx(life, { happy: 3 }), 'good');
    case 'photo': { if (n > 3) return tired; const g = gain(randint(life, 20, 80)); me(life).scandal = clamp(me(life).scandal + 1); return res(L(`Bộ ảnh mới, gợi cảm nhưng tinh tế. +${followersText(g)} người đăng ký.`, `A new set, sultry but tasteful. +${followersText(g)} subscribers.`), fx(life, { happy: 2 }), 'good'); }
    case 'video': { if (n > 3) return tired; const g = gain(randint(life, 40, 140)); me(life).scandal = clamp(me(life).scandal + 2); return res(L(`Một video ánh đèn đỏ. +${followersText(g)} người đăng ký.`, `A red-light video. +${followersText(g)} subscribers.`), fx(life, { happy: 3 }), 'good'); }
    case 'live': { if (n > 2) return tired; const tips = u(life, Math.min(200, 2 + c.subs / 300)); life.money += tips; c.total += tips; gain(randint(life, 10, 40)); return res(L('Livestream riêng cho người đăng ký. Quà ảo rơi liên tục.', 'A private stream for subscribers. Virtual gifts pour in.'), [['money', tips]], 'good'); }
    case 'request': {
      if (n > 2) return tired;
      const tip = u(life, Math.min(300, 5 + c.subs / 200));
      return modal('cr/request', L('Một fan cứng gửi yêu cầu riêng kèm khoản tip lớn.', 'A superfan sends a custom request with a big tip.'), [
        { label: L('Nhận làm', 'Accept'), outcomes: [oc(L('Bạn làm đúng yêu cầu (trong giới hạn của bạn). Fan tip thêm.', 'You deliver, within your own limits. The fan tips extra.'), { happy: 2 }, (lf) => { lf.money += tip; c.total += tip; })] },
        { label: L('Từ chối lịch sự', 'Politely decline'), outcomes: [oc(L('Bạn giữ nguyên tắc của mình. Fan vẫn ở lại.', 'You stick to your rules. The fan stays anyway.'), { willpower: 2 })] },
        { label: L('Mời fan gặp mặt', 'Invite the fan to meet'), outcomes: [oc(L('Một buổi cà phê ngượng ngùng nhưng thú vị.', 'An awkward but intriguing coffee.'), { happy: 3 }, (lf) => { const f = fresh(lf, 'contact', lf.age + randint(lf, -10, 10), { fan: true }); f.att = 'crush'; prof(f).fire = 50; })] },
      ]);
    }
    case 'collab': {
      if (n > 1) return tired;
      const ps = life.people.filter((p) => adultOK(life, p) && ROM.includes(p.role));
      if (!ps.length) return res(L('Bạn cần một người yêu hoặc người tình đồng ý cùng làm.', 'You need a partner or lover willing to join.'), [], 'bad');
      return modal('cr/collab', L('Rủ ai cùng quay?', 'Who will you film with?'), ps.slice(0, 6).map((p) => {
        const ok = agree(life, p, (p.poly ?? 30) / 150 + 0.25, true);
        return { label: L(nm(life, p), nm(life, p)), outcomes: [
          oc(L(`${nm(life, p)} đồng ý. Video chung đạt kỷ lục người đăng ký.`, `${nm(life, p)} agrees. The collab breaks your subscriber record.`), { happy: 5 }, (lf) => { gain(randint(lf, 150, 400)); p.closeness = clamp(p.closeness + 5); fire(p, 8); }, null, ok),
          oc(L(`${nm(life, p)} từ chối: "Chuyện của hai ta thì để hai ta biết."`, `${nm(life, p)} declines: "What's ours stays ours."`), {}, () => { p.closeness = clamp(p.closeness - 3); }, null, 1 - ok),
        ] };
      }));
    }
    case 'close': life.creator = null; return res(L('Bạn đóng kênh. Một chương khép lại.', 'You close the channel. A chapter ends.'), []);
  }
  return null;
}
function creatorYear(life, st) {
  const c = life.creator;
  if (!c) return;
  c.subs = Math.max(0, Math.round(c.subs * (0.88 + rand(life) * 0.1)));
  const inc = u(life, c.subs * 0.05 * c.price);
  life.money += inc; c.total += inc;
  if (c.subs >= 1000 && !c.m1) { c.m1 = true; milestone(life, L('🔞 1.000 người đăng ký kênh trả phí', '🔞 1,000 paid subscribers'), 'good'); }
  if (on(st, life) && !c.exposed && chance(life, 0.08)) life.queue.push({ sys: 'cr_exposed', who: pick(life, ['family', 'work', 'partner']) });
  else if (chance(life, 0.03)) { c.subs = Math.round(c.subs * 0.6); addLog(life, L('Nền tảng khóa kênh của bạn một tháng. Mất 40% người đăng ký.', 'The platform suspends your channel for a month. You lose 40% of subscribers.'), 'bad'); }
  else if (c.subs > 200 && chance(life, 0.1)) { const g = u(life, 20); life.money += g; addLog(life, L('Một fan cứng gửi quà đắt tiền về địa chỉ hộp thư của bạn.', 'A superfan sends an expensive gift to your PO box.'), 'good'); }
}

// ───────── 38 · Resort khỏa thân, 42 · Onsen ─────────
function placeMenu(life, st, kind) {
  const pt = partner(life);
  const ms = members(life);
  const acq = known(life, ['coworker', 'boss', 'neighbor', 'ex', 'rival', 'mentor']);
  const meetAcq = (lf, txt) => { const q = pick(lf, acq); q.closeness = clamp(q.closeness + 10); fire(q, 20); if (attOf(q) === 'neutral') q.att = 'crush'; if (q.role === 'boss' && lf.job) lf.job.perf = clamp((lf.job.perf || 50) + randint(lf, -5, 5)); addLog(lf, L(`Bạn và ${nm(lf, q)} có một bí mật chung từ ${txt.vi}.`, `You and ${nm(lf, q)} now share a secret from the ${txt.en}.`)); return q; };
  const stranger = (lf) => { const t = fresh(lf, 'contact', lf.age + randint(lf, -8, 8)); prof(t).fire = 50; t.att = 'like'; return t; };
  const where = kind === 'nudist' ? L('resort', 'resort') : L('onsen', 'onsen');
  const meet = acq.length ? [oc(L(`Ở ${where.vi}, bạn chạm mặt một người quen. Cả hai cùng không mặc gì. Sau năm giây ngượng chín, hai người phá lên cười.`, `At the ${where.en} you run into someone you know. Neither of you is wearing anything. Five mortifying seconds, then you both burst out laughing.`), { happy: 6 }, (lf) => meetAcq(lf, where), null, 0.3)] : [];
  const choices = kind === 'nudist' ? [
    { label: L('Nằm phơi nắng bên hồ bơi', 'Sunbathe by the pool'), outcomes: [
      oc(L('Luật ở đây: nhìn nhưng không nhìn chằm chằm. Một người lạ hấp dẫn nằm ghế bên cạnh bắt chuyện.', 'House rule: look, but don\'t stare. An attractive stranger on the next lounger strikes up a chat.'), { happy: 8 }, (lf) => stranger(lf), null, acq.length ? 0.4 : 0.6),
      ...meet,
      oc(L('Bạn quên bôi kem chống nắng ở một chỗ rất khó nói. Ba ngày sau vẫn đi đứng kỳ kỳ.', 'You forget sunscreen in a very awkward spot. Three days later you\'re still walking funny.'), { happy: 2, health: -2 }, null, null, 0.3),
    ] },
    { label: L('Tắm biển lúc nửa đêm', 'A midnight swim'), outcomes: [oc(L('Biển ấm, trăng sáng, không một mảnh vải. Tự do tuyệt đối.', 'Warm sea, bright moon, not a stitch on. Total freedom.'), { happy: 9, health: 1 })] },
  ] : [
    { label: L('Khu tắm chung', 'The mixed bath'), outcomes: [
      oc(L('Hơi nước mờ mịt, tuyết rơi bên ngoài. Một người lạ ngồi xuống bồn cạnh bạn, ánh mắt nán lại hơi lâu.', 'Steam everywhere, snow falling outside. A stranger slips into the bath beside you, their gaze lingering a little too long.'), { happy: 8, health: 2 }, (lf) => stranger(lf), null, acq.length ? 0.4 : 0.7),
      ...meet,
      oc(L('Nước nóng quá. Bạn đỏ như tôm luộc nhưng vẫn cố ngồi cho ra dáng.', 'The water\'s scalding. You turn lobster-red but sit it out with dignity.'), { happy: 3 }, null, null, 0.3),
    ] },
    { label: L('Phòng xông hơi', 'The sauna'), outcomes: [
      ...(acq.length ? [oc(L('Trong phòng xông hơi chỉ có bạn và một người quen ở công ty. Không khí nóng hơn cả nhiệt độ.', 'Just you and someone from work in the sauna. The air gets hotter than the thermostat.'), { happy: 6 }, (lf) => { const q = meetAcq(lf, L('phòng xông hơi', 'sauna')); fire(q, 10); }, null, 0.5)] : []),
      oc(L('Bạn xông hơi đến khi đầu óc trống rỗng. Thư giãn tuyệt đối.', 'You steam until your mind goes blank. Total bliss.'), { happy: 5, health: 3 }, null, null, acq.length ? 0.5 : 1),
    ] },
  ];
  if (pt && adultOK(life, pt)) choices.push({ label: L(`Đi cùng ${nm(life, pt)}`, `Go with ${nm(life, pt)}`), outcomes: [oc(kind === 'nudist' ? L(`Một tuần không mảnh vải cùng ${nm(life, pt)}. Ngượng đúng một buổi sáng, sau đó thì không rời nhau.`, `A week without clothes with ${nm(life, pt)}. Awkward for one morning, then inseparable.`) : L(`Phòng tắm riêng ngoài trời với ${nm(life, pt)}, tuyết rơi trên vai.`, `A private outdoor bath with ${nm(life, pt)}, snow on your shoulders.`), { happy: 10 }, (lf) => { pt.closeness = clamp(pt.closeness + 8); fire(pt, 12); setFlag(lf, 'recent_intimate'); })] });
  if (ms.length >= 2) choices.push({ label: L(`Cả hậu cung (${ms.length} người)`, `The whole harem (${ms.length})`), outcomes: [oc(L('Cả nhà cùng đi. Nhân viên phải xếp riêng một khu cho đoàn của bạn.', 'The whole household goes. Staff have to rope off a section for your party.'), { happy: 12, money: -5 * ms.length }, (lf) => { hstate(lf).harmony = clamp(hstate(lf).harmony + 10); for (const p of ms) { p.hm.mood = clamp(p.hm.mood + 8); fire(p, 8); } })] });
  return modal(`w/${kind}`, kind === 'nudist' ? L('Một khu nghỉ dưỡng nơi không ai mặc gì. Bạn làm gì?', 'A resort where nobody wears anything. What do you do?') : L('Một onsen truyền thống trên núi. Bạn vào đâu?', 'A traditional mountain onsen. Where do you go?'), choices);
}

// ───────── 64 · Du thuyền, 65 · Tour đêm ─────────
function yachtParty(life, st) {
  const ms = members(life);
  const babies = life.people.filter((p) => p.alive && p.baby);
  const ls = lovers(life);
  const choices = [];
  if (ms.length) choices.push({ label: L(`Hậu cung (${ms.length})`, `The harem (${ms.length})`), outcomes: [oc(L('Cả nhà trên boong, nhạc to, rượu ngon. Ngoài khơi xa, không ai biết chuyện gì xảy ra.', 'The household on deck, loud music, good wine. Far from shore, no one knows what happens.'), { happy: 12 }, (lf) => { hstate(lf).harmony = clamp(hstate(lf).harmony + 10); for (const p of ms) fire(p, 10); setFlag(lf, 'recent_intimate'); })] });
  if (babies.length) choices.push({ label: L(`Các sugar baby (${babies.length})`, `Your sugar babies (${babies.length})`), outcomes: [oc(L('Một ngày trên du thuyền khiến các baby đăng ảnh không ngừng. Ai cũng gọi bạn là "người tuyệt nhất".', 'A day on the yacht and your babies post nonstop. Everyone calls you "the best".'), { happy: 9 }, () => { for (const p of babies) { p.closeness = clamp(p.closeness + 8); prof(p).sincere = clamp(prof(p).sincere + 3); } })] });
  if (ls.length >= 2) choices.push({ label: L(`Tất cả người tình (${ls.length})`, `All your lovers (${ls.length})`), outcomes: [
    oc(L('Liều lĩnh mời tất cả lên cùng một chuyến. Bằng cách nào đó mọi người vui vẻ với nhau.', 'You recklessly invite them all on one trip. Somehow everyone gets along.'), { happy: 10 }, () => { for (const p of ls) { prof(p).knows = true; p.closeness = clamp(p.closeness + 4); } }, null, 0.45),
    oc(L('Giữa biển không có chỗ trốn. Những người tình nhìn nhau rồi nhìn bạn.', 'There\'s nowhere to hide at sea. Your lovers look at each other, then at you.'), { happy: -8 }, () => { for (const p of ls) { prof(p).knows = true; p.closeness = clamp(p.closeness - 12); } }, null, 0.55),
  ] });
  choices.push({ label: L('Đối tác làm ăn', 'Business partners'), outcomes: [oc(L('Hợp đồng được ký ngay trên boong.', 'A deal is signed right there on deck.'), { happy: 4 }, (lf) => { if (lf.job) lf.job.perf = clamp((lf.job.perf || 50) + 8); if (lf.biz) lf.biz.value *= 1.08; lf.money += u(lf, 30); })] });
  choices.push({ label: L('Bạn bè và những người lạ thú vị', 'Friends and interesting strangers'), outcomes: [oc(L('Một bữa tiệc mở. Bạn về bờ với thêm vài số điện thoại.', 'An open party. You come ashore with a few new numbers.'), { happy: 8 }, (lf) => { for (let i = 0; i < 2; i++) { const t = fresh(lf, 'contact', lf.age + randint(lf, -8, 8)); prof(t).fire = 45; t.att = on(st, lf) ? pick(lf, ['like', 'crush']) : 'friendly'; } })] });
  return modal('w/yacht', L('Tiệc trên du thuyền của bạn. Mời ai?', 'A party on your yacht. Who do you invite?'), choices);
}
const TOUR_ITEMS = Object.fromEntries(Object.entries(CHEST).filter(([, it]) => it.tour));
function nightTour(life, st) {
  const m = me(life);
  const city = (lb, text, item) => ({ label: lb, outcomes: [
    oc(L(`${text.vi} Bạn mang về ${TOUR_ITEMS[item].em} ${TOUR_ITEMS[item].name.vi.toLowerCase()}.`, `${text.en} You bring home a ${TOUR_ITEMS[item].name.en.toLowerCase()} ${TOUR_ITEMS[item].em}.`), { happy: 10 }, () => { if (!m.chest.includes(item)) m.chest.push(item); m.charm = clamp(m.charm + 2); }, null, 0.7),
    oc(L(`${text.vi} Một người địa phương mời bạn đi tiếp đến sáng.`, `${text.en} A local invites you to keep going till sunrise.`), { happy: 12 }, (lf) => { if (!m.chest.includes(item)) m.chest.push(item); const t = fresh(lf, 'contact', lf.age + randint(lf, -8, 8), { fling: true }); prof(t).fire = 60; t.att = 'like'; lf.counts.ons++; }, null, 0.3),
  ] });
  return modal('w/tour', L('Tour đêm người lớn. Chọn thành phố:', 'An after-dark tour. Pick a city:'), [
    city(L('Thành phố ánh đèn: show cabaret', 'City of lights: a cabaret show'), L('Lông vũ, kim tuyến và những vũ công không biết ngượng.', 'Feathers, sequins and shameless dancers.'), 'boa'),
    city(L('Thành phố mặt nạ: lễ hội hóa trang', 'City of masks: a carnival'), L('Không ai biết ai. Ai cũng bạo dạn hơn.', 'Nobody knows anybody. Everyone is bolder.'), 'mask'),
    city(L('Thành phố kênh đào: bảo tàng và cửa hàng người lớn', 'Canal city: an adult museum and megastore'), L('Ba tầng bảo tàng và một cửa hàng to như siêu thị.', 'Three floors of museum and a store the size of a supermarket.'), 'artbook'),
    city(L('Thành phố suối nóng: ryokan truyền thống', 'Hot-spring town: a traditional ryokan'), L('Yukata, đèn lồng giấy và bồn tắm riêng ngoài hiên.', 'Yukata, paper lanterns and a private bath on the porch.'), 'yukata'),
    city(L('Phố neon: khách sạn chủ đề', 'Neon district: themed hotels'), L('Mỗi tầng một chủ đề, mỗi phòng một câu chuyện.', 'Every floor a theme, every room a story.'), 'neon'),
  ]);
}

// ───────── 88 · Phòng bí mật ─────────
function secretRoom(life) {
  const m = me(life);
  return modal('w/room', L('Cải tạo một căn phòng trong nhà thành phòng bí mật. Chủ đề?', 'Turn a room in your home into a secret room. Theme?'), Object.entries(ROOMS).map(([k, r]) => ({ label: L(`${r.em} ${r.name.vi}`, `${r.em} ${r.name.en}`), outcomes: [oc(L(`${r.text.vi} Phòng bí mật đã xong.`, `${r.text.en} The secret room is ready.`), { money: -60, happy: 6 }, () => { m.room = k; })] })).concat([{ label: L('Thôi', 'Never mind'), outcomes: [oc(L('Căn phòng vẫn là phòng làm việc.', 'The room stays a home office.'))] }]));
}

// ───────── 77 · Hộp đêm của bạn ─────────
export function clubBizAction(life, st, act) {
  const c = life.nclub;
  const key = `nc:${act}`;
  const n = (life.yearActs[key] = (life.yearActs[key] || 0) + 1);
  const tired = res(L('Năm nay như vậy là đủ rồi.', "That's enough for this year."), []);
  switch (act) {
    case 'open':
      life.nclub = { rep: 30, staff: 2, level: 1, adult: false, since: life.age };
      addLog(life, L('Bạn khai trương hộp đêm của riêng mình.', 'You open your own nightclub.'), 'good');
      return res(L('Đêm khai trương: hàng dài trước cửa, DJ chơi đến sáng.', 'Opening night: a queue round the block, the DJ plays till dawn.'), fx(life, { happy: 8 }), 'good');
    case 'theme': if (n > 2) return tired; return modal('nc/theme', L('Tối nay chủ đề gì?', "Tonight's theme?"), [
      ...[[L('Đêm thập niên 90', '90s night'), 4], [L('Đêm trắng: dress code toàn trắng', 'White party'), 6], [L('Đêm mặt nạ', 'Masquerade'), 8]].map(([lb, d]) => ({ label: lb, outcomes: [oc(L('Khách đông nghịt, doanh thu tăng vọt.', 'Packed house, takings through the roof.'), { happy: 4 }, (lf) => { c.rep = clamp(c.rep + d); lf.money += u(lf, d * 3); }, null, 0.8), oc(L('Tối nay vắng khách. Bạn tự nhảy một mình trên sàn.', 'A quiet night. You dance alone on the floor.'), { happy: -2 }, () => { c.rep = clamp(c.rep - 2); }, null, 0.2)] })),
      ...(on(st, life) ? [{ label: L('🔞 Đêm đồ lót', '🔞 Lingerie night'), outcomes: [oc(L('Dress code càng ít càng tốt. Ảnh tiệc lan khắp mạng.', 'Dress code: the less the better. Party photos spread everywhere.'), { happy: 7 }, (lf) => { c.rep = clamp(c.rep + 10); lf.money += u(lf, 30); me(lf).scandal = clamp(me(lf).scandal + 3); })] }] : []),
    ]);
    case 'staff': if (c.staff >= 12) return res(L('Đã đủ nhân viên.', 'Fully staffed.'), []); life.money -= u(life, 20); c.staff++; return res(L(`Bạn thuê thêm nhân viên (${c.staff} người).`, `You hire more staff (${c.staff} total).`), [['money', -u(life, 20)]]);
    case 'vip': {
      if (n > 2) return tired;
      const t = fresh(life, 'contact', life.age + randint(life, -10, 15));
      t.wealth = Math.round((t.wealth || 0) * 5 + u(life, 3000));
      prof(t).fire = on(st, life) ? 55 : 20;
      if (on(st, life)) t.att = pick(life, ['like', 'crush', 'affair']);
      c.rep = clamp(c.rep + 4);
      return res(L(`Bạn đích thân tiếp ${nm(life, t)}, một khách VIP. Họ để lại tip lớn và số điện thoại.`, `You personally host ${nm(life, t)}, a VIP. They leave a big tip and their number.`), fx(life, { happy: 4, money: 10 }), 'good');
    }
    case 'adult': {
      if (c.adult) return null;
      if (life.money < u(life, 600)) return res(L('Cần thêm vốn để nâng cấp.', 'You need more capital to upgrade.'), [], 'bad');
      life.money -= u(life, 600); c.adult = true; c.level = 2; me(life).club = true;
      addLog(life, L('Hộp đêm của bạn trở thành CLB người lớn với luật riêng: "Luôn hỏi trước khi chạm."', 'Your club becomes an adult club with its own rule: "Always ask before touching."'), 'good');
      return res(L('Tầng hầm mở cửa cho hội viên. Thẻ đen đầu tiên mang tên bạn.', 'The basement opens to members. The first black card has your name on it.'), [['money', -u(life, 600)]], 'good');
    }
    case 'sell': {
      const v = u(life, 200 + c.rep * 10 + c.staff * 30 + (c.adult ? 600 : 0));
      life.money += v; life.nclub = null;
      return res(L('Bạn bán lại hộp đêm.', 'You sell the club.'), [['money', v]], 'good');
    }
  }
  return null;
}
function clubBizYear(life, st) {
  const c = life.nclub;
  if (!c) return;
  const income = u(life, c.rep * c.staff * 0.6 * (c.adult ? 1.8 : 1)) - u(life, c.staff * 12);
  life.money += income;
  c.rep = clamp(c.rep - 3);
  if (chance(life, 0.1)) life.queue.push({ sys: 'nc_event', kind: pick(life, ['fight', 'rival']) });
}

// ───────── 66 · Con sau 18 năm ─────────
function child18Year(life) {
  const m = me(life);
  m.onsSeen = m.onsSeen ?? life.counts.ons;
  if (life.counts.ons > m.onsSeen) { (m.onsAges ||= []).push(...Array(Math.min(3, life.counts.ons - m.onsSeen)).fill(life.age)); m.onsSeen = life.counts.ons; }
  if (!m.onsAges || !m.onsAges.length) return;
  const due = m.onsAges.filter((a) => life.age - a === 18);
  m.onsAges = m.onsAges.filter((a) => life.age - a < 18);
  if (due.length && life.age < 90 && chance(life, 0.15 * due.length)) life.queue.push({ sys: 'ix_child18' });
}

// ───────── 81 · Kiểu quan hệ ─────────
export const DYN = {
  sweet: { em: '🍯', name: L('Ngọt ngào', 'Sweet') },
  steamy: { em: '🌶️', name: L('Nồng cháy', 'Steamy') },
  strained: { em: '⚡', name: L('Căng thẳng', 'Strained') },
  wild: { em: '🎲', name: L('Khó đoán', 'Unpredictable') },
};
function dynYear(life, st) {
  let done = false;
  for (const p of life.people) {
    if (!adultOK(life, p) || !ROM.includes(p.role)) continue;
    const x = prof(p);
    if (!x.dyn) { const r = rand(life); x.dyn = r < 0.35 + x.chem / 400 ? 'sweet' : r < 0.6 + x.chem / 400 ? 'steamy' : (p.crazy ?? 50) > 60 ? 'wild' : 'strained'; }
    if (done || !chance(life, 0.2)) continue;
    done = true;
    const name = nm(life, p);
    if (x.dyn === 'sweet') { p.closeness = clamp(p.closeness + 3); addLog(life, L(`${name} mang bữa sáng lên giường cho bạn, không vì dịp gì cả.`, `${name} brings you breakfast in bed, for no reason at all.`), 'good'); }
    else if (x.dyn === 'steamy') { x.fire = clamp(x.fire + 6); life.stats.happy = clamp(life.stats.happy + 2); addLog(life, on(st, life) ? L(`${name} kéo bạn vào phòng giữa buổi chiều. Cuộc họp online bị hủy.`, `${name} pulls you into the bedroom mid-afternoon. The video call gets cancelled.`) : L(`${name} và bạn không rời nhau cả cuối tuần.`, `You and ${name} spend the whole weekend glued together.`), 'good'); }
    else if (x.dyn === 'strained') { p.closeness = clamp(p.closeness - 4); if (chance(life, 0.5)) { p.closeness = clamp(p.closeness + 6); addLog(life, L(`Bạn và ${name} cãi nhau to, rồi làm lành còn to hơn.`, `You and ${name} have a huge fight, then an even bigger make-up.`)); } else addLog(life, L(`Bạn và ${name} lại cãi nhau vì chuyện vặt.`, `You and ${name} fight over nothing again.`), 'bad'); }
    else if (x.dyn === 'wild') { if (p.role === 'partner' && chance(life, 0.3)) addLog(life, L(`Bạn và ${name} chia tay rồi quay lại trong vòng một tuần.`, `You and ${name} break up and get back together within a week.`)); else { x.fire = clamp(x.fire + randint(life, -8, 10)); addLog(life, L(`${name} rủ bạn bay sang nước khác ngay tối nay. Bạn đồng ý.`, `${name} suggests flying abroad tonight. You say yes.`)); } }
  }
}

// ───────── 59 · Sugar baby ─────────
export function babyActions(life, p, st) {
  if (!p.baby || !on(st, life)) return [];
  return [['allowup', L('Tăng trợ cấp', 'Raise the allowance')], ['check', L('Thuê người kiểm tra độ thật lòng', 'Hire someone to check their sincerity')], ['btrip', L('Đưa đi nghỉ dưỡng', 'Take them on a getaway')], ['bpublic', L('Công khai mối quan hệ', 'Go public')]];
}
export function doBabyAction(life, st, p, act, n) {
  const name = nm(life, p);
  const tired = res(L('Năm nay như vậy là đủ rồi.', "That's enough for this year."), []);
  switch (act) {
    case 'allowup': p.allow = Math.round((p.allow || u(life, 30)) * 1.3); p.closeness = clamp(p.closeness + 8); prof(p).sincere = clamp(prof(p).sincere + 2); return res(L(`Trợ cấp của ${name} tăng 30%. Họ gửi một tin nhắn đầy trái tim.`, `${name}'s allowance goes up 30%. They send a message full of hearts.`), fx(life, { happy: 3 }), 'good');
    case 'check': {
      if (n > 1) return tired;
      life.money -= u(life, 5);
      p.sinKnown = true;
      if (chance(life, 0.15)) { p.closeness = clamp(p.closeness - 15); return res(L(`${name} phát hiện mình bị theo dõi và rất tổn thương. Nhưng báo cáo vẫn đến tay bạn: độ thật lòng ${prof(p).sincere}/100.`, `${name} finds out they're being watched and is deeply hurt. The report still arrives: sincerity ${prof(p).sincere}/100.`), [['money', -u(life, 5)]], 'bad'); }
      const s = prof(p).sincere;
      return res(s >= 70 ? L(`Báo cáo: ${name} thật lòng (${s}/100). Họ nói về bạn với bạn bè bằng ánh mắt sáng rỡ.`, `Report: ${name} is sincere (${s}/100). They light up talking about you to friends.`) : s >= 40 ? L(`Báo cáo: ${name} nửa thật nửa vì tiền (${s}/100).`, `Report: ${name} is half sincere, half in it for the money (${s}/100).`) : L(`Báo cáo: ${name} đang có người khác và chủ yếu vì tiền (${s}/100).`, `Report: ${name} is seeing someone else and mostly in it for the money (${s}/100).`), [['money', -u(life, 5)]], s >= 40 ? 'good' : 'bad');
    }
    case 'btrip': if (n > 1) return tired; p.closeness = clamp(p.closeness + 10); fire(p, 10); setFlag(life, 'recent_intimate'); if (partner(life) && !polyOk(life) && chance(life, 0.15)) life.queue.unshift({ sys: 'affair_exposed' }); return res(L(`Một tuần ở resort năm sao với ${name}. Hóa đơn spa dài hơn cả hợp đồng.`, `A week at a five-star resort with ${name}. The spa bill is longer than your contract.`), fx(life, { happy: 10, money: -40 }), 'good');
    case 'bpublic': {
      p.baby = false; p.allow = 0;
      me(life).scandal = clamp(me(life).scandal + 6);
      if (!partner(life)) { p.role = 'partner'; p.years = 0; life.counts.partners++; }
      return res(L(`Bạn đăng ảnh đầu tiên với ${name}. Hàng nghìn bình luận. Từ nay không còn là thỏa thuận nữa.`, `You post your first photo with ${name}. Thousands of comments. It's no longer an arrangement.`), fx(life, { happy: 6 }), 'good');
    }
  }
  return null;
}
function babyYear(life) {
  for (const p of life.people) {
    if (!p.alive || !p.baby) continue;
    p.term = (p.term ?? 3) - 1;
    if (p.term <= 0) { life.queue.push({ sys: 'ix_baby_term', id: p.id }); p.term = 99; }
  }
}

// ───────── Hoạt động & sự kiện ─────────
const cr = (lf) => !!lf.creator;
const ncl = (lf) => !!lf.nclub;
export const WORLD_ACTIVITIES = [
  ...Object.keys(POSTS).map((k) => ({ id: `post_${k}`, group: 'net', min: POSTS[k].a, max: 100, when: (lf, st) => (!POSTS[k].adult || on(st, lf)) && (!POSTS[k].when || POSTS[k].when(lf)) && (k !== 'couple' || lf.people.some((p) => p.alive && ROM.includes(p.role))), label: POST_LABEL[k], run: (lf, st) => socialPost(lf, st, k) })),
  { id: 'cr_open', group: 'net', min: 18, max: 100, when: (lf, st) => on(st, lf) && !cr(lf), label: L('🔞 Mở kênh trả phí 18+', '🔞 Open an 18+ paid channel'), run: (lf, st) => creatorAction(lf, st, 'open') },
  { id: 'cr_photo', group: 'net', min: 18, max: 100, when: (lf, st) => on(st, lf) && cr(lf), label: L('🔞 Kênh 18+: đăng bộ ảnh', '🔞 Channel: post a photo set'), run: (lf, st) => creatorAction(lf, st, 'photo') },
  { id: 'cr_video', group: 'net', min: 18, max: 100, when: (lf, st) => on(st, lf) && cr(lf), label: L('🔞 Kênh 18+: đăng video', '🔞 Channel: post a video'), run: (lf, st) => creatorAction(lf, st, 'video') },
  { id: 'cr_live', group: 'net', min: 18, max: 100, when: (lf, st) => on(st, lf) && cr(lf), label: L('🔞 Kênh 18+: livestream riêng', '🔞 Channel: private livestream'), run: (lf, st) => creatorAction(lf, st, 'live') },
  { id: 'cr_request', group: 'net', min: 18, max: 100, when: (lf, st) => on(st, lf) && cr(lf), label: L('🔞 Kênh 18+: yêu cầu của fan', '🔞 Channel: fan request'), run: (lf, st) => creatorAction(lf, st, 'request') },
  { id: 'cr_collab', group: 'net', min: 18, max: 100, when: (lf, st) => on(st, lf) && cr(lf), label: L('🔞 Kênh 18+: quay cùng người ấy', '🔞 Channel: film with your partner'), run: (lf, st) => creatorAction(lf, st, 'collab') },
  { id: 'cr_close', group: 'net', min: 18, max: 100, when: (lf, st) => on(st, lf) && cr(lf), label: L('Đóng kênh 18+', 'Close the 18+ channel'), run: (lf, st) => creatorAction(lf, st, 'close') },
  { id: 'nudist', group: 'adult', min: 18, max: 100, units: 30, when: (lf, st) => on(st, lf), label: L('Resort khỏa thân', 'Naturist resort'), run: (lf, st) => placeMenu(lf, st, 'nudist') },
  { id: 'onsen', group: 'adult', min: 18, max: 100, units: 15, when: (lf, st) => on(st, lf), label: L('Onsen tắm chung', 'Mixed onsen'), run: (lf, st) => placeMenu(lf, st, 'onsen') },
  { id: 'nighttour', group: 'adult', min: 18, max: 90, units: 60, when: (lf, st) => on(st, lf), label: L('Tour đêm người lớn', 'After-dark city tour'), run: (lf, st) => nightTour(lf, st) },
  { id: 'yachtbuy', group: 'adult', min: 21, max: 100, when: (lf, st) => on(st, lf) && !me(lf).yacht && lf.money >= u(lf, 5000), label: L('Mua du thuyền riêng', 'Buy a yacht'), run: (lf) => { lf.money -= u(lf, 3000); me(lf).yacht = true; addLog(lf, L('Bạn mua một chiếc du thuyền.', 'You buy a yacht.'), 'good'); return res(L('Chiếc du thuyền trắng muốt neo ở bến. Tên tàu do bạn đặt.', 'A gleaming white yacht at the marina. You get to name it.'), [['money', -u(lf, 3000)]], 'good'); } },
  { id: 'yachtparty', group: 'adult', min: 21, max: 100, units: 40, when: (lf, st) => on(st, lf) && me(lf).yacht, label: L('Tiệc trên du thuyền', 'Yacht party'), run: (lf, st) => yachtParty(lf, st) },
  { id: 'secretroom', group: 'adult', min: 18, max: 100, when: (lf, st) => on(st, lf) && (lf.homes?.length || 0) > 0 && !me(lf).room, label: L('Làm phòng bí mật trong nhà', 'Build a secret room at home'), run: (lf) => secretRoom(lf) },
  { id: 'nc_open', group: 'money', min: 21, max: 90, units: 400, when: (lf) => !ncl(lf), label: L('Mở hộp đêm của riêng bạn', 'Open your own nightclub'), run: (lf, st) => clubBizAction(lf, st, 'open') },
  { id: 'nc_theme', group: 'money', min: 21, max: 100, when: ncl, label: L('Hộp đêm: đêm chủ đề', 'Club: theme night'), run: (lf, st) => clubBizAction(lf, st, 'theme') },
  { id: 'nc_staff', group: 'money', min: 21, max: 100, when: ncl, label: L('Hộp đêm: thuê thêm nhân viên', 'Club: hire staff'), run: (lf, st) => clubBizAction(lf, st, 'staff') },
  { id: 'nc_vip', group: 'money', min: 21, max: 100, when: ncl, label: L('Hộp đêm: tiếp khách VIP', 'Club: host a VIP'), run: (lf, st) => clubBizAction(lf, st, 'vip') },
  { id: 'nc_adult', group: 'money', min: 21, max: 100, when: (lf, st) => ncl(lf) && on(st, lf) && !lf.nclub.adult, label: L('🔞 Nâng cấp thành CLB người lớn', '🔞 Upgrade to an adult club'), run: (lf, st) => clubBizAction(lf, st, 'adult') },
  { id: 'nc_sell', group: 'money', min: 21, max: 100, when: ncl, label: L('Bán hộp đêm', 'Sell the club'), run: (lf, st) => clubBizAction(lf, st, 'sell') },
];

export function worldYear(life, st) {
  teamYear(life);
  creatorYear(life, st);
  clubBizYear(life, st);
  if (life.age < 18) return;
  child18Year(life);
  if (on(st, life)) {
    dynYear(life, st);
    babyYear(life);
    const m = me(life);
    if (m.room && chance(life, 0.06)) life.queue.push({ sys: 'ix_room' });
  }
}

export function buildWorldSys(life, item, st) {
  const adult = on(st, life);
  if (item.sys === 'cr_exposed') {
    if (!life.creator) return null;
    const who = { family: L('Gia đình bạn', 'Your family'), work: L('Công ty bạn', 'Your workplace'), partner: L('Người yêu bạn', 'Your partner') }[item.who];
    return sev('sys/cr_exposed', L(`${who.vi} phát hiện ra kênh 18+ của bạn.`, `${who.en} discovers your 18+ channel.`), [
      { label: L('Thừa nhận, đó là công việc của mình', "Own it, it's your job"), outcomes: [oc(L('Bạn bình thản giải thích. Có người chấp nhận, có người không.', 'You explain calmly. Some accept it, some don\'t.'), { willpower: 4 }, (lf) => { lf.creator.exposed = true; me(lf).scandal = clamp(me(lf).scandal + 10); if (item.who === 'work' && lf.job) lf.job.perf = clamp(lf.job.perf - 15); for (const p of lf.people) if (p.alive && (p.role === 'mother' || p.role === 'father') && item.who === 'family') p.closeness = clamp(p.closeness - 10); const pt = partner(lf); if (pt && item.who === 'partner') pt.closeness = clamp(pt.closeness - 8); })] },
      { label: L('Phủ nhận', 'Deny it'), outcomes: [oc(L('Họ tạm tin. Tạm thôi.', 'They believe you. For now.'), { karma: -2 }, null, null, 0.5), oc(L('Họ có ảnh chụp màn hình.', 'They have screenshots.'), { happy: -6 }, (lf) => { lf.creator.exposed = true; me(lf).scandal = clamp(me(lf).scandal + 15); }, null, 0.5)] },
      { label: L('Đóng kênh ngay', 'Shut the channel down'), outcomes: [oc(L('Kênh biến mất. Thu nhập cũng vậy.', 'The channel disappears. So does the income.'), { happy: -3 }, (lf) => { lf.creator = null; })] },
    ]);
  }
  if (item.sys === 'nc_event') {
    if (!life.nclub) return null;
    const c = life.nclub;
    if (item.kind === 'fight') return sev('sys/nc_fight', L('Hai nhóm khách đánh nhau giữa sàn nhảy.', 'Two groups of customers brawl on the dance floor.'), [
      { label: L('Cho bảo vệ dẹp ngay', 'Send in security'), outcomes: [oc(L('Gọn gàng trong hai phút.', 'Sorted in two minutes.'), {}, () => { c.rep = clamp(c.rep + 2); }, null, Math.min(0.9, 0.4 + c.staff / 15)), oc(L('Bảo vệ không đủ người. Quán bị đóng cửa một tuần.', 'Not enough security. The club is shut for a week.'), { money: -20 }, () => { c.rep = clamp(c.rep - 10); }, null, 1 - Math.min(0.9, 0.4 + c.staff / 15))] },
      { label: L('Tự ra can', 'Break it up yourself'), outcomes: [oc(L('Bạn ăn một cú đấm, nhưng khách nể bạn hơn.', 'You take a punch, but customers respect you more.'), { health: -6 }, () => { c.rep = clamp(c.rep + 5); })] },
    ]);
    return sev('sys/nc_rival', L('Một hộp đêm mới mở ngay đối diện, giảm giá một nửa.', 'A new club opens right across the street at half price.'), [
      { label: L('Giảm giá đáp trả', 'Match their prices'), outcomes: [oc(L('Cuộc chiến giá kéo dài cả năm.', 'A year-long price war.'), { money: -30 }, () => { c.rep = clamp(c.rep + 3); })] },
      { label: L('Tổ chức đêm đặc biệt', 'Throw a special night'), outcomes: [oc(L('Khách quay về với bạn.', 'The crowd comes back to you.'), { money: -10 }, () => { c.rep = clamp(c.rep + 8); }, null, 0.6), oc(L('Không ăn thua.', 'It doesn\'t work.'), { money: -10 }, () => { c.rep = clamp(c.rep - 8); }, null, 0.4)] },
      { label: L('Mặc kệ', 'Ignore it'), outcomes: [oc(L('Một phần khách bỏ sang bên kia.', 'Some customers drift across the street.'), {}, () => { c.rep = clamp(c.rep - 10); })] },
    ]);
  }
  if (item.sys === 'ix_child18') {
    const pt = partner(life);
    const g = item.g || (item.g = rand(life) < 0.5 ? 'male' : 'female');
    const mk = (lf, close) => { const k = randomPerson(lf, lf, { role: 'child', age: 18, last: lf.last, closeness: close, gender: g }); k.otherParentId = null; k.outOfWedlock = true; k.late = true; lf.people.push(k); lf.counts.children++; return k; };
    const react = (lf) => { if (pt) pt.closeness = clamp(pt.closeness + (chance(lf, agree(lf, pt, 0.4)) ? 3 : -8)); if (members(lf).length) hstate(lf).harmony = clamp(hstate(lf).harmony - 5); };
    return sev('sys/ix_child18', L('Một người trẻ 18 tuổi gõ cửa: "Con nghĩ bạn là cha/mẹ ruột của con. Mẹ/bố con nói về một đêm cách đây 18 năm."', 'An 18-year-old knocks on your door: "I think you\'re my biological parent. Mine told me about one night, 18 years ago."'), [
      { label: L('Nhận con ngay', 'Welcome them right away'), outcomes: [oc(L('Hai người ôm nhau giữa ngưỡng cửa. 18 năm bỏ lỡ, nhưng vẫn còn cả đời phía trước.', '18 years missed, but a whole life ahead. You hug in the doorway.'), { happy: 8, karma: 4 }, (lf) => { const k = mk(lf, 45); react(lf); addLog(lf, L(`Bạn gặp đứa con chưa từng biết: ${personName(lf, k)}.`, `You meet the child you never knew: ${personName(lf, k)}.`), 'good'); })] },
      { label: L('Làm xét nghiệm ADN trước', 'Get a DNA test first'), outcomes: [
        oc(L('Kết quả: đúng là con bạn.', 'The result: they\'re yours.'), { money: -3, happy: 4 }, (lf) => { mk(lf, 30); react(lf); }, null, 0.7),
        oc(L('Kết quả: không phải. Người trẻ xin lỗi và rời đi, mắt đỏ hoe.', 'The result: not yours. They apologise and leave, eyes red.'), { money: -3 }, null, null, 0.3),
      ] },
      { label: L('Từ chối gặp', 'Refuse to meet them'), outcomes: [oc(L('Cánh cửa đóng lại. Có những câu hỏi sẽ không bao giờ có lời đáp.', 'The door closes. Some questions will never be answered.'), { karma: -8, happy: -3 })] },
    ]);
  }
  if (item.sys === 'ix_baby_term') {
    const p = byId(life, item.id);
    if (!p || !p.alive || !p.baby) return null;
    const name = nm(life, p);
    return sev('sys/ix_baby_term', L(`Thỏa thuận ba năm với ${name} đã hết hạn.`, `Your three-year arrangement with ${name} has ended.`), [
      { label: L('Gia hạn thêm 3 năm', 'Renew for three years'), outcomes: [oc(L(`${name} ký tiếp, kèm điều khoản tăng trợ cấp 10%.`, `${name} signs again, with a 10% raise clause.`), {}, () => { p.term = 3; p.allow = Math.round((p.allow || 0) * 1.1); })] },
      { label: L('Kết thúc tại đây', 'End it here'), outcomes: [oc(L(`${name} ôm bạn lần cuối và đi.`, `${name} hugs you one last time and goes.`), { happy: -3 }, (lf) => { p.baby = false; p.allow = 0; endLover(lf, p); })] },
      { label: L('Nâng thành người yêu chính thức', 'Make them your official partner'), outcomes: [oc(L('Không còn hợp đồng nào nữa, chỉ còn hai người.', 'No more contract. Just the two of you.'), { happy: 8 }, (lf) => { p.baby = false; p.allow = 0; if (!partner(lf)) { p.role = 'partner'; p.years = 0; lf.counts.partners++; } p.term = 99; })] },
    ]);
  }
  if (item.sys === 'ix_room') {
    const m = me(life);
    if (!m.room) return null;
    const who = item.who || (item.who = life.people.some((p) => p.alive && (p.role === 'mother' || p.role === 'father')) ? 'parents' : 'guest');
    return sev('sys/ix_room', who === 'parents' ? L(`Bố mẹ đến chơi và mở nhầm cửa ${ROOMS[m.room].name.vi.toLowerCase()}.`, `Your parents visit and open the door to ${ROOMS[m.room].name.en.toLowerCase()} by mistake.`) : L(`Một người khách mở nhầm cửa ${ROOMS[m.room].name.vi.toLowerCase()}.`, `A guest opens the door to ${ROOMS[m.room].name.en.toLowerCase()} by mistake.`), [
      { label: L('"Đó là phòng tập gym!"', '"That\'s my home gym!"'), outcomes: [oc(L('Không ai tin, nhưng ai cũng lịch sự gật đầu.', 'Nobody believes you, but everyone nods politely.'), { happy: -2 }, (lf) => { me(lf).scandal = clamp(me(lf).scandal + 2); })] },
      { label: L('Thừa nhận và cười', 'Admit it and laugh'), outcomes: [oc(L('Một tràng cười ngượng ngùng, rồi không ai nhắc lại.', 'Awkward laughter, then it\'s never mentioned again.'), { willpower: 2 })] },
      { label: L('Lắp khóa vân tay từ nay', 'Install a fingerprint lock'), outcomes: [oc(L('Chỉ bạn và người được chọn mở được cửa.', 'Only you and the chosen ones can open it now.'), { money: -3 })] },
    ]);
  }
  return null;
}


// ───────── Nút "Làm tất cả" ─────────
export function doAllPeople(life, st, doPersonAction) {
  let n = 0;
  const pets = [];
  for (const p of life.people.slice()) {
    if (!p.alive || p.cut || life.dead) continue;
    if (p.role === 'pet') { doPersonAction(life, st, p.id, 'walk'); pets.push(p); continue; }
    const kidPlay = p.role === 'child' && p.age < 14;
    doPersonAction(life, st, p.id, kidPlay ? 'play' : 'talk');
    if (['mother', 'father', 'child', 'sibling', 'partner', 'spouse', 'lover', 'bestie'].includes(p.role) && life.age >= 3) doPersonAction(life, st, p.id, 'hug');
    n++;
  }
  return n;
}

// ───────── God Mode ─────────
export function godWorldSelf(life, v) {
  const m = me(life);
  if (v.yacht != null) m.yacht = !!v.yacht;
  if (v.room !== undefined) m.room = v.room && ROOMS[v.room] ? v.room : null;
  if (v.followers != null && Number(v.followers) >= 0) { life.social ||= { followers: 0, posts: 0 }; life.social.followers = Math.round(Number(v.followers)); }
  if (v.creatorSubs != null) { if (Number(v.creatorSubs) > 0 || life.creator) { life.creator ||= { subs: 0, total: 0, price: 1, exposed: false, since: life.age }; life.creator.subs = Math.max(0, Math.round(Number(v.creatorSubs))); } }
  if (v.clubRep != null && life.nclub) life.nclub.rep = clamp(Number(v.clubRep));
  if (v.clubStaff != null && life.nclub) life.nclub.staff = clamp(Math.round(Number(v.clubStaff)), 1, 12);
}
export function godUnlockAll(life) {
  const m = me(life);
  m.chest = [...new Set([...m.chest, ...Object.keys(CHEST)])];
  m.pos = POSITIONS.map((_, i) => i);
  m.club = true; m.rope = true; m.yacht = true;
  if (!m.room) m.room = 'red';
  if (!life.creator) life.creator = { subs: 0, total: 0, price: 1, exposed: false, since: life.age };
  if (!life.nclub && life.age >= 21) life.nclub = { rep: 50, staff: 4, level: 2, adult: true, since: life.age };
}
export function godWorldPerson(life, p, v) {
  if (p.age < 18) return;
  const x = prof(p);
  if (v.dyn !== undefined) x.dyn = v.dyn && DYN[v.dyn] ? v.dyn : null;
  if (p.baby) {
    if (v.allowPct != null) p.allow = u(life, Math.max(0, Number(v.allowPct)));
    if (v.term != null) p.term = clamp(Math.round(Number(v.term)), 1, 10);
    if (v.sinKnown != null) p.sinKnown = !!v.sinKnown;
  }
}
