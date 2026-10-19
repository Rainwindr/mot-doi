// Đợt 4 · Quyền lực & địa vị: mặt nạ xã hội (301), gia tộc (303), chính trường (306/313), hội kín (309/318),
// thang địa vị (310), ảnh hưởng (311), báo chí (315), siêu giàu (319), người kế vị (320),
// ông vua không ngai (340), hào quang (341), khao khát nối dõi (342), sinh sản theo tuổi (343).
// Luật cứng: không bạo lực (kẻ thù chỉ bị hạ bằng bê bối, phá sản, mất ghế, rời thành phố),
// tình cảm chỉ giữa người lớn ngoài gia đình, hợp xu hướng, có đồng thuận. Nhân vật chính trị đều hư cấu, trung lập.
import { L, clamp, chance, randint, pick, rand, freqOf } from './util.js';
import { unit, country, partner, people, byId, randomPerson, partnerGender, personName, addLog, milestone, setFlag } from './life.js';
import { applyEffects, addChild, tryConceive } from './events.js';
import { prof, me, agree, adultOK, attOf, ROM, romance, likes, likesG, heirOK, FAMILY } from './intimacy.js';
import { members, hm, hstate, inHarem } from './harem.js';
import { netWorth } from './economy.js';
import { fcfg, MALE_UNLIMITED } from './fertility.js';

const nm = (life, p) => personName(life, p);
const u = (life, n) => n * unit(life);
const res = (text, changes = [], tone) => ({ text, changes, tone });
const fx = (life, e) => applyEffects(life, e);
const oc = (text, effects = {}, run, next, ch = 1) => ({ chance: ch, text, effects, run, next });
const sev = (uid, text, choices) => ({ uid, sys: true, text, choices });
const modal = (uid, text, choices) => ({ event: { uid, text, choices } });

export function pw(life) {
  if (!life.pw) life.pw = { infl: 0, office: 0, held: 0, term: 0, approval: 50, press: null, club: null, rich: { jet: false, island: false, art: [], villas: [] }, clan: null, heirId: null, masks: { family: 'genuine', work: 'genuine', online: 'genuine', elite: 'genuine' }, shadow: null, aura: null, heirAll: false, statusGod: null, kingmade: 0 };
  return life.pw;
}

// ───────── 310 · Thang địa vị ─────────
export const STATUS = [
  { em: '🌱', name: L('Vô danh', 'Nobody') },
  { em: '🏘️', name: L('Có tiếng trong xóm', 'Known locally') },
  { em: '🎩', name: L('Người có máu mặt', 'Somebody') },
  { em: '🥂', name: L('Giới thượng lưu', 'Upper class') },
  { em: '💎', name: L('Giới tinh hoa', 'The elite') },
  { em: '🏛️', name: L('Kẻ nắm quyền', 'Power broker') },
  { em: '👑', name: L('Không ai chạm tới', 'Untouchable') },
];
const ST_CUT = [10, 22, 35, 50, 65, 80];
export function statusScore(life) {
  const P = pw(life);
  const nw = Math.max(1, netWorth(life) / country(life).gdp);
  return Math.log10(nw) * 14 + life.stats.fame * 0.25 + P.office * 7 + (P.club ? P.club.rank * 5 : 0) + (P.press ? 8 : 0) + (P.clan ? P.clan.prestige * 0.1 : 0) + P.infl * 0.15 + (P.rich.jet ? 4 : 0) + (P.rich.island ? 6 : 0);
}
export function statusOf(life) {
  const P = pw(life);
  if (P.statusGod != null) return P.statusGod;
  const s = statusScore(life);
  return ST_CUT.filter((c) => s >= c).length;
}

// ───────── 341 · Hào quang ─────────
export const AURA = [
  { em: '·', name: L('Chưa có', 'None') },
  { em: '✨', name: L('Thu hút', 'Magnetic') },
  { em: '🌟', name: L('Rạng rỡ', 'Radiant') },
  { em: '☀️', name: L('Chói lọi', 'Dazzling') },
  { em: '👑', name: L('Hào quang tuyệt đối', 'Absolute aura') },
];
export const pawnsOf = (life) => life.people.filter((p) => p.alive && p.pawn);
export function auraScore(life) {
  const m = life.ix || {};
  return life.stats.fame * 0.25 + (m.charm || 0) * 0.15 + pw(life).infl * 0.2 + statusOf(life) * 6 + life.stats.looks * 0.15 + (life.prorep || 0) * 0.1 + pawnsOf(life).length * 1.5;
}
export function auraTier(life) {
  const P = pw(life);
  if (P.aura != null) return P.aura;
  if (life.age < 18) return 0;
  const s = auraScore(life);
  return s >= 75 ? 4 : s >= 60 ? 3 : s >= 45 ? 2 : s >= 30 ? 1 : 0;
}
export function updateAura(life) { life.auraT = auraTier(life); return life.auraT; }

// ───────── 301 · Mặt nạ xã hội ─────────
export const MASKS = {
  genuine: { em: '🙂', name: L('Thật lòng', 'Genuine') },
  perfect: { em: '🪞', name: L('Hoàn hảo', 'Flawless') },
  tough: { em: '🪨', name: L('Cứng rắn', 'Tough') },
  charming: { em: '🌹', name: L('Quyến rũ', 'Charming') },
  mystery: { em: '🎭', name: L('Bí ẩn', 'Mysterious') },
};
export const AUDIENCES = { family: L('Gia đình', 'Family'), work: L('Đồng nghiệp', 'Coworkers'), online: L('Mạng xã hội', 'Online'), elite: L('Giới thượng lưu', 'The elite') };

// ───────── 306/313 · Chính trường (hư cấu, trung lập) ─────────
export const OFFICES = [
  { name: L('Không', 'None') },
  { name: L('Tổ trưởng khu phố', 'Neighbourhood rep'), fame: 0, infl: 0, age: 21, cost: 1 },
  { name: L('Ủy viên hội đồng thành phố', 'City councillor'), fame: 12, infl: 10, age: 23, cost: 5 },
  { name: L('Thị trưởng', 'Mayor'), fame: 25, infl: 25, age: 28, cost: 20 },
  { name: L('Thống đốc tỉnh', 'Provincial governor'), fame: 40, infl: 40, age: 30, cost: 50 },
  { name: L('Bộ trưởng', 'Minister'), fame: 50, infl: 55, age: 32, cost: 90 },
  { name: L('Nguyên thủ quốc gia', 'Head of state'), fame: 65, infl: 70, age: 35, cost: 180 },
];
export function nextOffice(life) {
  const P = pw(life);
  const lv = Math.min(6, Math.max(P.held, P.office) + 1);
  return P.office >= 6 ? null : lv;
}
export function canRun(life, lv) {
  const o = OFFICES[lv];
  if (!o || life.age < o.age || life.prison) return false;
  return life.stats.fame >= o.fame || pw(life).infl >= o.infl;
}
const PLATFORMS = [
  ['econ', L('Kinh tế và việc làm', 'Jobs and the economy')],
  ['edu', L('Trường học và y tế', 'Schools and healthcare')],
  ['green', L('Môi trường và giao thông', 'Environment and transport')],
  ['safe', L('An sinh cho người già', 'Care for the elderly')],
];
const OPP = {
  facts: L('Đối thủ dồn dập số liệu, biểu đồ chiếu kín màn hình.', 'Your opponent fires off statistics, charts filling the screen.'),
  attack: L('Đối thủ quay sang soi đời tư của bạn, khán phòng ồ lên.', 'Your opponent turns to your private life. The hall gasps.'),
  story: L('Đối thủ kể câu chuyện cảm động về một gia đình họ từng gặp.', 'Your opponent tells a moving story about a family they once met.'),
};
const BEST = { facts: { story: 2, facts: 0, calm: -1 }, attack: { calm: 2, facts: 0, story: -1 }, story: { facts: 2, calm: 0, story: -1 } };
function debateRound(life, c, lv) {
  const opp = c.opps[c.round];
  const pickMv = (mv, label) => ({ label, outcomes: [oc(mv === 'facts' ? L('Bạn đáp bằng con số cụ thể, rõ ràng.', 'You answer with clear, specific numbers.') : mv === 'story' ? L('Bạn kể câu chuyện thật của chính mình. Khán phòng lặng đi.', 'You tell your own true story. The hall goes quiet.') : L('Bạn mỉm cười, đáp một câu hài hước rồi quay lại vấn đề chính.', 'You smile, crack a light joke, and steer back to the issues.'), {}, (lf) => { c.score += BEST[opp][mv] + (lf.stats.smarts > 70 && mv === 'facts' ? 0.5 : 0) + ((lf.ix?.charm || 0) > 60 && mv !== 'facts' ? 0.5 : 0); c.round++; }, (lf) => (c.round < 3 ? debateRound(lf, c, lv) : electionResult(lf, c, lv)))] });
  return { uid: 'pw/debate', text: L(`Tranh luận trực tiếp, hiệp ${c.round + 1}/3. ${OPP[opp].vi}`, `Live debate, round ${c.round + 1}/3. ${OPP[opp].en}`), choices: [pickMv('facts', L('📊 Đưa số liệu', '📊 Bring the numbers')), pickMv('story', L('💬 Kể câu chuyện thật', '💬 Tell a true story')), pickMv('calm', L('😌 Bình tĩnh, hài hước', '😌 Stay calm and witty'))] };
}
function electionResult(life, c, lv) {
  const P = pw(life);
  const p = clamp(0.28 + c.score * 0.07 + life.stats.fame / 250 + P.infl / 250 + (life.auraT || 0) * 0.04 + (c.plat === 'safe' && life.age > 45 ? 0.04 : 0) - lv * 0.03 - (life.ix?.scandal || 0) / 400, 0.05, 0.92);
  const name = OFFICES[lv].name;
  return { uid: 'pw/election', text: L(`Đêm bầu cử: ${name.vi}. Phiếu đang được đếm.`, `Election night: ${name.en}. The votes are being counted.`), choices: [{ label: L('Chờ kết quả', 'Wait for the result'), outcomes: [
    oc(L(`Bạn thắng! Từ hôm nay bạn là ${name.vi}.`, `You win! From today you are ${name.en}.`), { happy: 15, fame: 6 }, (lf) => { const Q = pw(lf); Q.office = lv; Q.held = Math.max(Q.held, lv); Q.term = 4; Q.approval = 55; Q.infl = clamp(Q.infl + 6 + lv * 2); milestone(lf, L(`Đắc cử ${name.vi}`, `Elected ${name.en}`), 'good'); }, null, p),
    oc(L('Bạn thua sát nút. Đối thủ gọi điện chúc mừng bạn đã cố hết sức.', 'You lose narrowly. Your opponent calls to say you gave it everything.'), { happy: -8, fame: 2 }, (lf) => { pw(lf).infl = clamp(pw(lf).infl + 2); }, null, 1 - p),
  ] }] };
}
export function campaign(life, lv) {
  const o = OFFICES[lv];
  if (!canRun(life, lv)) return res(L(`Bạn chưa đủ tiếng tăm hoặc ảnh hưởng để ra tranh cử ${o.name.vi}.`, `You don't have the fame or influence to run for ${o.name.en} yet.`), [], 'bad');
  if (life.money < u(life, o.cost)) return res(L('Bạn không đủ tiền vận động tranh cử.', "You can't afford a campaign."), [], 'bad');
  life.money -= u(life, o.cost);
  const c = { score: 0, round: 0, opps: [pick(life, Object.keys(OPP)), pick(life, Object.keys(OPP)), pick(life, Object.keys(OPP))], plat: null };
  return modal('pw/campaign', L(`Bạn ra tranh cử ${o.name.vi}. Đội vận động hỏi: thông điệp chính là gì?`, `You run for ${o.name.en}. Your team asks: what's the core message?`), PLATFORMS.map(([k, lb]) => ({ label: lb, outcomes: [oc(L('Áp phích in xong, đoàn xe vận động lăn bánh.', 'Posters printed, the campaign bus rolls out.'), {}, () => { c.plat = k; }, (lf) => debateRound(lf, c, lv))] })));
}
const POLICIES = [
  [L('Ngân sách dư một khoản. Xây gì?', 'There is a budget surplus. Build what?'), [[L('Bệnh viện mới', 'A new hospital'), { karma: 3 }, 6], [L('Đường cao tốc', 'A highway'), { money: 3 }, 4], [L('Công viên lớn', 'A big park'), { happy: 3 }, 3]]],
  [L('Giờ cao điểm kẹt xe kinh khủng.', 'Rush hour traffic is unbearable.'), [[L('Mở thêm tuyến xe buýt', 'More bus lines'), { karma: 2 }, 5], [L('Mở rộng đường', 'Widen the roads'), {}, 3], [L('Khuyến khích làm từ xa', 'Encourage remote work'), { smarts: 1 }, 4]]],
  [L('Giáo viên đề nghị tăng lương.', 'Teachers ask for a raise.'), [[L('Đồng ý', 'Agree'), { karma: 3 }, 6], [L('Tăng một nửa', 'Meet them halfway'), {}, 3], [L('Hoãn lại', 'Postpone'), { willpower: 1 }, -5]]],
  [L('Một nhà máy lớn muốn đặt xưởng ở địa phương.', 'A big factory wants to open locally.'), [[L('Chào đón, tạo việc làm', 'Welcome it for the jobs'), { money: 2 }, 4], [L('Đồng ý kèm điều kiện môi trường', 'Yes, with green conditions'), { karma: 2 }, 5], [L('Từ chối', 'Say no'), {}, -2]]],
  [L('Người dân muốn có lễ hội mùa hè.', 'People want a summer festival.'), [[L('Tổ chức thật hoành tráng', 'Go big'), { happy: 4, fame: 2 }, 5], [L('Lễ hội nhỏ, tiết kiệm', 'Small and thrifty'), {}, 2], [L('Dồn tiền cho việc khác', 'Spend the money elsewhere'), {}, -3]]],
  [L('Chợ cũ xuống cấp nhưng nhiều người gắn bó.', 'The old market is crumbling but beloved.'), [[L('Trùng tu giữ nét xưa', 'Restore it faithfully'), { karma: 2 }, 5], [L('Xây trung tâm thương mại', 'Build a mall'), { money: 3 }, -2], [L('Hỏi ý kiến người dân', 'Hold a public vote'), { smarts: 1 }, 4]]],
];

// ───────── 309/318 · Hội kín ─────────
export const CLUB_RANKS = [L('Khách mời', 'Guest'), L('Thành viên', 'Member'), L('Hiệp sĩ', 'Knight'), L('Trưởng lão', 'Elder'), L('Đại sư', 'Grand master'), L('Chủ tọa', 'Chair')];
const CLUB_NEED = [0, 20, 45, 75, 110, 160];
export const CLUB_NAME = L('Hội Đêm Trăng', 'The Moonlit Circle');

// ───────── 319 · Siêu giàu ─────────
export const RICH = {
  jet: { em: '🛩️', name: L('Máy bay riêng', 'Private jet'), cost: 300, up: 15 },
  island: { em: '🏝️', name: L('Đảo riêng', 'Private island'), cost: 800, up: 30 },
  art: { em: '🖼️', name: L('Tác phẩm nghệ thuật', 'Artwork'), cost: 50, up: 0 },
  villa: { em: '🏰', name: L('Biệt thự ở nước ngoài', 'Villa abroad'), cost: 120, up: 5 },
};
const VILLA_SPOTS = [L('Lake Como, Ý', 'Lake Como, Italy'), L('Santorini, Hy Lạp', 'Santorini, Greece'), L('Bali, Indonesia', 'Bali, Indonesia'), L('Côte d\'Azur, Pháp', "Côte d'Azur, France"), L('Kyoto, Nhật Bản', 'Kyoto, Japan'), L('Aspen, Mỹ', 'Aspen, USA'), L('Phú Quốc, Việt Nam', 'Phu Quoc, Vietnam'), L('Cape Town, Nam Phi', 'Cape Town, South Africa')];

// ───────── 340 · Ông vua không ngai ─────────
export const PAWN_VIA = { money: { em: '💵', name: L('Tiền', 'Money') }, secret: { em: '🗝️', name: L('Bí mật', 'Secrets') }, love: { em: '💗', name: L('Tình cảm', 'Love') }, favor: { em: '🤝', name: L('Ân huệ', 'Favours') } };
export function shadowPower(life) {
  const P = pw(life);
  const S = P.shadow;
  if (!S) return 0;
  return clamp(pawnsOf(life).length * 6 + S.biz * 5 + S.love * 3 + P.infl * 0.3 + P.office * 4 + (P.club ? P.club.rank * 3 : 0));
}
const DIRECTIVES = {
  market: { em: '📈', name: L('Lặng lẽ xoay một thương vụ lớn', 'Quietly steer a big deal'), run: (lf, e) => ({ fx: { money: Math.round(40 * e) }, exp: 8, text: L('Giá cổ phiếu nhích lên đúng lúc bạn đã mua vào. Không ai thấy bàn tay nào.', 'The stock rises right after you bought in. Nobody sees a hand at work.') }) },
  kingmaker: { em: '🎖️', name: L('Đưa một quân cờ lên ghế quyền lực', 'Put a pawn in a seat of power'), run: (lf, e) => { const ps = pawnsOf(lf).filter((p) => !p.post); if (!ps.length) return { exp: 0, text: L('Không còn quân cờ nào để đưa lên.', 'No pawn left to promote.') }; const p = pick(lf, ps); p.post = pick(lf, [L('Phó thị trưởng', 'Deputy mayor'), L('Giám đốc sở', 'Department head'), L('Chủ tịch hiệp hội', 'Association chair'), L('Tổng biên tập', 'Editor-in-chief'), L('Thành viên hội đồng quản trị', 'Board member')]); pw(lf).kingmade++; pw(lf).infl = clamp(pw(lf).infl + Math.round(12 * e)); return { exp: 6, text: L(`${nm(lf, p)} được bổ nhiệm làm ${p.post.vi}. Họ biết ơn ai thì chỉ họ và bạn biết.`, `${nm(lf, p)} is appointed ${p.post.en}. Only they and you know whom to thank.`) }; } },
  bury: { em: '🧹', name: L('Dập mọi tin xấu năm nay', 'Bury every bad story this year'), run: (lf) => { me(lf).scandal = clamp(me(lf).scandal - 25); return { fx: { money: -10 }, exp: -4, text: L('Các bài báo bất lợi biến mất trước giờ lên khuôn.', 'Unfavourable articles vanish before going to print.') }; } },
  enemy: { em: '♟️', name: L('Hạ một đối thủ (không bạo lực)', 'Bring down a rival (no violence)'), run: (lf) => { const t = enemiesOf(lf); if (!t.length) return { exp: 0, text: L('Năm nay không ai đủ tầm làm đối thủ của bạn.', 'Nobody is worth calling a rival this year.') }; const p = pick(lf, t); return { exp: 10, karma: -4, text: defeat(lf, p, pick(lf, ['scandal', 'broke', 'office', 'leave'])) }; } },
  bizemp: { em: '🏢', name: L('Mở thêm công ty bình phong', 'Open another front company'), run: (lf) => { pw(lf).shadow.biz++; return { fx: { money: -20 }, exp: 4, text: L('Một công ty mới đăng ký dưới tên người khác. Lợi nhuận chảy về bạn.', 'A new company registers under someone else\'s name. The profits flow to you.') }; } },
  loveemp: { em: '🌹', name: L('Mở rộng mạng lưới tình ái', 'Widen your romantic network'), run: (lf) => { pw(lf).shadow.love++; const p = admirer(lf, 'affair'); return { exp: 3, text: L(`${nm(lf, p)} được giới thiệu với bạn trong một bữa tiệc kín. Họ không giấu sự quan tâm.`, `${nm(lf, p)} is introduced to you at a private party. They make their interest plain.`) }; } },
  quiet: { em: '🤫', name: L('Năm nay nằm im', 'Lie low this year'), run: () => ({ exp: -12, text: L('Bạn không xuất hiện ở đâu cả. Tin đồn nguội dần.', 'You appear nowhere. The rumours cool off.') }) },
  loyalty: { em: '🫱', name: L('Củng cố lòng trung thành', 'Shore up loyalty'), run: (lf) => { for (const p of pawnsOf(lf)) p.pawn.loyal = clamp(p.pawn.loyal + 10); return { fx: { money: -8 }, exp: 1, text: L('Mỗi quân cờ nhận một món quà đúng ý. Không ai quên điều đó.', 'Each pawn receives exactly the gift they wanted. Nobody forgets.') }; } },
  policy: { em: '📜', name: L('Ra chỉ thị cho chính quyền', 'Issue a directive to the authorities'), run: (lf, e) => { pw(lf).infl = clamp(pw(lf).infl + Math.round(8 * e)); return { fx: { karma: -1 }, exp: 5, text: L('Một nghị quyết mới được thông qua, câu chữ y hệt bản nháp bạn gửi.', 'A new resolution passes, word for word like the draft you sent.') }; } },
};
export function enemiesOf(life) { return life.people.filter((p) => adultOK(life, p) && !p.cut && ['hate', 'rival'].includes(attOf(p))); }
export const DEFEAT = {
  scandal: L('Bê bối', 'Scandal'), broke: L('Phá sản', 'Bankruptcy'), office: L('Mất ghế', 'Losing their post'), leave: L('Rời thành phố', 'Leaving town'),
};
/** Kẻ thù chỉ bị hạ bằng bê bối, phá sản, mất ghế hoặc rời thành phố. Không bao giờ có bạo lực. */
export function defeat(life, p, how) {
  const n = nm(life, p);
  p.defeated = how;
  if (how === 'scandal') { p.att = 'hate'; p.closeness = clamp(p.closeness - 20); return L(`Hồ sơ những lần ${n} gian dối lọt ra báo chí. Sự nghiệp của họ khựng lại.`, `A file on ${n}'s past deceptions reaches the press. Their career stalls.`); }
  if (how === 'broke') { p.wealth = Math.round((p.wealth || 0) * 0.15); p.att = 'neutral'; return L(`Các đối tác lần lượt rút vốn khỏi công ty của ${n}. Họ phải bán gần hết tài sản.`, `Partners pull out of ${n}'s company one by one. They sell almost everything.`); }
  if (how === 'office') { p.job = null; p.att = 'neutral'; return L(`${n} mất ghế sau một cuộc bỏ phiếu bất ngờ. Không ai nói tên bạn.`, `${n} loses their post in a surprise vote. Nobody mentions your name.`); }
  p.cut = true;
  return L(`${n} nhận một lời mời làm việc ở thành phố xa không thể từ chối. Họ chuyển đi trong tháng.`, `${n} gets a job offer in a faraway city too good to refuse. They move within the month.`);
}
function admirer(life, att) {
  const g = partnerGender(life, life);
  const p = randomPerson(life, life, { role: 'contact', gender: g, age: clamp(life.age + randint(life, -12, 8), 18, 80), closeness: 45 });
  p.orient = likesG('straight', g, life.gender) ? 'straight' : 'gay';
  p.att = att;
  life.people.push(p);
  return p;
}

// ───────── Hành động trên màn hình Quyền lực ─────────
export function powerActions(life) {
  const P = pw(life);
  if (life.age < 18) return [];
  const out = [];
  const lv = nextOffice(life);
  if (lv && !P.campaignYear) out.push([`run`, '🗳️', L(`Ra tranh cử: ${OFFICES[lv].name.vi}`, `Run for ${OFFICES[lv].name.en}`), canRun(life, lv) ? L(`Chi phí ${OFFICES[lv].cost}% thu nhập TB`, `Costs ${OFFICES[lv].cost}% of avg income`) : L(`Cần danh tiếng ${OFFICES[lv].fame} hoặc ảnh hưởng ${OFFICES[lv].infl}, từ ${OFFICES[lv].age} tuổi`, `Needs fame ${OFFICES[lv].fame} or influence ${OFFICES[lv].infl}, age ${OFFICES[lv].age}+`)]);
  if (P.office) out.push(['resign', '🚪', L('Từ chức', 'Step down'), '']);
  out.push(['infl', '🪙', L('Dùng ảnh hưởng', 'Spend influence'), L(`Đang có ${Math.round(P.infl)}`, `You have ${Math.round(P.infl)}`)]);
  if (!P.press) out.push(['press:paper', '📰', L('Mua một tờ báo', 'Buy a newspaper'), L('120% thu nhập TB', '120% of avg income')]);
  else if (P.press.kind === 'paper') out.push(['press:tv', '📺', L('Mua đài truyền hình', 'Buy a TV network'), L('400% thu nhập TB', '400% of avg income')]);
  if (P.club && P.club.rank < 5) out.push(['club:give', '🕯️', L('Đóng góp cho hội', 'Contribute to the circle'), L(`${CLUB_RANKS[P.club.rank].vi} · ${P.club.contrib}/${CLUB_NEED[P.club.rank + 1]}`, `${CLUB_RANKS[P.club.rank].en} · ${P.club.contrib}/${CLUB_NEED[P.club.rank + 1]}`)]);
  for (const [k, r] of Object.entries(RICH)) if ((k === 'jet' || k === 'island') ? !P.rich[k] : true) out.push([`rich:${k}`, r.em, L(`Mua ${r.name.vi.toLowerCase()}`, `Buy a ${r.name.en.toLowerCase()}`), L(`${r.cost}% thu nhập TB`, `${r.cost}% of avg income`)]);
  if (P.rich.art.length) out.push(['rich:sellart', '🔨', L('Bán đấu giá một tác phẩm', 'Auction an artwork'), '']);
  if (!P.clan) out.push(['clan:found', '🏯', L('Lập gia tộc', 'Found a family dynasty'), L('Cần có con hoặc địa vị từ Thượng lưu', 'Needs children or Upper-class status')]);
  else if (!P.clan.company) out.push(['clan:company', '🏢', L('Lập công ty gia đình', 'Start a family company'), L('100% thu nhập TB', '100% of avg income')]);
  if (!P.shadow) out.push(['shadow:start', '♟️', L('Bắt đầu xây quyền lực ngầm', 'Start building shadow power'), L('Cần địa vị từ "Có máu mặt" hoặc ảnh hưởng 20', 'Needs "Somebody" status or influence 20')]);
  else if (!P.shadow.ended) {
    if (P.heirId && byId(life, P.heirId)?.age >= 18 && !P.shadow.handed) out.push(['shadow:handover', '🗝️', L('Trao quyền ngầm cho người kế vị', 'Hand the shadow throne to your heir'), '']);
    out.push(['shadow:retire', '🌅', L('Rút lui hoàn toàn', 'Step away for good'), '']);
  }
  return out;
}
export function powerAction(life, st, act, arg) {
  const P = pw(life);
  if (life.dead || life.age < 18) return null;
  const pay = (n) => { if (life.money < u(life, n)) return false; life.money -= u(life, n); return true; };
  const broke = res(L('Bạn không đủ tiền.', "You can't afford it."), [], 'bad');
  const [k, sub] = act.split(':');
  if (k === 'run') { const lv = nextOffice(life); if (!lv) return null; const r = campaign(life, lv); if (r.event) P.campaignYear = life.age; return r; }
  if (k === 'resign') { P.office = 0; P.term = 0; return res(L('Bạn tổ chức họp báo, cảm ơn cử tri và bước xuống.', 'You hold a press conference, thank the voters and step down.'), fx(life, { happy: 3 })); }
  if (k === 'infl') return inflMenu(life);
  if (k === 'useinfl') return useInfl(life, sub);
  if (k === 'press') {
    if (sub === 'paper') { if (!pay(120)) return broke; P.press = { kind: 'paper', name: L('Nhật báo Bình Minh', 'The Daybreak Daily') }; return res(L('Bạn mua lại một tờ nhật báo đang khó khăn. Tòa soạn gọi bạn là "chủ mới".', 'You buy a struggling daily. The newsroom calls you "the new owner".'), fx(life, { fame: 3 }), 'good'); }
    if (sub === 'tv') { if (!pay(400)) return broke; P.press = { kind: 'tv', name: L('Kênh BM24', 'BM24 Network') }; return res(L('Đài truyền hình về tay bạn. Bản tin 7 giờ tối giờ có giọng điệu mới.', 'The TV network is yours. The 7pm news has a new tone.'), fx(life, { fame: 5 }), 'good'); }
  }
  if (k === 'club' && P.club) {
    if (!pay(15)) return broke;
    P.club.contrib += 15;
    return clubRankCheck(life) || res(L('Khoản đóng góp được ghi vào cuốn sổ bìa da. Không ai cảm ơn, nhưng ai cũng biết.', 'Your contribution goes into the leather ledger. Nobody says thanks, but everyone knows.'), fx(life, { karma: -1 }));
  }
  if (k === 'rich') {
    const r = RICH[sub];
    if (sub === 'sellart') { const a = P.rich.art.shift(); const v = Math.round(a.v); fx(life, { money: v }); return res(L(`Búa gõ ba lần. Tác phẩm của bạn được bán với giá ${v}% thu nhập trung bình.`, `Three knocks of the gavel. Your piece sells for ${v}% of the average income.`), [['money', u(life, v)]], v > 50 ? 'good' : 'bad'); }
    if (!r || ((sub === 'jet' || sub === 'island') && P.rich[sub])) return null;
    if (!pay(r.cost)) return broke;
    if (sub === 'art') { P.rich.art.push({ v: r.cost, age: life.age }); return res(L('Một bức tranh được treo trong phòng khách. Khách đến nhà đều đứng ngắm hơi lâu.', 'A painting goes up in your living room. Guests linger in front of it.'), fx(life, { happy: 4 }), 'good'); }
    if (sub === 'villa') { const left = VILLA_SPOTS.filter((v) => !P.rich.villas.some((x) => x.vi === v.vi)); if (!left.length) { life.money += u(life, r.cost); return res(L('Bạn đã có biệt thự ở mọi nơi mình thích.', 'You already own a villa everywhere you like.'), []); } const v = pick(life, left); P.rich.villas.push(v); return res(L(`Bạn mua một biệt thự ở ${v.vi}.`, `You buy a villa in ${v.en}.`), fx(life, { happy: 8 }), 'good'); }
    P.rich[sub] = true;
    return res(sub === 'jet' ? L('Máy bay riêng mang tên bạn trên đuôi. Từ nay không còn xếp hàng ở sân bay.', 'A private jet with your name on the tail. No more airport queues.') : L('Một hòn đảo nhỏ, một bến tàu, và không ai ngoài những người bạn mời.', 'A small island, a jetty, and nobody but the people you invite.'), fx(life, { happy: 12, fame: 3 }), 'good');
  }
  if (k === 'clan') return clanAction(life, sub, arg);
  if (k === 'heir') { const p = byId(life, sub); if (!p || p.role !== 'child' || !p.alive) return null; P.heirId = p.id; return res(L(`Bạn chọn ${nm(life, p)} làm người kế vị.`, `You name ${nm(life, p)} as your successor.`), [], 'good'); }
  if (k === 'mask') { if (!MASKS[arg] || !AUDIENCES[sub]) return null; P.masks[sub] = arg; return res(L(`Trước ${AUDIENCES[sub].vi.toLowerCase()}, bạn sẽ là người ${MASKS[arg].name.vi.toLowerCase()}.`, `With ${AUDIENCES[sub].en.toLowerCase()}, you'll be ${MASKS[arg].name.en.toLowerCase()}.`), []); }
  if (k === 'shadow') {
    if (sub === 'start') {
      if (P.shadow && !P.shadow.ended) return null;
      if (statusOf(life) < 2 && P.infl < 20) return res(L('Chưa ai biết bạn là ai. Quyền lực ngầm cần một chỗ đứng trước đã.', "Nobody knows who you are yet. Shadow power needs a foothold first."), [], 'bad');
      P.shadow = { exp: 5, biz: 0, love: 0, years: 0, councils: 0 };
      return res(L('Bạn mua một cuốn sổ đen và viết tên người đầu tiên. Từ đây, bạn không bao giờ đứng ở hàng đầu.', 'You buy a black notebook and write the first name. From now on, you never stand in the front row.'), fx(life, { willpower: 3 }), 'good');
    }
    if (!P.shadow || P.shadow.ended) return null;
    if (sub === 'handover') { const h = byId(life, P.heirId); if (!h || h.age < 18) return null; P.shadow.handed = true; P.shadow.ended = 'handed'; return res(L(`Bạn trao cuốn sổ đen cho ${nm(life, h)}. Bạn không nói gì, họ cũng không hỏi.`, `You hand the black notebook to ${nm(life, h)}. You say nothing; they ask nothing.`), fx(life, { happy: 6 }), 'good'); }
    if (sub === 'retire') { P.shadow.ended = 'retired'; for (const p of pawnsOf(life)) delete p.pawn; return res(L('Bạn đốt cuốn sổ đen trong lò sưởi. Một kỷ nguyên lặng lẽ khép lại.', 'You burn the black notebook in the fireplace. An era quietly ends.'), fx(life, { happy: 4, karma: 3 })); }
  }
  return null;
}
function inflMenu(life) {
  const P = pw(life);
  const opts = [
    ['scandal', L('Dập một vụ bê bối (−15, karma −3)', 'Make a scandal disappear (−15, karma −3)'), 15],
    ['school', L('Đưa con vào trường tốt (−10, karma −2)', 'Get your child into a top school (−10, karma −2)'), 10],
    ['promo', L('Xin một suất thăng chức (−20, karma −4)', 'Arrange a promotion (−20, karma −4)'), 20],
    ['record', L('Gỡ một rắc rối pháp lý (−30, karma −6)', 'Make a legal problem go away (−30, karma −6)'), 30],
    ['friend', L('Giúp một người bạn đang gặp khó (−8, karma +3)', 'Help a friend in trouble (−8, karma +3)'), 8],
  ];
  return modal('pw/infl', L(`Bạn có ${Math.round(P.infl)} điểm ảnh hưởng. Dùng vào việc gì?`, `You have ${Math.round(P.infl)} influence. What will you use it for?`), opts.map(([k, lb, c]) => ({ label: lb, outcomes: [oc('', {}, null, (lf) => { const r = useInfl(lf, k); return { uid: 'pw/infl2', text: r.text, choices: [{ label: L('Được', 'OK'), outcomes: [oc(r.text)] }] }; })] })).concat([{ label: L('Thôi', 'Never mind'), outcomes: [oc(L('Bạn giữ ảnh hưởng cho lúc cần hơn.', 'You save your influence for later.'))] }]));
}
function useInfl(life, k) {
  const P = pw(life);
  const cost = { scandal: 15, school: 10, promo: 20, record: 30, friend: 8 }[k];
  if (P.infl < cost) return res(L('Ảnh hưởng của bạn chưa đủ.', "You don't have enough influence."), [], 'bad');
  if (k === 'scandal') { P.infl -= cost; me(life).scandal = clamp(me(life).scandal - 35); fx(life, { karma: -3 }); return res(L('Vài cuộc điện thoại, và câu chuyện không còn ai nhắc.', 'A few phone calls, and nobody mentions the story again.'), [], 'good'); }
  if (k === 'school') { const kids = people(life, 'child').filter((c) => c.age >= 5 && c.age <= 17); if (!kids.length) return res(L('Bạn không có con trong tuổi đi học.', 'You have no school-age children.'), []); P.infl -= cost; for (const c of kids) c.smarts = clamp(c.smarts + 6); fx(life, { karma: -2 }); return res(L('Hồ sơ nhập học được duyệt nhanh bất thường.', 'The admission goes through unusually fast.'), [], 'good'); }
  if (k === 'promo') { if (!life.job) return res(L('Bạn đang không đi làm.', "You're not employed."), []); P.infl -= cost; life.job.perf = clamp((life.job.perf || 50) + 30); life.job.salary = Math.round(life.job.salary * 1.15); fx(life, { karma: -4 }); return res(L('Ban giám đốc bất ngờ nhận ra tài năng của bạn.', 'The board suddenly notices your talent.'), [], 'good'); }
  if (k === 'record') { if (!life.record) return res(L('Bạn không có rắc rối pháp lý nào.', 'You have no legal trouble.'), []); P.infl -= cost; life.record = false; fx(life, { karma: -6 }); return res(L('Một tập hồ sơ được xếp vào ngăn kéo sâu nhất.', 'A file ends up in the deepest drawer.'), [], 'good'); }
  P.infl -= cost;
  const f = life.people.find((p) => p.alive && ['friend', 'bestie'].includes(p.role));
  if (f) f.closeness = clamp(f.closeness + 15);
  fx(life, { karma: 3, happy: 3 });
  return res(f ? L(`${nm(life, f)} không bao giờ biết vì sao rắc rối của họ tự nhiên được giải quyết.`, `${nm(life, f)} never learns why their problem suddenly sorted itself out.`) : L('Bạn giúp một người lạ đang gặp khó. Họ khóc ở quầy giấy tờ.', 'You help a stranger in trouble. They cry at the counter.'), [], 'good');
}
function clubRankCheck(life) {
  const C = pw(life).club;
  if (C.rank < 5 && C.contrib >= CLUB_NEED[C.rank + 1]) { life.queue.push({ sys: 'pw_clubrank' }); return res(L('Bạn nhận được một phong bì niêm phong sáp: hội muốn thử thách bạn.', 'You receive a wax-sealed envelope: the circle wants to test you.'), [], 'good'); }
  return null;
}
function clanAction(life, sub, arg) {
  const P = pw(life);
  if (sub === 'found') {
    if (P.clan) return null;
    if (!people(life, 'child').length && statusOf(life) < 3) return res(L('Một gia tộc cần người nối dõi hoặc một cái tên đủ nặng.', 'A dynasty needs heirs or a name with weight.'), [], 'bad');
    P.clan = { prestige: 20, company: false, matches: 0 };
    return res(L(`Bạn cho làm gia phả, đặt bàn thờ tổ và đặt tên cho dòng họ: "${life.last}".`, `You commission a family tree, set up an ancestral shrine and name the house: "${life.last}".`), fx(life, { fame: 2 }), 'good');
  }
  if (!P.clan) return null;
  if (sub === 'company') { if (P.clan.company) return null; if (life.money < u(life, 100)) return res(L('Bạn không đủ tiền.', "You can't afford it."), [], 'bad'); life.money -= u(life, 100); P.clan.company = true; P.clan.prestige = clamp(P.clan.prestige + 10); return res(L(`Tập đoàn ${life.last} ra đời. Logo là chữ cái đầu của họ bạn.`, `The ${life.last} Group is born. The logo is your family initial.`), [], 'good'); }
  const kid = byId(life, arg);
  if (!kid || kid.role !== 'child' || !kid.alive) return null;
  if (sub === 'join') {
    if (!P.clan.company || kid.age < 18 || kid.inCompany) return null;
    if (chance(life, clamp(kid.closeness / 100 + 0.1, 0.1, 0.9))) { kid.inCompany = true; kid.closeness = clamp(kid.closeness + 5); P.clan.prestige = clamp(P.clan.prestige + 3); return res(L(`${nm(life, kid)} nhận lời vào làm ở công ty gia đình.`, `${nm(life, kid)} agrees to join the family company.`), [], 'good'); }
    kid.closeness = clamp(kid.closeness - 4);
    return res(L(`${nm(life, kid)} muốn tự lập nghiệp. Bạn tôn trọng điều đó.`, `${nm(life, kid)} wants to make their own way. You respect that.`), []);
  }
  if (sub === 'match') {
    if (kid.age < 18 || kid.wed) return null;
    // Con trưởng thành tự quyết định: đây chỉ là lời giới thiệu, con có quyền từ chối.
    const fam = pick(life, [L('nhà Trịnh, chủ chuỗi khách sạn', 'the Trinh family, hotel owners'), L('nhà Lâm, dòng họ luật sư', 'the Lam family, a line of lawyers'), L('nhà Vũ, gia tộc ngân hàng', 'the Vu family, a banking house'), L('nhà Hà, chủ nhiều vườn trà', 'the Ha family, tea estate owners')]);
    if (chance(life, clamp(kid.closeness / 110 + 0.15, 0.1, 0.85))) {
      kid.wed = fam; P.clan.matches++; P.clan.prestige = clamp(P.clan.prestige + 10); P.infl = clamp(P.infl + 8);
      return res(L(`${nm(life, kid)} gặp người con của ${fam.vi}, và hai người thật sự hợp nhau. Đám cưới làm cả thành phố chú ý.`, `${nm(life, kid)} meets the heir of ${fam.en}, and they genuinely click. The wedding makes the whole city take notice.`), fx(life, { happy: 8, money: -20 }), 'good');
    }
    kid.closeness = clamp(kid.closeness - 10);
    return res(L(`${nm(life, kid)} từ chối: "Con sẽ tự chọn người con yêu."`, `${nm(life, kid)} refuses: "I'll choose who I love myself."`), fx(life, { happy: -3 }), 'bad');
  }
  return null;
}

// ───────── Hành động với từng người (quân cờ, kẻ thù, người muốn có con) ─────────
export function powerPersonActions(life, p) {
  const out = [];
  if (!p.alive || life.age < 18 || p.age < 18) return out;
  const S = pw(life).shadow;
  if (S && !S.ended) {
    if (p.pawn) out.push(['pw_order', L('Giao việc', 'Give an order')], ['pw_reward', L('Thưởng', 'Reward')], ['pw_test', L('Thử lòng trung thành', 'Test their loyalty')], ['pw_free', L('Trả tự do', 'Release them')]);
    else if (!FAMILY.includes(p.role) && p.role !== 'teacher') out.push(['pw_recruit', L('Thu phục làm quân cờ', 'Recruit as a pawn')]);
    if (['hate', 'rival'].includes(attOf(p)) && !p.pawn && !FAMILY.includes(p.role)) out.push(['pw_defeat', L('Hạ bệ (không bạo lực)', 'Bring them down (no violence)')]);
  }
  if (attOf(p) === 'heir' && heirOK(life, p)) out.push(['pw_heirtalk', L('Nói chuyện về con cái', 'Talk about having a child')]);
  if (p.role === 'child' && pw(life).clan) {
    if (p.age >= 18 && !p.wed) out.push(['pw_match', L('Giới thiệu đối tượng môn đăng hộ đối', 'Introduce a suitable match')]);
    if (p.age >= 18 && pw(life).clan.company && !p.inCompany) out.push(['pw_join', L('Mời vào công ty gia đình', 'Invite into the family company')]);
  }
  if (p.role === 'child' && pw(life).heirId !== p.id) out.push(['pw_heir', L('Chọn làm người kế vị', 'Name as successor')]);
  return out;
}
export function doPowerPersonAction(life, st, p, act) {
  const S = pw(life).shadow;
  const n = nm(life, p);
  if (act === 'pw_match') return clanAction(life, 'match', p.id);
  if (act === 'pw_join') return clanAction(life, 'join', p.id);
  if (act === 'pw_heir') return powerAction(life, st, `heir:${p.id}`);
  if (act === 'pw_heirtalk') return { event: heirEvent(life, st, p) };
  if (!S || S.ended) return null;
  if (act === 'pw_recruit') {
    const rom = ROM.includes(p.role) || ['crush', 'like', 'affair', 'heir'].includes(attOf(p));
    const go = (via, base, cost, karma) => ({ label: L(`${PAWN_VIA[via].em} ${PAWN_VIA[via].name.vi}`, `${PAWN_VIA[via].em} ${PAWN_VIA[via].name.en}`), outcomes: [oc('', {}, null, (lf) => {
      if (cost && lf.money < u(lf, cost)) return { uid: 'pw/r', text: L('Bạn không đủ tiền.', "You can't afford it."), choices: [{ label: L('Được', 'OK'), outcomes: [oc(L('Bạn không đủ tiền.', "You can't afford it."))] }] };
      if (cost) lf.money -= u(lf, cost);
      if (karma) lf.stats.karma = clamp(lf.stats.karma + karma);
      const ok = chance(lf, agree(lf, p, base));
      if (ok) p.pawn = { via, loyal: { love: 70, favor: 60, money: 45, secret: 35 }[via], dep: { love: 45, favor: 40, money: 55, secret: 75 }[via], since: lf.age };
      else p.closeness = clamp(p.closeness - 6);
      const t = ok ? L(`${n} gật đầu. Từ hôm nay, tên họ nằm trong cuốn sổ đen của bạn.`, `${n} nods. From today, their name is in your black notebook.`) : L(`${n} lịch sự từ chối và đổi chủ đề.`, `${n} politely declines and changes the subject.`);
      return { uid: 'pw/r', text: t, choices: [{ label: L('Được', 'OK'), outcomes: [oc(t)] }] };
    })] });
    const ch = [go('money', 0.35 + (100 - (p.fidelity ?? 60)) / 300, 10, 0), go('favor', p.closeness / 140, 0, 0)];
    if (rom) ch.push(go('love', 0.55, 0, -1));
    ch.push(go('secret', 0.25 + life.stats.smarts / 300, 0, -5));
    return modal('pw/recruit', L(`Bạn muốn ${n} làm việc cho mình. Bằng cách nào?`, `You want ${n} working for you. How?`), ch);
  }
  if (!p.pawn && act !== 'pw_defeat') return null;
  if (act === 'pw_order') {
    const k = pw(life);
    const e = 0.6 + p.pawn.loyal / 250;
    k.infl = clamp(k.infl + Math.round(5 * e)); S.exp = clamp(S.exp + 2); p.pawn.dep = clamp(p.pawn.dep + 3);
    return res(pick(life, [L(`${n} mang về một tập tài liệu mà không ai khác có.`, `${n} brings back a folder nobody else has.`), L(`${n} nói đúng một câu trong cuộc họp hội đồng. Mọi thứ xoay theo ý bạn.`, `${n} says exactly one sentence in the board meeting. Everything turns your way.`), L(`${n} sắp xếp để bạn ngồi cạnh đúng người ở bữa tiệc.`, `${n} arranges for you to sit next to exactly the right person at dinner.`)]), [], 'good');
  }
  if (act === 'pw_reward') {
    if (life.money < u(life, 5)) return res(L('Bạn không đủ tiền.', "You can't afford it."), [], 'bad');
    life.money -= u(life, 5); p.pawn.loyal = clamp(p.pawn.loyal + 12); p.closeness = clamp(p.closeness + 6);
    return res(L(`${n} nhận món quà, cúi đầu cảm ơn lâu hơn bình thường.`, `${n} accepts the gift and bows a little longer than usual.`), [['money', -u(life, 5)]], 'good');
  }
  if (act === 'pw_test') { p.pawnKnown = true; return res(L(`Bạn để lộ một tin giả cho ${n}. Trung thành: ${Math.round(p.pawn.loyal)}, phụ thuộc: ${Math.round(p.pawn.dep)}.`, `You feed ${n} a fake leak. Loyalty: ${Math.round(p.pawn.loyal)}, dependence: ${Math.round(p.pawn.dep)}.`), []); }
  if (act === 'pw_free') { delete p.pawn; delete p.post; p.closeness = clamp(p.closeness + 5); return res(L(`Bạn xé trang có tên ${n}. Họ nhẹ nhõm thấy rõ.`, `You tear out the page with ${n}'s name. They look visibly relieved.`), fx(life, { karma: 2 })); }
  if (act === 'pw_defeat') {
    const how = (k) => ({ label: L(`${DEFEAT[k].vi}`, `${DEFEAT[k].en}`), outcomes: [oc('', { karma: -3 }, (lf) => { pw(lf).shadow.exp = clamp(pw(lf).shadow.exp + 8); }, (lf) => { const t = defeat(lf, p, k); return { uid: 'pw/d', text: t, choices: [{ label: L('Được', 'OK'), outcomes: [oc(t)] }] }; })] });
    return modal('pw/defeat', L(`${n} đã cản đường bạn quá lâu. Bạn chọn cách nào? Không bao giờ có bạo lực.`, `${n} has stood in your way too long. Which way? Never violence.`), ['scandal', 'broke', 'office', 'leave'].map(how).concat([{ label: L('Tha cho họ', 'Let it go'), outcomes: [oc(L('Bạn gấp hồ sơ lại. Không đáng.', "You close the file. Not worth it."), { karma: 3 })] }]));
  }
  return null;
}

// ───────── 342 · Khao khát nối dõi ─────────
function heirEvent(life, st, p) {
  const n = nm(life, p);
  const adult = !!st?.adult25;
  return {
    uid: 'pw/heir',
    text: adult ? L(`${n} nắm tay bạn, nói thật chậm: "Mình muốn có một đứa con với bạn. Không phải vì ai bảo. Vì mình muốn."`, `${n} takes your hand and says slowly: "I want to have a child with you. Not because anyone asked. Because I want to."`) : L(`${n} nói nghiêm túc: họ muốn có con với bạn.`, `${n} says, seriously, that they want to have a child with you.`),
    choices: [
      { label: L('Đồng ý', 'Say yes'), outcomes: [oc(adult ? L('Những tháng sau đó, hai người không cần lý do để về nhà sớm.', 'For months afterward, neither of you needs an excuse to come home early.') : L('Hai người quyết định thử.', 'You decide to try.'), { happy: 8 }, (lf) => { if (!ROM.includes(p.role)) romance(lf, p); setFlag(lf, 'recent_intimate'); if (tryConceive(lf, p, 0.7)) p.att = 'like'; prof(p).fire = clamp(prof(p).fire + 15); })] },
      { label: L('Ký thỏa thuận nuôi con', 'Sign a co-parenting agreement'), outcomes: [oc(L('Luật sư soạn một bản thỏa thuận rõ ràng: con là của cả hai, bạn chu cấp và đến thăm.', 'A lawyer drafts a clear agreement: the child is both of yours, you support and visit.'), { money: -3 }, (lf) => { p.contract = true; setFlag(lf, 'recent_intimate'); if (tryConceive(lf, p, 0.65)) p.att = 'friendly'; })] },
      { label: L('Để sau', 'Not yet'), outcomes: [oc(L(`${n} gật đầu: "Mình chờ được."`, `${n} nods: "I can wait."`))] },
      { label: L('Từ chối', 'Decline'), outcomes: [oc(L(`${n} im lặng một lúc rồi mỉm cười buồn.`, `${n} is quiet for a while, then smiles sadly.`), {}, () => { p.att = ROM.includes(p.role) ? 'like' : 'friendly'; p.closeness = clamp(p.closeness - 5); })] },
    ],
  };
}

// ───────── Mỗi năm ─────────
export function powerYear(life, st) {
  const P = pw(life);
  const gdp = country(life).gdp;
  const pushes = [];
  const fm = freqOf(st).m;
  updateAura(life);
  if (life.age < 18) return;
  delete P.campaignYear;
  // Ảnh hưởng
  P.infl = clamp(P.infl - 3 + P.office * 3 + (P.press ? (P.press.kind === 'tv' ? 8 : 4) : 0) + (P.club ? P.club.rank * 2 : 0) + Math.min(10, pawnsOf(life).length) * 0.6 + (P.clan ? P.clan.prestige / 25 : 0) + (P.masks.elite !== 'genuine' ? 1 : 0));
  // Chức vụ
  if (P.office) {
    life.money += P.office * 0.25 * gdp;
    P.approval = clamp(P.approval + randint(life, -6, 4) - (life.ix?.scandal || 0) / 40);
    P.term--;
    if (chance(life, 0.55)) pushes.push({ sys: 'pw_policy', i: randint(life, 0, POLICIES.length - 1) });
    if (P.term <= 0) pushes.unshift({ sys: 'pw_reelect' });
    else if ((life.ix?.scandal || 0) > 70 && chance(life, 0.3)) pushes.push({ sys: 'pw_resign' });
    if (P.office >= 6) life.counts.leader = 1;
  }
  // Báo chí
  if (P.press) { me(life).scandal = clamp(me(life).scandal - (P.press.kind === 'tv' ? 8 : 5)); life.stats.fame = clamp(life.stats.fame + 1); life.money += gdp * (P.press.kind === 'tv' ? 0.4 : 0.1); }
  const heat = Math.max(life.ix?.scandal || 0, P.shadow && !P.shadow.ended ? P.shadow.exp : 0);
  if (heat >= 40 && chance(life, 0.12 * fm)) pushes.push({ sys: 'pw_journo' });
  // Hội kín
  if (!P.club && !P.clubNo && statusOf(life) >= 3 && chance(life, 0.25)) pushes.push({ sys: 'pw_clubinv' });
  if (P.club && chance(life, 0.5 * fm)) pushes.push({ sys: 'pw_club', i: randint(life, 0, 3) });
  // Siêu giàu: bảo trì và giá tranh
  const up = (P.rich.jet ? RICH.jet.up : 0) + (P.rich.island ? RICH.island.up : 0) + P.rich.villas.length * RICH.villa.up;
  life.money -= u(life, up);
  for (const a of P.rich.art) a.v = Math.max(5, a.v * (0.85 + rand(life) * 0.4));
  if (P.rich.jet && chance(life, 0.2)) addLog(life, pick(life, [L('Bạn bay đến một thành phố khác chỉ để ăn trưa.', 'You fly to another city just for lunch.'), L('Phi công riêng hỏi điểm đến. Bạn nói: "Chỗ nào có nắng."', 'Your pilot asks where to. You say: "Somewhere sunny."')]), 'good');
  // Gia tộc
  if (P.clan) { P.clan.prestige = clamp(P.clan.prestige + (P.clan.company ? 2 : 0) + people(life, 'child').filter((c) => c.inCompany).length - 1); if (P.clan.company) life.money += gdp * (0.3 + people(life, 'child').filter((c) => c.inCompany).length * 0.15); }
  // Mặt nạ
  const fake = Object.values(P.masks).filter((m) => m !== 'genuine').length;
  if (fake) life.stats.happy = clamp(life.stats.happy - fake);
  if (P.masks.work === 'perfect' && life.job) life.job.perf = clamp((life.job.perf || 50) + 3);
  if (P.masks.online === 'charming' && life.social) life.social.followers = Math.round((life.social.followers || 0) * 1.08);
  if (P.masks.family === 'tough') for (const p of life.people) if (p.alive && FAMILY.includes(p.role) && p.role !== 'pet') p.closeness = clamp(p.closeness - 1);
  if (fake >= 2 && chance(life, 0.08 * fake)) pushes.push({ sys: 'pw_masks' });
  // Quyền lực ngầm
  const S = P.shadow;
  if (S && !S.ended) {
    S.years++;
    const ps = pawnsOf(life);
    life.money += gdp * S.biz * 0.4;
    S.exp = clamp(S.exp + ps.length * 0.5 + S.biz + S.love * 0.5 - (P.press ? 4 : 0) - 2);
    for (const p of ps) { p.pawn.loyal = clamp(p.pawn.loyal + (p.pawn.via === 'love' ? 1 : p.pawn.via === 'money' ? -2 : p.pawn.via === 'secret' ? -3 : 0)); p.pawn.dep = clamp(p.pawn.dep + 1); }
    if (ps.length >= 3) pushes.unshift({ sys: 'pw_council', step: 1 });
    if (S.exp >= 75 && chance(life, 0.3)) pushes.push({ sys: 'pw_exposed' });
    life.counts.shadowMax = Math.max(life.counts.shadowMax || 0, shadowPower(life));
  }
  // Hào quang: người khác mềm mỏng hơn, người mới dễ quý mến bạn
  const tier = life.auraT;
  if (tier >= 1) {
    for (const p of life.people) {
      if (!p.alive || p.role === 'pet' || p.cut) continue;
      const a = attOf(p);
      if (a === 'hate' && chance(life, 0.08 * tier)) p.att = 'rival';
      else if (a === 'rival' && chance(life, 0.06 * tier)) p.att = 'neutral';
      if (!adultOK(life, p) || ROM.includes(p.role)) continue;
      if (!p.auraSeen) {
        p.auraSeen = true;
        if (a === 'neutral' && chance(life, 0.12 * tier)) p.att = likes(life, p, life.gender) && tier >= 2 && chance(life, 0.4) ? 'crush' : 'friendly';
      } else if (a === 'neutral' && chance(life, 0.03 * tier)) p.att = 'friendly';
      else if (a === 'friendly' && tier >= 2 && likes(life, p, life.gender) && chance(life, 0.03 * tier)) p.att = 'crush';
    }
    if (life.harem && members(life).length) { const h = hstate(life); h.harmony = clamp(h.harmony + tier); }
  }
  // 342: khao khát nối dõi
  const heirWant = tier >= 3 || P.heirAll;
  if (heirWant) {
    for (const p of life.people) {
      if (attOf(p) === 'heir' || !heirOK(life, p) || p.cut) continue;
      const a = attOf(p);
      const warm = ROM.includes(p.role) || ['crush', 'like', 'affair'].includes(a) || inHarem(life, p);
      if (P.heirAll ? warm || a === 'friendly' : warm && chance(life, tier >= 4 ? 0.12 : 0.06)) p.att = 'heir';
    }
  }
  for (const p of life.people) if (p.att === 'heir' && !heirOK(life, p)) p.att = ROM.includes(p.role) && p.age >= 18 ? 'like' : 'friendly';
  const heirs = life.people.filter((p) => attOf(p) === 'heir' && heirOK(life, p) && !p.cut);
  const hh = heirs.filter((p) => inHarem(life, p));
  if (hh.length >= 2 && chance(life, 0.3 * fm)) pushes.push({ sys: 'pw_heirrace' });
  else for (const p of heirs.slice(0, 3)) if (chance(life, 0.3 * fm)) pushes.push({ sys: 'pw_heir', id: p.id });
  // Ribbon "Cha/Mẹ của cả một thế hệ"
  const kids = life.people.filter((p) => p.role === 'child');
  const moms = new Set(kids.map((k) => k.otherParentId).filter(Boolean));
  if (kids.length >= 10 && moms.size >= 5) life.counts.generation = 1;
  const cap = (freqOf(st).cap || 3) + 1;
  for (const x of pushes.slice(0, cap)) life.queue.push(x);
}

// ───────── Sự kiện hệ thống ─────────
const ok1 = (t) => [{ label: L('Được', 'OK'), outcomes: [oc(t)] }];
export function buildPowerSys(life, item, st) {
  if (!item.sys || !item.sys.startsWith('pw_')) return null;
  const P = pw(life);
  const s = item.sys;
  if (s === 'pw_preg2') {
    const p = byId(life, item.otherId);
    const drop = () => { life.pregs = (life.pregs || []).filter((x) => x.otherId !== item.otherId); };
    if (!p || !p.alive) { drop(); return null; }
    const n = nm(life, p);
    const born = (kind) => (lf) => { const kid = addChild(lf, p.id); if (kind === 'support') { kid.supportOnly = true; kid.closeness = 35; } if (kind === 'together') p.closeness = clamp(p.closeness + 10); drop(); if (attOf(p) === 'heir') p.att = ROM.includes(p.role) ? 'like' : 'friendly'; };
    return sev(`sys/pw_preg2`, p.contract ? L(`${n} sinh con theo đúng thỏa thuận hai người đã ký.`, `${n} gives birth, just as your agreement said.`) : L(`${n} báo tin đang mang thai con của bạn.`, `${n} tells you they're pregnant with your child.`), [
      { label: L('Cùng nuôi con', 'Raise the child together'), outcomes: [oc(L('Một sinh linh mới chào đời. Bạn bế con lần đầu, tay hơi run.', 'A new life arrives. You hold the baby for the first time, hands a little shaky.'), { happy: 8, money: -12 }, born('together'))] },
      { label: p.contract ? L('Theo thỏa thuận: chu cấp và thăm con', 'As agreed: support and visit') : L('Chu cấp tiền nuôi con', 'Pay child support'), outcomes: [oc(L('Bạn chu cấp đều đặn mỗi năm.', 'You send support every year.'), { happy: 3 }, born('support'))] },
      ...(p.contract ? [] : [{ label: L('Phủ nhận', 'Deny it'), outcomes: [oc(L('Họ cắt liên lạc với bạn. Đứa trẻ lớn lên không biết mặt bạn.', 'They cut off contact. The child grows up never knowing you.'), { karma: -10, happy: -3 }, () => { drop(); p.closeness = clamp(p.closeness - 40); p.att = 'hate'; })] }]),
    ]);
  }
  if (s === 'pw_heir') {
    const p = byId(life, item.id);
    if (!p || !heirOK(life, p) || attOf(p) !== 'heir') return null;
    const ev = heirEvent(life, st, p);
    return { ...ev, uid: 'sys/pw_heir', sys: true };
  }
  if (s === 'pw_heirrace') {
    const hs = members(life).filter((p) => attOf(p) === 'heir' && heirOK(life, p));
    if (hs.length < 2) return null;
    const top = hs.slice().sort((a, b) => hm(b).favor - hm(a).favor)[0];
    return sev('sys/pw_heirrace', L(`${hs.length} người trong hậu cung cùng muốn sinh người thừa kế cho bạn. Không khí trong nhà căng như dây đàn.`, `${hs.length} members of your harem all want to bear your heir. The house is tense as a bowstring.`), [
      { label: L('Để mọi chuyện tự nhiên', 'Let nature decide'), outcomes: [oc(L('Một năm bận rộn và đầy những ánh nhìn so kè.', 'A busy year, full of competitive glances.'), { happy: 6 }, (lf) => { for (const p of hs) tryConceive(lf, p, 0.4); hstate(lf).harmony = clamp(hstate(lf).harmony - 10); })] },
      { label: L(`Chọn ${nm(life, top)}`, `Choose ${nm(life, top)}`), outcomes: [oc(L(`${nm(life, top)} rạng rỡ. Những người khác cố giấu nỗi thất vọng.`, `${nm(life, top)} beams. The others try to hide their disappointment.`), { happy: 4 }, (lf) => { tryConceive(lf, top, 0.7); for (const p of hs) if (p !== top) hm(p).mood = clamp(hm(p).mood - 15); })] },
      { label: L('Tuyên bố mọi đứa con đều bình đẳng', 'Declare every child equal'), outcomes: [oc(L('Bạn nói: "Không ai là người thừa kế duy nhất. Tất cả đều là con tôi." Căng thẳng dịu xuống.', 'You say: "There is no single heir. They are all my children." The tension eases.'), { karma: 3 }, (lf) => { for (const p of hs) tryConceive(lf, p, 0.3); hstate(lf).harmony = clamp(hstate(lf).harmony + 10); })] },
    ]);
  }
  if (s === 'pw_policy') {
    if (!P.office) return null;
    const [q, opts] = POLICIES[item.i % POLICIES.length];
    return sev('sys/pw_policy', L(`Với tư cách ${OFFICES[P.office].name.vi}: ${q.vi}`, `As ${OFFICES[P.office].name.en}: ${q.en}`), opts.map(([lb, e, ap]) => ({ label: lb, outcomes: [oc(ap >= 0 ? L('Người dân đón nhận quyết định này.', 'People welcome the decision.') : L('Có người không hài lòng, nhưng bạn giữ quan điểm.', "Some aren't happy, but you hold your ground."), e, (lf) => { pw(lf).approval = clamp(pw(lf).approval + ap); })] })));
  }
  if (s === 'pw_reelect') {
    if (!P.office) return null;
    const p = clamp(P.approval / 100 + (life.auraT || 0) * 0.03, 0.08, 0.92);
    return sev('sys/pw_reelect', L(`Nhiệm kỳ ${OFFICES[P.office].name.vi} kết thúc. Tỷ lệ ủng hộ: ${Math.round(P.approval)}%.`, `Your term as ${OFFICES[P.office].name.en} ends. Approval: ${Math.round(P.approval)}%.`), [
      { label: L('Tái tranh cử', 'Run again'), outcomes: [oc(L('Bạn tái đắc cử thêm một nhiệm kỳ.', 'You win another term.'), { happy: 8 }, (lf) => { pw(lf).term = 4; }, null, p), oc(L('Bạn thua. Bạn dọn văn phòng trong một buổi chiều.', 'You lose. You clear your office in one afternoon.'), { happy: -6 }, (lf) => { pw(lf).office = 0; }, null, 1 - p)] },
      { label: L('Rút lui', 'Step aside'), outcomes: [oc(L('Bạn rời chính trường trong tiếng vỗ tay.', 'You leave politics to applause.'), { happy: 4, karma: 2 }, (lf) => { pw(lf).office = 0; })] },
    ]);
  }
  if (s === 'pw_resign') {
    if (!P.office) return null;
    return sev('sys/pw_resign', L('Báo chí đòi bạn từ chức vì những tin đồn đời tư.', 'The press demands your resignation over rumours about your private life.'), [
      { label: L('Từ chức', 'Resign'), outcomes: [oc(L('Bạn từ chức. Tin đồn nguội đi nhanh hơn bạn tưởng.', 'You resign. The rumours cool faster than you expected.'), { happy: -5 }, (lf) => { pw(lf).office = 0; me(lf).scandal = clamp(me(lf).scandal - 20); })] },
      { label: L('Bám ghế, xin lỗi công khai', 'Stay on, apologise publicly'), outcomes: [oc(L('Bạn giữ được ghế, nhưng tỷ lệ ủng hộ lao dốc.', 'You keep the seat, but approval plunges.'), { fame: 2 }, (lf) => { pw(lf).approval = clamp(pw(lf).approval - 20); })] },
    ]);
  }
  if (s === 'pw_journo') {
    let j = P.journo && byId(life, P.journo);
    if (!j || !j.alive) { j = randomPerson(life, life, { role: 'contact', age: clamp(life.age + randint(life, -15, 5), 25, 70), closeness: 25 }); j.journo = true; j.job = L('Nhà báo điều tra', 'Investigative journalist'); life.people.push(j); P.journo = j.id; }
    const n = nm(life, j);
    const S = P.shadow && !P.shadow.ended ? P.shadow : null;
    const bump = (d) => (lf) => { if (S) S.exp = clamp(S.exp + d); else me(lf).scandal = clamp(me(lf).scandal + d); };
    return sev('sys/pw_journo', L(`Nhà báo điều tra ${n} đang đào bới về bạn. Họ gửi email xin phỏng vấn.`, `Investigative journalist ${n} is digging into you. They email asking for an interview.`), [
      { label: L('Nhận phỏng vấn, trả lời thẳng thắn', 'Give an honest interview'), outcomes: [oc(L('Bài báo khắt khe nhưng công bằng. Nhiều người tôn trọng bạn hơn.', 'The piece is tough but fair. More people respect you.'), { karma: 4, fame: 2 }, bump(-10))] },
      { label: L('Kiện tội phỉ báng', 'Sue for defamation'), outcomes: [oc(L('Bạn thắng kiện. Tòa soạn phải đính chính.', 'You win. The paper prints a correction.'), { money: -10 }, bump(-15), null, 0.5), oc(L('Bạn thua kiện, và vụ kiện còn khiến câu chuyện lan rộng hơn.', 'You lose, and the lawsuit spreads the story further.'), { money: -15, fame: 3 }, bump(12), null, 0.5)] },
      ...(life.money > u(life, 150) ? [{ label: L('Mua lại tòa soạn của họ', 'Buy their outlet'), outcomes: [oc(L(`Tòa soạn đổi chủ. ${n} được giao chuyên mục ẩm thực.`, `The outlet changes hands. ${n} is moved to the food column.`), { money: -150, karma: -4 }, (lf) => { bump(-25)(lf); if (!pw(lf).press) pw(lf).press = { kind: 'paper', name: L('Nhật báo Bình Minh', 'The Daybreak Daily') }; })] }] : []),
      { label: L('Lờ đi', 'Ignore it'), outcomes: [oc(L('Bài báo đăng mà không có tiếng nói của bạn.', 'The story runs without your side.'), { fame: 1 }, bump(10))] },
    ]);
  }
  if (s === 'pw_clubinv') {
    if (P.club) return null;
    return sev('sys/pw_clubinv', L(`Một tấm thiệp đen, chữ bạc: "${CLUB_NAME.vi} trân trọng mời ngài." Không có địa chỉ người gửi.`, `A black card, silver lettering: "${CLUB_NAME.en} cordially invites you." No return address.`), [
      { label: L('Nhận lời', 'Accept'), outcomes: [oc(L('Bạn được dẫn qua ba cánh cửa và một mật khẩu. Bên trong là những gương mặt bạn chỉ thấy trên báo.', 'You are led through three doors and a password. Inside are faces you only know from the news.'), { happy: 6 }, (lf) => { pw(lf).club = { rank: 0, contrib: 0 }; })] },
      { label: L('Từ chối', 'Decline'), outcomes: [oc(L('Bạn đốt tấm thiệp. Họ sẽ không mời lần hai.', "You burn the card. They won't ask twice."), {}, (lf) => { pw(lf).clubNo = true; })] },
    ]);
  }
  if (s === 'pw_club') {
    if (!P.club) return null;
    const v = [
      [L('Bữa tối thường niên của hội, mọi người đeo mặt nạ bạc.', "The circle's annual dinner. Everyone wears silver masks."), [[L('Trò chuyện với người ngồi cạnh', 'Talk to the person beside you'), { happy: 4 }, 5, (lf) => { const p = randomPerson(lf, lf, { role: 'contact', age: clamp(lf.age + randint(lf, -10, 15), 25, 85), closeness: 45 }); p.elite = true; p.wealth = country(lf).gdp * randint(lf, 50, 400); lf.people.push(p); }], [L('Lặng lẽ quan sát', 'Quietly observe'), { smarts: 2 }, 3]]],
      [L('Một thành viên cấp cao nhờ bạn một việc nhỏ.', 'A senior member asks you a small favour.'), [[L('Giúp ngay', 'Help right away'), { karma: -1 }, 12], [L('Hỏi đổi lại được gì', 'Ask what you get in return'), { money: 5 }, 4], [L('Từ chối khéo', 'Decline gracefully'), {}, 0]]],
      [L('Hội bỏ phiếu chọn người được giúp đỡ năm nay.', 'The circle votes on who to back this year.'), [[L('Bầu cho người tài nhưng nghèo', 'Vote for the talented outsider'), { karma: 3 }, 6], [L('Bầu cho người có quan hệ', 'Vote for the well-connected one'), { money: 3 }, 6]]],
      [L('Đêm khiêu vũ mặt nạ của hội.', "The circle's masquerade ball."), [[L('Nhảy đến sáng', 'Dance till dawn'), { happy: 8 }, 4], [L('Dùng dịp này kết giao', 'Use it to network'), { fame: 2 }, 7]]],
    ][item.i % 4];
    return sev('sys/pw_club', L(`${CLUB_NAME.vi}: ${v[0].vi}`, `${CLUB_NAME.en}: ${v[0].en}`), v[1].map(([lb, e, c, run]) => ({ label: lb, outcomes: [oc(L('Cuốn sổ bìa da ghi thêm một dòng về bạn.', 'The leather ledger gains another line about you.'), e, (lf) => { pw(lf).club.contrib += c; pw(lf).infl = clamp(pw(lf).infl + 2); if (run) run(lf); clubRankCheck(lf); })] })));
  }
  if (s === 'pw_clubrank') {
    const C = P.club;
    if (!C || C.rank >= 5 || C.contrib < CLUB_NEED[C.rank + 1]) return null;
    const nx = CLUB_RANKS[C.rank + 1];
    return sev('sys/pw_clubrank', L(`Thử thách để lên ${nx.vi}: bạn phải giữ một bí mật của hội suốt một năm, dù bị dò hỏi.`, `The test to become ${nx.en}: keep one of the circle's secrets for a year, no matter who asks.`), [
      { label: L('Chấp nhận thử thách', 'Accept the test'), outcomes: [oc(L(`Bạn giữ im lặng. Lễ thăng cấp diễn ra dưới ánh nến. Bạn giờ là ${nx.vi}.`, `You keep silent. The ceremony is held by candlelight. You are now ${nx.en}.`), { willpower: 3, happy: 6 }, (lf) => { pw(lf).club.rank++; if (pw(lf).club.rank >= 5) lf.counts.clubChair = 1; }, null, clamp(0.55 + life.stats.willpower / 250, 0.3, 0.95)), oc(L('Bạn lỡ lời trong một bữa tiệc. Hội cho bạn thêm một năm.', 'You slip at a party. The circle gives you another year.'), { happy: -4 }, (lf) => { pw(lf).club.contrib -= 10; }, null, 1 - clamp(0.55 + life.stats.willpower / 250, 0.3, 0.95))] },
      { label: L('Chưa sẵn sàng', 'Not ready yet'), outcomes: [oc(L('Bạn xin thêm thời gian. Hội gật đầu.', 'You ask for more time. The circle nods.'))] },
    ]);
  }
  if (s === 'pw_masks') {
    const pairs = [[L('Một đồng nghiệp tình cờ thấy video "đời thực" của bạn trên mạng.', 'A coworker stumbles on your "real life" video online.'), 'work'], [L('Gia đình đọc được một bài báo về bạn trong giới thượng lưu. Họ không nhận ra người trong ảnh.', "Your family reads about you in the society pages. They don't recognise the person in the photo."), 'family']];
    const [t, aud] = pick(life, pairs);
    return sev('sys/pw_masks', t, [
      { label: L('Cười cho qua', 'Laugh it off'), outcomes: [oc(L('Họ nhìn bạn khác đi một chút, nhưng rồi thôi.', 'They look at you a little differently, then let it go.'), { happy: -2 })] },
      { label: L('Bỏ mặt nạ ở chỗ này', 'Drop the mask there'), outcomes: [oc(L('Nhẹ người thấy rõ. Bạn nhận ra mình đã mệt đến mức nào.', 'A clear weight lifts. You realise how tired you were.'), { happy: 5 }, (lf) => { pw(lf).masks[aud] = 'genuine'; })] },
    ]);
  }
  if (s === 'pw_council') {
    const S = P.shadow;
    if (!S || S.ended || pawnsOf(life).length < 3) return null;
    if (!item.opts) { const keys = Object.keys(DIRECTIVES); const sh = keys.map((k) => [k, rand(life)]).sort((a, b) => a[1] - b[1]).map((x) => x[0]); item.opts = sh.slice(0, 4); }
    const ps = pawnsOf(life);
    const avg = ps.reduce((s2, p) => s2 + p.pawn.loyal, 0) / ps.length;
    const e = 0.6 + avg / 250;
    return sev(`sys/pw_council`, L(`Hội đồng bóng tối, phiên ${item.step}/3. ${ps.length} quân cờ ngồi quanh bàn, chờ ý bạn.`, `The shadow council, session ${item.step}/3. ${ps.length} pawns sit around the table, waiting for your word.`), item.opts.map((k) => {
      const d = DIRECTIVES[k];
      return { label: L(`${d.em} ${d.name.vi}`, `${d.em} ${d.name.en}`), outcomes: [oc(L(`Lệnh "${d.name.vi.toLowerCase()}" được thi hành trong im lặng.`, `The order to "${d.name.en.toLowerCase()}" is carried out in silence.`), {}, (lf) => {
        const r = d.run(lf, e);
        if (r.fx) applyEffects(lf, r.fx);
        if (r.karma) lf.stats.karma = clamp(lf.stats.karma + r.karma);
        const Q = pw(lf).shadow;
        Q.exp = clamp(Q.exp + (r.exp || 0));
        Q.councils++;
        addLog(lf, r.text, 'good');
        if (item.step < 3) lf.queue.unshift({ sys: 'pw_council', step: item.step + 1 });
      })] };
    }));
  }
  if (s === 'pw_exposed') {
    const S = P.shadow;
    if (!S || S.ended) return null;
    const ps = pawnsOf(life);
    return sev('sys/pw_exposed', L(`Độ lộ diện của bạn đã lên ${Math.round(S.exp)}. Một tờ báo lớn chuẩn bị đăng loạt bài "Ai đứng sau tất cả?".`, `Your exposure has reached ${Math.round(S.exp)}. A major paper is preparing a series: "Who is behind it all?"`), [
      ...(ps.length ? [{ label: L('Đẩy một quân cờ ra chịu thay', 'Let a pawn take the fall'), outcomes: [oc(L('Một cái tên khác lên trang nhất. Bạn vẫn ở trong bóng tối.', 'Another name makes the front page. You stay in the shadows.'), { karma: -10 }, (lf) => { const p = pick(lf, pawnsOf(lf)); delete p.pawn; delete p.post; p.att = 'hate'; p.defeated = 'scandal'; pw(lf).shadow.exp = clamp(pw(lf).shadow.exp - 40); })] }] : []),
      { label: L('Nằm im vài năm', 'Go dark for a few years'), outcomes: [oc(L('Bạn đóng băng mọi hoạt động. Quyền lực hao hụt, nhưng bạn an toàn.', 'You freeze everything. Power drains, but you are safe.'), {}, (lf) => { const Q = pw(lf).shadow; Q.exp = clamp(Q.exp - 30); Q.biz = Math.max(0, Q.biz - 1); for (const p of pawnsOf(lf)) p.pawn.loyal = clamp(p.pawn.loyal - 10); })] },
      { label: L('Mở quỹ từ thiện làm bình phong', 'Launch a charity as cover'), outcomes: [oc(L('Báo chí chuyển sang viết về tấm lòng của bạn.', 'The press switches to writing about your generosity.'), { money: -40, karma: 4 }, (lf) => { pw(lf).shadow.exp = clamp(pw(lf).shadow.exp - 20); })] },
      { label: L('Chối tất cả', 'Deny everything'), outcomes: [oc(L('Không có bằng chứng nào đủ mạnh. Câu chuyện chìm xuống.', 'No evidence is strong enough. The story sinks.'), {}, (lf) => { pw(lf).shadow.exp = clamp(pw(lf).shadow.exp - 10); }, null, 0.5), oc(L('Mọi thứ bị phơi bày. Tên bạn ở khắp nơi. Đế chế ngầm sụp đổ trong một tuần.', 'Everything comes out. Your name is everywhere. The shadow empire collapses in a week.'), { fame: 15, happy: -20, karma: -5 }, (lf) => { const Q = pw(lf); Q.shadow.ended = 'exposed'; Q.infl = 0; me(lf).scandal = 100; for (const p of pawnsOf(lf)) { delete p.pawn; delete p.post; } milestone(lf, L('Đế chế ngầm bị phơi bày', 'Shadow empire exposed'), 'bad'); }, null, 0.5)] },
    ]);
  }
  return null;
}

// ───────── God Mode ─────────
export function godPowerSelf(life, v) {
  const P = pw(life);
  const num = (x) => (x === '' || x == null ? null : Number(x));
  if (v.infl != null) P.infl = clamp(Number(v.infl));
  if ('statusGod' in v) P.statusGod = num(v.statusGod) == null ? null : clamp(num(v.statusGod), 0, 6);
  if ('aura' in v) P.aura = num(v.aura) == null ? null : clamp(num(v.aura), 0, 4);
  if (v.office != null) { const o = clamp(Number(v.office), 0, 6); P.office = o; P.held = Math.max(P.held, o); if (o && P.term <= 0) P.term = 4; }
  if (v.approval != null) P.approval = clamp(Number(v.approval));
  if ('press' in v && (v.press || '') !== (P.press?.kind || '')) P.press = v.press === 'paper' ? { kind: 'paper', name: L('Nhật báo Bình Minh', 'The Daybreak Daily') } : v.press === 'tv' ? { kind: 'tv', name: L('Kênh BM24', 'BM24 Network') } : null;
  if ('clubRank' in v && String(v.clubRank ?? '') !== String(P.club ? P.club.rank : '')) { P.club = num(v.clubRank) == null ? null : { rank: clamp(num(v.clubRank), 0, 5), contrib: CLUB_NEED[clamp(num(v.clubRank), 0, 5)] }; if (P.club && P.club.rank >= 5) life.counts.clubChair = 1; }
  if (v.jet != null) P.rich.jet = !!v.jet;
  if (v.island != null) P.rich.island = !!v.island;
  if (v.clanOn != null && !!v.clanOn !== !!P.clan) P.clan = v.clanOn ? { prestige: 20, company: false, matches: 0 } : null;
  if (P.clan) { if (v.clanPrestige != null) P.clan.prestige = clamp(Number(v.clanPrestige)); if (v.company != null) P.clan.company = !!v.company; }
  if ('heirId' in v) P.heirId = v.heirId || null;
  if (v.masks) for (const [a, m] of Object.entries(v.masks)) if (AUDIENCES[a] && MASKS[m]) P.masks[a] = m;
  const live = !!(P.shadow && !P.shadow.ended);
  if (v.shadowOn != null && !!v.shadowOn !== live) { if (v.shadowOn) P.shadow = { exp: 5, biz: 0, love: 0, years: 0, councils: 0 }; else P.shadow.ended = 'retired'; }
  if (P.shadow && !P.shadow.ended) { if (v.exposure != null) P.shadow.exp = clamp(Number(v.exposure)); if (v.shadowBiz != null) P.shadow.biz = clamp(Number(v.shadowBiz), 0, 50); if (v.shadowLove != null) P.shadow.love = clamp(Number(v.shadowLove), 0, 50); }
  if (v.heirAll != null) P.heirAll = !!v.heirAll;
  const F = fcfg(life);
  if (v.maleMax != null) F.maleMax = clamp(Number(v.maleMax), 50, MALE_UNLIMITED);
  if (v.noDecline != null) F.noDecline = !!v.noDecline;
  if (v.carrierMax != null) F.carrierMax = clamp(Number(v.carrierMax), 40, 55);
  if (v.council && P.shadow && !P.shadow.ended) life.queue.unshift({ sys: 'pw_council', step: 1 });
  updateAura(life);
}
/** Biến bất kỳ người lớn nào thành quân cờ. Không bao giờ chỉnh tuổi. */
export function godPowerPerson(life, p, v) {
  if (p.age < 18) return;
  if (v.pawn === false) { delete p.pawn; delete p.post; }
  else if (v.pawn) {
    const via = FAMILY.includes(p.role) && v.pawnVia === 'love' ? 'favor' : PAWN_VIA[v.pawnVia] ? v.pawnVia : (p.pawn?.via || 'favor');
    p.pawn = { via, loyal: clamp(Number(v.pawnLoyal ?? p.pawn?.loyal ?? 60)), dep: clamp(Number(v.pawnDep ?? p.pawn?.dep ?? 50)), since: p.pawn?.since ?? life.age };
    if (!pw(life).shadow || pw(life).shadow.ended) pw(life).shadow = { exp: 5, biz: 0, love: 0, years: 0, councils: 0 };
  }
  if (v.contract != null && adultOK(life, p)) p.contract = !!v.contract;
}
