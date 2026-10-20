// Hậu cung (mục 54–56, 59): gia đình nhiều người yêu. Chỉ người lớn, ai cũng tự nguyện, chỉ bật khi có nội dung 25+.
import { L, clamp, rand, chance, randint, pick } from './util.js';
import { unit, partner, byId, personName, addLog, setFlag, lovers, makeLover, endLover, syncAffair } from './life.js';
import { applyEffects, tryConceive, protectChance } from './events.js';
import { prof, me, agree, adultOK, attOf, ROM } from './intimacy.js';

const res = (text, changes = [], tone) => ({ text, changes, tone });
const nm = (life, p) => personName(life, p);
const u = (life, n) => n * unit(life);
const fx = (life, e) => applyEffects(life, e);
const oc = (text, effects = {}, run, next, ch = 1) => ({ chance: ch, text, effects, run, next });
const modal = (uid, text, choices) => ({ event: { uid, text, choices } });
const sev = (uid, text, choices) => ({ uid, sys: true, text, choices });
const on = (st, life) => !!(st && st.adult25 && life.age >= 18);
function seedOf(str) { let h = 2166136261; for (const c of String(str)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
const srand = (str) => { const s = { rng: seedOf(str) }; return s; };

export const HTRAITS = {
  gentle: { em: '🌸', name: L('Dịu dàng', 'Gentle'), why: L('Ít ghen, hay chăm sóc người khác', 'Rarely jealous, looks after others') },
  passion: { em: '🔥', name: L('Nồng nhiệt', 'Passionate'), why: L('Đòi được để ý nhiều, Lửa cao', 'Needs attention, lots of spark') },
  scheme: { em: '🦊', name: L('Mưu mô', 'Scheming'), why: L('Hay bày mưu tranh sủng', 'Plots to win your favour') },
  proud: { em: '👑', name: L('Kiêu hãnh', 'Proud'), why: L('Muốn làm người đứng đầu', 'Wants to be at the top') },
  free: { em: '🎨', name: L('Phóng khoáng', 'Free spirit'), why: L('Thích nhiều người, mê tiệc chung', 'Loves company and group fun') },
  loyal: { em: '🕊️', name: L('Trung thành', 'Devoted'), why: L('Chỉ cần bạn, nhưng dễ tổn thương', 'Only wants you, easily hurt') },
};
const TITLES = {
  female: [L('Chính cung', 'First consort'), L('Quý phi', 'Noble consort'), L('Tần', 'Consort'), L('Tân nhân', 'Newcomer')],
  male: [L('Chính phu', 'First consort'), L('Quý quân', 'Noble consort'), L('Thị quân', 'Companion'), L('Tân lang', 'Newcomer')],
};
export const HOUSES = {
  apt: { cap: 3, units: 0, em: '🏢', name: L('Căn hộ', 'Apartment') },
  villa: { cap: 6, units: 800, em: '🏡', name: L('Biệt thự', 'Villa') },
  mansion: { cap: 12, units: 3000, em: '🏰', name: L('Dinh thự', 'Mansion') },
  island: { cap: 99, units: 15000, em: '🏝️', name: L('Đảo riêng', 'Private island') },
};
const HOUSE_ORDER = ['apt', 'villa', 'mansion', 'island'];

export function hstate(life) {
  if (!life.harem) life.harem = { members: [], structure: 'rank', head: null, harmony: 60, house: 'apt', cungdau: true, rel: {}, years: 0, years4: 0, minHarm: 100, coup: false, autoStreak: 0, low: 0, flips: 0, protect: 'each' };
  return life.harem;
}
export const members = (life) => (life.harem ? life.harem.members.map((id) => byId(life, id)).filter((p) => p && p.alive) : []);
export const inHarem = (life, p) => !!(life.harem && life.harem.members.includes(p.id));
export function hm(p) {
  if (!p.hm) { const s = srand(p.id + ':hm'); p.hm = { trait: pick(s, Object.keys(HTRAITS)), rank: 3, favor: 50, mood: 60, last: null, known: false }; }
  return p.hm;
}
export const titleOf = (p) => TITLES[p.gender === 'male' ? 'male' : 'female'][hm(p).rank];
const rk = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
export const relOf = (life, a, b) => (life.harem?.rel[rk(a.id, b.id)] ?? 0);
export function setRel(life, a, b, v) { hstate(life).rel[rk(a.id, b.id)] = clamp(Math.round(v), -100, 100); }
const addRel = (life, a, b, d) => setRel(life, a, b, relOf(life, a, b) + d);
const hrm = (life, d) => { const h = hstate(life); h.harmony = clamp(h.harmony + d); };
const cap = (life) => HOUSES[hstate(life).house].cap;

/** Ai có thể vào hậu cung: người lớn ngoài gia đình đang có quan hệ lãng mạn hoặc có cảm tình với bạn. */
export function candidates(life) {
  return life.people.filter((p) => adultOK(life, p) && !inHarem(life, p) && !p.cut && (ROM.includes(p.role) || p.baby || ['crush', 'like', 'affair', 'heir'].includes(attOf(p))));
}
function consent(life, p) {
  const t = hm(p).trait;
  const b = { free: 0.3, gentle: 0.1, passion: 0.05, scheme: 0.1, proud: -0.15, loyal: -0.2 }[t];
  return agree(life, p, (p.poly ?? 30) / 160 + p.closeness / 350 + (ROM.includes(p.role) ? 0.15 : 0) + (p.baby ? 0.2 : 0) + b, true);
}
function join(life, p) {
  const h = hstate(life);
  const x = hm(p);
  if (!ROM.includes(p.role)) makeLover(life, p);
  p.wasLover = true;
  setFlag(life, 'open_rel');
  for (const q of members(life)) {
    const s = srand(p.id + q.id);
    setRel(life, p, q, randint(s, -20, 30) + (x.trait === 'gentle' || x.trait === 'free' ? 15 : 0) + (x.trait === 'proud' || x.trait === 'scheme' ? -15 : 0));
  }
  h.members.push(p.id);
  x.last = life.age;
  x.rank = h.members.length === 1 ? 0 : 3;
  if (h.members.length === 1) h.head = p.id;
  if (h.members.length > 1) hrm(life, { free: 5, gentle: 2, passion: -2, scheme: -4, proud: -6, loyal: -5 }[x.trait]);
  syncAffair(life);
}
export function leave(life, p, why) {
  const h = hstate(life);
  h.members = h.members.filter((id) => id !== p.id);
  if (h.head === p.id) { const next = members(life).sort((a, b) => hm(a).rank - hm(b).rank || hm(b).favor - hm(a).favor)[0]; h.head = next ? next.id : null; if (next) hm(next).rank = 0; }
  if (p.role === 'lover') endLover(life, p, 30);
  if (why) addLog(life, why, 'bad');
}

// ───────── Hành động trên màn hình Hậu cung ─────────
export function haremActions(life, st) {
  if (!on(st, life)) return [];
  const h = life.harem;
  const n = members(life).length;
  const a = [];
  if (!n) { if (candidates(life).length >= 2) a.push(['start', '👑', L('Lập hậu cung', 'Start a harem')]); return a; }
  a.push(['flip', '🃏', L('Lật thẻ đêm nay', 'Flip a card tonight')]);
  a.push(['auto', '🤖', L('Chăm sóc cả hậu cung (tự động)', 'Care for the whole harem (auto)')]);
  if (n >= 2) a.push(['group', '🔥', L('Đêm nhiều người', 'A night with several')]);
  a.push(['meeting', '🗣️', L('Họp gia đình', 'Family meeting')]);
  a.push(['party', '🎉', L('Tiệc chung', 'Throw a party')]);
  a.push(['vacation', '🏝️', L('Kỳ nghỉ cả nhà', 'Family holiday')]);
  if (candidates(life).length) a.push(['recruit', '➕', L('Tuyển thêm người', 'Recruit someone')]);
  if (h.house !== 'island') a.push(['house', '🏠', L('Nâng cấp nhà', 'Upgrade the house')]);
  a.push(['structure', '⚖️', h.structure === 'rank' ? L('Chuyển sang bình đẳng', 'Switch to equals') : L('Chuyển sang có ngôi thứ', 'Switch to ranks')]);
  return a;
}

export function haremAction(life, st, act, arg) {
  if (!on(st, life)) return null;
  const h = hstate(life);
  const ms = members(life);
  const key = `h:${act}`;
  const n = (life.yearActs[key] = (life.yearActs[key] || 0) + 1);
  const tired = res(L('Năm nay như vậy là đủ rồi.', "That's enough for this year."), []);
  switch (act) {
    case 'start': {
      const cs = candidates(life);
      const ok = []; const no = [];
      for (const p of cs) (chance(life, consent(life, p)) ? ok : no).push(p);
      if (ok.length < 2) { for (const p of no) p.closeness = clamp(p.closeness - 4); return res(L(`Bạn ngỏ ý sống chung nhiều người. Chỉ ${ok.length} người đồng ý, chưa đủ để lập hậu cung.`, `You suggest living together as a group. Only ${ok.length} agree, not enough for a harem.`), [], 'bad'); }
      const pt = partner(life);
      if (pt && ok.includes(pt)) { ok.splice(ok.indexOf(pt), 1); ok.unshift(pt); }
      for (const p of ok.slice(0, cap(life) + 2)) join(life, p);
      for (const p of no) { p.closeness = clamp(p.closeness - 10); if (ROM.includes(p.role) && p.role === 'lover') endLover(life, p); }
      addLog(life, L(`Hậu cung ra đời với ${ok.length} người.`, `Your harem begins with ${ok.length} people.`), 'good');
      return res(L(`${ok.map((p) => nm(life, p)).join(', ')} đồng ý về chung một nhà.${no.length ? ` ${no.map((p) => nm(life, p)).join(', ')} từ chối và rời đi.` : ''}`, `${ok.map((p) => nm(life, p)).join(', ')} agree to share one home.${no.length ? ` ${no.map((p) => nm(life, p)).join(', ')} refuse and walk away.` : ''}`), fx(life, { happy: 10 }), 'good');
    }
    case 'flip': {
      if (h.flips >= 4) return tired;
      const sorted = ms.slice().sort((a, b) => hm(b).favor - hm(a).favor).slice(0, 8);
      const choices = sorted.map((p) => ({ label: L(`${hm(p).known ? HTRAITS[hm(p).trait].em + ' ' : ''}${titleOf(p).vi} · ${nm(life, p)} · sủng ${Math.round(hm(p).favor)}`, `${hm(p).known ? HTRAITS[hm(p).trait].em + ' ' : ''}${titleOf(p).en} · ${nm(life, p)} · favour ${Math.round(hm(p).favor)}`), outcomes: [nightWith(life, st, p)] }));
      if (ms.length >= 2) {
        const pairs = [];
        for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) pairs.push([ms[i], ms[j]]);
        const [a, b] = pairs.sort((x, y) => relOf(life, y[0], y[1]) - relOf(life, x[0], x[1]))[0];
        const good = relOf(life, a, b) > 20;
        choices.push({ label: L(`🂠 Đêm hai người: ${nm(life, a)} và ${nm(life, b)}`, `🂠 Two at once: ${nm(life, a)} and ${nm(life, b)}`), outcomes: [good
          ? oc(L(`${nm(life, a)} và ${nm(life, b)} vốn thân nhau. Đêm đó cả ba cười đùa đến khuya, rèm đóng kín.`, `${nm(life, a)} and ${nm(life, b)} were already close. The three of you laugh late into the night, curtains drawn.`), { happy: 10 }, (lf) => { h.flips++; for (const p of [a, b]) bless(lf, p, 7); addRel(lf, a, b, 10); hrm(lf, 3); })
          : oc(L(`${nm(life, a)} và ${nm(life, b)} không ưa nhau. Đêm đó biến thành một cuộc cãi vã về chỗ nằm.`, `${nm(life, a)} and ${nm(life, b)} can't stand each other. The night turns into an argument over who sleeps where.`), { happy: -4 }, (lf) => { h.flips++; addRel(lf, a, b, -10); hrm(lf, -5); })] });
      }
      choices.push({ label: L('Đêm nay ngủ một mình', 'Sleep alone tonight'), outcomes: [oc(L('Bạn ôm gối ngủ một mình. Yên tĩnh lạ thường.', 'You sleep alone, hugging a pillow. Strangely peaceful.'))] });
      return modal('h/flip', L(`Lật thẻ (${h.flips}/4 lượt năm nay). Đêm nay chọn ai?`, `Flip a card (${h.flips}/4 this year). Who tonight?`), choices);
    }
    case 'group': {
      if (n > 1) return tired;
      const top3 = ms.slice().sort((a, b) => hm(b).favor - hm(a).favor).slice(0, 3);
      const frees = ms.filter((p) => ['free', 'passion'].includes(hm(p).trait));
      const opts = [[L('Cả nhà', 'Everyone'), ms], [L('Ba người được sủng nhất', 'Your three favourites'), top3]];
      if (frees.length >= 2) opts.push([L('Những người phóng khoáng và nồng nhiệt', 'The free spirits and the passionate ones'), frees]);
      return modal('h/group', L('Một đêm nhiều người. Rủ ai? Mỗi người sẽ tự quyết có tham gia không.', 'A night with several. Who do you invite? Each person decides for themselves.'), opts.map(([lb, list]) => ({ label: L(`${lb.vi} (${list.length})`, `${lb.en} (${list.length})`), outcomes: [oc('', {}, null, (lf) => protectStep(lf, (prot) => ({ uid: 'h/group_go', text: L('Mọi người đã sẵn sàng.', 'Everyone is ready.'), choices: [{ label: L('Bắt đầu', 'Begin'), outcomes: [groupNight(lf, st, list, prot)] }] })))] })).concat([{ label: L('Thôi', 'Never mind'), outcomes: [oc(L('Bạn đổi ý.', 'You change your mind.'))] }]));
    }
    case 'auto': {
      if (n > 1) return tired;
      const mode = (m, lb) => ({ label: lb, outcomes: [oc('', {}, null, (lf) => protectStep(lf, (prot) => ({ uid: 'h/auto_done', text: L('Game sẽ lo hết cho cả năm.', 'The game takes care of the whole year.'), choices: [{ label: L('Xem tổng kết', 'See the summary'), outcomes: [autoCare(lf, st, m, prot)] }] }), true))] });
      return modal('h/auto', L('Chăm sóc cả hậu cung trong năm nay theo kiểu nào?', 'How will you care for the whole harem this year?'), [
        mode('rotate', L('Luân phiên: mỗi người một đêm', 'Rotation: one night each')),
        mode('favor', L('Theo Sủng ái: người được sủng nhận nhiều hơn', 'By favour: favourites get more')),
        mode('all', L('Cả nhà một lần', 'Everyone at once')),
      ]);
    }
    case 'meeting': {
      if (n > 1) return tired;
      const traits = ms.map((p) => hm(p).trait);
      const cnt = (t) => traits.filter((x) => x === t).length;
      return modal('h/meeting', L(`Họp gia đình ${ms.length} người quanh bàn ăn. Bạn làm gì?`, `A family meeting, ${ms.length} people round the table. What do you do?`), [
        { label: L('Lắng nghe từng người', 'Listen to everyone'), outcomes: [oc(L('Ai cũng được nói. Cuộc họp kéo dài ba tiếng nhưng không khí nhẹ hẳn.', 'Everyone gets heard. Three hours long, but the mood lifts.'), { happy: 3 }, (lf) => { hrm(lf, 6 + cnt('loyal') * 2 + cnt('gentle')); for (const p of ms) hm(p).mood = clamp(hm(p).mood + 6); })] },
        { label: L('Ra luật chung', 'Lay down house rules'), outcomes: [oc(L('Một bảng nội quy dán trên tủ lạnh. Có người gật gù, có người nhếch mép.', 'A list of house rules on the fridge. Some nod, some smirk.'), {}, (lf) => { hrm(lf, 4 + cnt('gentle') * 2 - cnt('proud') * 3 - cnt('scheme') * 2); })] },
        { label: L('Tặng quà đồng loạt', 'Gifts for everyone'), outcomes: [oc(L('Mỗi người một hộp quà giống hệt nhau. Không ai có cớ để ghen.', 'Identical gift boxes for all. Nobody has a reason to be jealous.'), { money: -10 * ms.length, happy: 2 }, (lf) => { hrm(lf, 8); for (const p of ms) hm(p).mood = clamp(hm(p).mood + 8); })] },
      ]);
    }
    case 'party': {
      if (n > 1) return tired;
      hrm(life, 8);
      for (const p of ms) { hm(p).mood = clamp(hm(p).mood + 6); for (const q of ms) if (p !== q && p.id < q.id) addRel(life, p, q, 5); }
      return res(L('Nhạc, rượu và một chiếc bánh khổng lồ. Cả nhà nhảy đến sáng.', 'Music, wine and a giant cake. The whole house dances till dawn.'), fx(life, { happy: 8, money: -5 * ms.length }), 'good');
    }
    case 'vacation': {
      if (n > 1) return tired;
      const trip = (lb, units, hap, text, extra) => ({ label: lb, outcomes: [oc(text, { money: -units * ms.length, happy: hap }, (lf) => { hrm(lf, 12); for (const p of ms) { hm(p).mood = clamp(hm(p).mood + 10); prof(p).fire = clamp(prof(p).fire + 8); } if (extra) extra(lf); })] });
      const opts = [
        trip(L('Onsen tắm chung', 'A mixed onsen'), 6, 10, L('Hơi nước mờ mịt, cả nhà ngâm mình dưới trời tuyết. Không ai muốn về.', 'Steam rising, the whole family soaking under falling snow. Nobody wants to leave.')),
        trip(L('Resort khỏa thân', 'A naturist resort'), 10, 12, L('Một tuần không mảnh vải. Ngượng đúng một buổi sáng, sau đó thì tự do tuyệt đối.', 'A week without a stitch. Awkward for exactly one morning, then pure freedom.')),
      ];
      if (me(life).yacht) opts.push(trip(L('Du thuyền riêng', 'Your yacht'), 4, 14, L('Ra khơi cả nhà. Ngoài biển xa, không ai biết chuyện gì xảy ra.', 'Out at sea as a family. Far from shore, nobody knows what happens.')));
      opts.push({ label: L('Thôi', 'Never mind'), outcomes: [oc(L('Cả nhà ở nhà xem phim.', 'Movie night at home instead.'))] });
      return modal('h/vacation', L('Đưa cả nhà đi đâu?', 'Where will you take the family?'), opts);
    }
    case 'recruit': {
      const cs = candidates(life).slice(0, 6);
      if (!cs.length) return res(L('Chưa có ai phù hợp để mời vào.', 'Nobody suitable to invite yet.'), []);
      if (ms.length >= cap(life)) return res(L(`Nhà đã đủ ${cap(life)} người. Hãy nâng cấp nhà trước.`, `The house is full at ${cap(life)}. Upgrade first.`), [], 'bad');
      return modal('h/recruit', L('Mời ai vào hậu cung?', 'Who will you invite into the harem?'), cs.map((p) => {
        const c = consent(life, p);
        return { label: L(`${nm(life, p)} · ${p.age} tuổi`, `${nm(life, p)} · ${p.age}`), outcomes: [
          oc(L(`${nm(life, p)} đồng ý dọn về. Buổi ra mắt cả nhà diễn ra căng thẳng nhưng êm đẹp.`, `${nm(life, p)} agrees to move in. The family introduction is tense but goes fine.`), { happy: 6 }, (lf) => join(lf, p), null, c),
          oc(L(`${nm(life, p)} từ chối: "Mình không chia sẻ được."`, `${nm(life, p)} declines: "I can't share."`), {}, () => { p.closeness = clamp(p.closeness - 6); }, null, 1 - c),
        ] };
      }).concat([{ label: L('Thôi', 'Never mind'), outcomes: [oc(L('Bạn đổi ý.', 'You change your mind.'))] }]));
    }
    case 'house': {
      const i = HOUSE_ORDER.indexOf(h.house);
      const nx = HOUSE_ORDER[i + 1];
      if (!nx) return res(L('Bạn đã có đảo riêng.', 'You already own an island.'), []);
      const H = HOUSES[nx];
      if (life.money < u(life, H.units)) return res(L(`Cần ${H.units}% thu nhập trung bình để chuyển lên ${H.name.vi.toLowerCase()}.`, `You need ${H.units}% of average income to move up to a ${H.name.en.toLowerCase()}.`), [], 'bad');
      life.money -= u(life, H.units);
      h.house = nx;
      hrm(life, 10);
      addLog(life, L(`Hậu cung chuyển đến ${H.name.vi.toLowerCase()} (sức chứa ${H.cap === 99 ? 'không giới hạn' : H.cap}).`, `The harem moves into a ${H.name.en.toLowerCase()} (room for ${H.cap === 99 ? 'everyone' : H.cap}).`), 'good');
      return res(L(`${H.em} Mỗi người một phòng riêng. Tiếng cãi nhau giảm hẳn.`, `${H.em} A room each. The arguing drops right off.`), [['money', -u(life, H.units)]], 'good');
    }
    case 'structure': {
      h.structure = h.structure === 'rank' ? 'equal' : 'rank';
      for (const p of ms) { const t = hm(p).trait; if (h.structure === 'equal') { if (t === 'proud') hm(p).mood = clamp(hm(p).mood - 15); else hm(p).mood = clamp(hm(p).mood + 5); } }
      hrm(life, h.structure === 'equal' ? 4 : -2);
      return res(h.structure === 'equal' ? L('Từ nay mọi người ngang hàng. Người kiêu hãnh nhất nhà không vui.', 'Everyone is equal from now on. The proudest one is not pleased.') : L('Ngôi thứ được lập lại. Ai cũng bắt đầu tính toán.', 'Ranks are back. Everyone starts calculating.'), []);
    }
    case 'reconcile': {
      const [a, b] = String(arg || '').split(',').map((id) => byId(life, id));
      if (!a || !b) return null;
      if (n > 2) return tired;
      if (chance(life, 0.6)) { addRel(life, a, b, 25); hrm(life, 3); return res(L(`Bạn đưa ${nm(life, a)} và ${nm(life, b)} đi ăn tối riêng. Họ bắt tay làm hòa.`, `You take ${nm(life, a)} and ${nm(life, b)} out to dinner. They make peace.`), fx(life, { money: -3 }), 'good'); }
      addRel(life, a, b, -5);
      return res(L(`Bữa tối hòa giải biến thành trận đấu khẩu thứ hai.`, `The peace dinner turns into round two.`), fx(life, { money: -3, happy: -2 }), 'bad');
    }
  }
  return null;
}

function protectStep(life, then, eachOk = true) {
  const opt = (lb, v) => ({ label: lb, outcomes: [oc('', {}, null, () => then(v))] });
  return { uid: 'h/protect', text: L('Biện pháp?', 'Protection?'), choices: [opt(L('Luôn dùng', 'Always'), 'always'), opt(L('Không dùng', 'Never'), 'never')].concat(eachOk ? [opt(L('Để từng người tự chọn', 'Let each person choose'), 'each')] : []) };
}
const protFor = (life, p, prot) => (prot === 'always' ? true : prot === 'never' ? false : seedOf(p.id) % 3 !== 0);

/** Một đêm riêng với p: tăng thân thiết, sủng ái; những người khác hơi tụt sủng. */
function bless(life, p, d) {
  const x = hm(p);
  x.favor = clamp(x.favor + d); x.mood = clamp(x.mood + d); x.last = life.age;
  p.closeness = clamp(p.closeness + Math.round(d * 0.8));
  prof(p).fire = clamp(prof(p).fire + Math.round(d / 2));
}
function nightWith(life, st, p) {
  const x = hm(p);
  const extra = { passion: 4, loyal: 3, gentle: 2, free: 1, scheme: 2, proud: 1 }[x.trait];
  return oc(L(`${titleOf(p).vi} ${nm(life, p)} được chọn. ${x.trait === 'passion' ? 'Một đêm nồng cháy, sáng ra ai cũng đoán được.' : x.trait === 'loyal' ? 'Họ ôm bạn thật lâu, như sợ bạn biến mất.' : x.trait === 'scheme' ? 'Sáng hôm sau họ kể với cả nhà, không sót chi tiết nào.' : 'Đêm đó yên ả và ngọt ngào.'}`, `${titleOf(p).en} ${nm(life, p)} is chosen. ${x.trait === 'passion' ? 'A fiery night. By morning, everyone can tell.' : x.trait === 'loyal' ? 'They hold you a long time, as if afraid you\'ll vanish.' : x.trait === 'scheme' ? 'Next morning they tell the whole house, every detail.' : 'A calm, sweet night.'}`), { happy: 6 + extra }, (lf) => {
    const h = hstate(lf);
    h.flips++;
    bless(lf, p, 8 + extra);
    for (const q of members(lf)) if (q !== p) { hm(q).favor = clamp(hm(q).favor - 2); if (x.trait === 'scheme') addRel(lf, p, q, -4); }
    setFlag(lf, 'recent_intimate');
    tryConceive(lf, p, protectChance(protFor(lf, p, h.protect)));
  });
}

/** Mục 55 · Đêm nhiều người. Mỗi người tự quyết; ai từ chối thì không tham gia. */
export function groupNight(life, st, list, prot) {
  const ms = members(life);
  const yes = list.filter((p) => {
    const t = hm(p).trait;
    const b = { free: 0.35, passion: 0.15, gentle: 0.05, scheme: 0.1, loyal: -0.15, proud: hm(p).rank === 0 ? 0.05 : -0.4 }[t];
    return chance(life, agree(life, p, (p.poly ?? 30) / 140 + hstate(life).harmony / 300 + b, true));
  });
  const no = list.filter((p) => !yes.includes(p));
  if (yes.length < 2) return oc(L(`Chỉ ${yes.length} người đồng ý. Đêm nay thành một buổi xem phim cả nhà.`, `Only ${yes.length} said yes. It turns into a family movie night.`), { happy: 1 });
  const stamina = (life.stats.health + me(life).flex) / 2;
  const tooMany = yes.length * 14 > stamina + 30;
  const center = yes.find((p) => hm(p).trait === 'passion');
  const loyalOne = yes.find((p) => hm(p).trait === 'loyal');
  const names = yes.map((p) => nm(life, p)).join(', ');
  const run = (lf) => {
    for (const p of yes) { bless(lf, p, 5); hm(p).last = lf.age; tryConceive(lf, p, protectChance(protFor(lf, p, prot))); }
    for (let i = 0; i < yes.length; i++) for (let j = i + 1; j < yes.length; j++) addRel(lf, yes[i], yes[j], 8);
    for (const p of ms.filter((q) => !list.includes(q))) { hm(p).favor = clamp(hm(p).favor - 5); hm(p).mood = clamp(hm(p).mood - 6); }
    hrm(lf, 2 + yes.length * 2 - no.length);
    me(lf).groups++;
    setFlag(lf, 'recent_intimate');
    if (tooMany) lf.stats.health = clamp(lf.stats.health - Math.ceil(yes.length / 2));
    if (center && chance(lf, 0.3)) { hm(center).mood = clamp(hm(center).mood - 12); addLog(lf, L(`${nm(lf, center)} dỗi vì không được làm trung tâm.`, `${nm(lf, center)} sulks for not being the centre of attention.`)); }
  };
  const text = tooMany
    ? L(`${names} cùng tham gia. Đến nửa đêm bạn là người đầu tiên "đuối", cả nhóm cười ầm và kéo chăn đắp cho bạn.`, `${names} join in. By midnight you're the first to flag; the group laughs and tucks you in.`)
    : L(`${names} cùng tham gia. Phòng ngủ lớn ồn ào đến khuya, sáng ra cả nhà ngủ nướng đến trưa.`, `${names} join in. The big bedroom stays loud late into the night; the whole house sleeps till noon.`);
  const after = (lf) => ({ uid: 'h/after', text: L('Sau đó?', 'Afterwards?'), choices: [
    { label: L('Ôm cả nhóm', 'Hold everyone close'), outcomes: [oc(L('Một đống chăn gối, tay chân và tiếng cười khúc khích.', 'A heap of pillows, limbs and giggles.'), { happy: 2 }, (x) => { hrm(x, 3); me(x).care++; })] },
    ...(loyalOne ? [{ label: L(`Dỗ riêng ${nm(lf, loyalOne)}`, `Comfort ${nm(lf, loyalOne)} privately`), outcomes: [oc(L(`${nm(lf, loyalOne)} thì thầm: "Cảm ơn vì vẫn nhớ đến mình."`, `${nm(lf, loyalOne)} whispers: "Thank you for still seeing me."`), { happy: 2 }, () => { bless(lf, loyalOne, 6); me(lf).care++; })] }] : []),
    { label: L('Ngủ luôn', 'Fall asleep'), outcomes: [oc(L('Bạn ngủ say giữa đám đông.', 'You fall fast asleep in the crowd.'), {}, () => { if (loyalOne) hm(loyalOne).mood = clamp(hm(loyalOne).mood - 8); })] },
  ] });
  return oc(L(text.vi + (no.length ? ` (${no.map((p) => nm(life, p)).join(', ')} từ chối, không tham gia.)` : ''), text.en + (no.length ? ` (${no.map((p) => nm(life, p)).join(', ')} said no and sat it out.)` : '')), { happy: 8 + yes.length }, run, after);
}

/** Mục 56 · Chăm sóc cả hậu cung tự động. Trả về một outcome có thẻ tổng kết. */
export function autoCare(life, st, mode, prot) {
  const h = hstate(life);
  const ms = members(life);
  const skip = ms.filter((p) => hm(p).mood < 25 || p.closeness < 20);
  const ok = ms.filter((p) => !skip.includes(p));
  const before = { harmony: h.harmony, health: life.stats.health, preg: !!life.pregnancy };
  let picked = ok;
  if (mode === 'favor') picked = ok.slice().sort((a, b) => hm(b).favor - hm(a).favor);
  if (mode === 'all' && ok.length >= 2) {
    const g = groupNight(life, st, ok, prot);
    g.run && g.run(life);
  } else {
    picked.forEach((p, i) => { const d = mode === 'favor' ? Math.max(2, 9 - i * 2) : 5; bless(life, p, d); tryConceive(life, p, protectChance(protFor(life, p, prot))); });
  }
  h.autoStreak = (h.autoStreak || 0) + 1;
  if (h.autoStreak >= 3) for (const p of ms) prof(p).fire = clamp(prof(p).fire - 5);
  life.stats.health = clamp(life.stats.health - Math.ceil(ok.length / 3));
  hrm(life, 3 + Math.min(ok.length, 6) - skip.length * 2);
  setFlag(life, 'recent_intimate');
  life.fuMany = ok.length; // mỗi người được chăm sóc kéo theo một sự kiện 25+
  const dh = Math.round(h.harmony - before.harmony);
  const dhe = Math.round(life.stats.health - before.health);
  const preg = !before.preg && life.pregnancy ? 1 : 0;
  const complain = h.autoStreak >= 3 && ok.length ? pick(life, ok) : null;
  if (complain) addLog(life, L(`${nm(life, complain)} phàn nàn: "Năm nay chẳng có gì đặc biệt cả."`, `${nm(life, complain)} complains: "Nothing special this year."`));
  const sk = skip.length ? L(` ${skip.map((p) => nm(life, p)).join(', ')} đang giận, đã bỏ qua.`, ` ${skip.map((p) => nm(life, p)).join(', ')} ${skip.length > 1 ? 'are' : 'is'} upset, skipped.`) : L('', '');
  return oc(L(`Năm nay bạn dành thời gian cho ${ok.length}/${ms.length} người.${sk.vi}\nHòa hợp ${dh >= 0 ? '+' : ''}${dh} · Có tin vui: ${preg} · Sức khỏe ${dhe}.${h.autoStreak >= 3 ? '\nDùng tự động nhiều năm liền khiến Lửa giảm dần.' : ''}`, `This year you spent time with ${ok.length}/${ms.length}.${sk.en}\nHarmony ${dh >= 0 ? '+' : ''}${dh} · Pregnancies: ${preg} · Health ${dhe}.${h.autoStreak >= 3 ? '\nUsing auto for years in a row is cooling the spark.' : ''}`), { happy: 4 });
}

// ───────── Hành động với từng thành viên ─────────
export function memberActions(life, p, st) {
  if (!on(st, life) || !adultOK(life, p)) return [];
  if (!inHarem(life, p)) return life.harem && members(life).length && candidates(life).includes(p) ? [['toharem', L('Mời vào hậu cung', 'Invite into the harem')]] : [];
  const a = [];
  if (hstate(life).structure === 'rank') { if (hm(p).rank > 0) a.push(['h_promote', L('Thăng ngôi', 'Promote')]); if (hm(p).rank < 3) a.push(['h_demote', L('Giáng ngôi', 'Demote')]); }
  a.push(['h_favor', L('Sủng ái riêng', 'Lavish favour')]);
  a.push(['h_investigate', L('Điều tra tin đồn về người này', 'Investigate rumours about them')]);
  a.push(['h_release', L('Cho rời hậu cung', 'Release from the harem')]);
  return a;
}
export function doMemberAction(life, st, p, act, n) {
  const name = nm(life, p);
  const tired = res(L('Năm nay như vậy là đủ rồi.', "That's enough for this year."), []);
  const ms = members(life);
  switch (act) {
    case 'toharem': {
      if (n > 1) return tired;
      if (ms.length >= cap(life)) return res(L(`Nhà đã đủ ${cap(life)} người.`, `The house is full at ${cap(life)}.`), [], 'bad');
      if (chance(life, consent(life, p))) { join(life, p); return res(L(`${name} đồng ý dọn về hậu cung.`, `${name} agrees to join the harem.`), fx(life, { happy: 6 }), 'good'); }
      p.closeness = clamp(p.closeness - 6);
      return res(L(`${name} từ chối: "Mình không chia sẻ được."`, `${name} declines: "I can't share."`), [], 'bad');
    }
    case 'h_promote': {
      const x = hm(p);
      if (x.rank === 1) { const head = byId(life, hstate(life).head); if (head && head !== p) { hm(head).rank = 1; hm(head).mood = clamp(hm(head).mood - 25); addRel(life, p, head, -30); } hstate(life).head = p.id; }
      x.rank = Math.max(0, x.rank - 1); x.favor = clamp(x.favor + 10); x.mood = clamp(x.mood + 15);
      for (const q of ms) if (q !== p && hm(q).trait === 'proud') addRel(life, p, q, -10);
      return res(L(`${name} được thăng làm ${titleOf(p).vi}.`, `${name} is promoted to ${titleOf(p).en}.`), fx(life, { happy: 2 }), 'good');
    }
    case 'h_demote': {
      const x = hm(p);
      if (x.rank === 0) { const next = ms.filter((q) => q !== p).sort((a, b) => hm(b).favor - hm(a).favor)[0]; if (next) { hm(next).rank = 0; hstate(life).head = next.id; } }
      x.rank = Math.min(3, x.rank + 1); x.mood = clamp(x.mood - 20); x.favor = clamp(x.favor - 10);
      if (x.trait === 'proud' && chance(life, 0.4)) { leave(life, p); return res(L(`${name} không chịu nhục, thu dọn đồ và rời đi ngay trong đêm.`, `${name} won't stand the humiliation and leaves that same night.`), fx(life, { happy: -6 }), 'bad'); }
      if (x.trait === 'scheme') life.queue.push({ sys: 'h_plot', kind: 'faction', by: p.id });
      return res(L(`${name} bị giáng xuống ${titleOf(p).vi}. Ánh mắt họ tối lại.`, `${name} is demoted to ${titleOf(p).en}. Their eyes darken.`), [], 'bad');
    }
    case 'h_favor': {
      if (n > 2) return tired;
      bless(life, p, 15);
      for (const q of ms) if (q !== p) hm(q).favor = clamp(hm(q).favor - 3);
      return res(L(`Bạn dành cả ngày cho riêng ${name}. Cả nhà nhìn theo.`, `You spend the whole day with ${name} alone. The whole house notices.`), fx(life, { happy: 5 }), 'good');
    }
    case 'h_investigate': {
      if (n > 1) return tired;
      life.money -= u(life, 5);
      hm(p).known = true;
      const r = hstate(life).rumor;
      if (r && r.target === p.id) {
        const by = byId(life, r.by);
        hstate(life).rumor = null;
        if (r.truth) { p.closeness = clamp(p.closeness - 15); return res(L(`Thám tử xác nhận: tin đồn về ${name} là thật.`, `The investigator confirms it: the rumour about ${name} is true.`), [['money', -u(life, 5)]], 'bad'); }
        if (by) { hm(by).favor = clamp(hm(by).favor - 20); addRel(life, p, by, -30); }
        return res(L(`Tin đồn là bịa đặt, do ${by ? nm(life, by) : 'ai đó'} tung ra.`, `The rumour was invented, spread by ${by ? nm(life, by) : 'someone'}.`), [['money', -u(life, 5)]], 'good');
      }
      return res(L(`Không có gì đáng ngờ. Bạn còn biết thêm tính cách thật của ${name}: ${HTRAITS[hm(p).trait].name.vi.toLowerCase()}.`, `Nothing suspicious. You also learn ${name}'s true nature: ${HTRAITS[hm(p).trait].name.en.toLowerCase()}.`), [['money', -u(life, 5)]]);
    }
    case 'h_release': {
      leave(life, p);
      hrm(life, hm(p).trait === 'scheme' ? 6 : -4);
      return res(L(`${name} rời hậu cung.`, `${name} leaves the harem.`), fx(life, { happy: -3 }));
    }
  }
  return null;
}

// ───────── Hằng năm ─────────
export function haremYear(life, st) {
  const h = life.harem;
  if (!h) return;
  h.flips = 0;
  const ms = members(life);
  h.members = ms.map((p) => p.id);
  if (!ms.length) return;
  if (!on(st, life)) return;
  h.years++;
  if (ms.length >= 4) h.years4++;
  const contrib = ms.reduce((s, p) => s + (p.income || 0) * 0.3, 0);
  life.money += contrib - u(life, 15 * ms.length);
  if (ms.length > cap(life)) hrm(life, -10);
  const mean = ms.reduce((s, p) => s + hm(p).favor, 0) / ms.length;
  if (mean > 60) for (const p of ms) hm(p).favor = clamp(hm(p).favor * (60 / mean));
  for (const p of ms) {
    const x = hm(p);
    x.mood = clamp(x.mood + Math.round((x.favor - 50) / 10) + randint(life, -3, 3));
    if (x.last == null) x.last = life.age;
    if (life.age - x.last >= 3) {
      x.mood = clamp(x.mood - 15);
      if (chance(life, 0.25)) { leave(life, p, L(`${nm(life, p)} bị bỏ quên quá lâu và lặng lẽ rời hậu cung.`, `${nm(life, p)}, neglected for too long, quietly leaves the harem.`)); continue; }
      if (chance(life, 0.2)) addLog(life, L(`Có tin ${nm(life, p)} lén gặp người khác bên ngoài.`, `Word is ${nm(life, p)} is secretly seeing someone outside.`), 'bad');
    }
  }
  const left = members(life);
  if (!left.length) return;
  const avgMood = left.reduce((s, p) => s + hm(p).mood, 0) / left.length;
  let relSum = 0; let relN = 0;
  for (let i = 0; i < left.length; i++) for (let j = i + 1; j < left.length; j++) { relSum += relOf(life, left[i], left[j]); relN++; }
  const target = clamp(avgMood * 0.6 + (relN ? relSum / relN : 0) * 0.3 + (h.structure === 'equal' ? 8 : 0) + 15);
  h.harmony = clamp(Math.round(h.harmony + (target - h.harmony) * 0.25));
  h.minHarm = Math.min(h.minHarm, h.harmony);
  if (h.harmony < 10) h.low++; else h.low = 0;
  if (h.low >= 2) { life.queue.push({ sys: 'h_collapse' }); return; }
  if (h.cungdau && left.length >= 3 && chance(life, 0.35)) {
    const schemers = left.filter((p) => ['scheme', 'proud', 'passion'].includes(hm(p).trait));
    const by = schemers.length ? pick(life, schemers) : pick(life, left);
    const others = left.filter((p) => p !== by);
    const kinds = ['rumor', 'sabotage', 'faction', 'bribe'];
    if (left.filter((p) => life.people.some((k) => k.role === 'child' && k.otherParentId === p.id)).length >= 2) kinds.push('heir');
    if (h.harmony < 20 && hm(by).trait === 'scheme' && hm(by).favor >= 70) kinds.push('coup', 'coup');
    life.queue.push({ sys: 'h_plot', kind: pick(life, kinds), by: by.id, target: pick(life, others).id, r: rand(life) });
  }
}

export function buildHaremSys(life, item, st) {
  if (item.sys === 'h_collapse') {
    if (!members(life).length) return null;
    return sev('sys/h_collapse', L('Hòa hợp chạm đáy hai năm liền. Từng người một thu dọn đồ đạc.', 'Harmony has hit rock bottom two years running. One by one, they pack their bags.'), [
      { label: L('Để họ đi', 'Let them go'), outcomes: [oc(L('Ngôi nhà lớn bỗng im lặng đến đáng sợ.', 'The big house falls eerily silent.'), { happy: -15 }, (lf) => { for (const p of members(lf)) leave(lf, p); lf.counts.haremFell = (lf.counts.haremFell || 0) + 1; })] },
      { label: L('Quỳ xuống xin mọi người ở lại', 'Beg them to stay'), outcomes: [
        oc(L('Một nửa ở lại. Một nửa đi.', 'Half stay. Half go.'), { happy: -6 }, (lf) => { const ms = members(lf); ms.slice(Math.ceil(ms.length / 2)).forEach((p) => leave(lf, p)); hstate(lf).harmony = 35; hstate(lf).low = 0; }, null, 0.6),
        oc(L('Không ai quay đầu lại.', 'Nobody looks back.'), { happy: -15 }, (lf) => { for (const p of members(lf)) leave(lf, p); }, null, 0.4),
      ] },
    ]);
  }
  if (item.sys !== 'h_plot') return null;
  const by = byId(life, item.by); const tg = byId(life, item.target);
  if (!by || !inHarem(life, by)) return null;
  const a = nm(life, by); const b = tg ? nm(life, tg) : '';
  const head = byId(life, hstate(life).head);
  switch (item.kind) {
    case 'rumor': {
      if (!tg || !inHarem(life, tg)) return null;
      const truth = item.r < 0.35;
      return sev('sys/h_rumor', L(`${a} thì thầm với bạn: "${b} lén gặp người khác đấy."`, `${a} whispers: "${b} is secretly seeing someone."`), [
        { label: L('Điều tra (thuê thám tử)', 'Investigate (hire a detective)'), outcomes: [oc(truth ? L(`Thám tử xác nhận: ${b} có người bên ngoài.`, `The detective confirms: ${b} has someone outside.`) : L(`Tin đồn là bịa. ${a} bị lật tẩy trước cả nhà.`, `It was a lie. ${a} is exposed in front of everyone.`), { money: -5 }, (lf) => { if (truth) { tg.closeness = clamp(tg.closeness - 15); hm(tg).favor = clamp(hm(tg).favor - 10); } else { hm(by).favor = clamp(hm(by).favor - 20); addRel(lf, by, tg, -30); } })] },
        { label: L(`Tin ngay, lạnh nhạt với ${b}`, `Believe it, freeze ${b} out`), outcomes: [oc(truth ? L('Bạn đoán đúng.', 'Your instincts were right.') : L(`Về sau bạn mới biết ${b} vô tội. Cả nhà mất niềm tin vào bạn.`, `You later learn ${b} was innocent. The house loses faith in you.`), {}, (lf) => { hm(tg).favor = clamp(hm(tg).favor - 20); hm(tg).mood = clamp(hm(tg).mood - 20); hm(by).favor = clamp(hm(by).favor + 8); if (!truth) hrm(lf, -10); })] },
        { label: L('Gạt đi', 'Brush it off'), outcomes: [oc(L(`${a} bĩu môi, không vui.`, `${a} pouts, unhappy.`), {}, () => { hm(by).mood = clamp(hm(by).mood - 8); hstate(life).rumor = { target: tg.id, by: by.id, truth }; })] },
      ]);
    }
    case 'sabotage': {
      if (!tg || !inHarem(life, tg)) return null;
      return sev('sys/h_sabotage', L(`Đúng đêm bạn định ở với ${b}, ${a} đột nhiên "ốm nặng".`, `On the night you planned with ${b}, ${a} suddenly falls "very ill".`), [
        { label: L(`Ở lại chăm ${a}`, `Stay and nurse ${a}`), outcomes: [oc(L(`${a} khỏi bệnh thần kỳ ngay khi bạn ngồi xuống. ${b} đợi cả đêm.`, `${a} makes a miraculous recovery the moment you sit down. ${b} waits all night.`), {}, () => { hm(by).favor = clamp(hm(by).favor + 8); hm(tg).mood = clamp(hm(tg).mood - 15); addRel(life, by, tg, -15); })] },
        { label: L(`Vẫn đến với ${b}`, `Go to ${b} anyway`), outcomes: [oc(L(`${a} làm ầm cả nhà, nhưng ${b} cảm động vì bạn giữ lời.`, `${a} makes a scene, but ${b} is touched you kept your word.`), {}, (lf) => { bless(lf, tg, 8); hm(by).mood = clamp(hm(by).mood - 12); hrm(lf, -3); })] },
        { label: L('Vạch trần trò diễn', 'Call out the act'), outcomes: [oc(L(`${a} đỏ mặt, cả nhà bật cười.`, `${a} turns red; the house laughs.`), {}, () => { hm(by).favor = clamp(hm(by).favor - 15); hm(by).known = true; })] },
      ]);
    }
    case 'faction': {
      const ally = tg && inHarem(life, tg) ? tg : null;
      const victim = head && head !== by && head !== ally ? head : null;
      return sev('sys/h_faction', L(`${a}${ally ? ` và ${b}` : ''} lập phe${victim ? ` chống lại ${titleOf(victim).vi} ${nm(life, victim)}` : ''}. Bữa cơm chia làm hai bàn.`, `${a}${ally ? ` and ${b}` : ''} form a faction${victim ? ` against ${titleOf(victim).en} ${nm(life, victim)}` : ''}. Dinner splits into two tables.`), [
        { label: L('Dẹp phe phái', 'Break up the faction'), outcomes: [oc(L('Bạn nói thẳng: trong nhà này không có phe nào cả.', 'You make it plain: there are no factions in this house.'), { willpower: 2 }, (lf) => { hrm(lf, -4); hm(by).favor = clamp(hm(by).favor - 10); if (ally) hm(ally).favor = clamp(hm(ally).favor - 6); })] },
        { label: L('Đứng về phe họ', 'Side with them'), outcomes: [oc(L('Phe kia lép vế hẳn.', 'The other side is left out in the cold.'), {}, (lf) => { hm(by).favor = clamp(hm(by).favor + 10); if (victim) { hm(victim).mood = clamp(hm(victim).mood - 30); if (hm(victim).trait === 'proud' && chance(lf, 0.4)) leave(lf, victim, L(`${nm(lf, victim)} bỏ đi trong uất ức.`, `${nm(lf, victim)} storms out.`)); } hrm(lf, -6); })] },
        { label: L('Họp cả nhà', 'Call a family meeting'), outcomes: [
          oc(L('Sau ba tiếng, hai phe ôm nhau khóc.', 'Three hours later, both sides hug it out.'), {}, (lf) => { hrm(lf, 8); if (ally) addRel(lf, by, ally, -5); }, null, clamp(hstate(life).harmony / 100 + 0.2, 0.2, 0.9)),
          oc(L('Cuộc họp thành cuộc chiến.', 'The meeting becomes a war.'), {}, (lf) => hrm(lf, -10), null, 1 - clamp(hstate(life).harmony / 100 + 0.2, 0.2, 0.9)),
        ] },
      ]);
    }
    case 'bribe': {
      if (!tg || !inHarem(life, tg)) return null;
      return sev('sys/h_bribe', L(`Bạn thấy ${a} lén tặng ${b} một món quà đắt tiền, kèm lời "nhớ đứng về phía mình".`, `You catch ${a} slipping ${b} an expensive gift: "remember whose side you're on."`), [
        { label: L('Làm ngơ', 'Look away'), outcomes: [oc(L('Một liên minh mới hình thành trong im lặng.', 'A new alliance forms in silence.'), {}, (lf) => { addRel(lf, by, tg, 20); for (const q of members(lf)) if (q !== by && q !== tg) addRel(lf, by, q, -5); })] },
        { label: L(`Cảnh cáo ${a}`, `Warn ${a}`), outcomes: [oc(L(`${a} cúi đầu, nhưng không phục.`, `${a} lowers their head, unconvinced.`), {}, () => { hm(by).favor = clamp(hm(by).favor - 8); })] },
        { label: L(`Thưởng cho ${b} vì đã kể cho bạn`, `Reward ${b} for telling you`), outcomes: [oc(L(`${b} được sủng. ${a} tức tím mặt.`, `${b} rises in favour. ${a} is livid.`), {}, () => { hm(tg).favor = clamp(hm(tg).favor + 12); addRel(life, by, tg, -25); })] },
      ]);
    }
    case 'heir': {
      return sev('sys/h_heir', L(`${a} và ${b || 'một người khác'} cãi nhau xem con ai sẽ được thừa kế nhiều hơn.`, `${a} and ${b || 'another'} argue over whose child will inherit more.`), [
        { label: L('Chia đều cho tất cả các con', 'Split it equally among all the kids'), outcomes: [oc(L('Không ai được hơn ai. Ai cũng hơi tiếc, nhưng chấp nhận.', 'Nobody gets more. Everyone grumbles a bit, but accepts.'), {}, (lf) => { hrm(lf, 6); hstate(lf).heir = 'equal'; })] },
        { label: L('Ưu tiên con của người đứng đầu', "Favour the head consort's child"), outcomes: [oc(L('Người đứng đầu hài lòng. Những người khác ghi thù.', 'The head consort is pleased. The others hold a grudge.'), {}, (lf) => { hrm(lf, -6); hstate(lf).heir = 'head'; })] },
        { label: L('Viết di chúc bí mật', 'Write a secret will'), outcomes: [oc(L('Bạn khóa di chúc vào két. Cả nhà sẽ biết vào ngày đám tang.', 'You lock the will in a safe. They will find out at the funeral.'), {}, (lf) => { hstate(lf).heir = 'secret'; })] },
      ]);
    }
    case 'coup': {
      const p = clamp(0.5 + me(life).charm / 200 + hstate(life).harmony / 200, 0.2, 0.9);
      return sev('sys/h_coup', L(`${a} vận động cả nhà bỏ phiếu: từ nay ${a} sẽ là người quyết định mọi chuyện, không phải bạn.`, `${a} rallies the house to vote: from now on ${a} makes the decisions, not you.`), [
        { label: L('Dập tắt cuộc đảo chính', 'Crush the coup'), outcomes: [
          oc(L(`Từng người một quay về phía bạn. ${a} đứng trơ trọi.`, `One by one they turn back to you. ${a} stands alone.`), { willpower: 5 }, (lf) => { hstate(lf).coup = true; hm(by).rank = 3; hm(by).favor = 10; }, null, p),
          oc(L('Bạn thua phiếu. Từ nay bạn chỉ là "khách" trong chính ngôi nhà của mình.', "You lose the vote. From now on you're a guest in your own house."), { happy: -15 }, (lf) => { hstate(lf).head = by.id; hm(by).rank = 0; hstate(lf).deposed = true; for (const q of members(lf)) hm(q).favor = clamp(hm(q).favor - 10); }, null, 1 - p),
        ] },
        { label: L(`Nhượng bộ, để ${a} làm người đứng đầu`, `Give in, make ${a} the head`), outcomes: [oc(L(`${a} lên ngôi. Không khí dịu xuống, nhưng bạn biết ai đang thật sự nắm quyền.`, `${a} takes the top spot. Things calm down, but you know who's really in charge.`), {}, (lf) => { const old = byId(lf, hstate(lf).head); if (old && old !== by) hm(old).rank = 1; hstate(lf).head = by.id; hm(by).rank = 0; hrm(lf, 10); })] },
        { label: L('Giải tán hậu cung', 'Dissolve the harem'), outcomes: [oc(L('Bạn chia tài sản cho từng người và sống một mình. Tự do, và hơi trống trải.', 'You split some money between them and live alone. Free, and a little empty.'), { happy: -5 }, (lf) => { const ms = members(lf); lf.money -= u(lf, 30 * ms.length); for (const q of ms) leave(lf, q); })] },
      ]);
    }
  }
  return null;
}

/** Tang lễ: những người trong hậu cung tranh nhau di chúc. */
export function haremFuneral(life) {
  const ms = members(life);
  if (!ms.length) return null;
  const h = life.harem;
  if (h.heir === 'equal') return L(`${ms.length} người trong hậu cung đứng cạnh nhau ở đám tang. Di chúc chia đều, không ai cãi nhau.`, `The ${ms.length} members of the harem stand together at the funeral. The will is split evenly; no one fights.`);
  if (h.heir === 'secret') return L('Di chúc bí mật được mở trước cả nhà. Có người bật khóc, có người đập bàn bỏ về.', 'The secret will is read out to the family. Some cry, some slam the table and leave.');
  return L(`${ms.length} người trong hậu cung tranh nhau từng món tài sản. Luật sư phải xin thêm thời gian.`, `The ${ms.length} members of the harem fight over every asset. The lawyer asks for more time.`);
}

// ───────── God Mode ─────────
export function godHaremSelf(life, v) {
  const h = hstate(life);
  if (v.harmony != null) h.harmony = clamp(Number(v.harmony));
  if (v.structure && ['rank', 'equal'].includes(v.structure)) h.structure = v.structure;
  if (v.house && HOUSES[v.house]) h.house = v.house;
  if (v.cungdau != null) h.cungdau = !!v.cungdau;
  if (v.protect && ['always', 'never', 'each'].includes(v.protect)) h.protect = v.protect;
  if (v.head) { const p = byId(life, v.head); if (p && inHarem(life, p)) { const old = byId(life, h.head); if (old && old !== p) hm(old).rank = 1; h.head = p.id; hm(p).rank = 0; } }
}
export function godHaremMember(life, p, v) {
  if (!inHarem(life, p)) {
    if (v.joinHarem && adultOK(life, p)) join(life, p);
    return;
  }
  const x = hm(p);
  if (v.htrait && HTRAITS[v.htrait]) x.trait = v.htrait;
  if (v.hrank != null && v.hrank !== '') { const r = clamp(Number(v.hrank), 0, 3); if (r === 0) godHaremSelf(life, { head: p.id }); else { if (hstate(life).head === p.id) { const nx = members(life).find((q) => q !== p); if (nx) godHaremSelf(life, { head: nx.id }); } x.rank = r; } }
  if (v.hfavor != null) x.favor = clamp(Number(v.hfavor));
  if (v.hmood != null) x.mood = clamp(Number(v.hmood));
  if (v.hknown != null) x.known = !!v.hknown;
  if (v.hrel) for (const [id, val] of Object.entries(v.hrel)) { const q = byId(life, id); if (q && inHarem(life, q) && q !== p) setRel(life, p, q, (Number(val) - 50) * 2); }
  if (v.leaveHarem) leave(life, p);
}
