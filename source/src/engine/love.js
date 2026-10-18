// Tình cảm: tìm người yêu, tương tác, sống chung, cầu hôn, cưới, ly hôn, con cái, và các diễn biến hằng năm.
// Mọi câu chữ trung tính giới: người kia luôn là "người yêu" / "họ".
import { L, clamp, rand, chance, randint, pick } from './util.js';
import {
  country, unit, partner, spouse, people, byId, randomPerson, enrichAdult, partnerGender, personName, addLog, setFlag, milestone,
  lovers, polyOk, makeLover, endLover, endAllLovers, syncAffair,
} from './life.js';
import { tryConceive, protectChance, breakUp, addChild } from './events.js';
import { netWorth } from './economy.js';
import { agree, intimateScene25, prof } from './intimacy.js';

const res = (text, changes = [], tone) => ({ text, changes, tone });
const u = (life, n) => n * unit(life);
const nm = (life, p) => personName(life, p);
const ROMANTIC = ['partner', 'spouse', 'lover'];

// ───────── Tìm người ─────────
export function candidate(life, kind = 'any') {
  let age = clamp(life.age + randint(life, -6, 6), 18, 95);
  if (kind === 'peer') age = clamp(life.age + randint(life, -2, 2), 18, 95);
  if (kind === 'older') age = clamp(life.age + randint(life, 8, 20), 18, 95);
  if (kind === 'younger') age = clamp(life.age - randint(life, 5, 15), 18, 95);
  const p = randomPerson(life, life, { role: 'contact', gender: partnerGender(life, life), age, closeness: 35 });
  if (kind === 'sugar') enrichAdult(life, life, p, 'sugar');
  if (kind === 'rich') p.wealth = Math.round(p.wealth * 4 + country(life).gdp * 20);
  if (kind === 'smart') p.smarts = clamp(p.smarts + 30);
  if (kind === 'hot') p.looks = clamp(p.looks + 30);
  return p;
}

export function profileLine(life, p) {
  const job = p.job ? p.job : L('Thất nghiệp', 'Unemployed');
  return L(`${p.age} tuổi · ${job.vi} · ngoại hình ${p.looks} · trí tuệ ${p.smarts}`, `${p.age} · ${job.en} · looks ${p.looks} · smarts ${p.smarts}`);
}

/** Xác suất một người đồng ý hẹn hò với bạn. */
function matchChance(life, p) {
  let x = 0.35 + (life.stats.looks - p.looks) / 180 + (life.stats.happy - 50) / 400 + (life.stats.smarts - p.smarts) / 600;
  if (p.sugar) x = 0.15 + (life.stats.looks - 50) / 100 + (life.age < 30 ? 0.15 : -0.1);
  if (life.prison) x -= 0.5;
  return clamp(x, 0.05, 0.92);
}

export function startDating(life, p) {
  if (!life.people.includes(p)) life.people.push(p);
  p.role = 'partner';
  p.closeness = Math.max(p.closeness, 60);
  p.years = 0;
  p.metAge = life.age;
  life.counts.partners++;
  if (p.sugar) life.counts.sugar = (life.counts.sugar || 0) + 1;
}

/** Cảnh xem một hồ sơ, có thể dẫn tới hồ sơ tiếp theo (next). */
function profileScene(life, p, left) {
  const ok = matchChance(life, p);
  const nextOne = left > 0 ? (lf) => profileScene(lf, candidate(lf, p.sugar ? 'sugar' : p._kind || 'any'), left - 1) : null;
  return {
    uid: 'love/profile',
    text: L(`${nm(life, p)}: ${profileLine(life, p).vi}.${p.sugar ? ' Tài sản rất lớn.' : ''}`, `${nm(life, p)}: ${profileLine(life, p).en}.${p.sugar ? ' Extremely wealthy.' : ''}`),
    choices: [
      { label: L('Nhắn tin làm quen', 'Send a message'), outcomes: [
        { chance: ok * 0.88, effects: { happy: 10 }, text: L(`${nm(life, p)} trả lời ngay. Hai người bắt đầu hẹn hò.`, `${nm(life, p)} replies right away. You start dating.`), run: (lf) => startDating(lf, p) },
        { chance: ok * 0.07, effects: { happy: -6 }, text: L('Đến buổi hẹn, người ngồi đó trông khác hẳn ảnh. Bạn vừa bị catfish.', 'At the date, the person waiting looks nothing like their photos. You\'ve been catfished.') },
        { chance: ok * 0.05, effects: { happy: 6 }, text: L(`Hóa ra ${nm(life, p)} làm cùng công ty. Hai người hẹn hò, và thống nhất giấu kín ở văn phòng.`, `Turns out ${nm(life, p)} works at your company. You start dating and agree to keep it quiet at the office.`), run: (lf) => startDating(lf, p) },
        { chance: 1 - ok, effects: { happy: -4 }, text: L('Tin nhắn đã xem nhưng không trả lời.', 'Seen, but no reply.') },
      ] },
      ...(nextOne ? [{ label: L('Vuốt qua người khác', 'Swipe to the next one'), outcomes: [{ chance: 1, effects: {}, text: '', next: nextOne }] }] : []),
      { label: L('Đóng ứng dụng', 'Close the app'), outcomes: [{ chance: 1, effects: {}, text: L('Bạn cất điện thoại đi.', 'You put the phone away.') }] },
    ],
  };
}

/** App hẹn hò: chọn bộ lọc trước, rồi lướt tối đa 3 hồ sơ. */
export function datingApp(life) {
  const filter = (label, kind, need) => ({
    label,
    outcomes: [{
      chance: 1, effects: {}, text: '',
      next: (lf) => {
        if (need && !need(lf)) return { uid: 'love/nomatch', text: L('Không có ai phù hợp với bộ lọc này dành cho bạn.', 'Nobody matches this filter for you.'), choices: [{ label: L('Đóng', 'Close'), outcomes: [{ chance: 1, effects: {}, text: L('Bạn đóng ứng dụng.', 'You close the app.') }] }] };
        const c = candidate(lf, kind);
        c._kind = kind;
        return profileScene(lf, c, 2);
      },
    }],
  });
  return {
    event: {
      uid: 'love/app',
      text: L('Bạn mở ứng dụng hẹn hò. Lọc theo gì?', 'You open a dating app. Filter by what?'),
      choices: [
        filter(L('Bất kỳ ai', 'Anyone'), 'any'),
        filter(L('Ngoại hình nổi bật', 'Great looks'), 'hot'),
        filter(L('Giàu có', 'Wealthy'), 'rich'),
        filter(L('Lớn tuổi hơn nhiều, rất giàu (sugar)', 'Much older and very rich (sugar)'), 'sugar', (lf) => lf.age <= 40 && lf.stats.looks >= 50),
      ],
    },
  };
}

/** Bạn bè giới thiệu: 3 người để chọn. */
export function blindDate(life) {
  const cs = [candidate(life, 'peer'), candidate(life, 'any'), candidate(life, pick(life, ['smart', 'older', 'younger']))];
  return {
    event: {
      uid: 'love/blind',
      text: L('Bạn bè muốn giới thiệu cho bạn một người. Chọn ai?', 'Your friends want to set you up. Who will it be?'),
      choices: cs.map((c) => ({
        label: L(`${nm(life, c)} · ${profileLine(life, c).vi}`, `${nm(life, c)} · ${profileLine(life, c).en}`),
        outcomes: [
          { chance: matchChance(life, c), effects: { happy: 10 }, text: L(`Buổi hẹn với ${nm(life, c)} rất vui. Hai người hẹn hò.`, `The date with ${nm(life, c)} goes great. You start seeing each other.`), run: (lf) => startDating(lf, c) },
          { chance: 1 - matchChance(life, c), effects: { happy: -5 }, text: L(`${nm(life, c)} nói hai người không hợp.`, `${nm(life, c)} says you're not a match.`) },
        ],
      })).concat([{ label: L('Thôi, không đi', 'Skip it'), outcomes: [{ chance: 1, effects: {}, text: L('Bạn ở nhà xem phim.', 'You stay in and watch a film.') }] }]),
    },
  };
}

// ───────── Tương tác với người yêu / vợ chồng ─────────
export function partnerActionList(life, p) {
  if (!p.alive || !ROMANTIC.includes(p.role)) return [];
  const a = [['talk', L('Trò chuyện', 'Talk')], ['compliment', L('Khen ngợi', 'Compliment')], ['flirt', L('Tán tỉnh', 'Flirt')], ['gift', L('Tặng quà', 'Give a gift')], ['date', L('Đi chơi', 'Go on a date')]];
  if (life.age >= 18) a.push(['intimate', L('Gần gũi', 'Be intimate')]);
  if (p.role !== 'lover') {
    if (p.gender !== life.gender) a.push(['baby', L('Cố gắng có con', 'Try for a baby')]);
    if (life.age >= 21) a.push(['adopt', L('Nhận con nuôi', 'Adopt a child')]);
    if (p.wealth > 5 * country(life).gdp) a.push(['askmoney', L('Xin tiền', 'Ask for money')]);
  }
  if (p.role === 'partner') {
    if (!p.cohab) a.push(['movein', L('Rủ về sống chung', 'Ask to move in')]);
    if (!p.engaged) a.push(['propose', L('Cầu hôn', 'Propose')]);
    else a.push(['wedding', L('Tổ chức đám cưới', 'Plan the wedding')]);
    a.push(['breakup', L('Chia tay', 'Break up')]);
  }
  if (p.role === 'spouse') {
    if ((p.married ?? 0) + 5 <= life.age) a.push(['vows', L('Làm mới lời thề', 'Renew vows')]);
    a.push(['divorce', L('Ly hôn', 'Divorce')]);
  }
  if (p.role === 'lover') {
    a.push(['trip', L('Đi du lịch bí mật cùng nhau', 'Take a secret trip together')]);
    a.push(['official', partner(life) ? L('Bỏ người yêu, chọn người này', 'Leave your partner for them') : L('Chính thức hẹn hò', 'Make it official')]);
    a.push(['endaffair', L('Chấm dứt', 'End it')]);
  }
  if (p.role === 'partner' || p.role === 'spouse') {
    if (!polyOk(life)) a.push(['askopen', L('Đề nghị mối quan hệ mở', 'Suggest an open relationship')]);
    else a.push(['closeopen', L('Đóng mối quan hệ mở', 'Close the relationship')]);
    if (lovers(life).length && !polyOk(life)) a.push(['confess', L('Thú nhận chuyện ngoại tình', 'Confess your affairs')]);
  }
  a.push(['argue', L('Cãi nhau', 'Argue')]);
  return a;
}

const closer = (life, p, a, b) => { const d = randint(life, a, b); p.closeness = clamp(p.closeness + d); return d; };

export function partnerAction(life, settings, p, act) {
  const name = nm(life, p);
  const key = `love:${act}:${p.id}`;
  const n = (life.yearActs[key] = (life.yearActs[key] || 0) + 1);
  const tired = res(L('Năm nay như vậy là đủ rồi.', "That's enough for this year."), []);
  switch (act) {
    case 'talk': if (n > 3) return tired; closer(life, p, 2, 6); return res(L(`Bạn và ${name} nói chuyện đến khuya.`, `You and ${name} talk late into the night.`), [['rel_partner', 4]]);
    case 'compliment': {
      if (n > 3) return tired;
      if (p.crazy > 85 && chance(life, 0.3)) { p.closeness = clamp(p.closeness - 5); return res(L(`${name} nghi ngờ: "Khen thế là muốn gì?"`, `${name} is suspicious: "What do you want?"`), [], 'bad'); }
      closer(life, p, 3, 8); return res(L(`${name} đỏ mặt và cười mãi.`, `${name} blushes and can't stop smiling.`), [['rel_partner', 5]]);
    }
    case 'flirt': {
      if (n > 3) return tired;
      if (chance(life, 0.8)) { closer(life, p, 4, 9); life.stats.happy = clamp(life.stats.happy + 3); return res(L(`${name} tán tỉnh lại còn táo bạo hơn.`, `${name} flirts back even harder.`), [['rel_partner', 6], ['happy', 3]], 'good'); }
      return res(L(`${name} đang mệt và không có tâm trạng.`, `${name} is tired and not in the mood.`), []);
    }
    case 'gift': return giftScene(life, p);
    case 'date': return dateScene(life, p);
    case 'intimate': return settings.adult25 && life.age >= 18 && p.age >= 18 ? intimateScene25(life, settings, p, closer) : intimateScene(life, settings, p);
    case 'baby': {
      if (n > 2) return tired;
      if (!tryConceive(life, p, 0.3)) { life.stats.happy = clamp(life.stats.happy - 2); return res(L('Tháng này chưa có tin vui.', 'No luck this month.'), []); }
      setFlag(life, 'recent_intimate');
      return res(L('Hai người đã cố gắng hết sức. Năm sau sẽ biết kết quả.', "You both gave it your all. You'll know next year."), [['rel_partner', 5]], 'good');
    }
    case 'adopt': if (n > 1) return tired; return adoptScene(life, p);
    case 'askmoney': {
      if (n > 1) return tired;
      if (chance(life, agree(life, p, p.closeness / 140 + (p.sugar ? 0.25 : 0)))) {
        const amt = Math.min(p.wealth * 0.05, u(life, p.sugar ? 120 : 30));
        p.wealth -= amt; life.money += amt; p.closeness = clamp(p.closeness - 3);
        return res(L(`${name} chuyển cho bạn một khoản tiền.`, `${name} sends you some money.`), [['money', amt]], 'good');
      }
      p.closeness = clamp(p.closeness - 8);
      return res(L(`${name} nhìn bạn: "Yêu mình hay yêu tiền của mình?"`, `${name} stares: "Do you love me or my money?"`), [], 'bad');
    }
    case 'movein': {
      if (n > 1) return tired;
      if (chance(life, agree(life, p, clamp(p.closeness / 100 - 0.1, 0.05, 0.95), true))) { p.cohab = true; p.closeness = clamp(p.closeness + 6); addLog(life, L(`Bạn và ${name} dọn về sống chung.`, `You and ${name} move in together.`), 'good'); return res(L(`${name} đồng ý! Hai người dọn về sống chung.`, `${name} says yes! You move in together.`), [['happy', 8]], 'good'); }
      p.closeness = clamp(p.closeness - 6); return res(L(`${name} muốn chậm lại một chút.`, `${name} wants to take things slower.`), [], 'bad');
    }
    case 'propose': return proposeScene(life, p);
    case 'wedding': return weddingScene(life, p);
    case 'vows': {
      if (n > 1) return tired;
      if (p.closeness >= 65) { life.money -= u(life, 15); p.closeness = clamp(p.closeness + 12); addLog(life, L(`Bạn và ${name} làm mới lời thề trước bạn bè.`, `You and ${name} renew your vows in front of friends.`), 'good'); return res(L('Một buổi lễ nhỏ, ai cũng rưng rưng.', 'A small ceremony. Not a dry eye in the house.'), [['money', -u(life, 15)], ['happy', 10]], 'good'); }
      p.closeness = clamp(p.closeness - 10); return res(L(`${name} từ chối: "Mình còn chưa giải quyết xong chuyện cũ."`, `${name} refuses: "We haven't sorted out what's wrong yet."`), [], 'bad');
    }
    case 'breakup': breakUp(life, 'choice'); life.stats.happy = clamp(life.stats.happy - 8); return res(L(`Bạn chia tay ${name}.`, `You break up with ${name}.`), [['happy', -8]], 'bad');
    case 'divorce': return divorceScene(life, p);
    case 'endaffair': {
      endLover(life, p);
      life.stats.karma = clamp(life.stats.karma + 3);
      if ((p.crazy ?? 50) > 85 && partner(life) && !polyOk(life) && chance(life, 0.35)) { life.queue.unshift({ sys: 'affair_exposed' }); return res(L(`${name} không chịu buông. Họ nói sẽ cho người yêu bạn biết tất cả.`, `${name} won't let go. They say they'll tell your partner everything.`), [], 'bad'); }
      return res(L(`Bạn chấm dứt với ${name}.`, `You end things with ${name}.`), [['karma', 3]]);
    }
    case 'trip': {
      if (n > 1) return tired;
      life.money -= u(life, 10);
      closer(life, p, 8, 14);
      life.stats.happy = clamp(life.stats.happy + 12);
      setFlag(life, 'recent_intimate');
      tryConceive(life, p, protectChance(settings.alwaysProtect));
      if (partner(life) && !polyOk(life) && chance(life, 0.2)) { life.queue.unshift({ sys: 'affair_exposed' }); return res(L(`Ở resort, bạn chạm mặt một người quen của người yêu mình. Họ đã chụp ảnh.`, `At the resort you bump into a friend of your partner's. They took a photo.`), [['money', -u(life, 10)], ['happy', 12]], 'bad'); }
      return res(settings.adult25 ? L(`Ba ngày ở một thành phố biển với ${name}. Rèm đóng gần như suốt.`, `Three days by the sea with ${name}. The curtains stay closed most of the time.`) : L(`Ba ngày ở một thành phố biển với ${name}.`, `Three days by the sea with ${name}.`), [['money', -u(life, 10)], ['happy', 12]], 'good');
    }
    case 'official': {
      if (chance(life, agree(life, p, clamp(p.closeness / 100 + 0.1, 0.1, 0.95), true))) {
        if (partner(life)) breakUp(life, 'affair');
        p.role = 'partner'; p.closeness = Math.max(p.closeness, 65); p.years = 0; life.counts.partners++;
        syncAffair(life);
        addLog(life, L(`Bạn và ${name} chính thức thành người yêu.`, `You and ${name} become an official couple.`), 'good');
        return res(L(`${name} ôm chầm lấy bạn. Không phải giấu nữa.`, `${name} throws their arms around you. No more hiding.`), [['happy', 10]], 'good');
      }
      p.closeness = clamp(p.closeness - 8);
      return res(L(`${name} lắc đầu: họ thích mọi thứ như bây giờ hơn.`, `${name} shakes their head: they like things as they are.`), [], 'bad');
    }
    case 'askopen': {
      if (n > 1) return tired;
      const pp = agree(life, p, clamp(((p.poly ?? 30) / 100) * 0.85 + p.closeness / 500, 0.03, 0.92), true);
      if (chance(life, pp)) { setFlag(life, 'open_rel'); p.closeness = clamp(p.closeness + 3); addLog(life, L(`Bạn và ${name} đồng ý thử mối quan hệ mở.`, `You and ${name} agree to try an open relationship.`), 'good'); return res(L(`${name} suy nghĩ một lúc rồi gật đầu: "Mình thử, có luật rõ ràng."`, `${name} thinks it over and nods: "Let's try. With clear rules."`), [['happy', 6]], 'good'); }
      p.closeness = clamp(p.closeness - 12);
      if ((p.crazy ?? 50) > 80 && chance(life, 0.3)) { breakUp(life, 'choice'); return res(L(`${name} coi đó là lời chia tay. Họ đi luôn.`, `${name} takes it as a breakup. They leave.`), [['happy', -10]], 'bad'); }
      return res(L(`${name} từ chối thẳng, và nhìn bạn khác đi.`, `${name} says no, and looks at you differently.`), [['happy', -4]], 'bad');
    }
    case 'closeopen':
      delete life.flags.open_rel;
      p.closeness = clamp(p.closeness + ((p.poly ?? 30) > 60 ? -6 : 6));
      if (lovers(life).length) addLog(life, L('Những người yêu phụ giờ lại thành người tình bí mật.', 'Your other partners are secret lovers again.'));
      return res(L('Hai người quay lại chỉ có nhau.', "It's just the two of you again."), []);
    case 'confess':
      life.queue.unshift({ sys: 'affair_exposed', confess: true });
      return res(L('Bạn hít một hơi thật sâu và bắt đầu nói.', 'You take a deep breath and start talking.'), []);
    case 'argue': p.closeness = clamp(p.closeness - randint(life, 6, 14)); life.stats.happy = clamp(life.stats.happy - 3); return res(L(`Bạn và ${name} cãi nhau to đến mức hàng xóm gõ cửa.`, `You and ${name} fight so loudly the neighbours knock.`), [['happy', -3]], 'bad');
  }
  return null;
}

function giftScene(life, p) {
  const g = (label, units, lo, hi) => ({
    label,
    outcomes: [
      { chance: p.crazy > 80 ? 0.6 : 0.9, effects: { money: -units }, text: L(`${nm(life, p)} rất thích món quà.`, `${nm(life, p)} loves the gift.`), run: () => closer(life, p, lo, hi) },
      { chance: p.crazy > 80 ? 0.4 : 0.1, effects: { money: -units }, text: L(`${nm(life, p)} gượng cười. Rõ ràng không thích.`, `${nm(life, p)} forces a smile. They clearly hate it.`), run: () => { p.closeness = clamp(p.closeness - 3); } },
    ],
  });
  return {
    event: {
      uid: 'love/gift', text: L(`Bạn muốn tặng ${nm(life, p)} gì?`, `What will you give ${nm(life, p)}?`),
      choices: [g(L('Bó hoa', 'Flowers'), 1, 3, 6), g(L('Nước hoa', 'Perfume'), 4, 6, 10), g(L('Trang sức', 'Jewellery'), 15, 10, 18), { label: L('Thôi, để dịp khác', 'Maybe another time'), outcomes: [{ chance: 1, effects: {}, text: L('Bạn cất ví đi.', 'You put your wallet away.') }] }],
    },
  };
}

function dateScene(life, p) {
  const d = (label, units, lo, hi, extra) => ({
    label,
    outcomes: [
      { chance: 0.8, effects: { money: -units, happy: 6, ...extra }, text: L(`Một buổi hẹn đáng nhớ với ${nm(life, p)}.`, `A memorable date with ${nm(life, p)}.`), run: () => closer(life, p, lo, hi) },
      { chance: 0.2, effects: { money: -units, happy: -3 }, text: L('Mọi thứ trục trặc từ đầu đến cuối, nhưng cả hai vẫn cười.', 'Everything goes wrong, but you both laugh about it.'), run: () => closer(life, p, 1, 3) },
    ],
  });
  return {
    event: {
      uid: 'love/date', text: L(`Đưa ${nm(life, p)} đi đâu?`, `Where will you take ${nm(life, p)}?`),
      choices: [d(L('Đi dạo công viên', 'A walk in the park'), 0, 3, 6, { health: 1 }), d(L('Xem phim', 'The cinema'), 1, 4, 7), d(L('Nhà hàng sang trọng', 'A fancy restaurant'), 5, 6, 11), d(L('Cuối tuần đi biển', 'A weekend at the beach'), 15, 10, 16, { health: 2 })],
    },
  };
}

function intimateScene(life, settings, p) {
  const go = (protect) => ({
    chance: 1, effects: { happy: 8 },
    text: settings.adult25
      ? L(`Bạn và ${nm(life, p)} dành cả buổi tối cho nhau, chậm rãi và không vội vàng.`, `You and ${nm(life, p)} spend the whole evening on each other, slow and unhurried.`)
      : L(`Bạn và ${nm(life, p)} có một buổi tối riêng tư bên nhau.`, `You and ${nm(life, p)} share a private evening together.`),
    run: (lf) => { closer(lf, p, 4, 10); setFlag(lf, 'recent_intimate'); tryConceive(lf, p, protectChance(protect)); lf.stats.happy = clamp(lf.stats.happy + Math.round(((p.skill ?? 50) - 50) / 12 + (p.gender === 'male' ? ((p.size ?? 50) - 50) / 25 : 0))); },
  });
  return { event: { uid: 'love/intimate', text: L(`Bạn muốn gần gũi với ${nm(life, p)}.`, `You want some intimacy with ${nm(life, p)}.`), choices: [{ label: L('Dùng biện pháp', 'Use protection'), outcomes: [go(true)] }, { label: L('Không dùng biện pháp', 'Skip protection'), outcomes: [go(false)] }] } };
}

function adoptScene(life, p) {
  return {
    event: {
      uid: 'love/adopt', text: L(`Bạn và ${nm(life, p)} đến trung tâm nhận con nuôi. Chi phí giấy tờ khá lớn.`, `You and ${nm(life, p)} visit an adoption agency. The paperwork is expensive.`),
      choices: [
        { label: L('Nhận nuôi một em bé', 'Adopt a baby'), outcomes: [
          { chance: 0.75, effects: { money: -25, happy: 12 }, text: L('Hồ sơ được duyệt. Gia đình có thêm thành viên.', 'Approved. Your family grows.'), run: (lf) => { const k = addChild(lf, p.id); k.adopted = true; } },
          { chance: 0.25, effects: { money: -5, happy: -6 }, text: L('Hồ sơ bị từ chối lần này.', 'Your application is turned down this time.') },
        ] },
        { label: L('Nhận nuôi một bé lớn hơn', 'Adopt an older child'), outcomes: [
          { chance: 0.85, effects: { money: -20, happy: 10, karma: 6 }, text: L('Một đứa trẻ cuối cùng cũng có nhà.', 'A child finally has a home.'), run: (lf) => { const k = addChild(lf, p.id); k.adopted = true; k.age = randint(lf, 4, 10); } },
          { chance: 0.15, effects: { money: -5 }, text: L('Thủ tục kéo dài sang năm sau.', 'The process drags into next year.') },
        ] },
        { label: L('Suy nghĩ thêm', 'Think it over'), outcomes: [{ chance: 1, effects: {}, text: L('Hai người về nhà bàn tiếp.', 'You go home to talk it through.') }] },
      ],
    },
  };
}

function proposeScene(life, p) {
  const base = clamp(p.closeness / 110 + (p.cohab ? 0.08 : 0) + Math.min(p.years || 0, 4) * 0.03 - 0.15 + (50 - (prof(p), p.firm ?? 50)) / 250, 0.05, 0.95);
  const ring = (label, units, bonus) => ({
    label,
    outcomes: [
      { chance: clamp(base + bonus, 0.05, 0.97), effects: { money: -units, happy: 15 }, text: L(`${nm(life, p)} khóc và gật đầu. Hai người đính hôn!`, `${nm(life, p)} cries and says yes. You're engaged!`), run: () => { p.engaged = true; p.closeness = clamp(p.closeness + 10); } },
      { chance: 1 - clamp(base + bonus, 0.05, 0.97), effects: { money: -Math.round(units * 0.3), happy: -15 }, text: L(`${nm(life, p)} nói chưa sẵn sàng. Không khí nặng nề.`, `${nm(life, p)} says they aren't ready. The silence is heavy.`), run: () => { p.closeness = clamp(p.closeness - 15); } },
    ],
  });
  return {
    event: {
      uid: 'love/propose', text: L(`Bạn định cầu hôn ${nm(life, p)}. Chọn nhẫn nào?`, `You're going to propose to ${nm(life, p)}. Which ring?`),
      choices: [ring(L('Nhẫn bạc giản dị', 'A simple silver ring'), 3, -0.05), ring(L('Nhẫn vàng đính đá', 'A gold ring with a stone'), 15, 0.05), ring(L('Nhẫn kim cương', 'A diamond ring'), 60, 0.12), { label: L('Chưa phải lúc', 'Not yet'), outcomes: [{ chance: 1, effects: {}, text: L('Bạn cất hộp nhẫn vào ngăn kéo.', 'You hide the ring box in a drawer.') }] }],
    },
  };
}

/** Đám cưới: chọn hợp đồng tiền hôn nhân trước, rồi chọn quy mô. */
function weddingScene(life, p) {
  const yourWorth = Math.max(0, netWorth(life));
  const richer = p.wealth > yourWorth * 2 ? 'them' : yourWorth > p.wealth * 2 ? 'you' : 'even';
  const sizes = (prenup) => (lf) => ({
    uid: 'love/wedding_size',
    text: L('Tổ chức đám cưới thế nào?', 'What kind of wedding?'),
    choices: [
      wed(lf, p, prenup, L('Chỉ đăng ký kết hôn', 'Just sign the papers'), 1, 4),
      wed(lf, p, prenup, L('Tiệc nhỏ với gia đình', 'A small family party'), 15, 8),
      wed(lf, p, prenup, L('Đám cưới linh đình', 'A lavish wedding'), 60, 12),
      wed(lf, p, prenup, L('Bỏ trốn đi cưới ở nước ngoài', 'Elope abroad'), 25, 10),
    ],
  });
  let text;
  if (richer === 'them') text = L(`${nm(life, p)} giàu hơn bạn nhiều và muốn bạn ký hợp đồng tiền hôn nhân.`, `${nm(life, p)} is far wealthier than you and wants a prenup.`);
  else if (richer === 'you') text = L('Bạn giàu hơn người kia nhiều. Có muốn yêu cầu hợp đồng tiền hôn nhân không?', "You're much wealthier. Will you ask for a prenup?");
  else text = L('Trước đám cưới, có ký hợp đồng tiền hôn nhân không?', 'Before the wedding, will you sign a prenup?');
  const accept = richer === 'you' ? clamp(0.4 + p.closeness / 200, 0.1, 0.9) : 1;
  return {
    event: {
      uid: 'love/prenup', text,
      choices: [
        { label: richer === 'them' ? L('Ký', 'Sign it') : L('Ký hợp đồng', 'Sign a prenup'), outcomes: [
          { chance: accept, effects: {}, text: L('Hợp đồng được ký: tài sản trước hôn nhân của mỗi người được bảo vệ.', "It's signed: each person's pre-marriage assets are protected."), next: sizes(true) },
          ...(accept < 1 ? [{ chance: 1 - accept, effects: { happy: -6 }, text: L(`${nm(life, p)} thấy bị xúc phạm vì bạn không tin họ.`, `${nm(life, p)} is hurt that you don't trust them.`), run: () => { p.closeness = clamp(p.closeness - 12); }, next: sizes(false) }] : []),
        ] },
        richer === 'them'
          ? { label: L('Từ chối và hủy hôn', 'Refuse and call it off'), outcomes: [{ chance: 1, effects: { happy: -12 }, text: L('Đám cưới bị hủy.', 'The wedding is off.'), run: (lf) => { p.engaged = false; p.closeness = clamp(p.closeness - 20); } }] }
          : { label: L('Không cần', 'No prenup'), outcomes: [{ chance: 1, effects: {}, text: L('Hai người tin nhau tuyệt đối.', 'You trust each other completely.'), next: sizes(false) }] },
      ],
    },
  };
}
function wed(life, p, prenup, label, units, hap) {
  return {
    label,
    outcomes: [{
      chance: 1, effects: { money: -units, happy: hap }, text: L(`Bạn và ${nm(life, p)} chính thức thành vợ chồng!`, `You and ${nm(life, p)} are married!`),
      run: (lf) => {
        p.role = 'spouse'; p.engaged = false; p.cohab = true; p.married = lf.age; p.closeness = clamp(p.closeness + 10);
        lf.marriage = { worthAtWedding: Math.max(0, netWorth(lf)), prenup, spouseId: p.id, since: lf.age };
        lf.counts.marriages = (lf.counts.marriages || 0) + 1;
        milestone(lf, L(`Kết hôn với ${nm(lf, p)}`, `Married ${nm(lf, p)}`), 'good');
        if (p.sugar) lf.counts.sugarMarried = (lf.counts.sugarMarried || 0) + 1;
      },
      next: (lf) => ({
        uid: 'love/honeymoon', text: L('Đi tuần trăng mật ở đâu?', 'Where for the honeymoon?'),
        choices: [
          { label: L('Ở nhà cho tiết kiệm', 'Stay home and save'), outcomes: [{ chance: 1, effects: { happy: 2 }, text: L('Một tuần nghỉ phép bên nhau, không ai làm phiền.', 'A week off together, undisturbed.') }] },
          { label: L('Đảo nhiệt đới', 'A tropical island'), outcomes: [{ chance: 0.85, effects: { money: -20, happy: 12, health: 3 }, text: L('Biển xanh, cát trắng, và chỉ có hai người.', 'Blue sea, white sand, just the two of you.'), run: () => closer(lf, p, 6, 10) }, { chance: 0.15, effects: { money: -20, health: -6 }, text: L('Cả hai bị ngộ độc hải sản ngay ngày đầu.', 'You both get food poisoning on day one.') }] },
          { label: L('Châu Âu ba tuần', 'Three weeks in Europe'), outcomes: [{ chance: 1, effects: { money: -45, happy: 15 }, text: L('Mỗi thành phố một kỷ niệm.', 'A memory in every city.'), run: () => closer(lf, p, 8, 12) }] },
        ],
      }),
    }],
  };
}

function divorceScene(life, p) {
  return {
    event: {
      uid: 'love/divorce', text: L(`Bạn muốn ly hôn ${nm(life, p)}.${life.marriage?.prenup ? ' Hai người có hợp đồng tiền hôn nhân.' : ' Không có hợp đồng tiền hôn nhân, tài sản sẽ bị chia đôi.'}`, `You want to divorce ${nm(life, p)}.${life.marriage?.prenup ? ' You have a prenup.' : ' Without a prenup, assets are split down the middle.'}`),
      choices: [
        { label: L('Thỏa thuận êm đẹp', 'Settle amicably'), outcomes: [{ chance: 1, effects: { happy: -10 }, text: L('Hai người ký giấy và chúc nhau may mắn.', 'You sign the papers and wish each other well.'), run: (lf) => breakUp(lf, 'choice', 1) }] },
        { label: L('Thuê luật sư giỏi', 'Hire a sharp lawyer'), outcomes: [
          { chance: 0.6, effects: { money: -20, happy: -8 }, text: L('Luật sư giúp bạn giữ được nhiều tài sản hơn.', 'Your lawyer keeps more of your assets safe.'), run: (lf) => breakUp(lf, 'choice', 0.5) },
          { chance: 0.4, effects: { money: -20, happy: -14 }, text: L('Luật sư bên kia giỏi hơn. Phiên tòa kéo dài và tốn kém.', "Their lawyer is better. It's long and costly."), run: (lf) => breakUp(lf, 'choice', 1.2) },
        ] },
        { label: L('Thôi, cố thêm lần nữa', 'Give it one more try'), outcomes: [{ chance: 1, effects: {}, text: L('Bạn đề nghị đi tư vấn hôn nhân.', 'You suggest couples counselling.'), run: () => closer(life, p, 3, 8) }] },
      ],
    },
  };
}

// ───────── Diễn biến hằng năm ─────────
export function loveYear(life) {
  const p = partner(life);
  if (!p || life.prison) return;
  p.years = (p.years || 0) + 1;
  // Thu nhập chung của vợ chồng, tiền "chu cấp" của người yêu giàu
  if (p.role === 'spouse' && p.income) life.money += p.income * 0.2;
  if (p.sugar && p.closeness > 40) { const a = u(life, randint(life, 10, 40)); life.money += a; addLog(life, L(`${nm(life, p)} chu cấp cho bạn một khoản tiền tiêu.`, `${nm(life, p)} gives you an allowance.`), 'good'); }
  if (p.role === 'spouse' && life.marriage && (life.age - life.marriage.since) % 10 === 0 && life.age > life.marriage.since) {
    addLog(life, L(`Kỷ niệm ${life.age - life.marriage.since} năm ngày cưới.`, `Your ${life.age - life.marriage.since}th wedding anniversary.`), 'good');
  }
  // Sự kiện do người kia chủ động
  if (p.role === 'partner' && !p.engaged && p.years >= 2 && p.closeness >= 70 && chance(life, 0.2)) life.queue.push({ sys: 'partner_proposes' });
  else if (p.role === 'partner' && !p.cohab && p.years >= 1 && p.closeness >= 55 && chance(life, 0.25)) life.queue.push({ sys: 'move_in' });
  else if (p.role === 'spouse' && !people(life, 'child').length && life.age < 45 && chance(life, 0.18)) life.queue.push({ sys: 'want_kids' });
  const cheatP = (100 - (p.fidelity ?? 70)) / 900 + (p.closeness < 40 ? 0.06 : 0);
  if (!life.flags.partner_cheated && chance(life, cheatP)) life.queue.push({ sys: 'partner_cheats' });
}

export function buildLoveSys(life, item) {
  if (item.sys === 'lover_ultimatum') {
    const lv = byId(life, item.id);
    if (!lv || lv.role !== 'lover' || !lv.alive || !partner(life)) return null;
    const ln = nm(life, lv);
    return { uid: 'sys/lover_ultimatum', sys: true, text: L(`${ln} nói nhỏ: "Mình không muốn làm người bí mật mãi. Chọn đi: mình hoặc người kia."`, `${ln} says quietly: "I don't want to be your secret forever. Choose: me or them."`), choices: [
      { label: L(`Chọn ${ln}`, `Choose ${ln}`), outcomes: [{ chance: 1, effects: { happy: 6, karma: -6 }, run: (lf) => { breakUp(lf, 'affair'); lv.role = 'partner'; lv.closeness = Math.max(lv.closeness, 70); lf.counts.partners++; syncAffair(lf); }, text: L('Bạn về nhà, nói lời chia tay, rồi dọn đi.', 'You go home, end it, and move out.') }] },
      { label: L('Hứa sẽ sớm rời đi', 'Promise to leave soon'), outcomes: [{ chance: 0.6, effects: { karma: -3 }, run: () => { lv.closeness = clamp(lv.closeness - 5); }, text: L('Một lời hứa nữa. Họ tạm tin.', 'Another promise. They believe you, for now.') }, { chance: 0.4, effects: {}, run: (lf) => lf.queue.unshift({ sys: 'affair_exposed' }), text: L('Họ không tin nữa và tự đi tìm người yêu bạn.', "They're done waiting and go find your partner themselves.") }] },
      { label: L('Chấm dứt với họ', 'End it with them'), outcomes: [{ chance: 1, effects: { happy: -6, karma: 4 }, run: (lf) => endLover(lf, lv), text: L('Bạn mặc áo, nhìn họ lần cuối, và đi.', 'You dress, look at them one last time, and leave.') }] },
    ] };
  }
  const p = partner(life);
  if (!p) return null;
  const name = nm(life, p);
  if (item.sys === 'partner_proposes') {
    return { uid: 'sys/partner_proposes', sys: true, text: L(`${name} quỳ xuống và lấy ra một chiếc nhẫn.`, `${name} kneels and pulls out a ring.`), choices: [
      { label: L('Đồng ý!', 'Yes!'), outcomes: [{ chance: 1, sysLove: 'engage', effects: { happy: 15 }, text: L('Hai người đính hôn.', "You're engaged.") }] },
      { label: L('Từ chối', 'Say no'), outcomes: [{ chance: 0.5, sysLove: 'reject_soft', effects: { happy: -5 }, text: L(`${name} buồn nhưng nói sẽ chờ.`, `${name} is sad but says they'll wait.`) }, { chance: 0.5, sysLove: 'reject_hard', effects: { happy: -10 }, text: L(`${name} thu dọn đồ và rời đi.`, `${name} packs a bag and leaves.`) }] },
    ] };
  }
  if (item.sys === 'move_in') {
    return { uid: 'sys/move_in', sys: true, text: L(`${name} hỏi bạn có muốn dọn về sống chung không.`, `${name} asks if you'd like to move in together.`), choices: [
      { label: L('Dọn về luôn', 'Move in'), outcomes: [{ chance: 1, sysLove: 'cohab', effects: { happy: 8 }, text: L('Bàn chải đánh răng của hai người giờ chung một cốc.', 'Your toothbrushes now share a cup.') }] },
      { label: L('Muốn giữ không gian riêng', 'Keep your own place'), outcomes: [{ chance: 1, sysLove: 'cool', effects: {}, text: L(`${name} hơi hụt hẫng.`, `${name} is a little deflated.`) }] },
    ] };
  }
  if (item.sys === 'want_kids') {
    const canBio = p.gender !== life.gender;
    return { uid: 'sys/want_kids', sys: true, text: L(`${name} nói muốn có con.`, `${name} says they want children.`), choices: [
      canBio
        ? { label: L('Bắt đầu cố gắng', 'Start trying'), outcomes: [{ chance: 1, sysLove: 'try_baby', effects: { happy: 5 }, text: L('Hai người quyết định để mọi chuyện tự nhiên.', 'You decide to let nature take its course.') }] }
        : { label: L('Tìm hiểu nhận con nuôi', 'Look into adoption'), outcomes: [{ chance: 1, sysLove: 'warm', effects: { happy: 5 }, text: L('Hai người bắt đầu tìm hiểu thủ tục (Quan hệ → Nhận con nuôi).', 'You start looking into it (People → Adopt).') }] },
      { label: L('Chưa sẵn sàng', 'Not ready yet'), outcomes: [{ chance: 1, sysLove: 'cool', effects: {}, text: L(`${name} gật đầu nhưng có vẻ buồn.`, `${name} nods, but looks sad.`) }] },
    ] };
  }
  if (item.sys === 'partner_cheats') {
    return { uid: 'sys/partner_cheats', sys: true, text: L(`Bạn phát hiện tin nhắn cho thấy ${name} đang lén lút với người khác.`, `You find messages showing ${name} has been seeing someone else.`), choices: [
      { label: L('Tha thứ', 'Forgive them'), outcomes: [{ chance: 1, sysLove: 'forgive', effects: { happy: -10, willpower: -3 }, text: L('Bạn tha thứ, nhưng không quên được.', "You forgive, but you can't forget.") }] },
      { label: L('Chia tay ngay', 'End it now'), outcomes: [{ chance: 1, sysLove: 'leave', effects: { happy: -12, willpower: 4 }, text: L('Bạn đóng cửa lại sau lưng họ.', 'You close the door behind them.') }] },
      { label: L('Đăng hết lên mạng', 'Post everything online'), outcomes: [{ chance: 1, sysLove: 'leave', effects: { happy: -6, fame: 6, karma: -4 }, text: L('Cả mạng xã hội đứng về phía bạn.', 'The whole internet takes your side.') }] },
    ] };
  }
  return null;
}

export function applyLoveSys(life, key) {
  const p = partner(life);
  if (!p) return;
  switch (key) {
    case 'engage': p.engaged = true; p.closeness = clamp(p.closeness + 10); break;
    case 'reject_soft': p.closeness = clamp(p.closeness - 10); break;
    case 'reject_hard': breakUp(life, 'event'); break;
    case 'cohab': p.cohab = true; p.closeness = clamp(p.closeness + 6); break;
    case 'cool': p.closeness = clamp(p.closeness - 6); break;
    case 'warm': p.closeness = clamp(p.closeness + 5); break;
    case 'try_baby': tryConceive(life, p, 0.5); break;
    case 'forgive': p.closeness = clamp(p.closeness - 15); life.flags.partner_cheated = life.age; break;
    case 'leave': life.flags.partner_cheated = life.age; breakUp(life, 'event'); break;
  }
}

export { ROMANTIC, byId, spouse };
