// Đợt 4 · Đời thường & phát triển: năng khiếu (241), thầy cô đáng nhớ (243), khởi nghiệp (246), văn hóa công sở (248),
// lối sống và sức khỏe (265), học lực có hệ quả (282), danh tiếng nghề (284), phong cách tiêu tiền (287), kiểu yêu (289),
// người yêu có đời riêng (290), người tình dạy bạn điều mới (292), di sản dòng họ (293), bí mật gia đình (294),
// truyền nghề (295), sở thích có cấp (230), thú cưng có tính cách (227), nhà có chuyện (228), hàng xóm (229),
// du lịch (231), xem bói (233), biến động xã hội (234), con cái có đời riêng (225),
// chuỗi đang diễn ra (207) và nhật ký đời (273).
// Luật: tuổi thơ trong sáng; tình cảm chỉ từ 18 tuổi, ngoài gia đình. Không có con số cân nặng hay chế độ ăn.
import { L, clamp, chance, randint, pick, rand, freqOf } from './util.js';
import { unit, country, partner, spouse, people, byId, randomPerson, personName, addLog, milestone, lovers } from './life.js';
import { applyEffects } from './events.js';
import { me, adultOK, ROM, attOf } from './intimacy.js';
import { members } from './harem.js';
import { pw, statusOf, OFFICES, CLUB_RANKS, STATUS, pawnsOf, shadowPower, nextOffice } from './power.js';
import { addMoment, persona, topTrait, traitLabel, voiceOf, VOICES } from './society.js';

const nm = (life, p) => personName(life, p);
const u = (life, n) => n * unit(life);
const res = (text, changes = [], tone) => ({ text, changes, tone });
const fx = (life, e) => applyEffects(life, e);
const oc = (text, effects = {}, run, next, ch = 1) => ({ chance: ch, text, effects, run, next });
const sev = (uid, text, choices) => ({ uid, sys: true, text, choices });
const modal = (uid, text, choices) => ({ event: { uid, text, choices } });

// ───────── 241 · Năng khiếu ─────────
export const TALENTS = {
  music: { em: '🎵', name: L('Âm nhạc', 'Music'), acts: ['art', 'band', 'hob_guitar', 'hob_dance'], jobs: ['teacher'], stat: 'happy' },
  art: { em: '🎨', name: L('Hội họa', 'Art'), acts: ['art', 'hob_paint', 'hob_photo'], jobs: ['designer', 'architect', 'hairdresser'], stat: 'looks' },
  sport: { em: '⚽', name: L('Thể thao', 'Sport'), acts: ['sportclub', 'swim', 'gym', 'hob_run'], jobs: ['police'], stat: 'health' },
  math: { em: '🔢', name: L('Toán học', 'Maths'), acts: ['tutor', 'library', 'hob_chess'], jobs: ['accountant', 'analyst', 'engineer', 'scientist'], stat: 'smarts' },
  words: { em: '✍️', name: L('Ngôn từ', 'Words'), acts: ['library', 'hob_write'], jobs: ['journalist', 'lawyer', 'marketing', 'professor'], stat: 'smarts' },
  people: { em: '🤝', name: L('Giao tiếp', 'People'), acts: ['friends', 'volunteer'], jobs: ['sales', 'psychologist', 'nurse', 'waiter'], stat: 'karma' },
  cook: { em: '🍳', name: L('Nấu ăn', 'Cooking'), acts: ['hob_cook'], jobs: ['chef', 'fast_food'], stat: 'happy' },
  tech: { em: '💻', name: L('Công nghệ', 'Tech'), acts: ['games', 'hob_code'], jobs: ['developer', 'it_tech', 'electrician', 'mechanic'], stat: 'smarts' },
};
export function talentOf(life) { if (!life.talent) life.talent = { id: Object.keys(TALENTS)[randint(life, 0, 7)], known: false }; return life.talent; }
function revealTalentText(life) {
  const t = TALENTS[talentOf(life).id];
  return L(`Ai đó nhận ra: bạn có năng khiếu ${t.name.vi.toLowerCase()} ${t.em}.`, `Someone notices: you have a gift for ${t.name.en.toLowerCase()} ${t.em}.`);
}
/** Gọi sau mỗi hoạt động: thử hoạt động đúng sở trường thì phát hiện năng khiếu. */
export function revealTalent(life, actId) {
  const t = talentOf(life);
  if (t.known || !TALENTS[t.id].acts.includes(actId) || !chance(life, 0.5)) return null;
  t.known = true;
  const text = revealTalentText(life);
  addLog(life, text, 'good');
  return text;
}

// ───────── 230 · Sở thích có cấp ─────────
export const HOBBIES = {
  guitar: { em: '🎸', name: L('Guitar', 'Guitar'), min: 8, tal: 'music', stat: { happy: 2 }, lines: [L('Đầu ngón tay đau rát, nhưng hợp âm đã tròn hơn.', 'Sore fingertips, but the chords ring cleaner.'), L('Bạn chơi trọn một bài mà không nhìn tay.', 'You play a whole song without looking at your hands.'), L('Một người lạ dừng lại nghe bạn chơi ngoài công viên.', 'A stranger stops to listen to you play in the park.')] },
  paint: { em: '🖌️', name: L('Vẽ tranh', 'Painting'), min: 6, tal: 'art', stat: { happy: 2 }, lines: [L('Bức tranh trông như một quả trứng. Đáng lẽ là con mèo.', 'The painting looks like an egg. It was meant to be a cat.'), L('Bạn tìm ra cách pha màu hoàng hôn.', 'You figure out how to mix a sunset.'), L('Có người hỏi mua bức tranh của bạn.', 'Someone asks to buy your painting.')] },
  chess: { em: '♟️', name: L('Cờ vua', 'Chess'), min: 7, tal: 'math', stat: { smarts: 2 }, lines: [L('Bạn thua một ông cụ ở công viên trong 9 nước.', 'You lose to an old man in the park in nine moves.'), L('Bạn bắt đầu nhìn thấy trước ba nước đi.', 'You start seeing three moves ahead.'), L('Ông cụ ở công viên giờ né ván với bạn.', 'The old man in the park now avoids playing you.')] },
  cook: { em: '🍳', name: L('Nấu ăn', 'Cooking'), min: 10, tal: 'cook', stat: { happy: 2, health: 1 }, lines: [L('Món canh mặn như nước biển. Bạn vẫn ăn hết.', 'The soup is as salty as the sea. You finish it anyway.'), L('Cả nhà xin thêm bát thứ hai.', 'The whole family asks for seconds.'), L('Bạn bè bắt đầu "tình cờ" ghé nhà đúng giờ ăn.', 'Friends start "dropping by" right at dinnertime.')] },
  garden: { em: '🪴', name: L('Làm vườn', 'Gardening'), min: 8, tal: null, stat: { happy: 2, health: 1 }, lines: [L('Cây xương rồng chết. Không ai hiểu bằng cách nào.', 'The cactus dies. Nobody understands how.'), L('Ban công của bạn giờ xanh mướt.', 'Your balcony is lush and green now.'), L('Hàng xóm xin bạn cành giâm.', 'The neighbours ask you for cuttings.')] },
  photo: { em: '📷', name: L('Nhiếp ảnh', 'Photography'), min: 10, tal: 'art', stat: { happy: 1, smarts: 1 }, lines: [L('Hai trăm tấm ảnh, một tấm không mờ.', 'Two hundred shots, one not blurry.'), L('Bạn bắt được ánh sáng giờ vàng hoàn hảo.', 'You catch golden hour perfectly.'), L('Một tạp chí xin đăng ảnh của bạn.', 'A magazine asks to publish your photo.')] },
  run: { em: '🏃', name: L('Chạy bộ', 'Running'), min: 8, tal: 'sport', stat: { health: 3 }, lines: [L('Bạn chạy được 2 km rồi đi bộ 3 km.', 'You run 2 km, then walk 3.'), L('Bạn chạy 10 km mà vẫn nói chuyện được.', 'You run 10 km and can still chat.'), L('Bạn về đích một giải bán marathon.', 'You finish a half marathon.')] },
  write: { em: '✍️', name: L('Viết lách', 'Writing'), min: 9, tal: 'words', stat: { smarts: 2 }, lines: [L('Bạn viết ba trang rồi xóa hai trang rưỡi.', 'You write three pages and delete two and a half.'), L('Một truyện ngắn của bạn khiến người đọc khóc.', 'One of your short stories makes a reader cry.'), L('Một nhà xuất bản hỏi bạn có bản thảo dài không.', 'A publisher asks if you have a full manuscript.')] },
  dance: { em: '🕺', name: L('Khiêu vũ', 'Dancing'), min: 6, tal: 'music', stat: { health: 2, looks: 1 }, lines: [L('Bạn giẫm chân bạn nhảy bốn lần.', "You step on your partner's feet four times."), L('Bạn thuộc cả bài mà không đếm nhịp.', 'You know the routine without counting.'), L('Bạn được mời biểu diễn ở một sự kiện.', 'You are invited to perform at an event.')] },
  code: { em: '👾', name: L('Lập trình', 'Coding'), min: 10, tal: 'tech', stat: { smarts: 2 }, lines: [L('Bạn sửa một lỗi và tạo ra ba lỗi mới.', 'You fix one bug and create three more.'), L('Ứng dụng nhỏ của bạn chạy được thật.', 'Your little app actually works.'), L('Hàng nghìn người tải ứng dụng của bạn.', 'Thousands of people download your app.')] },
};
const need = (lv) => 20 + lv * 15;
export function hobbyOf(life, id) { life.hob ||= {}; return life.hob[id] || (life.hob[id] = { lv: 0, xp: 0 }); }
function practice(life, id) {
  const H = HOBBIES[id];
  const h = hobbyOf(life, id);
  if (h.lv >= 10) return res(L(`Bạn đã là bậc thầy ${H.name.vi.toLowerCase()}. Giờ bạn dạy người khác.`, `You are a master of ${H.name.en.toLowerCase()}. Now you teach others.`), fx(life, { happy: 3, karma: 1 }), 'good');
  const t = talentOf(life);
  const mult = (t.id === H.tal ? 1.8 : 1) * (life.habits && life.habits.stress > 70 ? 0.7 : 1);
  h.xp += Math.round(randint(life, 9, 15) * mult);
  if (t.id === H.tal && !t.known && chance(life, 0.35)) { t.known = true; addLog(life, revealTalentText(life), 'good'); }
  const changes = fx(life, H.stat);
  let text = H.lines[h.lv < 3 ? 0 : h.lv < 7 ? 1 : 2];
  let tone;
  if (h.xp >= need(h.lv)) {
    h.xp -= need(h.lv); h.lv++; tone = 'good';
    text = L(`${text.vi} Lên cấp ${h.lv}!`, `${text.en} Level ${h.lv}!`);
    if (h.lv === 5) life.queue.push({ sys: 'gr_hobby', id });
    if (h.lv === 10) { life.counts.masters = (life.counts.masters || 0) + 1; life.stats.fame = clamp(life.stats.fame + 6); milestone(life, L(`Bậc thầy ${H.name.vi.toLowerCase()}`, `Master of ${H.name.en.toLowerCase()}`), 'good'); }
  }
  return res(text, changes, tone);
}

// ───────── 265 · Lối sống ─────────
export const HABITS = { sleep: { em: '😴', name: L('Giấc ngủ', 'Sleep') }, move: { em: '🚶', name: L('Vận động', 'Movement') }, drink: { em: '🍺', name: L('Rượu bia', 'Drinking') }, screen: { em: '📱', name: L('Màn hình', 'Screen time') }, stress: { em: '😣', name: L('Căng thẳng', 'Stress') } };
export function habits(life) { if (!life.habits) life.habits = { sleep: 55, move: 45, drink: 15, screen: 55, stress: 40 }; return life.habits; }
function lifestyleMenu(life) {
  const H = habits(life);
  const o = (lb, k, d, text, extra = {}) => ({ label: lb, outcomes: [oc(text, extra, () => { H[k] = clamp(H[k] + d); })] });
  const ch = [
    o(L('😴 Đi ngủ trước 11 giờ', '😴 Bed before 11pm'), 'sleep', 15, L('Tuần đầu khó. Tuần thứ hai bạn dậy trước báo thức.', 'The first week is hard. By the second you wake before the alarm.')),
    o(L('🚶 Đi bộ mỗi ngày', '🚶 Walk every day'), 'move', 15, L('Bạn phát hiện ra một con hẻm có quán chè ngon.', 'You discover an alley with great sweet soup.'), { health: 1 }),
    o(L('📵 Một tuần không mạng xã hội', '📵 A week off social media'), 'screen', -20, L('Ngày thứ ba bạn đọc xong một cuốn sách. Ngày thứ năm bạn nói chuyện với cái cây.', 'Day three you finish a book. Day five you talk to a plant.')),
    o(L('🧘 Học cách thả lỏng', '🧘 Learn to unwind'), 'stress', -15, L('Hít vào bốn nhịp, thở ra sáu nhịp. Vai bạn hạ xuống được hai phân.', 'In for four, out for six. Your shoulders drop two centimetres.'), { happy: 2 }),
  ];
  if (life.age >= 18) ch.push(H.drink > 25 ? o(L('🚫 Bớt rượu bia', '🚫 Cut back on drinking'), 'drink', -20, L('Sáng thứ Bảy bạn tỉnh táo đến lạ.', 'Saturday mornings are strangely clear.')) : o(L('🍻 Thêm vài cuộc nhậu', '🍻 A few more nights out'), 'drink', 15, L('Vui thật. Đầu thì không vui lắm.', 'Fun. Your head disagrees.'), { happy: 3 }));
  return modal('gr/lifestyle', L('Bạn muốn thay đổi thói quen nào?', 'Which habit do you want to change?'), ch);
}

// ───────── 287 · Phong cách tiêu tiền / 289 · Kiểu yêu ─────────
export const SPEND = { frugal: { em: '🐷', name: L('Tiết kiệm', 'Frugal') }, balanced: { em: '⚖️', name: L('Cân bằng', 'Balanced') }, lavish: { em: '💎', name: L('Hào phóng', 'Lavish') }, impulsive: { em: '🛍️', name: L('Bốc đồng', 'Impulsive') } };
export const LOVESTYLE = { romantic: { em: '🌹', name: L('Lãng mạn', 'Romantic') }, loyal: { em: '💍', name: L('Chung thủy', 'Devoted') }, free: { em: '🕊️', name: L('Tự do', 'Free spirit') }, player: { em: '😏', name: L('Đa tình', 'Player') }, slow: { em: '🐢', name: L('Chậm mà chắc', 'Slow burn') }, none: { em: '·', name: L('Chưa rõ', 'Not yet clear') } };
export function loveStyleOf(life) {
  if (life.age < 18) return 'none';
  const m = life.ix || {};
  if ((m.loverTotal || 0) >= 5 || (life.counts.ons || 0) >= 8) return 'player';
  if ((life.counts.polyYears || 0) >= 3) return 'free';
  if (life.marriage && life.age - life.marriage.since >= 8 && (m.loyal ?? 60) >= 65) return 'loyal';
  if ((life.counts.partners || 0) <= 1 && life.age >= 28) return 'slow';
  return (life.counts.partners || 0) ? 'romantic' : 'none';
}

// ───────── 248 · Văn hóa công sở ─────────
export const CULTURES = {
  family: { em: '🏡', name: L('Như một gia đình', 'Like family') },
  grind: { em: '⏰', name: L('Vắt kiệt sức', 'Burnout factory') },
  startup: { em: '🚀', name: L('Khởi nghiệp sôi động', 'Startup buzz') },
  corporate: { em: '🏢', name: L('Tập đoàn quy củ', 'Corporate order') },
  drama: { em: '🍿', name: L('Thị phi', 'Office drama') },
};
const CULT_EV = {
  family: [L('Sếp tổ chức sinh nhật bất ngờ cho bạn, có cả bánh kem in mặt bạn.', 'Your boss throws you a surprise birthday, cake with your face on it.'), [[L('Cảm động phát biểu', 'Give a teary speech'), { happy: 6 }], [L('Ăn miếng có mặt mình trước', 'Eat your own face first'), { happy: 4, fame: 1 }]]],
  grind: [L('Lại một đêm làm đến 11 giờ. Tin nhắn "Em xem giúp anh cái này" đến lúc 11 giờ 5.', 'Another night until 11pm. "Can you take a quick look at this?" arrives at 11:05.'), [[L('Làm luôn', 'Do it now'), { jobPerf: 5, health: -2 }], [L('Để sáng mai', 'Leave it for morning'), { happy: 2, jobPerf: -2 }], [L('Nói chuyện thẳng với sếp về giờ làm', 'Talk to your boss about hours'), { willpower: 3 }]]],
  startup: [L('Công ty có bàn bóng bàn, bia miễn phí, và một khoản lương đến muộn.', 'The office has ping-pong, free beer and a late paycheck.'), [[L('Tin vào tầm nhìn', 'Believe in the vision'), { happy: 3, jobPerf: 3 }], [L('Hỏi thẳng về dòng tiền', 'Ask about cash flow'), { smarts: 2 }]]],
  corporate: [L('Một biểu mẫu mới cần bảy chữ ký để xin một cái ghế.', 'A new form needs seven signatures to request a chair.'), [[L('Kiên nhẫn đi xin chữ ký', 'Patiently collect signatures'), { willpower: 2, jobPerf: 2 }], [L('Mang ghế nhà lên', 'Bring a chair from home'), { happy: 3 }]]],
  drama: [L('Nhóm chat "không có sếp" bị lộ. Tên bạn có trong đó.', 'The "no bosses" group chat leaks. Your name is in it.'), [[L('Xin lỗi chân thành', 'Apologise sincerely'), { karma: 2, jobPerf: -2 }], [L('Bình tĩnh như không có gì', 'Act like nothing happened'), { willpower: 2 }], [L('Lập nhóm chat mới', 'Start a new group chat'), { happy: 2, risk: 3 }]]],
};

// ───────── 292 · Người tình dạy bạn điều mới ─────────
export const LEARN = {
  massage: { em: '💆', name: L('Mát-xa thư giãn', 'Relaxing massage'), adult: true, text: L('{n} dạy bạn cách thả lỏng từng thớ cơ. Bàn tay bạn giờ biết lắng nghe.', '{n} teaches you to release every knot. Your hands have learned to listen.') },
  dance: { em: '💃', name: L('Nhảy đôi', 'Partner dancing'), text: L('{n} dạy bạn nhảy salsa trong bếp. Bạn không còn hai chân trái.', '{n} teaches you salsa in the kitchen. You no longer have two left feet.') },
  cook: { em: '🍲', name: L('Món ruột của họ', 'Their signature dish'), text: L('{n} truyền cho bạn công thức gia truyền. Bạn hứa không kể ai.', '{n} hands down a family recipe. You promise to tell no one.') },
  language: { em: '🗣️', name: L('Một ngôn ngữ mới', 'A new language'), text: L('{n} dạy bạn nói những câu ngọt ngào bằng tiếng mẹ đẻ của họ.', '{n} teaches you sweet nothings in their mother tongue.') },
  wine: { em: '🍷', name: L('Thưởng rượu vang', 'Wine tasting'), text: L('{n} dạy bạn ngửi, xoay ly, và nói "hương gỗ sồi" với vẻ mặt nghiêm túc.', '{n} teaches you to sniff, swirl, and say "oaky notes" with a straight face.') },
  poetry: { em: '📜', name: L('Viết thư tay', 'Love letters'), text: L('{n} dạy bạn rằng một lá thư tay đáng giá hơn trăm tin nhắn.', '{n} teaches you a handwritten letter beats a hundred texts.') },
  slow: { em: '🕯️', name: L('Sự chậm rãi', 'Taking it slow'), adult: true, text: L('{n} dạy bạn rằng không có gì phải vội. Mọi thứ đáng chờ đợi.', '{n} teaches you there is no rush. Good things are worth the wait.') },
  confidence: { em: '🦁', name: L('Sự tự tin', 'Confidence'), text: L('{n} bắt bạn nhìn vào gương mỗi sáng và nói một điều tốt về mình. Bạn đứng thẳng hơn.', '{n} makes you say one kind thing to the mirror each morning. You stand taller.') },
};

// ───────── 227 · Thú cưng / 228 · Nhà / 229 · Hàng xóm ─────────
export const PET_P = {
  lazy: { em: '😪', name: L('Lười biếng', 'Lazy'), line: L('{n} ngủ 20 tiếng hôm nay. Kỷ lục mới.', '{n} sleeps 20 hours today. A new record.') },
  clingy: { em: '🥺', name: L('Bám người', 'Clingy'), line: L('{n} theo bạn vào tận nhà tắm. Như mọi ngày.', '{n} follows you into the bathroom. As always.') },
  chaos: { em: '🌪️', name: L('Quậy phá', 'Chaotic'), line: L('{n} xé nát cuộn giấy vệ sinh và nhìn bạn như thể bạn mới là người có lỗi.', '{n} shreds the toilet roll and looks at you like it is your fault.') },
  genius: { em: '🧠', name: L('Thiên tài', 'Genius'), line: L('{n} tự mở được tủ lạnh. Bạn bắt đầu lo.', '{n} figures out how to open the fridge. You start to worry.') },
  grumpy: { em: '😾', name: L('Khó ở', 'Grumpy'), line: L('{n} chỉ cho đúng một người vuốt ve. Đó không phải bạn.', '{n} lets exactly one person pet them. It is not you.') },
  diva: { em: '👑', name: L('Điệu đà', 'Diva'), line: L('{n} từ chối ăn hạt rẻ tiền. Bạn mua loại đắt hơn bữa của mình.', '{n} refuses the cheap kibble. You buy food pricier than yours.') },
};
export const HSTORY = {
  haunted: { em: '👻', name: L('Có "bạn cùng nhà" vô hình', 'An invisible housemate'), line: L('Cánh cửa tầng trên lại tự đóng lúc nửa đêm.', 'The upstairs door shuts itself at midnight again.') },
  letters: { em: '💌', name: L('Thư của chủ cũ', "Previous owner's letters"), line: L('Bạn tìm thêm một lá thư tình cũ kẹt sau tủ bếp.', 'You find another old love letter stuck behind the cupboard.') },
  garden: { em: '🌳', name: L('Cây cổ thụ', 'An ancient tree'), line: L('Cây trong sân ra hoa sớm. Hàng xóm đứng ngắm.', 'The tree in the yard blooms early. The neighbours stop to look.') },
  hidden: { em: '🚪', name: L('Căn phòng bí mật', 'A hidden room'), line: L('Bạn gõ lên tường và nghe tiếng rỗng.', 'You knock on the wall and hear a hollow sound.') },
  leaky: { em: '💧', name: L('Mái nhà dột', 'A leaky roof'), line: L('Mưa to, bạn đặt bảy cái xô khắp nhà.', 'Heavy rain. You put out seven buckets.') },
  cat: { em: '🐈', name: L('Con mèo đi kèm nhà', 'A cat that came with the house'), line: L('Con mèo hoang lại ngủ trên ghế của bạn như chủ nhà.', 'The stray cat naps in your chair like it owns the place.') },
};
export const HOOD = { quiet: { em: '🌿', name: L('Yên tĩnh', 'Quiet') }, lively: { em: '🎉', name: L('Náo nhiệt', 'Lively') }, posh: { em: '🥂', name: L('Sang trọng', 'Upmarket') }, artsy: { em: '🎨', name: L('Nghệ sĩ', 'Artsy') } };

// ───────── 231 · Du lịch ─────────
export const DESTS = [
  ['halong', '🛶', L('Vịnh Hạ Long', 'Ha Long Bay'), L('Bạn ngủ trên du thuyền giữa những đảo đá vôi. Bình minh như tranh thủy mặc.', 'You sleep on a junk among limestone islands. Dawn looks like an ink painting.')],
  ['hoian', '🏮', L('Hội An', 'Hoi An'), L('Thả đèn hoa đăng trên sông Hoài, ước một điều không nói ra.', 'You float a lantern on the Hoai River and make a silent wish.')],
  ['kyoto', '⛩️', L('Kyoto', 'Kyoto'), L('Hàng nghìn cổng torii đỏ ở Fushimi Inari. Bạn đếm đến 200 thì bỏ cuộc.', "Thousands of red torii at Fushimi Inari. You give up counting at 200.")],
  ['paris', '🗼', L('Paris', 'Paris'), L('Bạn ăn bánh sừng bò bên sông Seine và tha thứ cho giá cà phê.', 'You eat a croissant by the Seine and forgive the coffee prices.')],
  ['santorini', '🏛️', L('Santorini', 'Santorini'), L('Mái vòm xanh, tường trắng, hoàng hôn khiến cả đám đông vỗ tay.', 'Blue domes, white walls, a sunset that makes the crowd applaud.')],
  ['machu', '🏔️', L('Machu Picchu', 'Machu Picchu'), L('Bạn leo lên trong mây. Rồi mây tan, và cả thành cổ hiện ra.', 'You climb into cloud. Then it clears, and the whole citadel appears.')],
  ['bali', '🌴', L('Bali', 'Bali'), L('Ruộng bậc thang Tegallalang xanh đến nhức mắt. Một con khỉ lấy kính râm của bạn.', 'The Tegallalang rice terraces are dazzlingly green. A monkey steals your sunglasses.')],
  ['iceland', '🌌', L('Iceland', 'Iceland'), L('Cực quang nhảy múa trên đầu. Bạn quên cả lạnh.', 'The northern lights dance overhead. You forget the cold.')],
  ['newyork', '🗽', L('New York', 'New York'), L('Bạn đi bộ qua cầu Brooklyn lúc hoàng hôn và ăn một lát pizza to bằng mặt.', 'You walk the Brooklyn Bridge at sunset and eat a slice of pizza the size of your face.')],
  ['capetown', '⛰️', L('Cape Town', 'Cape Town'), L('Từ núi Bàn nhìn xuống, hai đại dương gặp nhau.', 'From Table Mountain you watch two oceans meet.')],
  ['marrakech', '🕌', L('Marrakech', 'Marrakech'), L('Bạn lạc trong khu chợ cổ và mua một tấm thảm không định mua.', 'You get lost in the medina and buy a rug you never meant to.')],
  ['petra', '🏜️', L('Petra', 'Petra'), L('Đi hết hẻm núi Siq, thành phố hồng hiện ra như phép màu.', 'At the end of the Siq canyon, the rose city appears like magic.')],
  ['banff', '🏞️', L('Banff', 'Banff'), L('Hồ Moraine xanh ngọc như ai đó đã chỉnh màu.', 'Moraine Lake is so turquoise it looks edited.')],
  ['seoul', '🏯', L('Seoul', 'Seoul'), L('Bạn mặc hanbok dạo cung Gyeongbok rồi ăn gà rán lúc nửa đêm.', 'You stroll Gyeongbokgung in a hanbok, then eat fried chicken at midnight.')],
  ['istanbul', '🕌', L('Istanbul', 'Istanbul'), L('Tiếng gọi cầu nguyện vang trên eo biển Bosphorus lúc chiều tà.', 'The call to prayer echoes over the Bosphorus at dusk.')],
  ['patagonia', '🐧', L('Patagonia', 'Patagonia'), L('Gió mạnh đến mức bạn phải nghiêng người mới đứng được. Đẹp không tả nổi.', 'The wind is so strong you have to lean into it. Indescribably beautiful.')],
];

// ───────── 233 · Xem bói ─────────
const PROPHECY = {
  love: L('"Trong ba năm tới, một người sẽ bước vào đời bạn qua một cánh cửa không ngờ."', '"Within three years, someone will walk into your life through an unexpected door."'),
  money: L('"Tiền sẽ đến từ nơi bạn đã quên."', '"Money will come from a place you have forgotten."'),
  health: L('"Hãy để ý đến sức khỏe. Cơ thể đang nói nhỏ."', '"Mind your health. Your body is whispering."'),
  travel: L('"Tôi thấy một chuyến đi xa, và một quyết định ở cuối chuyến đi."', '"I see a long journey, and a decision at its end."'),
  career: L('"Một cơ hội sẽ gõ cửa. Đừng mở cửa muộn."', '"An opportunity will knock. Don\'t be slow to open."'),
};

// ───────── Hoạt động ─────────
export const GROWTH_ACTIVITIES = [
  ...Object.entries(HOBBIES).map(([id, H]) => ({ id: `hob_${id}`, group: 'hobby', min: H.min, max: 110, label: H.name, hobby: id, run: (lf) => practice(lf, id) })),
  { id: 'lifestyle', group: 'life', min: 12, max: 110, label: L('Điều chỉnh lối sống', 'Adjust your lifestyle'), run: (lf) => lifestyleMenu(lf) },
  { id: 'travel', group: 'life', min: 18, max: 95, units: 12, label: L('Du lịch đến nơi nổi tiếng', 'Travel somewhere famous'), run: (lf) => travelMenu(lf) },
  { id: 'fortune', group: 'life', min: 16, max: 100, units: 1, label: L('Đi xem bói', 'Visit a fortune teller'), run: (lf) => fortune(lf) },
];
function travelMenu(life) {
  const seen = life.visited || [];
  let pool = DESTS.filter((d) => !seen.includes(d[0]));
  if (!pool.length) pool = DESTS;
  const opts = [];
  const tmp = [...pool];
  while (opts.length < 3 && tmp.length) opts.push(tmp.splice(randint(life, 0, tmp.length - 1), 1)[0]);
  return modal('gr/travel', L('Bạn muốn đi đâu?', 'Where to?'), opts.map(([id, em, name, text]) => ({ label: L(`${em} ${name.vi}`, `${em} ${name.en}`), outcomes: [oc(text, { happy: randint(life, 10, 15), health: 2 }, (lf) => { lf.visited ||= []; if (!lf.visited.includes(id)) lf.visited.push(id); if (lf.visited.length >= 10) lf.counts.globetrotter = 1; const pt = partner(lf); addMoment(lf, pt || null, L(`${name.vi}${pt ? ` cùng ${nm(lf, pt)}` : ''}`, `${name.en}${pt ? ` with ${nm(lf, pt)}` : ''}`), em); if (pt) pt.closeness = clamp(pt.closeness + 4); })] })));
}
function fortune(life) {
  const m = (lb) => ({ label: lb, outcomes: [oc('', {}, null, (lf) => { const k = pick(lf, Object.keys(PROPHECY)); lf.prophecy = { kind: k, until: lf.age + 3, from: lf.age }; return { uid: 'gr/fortune2', text: PROPHECY[k], choices: [{ label: L('Ghi nhớ', 'Remember it'), outcomes: [oc(L('Bạn ghi lời tiên tri vào điện thoại, "để xem có đúng không".', 'You note the prophecy on your phone, "just to see".'))] }] }; })] });
  return modal('gr/fortune', L('Căn phòng nhỏ đầy khói nhang. Bà thầy bói hỏi bạn muốn xem kiểu gì.', 'A tiny room full of incense smoke. The fortune teller asks which reading you want.'), [m(L('🃏 Bài tarot', '🃏 Tarot cards')), m(L('✋ Xem chỉ tay', '✋ Palm reading')), m(L('🌙 Tử vi', '🌙 Astrology'))]);
}

// ───────── Hành động với từng người ─────────
export function growthPersonActions(life, p) {
  const out = [];
  if (!p.alive) return out;
  if (p.role === 'child' && p.age >= 6 && life.age >= 18 && (talentOf(life).known || Object.values(life.hob || {}).some((h) => h.lv >= 3)) && !p.taught) out.push(['teachskill', L('Truyền nghề cho con', 'Pass on your skill')]);
  return out;
}
export function doGrowthPersonAction(life, st, p, act) {
  if (act !== 'teachskill' || p.role !== 'child') return null;
  const best = Object.entries(life.hob || {}).sort((a, b) => b[1].lv - a[1].lv)[0];
  const t = talentOf(life);
  const what = t.known ? TALENTS[t.id].name : best ? HOBBIES[best[0]].name : TALENTS[t.id].name;
  p.taught = true;
  if (t.known) p.talent = t.id;
  if (best && best[1].lv >= 3) p.hobbyFrom = { id: best[0], lv: Math.floor(best[1].lv / 2) };
  p.closeness = clamp(p.closeness + 10);
  p.smarts = clamp(p.smarts + 4);
  return res(L(`Bạn dạy ${nm(life, p)} ${what.vi.toLowerCase()}, từng chút một. Một ngày nào đó họ sẽ dạy lại con của họ.`, `You teach ${nm(life, p)} ${what.en.toLowerCase()}, bit by bit. One day they will teach their own children.`), fx(life, { happy: 5 }), 'good');
}

// ───────── 293 · Di sản dòng họ ─────────
export function legacyOf(life) {
  const P = pw(life);
  return Math.round(clamp(statusOf(life) * 8 + life.stats.karma / 5 + (P.clan ? P.clan.prestige / 3 : 0) + people(life, 'child').length * 2 + life.stats.fame / 4 + P.office * 4 + (life.legacyIn || 0) * 0.3));
}
/** Đời sau nhận lại di sản, năng khiếu và tay nghề được truyền. */
export function inheritGrowth(old, life, kid) {
  life.legacyIn = legacyOf(old);
  if (life.legacyIn >= 20) {
    life.stats.fame = clamp(life.stats.fame + Math.round(life.legacyIn / 10));
    pw(life).infl = clamp(Math.round(life.legacyIn / 6));
    addLog(life, L(`Cái tên ${old.last} mở nhiều cánh cửa. Người ta nhắc đến ${old.first} với sự kính trọng.`, `The ${old.last} name opens doors. People speak of ${old.first} with respect.`), 'good');
  }
  if (kid.talent) life.talent = { id: kid.talent, known: true };
  if (kid.hobbyFrom) { life.hob = { [kid.hobbyFrom.id]: { lv: kid.hobbyFrom.lv, xp: 0 } }; }
  const P0 = old.pw;
  if (P0 && P0.clan) pw(life).clan = { ...P0.clan, prestige: Math.round(P0.clan.prestige * 0.8) };
  if (P0 && P0.shadow && P0.shadow.handed && P0.heirId === kid.id) {
    pw(life).shadow = { exp: Math.round(P0.shadow.exp / 2), biz: P0.shadow.biz, love: 0, years: 0, councils: 0, inherited: true };
    let n = 0;
    for (const q of old.people) if (q.alive && q.pawn && q.age >= 18 && q.id !== kid.id && n < 6) { const c = { ...q, role: 'contact', closeness: 40, pawn: { ...q.pawn, loyal: Math.round(q.pawn.loyal * 0.6) } }; delete c.ix; delete c.hm; life.people.push(c); n++; }
    addLog(life, L(`Cuốn sổ đen giờ thuộc về bạn. ${n} cái tên trong đó vẫn còn nhớ món nợ với gia đình bạn.`, `The black notebook is yours now. ${n} names in it still remember what they owe your family.`), 'good');
  }
}

// ───────── Mỗi năm ─────────
const KID_JOBS = [L('bác sĩ', 'doctor'), L('kỹ sư', 'engineer'), L('đầu bếp', 'chef'), L('giáo viên', 'teacher'), L('nhạc sĩ', 'musician'), L('lập trình viên', 'developer'), L('luật sư', 'lawyer'), L('nhiếp ảnh gia', 'photographer')];
export function growthYear(life, st) {
  const fm = freqOf(st).m;
  const pushes = [];
  const t = talentOf(life);
  const gdp = country(life).gdp;
  // Năng khiếu
  if (!t.known && life.age >= 4 && life.age <= 16 && chance(life, 0.1)) { t.known = true; addLog(life, revealTalentText(life), 'good'); }
  if (t.known && life.age >= 6) { const k = TALENTS[t.id].stat; life.stats[k] = clamp(life.stats[k] + (chance(life, 0.5) ? 1 : 0)); if (life.job && TALENTS[t.id].jobs.includes(life.job.id)) life.job.perf = clamp((life.job.perf || 50) + 3); }
  // Thầy cô đáng nhớ
  if (!life.teacherMet && life.age >= 8 && life.age <= 15 && life.edu.stage && chance(life, 0.25)) pushes.push({ sys: 'gr_teacher' });
  const tc = life.people.find((p) => p.role === 'teacher' && p.alive);
  if (tc && !life.teacherBack && life.age >= 26 && life.age <= 50 && chance(life, 0.08)) pushes.push({ sys: 'gr_teacher2', id: tc.id });
  // Học lực
  if (['primary', 'secondary'].includes(life.edu.stage) && [10, 14].includes(life.age)) addLog(life, life.edu.gpa >= 80 ? L('Học bạ cuối năm toàn điểm cao. Bố mẹ dán lên tủ lạnh.', 'Your end-of-year report is all top marks. It goes on the fridge.') : life.edu.gpa >= 50 ? L('Học bạ cuối năm ở mức khá. Bố mẹ gật gù.', 'A decent end-of-year report. Your parents nod.') : L('Học bạ cuối năm hơi đỏ. Bữa tối hôm đó im lặng.', 'A rather red report card. Dinner is quiet that night.'), life.edu.gpa >= 80 ? 'good' : life.edu.gpa < 50 ? 'bad' : undefined);
  if (life.edu.stage === 'secondary' && life.age === 15 && !life.examDone) pushes.push({ sys: 'gr_exam' });
  if (life.age === 18 && !life.gradesDone && life.edu.level === 'highschool') pushes.push({ sys: 'gr_grades' });
  // Lối sống
  if (life.age >= 12) {
    const H = habits(life);
    if (life.job && life.job.culture === 'grind') H.stress = clamp(H.stress + 4);
    if (life.ill) H.stress = clamp(H.stress + 3);
    const dh = (H.sleep - 50) / 25 + (H.move - 50) / 25 - Math.max(0, H.drink - 30) / 20 - (H.stress - 50) / 30 - Math.max(0, H.screen - 65) / 40;
    life.stats.health = clamp(life.stats.health + Math.round(dh));
    life.stats.happy = clamp(life.stats.happy + Math.round(-(H.stress - 50) / 30 + (H.move - 50) / 50));
    for (const k of Object.keys(H)) H[k] = clamp(H[k] + Math.round((({ sleep: 55, move: 45, drink: 15, screen: 55, stress: 40 })[k] - H[k]) * 0.08) + randint(life, -2, 2));
  }
  // Văn hóa công sở & danh tiếng nghề
  if (life.job) {
    if (!life.job.culture) life.job.culture = pick(life, Object.keys(CULTURES));
    const c = life.job.culture;
    if (c === 'family') life.stats.happy = clamp(life.stats.happy + 2);
    if (c === 'startup') life.job.perf = clamp((life.job.perf || 50) + randint(life, -3, 5));
    if (c === 'drama') me(life).scandal = clamp((life.ix?.scandal || 0) + 1);
    if (chance(life, 0.3 * fm)) pushes.push({ sys: 'gr_office', c });
    if (life.prorep == null) life.prorep = 30;
    life.prorep = clamp(life.prorep + Math.round(((life.job.perf || 50) - 50) / 12) - Math.round((life.ix?.scandal || 0) / 30) + (c === 'corporate' ? 1 : 0));
    if (life.prorep >= 70 && chance(life, 0.18)) pushes.push({ sys: 'gr_headhunt' });
    if (life.prorep >= 85 && chance(life, 0.15)) { life.stats.fame = clamp(life.stats.fame + 3); addLog(life, L('Bạn nhận giải thưởng của hiệp hội ngành nghề. Đồng nghiệp cũ gửi lời chúc mừng.', 'You win your industry association award. Former colleagues send congratulations.'), 'good'); }
  } else if (life.prorep != null) life.prorep = clamp(life.prorep - 2);
  // Khởi nghiệp
  if (life.biz && !life.startup && (life.biz.years || 0) <= 1) life.startup = { stage: 0, since: life.age };
  if (!life.biz && life.startup && life.startup.stage < 5) life.startup = null;
  if (life.startup && life.biz && life.startup.stage < 5 && chance(life, 0.45)) pushes.push({ sys: 'gr_startup' });
  // Tiêu tiền
  if (life.age >= 18) {
    const s = life.spend || 'balanced';
    if (s === 'frugal') { life.money += 0.04 * gdp; life.stats.happy = clamp(life.stats.happy - 1); }
    else if (s === 'lavish') { life.money -= 0.1 * gdp; life.stats.happy = clamp(life.stats.happy + 2); if (chance(life, 0.3)) life.stats.looks = clamp(life.stats.looks + 1); }
    else if (s === 'impulsive' && chance(life, 0.45)) { const x = randint(life, 3, 15); life.money -= u(life, x); life.stats.happy = clamp(life.stats.happy + 3); addLog(life, pick(life, [L('Bạn mua một chiếc máy làm kem lúc 2 giờ sáng. Nó vẫn còn nguyên hộp.', 'You buy an ice-cream maker at 2am. It is still in the box.'), L('Một đôi giày "chỉ còn 2 đôi cuối" giờ là của bạn.', 'A pair of "only 2 left!" shoes is now yours.'), L('Bạn đặt một khóa học online về thứ bạn chưa từng quan tâm.', 'You sign up for an online course on something you never cared about.')])); }
  }
  // Người yêu có đời riêng
  const pt = partner(life);
  if (pt && pt.age >= 18 && life.age >= 18 && chance(life, 0.28 * fm)) pushes.push({ sys: 'gr_ptlife', id: pt.id, k: pick(life, ['promo', 'hobby', 'abroad', 'friend', 'dream']) });
  // Người tình dạy bạn điều mới
  if (life.age >= 18) {
    const m = me(life);
    m.learned ||= [];
    for (const p of life.people) {
      if (!adultOK(life, p) || !ROM.includes(p.role) || p.taughtYou || !chance(life, 0.3)) continue;
      const left = Object.keys(LEARN).filter((k) => !m.learned.includes(k) && (!LEARN[k].adult || st?.adult25));
      if (!left.length) break;
      const k = pick(life, left);
      m.learned.push(k); p.taughtYou = k;
      m.charm = clamp((m.charm || 0) + 3);
      if (k === 'confidence') life.stats.willpower = clamp(life.stats.willpower + 4);
      if (k === 'language') life.stats.smarts = clamp(life.stats.smarts + 3);
      if (k === 'dance') life.stats.looks = clamp(life.stats.looks + 2);
      addLog(life, L(LEARN[k].text.vi.replace(/\{n\}/g, nm(life, p)), LEARN[k].text.en.replace(/\{n\}/g, nm(life, p))), 'good');
      break;
    }
  }
  // Thú cưng có tính cách
  for (const p of life.people) {
    if (p.role !== 'pet' || !p.alive) continue;
    if (!p.persona) p.persona = pick(life, Object.keys(PET_P));
    if (chance(life, 0.25)) { const x = PET_P[p.persona]; addLog(life, L(x.line.vi.replace(/\{n\}/g, p.first), x.line.en.replace(/\{n\}/g, p.first))); }
    if (p.persona === 'chaos' && chance(life, 0.08)) pushes.push({ sys: 'gr_pet', id: p.id });
  }
  // Nhà có chuyện
  for (const h of life.homes || []) {
    if (!h.story) h.story = pick(life, Object.keys(HSTORY));
    if (chance(life, 0.15)) addLog(life, HSTORY[h.story].line);
    if ((h.story === 'hidden' && !h.opened && chance(life, 0.25)) || (h.story === 'haunted' && !h.settled && chance(life, 0.12))) pushes.push({ sys: 'gr_house', story: h.story });
  }
  // Hàng xóm
  if (life.age >= 18 && (!life.hood || life.hood.home !== (life.homes?.[0]?.id || 'rent'))) life.hood = { vibe: pick(life, Object.keys(HOOD)), home: life.homes?.[0]?.id || 'rent', since: life.age };
  if (life.hood && chance(life, 0.22 * fm)) pushes.push({ sys: 'gr_hood', k: pick(life, ['party', 'noise', 'elder', 'dog', 'rep']) });
  // Lời tiên tri
  const pr = life.prophecy;
  if (pr) {
    if (chance(life, 0.35)) {
      const k = pr.kind;
      if (k === 'love' && life.age >= 18) { const p = randomPerson(life, life, { role: 'contact', gender: life.orientation === 'same' ? life.gender : life.gender === 'male' ? 'female' : 'male', age: clamp(life.age + randint(life, -5, 5), 18, 90), closeness: 45 }); p.att = 'crush'; p.orient = 'bi'; life.people.push(p); }
      if (k === 'money') life.money += u(life, randint(life, 10, 40));
      if (k === 'health') life.stats.health = clamp(life.stats.health - 5);
      if (k === 'career' && life.job) life.job.perf = clamp((life.job.perf || 50) + 15);
      if (k === 'travel') life.stats.happy = clamp(life.stats.happy + 6);
      addLog(life, L(`Lời tiên tri năm bạn ${pr.from} tuổi đã ứng nghiệm: ${PROPHECY[k].vi}`, `The prophecy from age ${pr.from} comes true: ${PROPHECY[k].en}`), k === 'health' ? 'bad' : 'good');
      life.prophecy = null;
    } else if (life.age >= pr.until) { addLog(life, L('Lời tiên tri không ứng nghiệm. Nghe nói bà thầy bói đã chuyển nhà.', 'The prophecy never came true. Word is the fortune teller moved away.')); life.prophecy = null; }
  }
  // Biến động xã hội
  if (life.age >= 10 && chance(life, 0.035 * fm)) { const k = pick(life, ['pandemic', 'crash', 'boom', 'flood', 'blackout']); if (!(life.shocks || []).some((x) => x.k === k && life.age - x.age < 15)) { (life.shocks ||= []).push({ k, age: life.age }); pushes.push({ sys: 'gr_shock', k }); } }
  // Bí mật gia đình
  if (!life.famSecret && life.age >= 25 && life.age <= 60 && chance(life, 0.04 * fm)) pushes.push({ sys: 'gr_secret', k: pick(life, ['lostsib', 'fortune', 'letters', 'recipe']) });
  // Con cái có đời riêng
  const kids = people(life, 'child');
  const adultKids = kids.filter((k) => k.age >= 18);
  const teens = kids.filter((k) => k.age >= 13 && k.age < 18);
  if (adultKids.length && chance(life, 0.25 * fm)) pushes.push({ sys: 'gr_kid', id: pick(life, adultKids).id, k: pick(life, ['partner', 'career', 'money', 'grandkid', 'secret']) });
  else if (teens.length && chance(life, 0.2 * fm)) pushes.push({ sys: 'gr_teen', id: pick(life, teens).id, k: pick(life, ['grades', 'sport', 'job', 'mood']) });
  for (const x of pushes.slice(0, (freqOf(st).cap || 3) + 1)) life.queue.push(x);
}

// ───────── Sự kiện hệ thống ─────────
export function buildGrowthSys(life, item, st) {
  if (!item.sys || !item.sys.startsWith('gr_')) return null;
  const s = item.sys;
  if (s === 'gr_teacher') {
    if (life.teacherMet) return null;
    if (!item.pid) { const p = randomPerson(life, life, { role: 'teacher', age: randint(life, 30, 55), closeness: 55 }); p.job = L('Giáo viên', 'Teacher'); life.people.push(p); item.pid = p.id; }
    const p = byId(life, item.pid);
    if (!p) return null;
    const n = nm(life, p);
    const done = (lf) => { lf.teacherMet = true; };
    return sev('sys/gr_teacher', L(`Cô/thầy ${n} giữ bạn lại sau giờ học: "Em có biết em giỏi hơn em nghĩ không?"`, `Your teacher, ${n}, keeps you after class: "Do you know you're better than you think?"`), [
      { label: L('Hỏi cô/thầy cách để giỏi hơn', 'Ask how to get better'), outcomes: [oc(L(`${n} cho bạn mượn sách và mỗi tuần dành 15 phút giảng thêm. Bạn sẽ nhớ điều này cả đời.`, `${n} lends you books and gives you 15 extra minutes a week. You'll remember this all your life.`), { smarts: 5, willpower: 3 }, (lf) => { done(lf); p.closeness = 75; lf.edu.gpa = clamp(lf.edu.gpa + 8); })] },
      { label: L('Ngượng ngùng gật đầu', 'Nod awkwardly'), outcomes: [oc(L('Bạn không nói gì, nhưng tối đó bạn làm bài tập kỹ hơn mọi khi.', "You say nothing, but that night you do your homework more carefully than ever."), { smarts: 2, happy: 2 }, (lf) => { done(lf); })] },
      { label: L('Nói em chỉ muốn chơi', 'Say you just want to play'), outcomes: [oc(L(`${n} mỉm cười: "Chơi cũng là học, nếu em chơi nghiêm túc."`, `${n} smiles: "Play is learning too, if you play seriously."`), { happy: 3 }, (lf) => { done(lf); p.closeness = 50; })] },
    ]);
  }
  if (s === 'gr_teacher2') {
    const p = byId(life, item.id);
    if (!p || !p.alive) return null;
    const n = nm(life, p);
    return sev('sys/gr_teacher2', L(`Bạn tình cờ gặp lại ${n}, người thầy/cô năm xưa. Tóc đã bạc, ánh mắt vẫn vậy.`, `You bump into ${n}, your old teacher. Grey hair now, same eyes.`), [
      { label: L('Cảm ơn vì đã tin mình', 'Thank them for believing in you'), outcomes: [oc(L(`${n} rưng rưng: "Thầy/cô vẫn nhớ em." Hai người uống trà cả buổi chiều.`, `${n} tears up: "I still remember you." You spend the afternoon over tea.`), { happy: 10, karma: 3 }, (lf) => { lf.teacherBack = true; p.closeness = clamp(p.closeness + 15); addMoment(lf, p, L(`Gặp lại ${n}`, `Meeting ${n} again`), '🍵'); })] },
      { label: L('Mời về nói chuyện ở nơi bạn làm', 'Invite them to speak at your workplace'), outcomes: [oc(L('Bài nói của họ khiến cả văn phòng im phăng phắc.', 'Their talk leaves the whole office silent.'), { happy: 6, fame: 1 }, (lf) => { lf.teacherBack = true; p.closeness = clamp(p.closeness + 8); })] },
    ]);
  }
  if (s === 'gr_exam') {
    if (life.examDone) return null;
    const d = (lf) => { lf.examDone = true; };
    return sev('sys/gr_exam', L('Kỳ thi chuyển cấp sắp đến. Cả nhà nói chuyện về nó trong mọi bữa ăn.', 'The big entrance exam is coming. It comes up at every family meal.'), [
      { label: L('Ôn thi ngày đêm', 'Study day and night'), outcomes: [oc(L('Bạn đỗ vào trường tốt nhất vùng. Bố mẹ khoe với cả họ.', 'You get into the best school in the area. Your parents tell the whole family.'), { smarts: 4, happy: 6, health: -2 }, (lf) => { d(lf); lf.edu.gpa = clamp(lf.edu.gpa + 12); }, null, clamp(0.4 + life.stats.smarts / 200, 0.3, 0.9)), oc(L('Bạn trượt nguyện vọng một sau tất cả cố gắng. Bạn khóc một đêm, rồi đứng dậy.', 'You miss your first choice after all that work. You cry for a night, then get up.'), { happy: -6, willpower: 4 }, (lf) => { d(lf); lf.edu.gpa = clamp(lf.edu.gpa + 4); }, null, 1 - clamp(0.4 + life.stats.smarts / 200, 0.3, 0.9))] },
      { label: L('Học vừa phải, giữ sức', 'Study steadily, stay rested'), outcomes: [oc(L('Kết quả khá. Bạn vào một trường ổn và vẫn kịp chơi hè.', 'A solid result. You get into a decent school and still enjoy summer.'), { smarts: 2, happy: 3 }, (lf) => { d(lf); lf.edu.gpa = clamp(lf.edu.gpa + 5); })] },
      { label: L('Phó mặc cho may rủi', 'Leave it to luck'), outcomes: [oc(L('May mắn đứng về phía bạn. Lần này thôi.', 'Luck is on your side. This time.'), { happy: 4, risk: 2 }, (lf) => { d(lf); }, null, 0.4), oc(L('May mắn bận việc khác.', 'Luck was busy elsewhere.'), { happy: -5 }, (lf) => { d(lf); lf.edu.gpa = clamp(lf.edu.gpa - 8); }, null, 0.6)] },
    ]);
  }
  if (s === 'gr_grades') {
    if (life.gradesDone) return null;
    const g = life.edu.gpa;
    const d = (lf) => { lf.gradesDone = true; };
    if (g >= 85) return sev('sys/gr_grades', L('Điểm tốt nghiệp của bạn thuộc top đầu cả nước. Một quỹ học bổng gọi điện.', 'Your graduation scores are among the best in the country. A scholarship fund calls.'), [
      { label: L('Nhận học bổng', 'Accept the scholarship'), outcomes: [oc(L('Học phí được lo trọn. Bố mẹ khóc trong điện thoại.', 'Tuition fully covered. Your parents cry on the phone.'), { money: 40, happy: 10 }, d)] },
      { label: L('Nhường cho bạn khó khăn hơn', 'Give it to someone who needs it more'), outcomes: [oc(L('Người bạn đó viết thư cảm ơn bạn sau này, khi họ đã thành bác sĩ.', 'That student writes to thank you years later, as a doctor.'), { karma: 10, happy: 4 }, d)] },
    ]);
    if (g < 35) return sev('sys/gr_grades', L('Điểm tốt nghiệp thấp hơn mong đợi. Bố mẹ im lặng nhìn bảng điểm.', 'Your graduation scores are lower than hoped. Your parents stare at the results in silence.'), [
      { label: L('Xin thi lại năm sau', 'Ask to retake next year'), outcomes: [oc(L('Một năm ôn luyện. Lần này bạn biết mình học vì ai.', 'A year of study. This time you know who you are doing it for.'), { willpower: 5, happy: -2 }, (lf) => { d(lf); lf.edu.gpa = clamp(lf.edu.gpa + 20); lf.stats.smarts = clamp(lf.stats.smarts + 3); })] },
      { label: L('Nói chuyện thật lòng với bố mẹ', 'Have an honest talk with your parents'), outcomes: [oc(L('Bố bạn nói: "Điểm số không phải tất cả. Nhưng con phải tìm được thứ con giỏi."', 'Your dad says: "Grades aren\'t everything. But you have to find what you\'re good at."'), { happy: 3, rel_father: 5, rel_mother: 5 }, d)] },
    ]);
    life.gradesDone = true;
    return null;
  }
  if (s === 'gr_office') {
    if (!life.job || life.job.culture !== item.c) return null;
    const [q, opts] = CULT_EV[item.c];
    return sev('sys/gr_office', L(`${CULTURES[item.c].em} ${q.vi}`, `${CULTURES[item.c].em} ${q.en}`), opts.map(([lb, e]) => ({ label: lb, outcomes: [oc(L('Một ngày nữa ở công ty trôi qua.', 'Another day at the office goes by.'), e)] })));
  }
  if (s === 'gr_headhunt') {
    if (!life.job) return null;
    return sev('sys/gr_headhunt', L('Một công ty săn đầu người gọi: "Danh tiếng của anh/chị trong ngành rất tốt. Bên kia trả cao hơn 35%."', 'A headhunter calls: "Your reputation in the industry is excellent. The other side pays 35% more."'), [
      { label: L('Nhảy việc', 'Take the offer'), outcomes: [oc(L('Văn phòng mới, ghế mới, lương mới. Đồng nghiệp cũ tổ chức tiệc chia tay.', 'New office, new chair, new salary. Your old team throws you a farewell party.'), { happy: 6 }, (lf) => { lf.job.salary = Math.round(lf.job.salary * 1.35); lf.job.perf = 55; lf.job.culture = pick(lf, Object.keys(CULTURES)); lf.prorep = clamp(lf.prorep + 3); })] },
      { label: L('Dùng lời mời để đàm phán lương', 'Use it to negotiate a raise'), outcomes: [oc(L('Sếp bạn tăng lương ngay trong buổi chiều.', 'Your boss raises your salary that same afternoon.'), { happy: 4 }, (lf) => { lf.job.salary = Math.round(lf.job.salary * 1.12); }, null, 0.7), oc(L('Sếp bạn nói: "Vậy thì đi đi." Bạn ở lại, hơi ngượng.', 'Your boss says: "Then go." You stay, a bit embarrassed.'), { happy: -4 }, null, null, 0.3)] },
      { label: L('Từ chối, mình ổn ở đây', "Decline, you're happy here"), outcomes: [oc(L('Tin bạn từ chối lan đến tai sếp. Bạn được tin tưởng hơn.', 'Word of your loyalty reaches your boss. You are trusted more.'), { karma: 2 }, (lf) => { lf.job.perf = clamp((lf.job.perf || 50) + 6); })] },
    ]);
  }
  if (s === 'gr_startup') {
    const S = life.startup;
    const b = life.biz;
    if (!S || !b || S.stage >= 5) return null;
    const grow = (m) => (lf) => { if (lf.biz) lf.biz.value *= m; };
    const st2 = (n) => (lf) => { if (lf.startup) lf.startup.stage = n; };
    const both = (...fs) => (lf) => fs.forEach((f) => f(lf));
    const T = [
      [L('Khởi nghiệp, giai đoạn ý tưởng. Một quỹ đầu tư đồng ý nghe bạn thuyết trình 10 phút.', 'Startup, idea stage. An investor agrees to hear a 10-minute pitch.'), [
        [L('Thuyết trình bằng cả trái tim', 'Pitch with all your heart'), [[clamp(0.35 + life.stats.smarts / 300 + (life.ix?.charm || 0) / 400, 0.2, 0.85), L('Họ ký séc ngay tại bàn. Vòng hạt giống thành công!', 'They write a cheque on the spot. Seed round closed!'), { happy: 10 }, both(grow(1.6), st2(1))], [0, L('Họ nói "để suy nghĩ thêm". Bạn biết nghĩa là không.', 'They say "we\'ll think about it". You know what that means.'), { happy: -5 }, null]]],
        [L('Tự bỏ tiền túi', 'Bootstrap it'), [[0.5, L('Chậm nhưng chắc, và công ty vẫn là của bạn.', 'Slow but steady, and the company stays yours.'), { money: -15, willpower: 3 }, both(grow(1.25), st2(1))], [0.5, L('Tiền túi cạn nhanh hơn bạn tưởng. Công ty vẫn sống, nhưng chưa lớn.', 'Your savings drain faster than expected. The company survives, but does not grow.'), { money: -15 }, null]]],
        [L('Đổi hướng sản phẩm', 'Pivot the product'), [[0.5, L('Hướng mới trúng ngay nhu cầu thị trường.', 'The new direction hits a real need.'), { smarts: 2 }, both(grow(1.4), st2(1))], [0.5, L('Đổi hướng ba lần trong một năm. Đội ngũ chóng mặt.', 'Three pivots in one year. The team is dizzy.'), { happy: -3 }, null]]],
      ]],
      [L('Khởi nghiệp, giai đoạn hạt giống. Bạn cần người đồng sáng lập.', 'Startup, seed stage. You need a co-founder.'), [
        [L('Mời người bạn thân giỏi nhất', 'Bring in your most brilliant friend'), [[0.65, L('Hai người bù trừ cho nhau hoàn hảo.', 'You complement each other perfectly.'), { happy: 5 }, both(grow(1.5), st2(2))], [0.35, L('Tình bạn và công việc trộn lẫn khó hơn bạn tưởng.', 'Mixing friendship and business is harder than you thought.'), { happy: -4 }, grow(1.1)]]],
        [L('Tuyển người lạ có kinh nghiệm', 'Hire an experienced stranger'), [[0.6, L('Chuyên nghiệp, đáng tin, hơi khô khan. Doanh thu tăng đều.', 'Professional, reliable, a bit dry. Revenue climbs steadily.'), { smarts: 1 }, both(grow(1.35), st2(2))], [0.4, L('Họ nghỉ sau ba tháng để mở công ty đối thủ.', 'They quit after three months to start a rival.'), { happy: -4 }, grow(0.9)]]],
      ]],
      [L('Khởi nghiệp, tăng trưởng. Máy chủ sập đúng ngày ra mắt tính năng lớn.', 'Startup, growth. The servers crash on launch day of your biggest feature.'), [
        [L('Thức trắng cùng đội kỹ thuật', 'Pull an all-nighter with the engineers'), [[0.7, L('Sáng ra mọi thứ chạy lại. Đội ngũ coi bạn như người hùng.', 'By morning everything is back. The team treats you like a hero.'), { health: -3, happy: 6 }, both(grow(1.5), st2(3))], [0.3, L('Sửa xong thì khách hàng đã chuyển sang đối thủ. Công ty không gượng dậy nổi.', 'By the time it is fixed, customers have moved to a rival. The company never recovers.'), { happy: -8 }, both(grow(0.5), (lf) => { lf.startup = { stage: 5, failed: true, since: lf.startup.since }; })]]],
        [L('Xin lỗi công khai, tặng khách một tháng miễn phí', 'Apologise publicly, give a free month'), [[1, L('Khách hàng cảm kích sự thành thật. Một số còn viết thư khen.', 'Customers appreciate the honesty. Some even write in to praise you.'), { karma: 3, money: -5 }, both(grow(1.3), st2(3))]]],
      ]],
      [L('Khởi nghiệp, giai đoạn mở rộng. Một tập đoàn lớn muốn mua lại công ty của bạn.', 'Startup, scale-up. A big corporation wants to buy your company.'), [
        [L('Bán, chốt lời', 'Sell and cash out'), [[1, L('Hợp đồng ký xong. Con số trong tài khoản khiến bạn phải đếm lại ba lần.', 'The deal is signed. You count the zeros in your account three times.'), { happy: 15 }, (lf) => { if (lf.biz) { lf.money += lf.biz.value * 1.3; lf.biz = null; } lf.startup = { stage: 5, sold: true, since: lf.startup.since }; milestone(lf, L('Bán công ty khởi nghiệp', 'Sold your startup'), 'good'); }]]],
        [L('Từ chối, nhắm tới niêm yết', 'Decline and aim for an IPO'), [[1, L('Bạn nói "chưa đến lúc". Hội đồng quản trị nín thở.', 'You say "not yet". The board holds its breath.'), { willpower: 3 }, st2(4)]]],
      ]],
      [L('Khởi nghiệp, ngày niêm yết. Bạn đứng trước chiếc chuông của sàn giao dịch.', 'Startup, IPO day. You stand before the stock exchange bell.'), [
        [L('Rung chuông', 'Ring the bell'), [[0.55, L('Cổ phiếu tăng vọt ngay phiên đầu. Bạn lên trang nhất báo kinh tế.', 'Shares soar on day one. You make the front page of the business papers.'), { fame: 10, happy: 15 }, both(grow(3), st2(5), (lf) => { lf.startup.ipo = true; milestone(lf, L('Đưa công ty lên sàn', 'Took your company public'), 'good'); })], [0.45, L('Cổ phiếu đi ngang. Không thảm họa, nhưng không như mơ.', 'Shares go nowhere. Not a disaster, but not the dream.'), { happy: -3, fame: 3 }, both(grow(1.3), st2(5))]]],
      ]],
    ][S.stage];
    return sev('sys/gr_startup', T[0], T[1].map(([lb, outs]) => {
      const tot = outs.reduce((a, o) => a + o[0], 0);
      const list = outs.length > 1 && tot < 1 ? outs.map((o, i) => (i === outs.length - 1 && o[0] === 0 ? [1 - tot, ...o.slice(1)] : o)) : outs;
      return { label: lb, outcomes: list.map(([c, text, e, run]) => oc(text, e, run, null, c)) };
    }));
  }
  if (s === 'gr_ptlife') {
    const p = byId(life, item.id);
    if (!p || !p.alive || !ROM.includes(p.role)) return null;
    const n = nm(life, p);
    if (item.k === 'promo') return sev('sys/gr_pt', L(`${n} được thăng chức! Họ gọi cho bạn đầu tiên.`, `${n} gets promoted! You're the first person they call.`), [
      { label: L('Tổ chức tiệc mừng bất ngờ', 'Throw a surprise party'), outcomes: [oc(L(`${n} khóc khi thấy bạn bè đông đủ.`, `${n} cries when they see everyone there.`), { happy: 6, money: -3 }, (lf) => { p.closeness = clamp(p.closeness + 10); p.income = Math.round((p.income || country(lf).gdp) * 1.25); addMoment(lf, p, L(`Tiệc mừng ${n} thăng chức`, `${n}'s promotion party`), '🎉'); })] },
      { label: L('Chúc mừng qua tin nhắn', 'Congratulate by text'), outcomes: [oc(L('Họ trả lời bằng một biểu tượng cảm xúc. Hơi hụt hẫng.', 'They reply with one emoji. A bit deflated.'), {}, () => { p.closeness = clamp(p.closeness - 2); p.income = Math.round((p.income || 0) * 1.25); })] },
    ]);
    if (item.k === 'hobby') return sev('sys/gr_pt', L(`${n} mê leo núi và rủ bạn đi cùng cuối tuần này.`, `${n} has gotten into climbing and invites you this weekend.`), [
      { label: L('Đi cùng', 'Go along'), outcomes: [oc(L('Bạn treo lơ lửng giữa vách đá và cười như điên. Họ tự hào về bạn.', 'You dangle from the wall laughing like mad. They are proud of you.'), { happy: 5, health: 2 }, () => { p.closeness = clamp(p.closeness + 8); })] },
      { label: L('Để họ có không gian riêng', 'Give them their own space'), outcomes: [oc(L('Họ về nhà kể chuyện cả tối, mắt sáng rỡ.', 'They come home and talk all evening, eyes shining.'), { happy: 2 }, () => { p.closeness = clamp(p.closeness + 3); })] },
    ]);
    if (item.k === 'abroad') return sev('sys/gr_pt', L(`${n} nhận được lời mời làm việc ở nước ngoài trong hai năm. Họ hỏi ý bạn.`, `${n} is offered a two-year job abroad. They ask what you think.`), [
      { label: L('Ủng hộ, yêu xa', 'Support them, go long-distance'), outcomes: [oc(L('Những cuộc gọi lúc nửa đêm, những lá thư tay. Tình yêu vượt qua múi giờ.', 'Midnight calls, handwritten letters. Love survives the time zones.'), { happy: -2 }, () => { p.closeness = clamp(p.closeness + 6); p.income = Math.round((p.income || 0) * 1.5); }, null, 0.7), oc(L('Khoảng cách khiến hai người xa dần.', 'The distance slowly pulls you apart.'), { happy: -6 }, () => { p.closeness = clamp(p.closeness - 20); }, null, 0.3)] },
      { label: L('Đi cùng họ', 'Go with them'), outcomes: [oc(L('Bạn xếp hai vali và một đời mới. Hai người chưa bao giờ gắn bó hơn.', 'You pack two suitcases and a new life. You have never been closer.'), { happy: 8, money: -10 }, (lf) => { p.closeness = clamp(p.closeness + 12); if (lf.job && chance(lf, 0.5)) { lf.job = null; addLog(lf, L('Bạn nghỉ việc để đi cùng người ấy.', 'You quit your job to go with them.')); } })] },
      { label: L('Xin họ ở lại', 'Ask them to stay'), outcomes: [oc(L(`${n} ở lại vì bạn. Đôi khi bạn thấy họ nhìn bản đồ thế giới hơi lâu.`, `${n} stays for you. Sometimes you catch them staring at the world map.`), {}, () => { p.closeness = clamp(p.closeness - 5); })] },
    ]);
    if (item.k === 'friend') return sev('sys/gr_pt', L(`Bạn thân của ${n} đang gặp khủng hoảng và ở nhờ nhà hai người một tháng.`, `${n}'s best friend is in crisis and needs to stay with you for a month.`), [
      { label: L('Đón tiếp nồng hậu', 'Welcome them warmly'), outcomes: [oc(L(`${n} biết ơn bạn nhiều hơn bạn nghĩ.`, `${n} is more grateful than you know.`), { karma: 3, happy: -1 }, () => { p.closeness = clamp(p.closeness + 8); })] },
      { label: L('Đặt giới hạn rõ ràng', 'Set clear boundaries'), outcomes: [oc(L('Một tháng trôi qua êm đẹp nhờ có luật nhà.', 'The month passes smoothly thanks to house rules.'), { willpower: 2 }, () => { p.closeness = clamp(p.closeness + 2); })] },
    ]);
    return sev('sys/gr_pt', L(`${n} kể về giấc mơ mở một tiệm sách nhỏ của họ.`, `${n} tells you about their dream of opening a little bookshop.`), [
      { label: L('Góp vốn giúp họ thực hiện', 'Help fund it'), outcomes: [oc(L('Tiệm sách mở cửa. Bạn là khách hàng đầu tiên và thường xuyên nhất.', 'The bookshop opens. You are its first and most loyal customer.'), { money: -15, happy: 8 }, (lf) => { p.closeness = clamp(p.closeness + 15); p.dream = true; addMoment(lf, p, L(`Ngày khai trương tiệm sách của ${n}`, `The day ${n}'s bookshop opened`), '📚'); })] },
      { label: L('Khuyên họ cứ thử từ từ', 'Encourage them to start small'), outcomes: [oc(L('Họ bắt đầu bằng một kệ sách ở quán cà phê quen. Hạnh phúc lắm.', 'They start with one shelf in a local café. Very happy.'), { happy: 3 }, () => { p.closeness = clamp(p.closeness + 6); })] },
    ]);
  }
  if (s === 'gr_hobby') {
    const H = HOBBIES[item.id];
    if (!H) return null;
    return sev('sys/gr_hobby', L(`Bạn đã lên cấp 5 ${H.name.vi.toLowerCase()} ${H.em}. Có một cuộc thi trong thành phố.`, `You've reached level 5 in ${H.name.en.toLowerCase()} ${H.em}. There's a contest in town.`), [
      { label: L('Đăng ký thi', 'Enter'), outcomes: [oc(L('Bạn giành giải nhì! Ảnh bạn lên báo địa phương.', 'You win second place! Your photo makes the local paper.'), { happy: 10, fame: 3, money: 5 }, (lf) => { hobbyOf(lf, item.id).xp += 20; }, null, 0.45), oc(L('Không có giải, nhưng bạn học được rất nhiều từ người thắng.', 'No prize, but you learn a lot from the winner.'), { smarts: 1, happy: 1 }, (lf) => { hobbyOf(lf, item.id).xp += 10; }, null, 0.55)] },
      { label: L('Chỉ đi xem', 'Just watch'), outcomes: [oc(L('Bạn ghi chép lia lịa và về nhà tập thêm.', 'You take frantic notes and go home to practise.'), {}, (lf) => { hobbyOf(lf, item.id).xp += 8; })] },
    ]);
  }
  if (s === 'gr_pet') {
    const p = byId(life, item.id);
    if (!p || !p.alive) return null;
    return sev('sys/gr_pet', L(`${p.first} vừa "trang trí lại" phòng khách: ghế sofa giờ là ghế sofa trừu tượng.`, `${p.first} just "redecorated" the living room: the sofa is now abstract art.`), [
      { label: L('Mua sofa mới, chống cào', 'Buy a new scratch-proof sofa'), outcomes: [oc(L(`${p.first} nhìn chiếc sofa mới với vẻ thách thức.`, `${p.first} eyes the new sofa like a challenge.`), { money: -6 })] },
      { label: L('Chụp ảnh đăng mạng', 'Post photos online'), outcomes: [oc(L(`${p.first} nổi tiếng một tuần. Bạn thì không.`, `${p.first} goes viral for a week. You don't.`), { happy: 4, fame: 1 })] },
      { label: L('Thuê người huấn luyện', 'Hire a trainer'), outcomes: [oc(L(`Sau ba buổi, ${p.first} biết ngồi. Rồi quên.`, `After three sessions, ${p.first} learns to sit. Then forgets.`), { money: -3 }, () => { p.closeness = clamp(p.closeness + 5); })] },
    ]);
  }
  if (s === 'gr_house') {
    const h = (life.homes || []).find((x) => x.story === item.story);
    if (!h) return null;
    if (item.story === 'hidden') return sev('sys/gr_house', L('Sau tấm gỗ ốp tường có một cánh cửa nhỏ. Bên trong tối om.', 'Behind a wall panel is a small door. Inside, pitch black.'), [
      { label: L('Cầm đèn pin vào xem', 'Go in with a torch'), outcomes: [oc(L('Một chiếc hộp thiếc, bên trong là tiền xu cổ và một tấm ảnh cưới năm 1962.', 'A tin box: old coins and a wedding photo from 1962.'), { happy: 8 }, (lf) => { h.opened = true; lf.money += u(lf, randint(lf, 5, 30)); }, null, 0.7), oc(L('Chỉ có bụi, mạng nhện, và một con nhện rất lớn nhìn bạn.', 'Just dust, cobwebs, and a very large spider staring at you.'), { happy: -2 }, () => { h.opened = true; }, null, 0.3)] },
      { label: L('Đóng lại, coi như không thấy', 'Close it and forget it'), outcomes: [oc(L('Đêm đó bạn ngủ không yên.', 'You sleep badly that night.'), { happy: -1 }, () => { h.opened = true; })] },
    ]);
    return sev('sys/gr_house', L('"Bạn cùng nhà vô hình" lại bật tivi lúc 3 giờ sáng.', 'Your "invisible housemate" turns on the TV at 3am again.'), [
      { label: L('Mời thầy về làm lễ', 'Call someone to bless the house'), outcomes: [oc(L('Từ đó căn nhà yên tĩnh lạ thường.', 'The house has been strangely calm ever since.'), { money: -3, happy: 3 }, () => { h.settled = true; })] },
      { label: L('Chào hỏi như người nhà', 'Greet it like family'), outcomes: [oc(L('Bạn nói "Chúc ngủ ngon" mỗi tối. Tivi không tự bật nữa. Có lẽ nó chỉ cần được để ý.', 'You say "goodnight" every evening. The TV stops. Maybe it just wanted attention.'), { happy: 4, karma: 1 }, () => { h.settled = true; })] },
      { label: L('Kiểm tra lại hệ thống điện', 'Check the wiring'), outcomes: [oc(L('Thợ điện tìm ra một mối nối lỏng. Bí ẩn được giải. Bạn hơi tiếc.', 'The electrician finds a loose connection. Mystery solved. You feel a little sad.'), { money: -2, smarts: 1 }, () => { h.settled = true; })] },
    ]);
  }
  if (s === 'gr_hood') {
    const V = life.hood ? HOOD[life.hood.vibe] : HOOD.quiet;
    let nb = life.people.find((p) => p.role === 'neighbor' && p.alive);
    if (!nb && item.k !== 'rep') { if (!item.pid) { const q = randomPerson(life, life, { role: 'neighbor', age: randint(life, 25, 80), closeness: 40 }); life.people.push(q); item.pid = q.id; } nb = byId(life, item.pid); }
    const n = nb ? nm(life, nb) : '';
    if (item.k === 'party') return sev('sys/gr_hood', L(`${V.em} Khu phố tổ chức tiệc đường phố. Mỗi nhà góp một món.`, `${V.em} The street is having a block party. Every household brings a dish.`), [
      { label: L('Góp món tủ', 'Bring your best dish'), outcomes: [oc(L('Món của bạn hết đầu tiên. Bạn được hỏi công thức cả tối.', 'Your dish is gone first. People ask for the recipe all night.'), { happy: 6, karma: 2 }, () => { if (nb) nb.closeness = clamp(nb.closeness + 8); })] },
      { label: L('Mua đồ ăn sẵn, giả vờ tự nấu', 'Buy food and pretend you made it'), outcomes: [oc(L('Không ai phát hiện. Trừ bà cụ nhà bên, nhưng bà nháy mắt.', 'Nobody notices. Except the old lady next door, who winks.'), { happy: 3, money: -2 })] },
    ]);
    if (item.k === 'noise') return sev('sys/gr_hood', L(`${n} nhà bên bật nhạc to đến 1 giờ sáng ba đêm liền.`, `${n} next door plays loud music until 1am three nights running.`), [
      { label: L('Sang gõ cửa nói chuyện', 'Knock and talk'), outcomes: [oc(L(`${n} xin lỗi rối rít và tặng bạn một hộp bánh.`, `${n} apologises profusely and gives you a box of cakes.`), { happy: 3 }, () => { if (nb) nb.closeness = clamp(nb.closeness + 6); }, null, 0.7), oc(L(`${n} đóng cửa cái rầm. Chiến tranh lạnh bắt đầu.`, `${n} slams the door. A cold war begins.`), { happy: -4 }, () => { if (nb) { nb.closeness = clamp(nb.closeness - 15); nb.att = 'rival'; } }, null, 0.3)] },
      { label: L('Sang dự luôn', 'Join the party'), outcomes: [oc(L('Hóa ra là sinh nhật. Bạn hát chúc mừng như người quen lâu năm.', 'It turns out to be a birthday. You sing along like an old friend.'), { happy: 5, health: -1 }, () => { if (nb) nb.closeness = clamp(nb.closeness + 10); })] },
      { label: L('Mua nút bịt tai', 'Buy earplugs'), outcomes: [oc(L('Bạn ngủ ngon. Bạn cũng không nghe thấy chuông báo thức.', 'You sleep well. You also miss your alarm.'), { happy: 1 })] },
    ]);
    if (item.k === 'elder') return sev('sys/gr_hood', L(`${n}, người hàng xóm lớn tuổi sống một mình, bị ngã và cần người đi chợ giúp.`, `${n}, an elderly neighbour who lives alone, has had a fall and needs help with shopping.`), [
      { label: L('Đi chợ giúp mỗi tuần', 'Shop for them every week'), outcomes: [oc(L(`${n} kể cho bạn nghe cả lịch sử khu phố. Bạn mong đến thứ Bảy.`, `${n} tells you the whole history of the street. You look forward to Saturdays.`), { karma: 6, happy: 4 }, (lf) => { if (nb) nb.closeness = clamp(nb.closeness + 15); addMoment(lf, nb, L(`Những thứ Bảy đi chợ cho ${n}`, `Saturday shopping for ${n}`), '🧺'); })] },
      { label: L('Đặt giao hàng giúp họ', 'Set up grocery delivery for them'), outcomes: [oc(L('Gọn gàng, hiệu quả. Họ cảm ơn bạn qua khe cửa.', 'Neat and efficient. They thank you through the door.'), { karma: 3, money: -1 })] },
    ]);
    if (item.k === 'dog') return sev('sys/gr_hood', L('Một chú chó lạc cứ đi theo bạn về tận cổng.', 'A lost dog follows you all the way home.'), [
      { label: L('Đăng tin tìm chủ', 'Post a found-dog notice'), outcomes: [oc(L('Chủ của nó đến đón, khóc và ôm bạn.', 'Its owner comes, crying, and hugs you.'), { karma: 4, happy: 4 }, null, null, 0.75), oc(L('Không ai đến nhận. Chú chó giờ là của bạn.', 'Nobody claims it. The dog is yours now.'), { happy: 8 }, (lf) => { const d = randomPerson(lf, lf, { role: 'pet', age: randint(lf, 1, 6), closeness: 70 }); d.species = 'dog'; d.first = pick(lf, ['Lucky', 'Mực', 'Vàng', 'Bông']); d.last = ''; d.lifespan = 14; lf.people.push(d); }, null, 0.25)] },
      { label: L('Cho ăn rồi để nó đi', 'Feed it and let it go'), outcomes: [oc(L('Nó ăn, vẫy đuôi, rồi đi tiếp hành trình của mình.', 'It eats, wags its tail, and continues on its way.'), { karma: 1 })] },
    ]);
    return sev('sys/gr_hood', L('Khu phố bầu tổ trưởng mới. Mọi người nhìn về phía bạn.', 'The street is electing a new neighbourhood rep. Everyone looks at you.'), [
      { label: L('Nhận lời', 'Accept'), outcomes: [oc(L('Bạn đắc cử với số phiếu gần tuyệt đối. Sự nghiệp chính trị bắt đầu từ một cái loa phường.', 'You win almost unanimously. A political career begins with a neighbourhood megaphone.'), { fame: 2, happy: 3 }, (lf) => { const P = pw(lf); if (!P.office) { P.office = 1; P.held = Math.max(P.held, 1); P.term = 4; } })] },
      { label: L('Từ chối khéo', 'Politely decline'), outcomes: [oc(L('Bạn đề cử bà cụ bán nước đầu ngõ. Bà thắng.', 'You nominate the old lady with the drinks stall. She wins.'), { karma: 2 })] },
    ]);
  }
  if (s === 'gr_shock') {
    const k = item.k;
    if (k === 'pandemic') return sev('sys/gr_shock', L('Một đại dịch bùng phát. Thành phố đóng cửa, đường phố vắng tanh.', 'A pandemic breaks out. The city locks down; the streets empty.'), [
      { label: L('Ở nhà, giữ an toàn', 'Stay home, stay safe'), outcomes: [oc(L('Bạn học làm bánh mì và nói chuyện với cây cảnh. Cả nhà an toàn.', 'You learn to bake bread and talk to your houseplants. Everyone stays safe.'), { happy: -5, health: 2 })] },
      { label: L('Đi tình nguyện hỗ trợ', 'Volunteer to help'), outcomes: [oc(L('Bạn giao đồ ăn cho người già suốt mùa dịch. Cả khu phố biết ơn bạn.', 'You deliver food to the elderly all season. The whole street is grateful.'), { karma: 10, health: -4, happy: 3 })] },
      ...(life.job ? [{ label: L('Làm việc từ xa', 'Work from home'), outcomes: [oc(L('Họp video mặc áo sơ mi và quần ngủ. Năng suất bất ngờ tăng.', 'Video calls in a shirt and pyjama bottoms. Productivity surprisingly rises.'), { happy: 1 }, (lf) => { if (lf.job) lf.job.perf = clamp((lf.job.perf || 50) + 4); })] }] : []),
    ]);
    if (k === 'crash') return sev('sys/gr_shock', L('Thị trường chứng khoán sụp đổ chỉ sau một đêm.', 'The stock market crashes overnight.'), [
      { label: L('Bình tĩnh giữ nguyên', 'Stay calm and hold'), outcomes: [oc(L('Vài năm sau thị trường hồi phục. Sự kiên nhẫn được đền đáp.', 'A few years later the market recovers. Patience pays off.'), { willpower: 4, happy: -3 })] },
      { label: L('Mua vào khi người khác hoảng loạn', 'Buy while others panic'), outcomes: [oc(L('Bạn mua đúng đáy. Một năm sau con số khiến bạn mỉm cười.', 'You buy at the bottom. A year later the numbers make you smile.'), { money: 20, risk: 3 }, null, null, 0.5), oc(L('Đáy vẫn còn đáy nữa. Bạn học được bài học đắt giá.', 'There was a floor below the floor. An expensive lesson.'), { money: -15, smarts: 2 }, null, null, 0.5)] },
    ]);
    if (k === 'boom') return sev('sys/gr_shock', L('Một cơn sốt công nghệ mới càn quét. Ai cũng nói về nó.', 'A new tech boom sweeps the world. Everyone is talking about it.'), [
      { label: L('Học ngay kỹ năng mới', 'Learn the new skills right away'), outcomes: [oc(L('Bạn đi trước thời đại một bước.', 'You get one step ahead of the curve.'), { smarts: 4 }, (lf) => { if (lf.job) lf.job.salary = Math.round(lf.job.salary * 1.08); })] },
      { label: L('Đứng ngoài quan sát', 'Watch from the sidelines'), outcomes: [oc(L('Bạn bè giàu lên rồi nghèo đi. Bạn vẫn vậy.', 'Friends get rich, then poor again. You stay the same.'), { willpower: 1 })] },
    ]);
    if (k === 'flood') return sev('sys/gr_shock', L('Mưa lớn kéo dài gây lũ. Nước dâng ngập cả khu.', 'Days of heavy rain bring flooding. The water rises across the neighbourhood.'), [
      { label: L('Cứu đồ đạc', 'Save your belongings'), outcomes: [oc(L('Bạn cứu được ảnh gia đình và giấy tờ. Sofa thì không.', 'You save the family photos and documents. Not the sofa.'), { money: -8, happy: -4 })] },
      { label: L('Giúp hàng xóm sơ tán', 'Help neighbours evacuate'), outcomes: [oc(L('Bạn chèo thuyền cao su chở ba gia đình ra chỗ khô. Báo địa phương gọi bạn là người hùng.', 'You paddle three families to dry land in an inflatable boat. The local paper calls you a hero.'), { karma: 8, fame: 3, money: -10 })] },
    ]);
    return sev('sys/gr_shock', L('Mất điện toàn thành phố ba ngày.', 'A city-wide blackout lasts three days.'), [
      { label: L('Thắp nến, kể chuyện', 'Light candles and tell stories'), outcomes: [oc(L('Lần đầu tiên sau nhiều năm cả nhà ngồi cùng nhau không có màn hình.', 'For the first time in years, the family sits together without screens.'), { happy: 5 }, (lf) => { for (const p of lf.people) if (p.alive && ['mother', 'father', 'child', 'spouse', 'partner'].includes(p.role)) p.closeness = clamp(p.closeness + 4); })] },
      { label: L('Đi tìm chỗ có máy phát điện', 'Find somewhere with a generator'), outcomes: [oc(L('Bạn sạc điện thoại ở quán cà phê cùng 60 người lạ. Thành bạn với vài người.', 'You charge your phone in a café with 60 strangers. You make a few friends.'), { happy: 2 })] },
    ]);
  }
  if (s === 'gr_secret') {
    if (life.famSecret) return null;
    const done = (lf) => { lf.famSecret = item.k; };
    if (item.k === 'lostsib') {
      if (!item.pid) { const q = randomPerson(life, life, { role: 'half', age: clamp(life.age + randint(life, -8, 8), 18, 90), closeness: 20 }); life.people.push(q); item.pid = q.id; }
      const p = byId(life, item.pid);
      if (!p) return null;
      const n = nm(life, p);
      return sev('sys/gr_secret', L(`Một người lạ tên ${n} liên lạc với bạn. Kết quả xét nghiệm ADN cho thấy: hai người là anh chị em cùng cha/mẹ khác.`, `A stranger named ${n} contacts you. A DNA test shows you are half-siblings.`), [
        { label: L('Gặp mặt, làm quen', 'Meet and get to know them'), outcomes: [oc(L(`Hai người có cùng một kiểu cười. ${n} giờ là một phần của gia đình.`, `You have the same laugh. ${n} is part of the family now.`), { happy: 8 }, (lf) => { done(lf); p.closeness = 55; addMoment(lf, p, L(`Lần đầu gặp ${n}`, `Meeting ${n} for the first time`), '🧬'); })] },
        { label: L('Cần thời gian', 'Need some time'), outcomes: [oc(L('Bạn lưu số điện thoại. Có lẽ một ngày nào đó.', 'You save the number. Maybe someday.'), { happy: -2 }, done)] },
      ]);
    }
    if (item.k === 'fortune') return sev('sys/gr_secret', L('Dọn nhà cũ của ông bà, bạn tìm thấy một sổ tiết kiệm đứng tên mình, mở từ khi bạn mới sinh.', "Clearing your grandparents' old house, you find a savings book in your name, opened the year you were born."), [
      { label: L('Rút tiền, làm điều ông bà mong', 'Withdraw it and do what they hoped'), outcomes: [oc(L('Bên trong có một tờ giấy nhỏ: "Cho cháu đi học." Bạn khóc.', 'Inside is a small note: "For your education." You cry.'), { happy: 6 }, (lf) => { done(lf); lf.money += u(lf, randint(lf, 20, 60)); })] },
      { label: L('Quyên góp mang tên ông bà', 'Donate it in their name'), outcomes: [oc(L('Một thư viện nhỏ ở quê mang tên ông bà bạn.', 'A small library back home now bears their names.'), { karma: 10, happy: 5 }, done)] },
    ]);
    if (item.k === 'letters') return sev('sys/gr_secret', L('Trong một chiếc hộp cũ, bạn tìm thấy những lá thư tình bố mẹ viết cho nhau trước khi cưới.', 'In an old box you find love letters your parents wrote before they married.'), [
      { label: L('Đọc hết trong một đêm', 'Read them all in one night'), outcomes: [oc(L('Bạn hiểu bố mẹ theo một cách hoàn toàn mới.', 'You understand your parents in a completely new way.'), { happy: 5 }, (lf) => { done(lf); for (const p of lf.people) if (['mother', 'father'].includes(p.role) && p.alive) p.closeness = clamp(p.closeness + 8); })] },
      { label: L('Cất lại, giữ bí mật của họ', 'Put them back, keep their secret'), outcomes: [oc(L('Có những câu chuyện thuộc về riêng hai người.', 'Some stories belong only to two people.'), { karma: 2 }, done)] },
    ]);
    return sev('sys/gr_secret', L('Bà bạn để lại một cuốn sổ công thức viết tay, kèm dòng chữ: "Chỉ truyền cho người biết nấu bằng cả trái tim."', 'Your grandmother leaves a handwritten recipe book: "Only for someone who cooks with their whole heart."'), [
      { label: L('Học nấu từng món', 'Learn every recipe'), outcomes: [oc(L('Món canh đầu tiên có vị y hệt ngày xưa. Cả nhà im lặng thưởng thức.', 'The first soup tastes exactly like before. The family eats in silence.'), { happy: 8 }, (lf) => { done(lf); hobbyOf(lf, 'cook').xp += 40; })] },
      { label: L('Mở một quán nhỏ theo công thức của bà', "Open a little eatery with her recipes"), outcomes: [oc(L('Quán nhỏ đông khách. Tấm ảnh bà treo ở quầy.', 'The little place fills up. Her photo hangs by the counter.'), { money: -15, happy: 6, fame: 2 }, (lf) => { done(lf); lf.money += u(lf, 25); })] },
    ]);
  }
  if (s === 'gr_kid') {
    const p = byId(life, item.id);
    if (!p || !p.alive || p.age < 18) return null;
    const n = nm(life, p);
    if (item.k === 'partner') {
      if (!p.mate) p.mate = randomPerson(life, life, { role: 'contact', age: p.age }).first;
      return sev('sys/gr_kid', L(`${n} dẫn người yêu tên ${p.mate} về ra mắt.`, `${n} brings their partner, ${p.mate}, home to meet you.`), [
        { label: L('Đón tiếp nồng hậu', 'Welcome them warmly'), outcomes: [oc(L(`${p.mate} thở phào. ${n} nhìn bạn đầy biết ơn.`, `${p.mate} relaxes. ${n} looks at you gratefully.`), { happy: 5 }, () => { p.closeness = clamp(p.closeness + 8); })] },
        { label: L('Hỏi han kỹ càng như phỏng vấn', 'Grill them like a job interview'), outcomes: [oc(L(`${p.mate} trả lời rất tốt. ${n} thì muốn độn thổ.`, `${p.mate} answers well. ${n} wants the ground to swallow them.`), { happy: 2 }, () => { p.closeness = clamp(p.closeness - 3); })] },
      ]);
    }
    if (item.k === 'career') return sev('sys/gr_kid', L(`${n} báo tin: họ quyết định trở thành ${pick(life, KID_JOBS).vi}.`, `${n} announces they've decided to become a ${pick(life, KID_JOBS).en}.`), [
      { label: L('Ủng hộ hết mình', 'Support them fully'), outcomes: [oc(L('Họ ôm bạn thật lâu.', 'They hug you for a long time.'), { happy: 4 }, () => { p.closeness = clamp(p.closeness + 8); })] },
      { label: L('Góp ý thẳng thắn', 'Give honest advice'), outcomes: [oc(L('Họ lắng nghe, rồi vẫn làm theo ý mình. Đúng là con bạn.', "They listen, then do it their way anyway. Definitely your child."), { smarts: 1 }, () => { p.closeness = clamp(p.closeness + 2); })] },
    ]);
    if (item.k === 'money') return sev('sys/gr_kid', L(`${n} ngập ngừng hỏi vay tiền để mua nhà.`, `${n} hesitantly asks to borrow money for a home.`), [
      { label: L('Cho luôn, không cần trả', 'Give it, no repayment'), outcomes: [oc(L('Họ chuyển vào nhà mới và mời bạn bữa cơm đầu tiên.', 'They move in and invite you to the first dinner.'), { money: -25, happy: 6 }, () => { p.closeness = clamp(p.closeness + 12); p.wealth = (p.wealth || 0) + 25; })] },
      { label: L('Cho vay có giấy tờ', 'Lend with paperwork'), outcomes: [oc(L('Họ trả đúng hạn từng tháng. Bạn tự hào.', 'They repay on time every month. You are proud.'), { money: -10 }, (lf) => { p.closeness = clamp(p.closeness + 3); lf.money += u(lf, 10); })] },
      { label: L('Khuyên họ tự lập', 'Encourage them to manage alone'), outcomes: [oc(L('Họ hơi buồn, nhưng tự xoay xở được.', 'They are a bit hurt, but they manage.'), { willpower: 1 }, () => { p.closeness = clamp(p.closeness - 5); })] },
    ]);
    if (item.k === 'grandkid') {
      if (!p.mate) return null;
      return sev('sys/gr_kid', L(`${n} và ${p.mate} báo tin vui: bạn sắp lên chức ông/bà!`, `${n} and ${p.mate} have news: you're going to be a grandparent!`), [
        { label: L('Hét lên vì sung sướng', 'Scream with joy'), outcomes: [oc(L('Bạn mua đồ sơ sinh nhiều đến mức phải thuê kho.', 'You buy so many baby clothes you need a storage unit.'), { happy: 12, money: -3 }, (lf) => { lf.counts.grandkids = (lf.counts.grandkids || 0) + 1; p.closeness = clamp(p.closeness + 8); addMoment(lf, p, L('Ngày biết tin có cháu', 'The day you learned you would be a grandparent'), '👶'); })] },
        { label: L('Rơi nước mắt lặng lẽ', 'Shed a quiet tear'), outcomes: [oc(L('Bạn nhớ lại ngày ${n} chào đời. Thời gian đi nhanh quá.'.replace('${n}', n), `You remember the day ${n} was born. Time flies.`), { happy: 10 }, (lf) => { lf.counts.grandkids = (lf.counts.grandkids || 0) + 1; })] },
      ]);
    }
    // Con phát hiện bí mật của bạn
    const secret = lovers(life).length ? L('những người tình của bạn', 'your lovers') : members(life).length ? L('hậu cung của bạn', 'your harem') : pw(life).shadow && !pw(life).shadow.ended ? L('cuốn sổ đen và quyền lực ngầm của bạn', 'your black notebook and shadow power') : null;
    if (!secret) return null;
    return sev('sys/gr_kid', L(`${n} đã biết về ${secret.vi}. Họ đứng ở cửa phòng bạn: "Mình cần nói chuyện."`, `${n} has found out about ${secret.en}. They stand in your doorway: "We need to talk."`), [
      { label: L('Thành thật kể hết', 'Tell them everything honestly'), outcomes: [oc(L('Cuộc nói chuyện dài nhất đời. Họ không đồng ý, nhưng họ hiểu.', "The longest talk of your life. They don't agree, but they understand."), { karma: 3, happy: -3 }, () => { p.closeness = clamp(p.closeness - 5); p.knowsSecret = true; })] },
      { label: L('Xin họ giữ bí mật', 'Ask them to keep it secret'), outcomes: [oc(L('Họ gật đầu, nhưng ánh mắt nhìn bạn đã khác.', 'They nod, but they look at you differently now.'), { happy: -4 }, () => { p.closeness = clamp(p.closeness - 15); p.knowsSecret = true; })] },
      { label: L('Chối', 'Deny it'), outcomes: [oc(L('Họ không tin. Cửa đóng lại rất khẽ.', "They don't believe you. The door closes very quietly."), { karma: -4, happy: -6 }, () => { p.closeness = clamp(p.closeness - 25); })] },
    ]);
  }
  if (s === 'gr_teen') {
    const p = byId(life, item.id);
    if (!p || !p.alive || p.age < 13 || p.age >= 18) return null;
    const n = nm(life, p);
    if (item.k === 'grades') return sev('sys/gr_teen', L(`${n} mang về bài kiểm tra điểm kém, giấu sau lưng.`, `${n} brings home a bad test, hidden behind their back.`), [
      { label: L('Ngồi học cùng con', 'Study with them'), outcomes: [oc(L('Hai tuần sau, điểm bài tiếp theo tăng gấp đôi.', 'Two weeks later, the next test score doubles.'), { happy: 3 }, () => { p.smarts = clamp(p.smarts + 5); p.closeness = clamp(p.closeness + 6); })] },
      { label: L('Thuê gia sư', 'Hire a tutor'), outcomes: [oc(L('Điểm tăng. Con ít nói chuyện với bạn hơn một chút.', 'Grades go up. They talk to you a little less.'), { money: -4 }, () => { p.smarts = clamp(p.smarts + 4); })] },
    ]);
    if (item.k === 'sport') return sev('sys/gr_teen', L(`Đội bóng của ${n} vào chung kết giải trường.`, `${n}'s team makes the school final.`), [
      { label: L('Đi cổ vũ, mang theo băng rôn', 'Go cheer with a banner'), outcomes: [oc(L('Con giả vờ xấu hổ, nhưng ghi bàn xong thì chạy về phía bạn.', 'They pretend to be embarrassed, but after scoring they run straight to you.'), { happy: 7 }, (lf) => { p.closeness = clamp(p.closeness + 10); addMoment(lf, p, L(`Trận chung kết của ${n}`, `${n}'s big final`), '🏆'); })] },
      { label: L('Bận việc, nhắn tin chúc', 'Busy, send a text'), outcomes: [oc(L('Con thắng. Bạn xem lại qua video người khác quay.', 'They win. You watch it later on someone else\'s video.'), {}, () => { p.closeness = clamp(p.closeness - 4); })] },
    ]);
    if (item.k === 'job') return sev('sys/gr_teen', L(`${n} xin đi làm thêm cuối tuần ở quán cà phê.`, `${n} asks to work weekends at a café.`), [
      { label: L('Đồng ý', 'Say yes'), outcomes: [oc(L('Đồng lương đầu tiên, con mua tặng bạn một chiếc cốc.', 'With their first pay, they buy you a mug.'), { happy: 5 }, () => { p.closeness = clamp(p.closeness + 6); })] },
      { label: L('Muốn con tập trung học', 'Want them to focus on school'), outcomes: [oc(L('Con dỗi một tuần rồi thôi.', 'They sulk for a week, then let it go.'), {}, () => { p.smarts = clamp(p.smarts + 2); p.closeness = clamp(p.closeness - 3); })] },
    ]);
    return sev('sys/gr_teen', L(`${n} đang tuổi nổi loạn: đóng cửa phòng, trả lời bằng một chữ.`, `${n} is in a rebellious phase: door shut, one-word answers.`), [
      { label: L('Để con có không gian', 'Give them space'), outcomes: [oc(L('Vài tháng sau, con tự mở lời. Chờ đợi là đúng.', 'A few months later, they open up on their own. Waiting was right.'), { willpower: 2 }, () => { p.closeness = clamp(p.closeness + 4); })] },
      { label: L('Rủ con đi ăn món con thích', 'Take them for their favourite food'), outcomes: [oc(L('Bát mì thứ hai, con bắt đầu kể chuyện trường lớp.', 'By the second bowl of noodles, they start talking about school.'), { money: -1, happy: 4 }, () => { p.closeness = clamp(p.closeness + 8); })] },
    ]);
  }
  return null;
}

// ───────── 207 · Chuỗi đang diễn ra ─────────
export function chainsOf(life, st) {
  const out = [];
  const add = (em, title, hint) => out.push({ em, title, hint });
  if (life.pregnancy) { const p = byId(life, life.pregnancy.otherId); add('🤰', life.pregnancy.carrier === 'self' ? L('Bạn đang mang thai', "You're expecting") : L(`${p ? nm(life, p) : '?'} đang mang thai con bạn`, `${p ? nm(life, p) : '?'} is expecting your child`), L('Em bé sẽ chào đời vào năm sau.', 'The baby arrives next year.')); }
  for (const pg of life.pregs || []) { const p = byId(life, pg.otherId); if (p) add('🤰', L(`${nm(life, p)} đang mang thai con bạn`, `${nm(life, p)} is expecting your child`), L('Em bé sẽ chào đời vào năm sau.', 'The baby arrives next year.')); }
  const P = pw(life);
  if (P.office) add('🏛️', L(`Nhiệm kỳ ${OFFICES[P.office].name.vi}`, `Term as ${OFFICES[P.office].name.en}`), L(`Còn ${P.term} năm · ủng hộ ${Math.round(P.approval)}%`, `${P.term} years left · approval ${Math.round(P.approval)}%`));
  const nx = nextOffice(life);
  if (nx && life.age >= 18 && (P.held || life.stats.fame >= 10)) add('🗳️', L(`Bước tiếp theo: ${OFFICES[nx].name.vi}`, `Next step: ${OFFICES[nx].name.en}`), L(`Cần danh tiếng ${OFFICES[nx].fame} hoặc ảnh hưởng ${OFFICES[nx].infl}.`, `Needs fame ${OFFICES[nx].fame} or influence ${OFFICES[nx].infl}.`));
  if (P.club) add('🕯️', L(`Hội kín: ${CLUB_RANKS[P.club.rank].vi}`, `Secret circle: ${CLUB_RANKS[P.club.rank].en}`), P.club.rank < 5 ? L('Đóng góp hoặc làm việc cho hội để được thử thách lên cấp.', 'Contribute or do favours to earn your next test.') : L('Bạn đã ngồi ghế Chủ tọa.', 'You hold the Chair.'));
  if (P.shadow && !P.shadow.ended) add('♟️', L(`Quyền lực ngầm ${Math.round(shadowPower(life))}/100`, `Shadow power ${Math.round(shadowPower(life))}/100`), P.shadow.exp >= 60 ? L(`Độ lộ diện ${Math.round(P.shadow.exp)}: nên nằm im hoặc dập tin.`, `Exposure ${Math.round(P.shadow.exp)}: lie low or bury stories.`) : pawnsOf(life).length < 3 ? L('Cần 3 quân cờ để triệu tập hội đồng bóng tối.', 'You need 3 pawns to convene the shadow council.') : L('Hội đồng họp mỗi năm. Đạt 80 quyền lực và giữ lộ diện dưới 60 để thành "Ông vua không ngai".', 'The council meets yearly. Reach 80 power with exposure under 60 to become "The Uncrowned King".'));
  if (life.startup && life.startup.stage < 5) add('🚀', L(`Khởi nghiệp: giai đoạn ${life.startup.stage + 1}/5`, `Startup: stage ${life.startup.stage + 1}/5`), L('Mỗi năm có một quyết định lớn. Cuối con đường là bán công ty hoặc lên sàn.', 'A big decision every year. At the end: sell or go public.'));
  for (const [id, h] of Object.entries(life.hob || {})) if (h.lv > 0 && h.lv < 10) add(HOBBIES[id].em, L(`${HOBBIES[id].name.vi}: cấp ${h.lv}`, `${HOBBIES[id].name.en}: level ${h.lv}`), L(`${h.xp}/${need(h.lv)} kinh nghiệm đến cấp tiếp theo.`, `${h.xp}/${need(h.lv)} XP to the next level.`));
  if (life.prophecy) add('🔮', L('Lời tiên tri đang chờ', 'A prophecy awaits'), L(`Hạn chót: năm ${life.prophecy.until} tuổi.`, `Deadline: age ${life.prophecy.until}.`));
  if (P.journo && byId(life, P.journo)?.alive && (life.ix?.scandal >= 40 || P.shadow?.exp >= 40)) add('🕵️', L(`Nhà báo ${nm(life, byId(life, P.journo))} đang điều tra`, `Journalist ${nm(life, byId(life, P.journo))} is investigating`), L('Giữ tai tiếng và độ lộ diện thấp để họ mất dấu.', 'Keep scandal and exposure low to lose them.'));
  for (const p of life.people.filter((q) => attOf(q) === 'heir' && q.alive).slice(0, 3)) add('👶', L(`${nm(life, p)} muốn có con với bạn`, `${nm(life, p)} wants a child with you`), L('Mở trang của họ để nói chuyện.', 'Open their page to talk.'));
  const S = life.soc;
  if (S) for (const f of S.feuds.slice(-2)) { const a = byId(life, f.a); const b = byId(life, f.b); if (a && b) add('⚔️', L(`${nm(life, a)} và ${nm(life, b)} đang giận nhau`, `${nm(life, a)} and ${nm(life, b)} are feuding`), L('Có thể họ sẽ nhờ bạn phân xử.', 'They may ask you to take sides.')); }
  if (life.scen) for (const [id, sc] of Object.entries(life.scen)) if (sc && sc.step && sc.step > 1 && !sc.done) add('🎭', L(`Kịch bản "${id}" đang dở`, `Scenario "${id}" in progress`), L('Chương tiếp theo sẽ đến vào năm sau.', 'The next chapter arrives next year.'));
  const t = talentOf(life);
  if (!t.known && life.age < 30) add('🌟', L('Năng khiếu chưa lộ diện', 'An undiscovered talent'), L('Thử nhiều hoạt động và sở thích để tìm ra.', 'Try different activities and hobbies to find it.'));
  if ((life.visited || []).length && life.visited.length < 10) add('🧳', L(`Du lịch: ${life.visited.length}/10 nơi`, `Travel: ${life.visited.length}/10 places`), L('Đi đủ 10 nơi để nhận ribbon "Kẻ lữ hành".', 'Visit 10 places for the "Globetrotter" ribbon.'));
  return out;
}

// ───────── 273 · Nhật ký đời viết thành truyện ─────────
export function diaryOf(life) {
  const ps = [];
  const t = talentOf(life);
  const tt = topTrait(life);
  const P = pw(life);
  const ages = (life.miles || []);
  const firstMile = (re) => ages.find((m) => re.test(m.text.en));
  const tl = traitLabel(tt);
  ps.push({ h: L('Những năm đầu', 'The early years'), t: L(`${life.first} lớn lên ở ${country(life).name.vi}, trong một gia đình ${({ poor: 'nghèo', middle: 'trung lưu', well: 'khá giả', rich: 'giàu có' })[life.wealth]}. ${t.known ? `Từ nhỏ đã có năng khiếu ${TALENTS[t.id].name.vi.toLowerCase()}. ` : ''}Người ta nhớ về ${life.first} như một người ${tl.vi.toLowerCase()}.${life.teacherMet ? ' Có một người thầy/cô đã thay đổi cách ' + life.first + ' nhìn bản thân.' : ''}`, `${life.first} grew up in ${country(life).name.en}, in a ${({ poor: 'poor', middle: 'middle-class', well: 'comfortable', rich: 'wealthy' })[life.wealth]} family. ${t.known ? `A gift for ${TALENTS[t.id].name.en.toLowerCase()} showed early. ` : ''}People remember ${life.first} as ${tl.en.toLowerCase()}.${life.teacherMet ? ` One teacher changed how ${life.first} saw themselves.` : ''}`) });
  const grad = firstMile(/degree|graduat|high school/i);
  const jobLine = life.jobHistory ? L(`Đi làm qua ${life.jobHistory} công việc${life.prorep >= 70 ? ', được cả ngành nể trọng' : ''}.`, `Worked ${life.jobHistory} job${life.jobHistory > 1 ? 's' : ''}${life.prorep >= 70 ? ', respected across the industry' : ''}.`) : L('Chưa bao giờ đi làm công ăn lương.', 'Never held a regular job.');
  ps.push({ h: L('Học hành và sự nghiệp', 'School and work'), t: L(`${grad ? `Năm ${grad.age} tuổi: ${grad.text.vi}. ` : ''}${jobLine.vi}${life.startup?.ipo ? ' Đưa được công ty khởi nghiệp lên sàn.' : life.startup?.sold ? ' Từng bán một công ty khởi nghiệp.' : ''}`, `${grad ? `At ${grad.age}: ${grad.text.en}. ` : ''}${jobLine.en}${life.startup?.ipo ? ' Took a startup public.' : life.startup?.sold ? ' Sold a startup.' : ''}`) });
  const ls = LOVESTYLE[loveStyleOf(life)];
  const marr = firstMile(/married|wedding/i);
  ps.push({ h: L('Tình yêu', 'Love'), t: L(`Kiểu yêu: ${ls.name.vi.toLowerCase()}. ${life.counts.partners ? `Đã yêu ${life.counts.partners} người.` : 'Chưa từng yêu ai thật sự.'}${marr ? ` Cưới năm ${marr.age} tuổi.` : ''}${life.counts.divorces ? ` Ly hôn ${life.counts.divorces} lần.` : ''}${(life.ix?.learned || []).length ? ` Mỗi người đi qua đều dạy ${life.first} một điều mới.` : ''}`, `Love style: ${ls.name.en.toLowerCase()}. ${life.counts.partners ? `Loved ${life.counts.partners} ${life.counts.partners > 1 ? 'people' : 'person'}.` : 'Never truly fell in love.'}${marr ? ` Married at ${marr.age}.` : ''}${life.counts.divorces ? ` Divorced ${life.counts.divorces} time${life.counts.divorces > 1 ? 's' : ''}.` : ''}${(life.ix?.learned || []).length ? ` Everyone who passed through taught ${life.first} something new.` : ''}`) });
  const kids = life.people.filter((p) => p.role === 'child').length;
  ps.push({ h: L('Gia đình', 'Family'), t: kids ? L(`${kids} người con${life.counts.grandkids ? `, ${life.counts.grandkids} đứa cháu` : ''}.${P.clan ? ` Lập nên dòng họ ${life.last}, uy tín ${Math.round(P.clan.prestige)}.` : ''}${P.heirId && byId(life, P.heirId) ? ` Người kế vị: ${nm(life, byId(life, P.heirId))}.` : ''}`, `${kids} child${kids > 1 ? 'ren' : ''}${life.counts.grandkids ? `, ${life.counts.grandkids} grandchild${life.counts.grandkids > 1 ? 'ren' : ''}` : ''}.${P.clan ? ` Founded the ${life.last} dynasty, prestige ${Math.round(P.clan.prestige)}.` : ''}${P.heirId && byId(life, P.heirId) ? ` Successor: ${nm(life, byId(life, P.heirId))}.` : ''}`) : L('Không có con. Những người thân yêu là gia đình tự chọn.', 'No children. The people they loved were a chosen family.') });
  const st = statusOf(life);
  if (st >= 2 || P.held || P.shadow) ps.push({ h: L('Quyền lực', 'Power'), t: L(`Địa vị: ${STATUS[st].name.vi}.${P.held ? ` Từng giữ chức ${OFFICES[P.held].name.vi}.` : ''}${P.club ? ` ${CLUB_RANKS[P.club.rank].vi} của một hội kín.` : ''}${P.shadow ? (P.shadow.ended === 'exposed' ? ' Đế chế ngầm bị phơi bày.' : P.shadow.handed ? ' Trao lại cuốn sổ đen cho thế hệ sau.' : ` Đứng sau ${pawnsOf(life).length} quân cờ mà không ai hay.`) : ''}`, `Status: ${STATUS[st].name.en}.${P.held ? ` Once served as ${OFFICES[P.held].name.en}.` : ''}${P.club ? ` ${CLUB_RANKS[P.club.rank].en} of a secret circle.` : ''}${P.shadow ? (P.shadow.ended === 'exposed' ? ' A shadow empire, exposed.' : P.shadow.handed ? ' Passed the black notebook to the next generation.' : ` Quietly behind ${pawnsOf(life).length} pawns.`) : ''}`) });
  const al = (life.album || []).slice(-3);
  if (al.length) ps.push({ h: L('Những khoảnh khắc', 'Moments'), t: L(al.map((m) => `${m.em} ${m.age} tuổi: ${m.text.vi}`).join('. ') + '.', al.map((m) => `${m.em} Age ${m.age}: ${m.text.en}`).join('. ') + '.') });
  if (life.dead) ps.push({ h: L('Hồi kết', 'The end'), t: L(`${life.first} ra đi năm ${life.age} tuổi vì ${life.cause?.vi || '...'}. ${life.funeral?.length ? life.funeral[0].vi : 'Người thân tiễn đưa trong yên lặng.'}`, `${life.first} died at ${life.age} from ${life.cause?.en || '...'}. ${life.funeral?.length ? life.funeral[0].en : 'Loved ones said goodbye quietly.'}`) });
  return ps;
}

// ───────── God Mode ─────────
export function godGrowthSelf(life, v) {
  if (v.talent && TALENTS[v.talent]) life.talent = { id: v.talent, known: true };
  if (v.talentKnown != null) talentOf(life).known = !!v.talentKnown;
  if (v.prorep != null) life.prorep = clamp(Number(v.prorep));
  if (v.spend && SPEND[v.spend]) life.spend = v.spend;
  if (v.habits) { const H = habits(life); for (const k of Object.keys(HABITS)) if (v.habits[k] != null) H[k] = clamp(Number(v.habits[k])); }
  if (v.hob) for (const [id, lv] of Object.entries(v.hob)) if (HOBBIES[id]) { const h = hobbyOf(life, id); h.lv = clamp(Number(lv), 0, 10); h.xp = 0; }
  if (v.culture && life.job && CULTURES[v.culture]) life.job.culture = v.culture;
  if (v.startupStage != null && life.startup) life.startup.stage = clamp(Number(v.startupStage), 0, 5);
  if (v.legacyIn != null) life.legacyIn = clamp(Number(v.legacyIn));
  if (v.learnAll) { const m = me(life); m.learned = Object.keys(LEARN); }
  if (v.visitAll) life.visited = DESTS.map((d) => d[0]);
}
export function godGrowthPerson(life, p, v) {
  if (p.role === 'pet' && v.petPersona && PET_P[v.petPersona]) p.persona = v.petPersona;
  if (p.role === 'child' && v.childTalent !== undefined) p.talent = TALENTS[v.childTalent] ? v.childTalent : undefined;
}
