// Đợt 4 · Thế giới sống: NPC tự yêu, cưới, chia tay, cãi nhau (200), chủ động tìm bạn (205),
// giọng nói theo tính cách (206), bạn bè có đời riêng (226), cảnh 25+ ba bước có biến thể (201/202),
// album khoảnh khắc (203), tính cách người chơi và gợi ý lựa chọn hợp tính (272/280).
// Luật: NPC chỉ ghép đôi với NPC ngoài gia đình, đều là người lớn, hợp xu hướng của nhau.
import { L, clamp, chance, randint, pick, rand, freqOf } from './util.js';
import { unit, country, byId, randomPerson, personName, addLog, setFlag } from './life.js';
import { applyEffects, tryConceive, protectChance } from './events.js';
import { prof, me, adultOK, ROM, orientOf, likesG, kinkById } from './intimacy.js';
import { inHarem } from './harem.js';

const nm = (life, p) => personName(life, p);
const u = (life, n) => n * unit(life);
const res = (text, changes = [], tone) => ({ text, changes, tone });
const oc = (text, effects = {}, run, next, ch = 1) => ({ chance: ch, text, effects, run, next });
const sev = (uid, text, choices) => ({ uid, sys: true, text, choices });
function seedOf(str) { let h = 2166136261; for (const c of String(str)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }

// ───────── 206 · Giọng nói theo tính cách ─────────
export const VOICES = {
  warm: { em: '🤗', name: L('Ấm áp', 'Warm') },
  blunt: { em: '🪓', name: L('Thẳng tính', 'Blunt') },
  shy: { em: '🌸', name: L('Nhút nhát', 'Shy') },
  drama: { em: '🎭', name: L('Kịch tính', 'Dramatic') },
  witty: { em: '😏', name: L('Dí dỏm', 'Witty') },
  formal: { em: '🎩', name: L('Trang trọng', 'Formal') },
};
export function voiceOf(p) {
  if (!p.voice) p.voice = Object.keys(VOICES)[seedOf(p.id + ':v') % 6];
  return p.voice;
}
const V = {
  warm: {
    hello: [L('Gặp bạn là cả ngày vui rồi.', 'Seeing you makes my whole day.'), L('Dạo này bạn ăn uống đầy đủ không đấy?', 'Have you been eating properly lately?')],
    invite: [L('Bạn phải đến nhé, thiếu bạn là không trọn vẹn.', "You have to come. It won't be the same without you.")],
    favor: [L('Mình ngại lắm, nhưng bạn giúp mình một tay được không?', "I hate to ask, but could you give me a hand?")],
    loan: [L('Mình sẽ trả sớm nhất có thể, thật đấy.', "I'll pay you back as soon as I can, I promise.")],
    trip: [L('Đi với mình một chuyến đi, cho cả hai cùng thở.', "Come away with me for a bit. We both need to breathe.")],
    remember: [L('Mình vẫn hay nghĩ về hôm đó. Ấm lòng lắm.', 'I still think about that day. It warms my heart.')],
    thanks: [L('Cảm ơn bạn, thật lòng.', 'Thank you. Truly.')],
  },
  blunt: {
    hello: [L('Nói luôn: trông bạn mệt đấy.', "I'll just say it: you look tired."), L('Có gì nói nhanh, mình bận.', "Make it quick, I'm busy.")],
    invite: [L('Tiệc thứ Bảy. Đến hay không thì báo.', 'Party Saturday. Tell me if you are coming.')],
    favor: [L('Cần người khỏe chuyển đồ. Bạn rảnh không?', 'Need someone strong to move stuff. You free?')],
    loan: [L('Mình cần tiền. Không vòng vo.', "I need money. No beating around the bush.")],
    trip: [L('Đi phượt không? Đi thì xếp đồ.', 'Road trip? If yes, pack.')],
    remember: [L('Hôm đó vui. Thế thôi.', 'That day was good. That is all.')],
    thanks: [L('Được. Nợ bạn một lần.', 'Fine. I owe you one.')],
  },
  shy: {
    hello: [L('À... chào bạn. Mình không định làm phiền đâu.', "Oh... hi. I didn't mean to bother you.")],
    invite: [L('Nếu bạn không bận... thì đến nhé? Không đến cũng không sao.', "If you're not busy... maybe come? It's fine if not.")],
    favor: [L('Mình... có một việc nhỏ, nếu bạn không phiền...', "I... have a small thing, if you don't mind...")],
    loan: [L('Mình xấu hổ quá, nhưng... bạn cho mình mượn ít tiền được không?', "This is so embarrassing, but... could you lend me a little?")],
    trip: [L('Mình định đi biển... có muốn đi cùng không?', "I was thinking of the beach... want to come?")],
    remember: [L('Hôm đó... mình đã rất vui. Chỉ muốn nói vậy.', 'That day... I was really happy. I just wanted to say that.')],
    thanks: [L('Cảm ơn... nhiều lắm.', 'Thank you... so much.')],
  },
  drama: {
    hello: [L('Bạn sẽ không tin nổi tuần vừa rồi của mình đâu!', "You will NOT believe the week I've had!")],
    invite: [L('Sự kiện của năm! Không, của thập kỷ! Bạn phải có mặt!', 'The event of the year! No, the decade! You must be there!')],
    favor: [L('Chỉ bạn mới cứu được mình lúc này thôi!', 'Only you can save me right now!')],
    loan: [L('Đời mình sụp đổ rồi! Trừ khi bạn cho mình mượn chút tiền...', 'My life is over! Unless you lend me a little money...')],
    trip: [L('Bỏ hết, đi thôi! Đời người chỉ có một lần!', 'Drop everything, let us go! You only live once!')],
    remember: [L('Hôm đó là ngày đẹp nhất đời mình, mình thề!', 'That was the best day of my life, I swear!')],
    thanks: [L('Bạn là thiên thần! Mình sẽ kể cho cả thế giới!', "You're an angel! I'll tell the whole world!")],
  },
  witty: {
    hello: [L('Ồ, nhân vật chính xuất hiện rồi kìa.', 'Oh look, the main character has arrived.')],
    invite: [L('Có đồ ăn miễn phí và người lạ. Đúng sở trường của bạn.', 'Free food and strangers. Right up your street.')],
    favor: [L('Mình cần một tình nguyện viên. Chúc mừng, bạn vừa tình nguyện.', 'I need a volunteer. Congratulations, you just volunteered.')],
    loan: [L('Ví mình đang ăn kiêng. Cho nó mượn chút được không?', "My wallet's on a diet. Can you feed it a little?")],
    trip: [L('Ba ngày, hai người, một kế hoạch tồi. Đi không?', 'Three days, two people, one bad plan. In?')],
    remember: [L('Nhớ lần đó không? Mình vẫn cười một mình trên xe buýt.', 'Remember that time? I still laugh alone on the bus.')],
    thanks: [L('Bạn tuyệt đấy. Đừng để ai biết mình nói vậy.', "You're great. Don't tell anyone I said that.")],
  },
  formal: {
    hello: [L('Rất hân hạnh được gặp lại bạn.', 'A pleasure to see you again.')],
    invite: [L('Trân trọng kính mời bạn đến dự.', 'You are cordially invited.')],
    favor: [L('Tôi có một đề nghị nhỏ, mong bạn cân nhắc.', 'I have a small request, should you be willing.')],
    loan: [L('Tôi xin phép hỏi vay một khoản, có giấy tờ đầy đủ.', 'May I request a loan? With full paperwork, of course.')],
    trip: [L('Tôi đã đặt hai vé. Một vé dành cho bạn, nếu bạn nhận lời.', 'I have booked two tickets. One is yours, if you accept.')],
    remember: [L('Kỷ niệm ấy, tôi vẫn trân trọng.', 'I still treasure that memory.')],
    thanks: [L('Xin chân thành cảm ơn.', 'My sincere thanks.')],
  },
};
/** Một câu nói của p theo giọng riêng. Trả về {vi, en} có ngoặc kép. */
export function say(life, p, kind) {
  const lines = V[voiceOf(p)][kind] || V.warm.hello;
  const x = lines[seedOf(p.id + kind + life.age) % lines.length];
  return L(`"${x.vi}"`, `"${x.en}"`);
}

// ───────── 203 · Album khoảnh khắc ─────────
export function addMoment(life, p, text, em = '📸') {
  life.album ||= [];
  life.album.push({ age: life.age, pid: p ? p.id : null, em, text });
  if (life.album.length > 80) life.album.shift();
}

// ───────── 272/280 · Tính cách của bạn ─────────
export const PERS = {
  kind: { em: '💗', name: L('Tốt bụng', 'Kind'), neg: L('Lạnh lùng', 'Ruthless'), negEm: '🧊' },
  wild: { em: '🎲', name: L('Liều lĩnh', 'Daring'), neg: L('Cẩn trọng', 'Careful'), negEm: '🛡️' },
  brave: { em: '🦁', name: L('Gan dạ', 'Bold'), neg: L('Mềm mỏng', 'Gentle'), negEm: '🕊️' },
  clever: { em: '🦊', name: L('Lanh lợi', 'Clever'), neg: L('Bộc trực', 'Straightforward'), negEm: '🎯' },
};
export function persona(life) { if (!life.pers) life.pers = { kind: 50, wild: 50, brave: 50, clever: 50 }; return life.pers; }
/** Nét nổi bật nhất: [trục, dấu] hoặc null nếu còn cân bằng. */
export function topTrait(life) {
  const P = persona(life);
  let best = null;
  for (const k of Object.keys(PERS)) { const d = P[k] - 50; if (Math.abs(d) >= 12 && (!best || Math.abs(d) > Math.abs(best[2]))) best = [k, d > 0 ? 1 : -1, d]; }
  return best ? [best[0], best[1]] : null;
}
export function traitLabel(t) { if (!t) return L('Cân bằng', 'Balanced'); const x = PERS[t[0]]; return t[1] > 0 ? x.name : x.neg; }
export function traitEm(t) { if (!t) return '⚖️'; const x = PERS[t[0]]; return t[1] > 0 ? x.em : x.negEm; }
/** Thẻ của một lựa chọn: dựa vào hiệu ứng trung bình của các kết quả. */
export function tagChoice(choice) {
  if (!choice || !choice.outcomes) return null;
  const avg = {};
  for (const o of choice.outcomes) for (const [k, v] of Object.entries(o.effects || {})) if (typeof v === 'number') avg[k] = (avg[k] || 0) + v * (o.chance ?? 1);
  const cand = [['kind', avg.karma || 0], ['wild', (avg.risk || 0) * 1.2], ['brave', avg.willpower || 0], ['clever', avg.smarts || 0]];
  cand.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const [k, v] = cand[0];
  if (Math.abs(v) < 2) return null;
  if (k !== 'kind' && v < 0) return null;
  return [k, v > 0 ? 1 : -1];
}
export function inCharacter(life, tag) { const t = topTrait(life); return !!(t && tag && t[0] === tag[0] && t[1] === tag[1]); }
export function nudgePersona(life, choice) {
  const tag = tagChoice(choice);
  if (!tag) return false;
  const P = persona(life);
  const fit = inCharacter(life, tag);
  P[tag[0]] = clamp(P[tag[0]] + tag[1] * (life.age < 18 ? 4 : 1.5));
  return fit;
}

// ───────── 200/226 · Thế giới tự chuyển động ─────────
const NPC_ROLES = ['friend', 'bestie', 'coworker', 'boss', 'contact', 'neighbor', 'mentor', 'rival', 'ex', 'teacher'];
function soc(life) { if (!life.soc) life.soc = { pairs: [], feuds: [], gossip: [] }; return life.soc; }
const npcFree = (life, p) => p.alive && p.age >= 18 && NPC_ROLES.includes(p.role) && !p.cut && !inHarem(life, p) && !p.baby && !soc(life).pairs.some((x) => x.st !== 'split' && (x.a === p.id || x.b === p.id));
const mutualNpc = (life, a, b) => a.id !== b.id && likesG(orientOf(life, a), a.gender, b.gender) && likesG(orientOf(life, b), b.gender, a.gender) && Math.abs(a.age - b.age) <= 15;
export function npcPartnerOf(life, p) {
  const pr = soc(life).pairs.find((x) => x.st !== 'split' && (x.a === p.id || x.b === p.id));
  if (!pr) return null;
  return { p: byId(life, pr.a === p.id ? pr.b : pr.a), st: pr.st };
}
export const PAIR_LABEL = { dating: L('Đang hẹn hò', 'Dating'), married: L('Đã cưới', 'Married'), split: L('Đã chia tay', 'Split up') };
function gossip(life, text) { const S = soc(life); S.gossip.push({ age: life.age, text }); if (S.gossip.length > 30) S.gossip.shift(); addLog(life, text); }
function extMate(life, p) { const g = p.gender === 'male' ? 'female' : 'male'; const q = randomPerson(life, life, { role: 'contact', gender: likesG(orientOf(life, p), p.gender, g) ? g : p.gender, age: p.age }); return q.first; }

export function societyYear(life, st) {
  const S = soc(life);
  const fm = freqOf(st).m;
  const pushes = [];
  if (life.age < 8) return;
  const free = life.people.filter((p) => npcFree(life, p));
  // NPC bắt đầu hẹn hò
  if (free.length >= 2 && chance(life, 0.35 * fm)) {
    for (let tries = 0; tries < 6; tries++) {
      const a = pick(life, free); const b = pick(life, free);
      if (mutualNpc(life, a, b)) { S.pairs.push({ a: a.id, b: b.id, st: 'dating', since: life.age }); gossip(life, L(`${nm(life, a)} và ${nm(life, b)} đang hẹn hò. Bạn là người cuối cùng biết chuyện.`, `${nm(life, a)} and ${nm(life, b)} are dating. You're the last to find out.`)); break; }
    }
  }
  for (const pr of S.pairs) {
    const a = byId(life, pr.a); const b = byId(life, pr.b);
    if (!a || !b || !a.alive || !b.alive || pr.st === 'split') continue;
    if (inHarem(life, a) || inHarem(life, b) || ROM.includes(a.role) || ROM.includes(b.role)) { pr.st = 'split'; continue; }
    if (pr.st === 'dating') {
      if (chance(life, 0.14)) { pr.st = 'married'; pr.wed = life.age; pushes.push({ sys: 'so_reach', kind: 'wedding', id: a.id, other: b.id }); }
      else if (chance(life, 0.12)) { pr.st = 'split'; gossip(life, L(`${nm(life, a)} và ${nm(life, b)} chia tay. Cả hai đều nhắn kể với bạn phiên bản của mình.`, `${nm(life, a)} and ${nm(life, b)} break up. Both text you their version.`)); if (chance(life, 0.3)) pushes.push({ sys: 'so_side', a: a.id, b: b.id }); }
    } else if (pr.st === 'married') {
      if (chance(life, 0.07) && a.age < 46) { pr.kids = (pr.kids || 0) + 1; gossip(life, L(`${nm(life, a)} và ${nm(life, b)} vừa đón em bé. Ảnh trong nhóm chat dễ thương muốn xỉu.`, `${nm(life, a)} and ${nm(life, b)} just had a baby. The group chat photos are unbearably cute.`)); }
      else if (chance(life, 0.035)) { pr.st = 'split'; gossip(life, L(`${nm(life, a)} và ${nm(life, b)} ly hôn. Bạn được mời ăn hai bữa "kể khổ" trong cùng một tuần.`, `${nm(life, a)} and ${nm(life, b)} divorce. You get invited to two "let me vent" dinners in one week.`)); }
    }
  }
  // Mâu thuẫn giữa các NPC
  const anyAdult = life.people.filter((p) => p.alive && p.age >= 18 && NPC_ROLES.includes(p.role) && !p.cut);
  if (anyAdult.length >= 2 && chance(life, 0.12 * fm)) {
    const a = pick(life, anyAdult); const b = pick(life, anyAdult.filter((x) => x !== a));
    if (b && !S.feuds.some((f) => (f.a === a.id && f.b === b.id) || (f.a === b.id && f.b === a.id))) { S.feuds.push({ a: a.id, b: b.id, since: life.age }); pushes.push({ sys: 'so_side', a: a.id, b: b.id, feud: true }); }
  }
  S.feuds = S.feuds.filter((f) => life.age - f.since < 4 && byId(life, f.a)?.alive && byId(life, f.b)?.alive);
  // Gia đình và bạn bè có người yêu riêng (người ngoài, không phải nhân vật trong đời bạn)
  for (const p of life.people) {
    if (!p.alive || p.age < 20 || p.mate || p.role === 'pet' || ROM.includes(p.role) || !['sibling', 'half', 'friend', 'bestie', 'child'].includes(p.role)) continue;
    if (npcPartnerOf(life, p)) continue;
    if (chance(life, 0.06)) { p.mate = extMate(life, p); if (chance(life, 0.6)) pushes.push({ sys: 'so_reach', kind: 'wedding', id: p.id }); else addLog(life, L(`${nm(life, p)} giới thiệu người yêu mới tên ${p.mate}. Trông họ hạnh phúc.`, `${nm(life, p)} introduces their new partner, ${p.mate}. They look happy.`)); }
  }
  // 226 · Bạn bè có đời riêng
  let fe = 0;
  for (const p of life.people.filter((q) => q.alive && q.age >= 18 && ['friend', 'bestie'].includes(q.role) && !q.cut)) {
    if (fe >= 2 || !chance(life, 0.18 * fm)) continue;
    fe++;
    const r = rand(life);
    const n = nm(life, p);
    if (r < 0.25) { p.income = Math.round((p.income || country(life).gdp) * 1.3); addLog(life, L(`${n} được thăng chức. Họ mời bạn đi ăn mừng.`, `${n} gets promoted and takes you out to celebrate.`), 'good'); p.closeness = clamp(p.closeness + 3); }
    else if (r < 0.4 && !p.abroad) { p.abroad = pick(life, [L('Canada', 'Canada'), L('Úc', 'Australia'), L('Đức', 'Germany'), L('Nhật Bản', 'Japan'), L('Hàn Quốc', 'South Korea')]); p.closeness = clamp(p.closeness - 6); addLog(life, L(`${n} chuyển sang ${p.abroad.vi} sống. Bữa chia tay ai cũng khóc trừ người đặt bàn.`, `${n} moves to ${p.abroad.en}. Everyone cries at the farewell except the person who booked the table.`)); }
    else if (r < 0.6) pushes.push({ sys: 'so_reach', kind: 'invest', id: p.id });
    else if (r < 0.8) pushes.push({ sys: 'so_reach', kind: 'comfort', id: p.id });
    else addLog(life, pick(life, [L(`${n} bắt đầu học gốm và tặng bạn một cái bát méo.`, `${n} takes up pottery and gives you a lopsided bowl.`), L(`${n} chạy xong marathon đầu tiên và đăng 40 tấm ảnh huy chương.`, `${n} finishes their first marathon and posts 40 medal photos.`), L(`${n} nuôi một con mèo và giờ chỉ nói về con mèo.`, `${n} adopts a cat and now only talks about the cat.`)]));
  }
  // 205 · NPC chủ động tìm bạn
  const close = life.people.filter((p) => p.alive && p.age >= 18 && p.role !== 'pet' && p.closeness >= 35 && !p.cut && !ROM.includes(p.role));
  if (life.age >= 16 && close.length && chance(life, 0.4 * fm)) pushes.push({ sys: 'so_reach', kind: pick(life, ['favor', 'loan', 'trip', 'party', 'advice']), id: pick(life, close).id });
  // 203 · Người cũ nhắc lại kỷ niệm
  const al = (life.album || []).filter((m) => m.pid && byId(life, m.pid)?.alive && life.age - m.age >= 2);
  if (al.length && chance(life, 0.15)) { const m = pick(life, al); const p = byId(life, m.pid); const line = say(life, p, 'remember'); addLog(life, L(`${nm(life, p)} nhắc lại chuyện năm bạn ${m.age} tuổi: ${line.vi}`, `${nm(life, p)} brings up the year you were ${m.age}: ${line.en}`), 'good'); p.closeness = clamp(p.closeness + 3); }
  for (const x of pushes.slice(0, freqOf(st).cap || 3)) life.queue.push(x);
}

export function buildSocietySys(life, item, st) {
  if (!item.sys || !item.sys.startsWith('so_')) return null;
  if (item.sys === 'so_side') {
    const a = byId(life, item.a); const b = byId(life, item.b);
    if (!a || !b || !a.alive || !b.alive) return null;
    const an = nm(life, a); const bn = nm(life, b);
    return sev('sys/so_side', item.feud ? L(`${an} và ${bn} cãi nhau to vì một chuyện chẳng ai nhớ rõ. Cả hai đều muốn bạn đứng về phía mình.`, `${an} and ${bn} have a huge falling-out over something nobody quite remembers. Both want you on their side.`) : L(`Sau khi chia tay, ${an} và ${bn} đều hỏi bạn: "Bạn thấy ai đúng?"`, `After the breakup, ${an} and ${bn} both ask you: "So who was right?"`), [
      { label: L(`Bênh ${an}`, `Side with ${an}`), outcomes: [oc(L(`${an} ôm bạn. ${bn} hủy theo dõi bạn trên mọi mạng.`, `${an} hugs you. ${bn} unfollows you everywhere.`), {}, () => { a.closeness = clamp(a.closeness + 10); b.closeness = clamp(b.closeness - 15); })] },
      { label: L(`Bênh ${bn}`, `Side with ${bn}`), outcomes: [oc(L(`${bn} cảm ơn bạn. ${an} im lặng suốt tháng.`, `${bn} thanks you. ${an} goes silent for a month.`), {}, () => { b.closeness = clamp(b.closeness + 10); a.closeness = clamp(a.closeness - 15); })] },
      { label: L('Mời cả hai đi ăn để hòa giải', 'Take them both to dinner to make peace'), outcomes: [oc(L('Món tráng miệng chưa ra, hai người đã cười lại với nhau.', "Before dessert arrives, they're laughing together again."), { karma: 3, happy: 3 }, (lf) => { a.closeness = clamp(a.closeness + 5); b.closeness = clamp(b.closeness + 5); soc(lf).feuds = soc(lf).feuds.filter((f) => !(f.a === a.id && f.b === b.id)); }, null, 0.55), oc(L('Bữa tối biến thành hiệp hai. Bạn trả tiền cả bàn.', 'Dinner turns into round two. You pay for the table.'), { money: -2, happy: -3 }, null, null, 0.45)] },
      { label: L('Đứng ngoài', 'Stay out of it'), outcomes: [oc(L('Bạn tắt thông báo nhóm chat. Bình yên.', 'You mute the group chat. Peace.'), { willpower: 1 })] },
    ]);
  }
  if (item.sys !== 'so_reach') return null;
  const p = byId(life, item.id);
  if (!p || !p.alive) return null;
  const n = nm(life, p);
  const k = item.kind;
  if (k === 'wedding') {
    const o = item.other && byId(life, item.other);
    const other = o ? nm(life, o) : p.mate || '';
    const line = say(life, p, 'invite');
    return sev('sys/so_wedding', L(`${n} gửi thiệp cưới${other ? ` với ${other}` : ''}. ${line.vi}`, `${n} sends a wedding invitation${other ? ` with ${other}` : ''}. ${line.en}`), [
      { label: L('Đến dự, mừng cưới thật hậu', 'Go, with a generous gift'), outcomes: [oc(L('Bạn nhảy đến khi ban nhạc xin nghỉ. Cô dâu chú rể nhớ mãi.', 'You dance until the band begs for a break. The couple will never forget it.'), { happy: 6, money: -4 }, (lf) => { p.closeness = clamp(p.closeness + 10); addMoment(lf, p, L(`Đám cưới của ${n}`, `${n}'s wedding`), '💒'); })] },
      { label: L('Đến dự, phong bì vừa phải', 'Go, with a modest gift'), outcomes: [oc(L('Một buổi tối vui. Bạn bắt được bó hoa cưới mà không định bắt.', 'A fun evening. You catch the bouquet without meaning to.'), { happy: 4, money: -1 }, () => { p.closeness = clamp(p.closeness + 5); })] },
      { label: L('Gửi quà, không đến', 'Send a gift, skip it'), outcomes: [oc(L(`${n} cảm ơn nhưng hơi buồn.`, `${n} thanks you, a little hurt.`), { money: -2 }, () => { p.closeness = clamp(p.closeness - 3); })] },
    ]);
  }
  const line = say(life, p, k === 'party' ? 'invite' : k === 'comfort' || k === 'advice' ? 'hello' : k === 'invest' ? 'favor' : k);
  if (k === 'favor') return sev('sys/so_favor', L(`${n} nhắn: ${line.vi}`, `${n} messages: ${line.en}`), [
    { label: L('Giúp ngay', 'Help right away'), outcomes: [oc(L('Lưng bạn đau ba ngày, nhưng tình bạn khỏe hơn.', 'Your back hurts for three days, but the friendship is stronger.'), { karma: 3, health: -1 }, () => { p.closeness = clamp(p.closeness + 10); p.owes = (p.owes || 0) + 1; })] },
    { label: L('Thuê người giúp họ', 'Hire help for them'), outcomes: [oc(L('Họ cảm động vì bạn chu đáo, dù không có mặt.', "They're touched by your thoughtfulness, even though you weren't there."), { money: -3 }, () => { p.closeness = clamp(p.closeness + 5); })] },
    { label: L('Viện cớ bận', 'Make an excuse'), outcomes: [oc(L(`${n} trả lời "ok" không dấu chấm. Bạn biết vậy là không ok.`, `${n} replies "ok" with no full stop. You know that means not ok.`), {}, () => { p.closeness = clamp(p.closeness - 6); })] },
  ]);
  if (k === 'loan') return sev('sys/so_loan', L(`${n} gọi điện: ${line.vi}`, `${n} calls: ${line.en}`), [
    { label: L('Cho mượn', 'Lend it'), outcomes: [oc(L('Một năm sau họ trả đủ, kèm một hộp bánh.', 'A year later they pay it all back, with a box of cakes.'), { money: -5, karma: 2 }, (lf) => { p.closeness = clamp(p.closeness + 8); lf.money += u(lf, 6); }, null, clamp(0.4 + (p.fidelity ?? 60) / 200, 0.3, 0.85)), oc(L('Tiền đi không trở lại. Họ cũng ít nhắn hơn.', 'The money never comes back. Neither do their messages, much.'), { money: -5, happy: -3 }, () => { p.closeness = clamp(p.closeness - 5); }, null, 1 - clamp(0.4 + (p.fidelity ?? 60) / 200, 0.3, 0.85))] },
    { label: L('Cho luôn, không cần trả', "Give it, don't pay me back"), outcomes: [oc(L(`${n} im lặng hồi lâu rồi nói: "Mình sẽ không quên."`, `${n} is quiet for a long time, then says: "I won't forget this."`), { money: -4, karma: 5 }, () => { p.closeness = clamp(p.closeness + 14); p.owes = (p.owes || 0) + 2; })] },
    { label: L('Từ chối', 'Say no'), outcomes: [oc(L('Họ nói hiểu. Giọng thì không hiểu lắm.', "They say they understand. Their voice doesn't."), {}, () => { p.closeness = clamp(p.closeness - 8); })] },
  ]);
  if (k === 'trip') return sev('sys/so_trip', L(`${n} rủ: ${line.vi}`, `${n} asks: ${line.en}`), [
    { label: L('Đi luôn', "Let's go"), outcomes: [oc(L('Ba ngày, một chiếc xe thuê, và đủ chuyện để kể đến già.', 'Three days, one rental car, and enough stories to last into old age.'), { happy: 10, money: -6 }, (lf) => { p.closeness = clamp(p.closeness + 12); addMoment(lf, p, L(`Chuyến đi với ${n}`, `The trip with ${n}`), '🧳'); })] },
    { label: L('Hẹn dịp khác', 'Another time'), outcomes: [oc(L('Họ đi một mình và gửi ảnh hoàng hôn. Bạn hơi tiếc.', 'They go alone and send you sunset photos. You feel a pang.'), {}, () => { p.closeness = clamp(p.closeness - 2); })] },
  ]);
  if (k === 'party') return sev('sys/so_party', L(`${n} mời bạn dự tiệc: ${line.vi}`, `${n} invites you to a party: ${line.en}`), [
    { label: L('Đến và quẩy hết mình', 'Go and party hard'), outcomes: [oc(L('Bạn hát karaoke ba bài và ôm một người lạ khóc.', 'You sing three karaoke songs and hug a crying stranger.'), { happy: 7, health: -1 }, () => { p.closeness = clamp(p.closeness + 6); })] },
    { label: L('Ghé qua chút rồi về', 'Pop in briefly'), outcomes: [oc(L('Bạn chào mọi người, ăn hai cái bánh và rút lui đúng lúc.', 'You say hi, eat two snacks and leave at the perfect moment.'), { happy: 3 }, () => { p.closeness = clamp(p.closeness + 3); })] },
    { label: L('Ở nhà', 'Stay home'), outcomes: [oc(L('Bạn xem phim một mình. Không tệ chút nào.', 'You watch a film alone. Not bad at all.'), { happy: 1 })] },
  ]);
  if (k === 'advice') return sev('sys/so_advice', L(`${n} xin lời khuyên về một quyết định lớn: bỏ việc ổn định để theo đam mê.`, `${n} asks your advice on a big decision: quit a stable job to follow a passion.`), [
    { label: L('Cứ liều đi!', 'Go for it!'), outcomes: [oc(L('Họ nghỉ việc ngay hôm sau. Một năm sau, họ hạnh phúc hơn bao giờ hết.', 'They quit the next day. A year later, happier than ever.'), { happy: 3 }, () => { p.closeness = clamp(p.closeness + 8); }, null, 0.55), oc(L('Họ nghỉ việc, rồi gọi bạn mỗi tuần để than.', 'They quit, then call you weekly to complain.'), { happy: -2 }, () => { p.closeness = clamp(p.closeness - 4); }, null, 0.45)] },
    { label: L('Cẩn thận, có kế hoạch rồi hãy đi', 'Plan first, then leap'), outcomes: [oc(L('Họ lập kế hoạch sáu tháng. Mọi thứ diễn ra êm ả.', 'They make a six-month plan. It goes smoothly.'), { smarts: 1 }, () => { p.closeness = clamp(p.closeness + 6); })] },
  ]);
  if (k === 'invest') return sev('sys/so_invest', L(`${n} mở công ty riêng và mời bạn góp vốn.`, `${n} is starting a business and invites you to invest.`), [
    { label: L('Góp vốn', 'Invest'), outcomes: [oc(L('Công ty làm ăn tốt. Mỗi năm bạn nhận phần chia lợi nhuận.', 'The business does well. You get a share of the profits.'), { money: -10, happy: 4 }, (lf) => { lf.money += u(lf, 25); p.closeness = clamp(p.closeness + 8); }, null, 0.45), oc(L('Công ty đóng cửa sau 18 tháng. Ít nhất hai người vẫn là bạn.', 'The company folds after 18 months. At least you are still friends.'), { money: -10 }, null, null, 0.55)] },
    { label: L('Ủng hộ tinh thần thôi', 'Moral support only'), outcomes: [oc(L('Bạn là khách hàng đầu tiên của họ.', 'You become their first customer.'), { money: -1 }, () => { p.closeness = clamp(p.closeness + 3); })] },
  ]);
  if (k === 'comfort') return sev('sys/so_comfort', L(`${n} vừa chia tay và nhắn bạn lúc 2 giờ sáng.`, `${n} just went through a breakup and texts you at 2am.`), [
    { label: L('Mang kem đến nhà họ', 'Show up with ice cream'), outcomes: [oc(L('Hai người xem phim buồn và chửi người cũ của họ đến sáng.', 'You watch sad films and roast their ex until dawn.'), { happy: 2, health: -1 }, (lf) => { p.closeness = clamp(p.closeness + 12); addMoment(lf, p, L(`Đêm an ủi ${n}`, `The night you comforted ${n}`), '🍨'); })] },
    { label: L('Gọi điện nghe họ nói', 'Call and just listen'), outcomes: [oc(L('Họ nói, bạn nghe. Vậy là đủ.', 'They talk, you listen. That is enough.'), { karma: 2 }, () => { p.closeness = clamp(p.closeness + 7); })] },
    { label: L('Trả lời sáng mai', 'Reply in the morning'), outcomes: [oc(L('Sáng ra, họ đã ổn hơn và không nhắc lại nữa.', 'By morning they feel better and never mention it.'), {}, () => { p.closeness = clamp(p.closeness - 3); })] },
  ]);
  return null;
}

// ───────── 201/202 · Cảnh 25+ ba bước, có biến thể ─────────
const sty = (p) => prof(p).style;
const tierChem = (p) => (prof(p).chem >= 70 ? 2 : prof(p).chem >= 40 ? 1 : 0);
const BUILD = {
  dinner: { label: L('🕯️ Bữa tối nến ở nhà', '🕯️ Candlelit dinner at home'), short: L('bữa tối nến', 'a candlelit dinner'),
    soft: L('Bạn nấu món {n} thích nhất. Họ ngồi nhìn bạn nấu hơn là nhìn điện thoại.', 'You cook {n}\'s favourite dish. They watch you cook instead of their phone.'),
    bold: L('{n} đến muộn mười phút, mặc chiếc áo bạn từng khen. Đó không phải tình cờ.', '{n} arrives ten minutes late, wearing the shirt you once complimented. That is no accident.'),
    fun: L('Món chính cháy. {n} cười đến chảy nước mắt rồi gọi pizza, vẫn giữ nến.', 'The main course burns. {n} laughs till they cry, orders pizza, keeps the candles.') },
  dance: { label: L('💃 Nhảy chậm trong phòng khách', '💃 Slow dance in the living room'), short: L('một điệu nhảy chậm', 'a slow dance'),
    soft: L('Một bài hát cũ, đèn mờ. {n} tựa đầu vào vai bạn và không nói gì.', 'An old song, dim lights. {n} rests their head on your shoulder and says nothing.'),
    bold: L('{n} kéo bạn đứng dậy giữa câu chuyện: "Nhảy với mình." Không phải lời mời.', '{n} pulls you up mid-sentence: "Dance with me." It isn\'t a question.'),
    fun: L('Hai người nhảy tệ như nhau và giẫm chân nhau đúng nhịp.', 'You are both equally bad and step on each other\'s toes perfectly in time.') },
  drive: { label: L('🌃 Lái xe đêm không đích đến', '🌃 A late-night drive to nowhere'), short: L('một chuyến xe đêm', 'a late-night drive'),
    soft: L('Đèn đường lướt qua mặt {n}. Họ đặt tay lên tay bạn trên cần số.', 'Streetlights slide across {n}\'s face. Their hand finds yours on the gearstick.'),
    bold: L('{n} chỉ vào một ngã rẽ lạ: "Rẽ đi. Mình muốn xem nó dẫn đến đâu."', '{n} points at an unfamiliar turn: "Take it. I want to see where it goes."'),
    fun: L('Hai người hát to mọi bài trên radio, kể cả quảng cáo.', 'You both belt out every song on the radio, adverts included.') },
  rooftop: { label: L('🏙️ Sân thượng khách sạn', '🏙️ A hotel rooftop'), short: L('sân thượng khách sạn', 'a hotel rooftop'), cost: 3,
    soft: L('Thành phố lấp lánh dưới chân. {n} khoác áo của bạn và đứng sát hơn.', 'The city glitters below. {n} wears your jacket and stands closer.'),
    bold: L('{n} cầm chìa khóa phòng, xoay xoay trên ngón tay, nhìn bạn không chớp.', '{n} spins the room key on one finger, holding your gaze.'),
    fun: L('Gió thổi bay khăn ăn của {n} xuống tận tầng 30. Hai người cười không dừng được.', 'The wind steals {n}\'s napkin all the way down thirty floors. You can\'t stop laughing.') },
};
const LEAD = [
  L('Lúc đầu còn hơi ngập ngừng, rồi hai người tìm được nhịp của nhau.', 'A little hesitant at first, then you find each other\'s rhythm.'),
  L('Không cần nói nhiều. Hai người hiểu nhau qua ánh mắt.', 'Not much needs saying. You read each other at a glance.'),
  L('Như thể hai người đã chờ khoảnh khắc này rất lâu.', 'As if you have both been waiting a long time for this.'),
];
const DYN_LINE = {
  sweet: L('Mọi thứ ngọt như mật, như thể hai người mới yêu.', 'Everything is honey-sweet, as if you just fell in love.'),
  steamy: L('Không khí nóng lên từ trước khi kịp đóng cửa.', 'The air heats up before the door is even closed.'),
  strained: L('Dạo này hai người hay cãi nhau, nhưng đêm nay thì không.', 'You have been arguing lately, but not tonight.'),
  wild: L('Không ai đoán được đêm nay sẽ rẽ về đâu, kể cả hai người.', 'Nobody can guess where tonight is going, not even you two.'),
};
const VANILLA = {
  soft: L('Chậm rãi, dịu dàng, không vội vàng. Cả đêm chỉ có hai người.', 'Slow, tender, unhurried. The whole night is just the two of you.'),
  bold: L('Mãnh liệt và không chút giữ kẽ. Cánh cửa đóng sầm, phần còn lại để trí tưởng tượng.', 'Intense and unreserved. The door slams; the rest is left to imagination.'),
  fun: L('Nhiều tiếng cười, một cái gối rơi xuống sàn, và một đêm rất ấm.', 'Lots of laughing, a pillow on the floor, and a very warm night.'),
};
const AFTER = {
  care: { label: L('🫶 Chăm sóc nhau', '🫶 Take care of each other'), lines: [L('Bạn mang nước, chăn và một câu hỏi "Ổn chứ?". {n} gật đầu, hơi ngượng.', 'You bring water, a blanket and an "Okay?". {n} nods, a little shy.'), L('Bạn lau tóc cho {n} bằng khăn ấm. Họ nhắm mắt như mèo.', 'You dry {n}\'s hair with a warm towel. They close their eyes like a cat.'), L('{n} cuộn trong chăn, thì thầm: "Ở lại nhé." Bạn ở lại.', '{n} curls up in the blanket and whispers: "Stay." You stay.')] },
  talk: { label: L('🌙 Nói chuyện đến sáng', '🌙 Talk until sunrise'), lines: [L('Hai người nói về những chuyện nhỏ nhặt, rồi ngủ lúc nào không biết.', 'You talk about small things and drift off without noticing.'), L('{n} kể một bí mật họ chưa từng kể ai. Bạn giữ nó.', '{n} tells you a secret they have never told anyone. You keep it.'), L('Trời sáng dần. {n} nói: "Mình nghĩ mình thích bạn hơn mình tưởng."', 'Dawn creeps in. {n} says: "I think I like you more than I thought."')] },
  sleep: { label: L('😴 Ngủ quấn lấy nhau', '😴 Fall asleep tangled up'), lines: [L('Ai đó ngáy nhẹ. Không ai nhận.', 'Someone snores softly. Nobody admits it.'), L('Bạn tỉnh dậy với một cánh tay tê dại và một nụ cười.', 'You wake up with a numb arm and a smile.'), L('Giấc ngủ sâu nhất trong nhiều tháng, cho cả hai.', 'The deepest sleep in months, for both of you.')] },
  brunch: { label: L('🥞 Bữa sáng muộn', '🥞 A late breakfast'), lines: [L('Trứng hơi khét, cà phê hơi nhạt. Không ai phàn nàn.', 'Slightly burnt eggs, slightly weak coffee. Nobody complains.'), L('{n} mặc áo của bạn đứng pha cà phê, hát sai lời.', '{n} makes coffee in your shirt, singing the wrong lyrics.'), L('Hai người ăn sáng trên giường, vụn bánh khắp nơi, hạnh phúc khắp nơi.', 'Breakfast in bed, crumbs everywhere, happiness everywhere.')] },
};
const fill = (l, n) => L(l.vi.replace(/\{n\}/g, n), l.en.replace(/\{n\}/g, n));
export function scene3(life, st, p) {
  const n = nm(life, p);
  const x = prof(p);
  const style = sty(p);
  const ctx = { place: null, kink: null };
  const step3 = () => ({ uid: 'so/scene3', text: L('Sau đó...', 'Afterwards...'), choices: Object.entries(AFTER).map(([k, a]) => ({ label: a.label, outcomes: [oc(fill(a.lines[tierChem(p)], n), { happy: 4 }, (lf) => {
    p.closeness = clamp(p.closeness + (k === 'talk' ? 8 : 5));
    if (k === 'care') me(lf).care++;
    x.fire = clamp(x.fire + 4);
    addMoment(lf, p, L(`Đêm ${BUILD[ctx.place].short.vi} với ${n}`, `The night of ${BUILD[ctx.place].short.en} with ${n}`), '🌙');
    lf.counts.scene3 = (lf.counts.scene3 || 0) + 1;
  })] })) });
  const moment = (k) => (lf) => {
    ctx.kink = k;
    setFlag(lf, 'recent_intimate');
    x.first = true;
    tryConceive(lf, p, protectChance(st?.alwaysProtect !== false));
    if (k) { if (!x.known.includes(k)) x.known.push(k); if (!me(lf).tried.includes(k)) me(lf).tried.push(k); }
    lf.stats.happy = clamp(lf.stats.happy + Math.round((x.chem - 50) / 15) + (k ? 3 : 1));
  };
  const step2 = () => {
    const known = x.kinks.filter((k) => x.known.includes(k) && !x.limits.includes(k) && kinkById[k]);
    const ch = known.slice(0, 3).map((k) => ({ label: L(`♥ ${kinkById[k].name.vi}`, `♥ ${kinkById[k].name.en}`), outcomes: [oc(L(`${LEAD[tierChem(p)].vi} ${kinkById[k].scene[0].replace(/\{n\}/g, n)}`, `${LEAD[tierChem(p)].en} ${kinkById[k].scene[1].replace(/\{n\}/g, n)}`), { happy: 6 }, moment(k), step3)] }));
    const unk = x.kinks.filter((k) => !x.limits.includes(k) && kinkById[k]);
    if (unk.length) { const k = unk[seedOf(p.id + life.age) % unk.length]; ch.push({ label: L('🎲 Để họ dẫn dắt', '🎲 Let them lead'), outcomes: [oc(L(`${n} nháy mắt: "Tin mình đi." ${kinkById[k].scene[0].replace(/\{n\}/g, n)}`, `${n} winks: "Trust me." ${kinkById[k].scene[1].replace(/\{n\}/g, n)}`), { happy: 7 }, moment(k), step3)] }); }
    ch.push({ label: L('💞 Chỉ cần hai người', '💞 Just the two of you'), outcomes: [oc(fill(VANILLA[style], n), { happy: 5 }, moment(null), step3)] });
    const dl = x.dyn && DYN_LINE[x.dyn];
    return { uid: 'so/scene2', text: L(`${dl ? dl.vi + ' ' : ''}${LEAD[tierChem(p)].vi} Phần còn lại của đêm nay sẽ thế nào?`, `${dl ? dl.en + ' ' : ''}${LEAD[tierChem(p)].en} How does the rest of the night go?`), choices: ch };
  };
  return { event: { uid: 'so/scene1', text: L(`Bạn muốn dành cho ${n} một đêm thật đáng nhớ. Bắt đầu thế nào?`, `You want to give ${n} a night to remember. How does it begin?`), choices: Object.entries(BUILD).map(([k, b]) => ({ label: b.label, outcomes: [oc(fill(b[style], n), b.cost ? { money: -b.cost } : {}, () => { ctx.place = k; }, step2)] })) } };
}
export function societyPersonActions(life, p, st) {
  const out = [];
  if (!p.alive) return out;
  if (st?.adult25 && adultOK(life, p) && ROM.includes(p.role)) out.push(['scene3', L('Một đêm đáng nhớ', 'A night to remember')]);
  return out;
}
export function doSocietyPersonAction(life, st, p, act, n) {
  if (act === 'scene3') {
    if (!st?.adult25 || !adultOK(life, p) || !ROM.includes(p.role)) return null;
    if (n > 2) return res(L('Năm nay đã có đủ những đêm đáng nhớ rồi.', 'There have been enough unforgettable nights this year.'), []);
    return scene3(life, st, p);
  }
  return null;
}
export function godSocietyPerson(life, p, v) {
  if (v.voice && VOICES[v.voice]) p.voice = v.voice;
}
export function godSocietySelf(life, v) {
  const P = persona(life);
  for (const k of Object.keys(PERS)) if (v[k] != null) P[k] = clamp(Number(v[k]));
}
