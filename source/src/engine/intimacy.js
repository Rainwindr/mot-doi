// Nội dung thân mật 25+ (bản duyệt 29 mục), thái độ của nhân vật với bạn, độ kiên định, và tương tác cho mọi người.
// Luật cứng: mọi cảnh tình cảm/tình dục chỉ giữa người từ 18 tuổi, không bao giờ với gia đình hay thú cưng,
// luôn có đồng thuận; "giới hạn" của nhân vật không bao giờ bị phá, dù độ kiên định thấp đến đâu.
import { L, clamp, rand, chance, randint, pick, FREQ } from './util.js';
import {
  country, unit, partner, people, byId, randomPerson, partnerGender, personName, addLog, setFlag,
  lovers, polyOk, makeLover, endLover, syncAffair,
} from './life.js';
import { applyEffects, tryConceive, protectChance } from './events.js';

const res = (text, changes = [], tone) => ({ text, changes, tone });
const nm = (life, p) => personName(life, p);
const u = (life, n) => n * unit(life);
const fx = (life, e) => applyEffects(life, e);
const oc = (text, effects = {}, run, next, ch = 1) => ({ chance: ch, text, effects, run, next });
const modal = (uid, text, choices) => ({ event: { uid, text, choices } });
const sev = (uid, text, choices) => ({ uid, sys: true, text, choices });

export const FAMILY = ['mother', 'father', 'sibling', 'half', 'child', 'pet'];
export const ROM = ['partner', 'spouse', 'lover'];
/** Không bao giờ có tình cảm: gia đình, thú cưng, và thầy cô cũ (người quen từ khi bạn còn nhỏ). */
export const NOROM = [...FAMILY, 'teacher'];
/** Cặp người lớn hợp lệ cho mọi nội dung tình cảm: cả hai ≥ 18, không phải gia đình. */
export const adultOK = (life, p) => !!p && p.alive && life.age >= 18 && p.age >= 18 && !NOROM.includes(p.role);
const on = (st, life) => !!(st && st.adult25 && life.age >= 18);

function seedOf(str) { let h = 2166136261; for (const c of String(str)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }

// ───────── Thái độ với nhân vật chính ─────────
export const ATT = {
  hate: { em: '😡', name: L('Ghét bạn', 'Hates you') },
  rival: { em: '⚔️', name: L('Đối thủ', 'Rival') },
  neutral: { em: '😐', name: L('Bình thường', 'Neutral') },
  friendly: { em: '😊', name: L('Quý mến', 'Fond of you') },
  crush: { em: '🙈', name: L('Yêu thầm', 'Secret crush'), rom: true },
  like: { em: '😍', name: L('Thích công khai', 'Openly into you'), rom: true },
  affair: { em: '😈', name: L('Muốn ngoại tình với bạn', 'Wants an affair with you'), rom: true },
  heir: { em: '👶', name: L('Muốn có con với bạn', 'Wants a child with you'), rom: true, heir: true },
};
// ───────── Xu hướng tính dục (mục 90) ─────────
export const ORIENT = {
  straight: { em: '⚤', name: L('Thích khác giới', 'Into the opposite sex') },
  gay: { em: '🌈', name: L('Thích cùng giới', 'Into the same sex') },
  bi: { em: '💗', name: L('Thích cả hai', 'Into both') },
  ace: { em: '🤍', name: L('Ít hứng thú tình dục', 'Asexual') },
};
export const likesG = (o, self, other) => o === 'bi' || (o === 'straight' && self !== other) || (o === 'gay' && self === other);
/** Xu hướng của một nhân vật: cố định theo id cho tới khi God Mode chỉnh. Người đang yêu bạn luôn hợp với bạn. */
export function orientOf(life, p) {
  if (!p.orient) {
    const r = (seedOf(p.id + ':o') % 1000) / 1000;
    p.orient = r < 0.78 ? 'straight' : r < 0.9 ? 'bi' : r < 0.97 ? 'gay' : 'ace';
    if (ROM.includes(p.role) && !likesG(p.orient, p.gender, life.gender)) p.orient = 'bi';
  }
  return p.orient;
}
export const likes = (life, p, gender) => likesG(orientOf(life, p), p.gender, gender);
export const attOf = (p) => p.att || (p.role === 'rival' ? 'rival' : ROM.includes(p.role) ? 'like' : 'neutral');
/** Thái độ được phép: thái độ lãng mạn chỉ dành cho người lớn ngoài gia đình. */
export const attOptions = (life, p) => Object.keys(ATT).filter((k) => (!ATT[k].rom || (p.alive && p.age >= 18 && !NOROM.includes(p.role))) && (!ATT[k].heir || heirOK(life, p)));
/** Mục 342: chỉ người lớn ngoài gia đình, khác giới, hợp xu hướng, người mang thai trong độ tuổi sinh nở. */
export function heirOK(life, p) {
  if (!p || !p.alive || p.age < 18 || life.age < 18 || NOROM.includes(p.role) || p.gender === life.gender) return false;
  if (!likes(life, p, life.gender)) return false;
  const carrier = p.gender === 'female' ? p.age : life.age;
  return carrier >= 18 && carrier <= (life.fcfg?.carrierMax ?? 48);
}
export function setAtt(life, p, k) {
  if (!ATT[k] || !attOptions(life, p).includes(k)) return false;
  p.att = k;
  return true;
}

// ───────── Hồ sơ thân mật (tạo theo id, không đụng RNG của đời) ─────────
const K = (id, grp, vi, en, sv, se, item, risk) => ({ id, grp, name: L(vi, en), scene: [sv, se], item, risk });
export const KINKS = [
  K('toy', 'basic', 'Đồ chơi người lớn', 'Adult toys', '{n} mở hộp quà bạn đưa, nhướng mày, rồi với tay tắt đèn.', '{n} opens the box you hand them, raises an eyebrow, and reaches for the light.', 'toys'),
  K('lead', 'basic', 'Dẫn dắt và nghe lời', 'Lead and follow', 'Tối nay một người ra lệnh, người kia nghe theo. Luật đã thống nhất từ trước, từ an toàn cũng vậy.', 'Tonight one of you gives the orders and the other follows. Rules agreed beforehand, safe word too.'),
  K('feet', 'fetish', 'Chân và giày cao gót', 'Feet and heels', 'Bạn dành cả buổi tối chiều chuộng đôi chân của {n}. Họ không ngờ mình thích đến vậy.', 'You spend the evening pampering {n}\'s feet. They had no idea they\'d love it this much.'),
  K('lingerie', 'fetish', 'Nội y và tất lưới', 'Lingerie and fishnets', '{n} bước ra trong bộ đồ ren bạn mua. Bữa tối nguội dần trên bàn.', '{n} steps out in the lace you bought. Dinner goes cold on the table.', 'lingerie'),
  K('leather', 'fetish', 'Da và latex', 'Leather and latex', 'Tiếng da sột soạt trong bóng tối. {n} trông như một người hoàn toàn khác.', 'Leather creaks in the dark. {n} looks like a different person.', 'leather'),
  K('uniform', 'fetish', 'Đồng phục người lớn', 'Grown-up uniforms', 'Một bộ đồng phục, một vai diễn, và {n} nhập vai nghiêm túc đến mức bạn bật cười trước.', 'A uniform, a role, and {n} plays it so seriously you crack first.', 'uniform'),
  K('blindfold', 'sense', 'Bịt mắt và tai nghe', 'Blindfold and headphones', 'Bịt mắt, đeo tai nghe. {n} chỉ còn cảm nhận được bạn.', 'Blindfold on, headphones in. {n} can only feel you.', 'blindfold'),
  K('candle', 'sense', 'Nóng lạnh với nến massage', 'Hot and cold, massage candles', 'Nến massage tan chảy, ấm rồi mát. {n} thở ra thật dài.', 'Massage wax melts, warm then cool. {n} lets out a long breath.', 'candles', 'candle'),
  K('tickle', 'sense', 'Cù và trêu chọc', 'Tickling', 'Bắt đầu là trêu chọc, kết thúc là cả hai cười lăn và quên mất định làm gì.', 'It starts as teasing and ends with you both in stitches, forgetting what you were doing.'),
  K('food', 'sense', 'Đồ ăn', 'Food play', 'Một hộp kem, ít dâu tây và rất nhiều sáng tạo. Ga giường thì phải giặt.', 'A tub of ice cream, some strawberries and a lot of creativity. The sheets need washing.'),
  K('silk', 'sense', 'Dây lụa', 'Silk ties', 'Dải lụa buộc hờ quanh cổ tay. {n} biết chỉ cần một từ là mọi thứ dừng lại.', 'Silk loosely around the wrists. {n} knows one word stops everything.', 'silk'),
  K('spank', 'power', 'Phát yêu nhẹ', 'Light spanking', 'Vài cái phát nhẹ, tiếng cười khúc khích, rồi {n} quay lại: "Nữa."', 'A few light smacks, a giggle, then {n} looks back: "Again."'),
  K('worship', 'power', 'Tôn thờ cơ thể', 'Body worship', 'Bạn đối xử với {n} như một tác phẩm nghệ thuật, từng chút một.', 'You treat {n} like a work of art, inch by inch.'),
  K('hotwife', 'power', 'Chia sẻ có đồng thuận', 'Consensual sharing', 'Theo thỏa thuận của hai người, {n} đi chơi với một người khác rồi về kể cho bạn nghe. Cả hai đều thích điều đó.', 'As you both agreed, {n} goes out with someone else and comes home to tell you all about it. You both love it.'),
  K('findom', 'power', 'Thống trị bằng ví tiền', 'Findom', '{n} thích được bạn chi tiền, còn bạn thích cảm giác "phục vụ" bằng ví của mình.', '{n} loves being spent on, and you love serving with your wallet.'),
  K('collar', 'power', 'Vòng cổ kỷ niệm', 'Keepsake collar', 'Một chiếc vòng cổ nhỏ khắc tên. {n} đeo nó như bí mật chỉ hai người hiểu.', 'A small engraved collar. {n} wears it like a secret only you two share.', 'collar'),
  K('roleplay', 'play', 'Nhập vai', 'Roleplay', 'Tối nay hai người là người lạ gặp nhau ở quầy bar khách sạn. Không ai phá vai.', 'Tonight you\'re strangers meeting at a hotel bar. Nobody breaks character.'),
  K('cosplay', 'play', 'Cosplay', 'Cosplay', 'Trang phục nhân vật yêu thích, tóc giả lệch một bên. Vẫn hiệu quả bất ngờ.', 'Favourite character costumes, wig slightly askew. Surprisingly effective.', 'costume'),
  K('exhib', 'play', 'Phô bày có đồng thuận', 'Consensual exhibition', 'Ban công tầng cao, rèm mở, thành phố lấp lánh bên dưới. Tim đập thình thịch.', 'A high balcony, curtains open, the city glittering below. Hearts pounding.', null, 'exhib'),
  K('stream', 'play', 'Livestream riêng cho người ấy', 'Private livestream', 'Một buổi phát trực tiếp riêng, khán giả duy nhất là {n}.', 'A private stream with exactly one viewer: {n}.'),
  K('mirror', 'play', 'Gương', 'Mirror', 'Tấm gương lớn trong phòng ngủ cuối cùng cũng có công dụng.', 'The big bedroom mirror finally earns its keep.'),
  K('shibari', 'special', 'Dây trói nghệ thuật (shibari)', 'Shibari', 'Những nút dây đẹp như tác phẩm triển lãm. Bạn chụp một tấm ảnh nghệ thuật cho {n}.', 'Knots as pretty as a gallery piece. You take an art photo for {n}.', 'rope', 'shibari'),
  K('tease', 'special', 'Trò chơi chờ đợi', 'The waiting game', 'Cả ngày không được chạm nhau, chỉ nhắn tin trêu chọc. Tối đến, người thua phải làm theo người kia.', 'No touching all day, only teasing texts. By night, the loser does what the winner says.'),
  K('undertable', 'special', 'Đụng chạm dưới gầm bàn', 'Under the table', 'Dưới gầm bàn ăn, một bàn chân tìm đến bạn. Trên bàn, mọi người vẫn nói chuyện thời tiết.', 'Under the dinner table a foot finds yours. Above it, everyone\'s discussing the weather.', null, 'undertable'),
  K('voice', 'special', 'Mê giọng nói', 'Voice', '{n} thì thầm qua điện thoại. Bạn bỏ dở cuộc họp lúc nào không hay.', '{n} whispers down the phone. You walk out of a meeting without noticing.'),
  K('lift', 'special', 'Bế bổng', 'Being carried', '{n} bế bổng bạn lên như trong phim.', '{n} sweeps you off your feet like in the movies.', null, 'lift'),
  K('scent', 'special', 'Mùi hương', 'Scent', 'Bạn mặc áo sơ mi của {n} khi họ đi công tác. Cái gối thì cấm ai giặt.', 'You wear {n}\'s shirt while they\'re away. Nobody is allowed to wash the pillow.'),
  K('petplay', 'special', 'Nhập vai thú cưng (người lớn)', 'Adult pet play', 'Tai mèo, vòng cổ có chuông và một người "chủ" rất chu đáo.', 'Cat ears, a belled collar and a very attentive "owner".', null, 'petplay'),
  K('ink', 'special', 'Hình xăm và khuyên', 'Tattoos and piercings', 'Bạn phát hiện một hình xăm giấu kín trên người {n}. Hai người hẹn đi xăm một hình chỉ hai người hiểu.', 'You find a hidden tattoo on {n}. You book matching ink only you two understand.'),
];
export const kinkById = Object.fromEntries(KINKS.map((k) => [k.id, k]));
export const KINK_GROUPS = [
  ['basic', '🧸', L('Cơ bản', 'Basics')], ['fetish', '👠', L('Fetish quen thuộc', 'Classic fetishes')], ['sense', '🕯️', L('Chơi với cảm giác', 'Sensation play')],
  ['power', '👑', L('Quyền lực', 'Power play')], ['play', '🎭', L('Nhập vai và phô bày', 'Roleplay and show')], ['special', '✨', L('Đặc biệt', 'Special')],
];
const MISHAP = {
  candle: L('Một giọt nến rơi trúng ga giường mới. Ga thì hỏng, tâm trạng thì không.', 'A drop of wax lands on the new sheets. The sheets are ruined, the mood isn\'t.'),
  exhib: L('Đèn nhà đối diện bật sáng. Hai người lao vào trong nhanh như ninja.', 'A light flicks on across the street. You both dive inside like ninjas.'),
  shibari: L('Nút thắt kẹt cứng. Cuối cùng phải lấy kéo cắt dây, vừa cắt vừa cười.', 'The knot jams. You end up cutting the rope, laughing the whole time.'),
  undertable: L('Bạn làm rơi dĩa. Mẹ người ấy hỏi: "Con sao vậy, mặt đỏ thế?"', 'You drop your fork. Their mum asks: "Are you alright, dear? You\'re all red."'),
  lift: L('Hai bước đầu rất đẹp. Bước thứ ba, cả hai cùng ngã xuống thảm, cười chảy nước mắt.', 'The first two steps are perfect. On the third you both tumble onto the rug, crying with laughter.'),
  petplay: L('Chuông cửa reo đúng lúc. Anh shipper nhìn chiếc tai mèo rất lâu.', 'The doorbell rings at the worst moment. The courier stares at the cat ears for a long time.'),
};

export const CHEST = {
  toys: { em: '🎁', units: 3, name: L('Hộp đồ chơi người lớn', 'Box of adult toys') },
  lingerie: { em: '🩱', units: 4, name: L('Bộ nội y ren', 'Lace lingerie') },
  leather: { em: '🖤', units: 6, name: L('Trang phục da', 'Leather outfit') },
  uniform: { em: '👮', units: 4, name: L('Bộ đồng phục nhập vai', 'Roleplay uniform') },
  blindfold: { em: '🙈', units: 1, name: L('Bịt mắt lụa', 'Silk blindfold') },
  candles: { em: '🕯️', units: 1, name: L('Nến massage', 'Massage candles') },
  silk: { em: '🎀', units: 1, name: L('Dây lụa', 'Silk ties') },
  collar: { em: '📿', units: 2, name: L('Vòng cổ khắc tên', 'Engraved collar') },
  costume: { em: '🦸', units: 5, name: L('Trang phục cosplay', 'Cosplay costume') },
  rope: { em: '🪢', units: 2, name: L('Dây shibari', 'Shibari rope') },
  book: { em: '📕', units: 2, name: L('Sổ tay 36 tư thế', 'The 36 Positions Handbook') },
  boa: { em: '🪶', tour: true, name: L('Khăn lông vũ burlesque', 'Burlesque feather boa') },
  mask: { em: '🎭', tour: true, name: L('Mặt nạ lễ hội', 'Carnival mask') },
  artbook: { em: '📖', tour: true, name: L('Sách nghệ thuật khiêu gợi', 'Erotic art book') },
  yukata: { em: '👘', tour: true, name: L('Yukata lụa', 'Silk yukata') },
  neon: { em: '💗', tour: true, name: L('Đèn neon trái tim', 'Neon heart sign') },
};
export const ROOMS = {
  red: { em: '🟥', name: L('Phòng đỏ', 'The red room'), text: L('Ánh đèn đỏ, lụa đỏ, và một cánh cửa luôn khóa.', 'Red light, red silk, and a door that\'s always locked.') },
  mirror: { em: '🪞', name: L('Phòng gương', 'The mirror room'), text: L('Gương ở mọi bức tường. Không có góc nào để trốn.', 'Mirrors on every wall. Nowhere to hide.') },
  theme: { em: '🌴', name: L('Phòng chủ đề', 'The theme room'), text: L('Hôm nay là rừng nhiệt đới, ngày mai là văn phòng giám đốc.', 'Today a jungle, tomorrow a CEO\'s office.') },
};

const P = (vi, en) => L(vi, en);
export const POSITIONS = [
  // Dễ (0–11)
  P('Thìa Đôi', 'Double Spoon'), P('Gối Đầu Trăng', 'Moon Pillow'), P('Sáng Chủ Nhật', 'Sunday Morning'), P('Ôm Gấu', 'Bear Hug'), P('Mèo Lười', 'Lazy Cat'), P('Sóng Nhẹ', 'Gentle Wave'),
  P('Lá Sen', 'Lotus Leaf'), P('Võng Đưa', 'Swaying Hammock'), P('Hai Chiếc Lá', 'Two Leaves'), P('Mây Trôi', 'Drifting Cloud'), P('Đêm Mưa', 'Rainy Night'), P('Tổ Chim', 'Bird\'s Nest'),
  // Trung bình (12–23)
  P('Ghế Bập Bênh', 'Rocking Chair'), P('Con Thuyền Say', 'Drunken Boat'), P('Cầu Thang Xoắn', 'Spiral Stairs'), P('Bàn Làm Việc', 'The Desk'), P('Gương Soi', 'The Looking Glass'), P('Cánh Bướm', 'Butterfly'),
  P('Xe Đạp Đôi', 'Tandem Bike'), P('Bập Bênh Sofa', 'Sofa Seesaw'), P('Cửa Sổ Bếp', 'Kitchen Window'), P('Thang Máy', 'The Elevator'), P('Ghế Xoay', 'Swivel Chair'), P('Mái Chèo', 'The Oar'),
  // Khó (24–35)
  P('Cầu Vồng Ngược', 'Upside-down Rainbow'), P('Tháp Nghiêng', 'Leaning Tower'), P('Xiếc Đêm', 'Night Circus'), P('Cầu Treo', 'Suspension Bridge'), P('Con Cua Kiêu Hãnh', 'Proud Crab'), P('Ngôi Sao Năm Cánh', 'Five-point Star'),
  P('Vũ Công Ballet', 'Ballet Dancer'), P('Tàu Lượn', 'Rollercoaster'), P('Đại Bàng', 'The Eagle'), P('Chong Chóng', 'Pinwheel'), P('Cột Đèn', 'The Lamppost'), P('Kim Tự Tháp', 'The Pyramid'),
];
export const POS_LEVELS = [L('Dễ', 'Easy'), L('Trung bình', 'Medium'), L('Khó', 'Hard')];

/** Hồ sơ của một nhân vật: sở thích ẩn, giới hạn, độ hợp, lửa, ham muốn, dẻo dai, kiên định... */
export function prof(p) {
  if (!p.ix) {
    const s = { rng: seedOf(p.id) };
    const ids = KINKS.map((k) => k.id);
    for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(rand(s) * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
    p.ix = {
      kinks: ids.slice(0, 3), limits: ids.slice(3, 5), known: [], knownLim: [],
      chem: randint(s, 20, 95), fire: randint(s, 0, 25), libido: randint(s, 25, 85), flex: randint(s, 15, 85),
      sincere: randint(s, 15, 95), style: pick(s, ['soft', 'bold', 'fun']), jeal: randint(s, 10, 90), knows: false,
      fav: null, pc: {}, first: false,
    };
  }
  firmOf(p);
  return p.ix;
}
/** Độ kiên định: cố định theo id cho tới khi God Mode chỉnh. */
export function firmOf(p) {
  if (p.firm == null) p.firm = 20 + (seedOf(p.id + ':firm') % 61);
  return p.firm;
}

/** Hồ sơ của người chơi. */
export function me(life) {
  if (!life.ix) life.ix = { libido: 65, flex: 40, chest: [], pos: [], tried: [], care: 0, charm: 15, loyal: 50, scandal: 0, club: false, rope: false, babies: 0, memoir: false, loverTotal: 0, groups: 0, seenExp: 0, mid: false };
  return life.ix;
}

/**
 * Xác suất một người đồng ý một lời đề nghị.
 * Độ kiên định thấp → dễ đồng ý; cao → hay từ chối. Thái độ với bạn cũng góp phần.
 * Không dùng cho "giới hạn": giới hạn luôn bị từ chối trước khi gọi hàm này.
 */
export function agree(life, p, base, romantic = false) {
  const a = attOf(p);
  const attB = romantic
    ? { hate: -0.4, rival: -0.12, neutral: 0, friendly: 0.05, crush: 0.22, like: 0.18, affair: 0.3, heir: 0.32 }[a]
    : { hate: -0.3, rival: -0.1, neutral: 0, friendly: 0.1, crush: 0.1, like: 0.1, affair: 0.08, heir: 0.1 }[a];
  // Mục 341: hào quang làm người khác dễ nói "có" hơn (vẫn không vượt giới hạn)
  const aura = (life.auraT || 0) * 0.035;
  return clamp(base + (50 - firmOf(p)) / 150 + (attB || 0) + aura, 0.02, 0.98);
}

const cl = (life, p, a, b) => { p.closeness = clamp(p.closeness + randint(life, a, b)); };
const fire = (p, d) => { const x = prof(p); x.fire = clamp(x.fire + d); };
/** Bắt đầu quan hệ lãng mạn với p theo hoàn cảnh hiện tại. Trả về 'partner' | 'lover'. */
export function romance(life, p) {
  const pt = partner(life);
  if (pt && pt !== p) { makeLover(life, p); p.wasLover = true; if (!polyOk(life)) life.stats.karma = clamp(life.stats.karma - 4); return 'lover'; }
  if (!pt) { p.role = 'partner'; p.closeness = Math.max(p.closeness, 65); p.years = 0; p.metAge = life.age; life.counts.partners++; syncAffair(life); return 'partner'; }
  return 'partner';
}
const romText = (life, p, kind, st) => kind === 'lover'
  ? (on(st, life) ? L(`Đêm đó bạn và ${nm(life, p)} không về nhà riêng. Một bí mật mới bắt đầu.`, `Neither you nor ${nm(life, p)} goes home alone that night. A new secret begins.`) : L(`Bạn và ${nm(life, p)} bắt đầu lén lút qua lại.`, `You and ${nm(life, p)} start seeing each other in secret.`))
  : L(`Bạn và ${nm(life, p)} chính thức hẹn hò.`, `You and ${nm(life, p)} start dating.`);
function freshAdult(life, role, ageAround, extra = {}) {
  const age = clamp(ageAround, 18, 90);
  const p = randomPerson(life, life, { role, gender: partnerGender(life, life), age, closeness: 40 });
  Object.assign(p, extra);
  life.people.push(p);
  return p;
}
function findOrMake(life, roles, make) {
  const c = life.people.filter((p) => roles.includes(p.role) && adultOK(life, p) && !p.cut);
  return c.length ? pick(life, c) : make();
}

// ───────── Tương tác cho mọi người ─────────
export function ixPersonActions(life, p, st) {
  const out = [];
  if (!p.alive || life.prison || p.role === 'pet') return out;
  const rom = ROM.includes(p.role);
  if (!rom) out.push(['compliment', L('Khen ngợi', 'Compliment')]);
  if (life.age >= 3) out.push(['hug', L('Ôm', 'Hug')]);
  if (life.age >= 6 && !rom) out.push(['hangout', L('Rủ đi chơi', 'Hang out')]);
  if (life.age >= 10) out.push(['deeptalk', L('Tâm sự', 'Heart-to-heart')]);
  if (life.age >= 10) out.push(['favor', L('Nhờ giúp một việc', 'Ask a favour')]);
  if (life.age >= 14) out.push(['invite', L('Mời dự tiệc', 'Invite to a party')]);
  if (life.age >= 12) out.push(['gossip', L('Buôn chuyện', 'Gossip')]);
  if (adultOK(life, p) && !rom) { out.push(['flirtx', L('Tán tỉnh', 'Flirt')]); out.push(['confessx', L('Tỏ tình', 'Confess your feelings')]); }
  if (rom && on(st, life) && p.age >= 18) {
    const m = me(life);
    out.push(['ixtalk', L('Trò chuyện thầm kín', 'Intimate talk')]);
    out.push(['kink', L('Thử điều mới', 'Try something new')]);
    if (m.chest.includes('book')) out.push(['pos', L('Thử tư thế (Sổ tay 36)', 'Try a position (the Handbook)')]);
    out.push(['sext', L('Nhắn tin nóng', 'Send spicy texts')]);
    out.push(['group', L('Trải nghiệm nhiều người', 'Group experience')]);
    if (m.club) out.push(['clubtogether', L('Cùng đến CLB người lớn', 'Visit the adult club together')]);
    if (p.baby) { out.push(['spoil', L('Chiều chuộng (quà lớn)', 'Spoil them')]); out.push(['rules', L('Đặt quy tắc', 'Set the rules')]); out.push(['endbaby', L('Kết thúc thỏa thuận', 'End the arrangement')]); }
  }
  return out;
}

export function doIxPersonAction(life, st, p, act, n) {
  const name = nm(life, p);
  const tired = res(L('Năm nay như vậy là đủ rồi.', "That's enough for this year."), []);
  const romantic = adultOK(life, p);
  switch (act) {
    case 'compliment': {
      if (n > 3) return tired;
      if (attOf(p) === 'hate') return res(L(`${name} nhếch mép: "Đừng có mà nịnh."`, `${name} smirks: "Don't bother flattering me."`), [], 'bad');
      cl(life, p, 3, 7);
      if (romantic && attOf(p) === 'neutral' && chance(life, 0.06)) p.att = 'crush';
      return res(L(`${name} cười tít mắt.`, `${name} beams.`), fx(life, { happy: 2 }), 'good');
    }
    case 'hug': {
      if (n > 3) return tired;
      if (attOf(p) === 'hate' || attOf(p) === 'rival') { p.closeness = clamp(p.closeness - 3); return res(L(`${name} né người, rất ngượng.`, `${name} sidesteps you. Awkward.`), [], 'bad'); }
      cl(life, p, 2, 6);
      return res(L(`Một cái ôm thật chặt. ${name} không muốn buông.`, `A big tight hug. ${name} doesn't want to let go.`), fx(life, { happy: 3 }), 'good');
    }
    case 'hangout': {
      if (n > 2) return tired;
      if (chance(life, agree(life, p, 0.7 + p.closeness / 500))) {
        cl(life, p, 5, 10);
        if (romantic) fire(p, 3);
        return res(pick(life, [L(`Bạn và ${name} đi ăn vặt khắp phố.`, `You and ${name} go on a street-food crawl.`), L(`Bạn và ${name} đi xem phim, cãi nhau về cái kết.`, `You and ${name} see a film and argue about the ending.`), L(`Bạn và ${name} ngồi cà phê cả buổi chiều.`, `You and ${name} spend the afternoon at a café.`)]), fx(life, { happy: 4 }), 'good');
      }
      p.closeness = clamp(p.closeness - 1);
      return res(L(`${name} bảo hôm nay bận.`, `${name} says they're busy today.`), []);
    }
    case 'deeptalk': {
      if (n > 2) return tired;
      cl(life, p, 4, 8);
      p.attKnown = true;
      if (p.age >= 18) p.orientKnown = true;
      const a = attOf(p);
      const reveal = {
        hate: L(`Nói chuyện một lúc, ${name} buột miệng: họ chưa bao giờ ưa bạn.`, `Halfway through, ${name} admits they've never liked you.`),
        rival: L(`${name} thú nhận luôn coi bạn là đối thủ, và điều đó khiến họ cố gắng hơn.`, `${name} admits they've always seen you as a rival, and it pushes them.`),
        crush: L(`Giọng ${name} run run. Bạn chợt hiểu: họ đã để ý bạn từ lâu.`, `${name}'s voice wobbles. It dawns on you: they've had feelings for you for a long time.`),
        like: L(`${name} nhìn bạn rất lâu và không giấu việc mình thích bạn.`, `${name} holds your gaze and makes no secret of liking you.`),
        affair: L(`${name} nói nhỏ: "Nếu bạn muốn, chuyện này sẽ là bí mật của hai ta."`, `${name} says softly: "If you want, this could be our secret."`),
      }[a];
      return res(reveal || L(`Bạn và ${name} kể cho nhau nghe những chuyện chưa từng kể với ai.`, `You and ${name} share things you've never told anyone.`), fx(life, { happy: 3 }), a === 'hate' ? 'bad' : 'good');
    }
    case 'favor': {
      if (n > 2) return tired;
      if (chance(life, agree(life, p, 0.4 + p.closeness / 250))) {
        cl(life, p, -2, 2);
        return res(pick(life, [L(`${name} chở bạn đi khắp nơi cả ngày.`, `${name} drives you around all day.`), L(`${name} giúp bạn chuyển nhà, không lấy công.`, `${name} helps you move house for free.`), L(`${name} đi cùng bạn đến buổi phỏng vấn cho đỡ run.`, `${name} comes along to your interview for moral support.`)]), fx(life, { happy: 4, willpower: 1 }), 'good');
      }
      p.closeness = clamp(p.closeness - 3);
      return res(L(`${name} từ chối: "Lần này chịu thôi."`, `${name} declines: "Can't help this time."`), [], 'bad');
    }
    case 'invite': {
      if (n > 2) return tired;
      if (chance(life, agree(life, p, 0.6))) {
        cl(life, p, 4, 9);
        if (romantic) fire(p, 5);
        return res(L(`${name} đến tiệc và là người về muộn nhất.`, `${name} comes to the party and is the last to leave.`), fx(life, { happy: 5 }), 'good');
      }
      return res(L(`${name} không đến. Bạn thấy họ đăng ảnh ở một bữa tiệc khác.`, `${name} doesn't show. You see them posting from another party.`), fx(life, { happy: -2 }), 'bad');
    }
    case 'gossip': {
      if (n > 2) return tired;
      cl(life, p, 2, 5);
      if (chance(life, 0.15)) { me(life).scandal = clamp(me(life).scandal + 3); return res(L(`Chuyện bạn kể với ${name} lan khắp nơi chỉ sau một ngày.`, `What you told ${name} is everywhere by the next day.`), fx(life, { happy: -3, karma: -2 }), 'bad'); }
      return res(L(`Bạn và ${name} buôn chuyện thiên hạ đến khuya.`, `You and ${name} gossip until late.`), fx(life, { happy: 3, karma: -1 }));
    }
    case 'flirtx': {
      if (!romantic) return res(L('Không thể với người này.', "Not with this person."), [], 'bad');
      if (n > 3) return tired;
      const pr = agree(life, p, 0.35 + (life.stats.looks - p.looks) / 300 + p.closeness / 400 + prof(p).fire / 400, true);
      if (chance(life, pr)) {
        fire(p, randint(life, 8, 15)); cl(life, p, 2, 5);
        if (attOf(p) === 'neutral' && chance(life, 0.25)) p.att = 'crush';
        return res(L(`${name} đỏ mặt và tán lại. Không khí giữa hai người nóng dần.`, `${name} blushes and flirts back. The air between you heats up.`), fx(life, { happy: 3 }), 'good');
      }
      p.closeness = clamp(p.closeness - 4);
      return res(L(`${name} cười trừ, nhắc khéo rằng chỉ coi bạn là bạn.`, `${name} laughs it off and gently reminds you you're just friends.`), fx(life, { happy: -2 }), 'bad');
    }
    case 'confessx': {
      if (!romantic) return res(L('Không thể với người này.', "Not with this person."), [], 'bad');
      if (n > 1) return tired;
      const x = prof(p);
      if (chance(life, agree(life, p, 0.1 + p.closeness / 250 + x.fire / 220, true))) {
        const slow = x.fire >= 80;
        const kind = romance(life, p);
        x.fire = clamp(x.fire + 20);
        return res(slow ? L(`Sau ngần ấy thời gian, cuối cùng cũng có người nói ra. ${name} ôm chầm lấy bạn.`, `After all this time, someone finally said it. ${name} pulls you into a hug.`) : romText(life, p, kind, st), fx(life, { happy: slow ? 15 : 9 }), 'good');
      }
      p.closeness = clamp(p.closeness - 8);
      return res(L(`${name} cảm ơn bạn, nhưng không đáp lại.`, `${name} thanks you, but doesn't feel the same.`), fx(life, { happy: -6 }), 'bad');
    }
    case 'ixtalk': return ixTalk(life, p, n);
    case 'kink': return kinkMenu(life, st, p);
    case 'pos': return posMenu(life, st, p);
    case 'sext': if (n > 2) return tired; return sextRound(life, p, 0, 0);
    case 'group': if (n > 1) return tired; return groupMenu(life, st, p);
    case 'clubtogether': {
      if (n > 1) return tired;
      cl(life, p, 5, 10); fire(p, 10);
      return res(L(`Đêm mặt nạ ở CLB. Bạn và ${name} chỉ nhìn, nắm tay nhau thật chặt, rồi về nhà rất vội.`, `Masquerade night at the club. You and ${name} only watch, hold hands tight, then hurry home.`), fx(life, { happy: 9, money: -3 }), 'good');
    }
    case 'spoil': return spoilMenu(life, p);
    case 'rules': if (n > 1) return tired; return rulesMenu(life, p);
    case 'endbaby': {
      p.baby = false; p.allow = 0;
      endLover(life, p);
      if (prof(p).sincere < 40) { me(life).scandal = clamp(me(life).scandal + 8); return res(L(`${name} giữ hết quà và đăng một story đầy ẩn ý.`, `${name} keeps every gift and posts a very pointed story.`), fx(life, { happy: -4 }), 'bad'); }
      return res(L(`${name} ôm bạn lần cuối: "Cảm ơn vì tất cả."`, `${name} hugs you one last time: "Thank you for everything."`), fx(life, { happy: -2 }));
    }
  }
  return null;
}

// Mục 1 · Trò chuyện thầm kín: lộ dần sở thích và giới hạn
function ixTalk(life, p, n) {
  if (n > 2) return res(L('Năm nay như vậy là đủ rồi.', "That's enough for this year."), []);
  const x = prof(p);
  const name = nm(life, p);
  if (p.closeness < 30) { p.closeness = clamp(p.closeness - 4); return res(L(`${name} đang giận, chẳng muốn nói chuyện này.`, `${name} is upset and in no mood for this talk.`), [], 'bad'); }
  const wants = x.kinks.filter((k) => !x.known.includes(k));
  const lims = x.limits.filter((k) => !x.knownLim.includes(k));
  x.chem = clamp(x.chem + 2); cl(life, p, 2, 5);
  if (wants.length && (!lims.length || chance(life, 0.6))) {
    const k = pick(life, wants); x.known.push(k);
    return res(L(`${name} thì thầm điều họ luôn muốn thử: ${kinkById[k].name.vi.toLowerCase()}.`, `${name} whispers what they've always wanted to try: ${kinkById[k].name.en.toLowerCase()}.`), fx(life, { happy: 4 }), 'good');
  }
  if (lims.length) {
    const k = pick(life, lims); x.knownLim.push(k);
    return res(L(`${name} nói rõ: "${kinkById[k].name.vi}" là giới hạn của họ. Bạn ghi nhớ.`, `${name} is clear: "${kinkById[k].name.en}" is a hard limit. You make a note.`), fx(life, { happy: 2 }), 'good');
  }
  return res(L(`Bạn và ${name} đã hiểu nhau đến từng chi tiết.`, `You and ${name} know each other inside out now.`), fx(life, { happy: 3 }), 'good');
}

// Mục 5, 10, 17–20 · Thử điều mới
function kinkMenu(life, st, p) {
  const name = nm(life, p);
  return modal('ix/kink', L(`Thử gì mới với ${name}?`, `What new thing will you try with ${name}?`),
    KINK_GROUPS.map(([g, em, label]) => ({ label: L(`${em} ${label.vi}`, `${em} ${label.en}`), outcomes: [oc('', {}, null, (lf) => kinkGroup(lf, st, p, g))] }))
      .concat([{ label: L('Thôi, để lúc khác', 'Maybe another time'), outcomes: [oc(L('Hai người chỉ ôm nhau ngủ.', 'You just cuddle and fall asleep.'))] }]));
}
function kinkGroup(life, st, p, g) {
  const m = me(life);
  const x = prof(p);
  const list = KINKS.filter((k) => k.grp === g);
  return {
    uid: 'ix/kinkgroup',
    text: L('Chọn một điều. Tên có ♥ là điều họ đã thú nhận muốn thử.', 'Pick one. ♥ marks something they told you they want.'),
    choices: list.map((k) => {
      const need = (k.item && !m.chest.includes(k.item)) ? CHEST[k.item] : null;
      const tag = `${x.known.includes(k.id) ? ' ♥' : ''}${x.knownLim.includes(k.id) ? ' ⛔' : ''}${need ? ` (${L('cần', 'needs').vi} ${need.em})` : ''}`;
      const tagEn = `${x.known.includes(k.id) ? ' ♥' : ''}${x.knownLim.includes(k.id) ? ' ⛔' : ''}${need ? ` (needs ${need.em})` : ''}`;
      return { label: L(k.name.vi + tag, k.name.en + tagEn), outcomes: kinkOutcomes(life, st, p, k) };
    }),
  };
}
function kinkOutcomes(life, st, p, k) {
  const m = me(life);
  const x = prof(p);
  const name = nm(life, p);
  const sc = (i) => k.scene[i].replace(/\{n\}/g, name);
  if (k.item && !m.chest.includes(k.item)) return [oc(L(`Bạn cần "${CHEST[k.item].name.vi}" trong Rương bí mật. Ghé Cửa hàng người lớn trong mục Hoạt động.`, `You need "${CHEST[k.item].name.en}" in your secret chest. Visit the adult shop in Activities.`))];
  if (k.id === 'shibari' && !m.rope) return [oc(L('Dây trói nghệ thuật cần học bài bản trước. Hãy đăng ký lớp shibari trong mục Hoạt động.', 'Shibari needs proper lessons first. Sign up for a class in Activities.'))];
  // Giới hạn: luôn từ chối, bất kể độ kiên định
  if (x.limits.includes(k.id)) return [oc(L(`${name} lắc đầu: đây là giới hạn của họ. Bạn tôn trọng và không nhắc lại.`, `${name} shakes their head: that's a hard limit. You respect it and drop it.`), {}, (lf) => { if (!x.knownLim.includes(k.id)) x.knownLim.push(k.id); p.closeness = clamp(p.closeness - 3); })];
  const wants = x.kinks.includes(k.id);
  const ok = wants ? 0.97 : agree(life, p, 0.42 + x.chem / 300, true);
  const after = (lf) => aftercare(lf, p);
  const win = (lf, extra = 0) => {
    if (!m.tried.includes(k.id)) m.tried.push(k.id);
    if (wants && !x.known.includes(k.id)) x.known.push(k.id);
    p.closeness = clamp(p.closeness + randint(lf, 4, 9) + (wants ? 6 : 0));
    x.fire = clamp(x.fire + 6); x.chem = clamp(x.chem + (wants ? 4 : 1));
    lf.stats.happy = clamp(lf.stats.happy + Math.round(x.chem / 25) + extra);
    setFlag(lf, 'recent_intimate');
    if (k.id === 'findom') { lf.money -= u(lf, randint(lf, 5, 20)); }
  };
  const hap = 6 + (wants ? 8 : 0);
  const outs = [];
  const okMain = ok * (k.risk ? 0.72 : 0.92);
  outs.push(oc(L(sc(0) + (wants ? ' Ánh mắt họ nói rằng họ đã chờ điều này rất lâu.' : ''), sc(1) + (wants ? ' Their eyes say they\'ve waited a long time for this.' : '')), { happy: hap }, (lf) => win(lf), after, okMain));
  if (k.risk) outs.push(oc(L(sc(0) + ' ' + MISHAP[k.risk].vi, sc(1) + ' ' + MISHAP[k.risk].en), { happy: 5, ...(k.risk === 'lift' ? { health: -2 } : {}) }, (lf) => { win(lf, 2); if (k.risk === 'exhib') m.scandal = clamp(m.scandal + 2); }, after, ok * 0.2));
  outs.push(oc(L(`Giữa chừng, ${name} nói từ an toàn. Bạn dừng ngay, ôm họ và hỏi họ ổn không. Họ tin bạn hơn bao giờ hết.`, `Partway through, ${name} uses the safe word. You stop at once, hold them and check in. They trust you more than ever.`), { happy: 1 }, (lf) => { p.closeness = clamp(p.closeness + 4); m.care++; }, null, ok * 0.08));
  outs.push(oc(L(`${name} ngập ngừng: chưa sẵn sàng cho chuyện này. Có lẽ để lúc khác.`, `${name} hesitates: not ready for that. Maybe another time.`), {}, (lf) => { p.closeness = clamp(p.closeness - 1); }, null, 1 - ok));
  return outs;
}
// Chăm sóc sau cảnh (aftercare)
function aftercare(life, p) {
  const m = me(life);
  const name = nm(life, p);
  return {
    uid: 'ix/after', text: L(`Sau đó, bạn làm gì cho ${name}?`, `Afterwards, what do you do for ${name}?`),
    choices: [
      { label: L('Ôm nhau và trò chuyện', 'Cuddle and talk'), outcomes: [oc(L(`Hai người nằm nói chuyện đến khi ${name} ngủ thiếp đi trên vai bạn.`, `You talk until ${name} drifts off on your shoulder.`), { happy: 2 }, () => { m.care++; p.closeness = clamp(p.closeness + 3); })] },
      { label: L('Pha nước ấm, tắm cùng', 'Run a warm bath together'), outcomes: [oc(L('Nước ấm, nến thơm, không ai nói gì mà vẫn hiểu.', 'Warm water, a candle, no words needed.'), { happy: 3, health: 1 }, () => { m.care++; p.closeness = clamp(p.closeness + 2); })] },
      { label: L('Mang nước và đồ ăn vặt', 'Bring water and snacks'), outcomes: [oc(L(`${name} cười: "Chu đáo thế này thì ai chịu nổi."`, `${name} grins: "Who could resist someone this thoughtful?"`), { happy: 2 }, () => { m.care++; p.closeness = clamp(p.closeness + 2); })] },
      { label: L('Lăn ra ngủ luôn', 'Fall straight asleep'), outcomes: [oc(L(`Bạn ngáy trước cả khi ${name} kịp nói gì.`, `You're snoring before ${name} can say a word.`), {}, () => { p.closeness = clamp(p.closeness - 1); })] },
    ],
  };
}

// Mục 21 · Sổ tay tư thế
export const posLevel = (i) => (i < 12 ? 0 : i < 24 ? 1 : 2);
function posMenu(life, st, p) {
  const x = prof(p);
  const name = nm(life, p);
  const choices = POS_LEVELS.map((lv, i) => ({ label: L(`${lv.vi} · ${me(life).pos.filter((q) => posLevel(q) === i).length}/12`, `${lv.en} · ${me(life).pos.filter((q) => posLevel(q) === i).length}/12`), outcomes: posOutcomes(life, p, i) }));
  if (x.fav != null) choices.unshift({ label: L(`Tư thế của hai người: ${POSITIONS[x.fav].vi}`, `Your signature move: ${POSITIONS[x.fav].en}`), outcomes: [oc(L(`Không cần nói gì. "${POSITIONS[x.fav].vi}" luôn khiến ${name} mềm lòng, kể cả sau trận cãi to nhất.`, `No words needed. "${POSITIONS[x.fav].en}" always melts ${name}, even after the worst fight.`), { happy: 8 }, (lf) => { p.closeness = clamp(p.closeness + (p.closeness < 50 ? 14 : 6)); setFlag(lf, 'recent_intimate'); })] });
  return modal('ix/pos', L(`Mở Sổ tay 36 tư thế cùng ${name}. Chọn độ khó:`, `You open the 36 Positions Handbook with ${name}. Pick a difficulty:`), choices.concat([{ label: L('Đóng sổ', 'Close the book'), outcomes: [oc(L('Hai người cười và cất sổ vào Rương bí mật.', 'You laugh and put the book back in the chest.'))] }]));
}
function posOutcomes(life, p, lvl) {
  const m = me(life);
  const x = prof(p);
  const name = nm(life, p);
  const flex = (m.flex + x.flex) / 2;
  let ok = [0.9, 0.3 + flex / 140, 0.08 + flex / 130 + (life.stats.health - 50) / 300][lvl];
  if (lvl === 2 && life.stats.health < 60) ok *= 0.5;
  ok = clamp(ok, 0.03, 0.95);
  const fails = [
    L('Chuột rút giữa chừng. Bạn nằm bóp chân, còn người kia cười không dứt.', 'A cramp halfway through. You rub your calf while they can\'t stop laughing.'),
    L('Cả hai cùng lăn khỏi giường. Cái đèn ngủ cũng không thoát.', 'You both roll off the bed. The bedside lamp doesn\'t survive either.'),
    L('Hai người cười đến mức quên luôn đang làm gì.', 'You laugh so hard you forget what you were doing.'),
    L('Theo hình vẽ thì dễ lắm. Thực tế thì không.', 'It looked so easy in the drawing. It isn\'t.'),
  ];
  return [
    oc(L(`Thành công! Bạn ghi một tư thế mới vào sổ. ${name} giơ ngón cái.`, `Success! A new one for the book. ${name} gives you a thumbs up.`), { happy: 6 + lvl * 4 }, (lf) => {
      const pool = POSITIONS.map((_, i) => i).filter((i) => posLevel(i) === lvl && !m.pos.includes(i));
      const pidx = pool.length ? pick(lf, pool) : pick(lf, POSITIONS.map((_, i) => i).filter((i) => posLevel(i) === lvl));
      if (!m.pos.includes(pidx)) m.pos.push(pidx);
      x.pc[pidx] = (x.pc[pidx] || 0) + 1;
      if (x.fav == null && x.pc[pidx] >= 2) { x.fav = pidx; addLog(lf, L(`"${POSITIONS[pidx].vi}" trở thành tư thế yêu thích của bạn và ${name}.`, `"${POSITIONS[pidx].en}" becomes your and ${name}'s favourite.`), 'good'); }
      p.closeness = clamp(p.closeness + 4 + lvl * 2); x.fire = clamp(x.fire + 4);
      setFlag(lf, 'recent_intimate');
      addLog(lf, L(`Đã mở khóa tư thế "${POSITIONS[pidx].vi}" (${m.pos.length}/36).`, `Unlocked "${POSITIONS[pidx].en}" (${m.pos.length}/36).`));
    }, null, ok),
    oc(pick(life, fails), { happy: 3 }, () => { p.closeness = clamp(p.closeness + 2); }, null, (1 - ok) * (lvl ? 0.75 : 1)),
    ...(lvl ? [oc(L('Một tiếng "rắc". Bạn trẹo lưng, phải đi khám và bịa với bác sĩ là "bê tủ lạnh".', 'A loud "crack". You put your back out and tell the doctor you were "moving a fridge".'), { health: -6, happy: -2, money: -2 }, null, null, (1 - ok) * 0.25)] : []),
  ];
}

// Mục 2 & 25 · Mini-game nhắn tin, có rủi ro gửi nhầm
const STYLE = { soft: L('Dịu dàng', 'Sweet'), bold: L('Táo bạo', 'Bold'), fun: L('Hài hước', 'Playful') };
const LINES = {
  soft: [L('"Nhớ bạn quá, về sớm nhé."', '"Miss you. Come home early."'), L('"Tối nay mình nấu món bạn thích."', '"Making your favourite tonight."'), L('"Nghĩ đến bạn là mình cười một mình."', '"I keep smiling when I think of you."')],
  bold: [L('"Đoán xem mình đang mặc gì."', '"Guess what I\'m wearing."'), L('"Tối nay đừng hẹn ai khác."', '"Don\'t make other plans tonight."'), L('"Mình có một ý tưởng. Bạn sẽ thích."', '"I\'ve got an idea. You\'ll like it."')],
  fun: [L('"Bạn có phải wifi không? Vì mình đang muốn kết nối."', '"Are you wifi? Because I feel a connection."'), L('"Mình đặt lịch họp với bạn tối nay. Nội dung: bí mật."', '"Meeting booked with you tonight. Agenda: classified."'), L('Một ảnh selfie mặt hề nhất thế giới.', 'The goofiest selfie ever taken.')],
};
function sextRound(life, p, i, score) {
  const x = prof(p);
  const name = nm(life, p);
  const pickL = (s) => LINES[s][i % 3];
  const choices = Object.keys(STYLE).map((s) => ({
    label: L(`${STYLE[s].vi}: ${pickL(s).vi}`, `${STYLE[s].en}: ${pickL(s).en}`),
    outcomes: [oc('', {}, null, (lf) => {
      const sc = score + (s === x.style ? 2 : (s === 'soft' || x.style === 'soft') ? 0 : 1);
      if (chance(lf, 0.05)) return wrongSend(lf, p);
      return i < 2 ? sextRound(lf, p, i + 1, sc) : sextEnd(lf, p, sc);
    })],
  }));
  return i === 0 ? modal('ix/sext', L(`Bạn mở cuộc trò chuyện với ${name}. Tin đầu tiên?`, `You open your chat with ${name}. First message?`), choices) : { uid: 'ix/sext', text: L(`${name} đang trả lời... Gửi tiếp:`, `${name} is typing... Next message:`), choices };
}
function sextEnd(life, p, sc) {
  const name = nm(life, p);
  const x = prof(p);
  const great = sc >= 5; const okk = sc >= 3;
  return { uid: 'ix/sext_end', text: L(`${name} vừa trả lời.`, `${name} just replied.`), choices: [{ label: L('Đọc tin nhắn', 'Read it'), outcomes: [
    great ? oc(L(`"Về ngay đây." Bạn chưa kịp cất điện thoại thì đã nghe tiếng chìa khóa.`, `"On my way." You hear the key in the lock before you've put the phone down.`), { happy: 8 }, () => { p.closeness = clamp(p.closeness + 8); x.fire = clamp(x.fire + 10); x.style = x.style; })
      : okk ? oc(L(`${name} gửi lại một biểu tượng mặt đỏ. Tối nay chắc sẽ vui.`, `${name} sends back a blushing emoji. Tonight should be fun.`), { happy: 4 }, () => { p.closeness = clamp(p.closeness + 4); x.fire = clamp(x.fire + 4); })
        : oc(L(`"Đã xem." Không có gì thêm.`, `"Seen." Nothing else.`), { happy: -3 }, () => { p.closeness = clamp(p.closeness - 2); }),
  ] }] };
}
function wrongSend(life, p) {
  const name = nm(life, p);
  const opts = [];
  const parents = life.people.filter((q) => q.alive && (q.role === 'mother' || q.role === 'father'));
  if (parents.length) opts.push('family');
  if (life.job) opts.push('boss');
  const others = life.people.filter((q) => q.alive && q !== p && ROM.includes(q.role));
  if (others.length) opts.push('other');
  if (!opts.length) opts.push('group');
  const kind = pick(life, opts);
  const target = kind === 'other' ? pick(life, others) : null;
  const who = { family: L('nhóm chat gia đình', 'the family group chat'), boss: L('sếp', 'your boss'), group: L('nhóm chat lớp cũ', 'your old class group chat'), other: target ? L(nm(life, target), nm(life, target)) : L('', '') }[kind];
  return { uid: 'ix/wrong', text: L(`Ôi không! Tin nhắn dành cho ${name} vừa gửi nhầm vào ${who.vi}.`, `Oh no! The message meant for ${name} just went to ${who.en}.`), choices: [
    { label: L('Thu hồi ngay', 'Unsend it now'), outcomes: [
      oc(L('Thu hồi kịp. Không ai thấy... hình như vậy.', 'Unsent in time. Nobody saw... probably.'), {}, null, null, 0.5),
      oc(L('Quá muộn: đã có người "đã xem".', 'Too late: someone already saw it.'), { happy: -4 }, (lf) => wrongFallout(lf, kind, target), null, 0.5),
    ] },
    { label: L('Nói là bị hack', 'Say you got hacked'), outcomes: [
      oc(L('Mọi người tin. Bạn đổi mật khẩu cho có.', 'Everyone buys it. You change your password for show.'), { karma: -2 }, null, null, 0.45),
      oc(L('Không ai tin. Biệt danh mới của bạn sống mãi trong nhóm chat.', 'Nobody believes you. Your new nickname lives on forever in the chat.'), { happy: -5 }, (lf) => wrongFallout(lf, kind, target), null, 0.55),
    ] },
    { label: L('Thừa nhận và cười trừ', 'Own it and laugh'), outcomes: [oc(L('Bạn thừa nhận. Ngượng chín người nhưng thẳng thắn.', 'You own it. Mortifying, but honest.'), { happy: -2, willpower: 2 }, (lf) => wrongFallout(lf, kind, target, true))] },
  ] };
}
function wrongFallout(life, kind, target, honest) {
  if (kind === 'family') for (const q of life.people) if (q.alive && (q.role === 'mother' || q.role === 'father')) q.closeness = clamp(q.closeness - 5);
  if (kind === 'boss' && life.job) { life.job.perf = clamp((life.job.perf || 50) - (honest ? 5 : 10)); me(life).scandal = clamp(me(life).scandal + 6); }
  if (kind === 'group') me(life).scandal = clamp(me(life).scandal + 4);
  if (kind === 'other' && target) {
    if (polyOk(life)) { target.closeness = clamp(target.closeness - 3); return; }
    target.closeness = clamp(target.closeness - 15);
    if ((target.role === 'partner' || target.role === 'spouse') && lovers(life).length) life.queue.unshift({ sys: 'affair_exposed' });
  }
}

// Mục 16 · Trải nghiệm nhiều người (chỉ người lớn, tất cả đồng ý)
function groupMenu(life, st, p) {
  const name = nm(life, p);
  const x = prof(p);
  const m = me(life);
  const consent = polyOk(life) ? 0.9 : agree(life, p, (p.poly ?? 30) / 130 + 0.05, true);
  const refuse = oc(L(`${name} lắc đầu: "Mình chỉ muốn có hai ta thôi."`, `${name} shakes their head: "I just want it to be us."`), {}, () => { p.closeness = clamp(p.closeness - 4); });
  const done = (lf) => { m.groups++; m.charm = clamp(m.charm + 3); setFlag(lf, 'recent_intimate'); };
  const third = () => (lf) => { const t = freshAdult(lf, 'contact', lf.age + randint(lf, -6, 6)); prof(t).fire = 60; return t; };
  return modal('ix/group', L(`Bạn gợi ý với ${name} một trải nghiệm táo bạo hơn.`, `You suggest something bolder to ${name}.`), [
    { label: L('Bộ ba với một người mới', 'A threesome with someone new'), outcomes: [
      oc(L(`Một người bạn quen ở quầy bar, một căn phòng khách sạn, ba ly rượu. Sáng ra ${name} hôn bạn trước tiên.`, `Someone you met at the bar, a hotel room, three glasses of wine. In the morning ${name} kisses you first.`), { happy: 10 }, (lf) => { done(lf); third()(lf); p.closeness = clamp(p.closeness + 6); }, null, consent * 0.55),
      oc(L(`Đêm đó vui, nhưng sáng hôm sau ${name} im lặng. Có gì đó gợn lại.`, `The night was fun, but ${name} is quiet the next morning. Something stings.`), { happy: 2 }, (lf) => { done(lf); p.closeness = clamp(p.closeness - 12); x.jeal = clamp(x.jeal + 10); }, null, consent * 0.25),
      oc(L('Người thứ ba xin số của bạn trước khi về. Mọi chuyện bắt đầu phức tạp.', 'The third person asks for your number before leaving. Things get complicated.'), { happy: 6 }, (lf) => { done(lf); const t = third()(lf); makeLover(lf, t); t.wasLover = true; }, null, consent * 0.2),
      { ...refuse, chance: 1 - consent },
    ] },
    { label: L('Hoán đổi với cặp bạn thân', 'Swap with a couple you\'re close to'), outcomes: [
      oc(L('Bốn người, một kỳ nghỉ cuối tuần, và một thỏa thuận không bao giờ kể lại. Tình bạn còn khăng khít hơn.', 'Four people, one weekend, and an agreement never to speak of it. The friendship gets even closer.'), { happy: 9 }, (lf) => { done(lf); p.closeness = clamp(p.closeness + 4); for (const f of lf.people.filter((q) => q.alive && ['friend', 'bestie'].includes(q.role) && q.age >= 18).slice(0, 2)) f.closeness = clamp(f.closeness + 6); }, null, consent * 0.7),
      oc(L('Bữa tối sau đó với cặp bạn kia ngượng đến mức không ai dám nhìn ai.', 'Dinner with the other couple afterwards is so awkward nobody makes eye contact.'), { happy: -2 }, (lf) => { done(lf); for (const f of lf.people.filter((q) => q.alive && ['friend', 'bestie'].includes(q.role)).slice(0, 2)) f.closeness = clamp(f.closeness - 10); }, null, consent * 0.3),
      { ...refuse, chance: 1 - consent },
    ] },
    { label: L('Tiệc riêng ở biệt thự thuê', 'A private party at a rented villa'), outcomes: [
      oc(L('Hồ bơi, mặt nạ, nhạc đến sáng. Ai cũng là người lớn, ai cũng biết luật. Bạn và người ấy về nhà với một bí mật chung.', 'A pool, masks, music till dawn. All grown-ups, all knowing the rules. You go home sharing a secret.'), { happy: 11, money: -30 }, (lf) => { done(lf); p.closeness = clamp(p.closeness + 7); x.fire = clamp(x.fire + 12); }, null, consent),
      { ...refuse, chance: 1 - consent },
    ] },
    { label: L('Kỳ nghỉ du thuyền dành cho cặp đôi', 'A couples-only yacht cruise'), outcomes: [
      oc(L('Một tuần trên biển với những cặp đôi cởi mở. Bạn trở về rám nắng và đầy chuyện để giữ kín.', 'A week at sea with open-minded couples. You come home tanned and full of stories to keep quiet.'), { happy: 14, health: 2, money: -80 }, (lf) => { done(lf); p.closeness = clamp(p.closeness + 10); x.fire = clamp(x.fire + 15); }, null, consent),
      { ...refuse, chance: 1 - consent },
    ] },
    { label: L('Thôi, chỉ hai ta là đủ', 'Never mind, just us'), outcomes: [oc(L('Hai người ôm nhau xem phim.', 'You cuddle up and watch a film.'), { happy: 2 })] },
  ]);
}

// Mục 14 · Sugar daddy / sugar mommy (bạn là người chu cấp)
function spoilMenu(life, p) {
  const name = nm(life, p);
  const g = (label, units, d, text) => ({ label, outcomes: [oc(text, { money: -units, happy: 4 }, () => { p.closeness = clamp(p.closeness + d); prof(p).sincere = clamp(prof(p).sincere + Math.round(d / 4)); })] });
  return modal('ix/spoil', L(`Tặng ${name} gì đây?`, `What will you give ${name}?`), [
    g(L('Túi hiệu', 'A designer bag'), 20, 8, L(`${name} đăng ảnh chiếc túi kèm dòng "cảm ơn ai đó".`, `${name} posts the bag with "thank you, someone".`)),
    g(L('Một chiếc xe', 'A car'), 150, 15, L(`${name} hét lên khi thấy chìa khóa.`, `${name} screams when they see the keys.`)),
    g(L('Một căn hộ', 'An apartment'), 600, 25, L(`${name} có nhà riêng. Chìa dự phòng nằm trong ví bạn.`, `${name} has a place of their own. The spare key lives in your wallet.`)),
    { label: L('Thôi', 'Not now'), outcomes: [oc(L('Bạn cất thẻ đi.', 'You put the card away.'))] },
  ]);
}
function rulesMenu(life, p) {
  const name = nm(life, p);
  const r = (label, text) => ({ label, outcomes: [
    oc(text, { happy: 4 }, () => { p.closeness = clamp(p.closeness + 3); }, null, agree(life, p, 0.55 + prof(p).sincere / 300)),
    oc(L(`${name} nhíu mày: "Vậy thì tăng trợ cấp nhé."`, `${name} frowns: "Then raise my allowance."`), {}, (lf) => { p.allow = Math.round((p.allow || u(lf, 30)) * 1.25); }, null, 1 - agree(life, p, 0.55 + prof(p).sincere / 300)),
  ] });
  return modal('ix/rules', L(`Đặt quy tắc gì với ${name}?`, `What rule will you set for ${name}?`), [
    r(L('Luôn nghe máy khi bạn gọi', 'Always pick up when you call'), L(`Từ nay ${name} nghe máy sau hồi chuông đầu tiên.`, `From now on ${name} answers on the first ring.`)),
    r(L('Mặc đồ bạn chọn khi đi cùng', 'Wear what you pick when out together'), L(`${name} xuất hiện trong bộ đồ bạn chọn, và rất hợp.`, `${name} shows up in the outfit you chose, and it suits them.`)),
    r(L('Không đăng ảnh hai người lên mạng', 'No photos of you two online'), L(`${name} gật đầu: "Bí mật của chúng ta."`, `${name} nods: "Our secret."`)),
  ]);
}

// ───────── Hoạt động 25+ ─────────
export const IX_ACTIVITIES = [
  { id: 'adultshop', group: 'adult', min: 18, max: 120, when: (lf, st) => on(st, lf), label: L('Cửa hàng người lớn', 'Adult shop'), run: (lf) => shopMenu(lf) },
  { id: 'club25', group: 'adult', min: 18, max: 120, when: (lf, st) => on(st, lf), label: L('CLB người lớn', 'Adult club'), run: (lf, st) => clubMenu(lf, st) },
  { id: 'sugarfind', group: 'adult', min: 25, max: 120, when: (lf, st) => on(st, lf) && lf.money >= u(lf, 2500), label: L('Tìm sugar baby', 'Find a sugar baby'), run: (lf, st) => sugarFind(lf, st) },
  { id: 'fling', group: 'adult', min: 18, max: 80, units: 25, when: (lf, st) => on(st, lf), label: L('Du lịch một mình', 'Travel solo'), run: (lf, st) => flingTrip(lf, st) },
  { id: 'ropeclass', group: 'adult', min: 18, max: 90, units: 8, when: (lf, st) => on(st, lf) && !me(lf).rope, label: L('Học lớp dây trói nghệ thuật', 'Take a shibari class'), run: (lf) => { me(lf).rope = true; return res(L('Bạn học được những nút thắt an toàn và đẹp. Giáo viên khen bạn có tay nghề.', 'You learn safe, beautiful knots. The teacher says you have a knack for it.'), fx(lf, { happy: 4, smarts: 1 }), 'good'); } },
  { id: 'memoir', group: 'adult', min: 50, max: 120, when: (lf, st) => on(st, lf) && !me(lf).memoir && me(lf).loverTotal >= 2, label: L('Viết hồi ký "Sổ đen"', 'Write your "Little Black Book" memoir'), run: (lf) => writeMemoir(lf) },
];

function shopMenu(life) {
  const m = me(life);
  const items = Object.entries(CHEST).filter(([k, it]) => !it.tour && !m.chest.includes(k));
  if (!items.length) return res(L('Rương bí mật của bạn đã đầy đủ mọi thứ.', 'Your secret chest already has everything.'), []);
  return modal('ix/shop', L('Cửa hàng kín đáo, giao hàng không ghi tên người gửi. Mua gì?', 'A discreet shop, unmarked delivery. What will you buy?'), items.map(([k, it]) => ({
    label: L(`${it.em} ${it.name.vi}`, `${it.em} ${it.name.en}`),
    outcomes: [
      oc(L(`"${it.name.vi}" đã nằm trong Rương bí mật.`, `"${it.name.en}" is now in your secret chest.`), { money: -it.units, happy: 2 }, () => { if (!m.chest.includes(k)) m.chest.push(k); }, null, 0.9),
      oc(L(`Gói hàng giao nhầm sang nhà hàng xóm. Họ mang sang tận tay, mỉm cười rất lạ.`, `The parcel goes to the neighbour. They bring it over with a very strange smile.`), { money: -it.units, happy: -1 }, () => { if (!m.chest.includes(k)) m.chest.push(k); m.scandal = clamp(m.scandal + 2); }, null, 0.1),
    ],
  })).concat([{ label: L('Ra về', 'Leave'), outcomes: [oc(L('Bạn chỉ xem cho biết.', 'Just browsing.'))] }]));
}

// Mục 15 · CLB người lớn (không có đột kiểm)
function clubMenu(life, st) {
  const m = me(life);
  if (!m.club) return modal('ix/clubjoin', L('Một CLB kín dành cho người lớn: thẻ hội viên đắt, luật rõ ràng: "Chỉ xem nếu muốn. Luôn hỏi trước khi chạm."', 'A private club for grown-ups: pricey membership, clear rules: "Just watch if you like. Always ask before touching."'), [
    { label: L('Mua thẻ hội viên', 'Buy a membership'), outcomes: [oc(L('Bạn nhận một tấm thẻ đen không in chữ nào.', 'You receive a black card with nothing printed on it.'), { money: -150, happy: 4 }, () => { m.club = true; m.charm = clamp(m.charm + 3); })] },
    { label: L('Thôi, chưa sẵn sàng', 'Not ready yet'), outcomes: [oc(L('Bạn cất danh thiếp vào ví.', 'You tuck the card into your wallet.'))] },
  ]);
  const known = life.people.filter((p) => adultOK(life, p) && ['coworker', 'neighbor', 'mentor', 'friend'].includes(p.role));
  return modal('ix/club', L('Tối nay CLB có gì?', 'What\'s on at the club tonight?'), [
    { label: L('Đêm mặt nạ', 'Masquerade night'), outcomes: [
      oc(L('Sau lớp mặt nạ ai cũng bạo dạn hơn. Bạn trò chuyện với một người lạ đến tận sáng.', 'Behind the masks everyone is bolder. You talk with a stranger until dawn.'), { happy: 8, money: -5 }, (lf) => { const t = freshAdult(lf, 'contact', lf.age + randint(lf, -8, 8)); prof(t).fire = 55; t.att = 'like'; m.charm = clamp(m.charm + 2); }, null, 0.6),
      ...(known.length ? [oc(L('Một người tháo mặt nạ. Là người bạn quen! Hai người nhìn nhau rồi phá lên cười: từ nay có bí mật chung.', 'Someone takes off their mask. You know them! You both burst out laughing: now you share a secret.'), { happy: 5, money: -5 }, (lf) => { const q = pick(lf, known); q.closeness = clamp(q.closeness + 12); if (q.att === 'neutral' || !q.att) q.att = 'friendly'; addLog(lf, L(`Bạn và ${nm(lf, q)} có một bí mật chung từ CLB.`, `You and ${nm(lf, q)} share a secret from the club.`)); }, null, 0.4)] : [oc(L('Bạn chỉ uống một ly và ngắm mọi người.', 'You have one drink and people-watch.'), { happy: 4, money: -5 }, null, null, 0.4)]),
    ] },
    { label: L('Phòng chủ đề', 'Themed rooms'), outcomes: [oc(L('Mỗi căn phòng một thế giới. Bạn về nhà với đầu óc quay cuồng và nhiều ý tưởng mới.', 'Each room is its own world. You go home dizzy and full of ideas.'), { happy: 7, money: -8 }, () => { m.charm = clamp(m.charm + 2); })] },
    { label: L('Quầy bar riêng', 'The private bar'), outcomes: [
      oc(L('Một người lạ hấp dẫn mời bạn ly thứ hai. Rồi ly thứ ba.', 'An attractive stranger buys your second drink. Then your third.'), { happy: 7, money: -4 }, (lf) => { const t = freshAdult(lf, 'contact', lf.age + randint(lf, -8, 8)); prof(t).fire = 70; t.att = on(st, lf) && partner(lf) ? 'affair' : 'like'; }, null, 0.7),
      oc(L('Tối nay yên ắng. Bạn và bartender thành bạn.', 'A quiet night. You make friends with the bartender.'), { happy: 3, money: -3 }, null, null, 0.3),
    ] },
  ]);
}

// Mục 14 · tìm sugar baby
function sugarFind(life, st) {
  const cs = [0, 1, 2].map(() => {
    const age = clamp(life.age - randint(life, 10, 25), 18, Math.max(18, life.age - 5));
    const p = randomPerson(life, life, { role: 'contact', gender: partnerGender(life, life), age, closeness: 40 });
    p.looks = clamp(p.looks + 25);
    prof(p);
    return p;
  });
  const tiers = (p) => (lf) => ({ uid: 'ix/sugar_deal', text: L(`Thương lượng trợ cấp hằng năm với ${nm(lf, p)}.`, `Negotiate a yearly allowance with ${nm(lf, p)}.`), choices: [[L('Khiêm tốn', 'Modest'), 20, 0.55], [L('Rộng rãi', 'Generous'), 50, 0.8], [L('Không giới hạn', 'Lavish'), 120, 0.97]].map(([lb, a, c]) => ({
    label: L(`${lb.vi} · ${a}% thu nhập TB/năm`, `${lb.en} · ${a}% of avg income/yr`),
    outcomes: [
      oc(L(`${nm(lf, p)} đồng ý. Hai người bắt tay, rồi nhiều hơn thế.`, `${nm(lf, p)} agrees. You shake hands, and then some.`), { happy: 8 }, (x) => { if (!x.people.includes(p)) x.people.push(p); p.baby = true; p.allow = u(x, a); p.term = 3; makeLover(x, p); p.wasLover = true; me(x).babies++; addLog(x, L(`${nm(x, p)} trở thành sugar baby của bạn.`, `${nm(x, p)} becomes your sugar baby.`), 'good'); }, null, agree(lf, p, c - 0.15, true)),
      oc(L(`${nm(lf, p)} cười: "Tôi đáng giá hơn thế."`, `${nm(lf, p)} laughs: "I'm worth more than that."`), { happy: -3 }, null, null, 1 - agree(lf, p, c - 0.15, true)),
    ],
  })) });
  return modal('ix/sugar', L('Một ứng dụng hẹn hò cao cấp gợi ý ba hồ sơ (đều từ 18 tuổi):', 'A high-end dating app suggests three profiles (all 18+):'), cs.map((p) => ({
    label: L(`${nm(life, p)} · ${p.age} tuổi · ngoại hình ${p.looks}`, `${nm(life, p)} · ${p.age} · looks ${p.looks}`),
    outcomes: [oc('', {}, null, tiers(p))],
  })).concat([{ label: L('Đóng ứng dụng', 'Close the app'), outcomes: [oc(L('Bạn đổi ý.', 'You change your mind.'))] }]));
}

// Mục 8 · Tình một đêm khi du lịch
function flingTrip(life, st) {
  return modal('ix/fling', L('Một mình ở một thành phố xa lạ. Tối nay đi đâu?', 'Alone in a strange city. Where tonight?'), [
    { label: L('Quán bar trên sân thượng', 'A rooftop bar'), outcomes: [
      oc(L('Một người lạ, không cần biết tên. Một đêm như trong phim, sáng ra chỉ còn mảnh giấy "Cảm ơn".', 'A stranger, no names needed. A night like a film; by morning, just a note saying "Thanks".'), { happy: 12 }, (lf) => { lf.counts.ons++; me(lf).charm = clamp(me(lf).charm + 3); const t = freshAdult(lf, 'contact', lf.age + randint(lf, -6, 6), { fling: true }); t.cut = true; tryConceive(lf, t, protectChance(st && st.alwaysProtect)); }, null, 0.65),
      oc(L('Bạn ngắm thành phố và nói chuyện với bartender về cuộc đời.', 'You watch the city and talk life with the bartender.'), { happy: 5 }, null, null, 0.35),
    ] },
    { label: L('Khám phá phố cổ', 'Explore the old town'), outcomes: [oc(L('Bạn lạc đường, ăn món lạ và về khách sạn rất muộn.', 'You get lost, eat something strange and get back very late.'), { happy: 7, health: 1 })] },
    { label: L('Ở khách sạn gọi phục vụ phòng', 'Room service night'), outcomes: [oc(L('Áo choàng tắm, phim dở và một bữa tối đắt đỏ. Hoàn hảo.', 'A bathrobe, a bad film and an overpriced dinner. Perfect.'), { happy: 5 })] },
  ]);
}

// Mục 27 · Hồi ký Sổ đen
function writeMemoir(life) {
  const m = me(life);
  m.memoir = true;
  const sales = u(life, Math.round(30 + m.loverTotal * 25 + m.scandal * 3 + m.charm * 2));
  life.money += sales;
  m.scandal = clamp(m.scandal + 25);
  const r = randint(life, 0, 2);
  const tail = [
    () => { life.money -= u(life, 40); return L(' Một người cũ kiện vì bị nhắc tên. Bạn phải bồi thường.', ' An ex sues for being named. You settle.'); },
    () => { for (const k of people(life, 'child')) k.closeness = clamp(k.closeness - 12); return L(' Con cái bạn xấu hổ đến mức không dám đi họp lớp.', ' Your kids are too embarrassed to go to their reunions.'); },
    () => { life.money += u(life, 120); life.stats.fame = clamp(life.stats.fame + 12); return L(' Một hãng phim mua bản quyền chuyển thể.', ' A studio buys the film rights.'); },
  ][r]();
  addLog(life, L('Cuốn "Sổ đen" lên kệ.', '"The Little Black Book" hits the shelves.'), 'good');
  return res(L(`Cuốn hồi ký bán chạy nhờ ${m.loverTotal} cái tên được đổi đi rất sơ sài.${tail.vi}`, `The memoir sells well thanks to ${m.loverTotal} very thinly disguised names.${tail.en}`), [['money', sales]], 'good');
}

// ───────── Diễn biến hằng năm ─────────
export function ixYear(life, st) {
  const m = me(life);
  const pushes = [];
  // Thái độ của mọi người tác động mỗi năm (không cần 25+)
  for (const p of life.people) if (p.alive && p.att && p.role !== 'pet') attYear(life, p, pushes);
  if (life.age < 18) return;
  // Người lớn ngoài gia đình có thể tự nảy sinh tình cảm
  if (chance(life, 0.05 + life.stats.looks / 1500)) {
    const c = life.people.filter((p) => adultOK(life, p) && !ROM.includes(p.role) && attOf(p) === 'neutral' && p.closeness >= 50 && likes(life, p, life.gender));
    if (c.length) pick(life, c).att = 'crush';
  }
  for (const p of life.people) {
    if (!adultOK(life, p) || !p.ix) continue;
    if (ROM.includes(p.role)) p.ix.fire = clamp(p.ix.fire - 4);
    else if (['crush', 'like', 'affair', 'heir'].includes(attOf(p))) p.ix.fire = clamp(p.ix.fire + 4);
  }
  // Ham muốn thay đổi theo tuổi, stress, con nhỏ
  const target = life.age < 30 ? 75 : life.age < 45 ? 65 : life.age < 60 ? 50 : 35;
  const kids = people(life, 'child').some((k) => k.age < 4);
  m.libido = clamp(m.libido + Math.round((target - m.libido) * 0.15) + randint(life, -3, 3) - (kids ? 3 : 0) - (life.stats.happy < 30 ? 3 : 0));
  if (life.age > 40) m.flex = clamp(m.flex - randint(life, 0, 2));
  // Danh tiếng tình trường
  const ls = lovers(life);
  for (const p of ls) if (!p.counted) { p.counted = true; p.wasLover = true; m.loverTotal++; m.charm = clamp(m.charm + 4); }
  if (partner(life) && !ls.length) m.loyal = clamp(m.loyal + 2); else if (ls.length && !polyOk(life)) m.loyal = clamp(m.loyal - 4);
  const exp = (life.counts.affairsExposed || 0) + (life.counts.multiExposed || 0);
  if (exp > m.seenExp) { m.scandal = clamp(m.scandal + 20 * (exp - m.seenExp)); m.loyal = clamp(m.loyal - 15); m.seenExp = exp; }
  m.scandal = clamp(m.scandal - 3); m.charm = clamp(m.charm - 1);
  if (m.scandal > 60 && life.job && chance(life, 0.12)) { life.job.perf = clamp((life.job.perf || 50) - 10); addLog(life, L('Đồng nghiệp xì xào về đời tư của bạn. Sếp nhìn bạn khác đi.', 'Coworkers whisper about your private life. Your boss looks at you differently.'), 'bad'); }
  if (!on(st, life)) { flush(life, pushes, st); return; }
  // Sugar babies: trợ cấp và chuyện phát sinh
  for (const p of life.people.filter((q) => q.alive && q.baby && q.role === 'lover')) {
    life.money -= p.allow || 0;
    const x = prof(p);
    if (x.sincere < 40 && chance(life, 0.2)) pushes.push({ sys: 'ix_baby', id: p.id, kind: 'raise' });
    else if (partner(life) && !polyOk(life) && chance(life, 0.12)) pushes.push({ sys: 'ix_baby', id: p.id, kind: 'photo' });
    else if (x.sincere > 75 && chance(life, 0.1)) pushes.push({ sys: 'ix_baby', id: p.id, kind: 'public' });
  }
  // Mạng lưới tình nhân
  if (ls.length >= 2 && chance(life, 0.25)) pushes.push({ sys: 'ix_net' });
  // Khủng hoảng tuổi trung niên
  if (!m.mid && life.age >= 40 && life.age <= 55 && chance(life, 0.12)) { m.mid = true; pushes.push({ sys: 'ix_mid' }); }
  const pt = partner(life);
  if (pt && pt.age >= 18) {
    const px = prof(pt);
    px.libido = clamp(px.libido + randint(life, -3, 2));
    if (Math.abs(px.libido - m.libido) > 35 && chance(life, 0.15)) pushes.push({ sys: 'ix_mismatch' });
    const admirer = life.people.find((q) => adultOK(life, q) && !ROM.includes(q.role) && ['crush', 'like', 'affair', 'heir'].includes(attOf(q)));
    if (admirer && chance(life, 0.1)) pushes.push({ sys: 'ix_jealous', id: admirer.id });
  }
  const fm = (FREQ[st?.eventFreq] || FREQ.mid).m;
  if (chance(life, 0.07 * fm)) pushes.push({ sys: 'ix_fated', id: pick(life, fatedPool(life)), step: 1 });
  if (life.job && chance(life, 0.06 * fm)) pushes.push({ sys: 'ix_office' });
  const exes = life.people.filter((q) => q.role === 'ex' && adultOK(life, q) && !q.cut);
  if (exes.length && chance(life, 0.07 * fm)) pushes.push({ sys: 'ix_ex', id: pick(life, exes).id });
  flush(life, pushes, st);
}
function flush(life, pushes, st) { for (const x of pushes.slice(0, (FREQ[st?.eventFreq] || FREQ.mid).cap)) life.queue.push(x); }

function attYear(life, p, pushes) {
  const a = attOf(p);
  const name = nm(life, p);
  if (a === 'hate') { p.closeness = clamp(p.closeness - randint(life, 2, 6)); if (chance(life, 0.12)) { life.stats.happy = clamp(life.stats.happy - 3); addLog(life, L(`${name} nói xấu bạn sau lưng với mọi người.`, `${name} badmouths you behind your back.`), 'bad'); } }
  else if (a === 'rival') { if (chance(life, 0.1)) { life.stats.willpower = clamp(life.stats.willpower + 1); addLog(life, L(`${name} lại vượt mặt bạn một lần nữa. Bạn thề lần sau sẽ thắng.`, `${name} outdoes you again. You swear you'll win next time.`)); } }
  else if (a === 'friendly') { cl(life, p, 1, 4); if (chance(life, 0.1)) { life.stats.happy = clamp(life.stats.happy + 2); addLog(life, L(`${name} ghé qua tặng bạn ít đồ ăn tự làm.`, `${name} drops by with some homemade food.`), 'good'); } }
  else if (ROM.includes(p.role) || !adultOK(life, p)) return;
  else if (a === 'crush') { cl(life, p, 1, 3); if (chance(life, 0.2)) addLog(life, L('Ai đó để lại một ly cà phê trên bàn bạn, không ký tên.', 'Someone leaves a coffee on your desk, unsigned.')); if (chance(life, 0.15)) pushes.push({ sys: 'ix_att', id: p.id }); }
  else if (a === 'like') { if (chance(life, 0.2)) pushes.push({ sys: 'ix_att', id: p.id }); }
  else if (a === 'affair') { if (chance(life, 0.25)) pushes.push({ sys: 'ix_att', id: p.id }); }
}

// ───────── Sự kiện hệ thống ─────────
const FATED = ['oneroom', 'elevator', 'wedding', 'enemies', 'reunion'];
function fatedPool(life) { return FATED.filter((f) => f !== 'reunion' || life.age >= 36); }

export function buildIxSys(life, item, st) {
  if (!item.sys || !item.sys.startsWith('ix_')) return null;
  const s = item.sys;
  const adult = on(st, life);
  if (s === 'ix_att') {
    const p = byId(life, item.id);
    if (!adultOK(life, p) || ROM.includes(p.role)) return null;
    const name = nm(life, p);
    const a = attOf(p);
    if (a === 'crush') return sev('sys/ix_crush', L(`${name} đỏ mặt, ấp úng: "Mình... thích bạn lâu rồi."`, `${name} blushes and stammers: "I... I've liked you for a long time."`), [
      { label: L('Đáp lại tình cảm', 'Return their feelings'), outcomes: [oc(L(`Bạn nắm tay ${name}. Họ cười như vừa trúng số.`, `You take ${name}'s hand. They grin like they've won the lottery.`), { happy: 10 }, (lf) => { romance(lf, p); p.att = 'like'; prof(p).fire = clamp(prof(p).fire + 20); })] },
      { label: L('Cứ để mọi thứ từ từ', 'Let things unfold slowly'), outcomes: [oc(L('Hai người hẹn đi cà phê. Không vội.', 'You agree to get coffee. No rush.'), { happy: 4 }, () => { p.att = 'like'; prof(p).fire = clamp(prof(p).fire + 10); })] },
      { label: L('Từ chối nhẹ nhàng', 'Let them down gently'), outcomes: [oc(L(`${name} gật đầu, mắt hơi đỏ.`, `${name} nods, eyes a little red.`), { karma: 1 }, () => { p.att = 'friendly'; p.closeness = clamp(p.closeness - 5); })] },
    ]);
    if (a === 'like') return sev('sys/ix_like', L(`${name} rủ bạn đi ăn tối, chỉ hai người.`, `${name} asks you to dinner, just the two of you.`), [
      { label: L('Đồng ý', 'Say yes'), outcomes: [
        oc(L('Bữa tối kéo dài đến khi nhà hàng đóng cửa.', 'Dinner lasts until the restaurant closes.'), { happy: 7 }, (lf) => { cl(lf, p, 5, 10); prof(p).fire = clamp(prof(p).fire + 15); if (!partner(lf) && chance(lf, 0.5)) romance(lf, p); }, null, 1),
      ] },
      { label: L('Từ chối', 'Decline'), outcomes: [oc(L(`${name} nhún vai: "Lần khác vậy."`, `${name} shrugs: "Another time, then."`), {}, () => { p.closeness = clamp(p.closeness - 3); })] },
    ]);
    // affair
    const taken = partner(life) && !polyOk(life);
    return sev('sys/ix_affair', adult
      ? L(`${name} nhắn lúc nửa đêm: "${taken ? 'Mình biết bạn đang có người. Mình không quan tâm.' : 'Mình đang có người, nhưng mình chỉ nghĩ đến bạn.'} Tối mai, khách sạn cũ?"`, `${name} texts at midnight: "${taken ? "I know you're taken. I don't care." : "I'm with someone, but I only think about you."} Tomorrow night, the usual hotel?"`)
      : L(`${name} nhắn lúc nửa đêm, nói muốn gặp riêng bạn, không ai biết.`, `${name} texts at midnight, wanting to see you in secret.`), [
      { label: L('Đến', 'Go'), outcomes: [oc(adult ? L('Cánh cửa khách sạn đóng lại sau lưng hai người.', 'The hotel door closes behind you both.') : L('Bạn đến điểm hẹn.', 'You go to meet them.'), { happy: 10, risk: 3 }, (lf) => { makeLover(lf, p); p.wasLover = true; if (taken) lf.stats.karma = clamp(lf.stats.karma - 5); setFlag(lf, 'recent_intimate'); })] },
      { label: L('Chỉ tán tỉnh qua lại', 'Just flirt back'), outcomes: [oc(L('Bạn trả lời bằng một câu đầy ẩn ý rồi tắt máy.', 'You reply with something suggestive, then switch off.'), { happy: 3 }, () => { prof(p).fire = clamp(prof(p).fire + 15); })] },
      { label: L('Từ chối dứt khoát', 'Firmly decline'), outcomes: [oc(L('Bạn chặn số. Ý chí thép.', 'You block the number. Nerves of steel.'), { willpower: 4 }, () => { p.att = 'neutral'; p.closeness = clamp(p.closeness - 8); })] },
      ...(partner(life) ? [{ label: L('Kể với người yêu', 'Tell your partner'), outcomes: [oc(L('Người yêu cảm ơn vì bạn đã thành thật.', 'Your partner thanks you for being honest.'), { karma: 4 }, (lf) => { const pt = partner(lf); if (pt) pt.closeness = clamp(pt.closeness + 6); p.att = 'hate'; })] }] : []),
    ]);
  }
  if (s === 'ix_office') {
    let p = item.pid ? byId(life, item.pid) : null;
    if (!adultOK(life, p)) { p = findOrMake(life, ['coworker'], () => freshAdult(life, 'coworker', life.age + randint(life, -6, 6))); item.pid = p.id; }
    const name = nm(life, p);
    return sev('sys/ix_office', L(`Tiệc cuối năm công ty. ${name} kéo bạn ra ban công, đứng gần hơn mức cần thiết.`, `The office party. ${name} pulls you out onto the balcony and stands closer than necessary.`), [
      { label: L('Hôn họ', 'Kiss them'), outcomes: [
        oc(adult ? L('Phòng họp tầng 12 hôm đó khóa cửa rất lâu.', 'The 12th-floor meeting room stays locked for a long time that night.') : L('Hai người bắt đầu hẹn hò bí mật ở công ty.', 'You start a secret office romance.'), { happy: 9 }, (lf) => { prof(p).fire = clamp(prof(p).fire + 20); romance(lf, p); }, null, 0.75),
        oc(L('Ai đó đã thấy. Tuần sau HR mời bạn lên nói chuyện.', 'Someone saw. Next week HR wants a word.'), { happy: -4 }, (lf) => { romance(lf, p); if (lf.job) lf.job.perf = clamp((lf.job.perf || 50) - 15); me(lf).scandal = clamp(me(lf).scandal + 8); }, null, 0.25),
      ] },
      { label: L('Giữ chuyên nghiệp', 'Keep it professional'), outcomes: [oc(L('Bạn mỉm cười, nâng ly, rồi quay vào trong.', 'You smile, raise your glass and head back inside.'), { willpower: 3 }, () => { prof(p).fire = clamp(prof(p).fire + 5); })] },
      { label: L('Hẹn gặp ngoài giờ', 'Suggest meeting after hours'), outcomes: [oc(L('Một quán rượu nhỏ cách công ty ba con phố. Không đồng nghiệp nào lui tới.', 'A small bar three streets from work. No coworkers ever go there.'), { happy: 5 }, () => { p.att = 'like'; prof(p).fire = clamp(prof(p).fire + 15); })] },
    ]);
  }
  if (s === 'ix_ex') {
    const p = byId(life, item.id);
    if (!adultOK(life, p)) return null;
    const name = nm(life, p);
    return sev('sys/ix_ex', L(`2 giờ sáng. ${name}: "Ngủ chưa?"`, `2am. ${name}: "u up?"`), [
      { label: L('Trả lời', 'Reply'), outcomes: [
        oc(L(`"Chỉ để nói chuyện thôi." Một tiếng sau ${name} đã đứng trước cửa nhà bạn.`, `"Just to talk." An hour later ${name} is at your door.`), { happy: 6 }, (lf) => { romance(lf, p); setFlag(lf, 'recent_intimate'); }, null, 0.5),
        oc(L('Hai người nói chuyện đến sáng và nhớ ra vì sao đã chia tay.', 'You talk till dawn and remember exactly why you broke up.'), { happy: -3 }, () => { p.closeness = clamp(p.closeness + 5); }, null, 0.5),
      ] },
      { label: L('Phớt lờ', 'Ignore it'), outcomes: [oc(L('Bạn úp điện thoại xuống và ngủ tiếp.', 'You turn the phone face-down and go back to sleep.'), { willpower: 3 })] },
      { label: L('Chặn số', 'Block them'), outcomes: [oc(L('Một chương đã đóng lại.', 'That chapter is closed.'), { willpower: 2 }, () => { p.cut = true; })] },
    ]);
  }
  if (s === 'ix_net') {
    const ls = lovers(life);
    if (ls.length < 2) return null;
    const [a, b] = [ls[0], ls[1]];
    const na = nm(life, a); const nb = nm(life, b);
    if (item.r == null) item.r = rand(life);
    if (polyOk(life)) {
      if (item.r < 0.5) return sev('sys/ix_net_poly', L(`Sinh nhật chung của "Gia đình mở": ${na}, ${nb} và bạn. Nhóm chat sôi nổi cả tuần.`, `A joint birthday for the "Open Family": ${na}, ${nb} and you. The group chat buzzes all week.`), [
        { label: L('Tổ chức thật lớn', 'Throw a big party'), outcomes: [oc(L('Một chiếc bánh ba tầng, ba tên trên mặt bánh.', 'A three-tier cake with three names on it.'), { happy: 10, money: -8 }, () => { for (const q of ls) q.closeness = clamp(q.closeness + 6); })] },
        { label: L('Lập lịch phân ca cho công bằng', 'Make a fair rota'), outcomes: [oc(L('Một bảng tính màu sắc dán trên tủ lạnh. Ai cũng hài lòng.', 'A colour-coded spreadsheet on the fridge. Everyone is happy.'), { happy: 5 }, () => { for (const q of ls) prof(q).jeal = clamp(prof(q).jeal - 10); })] },
      ]);
      return sev('sys/ix_net_friends', L(`${na} và ${nb} thành bạn thân, rủ nhau đi chơi mà không mời bạn.`, `${na} and ${nb} become best friends and go out without inviting you.`), [
        { label: L('Cười cho qua', 'Laugh it off'), outcomes: [oc(L('Ít nhất họ hợp nhau.', 'At least they get along.'), { happy: 2 }, () => { prof(a).jeal = clamp(prof(a).jeal - 15); prof(b).jeal = clamp(prof(b).jeal - 15); })] },
        { label: L('Đòi được đi cùng', 'Demand to come along'), outcomes: [oc(L('Họ cho bạn đi cùng, với điều kiện bạn trả tiền.', 'They let you tag along, as long as you pay.'), { happy: 4, money: -3 })] },
      ]);
    }
    const xa = prof(a); const xb = prof(b);
    if (xa.knows && xb.knows && (xa.jeal + xb.jeal) / 2 > 55 && item.r < 0.5) return sev('sys/ix_net_alliance', L(`${na} và ${nb} đã nói chuyện với nhau. Họ cùng lúc chia tay bạn.`, `${na} and ${nb} have talked. They dump you at the same time.`), [
      { label: L('Chấp nhận', 'Accept it'), outcomes: [oc(L('Hai tin nhắn đến cùng một giây.', 'Two messages arrive in the same second.'), { happy: -10 }, (lf) => { endLover(lf, a); endLover(lf, b); me(lf).scandal = clamp(me(lf).scandal + 10); })] },
      { label: L('Cố níu kéo cả hai', 'Try to keep them both'), outcomes: [
        oc(L('Bằng cách nào đó bạn thuyết phục được cả hai. Không ai hiểu nổi.', 'Somehow you talk them both round. Nobody understands how.'), { happy: 4 }, () => { a.closeness = clamp(a.closeness - 5); b.closeness = clamp(b.closeness - 5); }, null, 0.25),
        oc(L('Họ chặn số bạn, cùng một lúc.', 'They block you, in unison.'), { happy: -12 }, (lf) => { endLover(lf, a); endLover(lf, b); }, null, 0.75),
      ] },
    ]);
    return sev('sys/ix_net_cafe', L(`${na} và ${nb}, hai người tình của bạn, tình cờ ngồi cùng bàn ở quán cà phê. Bạn vừa bước vào.`, `${na} and ${nb}, two of your lovers, happen to share a table at a café. You've just walked in.`), [
      { label: L('Lẳng lặng quay ra', 'Quietly back out'), outcomes: [
        oc(L('Không ai thấy bạn. Tim đập như trống.', 'Nobody saw you. Heart pounding.'), { happy: -1 }, null, null, 0.6),
        oc(L('Cả hai cùng ngẩng lên đúng lúc. Rồi nhìn nhau.', 'They both look up at the same moment. Then at each other.'), { happy: -8 }, () => { xa.knows = true; xb.knows = true; a.closeness = clamp(a.closeness - 15); b.closeness = clamp(b.closeness - 15); }, null, 0.4),
      ] },
      { label: L('Đến chào cả hai', 'Go and greet them both'), outcomes: [oc(L('Bạn ngồi xuống giữa hai người. Cuộc nói chuyện ngượng nhất thế kỷ.', 'You sit down between them. The most awkward conversation of the century.'), { happy: -5 }, (lf) => { xa.knows = true; xb.knows = true; a.closeness = clamp(a.closeness - 10); b.closeness = clamp(b.closeness - 10); me(lf).charm = clamp(me(lf).charm + 3); })] },
      { label: L('Nhắn hủy hẹn cả hai', 'Text both to cancel'), outcomes: [oc(L('Hai điện thoại trên cùng một bàn rung lên cùng lúc.', 'Two phones on the same table buzz at once.'), {}, () => { a.closeness = clamp(a.closeness - 4); b.closeness = clamp(b.closeness - 4); })] },
    ]);
  }
  if (s === 'ix_mid') {
    const pt = partner(life);
    return sev('sys/ix_mid', L('Sáng nay soi gương, bạn thấy một sợi tóc bạc. Khủng hoảng tuổi trung niên ập đến.', 'This morning you spot a grey hair. The midlife crisis hits.'), [
      { label: L('Mua xe mui trần', 'Buy a convertible'), outcomes: [oc(L('Tóc bay trong gió. Hàng xóm bàn tán.', 'Wind in your hair. The neighbours talk.'), { happy: 10, money: -300 })] },
      { label: L('Hẹn hò với người trẻ hơn nhiều', 'Date someone much younger'), outcomes: [oc(adult ? L('Họ đủ tuổi, nhưng trẻ đến mức bạn phải tra nghĩa từ lóng họ dùng.', 'They\'re an adult, but young enough that you google their slang.') : L('Bạn hẹn hò với một người trẻ hơn nhiều.', 'You date someone much younger.'), { happy: 8 }, (lf) => { const t = freshAdult(lf, 'contact', Math.max(25, lf.age - 18)); romance(lf, t); })] },
      ...(pt ? [{ label: L(`Yêu lại ${nm(life, pt)} như hồi đầu`, `Fall for ${nm(life, pt)} all over again`), outcomes: [oc(L('Tuần trăng mật lần hai. Như thể mới quen.', 'A second honeymoon. Like you\'ve just met.'), { happy: 12, money: -40 }, () => { pt.closeness = clamp(pt.closeness + 20); prof(pt).fire = clamp(prof(pt).fire + 30); })] }] : []),
      { label: L('Đi học nhảy salsa', 'Take salsa lessons'), outcomes: [oc(L('Hông bạn nhớ lại những điều đã quên từ lâu.', 'Your hips remember things they\'d long forgotten.'), { happy: 6, health: 3 }, (lf) => { me(lf).flex = clamp(me(lf).flex + 10); })] },
    ]);
  }
  if (s === 'ix_mismatch') {
    const pt = partner(life);
    if (!pt) return null;
    const px = prof(pt); const m = me(life);
    const name = nm(life, pt);
    return sev('sys/ix_mismatch', px.libido > m.libido ? L(`${name} than phiền dạo này bạn lúc nào cũng mệt.`, `${name} complains you're always tired lately.`) : L(`Bạn thấy ${name} dạo này lạnh nhạt chuyện chăn gối.`, `You feel ${name} has gone cold in the bedroom lately.`), [
      { label: L('Đi trị liệu cặp đôi', 'See a couples therapist'), outcomes: [oc(L('Sáu buổi trị liệu, rất nhiều khăn giấy, và hai người hiểu nhau hơn.', 'Six sessions, lots of tissues, and you understand each other better.'), { happy: 4, money: -10 }, () => { pt.closeness = clamp(pt.closeness + 10); const mid = Math.round((px.libido + m.libido) / 2); px.libido = mid; m.libido = mid; })] },
      { label: L('Tuần trăng mật lần hai', 'A second honeymoon'), outcomes: [oc(L('Một hòn đảo, không điện thoại, không con cái. Lửa bùng lên lại.', 'An island, no phones, no kids. The spark is back.'), { happy: 10, money: -40 }, () => { pt.closeness = clamp(pt.closeness + 12); px.libido = clamp(px.libido + 15); m.libido = clamp(m.libido + 10); })] },
      { label: L('Đề nghị thỏa thuận mở', 'Suggest opening things up'), outcomes: [
        oc(L(`${name} suy nghĩ rồi đồng ý: "Có luật rõ ràng."`, `${name} thinks it over and agrees: "With clear rules."`), { happy: 5 }, (lf) => { setFlag(lf, 'open_rel'); }, null, agree(life, pt, (pt.poly ?? 30) / 110, true)),
        oc(L(`${name} sững người. Không khí lạnh đi mấy tuần.`, `${name} freezes. Things are frosty for weeks.`), { happy: -5 }, () => { pt.closeness = clamp(pt.closeness - 12); }, null, 1 - agree(life, pt, (pt.poly ?? 30) / 110, true)),
      ] },
      { label: L('Mặc kệ', 'Ignore it'), outcomes: [oc(L('Hai người ngủ quay lưng vào nhau.', 'You sleep back to back.'), { happy: -3 }, () => { pt.closeness = clamp(pt.closeness - 8); })] },
    ]);
  }
  if (s === 'ix_jealous') {
    const pt = partner(life); const q = byId(life, item.id);
    if (!pt || !adultOK(life, q)) return null;
    const name = nm(life, pt); const qn = nm(life, q);
    return sev('sys/ix_jealous', L(`${name} thấy tin nhắn ${qn} gửi bạn và nổi ghen.`, `${name} sees a message from ${qn} and gets jealous.`), [
      { label: L('Trấn an', 'Reassure them'), outcomes: [
        oc(L(`${name} dịu lại khi bạn đưa điện thoại cho họ xem hết.`, `${name} calms down when you hand over your phone.`), { happy: 2 }, () => { pt.closeness = clamp(pt.closeness + 3); }, null, agree(life, pt, 0.6)),
        oc(L(`${name} vẫn không tin. Cả tối im lặng.`, `${name} still doesn't believe you. A silent evening.`), { happy: -4 }, () => { pt.closeness = clamp(pt.closeness - 6); }, null, 1 - agree(life, pt, 0.6)),
      ] },
      { label: L('Làm lành kiểu người lớn', 'Make up the grown-up way'), outcomes: [
        oc(adult ? L(`Trận cãi kết thúc trên giường. ${name} thì thầm: "Bạn là của mình."`, `The fight ends in bed. ${name} whispers: "You're mine."`) : L('Hai người làm lành.', 'You make up.'), { happy: 8 }, (lf) => { pt.closeness = clamp(pt.closeness + 10); setFlag(lf, 'recent_intimate'); }, null, 0.8),
        oc(L(`${name} đẩy bạn ra: "Đừng nghĩ cách đó giải quyết được mọi thứ."`, `${name} pushes you away: "Don't think that fixes everything."`), { happy: -5 }, () => { pt.closeness = clamp(pt.closeness - 8); }, null, 0.2),
      ] },
      { label: L('Cãi lại', 'Argue back'), outcomes: [oc(L('Cửa đóng sầm. Bạn ngủ sofa.', 'The door slams. You sleep on the sofa.'), { happy: -6 }, () => { pt.closeness = clamp(pt.closeness - 12); })] },
    ]);
  }
  if (s === 'ix_baby') {
    const p = byId(life, item.id);
    if (!p || !p.alive || !p.baby) return null;
    const name = nm(life, p);
    if (item.kind === 'raise') return sev('sys/ix_baby_raise', L(`${name} gợi ý muốn tăng trợ cấp: "Giá cả dạo này đắt quá."`, `${name} hints at a raise: "Everything's so expensive lately."`), [
      { label: L('Tăng gấp rưỡi', 'Raise it by half'), outcomes: [oc(L(`${name} ôm cổ bạn, thơm má.`, `${name} throws their arms around you.`), { happy: 4 }, () => { p.allow = Math.round(p.allow * 1.5); p.closeness = clamp(p.closeness + 8); })] },
      { label: L('Từ chối', 'Refuse'), outcomes: [
        oc(L(`${name} hờn vài hôm rồi thôi.`, `${name} sulks for a few days, then lets it go.`), {}, () => { p.closeness = clamp(p.closeness - 6); }, null, 0.6),
        oc(L(`${name} tìm được người hào phóng hơn và rời đi.`, `${name} finds someone more generous and leaves.`), { happy: -5 }, (lf) => { p.baby = false; endLover(lf, p); }, null, 0.4),
      ] },
    ]);
    if (item.kind === 'photo') return sev('sys/ix_baby_photo', L(`${name} đăng ảnh món quà bạn tặng, và góc ảnh có... tay bạn đeo đồng hồ quen thuộc.`, `${name} posts your gift, and in the corner of the photo is... your very recognisable watch.`), [
      { label: L('Bảo xóa ngay', 'Tell them to delete it'), outcomes: [
        oc(L('Xóa kịp trước khi ai để ý.', 'Deleted before anyone noticed.'), {}, null, null, 0.65),
        oc(L('Người yêu bạn đã chụp màn hình.', 'Your partner already took a screenshot.'), { happy: -6 }, (lf) => lf.queue.unshift({ sys: 'affair_exposed' }), null, 0.35),
      ] },
      { label: L('Kệ, chẳng ai để ý đâu', 'Leave it, nobody will notice'), outcomes: [
        oc(L('Đúng là chẳng ai để ý.', 'Nobody does.'), {}, null, null, 0.5),
        oc(L('Có người để ý. Là người yêu bạn.', 'Somebody notices. Your partner.'), { happy: -6 }, (lf) => lf.queue.unshift({ sys: 'affair_exposed' }), null, 0.5),
      ] },
    ]);
    return sev('sys/ix_baby_public', L(`${name} nói nhỏ: "Mình muốn được công khai. Không chỉ là thỏa thuận nữa."`, `${name} says quietly: "I want to be public. Not just an arrangement anymore."`), [
      { label: L('Công khai, thành người yêu chính thức', 'Go public, make it official'), outcomes: [oc(L('Bức ảnh đầu tiên của hai người được đăng lên. Hàng nghìn bình luận.', 'Your first photo together goes up. Thousands of comments.'), { happy: 8 }, (lf) => { p.baby = false; p.allow = 0; const pt = partner(lf); if (pt && pt !== p) { /* vẫn là người tình nếu đang có người yêu */ } else { p.role = 'partner'; p.years = 0; lf.counts.partners++; syncAffair(lf); } me(lf).scandal = clamp(me(lf).scandal + 6); })] },
      { label: L('Giữ như cũ', 'Keep things as they are'), outcomes: [oc(L(`${name} gật đầu, nhưng ánh mắt buồn hơn.`, `${name} nods, but their eyes are sadder.`), {}, () => { p.closeness = clamp(p.closeness - 6); })] },
    ]);
  }
  if (s === 'ix_fated') return fatedEvent(life, item, adult);
  return null;
}

// Mục 23 · Đêm định mệnh (kịch bản rẽ nhánh 2 bước)
function fatedPerson(life, item) {
  if (item.pid) { const p = byId(life, item.pid); if (p && adultOK(life, p)) return p; }
  let p;
  if (item.id === 'oneroom' || item.id === 'enemies') p = findOrMake(life, ['rival', 'coworker'], () => freshAdult(life, item.id === 'enemies' ? 'rival' : 'coworker', life.age + randint(life, -5, 5)));
  else if (item.id === 'elevator' || item.id === 'wedding') p = findOrMake(life, ['ex'], () => freshAdult(life, 'ex', life.age + randint(life, -4, 4)));
  else p = freshAdult(life, 'contact', life.age + randint(life, -1, 1), { firstLove: true });
  if (item.id === 'oneroom' || item.id === 'enemies') p.att = p.att && p.att !== 'neutral' ? p.att : 'rival';
  item.pid = p.id;
  return p;
}
function fatedEvent(life, item, adult) {
  const p = fatedPerson(life, item);
  if (!p) return null;
  const name = nm(life, p);
  const x = prof(p);
  const step2 = (lf) => lf.queue.unshift({ sys: 'ix_fated', id: item.id, step: 2, pid: p.id });
  const together = (lf) => { romance(lf, p); p.att = 'like'; x.fire = clamp(x.fire + 30); setFlag(lf, 'recent_intimate'); };
  const T = {
    oneroom: [
      L(`Đi công tác cùng ${name}, đối thủ ở công ty. Khách sạn chỉ còn một phòng, một giường.`, `A work trip with ${name}, your office rival. The hotel has one room left. One bed.`),
      [
        { label: L('Chia đôi giường, đặt gối ở giữa', 'Share the bed, pillow wall in the middle'), outcomes: [oc(L('Bức tường gối được dựng lên rất nghiêm túc.', 'The pillow wall is constructed with great seriousness.'), {}, step2)] },
        { label: L('Bạn ngủ sofa', 'You take the sofa'), outcomes: [oc(L(`Sáng ra ${name} đắp chăn cho bạn từ lúc nào.`, `In the morning you find ${name} put a blanket over you.`), { happy: 3 }, () => { x.fire = clamp(x.fire + 12); p.closeness = clamp(p.closeness + 8); })] },
        { label: L('Đi tìm khách sạn khác', 'Find another hotel'), outcomes: [oc(L('Bạn đi bộ nửa thành phố lúc nửa đêm.', 'You walk half the city at midnight.'), { happy: -3, money: -5 })] },
      ],
      L('Nửa đêm, chiếc gối ở giữa biến mất lúc nào không hay.', 'At midnight, the pillow wall has quietly vanished.'),
      [
        { label: L('Để yên', 'Leave it'), outcomes: [oc(adult ? L(`Hơi thở ${name} sát bên tai. Sáng hôm sau, cuộc họp với khách hàng bị dời sang chiều.`, `${name}'s breath against your ear. The next morning's client meeting gets moved to the afternoon.`) : L('Hai người nắm tay nhau ngủ.', 'You fall asleep holding hands.'), { happy: 14 }, together)] },
        { label: L('Đặt gối lại chỗ cũ', 'Put the pillow back'), outcomes: [oc(L('Chưa phải lúc. Nhưng cả hai đều biết điều gì đó đã thay đổi.', 'Not yet. But you both know something has changed.'), { willpower: 3 }, () => { x.fire = clamp(x.fire + 25); p.att = 'crush'; })] },
        { label: L('Bật đèn, nói chuyện thẳng thắn', 'Turn on the light and talk'), outcomes: [oc(L('Hai người nói chuyện đến sáng. Từ đối thủ thành đồng minh.', 'You talk till dawn. From rivals to allies.'), { happy: 6 }, () => { p.att = 'friendly'; p.closeness = clamp(p.closeness + 15); })] },
      ],
    ],
    elevator: [
      L(`Mất điện. Bạn kẹt trong thang máy với ${name}, người cũ, suốt hai tiếng.`, `Power cut. You're stuck in a lift with ${name}, your ex, for two hours.`),
      [
        { label: L('Nhắc lại chuyện cũ', 'Bring up the past'), outcomes: [oc(L('Những kỷ niệm ùa về trong bóng tối.', 'The memories flood back in the dark.'), {}, step2)] },
        { label: L('Im lặng nghịch điện thoại', 'Stare at your phone'), outcomes: [oc(L('Hai tiếng dài nhất đời bạn.', 'The longest two hours of your life.'), { happy: -2 })] },
        { label: L('Cùng hát cho đỡ sợ', 'Sing together to stay calm'), outcomes: [oc(L('Hai người hát hết album yêu thích hồi còn yêu nhau. Cười đến đau bụng.', 'You sing the whole album you loved as a couple. You laugh until it hurts.'), { happy: 6 }, () => { p.closeness = clamp(p.closeness + 12); })] },
      ],
      L(`${name} hỏi nhỏ: "Nếu ngày đó mình không chia tay...?"`, `${name} asks softly: "What if we hadn't broken up...?"`),
      [
        { label: L('Hôn họ', 'Kiss them'), outcomes: [oc(adult ? L('Đèn sáng lại. Hai người vẫn chưa buông nhau ra.', 'The lights come back. You still haven\'t let go of each other.') : L('Đèn sáng lại. Hai người nắm tay bước ra.', 'The lights come back. You step out holding hands.'), { happy: 12 }, together)] },
        { label: L('Nói lời xin lỗi thật lòng', 'Say a real sorry'), outcomes: [oc(L('Cuối cùng cũng có một cái kết tử tế.', 'At last, a decent ending.'), { happy: 6, karma: 4 }, () => { p.closeness = clamp(p.closeness + 20); p.att = 'friendly'; })] },
        { label: L('Đúng lúc đó, đèn sáng', 'Right then, the lights come on'), outcomes: [oc(L('Cửa mở ra trước mặt một đám đông đang chờ. Câu hỏi bỏ ngỏ.', 'The doors open on a waiting crowd. The question hangs.'), {}, () => { x.fire = clamp(x.fire + 20); p.att = 'crush'; })] },
      ],
    ],
    wedding: [
      L(`Ở đám cưới của ${name}, giữa tiệc, họ kéo bạn ra một góc: "Mình vẫn chưa quên."`, `At ${name}'s wedding, mid-reception, they pull you aside: "I still haven't forgotten."`),
      [
        { label: L('Bỏ trốn cùng họ', 'Run away with them'), outcomes: [oc(L('Một chiếc xe hoa chạy mất, cô dâu chú rể chỉ còn một người. Cả thành phố bàn tán.', 'A wedding car speeds off with one half of the couple. The whole town talks.'), { happy: 10, karma: -8 }, (lf) => { together(lf); me(lf).scandal = clamp(me(lf).scandal + 15); })] },
        { label: L('Chúc phúc và rời đi', 'Wish them well and leave'), outcomes: [oc(L('Bạn nâng ly chúc mừng rồi lặng lẽ về.', 'You raise a toast and slip away.'), { karma: 5, willpower: 3 })] },
        { label: L('Hẹn sau tuần trăng mật', 'Say: after the honeymoon'), outcomes: [oc(L('Một ánh nhìn, một lời hẹn không thành tiếng.', 'A look, an unspoken promise.'), { happy: 3 }, () => { p.att = 'affair'; x.fire = clamp(x.fire + 25); })] },
      ],
    ],
    enemies: [
      L(`Ba năm cãi nhau với ${name}. Một đêm mưa, cả hai trú chung dưới một mái hiên.`, `Three years of fighting with ${name}. One rainy night you end up under the same awning.`),
      [
        { label: L('Cãi tiếp cho đỡ lạnh', 'Keep arguing to stay warm'), outcomes: [oc(L('Cãi đến hết mưa. Lạ là chẳng ai muốn về.', 'You argue until the rain stops. Oddly, neither of you wants to leave.'), { happy: 2 }, () => { x.fire = clamp(x.fire + 15); })] },
        { label: L('Chia nhau chiếc ô', 'Share your umbrella'), outcomes: [oc(L('Chiếc ô quá nhỏ cho hai người. Vai chạm vai.', 'The umbrella is too small for two. Shoulders touch.'), {}, step2)] },
        { label: L('Mời về nhà uống trà', 'Invite them in for tea'), outcomes: [oc(L('Ấm trà nguội từ lúc nào.', 'The tea goes cold without anyone noticing.'), {}, step2)] },
      ],
      L('Hết mưa rồi. Không ai nói lời tạm biệt.', 'The rain has stopped. Nobody says goodbye.'),
      [
        { label: L('Ở lại', 'Stay'), outcomes: [oc(adult ? L('Ba năm căng thẳng tan biến trong một đêm.', 'Three years of tension melt away in one night.') : L('Hai người bắt đầu hẹn hò, ai cũng sốc.', 'You start dating. Everyone is shocked.'), { happy: 15 }, together)] },
        { label: L('Chỉ đứng nhìn nhau', 'Just look at each other'), outcomes: [oc(L('Lửa cháy âm ỉ. Chưa ai dám bước tiếp.', 'A slow burn. Neither dares take the step yet.'), {}, () => { x.fire = 90; p.att = 'crush'; })] },
        { label: L('Về nhà', 'Go home'), outcomes: [oc(L('Từ nay hai người cãi nhau nhẹ nhàng hơn hẳn.', 'From now on your arguments are much gentler.'), { happy: 3 }, () => { p.att = 'like'; p.closeness = clamp(p.closeness + 10); })] },
      ],
    ],
    reunion: [
      L(`Họp lớp 20 năm. ${name}, mối tình đầu, vẫn cười như ngày xưa.`, `Your 20-year reunion. ${name}, your first love, still has the same smile.`),
      [
        { label: L('Ngồi cạnh nói chuyện cả tối', 'Sit together all night'), outcomes: [oc(L('Hai mươi năm gói gọn trong một buổi tối.', 'Twenty years fit into a single evening.'), {}, step2)] },
        { label: L('Chỉ chào xã giao', 'Just say hello'), outcomes: [oc(L('Một cái gật đầu, một nụ cười. Thế là đủ.', 'A nod, a smile. That\'s enough.'))] },
        { label: L('Hát karaoke bài hát cũ', 'Sing your old song at karaoke'), outcomes: [oc(L('Cả lớp hò reo. Hai người đỏ mặt như năm 17 tuổi.', 'The whole class cheers. You both blush like you\'re seventeen.'), { happy: 6 }, () => { x.fire = clamp(x.fire + 20); p.closeness = clamp(p.closeness + 10); })] },
      ],
      L(`Tan tiệc, ${name} hỏi: "Đi dạo một chút nhé?"`, `As the party ends, ${name} asks: "Walk for a bit?"`),
      [
        { label: L('Đi', 'Go'), outcomes: [oc(adult ? L('Con đường cũ, cổng trường cũ, và một nụ hôn trễ hai mươi năm.', 'The old road, the old school gate, and a kiss twenty years late.') : L('Con đường cũ, cổng trường cũ.', 'The old road, the old school gate.'), { happy: 12 }, together)] },
        { label: L('Trao số điện thoại', 'Swap numbers'), outcomes: [oc(L('Một tin nhắn "về đến nhà chưa?" lúc nửa đêm.', 'A midnight "home safe?" text.'), { happy: 4 }, () => { p.att = 'crush'; x.fire = clamp(x.fire + 30); })] },
        { label: L('Tạm biệt', 'Say goodbye'), outcomes: [oc(L('Có những người chỉ nên ở lại trong ký ức.', 'Some people belong in memory.'), { happy: -2 })] },
      ],
    ],
  }[item.id];
  if (!T) return null;
  const step = item.step === 2 && T[2] ? 2 : 0;
  return sev(`sys/ix_fated_${item.id}_${step}`, T[step], T[step + 1]);
}

// Mục 3, 4, 6 · Cảnh gần gũi 25+: địa điểm, đêm đầu tiên, độ hợp
export function intimateScene25(life, st, p, closer) {
  const name = nm(life, p);
  const x = prof(p);
  const go = (place) => (protect) => ({
    chance: 1, effects: { happy: 8 },
    text: !x.first
      ? (x.chem + (p.skill ?? 50) / 2 > 100 ? L(`Đêm đầu tiên với ${name}: hồi hộp, rồi hoàn hảo đến khó tin.`, `Your first night with ${name}: nervous, then unbelievably perfect.`) : x.chem > 50 ? L(`Đêm đầu tiên với ${name}: vụng về, nhiều tiếng cười, và rất ngọt.`, `Your first night with ${name}: clumsy, lots of laughs, very sweet.`) : L(`Đêm đầu tiên với ${name}: hơi ngượng, cả hai cần thêm thời gian để hiểu nhau.`, `Your first night with ${name}: a bit awkward. You both need time to learn each other.`))
      : place.text,
    run: (lf) => {
      x.first = true;
      closer(lf, p, 4, 10);
      setFlag(lf, 'recent_intimate');
      tryConceive(lf, p, protectChance(protect));
      x.fire = clamp(x.fire + 3);
      lf.stats.happy = clamp(lf.stats.happy + Math.round(((p.skill ?? 50) - 50) / 12 + (p.gender === 'male' ? ((p.size ?? 50) - 50) / 25 : 0) + (x.chem - 50) / 15));
      if (place.after) place.after(lf);
    },
  });
  const places = [
    { label: L('Ở nhà, chậm rãi', 'At home, slowly'), text: L(`Bạn và ${name} dành cả buổi tối cho nhau, chậm rãi và không vội vàng.`, `You and ${name} spend the whole evening on each other, slow and unhurried.`) },
    { label: L('Khách sạn tình yêu', 'A love hotel'), units: 3, text: L('Phòng có gương trên trần và bồn tắm hình trái tim. Hai người cười suốt.', 'Mirrored ceiling, heart-shaped tub. You laugh the whole time.') },
    { label: L('Bồn tắm', 'The bathtub'), text: L('Nước tràn ra sàn. Không ai bận tâm.', 'Water all over the floor. Nobody cares.') },
    { label: L('Trên ghế sau xe hơi', 'The back seat of the car'), text: L('Kính xe mờ hơi nước. Đúng lúc đó có người gõ cửa kính hỏi đường.', 'The windows fog up. Right then, someone knocks to ask for directions.'), after: (lf) => { me(lf).scandal = clamp(me(lf).scandal + 1); } },
    { label: L('Bãi biển vắng lúc nửa đêm', 'A deserted beach at midnight'), text: L('Sóng, sao, và cát ở những chỗ không ngờ tới.', 'Waves, stars, and sand in unexpected places.') },
    { label: L('Trong bếp', 'The kitchen'), text: L('Nồi canh trào. Bữa tối gọi đồ ăn ngoài.', 'The soup boils over. Dinner is takeaway.') },
  ];
  const rm = me(life).room && ROOMS[me(life).room];
  if (rm) places.unshift({ label: L(`${rm.em} ${rm.name.vi}`, `${rm.em} ${rm.name.en}`), text: L(`${rm.text.vi} Hai người ở trong đó đến sáng.`, `${rm.text.en} You stay in there till morning.`), after: (lf) => { lf.stats.happy = clamp(lf.stats.happy + 4); x.fire = clamp(x.fire + 6); } });
  return {
    event: {
      uid: 'ix/intimate', text: L(`Bạn muốn gần gũi với ${name}. Ở đâu?`, `You want some intimacy with ${name}. Where?`),
      choices: places.map((pl) => ({ label: pl.label, outcomes: [oc('', pl.units ? { money: -pl.units } : {}, null, () => ({ uid: 'ix/protect', text: L('Biện pháp?', 'Protection?'), choices: [{ label: L('Dùng biện pháp', 'Use protection'), outcomes: [go(pl)(true)] }, { label: L('Không dùng', 'Skip it'), outcomes: [go(pl)(false)] }] }))] })),
    },
  };
}

// ───────── Tang lễ tiết lộ (mục 28) và kế thừa ─────────
export function funeral(life) {
  if (life.age < 18) return;
  const lines = [];
  const secret = life.people.filter((p) => p.alive && p.age >= 18 && (p.role === 'lover' || (p.wasLover && p.role === 'ex')));
  life.counts.funeralLovers = secret.length;
  if (secret.length) lines.push(L(`Ở đám tang, ${secret.length} người lạ lặng lẽ đứng cuối hàng. Gia đình không ai biết họ là ai.`, `At the funeral, ${secret.length} strangers stand quietly at the back. Nobody in the family knows who they are.`));
  const cur = lovers(life);
  if (cur.length && life.money > 0) {
    const share = life.money * 0.1;
    life.money -= share;
    for (const p of cur) p.wealth = (p.wealth || 0) + share / cur.length;
    lines.push(L('Di chúc để lại một khoản cho "một người bạn". Luật sư từ chối tiết lộ danh tính.', 'The will leaves a sum to "a friend". The lawyer refuses to say who.'));
  }
  const untouched = life.people.find((p) => adultOK({ age: 99 }, p) && p.ix && p.ix.fire >= 70 && !p.wasLover && !ROM.includes(p.role));
  if (untouched) lines.push(L(`Một bó hoa không đề tên. Tấm thiệp chỉ ghi: "Người tôi chưa từng chạm." Đó là ${nm(life, untouched)}.`, `A bouquet with no name. The card reads: "The one I never touched." It was ${nm(life, untouched)}.`));
  if (life.ix && life.ix.memoir) lines.push(L('Cuốn "Sổ đen" bán hết sạch trong tuần lễ tang.', '"The Little Black Book" sells out the week of the funeral.'));
  life.funeral = lines;
  for (const l of lines) addLog(life, l);
}

/** Đời mới (con) kế thừa bí mật của đời trước. */
export function inheritSecrets(old, life, kid) {
  const notes = [];
  const sibs = life.people.filter((p) => p.role === 'sibling');
  let half = 0;
  for (const s of sibs) if (s.otherParentId && kid.otherParentId && s.otherParentId !== kid.otherParentId) { s.role = 'half'; half++; }
  if (half) notes.push(L(`Ở đám tang, bạn mới biết mình có ${half} anh chị em cùng cha/mẹ khác.`, `At the funeral you learn you have ${half} half-sibling${half > 1 ? 's' : ''}.`));
  const ol = old.people.filter((p) => p.alive && p.age >= 18 && (p.role === 'lover' || p.wasLover) && p.id !== kid.otherParentId);
  if (ol.length) {
    const p = { ...ol[0], role: 'contact', closeness: 30, att: 'friendly' };
    delete p.ix; delete p.counted; delete p.wasLover; delete p.baby;
    life.people.push(p);
    notes.push(L(`Bạn gặp ${personName(old, p)}, người từng là bí mật của ${old.first}. Họ kể những chuyện bạn chưa từng biết.`, `You meet ${personName(old, p)}, once ${old.first}'s secret. They tell you things you never knew.`));
  }
  for (const n of notes) addLog(life, n);
}

// ───────── God Mode ─────────
export function godIxPerson(life, p, vals) {
  if (vals.firm != null) p.firm = clamp(Number(vals.firm));
  if (vals.att) setAtt(life, p, vals.att);
  if (p.age < 18) return;
  const x = prof(p);
  for (const k of ['chem', 'fire', 'libido', 'flex', 'sincere', 'jeal']) if (vals[k] != null) x[k] = clamp(Number(vals[k]));
  if (vals.knows != null) x.knows = !!vals.knows;
  if (vals.fav !== undefined) x.fav = vals.fav === '' || vals.fav == null ? null : clamp(Number(vals.fav), 0, POSITIONS.length - 1);
  if (vals.kinks) {
    x.kinks = []; x.limits = [];
    for (const [id, v] of Object.entries(vals.kinks)) { if (!kinkById[id]) continue; if (v === 'want') x.kinks.push(id); else if (v === 'never') x.limits.push(id); }
  }
  if (vals.reveal) { x.known = [...x.kinks]; x.knownLim = [...x.limits]; }
  else { x.known = x.known.filter((k) => x.kinks.includes(k)); x.knownLim = x.knownLim.filter((k) => x.limits.includes(k)); }
}
export function godIxSelf(life, v) {
  const m = me(life);
  for (const k of ['libido', 'flex', 'charm', 'loyal', 'scandal']) if (v[k] != null) m[k] = clamp(Number(v[k]));
  if (Array.isArray(v.chest)) m.chest = v.chest.filter((k) => CHEST[k]);
  if (v.allPos) m.pos = POSITIONS.map((_, i) => i);
  if (v.club != null) m.club = !!v.club;
  if (v.rope != null) m.rope = !!v.rope;
}
