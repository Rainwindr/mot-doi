// Nghề đặc biệt (diễn viên, ca sĩ, vận động viên) và mạng xã hội. Mỗi nghề có thang bậc, hành động và biến cố riêng.
import { L, clamp, rand, chance, randint, pick } from './util.js';
import { country, addLog, milestone } from './life.js';
import { applyEffects } from './events.js';

const res = (text, changes = [], tone) => ({ text, changes, tone });
const fx = (life, e) => applyEffects(life, e);

export const SPECIALS = {
  actor: {
    em: '🎬', name: L('Diễn viên', 'Actor'), stat: 'looks', req: 50, minAge: 16, maxAge: 70,
    levels: [L('Diễn viên quần chúng', 'Extra'), L('Diễn viên phụ', 'Supporting actor'), L('Diễn viên chính', 'Lead actor'), L('Ngôi sao hạng A', 'A-list star')],
    pay: [0.5, 1.6, 5, 20],
    join: L('Đi thử vai', 'Go to an audition'), big: L('Casting vai lớn hơn', 'Audition for a bigger role'), train: L('Học diễn xuất', 'Take acting classes'), promo: L('Lên talk show', 'Go on a talk show'),
  },
  musician: {
    em: '🎤', name: L('Ca sĩ', 'Singer'), stat: 'happy', req: 30, minAge: 14, maxAge: 75,
    levels: [L('Hát đường phố', 'Busker'), L('Ca sĩ phòng trà', 'Lounge singer'), L('Ca sĩ có bản hit', 'Hitmaker'), L('Siêu sao', 'Superstar')],
    pay: [0.3, 1.2, 6, 24],
    join: L('Đi thử giọng', 'Go to a singing audition'), big: L('Phát hành bài hát mới', 'Release a new single'), train: L('Luyện thanh', 'Vocal training'), promo: L('Đi tour', 'Go on tour'),
  },
  athlete: {
    em: '⚽', name: L('Vận động viên', 'Athlete'), stat: 'health', req: 70, minAge: 16, maxAge: 28, retire: 37,
    levels: [L('Cầu thủ dự bị', 'Bench player'), L('Cầu thủ chính thức', 'Starter'), L('Ngôi sao đội tuyển', 'National team star'), L('Huyền thoại', 'Legend')],
    pay: [1, 3, 10, 25],
    join: L('Đi thử việc ở câu lạc bộ', 'Try out for a club'), big: L('Thi đấu trận lớn', 'Play a big match'), train: L('Tập luyện cường độ cao', 'Train hard'), promo: L('Ký hợp đồng quảng cáo', 'Sign an endorsement deal'),
  },
  adult_actor: {
    em: '🔞', adult: true, name: L('Diễn viên phim người lớn', 'Adult film performer'), stat: 'looks', req: 55, minAge: 21, maxAge: 50,
    levels: [L('Diễn viên mới', 'Newcomer'), L('Diễn viên hợp đồng', 'Contract performer'), L('Ngôi sao phim người lớn', 'Adult film star'), L('Huyền thoại trong ngành', 'Industry legend')],
    pay: [0.8, 2, 6, 15],
    join: L('Đi thử vai ở studio phim người lớn', 'Audition at an adult film studio'), big: L('Ký hợp đồng với studio lớn hơn', 'Sign with a bigger studio'), train: L('Tập gym, chăm sóc ngoại hình', 'Gym and self-care'), promo: L('Mở trang fan trả phí', 'Run a paid fan page'),
    fail: L('Studio lớn chọn một gương mặt mới hơn. Ngành này thay người nhanh hơn bạn nghĩ.', 'The big studio picks a fresher face. This industry moves faster than you think.'),
    promoText: L('Trang fan trả phí của bạn có thêm vài nghìn người đăng ký. Hộp thư đầy những lời tỏ tình kỳ quặc.', 'Your paid fan page gains a few thousand subscribers. Your inbox fills with strange declarations of love.'), promoPay: 18,
  },
  adult_director: {
    em: '🎥', adult: true, name: L('Đạo diễn phim người lớn', 'Adult film director'), stat: 'smarts', req: 45, minAge: 23, maxAge: 70,
    levels: [L('Quay phim tự do', 'Freelance shooter'), L('Đạo diễn studio nhỏ', 'Indie studio director'), L('Đạo diễn có giải thưởng', 'Award-winning director'), L('Chủ studio', 'Studio owner')],
    pay: [0.7, 2, 5, 18],
    join: L('Nhận quay cho một studio phim người lớn', 'Take a job shooting for an adult studio'), big: L('Sản xuất một phim lớn', 'Produce a big feature'), train: L('Học quay dựng, ánh sáng', 'Study cinematography and lighting'), promo: L('Dự lễ trao giải của ngành', 'Attend the industry awards'),
    fail: L('Phim mới bị chê "kịch bản nhiều hơn mức cần thiết". Doanh thu thấp.', 'The new film is panned for "more plot than anyone asked for". Low sales.'),
    promoText: L('Bạn lên sân khấu nhận giải. Bài phát biểu cảm ơn đoàn phim, luật sư và người giữ hợp đồng đồng thuận.', 'You take the stage to accept an award, thanking the crew, the lawyers and the consent coordinator.'), promoPay: 12,
  },
};

/** Có thể thử sức nghề này không (tuổi, đang ở tù...). */
export function canJoin(life, id, settings) {
  const s = SPECIALS[id];
  if (s.adult && !(settings && settings.adult25)) return false;
  return !life.special && !life.prison && life.age >= s.minAge && life.age <= s.maxAge;
}

export function specialAction(life, act, id, settings) {
  if (life.dead || life.prison) return null;
  const key = `sp:${act}`;
  const n = (life.yearActs[key] = (life.yearActs[key] || 0) + 1);
  const tired = res(L('Năm nay như vậy là đủ rồi.', "That's enough for this year."), []);
  if (act === 'join') {
    const s = SPECIALS[id];
    if (!s || !canJoin(life, id, settings)) return res(L('Bạn chưa thể thử sức nghề này.', "You can't try this career right now."), [], 'bad');
    if (life.job) return res(L('Hãy nghỉ công việc hiện tại trước.', 'Quit your current job first.'), []);
    if (n > 1) return tired;
    const v = life.stats[s.stat];
    const p = clamp(0.2 + (v - s.req) / 60 + life.stats.fame / 300 + (id === 'adult_director' && 'adult_past' in life.flags ? 0.25 : 0), 0.03, 0.85);
    if (!chance(life, p)) return res(pick(life, [L('Ban giám khảo cảm ơn bạn đã đến. Đó là cách họ nói "không".', 'The panel thanks you for coming. That\'s how they say no.'), L('Họ nói bạn "chưa đúng hình mẫu". Bạn không biết hình mẫu là gì.', 'They say you\'re "not quite the look". Nobody explains the look.')]), fx(life, { happy: -5 }), 'bad');
    life.special = { id, level: 0, perf: 50, years: 0 };
    if (s.adult) {
      life.flags.adult_past = life.age;
      for (const role of ['mother', 'father']) for (const q of life.people) if (q.role === role && q.alive) q.closeness = clamp(q.closeness - randint(life, 5, 15));
      const pt = life.people.find((q) => q.alive && ['partner', 'spouse'].includes(q.role));
      if (pt) pt.closeness = clamp(pt.closeness - randint(life, 0, 12));
    }
    milestone(life, L(`Bước vào nghề ${s.name.vi.toLowerCase()}`, `Started a career as ${s.name.en.toLowerCase()}`), 'good');
    return res(L(`Bạn được nhận! Giờ bạn là ${s.levels[0].vi.toLowerCase()}.`, `You're in! You're now a ${s.levels[0].en.toLowerCase()}.`), fx(life, { happy: 12, fame: 3 }), 'good');
  }
  const sp = life.special;
  if (!sp) return null;
  const s = SPECIALS[sp.id];
  const top = s.levels.length - 1;
  switch (act) {
    case 'train':
      if (n > 2) return tired;
      sp.perf = clamp(sp.perf + randint(life, 7, 14));
      return res(pick(life, [L('Bạn tập đến kiệt sức. Huấn luyện viên gật đầu một lần.', 'You train until you drop. Your coach nods once.'), L('Buổi tập hôm nay tốt hơn hôm qua. Đó là tất cả những gì cần.', 'Better than yesterday. That\'s all it takes.')]), fx(life, sp.id === 'athlete' ? { health: 3, willpower: 2 } : sp.id === 'actor' || sp.id === 'adult_actor' ? { looks: 1, health: 1 } : sp.id === 'adult_director' ? { smarts: 2 } : { happy: 2, willpower: 2 }));
    case 'big': {
      if (n > 1) return tired;
      if (sp.level >= top) {
        sp.perf = clamp(sp.perf + 4);
        return res(L('Bạn đã ở đỉnh cao. Mỗi dự án mới chỉ để giữ vững vị trí.', "You're at the top. Each new project just keeps you there."), fx(life, { fame: 2, money: 30 }), 'good');
      }
      const viral = sp.id === 'musician' && chance(life, 0.08);
      const p = clamp(0.15 + sp.perf / 220 + life.stats.fame / 400 - sp.level * 0.07 + (life.stats[s.stat] - s.req) / 200, 0.04, 0.8);
      if (viral || chance(life, p)) {
        sp.level = Math.min(top, sp.level + (viral ? 2 : 1));
        sp.perf = clamp(sp.perf - 10);
        if (sp.level === top) milestone(life, L(`Trở thành ${s.levels[top].vi.toLowerCase()}`, `Became a ${s.levels[top].en.toLowerCase()}`), 'good');
        const t = viral ? L(`Bài hát của bạn bất ngờ viral khắp mạng! Bạn nhảy thẳng lên ${s.levels[sp.level].vi.toLowerCase()}.`, `Your song goes viral overnight! You jump straight to ${s.levels[sp.level].en.toLowerCase()}.`)
          : L(`Thành công! Bạn lên ${s.levels[sp.level].vi.toLowerCase()}.`, `Success! You're now a ${s.levels[sp.level].en.toLowerCase()}.`);
        return res(t, fx(life, { happy: 12, fame: 6 + sp.level * 4 }), 'good');
      }
      sp.perf = clamp(sp.perf - 5);
      const fail = s.fail || { actor: L('Vai diễn về tay một người có nhiều người theo dõi hơn bạn.', 'The role goes to someone with more followers.'), musician: L('Bài hát mới có 312 lượt nghe. 290 lượt là của mẹ bạn.', 'Your new single gets 312 plays. 290 are your mum.'), athlete: L('Đội bạn thua. Bình luận viên nhắc tên bạn hơi nhiều.', 'Your team loses. The commentators mention you a bit too often.') }[sp.id];
      return res(fail, fx(life, { happy: -5 }), 'bad');
    }
    case 'promo': {
      if (n > 1) return tired;
      if (chance(life, 0.15)) return res(pick(life, [L('Bạn lỡ lời trên sóng trực tiếp. Mạng xã hội có meme mới, và đó là bạn.', 'You misspeak on live TV. The internet has a new meme, and it\'s you.'), L('Một bức ảnh cũ của bạn bị đào lại. Không đẹp.', 'An old photo of you resurfaces. It\'s not great.')]), fx(life, { fame: 3, karma: -3, happy: -6 }), 'bad');
      const pay = (s.promoPay || { actor: 8, musician: 15, athlete: 20 }[sp.id]) * (sp.level + 1);
      const h = sp.id === 'musician' ? -3 : 0;
      if (s.promoText) return res(s.promoText, fx(life, { money: pay, fame: 4 }), 'good');
      return res({ actor: L('Bạn kể chuyện hậu trường. Khán giả cười, MC cười, ê-kíp cười.', 'You tell backstage stories. The audience laughs. The host laughs. Even the crew laughs.'), musician: L('Tour diễn cháy vé. Giọng bạn thì gần cháy.', 'The tour sells out. Your voice nearly burns out too.'), athlete: L('Bạn ký hợp đồng quảng cáo nước tăng lực. Bạn không uống nước tăng lực.', 'You sign with an energy drink brand. You don\'t drink energy drinks.') }[sp.id], fx(life, { money: pay, fame: 4, health: h }), 'good');
    }
    case 'quit':
      addLog(life, L(`Bạn rời nghề ${s.name.vi.toLowerCase()}.`, `You leave your career as ${s.name.en.toLowerCase()}.`));
      life.special = null;
      return res(L('Bạn quyết định dừng lại. Đèn sân khấu tắt.', 'You step away. The lights go down.'), fx(life, { happy: -2 }));
  }
  return null;
}

/** Phần nghề đặc biệt và mạng xã hội trong vòng +1 tuổi. */
export function specialYear(life) {
  const gdp = country(life).gdp;
  const sp = life.special;
  if (sp && !life.prison) {
    const s = SPECIALS[sp.id];
    sp.years++;
    const salary = s.pay[sp.level] * gdp * (0.7 + sp.perf / 200);
    life.money += salary;
    sp.perf = clamp(sp.perf - randint(life, 3, 8));
    const target = 10 + sp.level * 25;
    if (life.stats.fame < target) life.stats.fame = clamp(life.stats.fame + randint(life, 1, 5));
    if (sp.id === 'athlete') {
      if (chance(life, 0.08)) { life.stats.health = clamp(life.stats.health - 12); sp.perf = clamp(sp.perf - 15); addLog(life, L('Bạn chấn thương dây chằng và phải nghỉ nửa mùa giải.', 'You tear a ligament and miss half the season.'), 'bad'); }
      if (life.age >= (s.retire || 99) || life.stats.health < 40) {
        milestone(life, L(`Giải nghệ ở tuổi ${life.age}`, `Retired from sport at ${life.age}`), sp.level >= 2 ? 'good' : undefined);
        life.special = null;
      }
    }
    if (sp.perf < 15 && chance(life, 0.4)) {
      addLog(life, L('Không ai gọi bạn cho dự án mới nữa. Sự nghiệp lặng lẽ khép lại.', 'Nobody calls with new work anymore. The career quietly ends.'), 'bad');
      life.special = null;
    }
  }
  const so = life.social;
  if (so && so.followers > 0) {
    so.followers = Math.max(0, Math.round(so.followers * (0.9 + rand(life) * 0.08)));
    if (so.followers >= 10000) life.money += Math.min(400, so.followers / 4000) * gdp / 100;
  }
}

// ───────── Mạng xã hội ─────────
const fmt = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(n));
export const followersText = (n) => fmt(n || 0);

function gainFollowers(life, base, viralP) {
  const so = (life.social ||= { followers: 0, posts: 0 });
  const before = so.followers;
  const viral = chance(life, viralP);
  let g = Math.round((base + so.followers * (0.02 + rand(life) * 0.1)) * (0.4 + life.stats.looks / 100) * (viral ? 3 + rand(life) * 7 : 1));
  so.followers += g;
  so.posts++;
  life.stats.fame = clamp(Math.max(life.stats.fame, Math.round(Math.log10(so.followers + 1) * 13 - 20)));
  for (const [mark, vi, en] of [[10000, '10 nghìn người theo dõi', '10K followers'], [100000, '100 nghìn người theo dõi', '100K followers'], [1000000, 'Tích xanh: 1 triệu người theo dõi', 'Verified: 1M followers']]) {
    if (before < mark && so.followers >= mark) milestone(life, L(`📱 ${vi}`, `📱 ${en}`), 'good');
  }
  return { viral, g };
}

export function socialAction(life, act) {
  const key = `net:${act}`;
  const n = (life.yearActs[key] = (life.yearActs[key] || 0) + 1);
  if (n > 3) return res(L('Thuật toán bảo bạn nghỉ ngơi đi.', 'The algorithm says take a break.'), []);
  const so = (life.social ||= { followers: 0, posts: 0 });
  switch (act) {
    case 'photo': {
      const { viral, g } = gainFollowers(life, randint(life, 15, 60), 0.05);
      return res(viral ? L(`Ảnh của bạn viral! +${fmt(g)} người theo dõi.`, `Your photo goes viral! +${fmt(g)} followers.`) : pick(life, [L(`Bạn đăng một tấm ảnh chụp lại 41 lần. +${fmt(g)} người theo dõi.`, `You post a photo you retook 41 times. +${fmt(g)} followers.`), L(`Ảnh đồ ăn, ánh sáng đẹp, đồ ăn nguội. +${fmt(g)} người theo dõi.`, `Food pic, great light, cold food. +${fmt(g)} followers.`)]), fx(life, { happy: viral ? 8 : 2 }), viral ? 'good' : undefined);
    }
    case 'video': {
      const { viral, g } = gainFollowers(life, randint(life, 25, 120), 0.08);
      return res(viral ? L(`Video của bạn lên xu hướng! +${fmt(g)} người theo dõi.`, `Your video is trending! +${fmt(g)} followers.`) : pick(life, [L(`Bạn nhảy theo trend mới. +${fmt(g)} người theo dõi, và mẹ bạn bình luận "con nhảy gì vậy".`, `You do the new dance trend. +${fmt(g)} followers, and your mum comments "what is this".`), L(`Video hướng dẫn nấu ăn của bạn có 3 phút nói chuyện trước khi nấu. +${fmt(g)} người theo dõi.`, `Your cooking video has 3 minutes of chat before any cooking. +${fmt(g)} followers.`)]), fx(life, { happy: viral ? 10 : 2, smarts: 1 }), viral ? 'good' : undefined);
    }
    case 'live': {
      if (so.followers < 1000) return res(L('Bạn livestream cho 4 người xem, 2 trong số đó là bot.', 'You go live for 4 viewers. Two are bots.'), fx(life, { happy: -2 }));
      if (chance(life, 0.12)) { so.followers = Math.round(so.followers * 0.85); return res(L('Bạn quên tắt livestream khi đang cãi nhau với người nhà. Mất 15% người theo dõi.', 'You forget to end the stream during a family argument. You lose 15% of followers.'), fx(life, { happy: -8, karma: -2, fame: 2 }), 'bad'); }
      const u = Math.min(150, so.followers / 3000);
      return res(L('Người xem tặng quà ảo liên tục. Bạn cảm ơn từng người bằng giọng hơi mệt.', 'Viewers keep sending virtual gifts. You thank each one in a slightly tired voice.'), fx(life, { money: u, happy: 4 }), 'good');
    }
    case 'sponsor': {
      if (so.followers < 10000) return res(L('Nhãn hàng cần ít nhất 10 nghìn người theo dõi.', 'Brands want at least 10K followers.'), [], 'bad');
      if (n > 1) return res(L('Đăng quảng cáo nhiều quá người theo dõi sẽ bỏ đi.', 'Too many ads and followers will leave.'), []);
      const u = Math.min(500, so.followers / 1500);
      if (chance(life, 0.15)) { so.followers = Math.round(so.followers * 0.92); return res(L('Sản phẩm bạn quảng cáo hóa ra là hàng kém chất lượng. Người theo dõi nổi giận.', 'The product you promoted turns out to be junk. Your followers are furious.'), fx(life, { money: u, karma: -4, happy: -5 }), 'bad'); }
      return res(L('Bạn quay một video quảng cáo kem chống nắng với vẻ mặt chân thành nhất có thể.', 'You film a sunscreen ad with the most sincere face you can manage.'), fx(life, { money: u, happy: 3 }), 'good');
    }
  }
  return null;
}
