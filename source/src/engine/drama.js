// Đợt 3: xu hướng (90–92), hậu cung yêu nhau & trò chơi trong nhà (91, 93–103), hoạt động mới (104–112),
// nhật báo (126), khung kịch bản drama (150–189) và hệ thống bảo đảm sự kiện (190).
// Luật cứng vẫn giữ: mọi cảnh tình cảm chỉ giữa người lớn ngoài gia đình, có đồng thuận, viết gợi cảm không chi tiết.
import { L, clamp, rand, chance, randint, pick, freqOf } from './util.js';
import { unit, partner, spouse, people, byId, randomPerson, partnerGender, personName, addLog, setFlag, lovers, polyOk, makeLover, endLover, endAllLovers, syncAffair } from './life.js';
import { applyEffects, breakUp, addChild } from './events.js';
import { prof, me, agree, adultOK, attOf, ROM, romance, orientOf, likes, ORIENT } from './intimacy.js';
import { members, hm, relOf, setRel, hstate, inHarem, leave, titleOf, HOUSES } from './harem.js';
import { teamPeople } from './world.js';
import { COUNTRIES } from '../data/countries.js';

const res = (text, changes = [], tone) => ({ text, changes, tone });
const nm = (life, p) => personName(life, p);
const u = (life, n) => n * unit(life);
const fx = (life, e) => applyEffects(life, e);
const oc = (text, effects = {}, run, next, ch = 1) => ({ chance: ch, text, effects, run, next });
const modal = (uid, text, choices) => ({ event: { uid, text, choices } });
const sev = (uid, text, choices) => ({ uid, sys: true, text, choices });
const on = (st, life) => !!(st && st.adult25 && life.age >= 18);
const fire = (p, d) => { const x = prof(p); x.fire = clamp(x.fire + d); };
const cl = (p, d) => { p.closeness = clamp(p.closeness + d); };
function mk(life, role, age, extra = {}) {
  const p = randomPerson(life, life, { role, gender: partnerGender(life, life), age: clamp(age, 18, 90), closeness: 40 });
  Object.assign(p, extra);
  life.people.push(p);
  return p;
}
const adults = (life, roles) => life.people.filter((p) => adultOK(life, p) && !p.cut && (!roles || roles.includes(p.role)));
const rom = (lf, p) => { const k = romance(lf, p); p.wasLover = true; fire(p, 20); setFlag(lf, 'recent_intimate'); return k; };
const risk = (lf, pr) => { if (partner(lf) && !polyOk(lf) && lovers(lf).length && chance(lf, pr)) lf.queue.unshift({ sys: 'affair_exposed' }); };

// ───────── 91 · Hậu cung yêu nhau ─────────
const pk = (a, b) => (a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`);
export const PAIR_ST = {
  blessed: { em: '💞', name: L('Được chúc phúc', 'Blessed') },
  withyou: { em: '🔗', name: L('Chỉ khi có bạn', 'Only with you') },
  forbidden: { em: '🚫', name: L('Không được phép', 'Forbidden') },
  secret: { em: '🤫', name: L('Lén lút', 'Secret') },
};
export function pairsOf(life, includeSecret = false) {
  const h = life.harem;
  if (!h || !h.pairs) return [];
  const ms = members(life);
  const out = [];
  for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) {
    const pr = h.pairs[pk(ms[i], ms[j])];
    if (pr && (includeSecret || pr.st !== 'secret')) out.push([ms[i], ms[j], pr]);
  }
  return out;
}
const mutual = (life, a, b) => likes(life, a, b.gender) && likes(life, b, a.gender);
export function setPair(life, a, b, st, love = 60) {
  const h = hstate(life);
  h.pairs ||= {};
  if (!st) { delete h.pairs[pk(a, b)]; return; }
  h.pairs[pk(a, b)] = { st, love: clamp(love), since: life.age };
}
function pairYear(life, st) {
  const h = life.harem;
  if (!h) return;
  h.pairs ||= {};
  const ms = members(life);
  const fm = freqOf(st).m;
  for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) {
    const a = ms[i]; const b = ms[j];
    const key = pk(a, b);
    const pr = h.pairs[key];
    if (!pr) {
      if (relOf(life, a, b) >= 50 && mutual(life, a, b) && chance(life, 0.15 * fm)) {
        if (h.allowPairs === false || chance(life, 0.3)) h.pairs[key] = { st: 'secret', love: 55, since: life.age };
        else life.queue.push({ sys: 'h_pair', a: a.id, b: b.id });
      }
      continue;
    }
    pr.love = clamp(pr.love + (pr.room ? 6 : 2) + Math.round(relOf(life, a, b) / 40));
    if (pr.st === 'blessed') { h.harmony = clamp(h.harmony + 2); hm(a).favor = clamp(hm(a).favor - 1.5); hm(b).favor = clamp(hm(b).favor - 1.5); if (life.age - (hm(a).last ?? life.age) >= 3 && life.age - (hm(b).last ?? life.age) >= 3 && chance(life, 0.25)) { leave(life, a); leave(life, b); addLog(life, L(`${nm(life, a)} và ${nm(life, b)} cảm thấy bị bỏ quên, cùng nhau rời hậu cung.`, `${nm(life, a)} and ${nm(life, b)} feel forgotten and leave the harem together.`), 'bad'); } }
    else if (pr.st === 'forbidden') { hm(a).mood = clamp(hm(a).mood - 5); hm(b).mood = clamp(hm(b).mood - 5); if (chance(life, 0.3)) pr.st = 'secret'; }
    else if (pr.st === 'secret' && chance(life, 0.2 * fm)) life.queue.push({ sys: 'h_pair_found', a: a.id, b: b.id });
  }
  const left = members(life);
  if (left.length >= 2 && h.harmony >= 70 && left.every((p) => left.some((q) => q !== p && ['blessed', 'withyou'].includes(h.pairs[pk(p, q)]?.st)))) life.counts.fullFamily = true;
}

// ───────── Hành động mới trên màn hình Hậu cung ─────────
export function dramaHaremActions(life, st) {
  if (!on(st, life)) return [];
  const h = life.harem;
  const ms = members(life);
  if (ms.length < 2) return [];
  const a = [];
  const prs = pairsOf(life);
  if (prs.length) { a.push(['pairdate', '💑', L('Hẹn hò đôi trong nhà', 'Set up a date for a couple')]); a.push(['pairroom', '🛏️', L('Phòng chung cho một cặp', 'A shared room for a couple')]); a.push(['trio', '🔥', L('Đêm cả ba với một cặp', 'A night for three with a couple')]); }
  if (prs.some(([, , p]) => p.st === 'blessed')) a.push(['watch', '👀', L('Đêm ngồi xem', 'A night of watching')]);
  a.push(['nuderule', '🌿', h.nude ? L('Bỏ luật "không mặc gì"', 'Drop the no-clothes rule') : L('Đặt luật nhà "không mặc gì" vào thứ Sáu', 'Set a no-clothes-on-Fridays house rule')]);
  if (!h.jacuzzi && h.house !== 'apt') a.push(['jacuzzi', '🛁', L('Lắp bồn tắm lớn cho cả nhà', 'Install a family-size hot tub')]);
  a.push(['guess', '🙈', L('Bịt mắt đoán người', 'Blindfold: guess who')]);
  a.push(['wheel', '🎡', L('Vòng quay đêm nay', "Spin tonight's wheel")]);
  a.push(['swaprole', '🔄', L('Đổi vai một đêm', 'Swap roles for a night')]);
  if (me(life).pole) a.push(['poleshow', '💃', L('Màn múa cột cho cả nhà', 'A pole show for the family')]);
  a.push(['honeymoon', '🌺', L('Tuần trăng mật cả nhà', 'A family honeymoon')]);
  if (!h.vowed) a.push(['ceremony', '💍', L('Lễ cam kết tập thể', 'A group commitment ceremony')]);
  if (life.special?.id === 'adult_director') a.push(['film', '🎬', L('Mời hậu cung đóng phim', 'Cast the harem in a film')]);
  return a;
}
const pairChoices = (life, fn) => pairsOf(life).map(([a, b, pr]) => ({ label: L(`${PAIR_ST[pr.st].em} ${nm(life, a)} & ${nm(life, b)}`, `${PAIR_ST[pr.st].em} ${nm(life, a)} & ${nm(life, b)}`), outcomes: [fn(a, b, pr)] }));
const bump = (p, fav, mood) => { const x = hm(p); x.favor = clamp(x.favor + fav); x.mood = clamp(x.mood + mood); };
export function doDramaHaremAction(life, st, act) {
  if (!on(st, life)) return null;
  const h = hstate(life);
  const ms = members(life);
  const n = (life.yearActs[`hd:${act}`] = (life.yearActs[`hd:${act}`] || 0) + 1);
  const tired = res(L('Năm nay như vậy là đủ rồi.', "That's enough for this year."), []);
  switch (act) {
    case 'pairdate': if (n > 2) return tired; return modal('hd/pairdate', L('Tổ chức buổi hẹn cho cặp nào?', 'Which couple gets a date night?'), pairChoices(life, (a, b, pr) => oc(L(`Bạn dọn bàn ăn nến cho ${nm(life, a)} và ${nm(life, b)} rồi lặng lẽ đóng cửa. Sáng ra cả hai cảm ơn bạn bằng bữa sáng trên giường.`, `You set a candlelit table for ${nm(life, a)} and ${nm(life, b)}, then quietly close the door. Next morning they thank you with breakfast in bed.`), { happy: 5 }, (lf) => { pr.love = clamp(pr.love + 15); setRel(lf, a, b, relOf(lf, a, b) + 10); h.harmony = clamp(h.harmony + 4); bump(a, 3, 8); bump(b, 3, 8); })));
    case 'pairroom': if (n > 1) return tired; return modal('hd/pairroom', L('Cho cặp nào phòng chung?', 'Which couple gets a shared room?'), pairChoices(life, (a, b, pr) => oc(L(`${nm(life, a)} và ${nm(life, b)} dọn về chung một phòng. Từ nay họ thân nhau nhanh hơn hẳn.`, `${nm(life, a)} and ${nm(life, b)} move into one room. They grow closer much faster now.`), { happy: 3 }, () => { pr.room = true; pr.love = clamp(pr.love + 10); })));
    case 'trio': if (n > 2) return tired; return modal('hd/trio', L('Đêm cả ba với cặp nào?', 'A night for three with which couple?'), pairChoices(life, (a, b, pr) => {
      const ok = pr.st !== 'forbidden' && chance(life, agree(life, a, 0.75, true)) && chance(life, agree(life, b, 0.75, true));
      return ok ? oc(L(`Cả ba cười khúc khích dưới một tấm chăn. Đêm đó ${nm(life, a)} và ${nm(life, b)} nhìn bạn như nhìn người quan trọng nhất.`, `The three of you giggle under one blanket. That night ${nm(life, a)} and ${nm(life, b)} look at you like you're the most important person alive.`), { happy: 12 }, (lf) => { bump(a, 8, 8); bump(b, 8, 8); fire(a, 10); fire(b, 10); pr.love = clamp(pr.love + 5); setFlag(lf, 'recent_intimate'); })
        : oc(L('Một người ngập ngừng nói đêm nay chỉ muốn ở riêng hai người. Bạn mỉm cười để họ có đêm của mình.', 'One of them hesitantly says they just want it to be the two of them tonight. You smile and give them their night.'), {}, () => { pr.love = clamp(pr.love + 5); });
    }));
    case 'watch': {
      if (n > 1) return tired;
      const b0 = pairsOf(life).filter(([, , p]) => p.st === 'blessed');
      return modal('hd/watch', L('Một cặp mời bạn ngồi xem. Chỉ khi cả hai thật sự muốn.', 'A couple invites you to watch. Only if they both truly want to.'), b0.map(([a, b, pr]) => ({ label: L(`${nm(life, a)} & ${nm(life, b)}`, `${nm(life, a)} & ${nm(life, b)}`), outcomes: [oc(L('Bạn ngồi trên chiếc ghế bành ở góc phòng, ánh nến chập chờn. Không ai nói gì, nhưng không khí nóng dần lên.', 'You sit in the armchair in the corner, candles flickering. Nobody speaks, but the room grows warmer.'), { happy: 9 }, (lf) => { fire(a, 12); fire(b, 12); pr.love = clamp(pr.love + 8); for (const q of members(lf)) if (q !== a && q !== b && hm(q).trait === 'loyal') hm(q).mood = clamp(hm(q).mood - 6); setFlag(lf, 'recent_intimate'); })] })));
    }
    case 'nuderule': {
      h.nude = !h.nude;
      if (h.nude) for (const p of ms) { const t = hm(p).trait; bump(p, 0, t === 'free' ? 15 : t === 'proud' ? -12 : t === 'loyal' ? -3 : 5); }
      h.harmony = clamp(h.harmony + (h.nude ? 3 : 0));
      return res(h.nude ? L('Nội quy mới dán trên tủ lạnh: "Thứ Sáu, trong nhà không ai mặc đồ." Người phóng khoáng nhất nhà hò reo, người kiêu hãnh nhất bĩu môi.', 'New rule on the fridge: "Fridays, no clothes in the house." The free spirit cheers; the proud one pouts.') : L('Luật cũ được gỡ xuống. Ai đó thở phào, ai đó tiếc nuối.', 'The rule comes down. Someone sighs with relief, someone with regret.'), [], 'good');
    }
    case 'jacuzzi': {
      if (life.money < u(life, 150)) return res(L('Chưa đủ tiền lắp bồn tắm lớn.', "Not enough money for the hot tub yet."), [], 'bad');
      life.money -= u(life, 150); h.jacuzzi = true; h.harmony = clamp(h.harmony + 6);
      return res(L('Một bồn tắm nước nóng đủ cho cả nhà. Tối đầu tiên đã có cuộc tranh giành xem ai ngồi cạnh bạn.', 'A hot tub big enough for everyone. On the first night there\'s already a squabble over who sits next to you.'), [['money', -u(life, 150)]], 'good');
    }
    case 'guess': {
      if (n > 2) return tired;
      const CLUE = { gentle: L('một bàn tay ấm chạm rất nhẹ', 'a warm hand with the lightest touch'), passion: L('hơi thở gấp, không kiên nhẫn', 'quick, impatient breath'), scheme: L('một lời thì thầm bí mật vào tai bạn', 'a secret whispered in your ear'), proud: L('người không chịu lên tiếng trước', 'someone who refuses to speak first'), free: L('một tràng cười khúc khích', 'a burst of giggles'), loyal: L('bàn tay nắm lấy tay bạn rất lâu', 'a hand holding yours for a long time') };
      const target = pick(life, ms);
      const others = ms.filter((p) => p !== target);
      const opts = [target, ...others.sort(() => rand(life) - 0.5).slice(0, 2)].sort(() => rand(life) - 0.5);
      const clue = CLUE[hm(target).trait];
      return modal('hd/guess', L(`Bạn bị bịt mắt. Người đang ngồi cạnh bạn có ${clue.vi}. Là ai?`, `You're blindfolded. The person beside you has ${clue.en}. Who is it?`), opts.map((p) => ({ label: L(nm(life, p), nm(life, p)), outcomes: [p === target
        ? oc(L(`Đúng là ${nm(life, p)}! Họ ôm chầm lấy bạn: "Biết ngay là bạn nhận ra mình."`, `It's ${nm(life, p)}! They throw their arms around you: "I knew you'd know me."`), { happy: 6 }, () => { bump(target, 10, 10); hm(target).known = true; })
        : oc(L(`Sai rồi, là ${nm(life, target)}. Họ tháo bịt mắt cho bạn với vẻ mặt hơi tủi thân.`, `Wrong. It was ${nm(life, target)}, who takes off your blindfold looking a little hurt.`), { happy: 2 }, () => { bump(target, -3, -8); bump(p, 3, 3); })] })));
    }
    case 'wheel': {
      if (n > 2) return tired;
      const p = pick(life, ms);
      const ACT = [L('một đêm riêng', 'a night alone together'), L('massage cả buổi tối', 'an evening-long massage'), L('ôm nhau ngủ, không gì hơn', 'cuddling to sleep, nothing more'), L('tắm chung bồn nước nóng', 'a shared hot bath'), L('nhảy chậm trong phòng khách', 'a slow dance in the living room')];
      const a = pick(life, ACT);
      const ok = agree(life, p, 0.8, true);
      return modal('hd/wheel', L(`Kim dừng ở ${nm(life, p)}: ${a.vi}.`, `The wheel stops on ${nm(life, p)}: ${a.en}.`), [{ label: L('Xem họ có đồng ý không', 'See if they agree'), outcomes: [
        oc(L(`${nm(life, p)} cười tươi gật đầu.`, `${nm(life, p)} grins and nods.`), { happy: 7 }, (lf) => { bump(p, 7, 7); fire(p, 6); hm(p).last = lf.age; }, null, ok),
        oc(L(`${nm(life, p)} lắc đầu: "Hôm nay mình mệt." Cả nhà quay lại lần nữa.`, `${nm(life, p)} shakes their head: "Not tonight." Everyone spins again.`), { happy: 1 }, null, null, 1 - ok),
      ] }]);
    }
    case 'swaprole': {
      if (n > 1) return tired;
      const top = ms.slice().sort((a, b) => hm(b).favor - hm(a).favor)[0];
      const t = hm(top).trait;
      return res(L(`Đêm nay ${nm(life, top)} làm chủ nhà và ra lệnh cho bạn. ${t === 'scheme' ? 'Họ xếp lại lịch Lật thẻ cả tháng, toàn tên mình.' : t === 'proud' ? 'Họ bắt bạn phục vụ bữa tối cho cả nhà.' : t === 'passion' ? 'Lệnh đầu tiên: tắt hết đèn.' : 'Họ chỉ muốn bạn ở cạnh cả đêm.'}`, `Tonight ${nm(life, top)} runs the house and gives you orders. ${t === 'scheme' ? "They rewrite the month's card flips, all with their own name." : t === 'proud' ? 'They make you serve dinner to everyone.' : t === 'passion' ? 'First order: lights off.' : 'They just want you beside them all night.'}`), fx(life, { happy: 6 }), 'good');
    }
    case 'poleshow': if (n > 1) return tired; h.harmony = clamp(h.harmony + 5); for (const p of ms) { fire(p, 8); bump(p, 2, 6); } return res(L('Đèn mờ, nhạc chậm, chiếc cột giữa phòng khách. Cả nhà vỗ tay đến đỏ cả tay.', 'Dim lights, slow music, a pole in the living room. The whole house claps until their hands sting.'), fx(life, { happy: 7 }), 'good');
    case 'honeymoon': {
      if (n > 1) return tired;
      return modal('hd/honeymoon', L(`Tuần trăng mật cả nhà ${ms.length} người ở một hòn đảo nhiệt đới.`, `A family honeymoon for ${ms.length} on a tropical island.`), [
        { label: L('Chỉ nghỉ ngơi thật trọn', 'Just rest and enjoy'), outcomes: [oc(L('Hai tuần cát trắng, biển xanh và những đêm không ai muốn ngủ.', 'Two weeks of white sand, blue sea and nights nobody wants to sleep through.'), { happy: 14, money: -40 * ms.length }, (lf) => { h.harmony = clamp(h.harmony + 15); for (const p of ms) { bump(p, 3, 12); fire(p, 10); } })] },
        { label: L('Kèm buổi chụp ảnh boudoir cả nhà', 'Add a family boudoir shoot'), outcomes: [oc(L('Một bộ ảnh nghệ thuật cả nhà, khéo che những chỗ cần che. Bạn cất vào Rương bí mật, hay đăng lên mạng thì tùy.', 'An artful family photo set, everything that needs covering, covered. Into the secret chest it goes, or online, your call.'), { happy: 15, money: -50 * ms.length }, (lf) => { h.harmony = clamp(h.harmony + 15); for (const p of ms) { bump(p, 3, 12); fire(p, 12); } me(lf).charm = clamp(me(lf).charm + 4); })] },
      ]);
    }
    case 'ceremony': {
      if (h.vowed) return null;
      h.vowed = true; h.harmony = clamp(h.harmony + 15);
      addLog(life, L('Cả hậu cung làm lễ cam kết, mỗi người đọc lời hứa của mình.', 'The whole harem holds a commitment ceremony; each person reads their own vow.'), 'good');
      return res(L(`${ms.length} lời hứa, ${ms.length} chiếc nhẫn giống nhau. Từ nay ai rời đi sẽ đau gấp đôi.`, `${ms.length} vows, ${ms.length} matching rings. From now on, anyone leaving will hurt twice as much.`), fx(life, { happy: 12, money: -20 }), 'good');
    }
    case 'film': {
      if (n > 1) return tired;
      return modal('hd/film', L('Mời ai đóng vai chính trong phim mới của bạn?', 'Who stars in your new film?'), ms.slice(0, 6).map((p) => {
        const ok = agree(life, p, (p.poly ?? 30) / 120 + 0.25, true);
        return { label: L(nm(life, p), nm(life, p)), outcomes: [
          oc(L(`${nm(life, p)} nhận vai. Phim thành công vang dội, và cả thế giới biết đến hậu cung của bạn.`, `${nm(life, p)} takes the role. The film is a hit, and now the world knows about your harem.`), { happy: 8 }, (lf) => { lf.money += u(lf, 200 + lf.stats.fame * 5); lf.stats.fame = clamp(lf.stats.fame + 5); me(lf).scandal = clamp(me(lf).scandal + 8); bump(p, 10, 10); for (const q of members(lf)) if (q !== p) bump(q, -2, -6); }, null, ok),
          oc(L(`${nm(life, p)} từ chối: "Chuyện trong nhà để trong nhà."`, `${nm(life, p)} declines: "What happens at home stays at home."`), {}, null, null, 1 - ok),
        ] };
      }));
    }
  }
  return null;
}

// ───────── Hoạt động mới (104, 105, 106, 109, 111, 112) ─────────
export const DRAMA_ACTIVITIES = [
  { id: 'poleclass', group: 'adult', min: 18, max: 80, units: 10, when: (lf, st) => on(st, lf), label: L('Lớp múa cột', 'Pole dance class'), run: (lf) => { const m = me(lf); const first = !m.pole; m.pole = true; m.flex = clamp(m.flex + (first ? 8 : 4)); return res(first ? L('Buổi đầu tiên tay run, chân run. Đến cuối khóa bạn xoay một vòng hoàn hảo.', 'First lesson: shaky arms, shaky legs. By the end you nail a perfect spin.') : L('Bạn học thêm một động tác mới. Dẻo dai tăng vọt.', 'You learn a new move. Your flexibility soars.'), fx(lf, { health: 3, looks: 1, happy: 3 }), 'good'); } },
  { id: 'ball', group: 'adult', min: 21, max: 100, units: 80, when: (lf, st) => on(st, lf) && (['mansion', 'island'].includes(lf.harem?.house) || (lf.homes || []).some((h) => /villa|biệt thự/i.test(JSON.stringify(h)))), label: L('Tổ chức vũ hội mặt nạ tại nhà', 'Host a masquerade ball at home'), run: (lf, st) => ballMenu(lf, st) },
  { id: 'bodypaint', group: 'adult', min: 18, max: 90, units: 10, when: (lf, st) => on(st, lf), label: L('Lễ hội vẽ lên cơ thể', 'Body-paint festival'), run: (lf) => bodyPaint(lf) },
  { id: 'houseswap', group: 'adult', min: 21, max: 100, units: 20, when: (lf, st) => on(st, lf) && (lf.homes?.length || 0) > 0, label: L('Đổi nhà đi nghỉ một tuần', 'A one-week house swap'), run: (lf) => houseSwap(lf) },
  { id: 'portrait', group: 'adult', min: 18, max: 100, units: 40, when: (lf, st) => on(st, lf) && !me(lf).portrait, label: L('Thuê họa sĩ vẽ tranh khỏa thân treo trong nhà', 'Commission a nude portrait for the house'), run: (lf) => portraitMenu(lf) },
  { id: 'masseur', group: 'adult', min: 21, max: 100, when: (lf, st) => on(st, lf) && !lf.people.some((p) => p.masseur && p.alive && !p.cut) && lf.money >= u(lf, 300), label: L('Thuê thợ massage tại gia', 'Hire a home masseur'), run: (lf) => { const p = mk(lf, 'contact', lf.age + randint(lf, -8, 10), { masseur: true }); p.closeness = 50; addLog(lf, L(`${nm(lf, p)} trở thành thợ massage riêng của bạn, đến mỗi tuần.`, `${nm(lf, p)} becomes your personal masseur, every week.`)); return res(L(`${nm(lf, p)} có đôi tay của một nghệ sĩ. Sau buổi đầu tiên bạn ngủ như chưa từng được ngủ.`, `${nm(lf, p)} has an artist's hands. After the first session you sleep like never before.`), fx(lf, { health: 4, happy: 4 }), 'good'); } },
];
function ballMenu(life, st) {
  const ex = adults(life, ['ex']);
  const prs = pairsOf(life);
  return modal('d/ball', L('Vũ hội mặt nạ trong dinh thự của bạn. Đèn chùm, nhạc dây, không ai biết ai.', 'A masquerade ball in your mansion. Chandeliers, strings, nobody knows anybody.'), [
    { label: L('Nhảy với người đeo mặt nạ bạc', 'Dance with the silver mask'), outcomes: [oc(L('Một điệu valse, rồi ban công, rồi một cái tên thì thầm. Họ để lại số điện thoại trong túi áo bạn.', 'A waltz, then the balcony, then a whispered name. They slip their number into your pocket.'), { happy: 9 }, (lf) => { const p = mk(lf, 'contact', lf.age + randint(lf, -8, 8)); p.att = 'like'; fire(p, 60); })] },
    ...(ex.length ? [{ label: L('Đi theo người có dáng đi quen quen', 'Follow the one with the familiar walk'), outcomes: [oc(L('Dưới lớp mặt nạ là người cũ của bạn. Họ cười: "Mình vẫn nhận ra bạn từ xa."', 'Behind the mask is your ex. They smile: "I\'d know you anywhere."'), { happy: 5 }, (lf) => { const q = pick(lf, ex); fire(q, 25); cl(q, 10); if (attOf(q) === 'neutral') q.att = 'crush'; })] }] : []),
    ...(prs.length ? [{ label: L('Bắt gặp hai thành viên hậu cung lẻn ra vườn', 'Spot two harem members slipping into the garden'), outcomes: [oc(L('Bạn mỉm cười và kéo rèm lại cho họ.', 'You smile and draw the curtain for them.'), { happy: 4 }, () => { const [, , pr] = pick(life, prs); pr.love = clamp(pr.love + 12); })] }] : []),
    { label: L('Tuyển người mới cho hậu cung', 'Scout someone new for the harem'), outcomes: [oc(L('Một vị khách đeo mặt nạ đỏ hỏi thẳng: "Nghe nói nhà bạn còn chỗ?"', 'A guest in a red mask asks outright: "I hear your house has room?"'), { happy: 5 }, (lf) => { const p = mk(lf, 'contact', lf.age + randint(lf, -8, 8)); p.att = 'affair'; p.poly = Math.max(p.poly ?? 30, 75); fire(p, 50); })] },
  ]);
}
function bodyPaint(life) {
  const ms = members(life);
  return modal('d/paint', L('Lễ hội nghệ thuật: người tham gia chỉ mặc màu vẽ.', 'An art festival: participants wear nothing but paint.'), [
    { label: L('Để nghệ sĩ vẽ lên người bạn', 'Let an artist paint you'), outcomes: [oc(L('Ba giờ ngồi yên, nghệ sĩ không rời mắt khỏi bạn. Khi xong, họ mời bạn đi uống.', 'Three hours sitting still, the artist never looks away. When it\'s done, they ask you for a drink.'), { happy: 8 }, (lf) => { const p = mk(lf, 'contact', lf.age + randint(lf, -6, 10)); p.att = 'crush'; fire(p, 45); }, null, 0.6), oc(L('Ảnh bạn lên trang nhất báo địa phương, khéo léo che bằng một bông hoa.', 'Your photo makes the local front page, tastefully covered by a flower.'), { happy: 6, fame: 2 }, (lf) => { me(lf).scandal = clamp(me(lf).scandal + 3); }, null, 0.4)] },
    ...(ms.length >= 2 ? [{ label: L(`Đi cùng cả hậu cung (${ms.length})`, `Go with the whole harem (${ms.length})`), outcomes: [oc(L('Mỗi người một bộ màu, đứng cạnh nhau thành một bức tranh sống. Khách tham quan xếp hàng chụp ảnh.', 'Each in their own colours, standing together as a living painting. Visitors queue for photos.'), { happy: 10 }, (lf) => { hstate(lf).harmony = clamp(hstate(lf).harmony + 8); for (const p of ms) fire(p, 6); })] }] : []),
  ]);
}
function houseSwap(life) {
  const m = me(life);
  return modal('d/swap', L('Bạn đổi nhà với một người lạ ở nước khác trong một tuần.', 'You swap homes with a stranger abroad for a week.'), [{ label: L('Xách vali lên đường', 'Pack and go'), outcomes: [
    oc(L('Đằng sau cánh tủ có một cánh cửa nữa: phòng bí mật của chủ nhà. Bạn đóng lại, mỉm cười, và để lại một mẩu giấy khen.', 'Behind the wardrobe is another door: your host\'s secret room. You close it, smile, and leave a complimentary note.'), { happy: 8 }, null, null, 0.4),
    oc(L('Chủ nhà để lại thư chào mừng rất dài. Bạn trả lời. Rồi họ trả lời. Một mối quan hệ qua thư bắt đầu.', 'Your host left a long welcome letter. You reply. They reply. A pen-pal romance begins.'), { happy: 7 }, (lf) => { const p = mk(lf, 'contact', lf.age + randint(lf, -8, 8), { country: pick(lf, COUNTRIES).code }); p.att = 'crush'; fire(p, 35); }, null, 0.4),
    oc(m.room ? L('Về nhà, bạn thấy một mẩu giấy trước cửa phòng bí mật: "Gu của bạn tuyệt lắm."', 'Back home, there\'s a note on your secret room door: "Love your taste."') : L('Họ để lại nhà sạch bong và một chai rượu ngon.', 'They leave your place spotless with a fine bottle of wine.'), { happy: 4 }, null, null, 0.2),
  ] }]);
}
function portraitMenu(life) {
  const ms = members(life);
  const set = (k) => () => { me(life).portrait = k; };
  return modal('d/portrait', L('Họa sĩ hỏi: vẽ ai?', 'The painter asks: who will it be?'), [
    { label: L('Chân dung bạn, phong cách cổ điển', 'You, in classical style'), outcomes: [oc(L('Một bức tranh sơn dầu cao bằng người thật, treo giữa phòng khách.', 'A life-size oil painting hangs in the living room.'), { happy: 6 }, set('self'))] },
    ...(ms.length >= 2 ? [{ label: L(`Cả hậu cung (${ms.length} người)`, `The whole harem (${ms.length})`), outcomes: [oc(L('Một bức tranh lớn như tác phẩm phục hưng, mỗi người một tư thế. Ai cũng đòi được vẽ đẹp hơn.', 'A huge Renaissance-style canvas, everyone posed. Each demands to look the best.'), { happy: 9 }, (lf) => { set('harem')(); hstate(lf).harmony = clamp(hstate(lf).harmony + 6); })] }] : []),
  ]);
}

// ───────── 90/92 · nhãn ─────────
export const orientLabel = (life, p) => ORIENT[orientOf(life, p)];

// ───────── 150–189 · Khung kịch bản ─────────
const S = (id, title, req, need, p, cast, steps) => ({ id, title, req, need, p, cast, steps });
const has = (life, roles) => adults(life, roles).length > 0;
export const SCENARIOS = [
  S('self_orient', L('Khám phá bản thân', 'Self-discovery'), L('Tuổi 16–25', 'Age 16–25'), (lf) => lf.age >= 16 && lf.age <= 25, 0.12, () => ({}), {
    1: (lf) => ({ text: lf.orientation === 'same' ? L('Đêm đó bạn nằm nhìn trần nhà và hiểu ra: người khiến tim bạn đập nhanh luôn là người cùng giới.', 'That night you stare at the ceiling and finally understand: the people who make your heart race have always been your own gender.') : lf.orientation === 'both' ? L('Bạn nhận ra mình có thể rung động với bất kỳ ai, không phân biệt giới.', 'You realise you can fall for anyone, regardless of gender.') : L('Một buổi tối nói chuyện với bạn bè khiến bạn nghĩ nhiều về việc mình thích ai, và vì sao.', 'An evening talking with friends gets you thinking about who you like, and why.'), choices: [
      { label: L('Chấp nhận bản thân', 'Accept yourself'), outcomes: [oc(L('Một sự nhẹ nhõm lạ lùng. Bạn là chính mình.', 'A strange lightness. You are who you are.'), { happy: 6, willpower: 3 })] },
      { label: L('Giữ kín trong lòng', 'Keep it to yourself'), outcomes: [oc(L('Bạn cất suy nghĩ ấy vào một góc. Chưa phải lúc.', 'You tuck the thought away. Not yet.'), { happy: -2 })] },
      ...(has(lf, ['bestie']) ? [{ label: L('Kể với bạn thân', 'Tell your best friend'), outcomes: [oc(L('Bạn thân ôm bạn: "Mình vẫn thương bạn y như cũ."', 'Your best friend hugs you: "I love you exactly the same."'), { happy: 8 }, (x) => { for (const q of adults(x, ['bestie'])) cl(q, 8); })] }] : []),
    ] }),
  }),
  S('npc_confide', L('Một người tâm sự về xu hướng', 'Someone confides their orientation'), L('Có bạn bè hoặc đồng nghiệp người lớn', 'An adult friend or coworker'), (lf) => lf.age >= 16 && has(lf, ['friend', 'bestie', 'coworker']), 0.06, (lf) => ({ q: pick(lf, adults(lf, ['friend', 'bestie', 'coworker'])) }), {
    1: (lf, c) => { orientOf(lf, c.q); c.q.orientKnown = true; return { text: L(`${nm(lf, c.q)} nói nhỏ: "Mình muốn bạn là người đầu tiên biết: ${ORIENT[c.q.orient].name.vi.toLowerCase()}."`, `${nm(lf, c.q)} says quietly: "I want you to be the first to know: ${ORIENT[c.q.orient].name.en.toLowerCase()}."`), choices: [
      { label: L('Ủng hộ họ', 'Support them'), outcomes: [oc(L('Họ khóc vì nhẹ nhõm. Từ nay hai người thân hơn bao giờ hết.', 'They cry with relief. You\'re closer than ever.'), { happy: 4, karma: 3 }, () => { cl(c.q, 12); if (attOf(c.q) === 'neutral') c.q.att = 'friendly'; })] },
      { label: L('Gật đầu, không nói gì nhiều', 'Nod, say little'), outcomes: [oc(L('Một khoảng lặng hơi lâu.', 'A slightly long silence.'), {}, () => cl(c.q, 2))] },
      { label: L('Đùa cợt cho qua', 'Make a joke of it'), outcomes: [oc(L('Họ cười gượng rồi lảng đi. Có gì đó vừa vỡ.', 'They force a laugh and change the subject. Something just broke.'), { karma: -3 }, () => cl(c.q, -15))] },
    ] }; },
  }),
  S('bestie_partner', L('Bạn thân của người yêu', "Your partner's best friend"), L('Có người yêu', 'Have a partner'), (lf, st) => on(st, lf) && !!partner(lf), 0.06, (lf) => ({ pt: partner(lf), q: mk(lf, 'contact', partner(lf).age + randint(lf, -3, 3), { tag: 'bfOfPartner' }) }), {
    1: (lf, c, go) => ({ text: L(`${nm(lf, c.q)}, bạn thân nhất của ${nm(lf, c.pt)}, bắt đầu nhắn tin cho bạn lúc nửa đêm. Tin nào cũng kết thúc bằng "đừng kể với ${nm(lf, c.pt)} nhé".`, `${nm(lf, c.q)}, ${nm(lf, c.pt)}'s best friend, starts texting you at midnight. Every message ends with "don't tell ${nm(lf, c.pt)}".`), choices: [
      { label: L('Nhắn lại', 'Text back'), outcomes: [oc(L('Một tin, rồi mười tin. Họ hẹn gặp riêng.', 'One message, then ten. They ask to meet alone.'), {}, (x) => { fire(c.q, 20); go(x, 2); })] },
      { label: L('Lờ đi', 'Ignore it'), outcomes: [oc(L(`${nm(lf, c.pt)} hỏi sao dạo này bạn cứ úp điện thoại xuống bàn.`, `${nm(lf, c.pt)} asks why you keep putting your phone face-down.`), {}, () => cl(c.pt, -3))] },
      { label: L(`Kể với ${nm(lf, c.pt)}`, `Tell ${nm(lf, c.pt)}`), outcomes: [oc(L('Người yêu bạn tái mặt, rồi ôm bạn thật chặt. Tình bạn mười năm của họ kết thúc trong một cuộc gọi.', 'Your partner goes pale, then holds you tight. Their ten-year friendship ends in one phone call.'), { karma: 4 }, () => { cl(c.pt, 8); c.q.att = 'hate'; c.q.cut = true; })] },
    ] }),
    2: (lf, c) => ({ text: L(`Quán cà phê vắng. ${nm(lf, c.q)} đặt tay lên tay bạn.`, `An empty café. ${nm(lf, c.q)} puts their hand on yours.`), choices: [
      { label: L('Không rút tay lại', "Don't pull away"), outcomes: [oc(L('Từ hôm đó bạn có một bí mật với chính người bạn thân nhất của người yêu.', "From that day you share a secret with your partner's closest friend."), { happy: 8, karma: -6 }, (x) => { rom(x, c.q); risk(x, 0.35); })] },
      { label: L('Đứng dậy, trả tiền, ra về', 'Stand, pay, leave'), outcomes: [oc(L('Bạn đi về nhà và ôm người yêu lâu hơn thường lệ.', 'You go home and hug your partner a little longer than usual.'), { willpower: 4 }, () => fire(c.q, 10))] },
      { label: L('Chỉ tiếp tục nhắn tin', 'Keep it to texting'), outcomes: [oc(L('Một mối quan hệ chỉ có chữ, và chữ thì luôn để lại dấu vết.', 'A relationship made of words, and words always leave traces.'), { happy: 3 }, (x) => { fire(c.q, 15); x.queue.push({ sys: 'evidence', item: 'phone' }); })] },
    ] }),
  }),
  S('last_night', L('"Một đêm cuối"', '"One last night"'), L('Có người cũ', 'Have an ex'), (lf, st) => on(st, lf) && has(lf, ['ex']), 0.05, (lf) => ({ q: pick(lf, adults(lf, ['ex'])) }), {
    1: (lf, c) => ({ text: L(`${nm(lf, c.q)} sắp cưới người khác vào tuần sau. Tin nhắn lúc 1 giờ sáng: "Một đêm cuối thôi, rồi mình sẽ biến mất."`, `${nm(lf, c.q)} is marrying someone else next week. A 1am text: "Just one last night, then I'll disappear."`), choices: [
      { label: L('Đến', 'Go'), outcomes: [oc(L('Một đêm dài như cả mối tình cũ dồn lại. Ở đám cưới, họ không dám nhìn về phía bạn.', 'A night as long as the whole old relationship. At the wedding, they can\'t look your way.'), { happy: 6, karma: -4 }, (x) => { setFlag(x, 'recent_intimate'); c.q.att = 'affair'; fire(c.q, 30); risk(x, 0.25); }, null, 0.75), oc(L('Người sắp cưới của họ gọi điện đúng lúc. Mọi chuyện vỡ lở trước ngày cưới.', 'Their fiancé calls at the worst moment. It all blows up before the wedding.'), { happy: -4 }, (x) => { me(x).scandal = clamp(me(x).scandal + 10); c.q.att = 'like'; }, null, 0.25)] },
      { label: L('Đến, nhưng chỉ để nói chuyện', 'Go, but only to talk'), outcomes: [oc(L('Hai người ngồi đến sáng, nói những điều chưa từng nói. Một cái kết đẹp.', 'You sit until dawn saying everything left unsaid. A good ending.'), { happy: 4 }, () => cl(c.q, 15))] },
      { label: L('Chúc mừng hạnh phúc và tắt máy', 'Wish them well and switch off'), outcomes: [oc(L('Bạn ngủ ngon hơn mình tưởng.', 'You sleep better than you expected.'), { willpower: 4 })] },
    ] }),
  }),
  S('assistant', L('Trợ lý mới quá hấp dẫn', 'The irresistible new assistant'), L('Có việc làm', 'Have a job'), (lf, st) => on(st, lf) && !!lf.job, 0.05, (lf) => ({ q: mk(lf, 'coworker', lf.age + randint(lf, -10, 2), { tag: 'assistant' }) }), {
    1: (lf, c, go) => ({ text: L(`${nm(lf, c.q)}, trợ lý mới, mang cà phê đúng gu bạn từ ngày đầu và đứng hơi gần mỗi khi đưa giấy tờ.`, `${nm(lf, c.q)}, your new assistant, brings your coffee just right from day one and stands a little close whenever handing over papers.`), choices: [
      { label: L('Đáp lại ánh mắt', 'Return the look'), outcomes: [oc(L('Phòng họp nhỏ cuối hành lang bắt đầu được đặt chỗ thường xuyên.', 'The small meeting room at the end of the hall starts getting booked a lot.'), {}, (x) => { fire(c.q, 25); go(x, 2); })] },
      { label: L('Giữ chuyên nghiệp', 'Keep it professional'), outcomes: [oc(L('Hiệu suất cả hai tăng vọt. HR hài lòng.', 'Both your performances soar. HR is pleased.'), { willpower: 3 }, (x) => { if (x.job) x.job.perf = clamp(x.job.perf + 5); })] },
      { label: L('Xin chuyển họ sang phòng khác', 'Ask for them to be transferred'), outcomes: [oc(L('Họ đi, nhưng ánh mắt lúc chia tay khiến bạn nhớ cả tuần.', 'They go, but their parting look stays with you all week.'), {}, () => { c.q.role = 'contact'; fire(c.q, 10); })] },
    ] }),
    2: (lf, c) => { const pt = partner(lf); return { text: pt ? L(`Đúng lúc ${nm(lf, c.q)} đang chỉnh cà vạt cho bạn, ${nm(lf, pt)} mở cửa văn phòng với hộp cơm trưa.`, `Just as ${nm(lf, c.q)} is fixing your collar, ${nm(lf, pt)} opens the office door with a lunchbox.`) : L(`HR gửi email nhắc nhở về "quan hệ phù hợp nơi công sở" cho cả phòng.`, `HR emails the whole floor a reminder about "appropriate workplace relationships".`), choices: pt ? [
      { label: L('"Đang bàn chuyện hợp đồng!"', '"We\'re going over a contract!"'), outcomes: [oc(L('Người yêu bạn tin, lần này.', 'Your partner believes it, this time.'), {}, (x) => { rom(x, c.q); }, null, 0.6), oc(L('Hộp cơm rơi xuống sàn.', 'The lunchbox hits the floor.'), { happy: -8 }, (x) => { rom(x, c.q); x.queue.unshift({ sys: 'affair_exposed' }); }, null, 0.4)] },
      { label: L('Đẩy trợ lý vào phòng kho', 'Shove the assistant into the supply closet'), outcomes: [oc(L('Cửa phòng kho kêu "cạch". Một xấp giấy đổ ào. Người yêu nhướng mày nhưng không hỏi.', 'The closet door clicks. A stack of paper avalanches. Your partner raises an eyebrow but doesn\'t ask.'), { happy: 2 }, (x) => rom(x, c.q))] },
    ] : [
      { label: L('Vẫn tiếp tục, kín đáo hơn', 'Carry on, more discreetly'), outcomes: [oc(L('Hai người chuyển sang hẹn ở quán rượu ba con phố xa công ty.', 'You move your meetings to a bar three streets from work.'), { happy: 6 }, (x) => rom(x, c.q))] },
      { label: L('Dừng lại trước khi muộn', 'Stop before it\'s too late'), outcomes: [oc(L('Một quyết định khó, nhưng sự nghiệp được giữ.', 'A hard call, but your career is safe.'), { willpower: 3 })] },
    ] }; },
  }),
  S('third_party', L('Bạn mới là "người thứ ba"', "You're the other one"), L('Có người yêu (chưa cưới) từ 1 năm', 'A partner (unmarried) for 1+ year'), (lf, st) => on(st, lf) && partner(lf)?.role === 'partner' && (partner(lf).years || 0) >= 1, 0.03, (lf) => ({ pt: partner(lf) }), {
    1: (lf, c) => ({ text: L(`Một tấm ảnh lọt ra: ${nm(lf, c.pt)} đứng cạnh vợ/chồng và hai đứa con. Hai năm qua, bạn mới là người bí mật.`, `A photo slips out: ${nm(lf, c.pt)} standing beside a spouse and two kids. For two years, you were the secret.`), choices: [
      { label: L('Rời đi ngay', 'Leave at once'), outcomes: [oc(L('Bạn xóa số, xóa ảnh, và khóc ba ngày.', 'You delete the number, the photos, and cry for three days.'), { happy: -10, willpower: 5 }, (x) => breakUp(x, 'choice'))] },
      { label: L('Ở lại làm người bí mật', 'Stay as the secret'), outcomes: [oc(L('Từ nay bạn biết lịch của họ được chia làm hai.', 'From now on you know their calendar is split in two.'), { happy: -3, karma: -5 }, (x) => { c.pt.role = 'lover'; c.pt.loverSince = x.age; c.pt.wasLover = true; syncAffair(x); })] },
      { label: L('Ra mặt với gia đình kia', 'Confront the other family'), outcomes: [oc(L(`${nm(lf, c.pt)} chọn bạn. Cả khu phố bàn tán, nhưng hai người không còn phải giấu.`, `${nm(lf, c.pt)} chooses you. The neighbourhood talks, but you no longer hide.`), { happy: 6 }, (x) => { me(x).scandal = clamp(me(x).scandal + 12); cl(c.pt, 10); }, null, 0.4), oc(L(`${nm(lf, c.pt)} chọn gia đình. Bạn thành kẻ phá hoại trong mắt mọi người.`, `${nm(lf, c.pt)} chooses the family. To everyone, you're the homewrecker.`), { happy: -12 }, (x) => { me(x).scandal = clamp(me(x).scandal + 15); breakUp(x, 'event'); }, null, 0.6)] },
    ] }),
  }),
  S('elevator_boss', L('Kẹt thang máy với sếp', 'Stuck in a lift with the boss'), L('Có việc làm', 'Have a job'), (lf, st) => on(st, lf) && !!lf.team && teamPeople(lf).some((p) => p.role === 'boss' && adultOK(lf, p)), 0.05, (lf) => ({ b: byId(lf, lf.team.boss) }), {
    1: (lf, c, go) => ({ text: L(`Mất điện. Thang máy dừng giữa tầng 17 và 18, chỉ có bạn và ${nm(lf, c.b)}, sếp của bạn.`, `Power cut. The lift stops between floors 17 and 18. Just you and ${nm(lf, c.b)}, your boss.`), choices: [
      { label: L('Nói chuyện công việc', 'Talk shop'), outcomes: [oc(L('Hai tiếng thuyết trình không slide. Sếp nhớ tên dự án của bạn.', 'Two hours of slide-free pitching. The boss remembers your project.'), {}, (x) => { if (x.job) x.job.perf = clamp(x.job.perf + 6); cl(c.b, 5); })] },
      { label: L('Nói chuyện riêng', 'Talk about life'), outcomes: [oc(L('Sếp kể về cuộc hôn nhân đang lạnh dần. Khoảng cách trong thang máy nhỏ lại.', 'The boss talks about a marriage going cold. The lift feels smaller.'), {}, (x) => { fire(c.b, 25); go(x, 2); })] },
      { label: L('Ngồi im', 'Sit in silence'), outcomes: [oc(L('Hai tiếng dài nhất đời bạn.', 'The longest two hours of your life.'))] },
    ] }),
    2: (lf, c) => ({ text: L('Đèn vẫn chưa sáng. Bàn tay sếp chạm vào tay bạn trong bóng tối, và không rút lại.', 'The lights are still out. The boss\'s hand touches yours in the dark, and stays.'), choices: [
      { label: L('Siết lấy tay họ', 'Hold it'), outcomes: [oc(L('Khi cửa mở, cả hai chỉnh lại áo. Sáng hôm sau mọi thứ ở văn phòng khác hẳn.', 'When the doors open, you both straighten your clothes. Next morning, everything at work is different.'), { happy: 8 }, (x) => { rom(x, c.b); if (x.job) x.job.perf = clamp(x.job.perf + 5); risk(x, 0.2); })] },
      { label: L('Nhẹ nhàng rút tay', 'Gently pull away'), outcomes: [oc(L('Sếp gật đầu, có lẽ biết ơn vì bạn đã dừng lại.', 'The boss nods, perhaps grateful you stopped it.'), { willpower: 3 }, () => cl(c.b, 10))] },
      { label: L('Hẹn đi uống khi ra ngoài', 'Suggest drinks once you\'re out'), outcomes: [oc(L('Một lời hẹn treo lơ lửng trong bóng tối.', 'An invitation hanging in the dark.'), {}, () => { c.b.att = 'like'; fire(c.b, 15); })] },
    ] }),
  }),
  S('neighbors', L('Cặp đôi hàng xóm', 'The couple next door'), L('Có người yêu', 'Have a partner'), (lf, st) => on(st, lf) && !!partner(lf), 0.04, (lf) => ({ pt: partner(lf), a: mk(lf, 'neighbor', lf.age + randint(lf, -5, 5)), b: mk(lf, 'neighbor', lf.age + randint(lf, -5, 5)) }), {
    1: (lf, c, go) => ({ text: L(`${nm(lf, c.a)} và ${nm(lf, c.b)}, cặp đôi nhà bên, mời bạn và ${nm(lf, c.pt)} qua "uống chút rượu".`, `${nm(lf, c.a)} and ${nm(lf, c.b)}, the couple next door, invite you and ${nm(lf, c.pt)} over for "a drink".`), choices: [
      { label: L('Qua chơi', 'Go over'), outcomes: [oc(L('Chai rượu thứ hai được mở. Ánh mắt họ trao nhau đầy ẩn ý.', 'A second bottle opens. They exchange a meaningful look.'), {}, (x) => go(x, 2))] },
      { label: L('Từ chối khéo', 'Politely decline'), outcomes: [oc(L('Từ nay chạm mặt ở thang máy hơi ngượng.', 'Lift encounters get awkward from now on.'), {}, () => { cl(c.a, -3); cl(c.b, -3); })] },
    ] }),
    2: (lf, c) => { const ok = agree(lf, c.pt, (c.pt.poly ?? 30) / 110 + 0.1, true); return { text: L(`${nm(lf, c.a)} hỏi thẳng: "Hai bạn có bao giờ nghĩ đến chuyện hoán đổi chưa?"`, `${nm(lf, c.a)} asks outright: "Have you two ever thought about swapping?"`), choices: [
      { label: L(`Nhìn ${nm(lf, c.pt)} chờ câu trả lời`, `Look to ${nm(lf, c.pt)} for an answer`), outcomes: [
        oc(L(`${nm(lf, c.pt)} gật đầu. Đêm đó cách nhà bạn đúng một bức tường.`, `${nm(lf, c.pt)} nods. That night happens one wall away from home.`), { happy: 10 }, (x) => { me(x).groups++; fire(c.a, 30); fire(c.b, 30); cl(c.pt, 4); setFlag(x, 'recent_intimate'); }, null, ok),
        oc(L(`${nm(lf, c.pt)} đứng dậy: "Mình về thôi." Không khí đóng băng.`, `${nm(lf, c.pt)} stands: "We're leaving." The room freezes.`), { happy: -3 }, () => { cl(c.a, -6); cl(c.b, -6); }, null, 1 - ok),
      ] },
      { label: L('Cười và đổi chủ đề', 'Laugh and change the subject'), outcomes: [oc(L('Lời đề nghị vẫn nằm đó, chờ một tối khác.', 'The offer stays on the table, waiting for another night.'), {}, () => { fire(c.a, 15); fire(c.b, 15); })] },
    ] }; },
  }),
  S('temptation24', L('24 giờ cám dỗ', '24 hours of temptation'), L('Người lớn, bật 25+', 'Adult, 25+ on'), (lf, st) => on(st, lf), 0.03, (lf) => ({}), (() => {
    const T = [L('7 giờ sáng: người cũ nhắn "Nhớ bạn".', '7am: your ex texts "Miss you".'), L('10 giờ: đồng nghiệp hấp dẫn rủ "ăn trưa riêng".', '10am: an attractive coworker suggests a "private lunch".'), L('15 giờ: người lạ ở phòng gym xin số.', '3pm: a stranger at the gym asks for your number.'), L('20 giờ: trợ lý của đối tác gửi số phòng khách sạn.', "8pm: a client's assistant sends their hotel room number."), L('23 giờ: người yêu của bạn thân hỏi "ngủ chưa?".', '11pm: your best friend\'s partner asks "you up?".')];
    const st = {};
    T.forEach((t, i) => { st[i + 1] = (lf, c, go, item) => ({ text: L(`${t.vi} (${i + 1}/5)`, `${t.en} (${i + 1}/5)`), choices: [
      { label: L('Giữ mình', 'Resist'), outcomes: [oc(L('Bạn cất điện thoại.', 'You put the phone away.'), { willpower: 2 }, (x) => { item.r2 = (item.r2 || 0) + 1; go(x, i + 2); })] },
      { label: L('Buông', 'Give in'), outcomes: [oc(L('Một lần thôi mà.', 'Just this once.'), { happy: 4, karma: -2 }, (x) => { setFlag(x, 'recent_intimate'); if (chance(x, 0.3)) { const p = mk(x, 'contact', x.age + randint(x, -8, 8)); rom(x, p); } go(x, i + 2); })] },
    ] }); });
    st[6] = (lf, c, go, item) => { const k = item.r2 || 0; return { text: L(`Nửa đêm. Bạn đã giữ mình ${k}/5 lần.`, `Midnight. You resisted ${k} out of 5.`), choices: [{ label: L('Đi ngủ', 'Go to sleep'), outcomes: [oc(k === 5 ? L('Ý chí thép. Sáng mai bạn thức dậy như một người khác.', 'Nerves of steel. You wake up a different person.') : k >= 3 ? L('Không hoàn hảo, nhưng bạn vẫn là bạn.', 'Not perfect, but still you.') : L('Một ngày dài để kể lại cho không ai cả.', 'A long day to tell nobody about.'), k === 5 ? { willpower: 10, karma: 5 } : k >= 3 ? { willpower: 3 } : { karma: -4 }, (x) => { if (k <= 1) me(x).scandal = clamp(me(x).scandal + 6); })] }] }; };
    return st;
  })()),
  S('circle', L('Vòng tròn khép kín', 'Full circle'), L('Có vợ/chồng hoặc người yêu và ít nhất một người tình', 'A partner and at least one lover'), (lf, st) => on(st, lf) && !!partner(lf) && lovers(lf).length > 0 && !polyOk(lf), 0.03, (lf) => ({ pt: partner(lf), lv: pick(lf, lovers(lf)) }), {
    1: (lf, c) => ({ text: L(`Bạn lén mở điện thoại của ${nm(lf, c.lv)} và thấy tin nhắn từ… ${nm(lf, c.pt)}. Người tình của bạn cũng là người tình bí mật của chính người yêu bạn.`, `You sneak a look at ${nm(lf, c.lv)}'s phone and see messages from… ${nm(lf, c.pt)}. Your lover is also your partner's secret lover.`), choices: [
      { label: L('Đối chất cả hai cùng lúc', 'Confront them both at once'), outcomes: [oc(L('Ba người, một bàn ăn, không ai dám cầm đũa.', 'Three people, one table, nobody dares pick up a fork.'), { happy: -8 }, (x) => { cl(c.pt, -20); cl(c.lv, -20); if (chance(x, 0.5)) breakUp(x, 'event'); })] },
      { label: L('Giả vờ không biết, quan sát', 'Pretend not to know, and watch'), outcomes: [oc(L('Từ nay bạn biết họ nói dối thế nào, vì bạn cũng đang nói dối y như vậy.', "Now you know how they lie, because you're lying exactly the same way."), { willpower: 3 })] },
      { label: L('Đề nghị "cả ba chúng ta"', 'Propose "the three of us"'), outcomes: [
        oc(L('Một khoảng lặng rất dài. Rồi cả hai cùng bật cười.', 'A very long silence. Then they both burst out laughing.'), { happy: 10 }, (x) => { setFlag(x, 'open_rel'); prof(c.lv).knows = true; cl(c.pt, 5); cl(c.lv, 5); }, null, Math.min(agree(lf, c.pt, 0.35, true), agree(lf, c.lv, 0.45, true))),
        oc(L('Cả hai đứng dậy bỏ đi, mỗi người một hướng.', 'They both get up and leave, in different directions.'), { happy: -10 }, (x) => { breakUp(x, 'event'); endLover(x, c.lv); }, null, 1 - Math.min(agree(lf, c.pt, 0.35, true), agree(lf, c.lv, 0.45, true))),
      ] },
    ] }),
  }),
  S('storm_house', L('Bão nhốt cả nhà', 'Storm-bound with everyone'), L('Có hậu cung và một người tình ngoài hậu cung', 'A harem plus a lover outside it'), (lf, st) => on(st, lf) && members(lf).length >= 2 && lovers(lf).some((p) => !inHarem(lf, p)), 0.05, (lf) => ({ lv: pick(lf, lovers(lf).filter((p) => !inHarem(lf, p))) }), {
    1: (lf, c) => ({ text: L(`Bão lớn cắt đường ba ngày. Trong biệt thự có cả hậu cung, và ${nm(lf, c.lv)}, người tình chưa ai biết, vừa ghé qua đúng lúc.`, `A huge storm cuts the roads for three days. In the house: the whole harem, and ${nm(lf, c.lv)}, the lover nobody knows about, who dropped by at exactly the wrong time.`), choices: [
      { label: L('Giấu họ trong phòng khách', 'Hide them in the guest room'), outcomes: [oc(L('Ba ngày rón rén. Không ai phát hiện, kỳ diệu thay.', 'Three days of tiptoeing. Miraculously, nobody finds out.'), { happy: 3 }, null, null, 0.4), oc(L('Ngày thứ hai, một thành viên mở nhầm cửa phòng khách.', 'Day two: a harem member opens the guest room door.'), { happy: -8 }, (x) => { hstate(x).harmony = clamp(hstate(x).harmony - 15); for (const p of members(x)) hm(p).favor = clamp(hm(p).favor - 5); }, null, 0.6)] },
      { label: L('Giới thiệu thẳng với cả nhà', 'Introduce them to everyone'), outcomes: [oc(L('Ba ngày bị nhốt chung biến người lạ thành người nhà.', 'Three days locked in together turns a stranger into family.'), { happy: 6 }, (x) => { const h = hstate(x); h.members.push(c.lv.id); hm(c.lv).rank = 3; hm(c.lv).last = x.age; h.harmony = clamp(h.harmony - 5); }, null, 0.55), oc(L('Cả nhà lạnh lùng. Bão tan, người tình ra đi.', 'The family goes cold. When the storm passes, the lover leaves.'), { happy: -5 }, (x) => endLover(x, c.lv), null, 0.45)] },
    ] }),
  }),
  S('bestie_lover_flirt', L('Người yêu của bạn thân', "Your best friend's partner"), L('Có bạn thân', 'Have a best friend'), (lf, st) => on(st, lf) && has(lf, ['bestie']), 0.04, (lf) => ({ bf: pick(lf, adults(lf, ['bestie'])), q: mk(lf, 'contact', lf.age + randint(lf, -4, 4), { tag: 'bestiesPartner' }) }), {
    1: (lf, c) => ({ text: L(`${nm(lf, c.q)}, người yêu của ${nm(lf, c.bf)}, kéo bạn vào bếp trong bữa tiệc: "Mình nghĩ mình chọn nhầm người."`, `${nm(lf, c.q)}, ${nm(lf, c.bf)}'s partner, pulls you into the kitchen at a party: "I think I picked the wrong one."`), choices: [
      { label: L('Đáp lại', 'Respond'), outcomes: [oc(L('Một bí mật mà nếu lộ ra, bạn sẽ mất người bạn thân nhất.', "A secret that, if it gets out, costs you your best friend."), { happy: 7, karma: -6 }, (x) => { rom(x, c.q); if (chance(x, 0.3)) { c.bf.closeness = 0; c.bf.att = 'hate'; addLog(x, L(`${nm(x, c.bf)} phát hiện. Tình bạn kết thúc.`, `${nm(x, c.bf)} finds out. The friendship is over.`), 'bad'); } })] },
      { label: L(`Kể với ${nm(lf, c.bf)}`, `Tell ${nm(lf, c.bf)}`), outcomes: [oc(L('Bạn thân khóc, rồi cảm ơn bạn. Hai người thân hơn bao giờ hết.', 'Your best friend cries, then thanks you. You\'re closer than ever.'), { karma: 4 }, () => { cl(c.bf, 15); c.q.att = 'hate'; })] },
      { label: L('Lảng đi', 'Walk away'), outcomes: [oc(L('Bạn quay lại phòng khách, tim vẫn đập nhanh.', 'You go back to the living room, heart still racing.'), {}, () => fire(c.q, 15))] },
    ] }),
  }),
  S('flatmate', L('Bạn ở ghép', 'The flatmate'), L('Chưa có nhà riêng', 'No home of your own'), (lf, st) => on(st, lf) && !(lf.homes || []).length && lf.age <= 45, 0.05, (lf) => ({ q: mk(lf, 'contact', lf.age + randint(lf, -4, 4), { tag: 'flatmate' }) }), {
    1: (lf, c) => ({ text: L(`Bạn ở ghép với ${nm(lf, c.q)}. Nội quy dán ở cửa: "Không yêu nhau trong nhà." Tuần thứ ba, họ đi ra từ phòng tắm chỉ quấn một chiếc khăn.`, `You share a flat with ${nm(lf, c.q)}. The rule on the door: "No dating in the house." Week three, they walk out of the bathroom in just a towel.`), choices: [
      { label: L('Phá luật', 'Break the rule'), outcomes: [oc(L('Tấm giấy nội quy rơi xuống sàn lúc nào không ai biết.', 'Nobody notices when the rule sheet falls off the door.'), { happy: 9 }, (x) => rom(x, c.q))] },
      { label: L('Giữ luật', 'Keep the rule'), outcomes: [oc(L('Một sự căng thẳng ngọt ngào kéo dài hết hợp đồng thuê nhà.', 'A sweet tension that lasts the whole lease.'), { willpower: 3 }, () => { fire(c.q, 30); c.q.att = 'crush'; })] },
      { label: L('Đề nghị một "ngoại lệ một lần"', 'Propose a "one-time exception"'), outcomes: [oc(L('Ngoại lệ một lần thành ngoại lệ mỗi thứ Bảy.', 'One exception becomes every Saturday.'), { happy: 7 }, (x) => { fire(c.q, 25); setFlag(x, 'recent_intimate'); c.q.att = 'like'; })] },
    ] }),
  }),
  S('trainer', L('Huấn luyện viên riêng', 'The personal trainer'), L('Người lớn, bật 25+', 'Adult, 25+ on'), (lf, st) => on(st, lf), 0.04, (lf) => ({ q: mk(lf, 'contact', lf.age + randint(lf, -8, 5), { tag: 'trainer' }) }), {
    1: (lf, c) => ({ text: L(`${nm(lf, c.q)}, huấn luyện viên riêng, chỉnh tư thế cho bạn bằng hai tay, mỗi tuần một gần hơn.${partner(lf) ? ` ${nm(lf, partner(lf))} hỏi sao dạo này bạn đi tập chăm thế.` : ''}`, `${nm(lf, c.q)}, your trainer, corrects your form hands-on, a little closer every week.${partner(lf) ? ` ${nm(lf, partner(lf))} asks why you're so keen on the gym lately.` : ''}`), choices: [
      { label: L('Ở lại sau buổi tập', 'Stay after the session'), outcomes: [oc(L('Phòng thay đồ vắng người. Dẻo dai của bạn tăng theo một cách rất khác.', 'The changing room is empty. Your flexibility improves in a very different way.'), { happy: 8, health: 2 }, (x) => { rom(x, c.q); me(x).flex = clamp(me(x).flex + 4); risk(x, 0.15); })] },
      { label: L('Chỉ tập', 'Just train'), outcomes: [oc(L('Cơ thể bạn đẹp nhất từ trước đến nay.', 'You\'re in the best shape of your life.'), { health: 5, looks: 2 }, (x) => { me(x).flex = clamp(me(x).flex + 6); fire(c.q, 10); })] },
    ] }),
  }),
  S('partner_sibling', L('Anh/chị/em của người yêu', "Your partner's sibling"), L('Có người yêu', 'Have a partner'), (lf, st) => on(st, lf) && !!partner(lf), 0.04, (lf) => ({ pt: partner(lf), q: mk(lf, 'contact', partner(lf).age + randint(lf, -6, 6), { tag: 'partnerSibling', last: partner(lf).last }) }), {
    1: (lf, c) => ({ text: L(`Kỳ nghỉ Tết ở nhà ${nm(lf, c.pt)}. ${nm(lf, c.q)}, anh/chị/em ruột của người yêu bạn, nhìn bạn qua mâm cơm lâu hơn mức cần thiết.`, `Holidays at ${nm(lf, c.pt)}'s family home. ${nm(lf, c.q)}, your partner's sibling, holds your gaze across the dinner table longer than necessary.`), choices: [
      { label: L('Ra ban công nói chuyện riêng', 'Talk privately on the balcony'), outcomes: [oc(L('Một bí mật mà nếu lộ ra sẽ chia đôi cả gia đình họ.', 'A secret that would split their whole family in two.'), { happy: 7, karma: -7 }, (x) => { rom(x, c.q); risk(x, 0.3); })] },
      { label: L('Tránh mặt cả kỳ nghỉ', 'Avoid them all holiday'), outcomes: [oc(L('Bạn dính lấy người yêu suốt ba ngày.', 'You stick to your partner for three straight days.'), {}, (x) => { cl(c.pt, 4); fire(c.q, 12); })] },
      { label: L(`Kể với ${nm(lf, c.pt)}`, `Tell ${nm(lf, c.pt)}`), outcomes: [oc(L('Một cuộc cãi vã lớn trong gia đình họ. Người yêu đứng về phía bạn.', 'A big row in their family. Your partner takes your side.'), { karma: 3 }, () => { cl(c.pt, 6); c.q.att = 'hate'; })] },
    ] }),
  }),
  S('houseguest', L('Người bạn cũ đến ở nhờ', 'The old friend who moves in'), L('Có người yêu', 'Have a partner'), (lf, st) => on(st, lf) && !!partner(lf), 0.04, (lf) => ({ pt: partner(lf), q: mk(lf, 'friend', lf.age + randint(lf, -3, 3)) }), {
    1: (lf, c) => ({ text: L(`${nm(lf, c.q)} vừa chia tay, xin ở nhờ "một tháng thôi". Ba tháng sau, họ vẫn ở đó, và ${nm(lf, c.pt)} bắt đầu thấy ánh mắt hai người không ổn.`, `${nm(lf, c.q)}, freshly single, asks to stay "just a month". Three months later they're still there, and ${nm(lf, c.pt)} doesn't like how you two look at each other.`), choices: [
      { label: L('Một đêm khi người yêu đi công tác…', 'One night while your partner is away…'), outcomes: [oc(L('Chiếc sofa phòng khách chứng kiến tất cả.', 'The living-room sofa sees everything.'), { happy: 7, karma: -5 }, (x) => { rom(x, c.q); risk(x, 0.35); })] },
      { label: L('Nhờ họ dọn đi', 'Ask them to move out'), outcomes: [oc(L('Họ dọn đi với vẻ buồn. Người yêu bạn thở phào.', 'They move out looking sad. Your partner breathes again.'), {}, () => { cl(c.pt, 5); cl(c.q, -5); })] },
      { label: L('Giới thiệu họ cho người khác', 'Set them up with someone'), outcomes: [oc(L('Họ có người yêu mới và dọn đi trong tuần.', 'They find someone and move out within the week.'), { happy: 3 }, () => cl(c.q, 5))] },
    ] }),
  }),
  S('butler', L('Quản gia sống trong nhà', 'The live-in housekeeper'), L('Rất giàu', 'Very wealthy'), (lf, st) => on(st, lf) && lf.money >= u(lf, 3000), 0.04, (lf) => ({ q: mk(lf, 'contact', lf.age + randint(lf, -10, 5), { tag: 'butler' }) }), {
    1: (lf, c) => ({ text: L(`${nm(lf, c.q)}, quản gia mới, biết bạn uống cà phê thế nào, về nhà lúc mấy giờ, và ai đã ở lại qua đêm.`, `${nm(lf, c.q)}, your new housekeeper, knows how you take your coffee, when you come home, and who stayed the night.`), choices: [
      { label: L('Để mọi chuyện đi xa hơn', 'Let it go further'), outcomes: [oc(L('Người hiểu bạn nhất trong nhà giờ là người gần bạn nhất.', 'The one who knows you best is now the one closest to you.'), { happy: 8 }, (x) => { rom(x, c.q); })] },
      { label: L('Giữ đúng vai chủ và người làm', 'Keep it strictly professional'), outcomes: [oc(L('Ngôi nhà vận hành hoàn hảo.', 'The house runs perfectly.'), { willpower: 3 }, () => cl(c.q, 5)), oc(L('Một tháng sau họ xin tăng lương "vì biết nhiều chuyện". Bạn tăng.', 'A month later they ask for a raise "given everything I know". You give it.'), { money: -20 }, null, null, 0)] },
    ] }),
  }),
  S('tent', L('Lều cắm trại chật', 'One tent too few'), L('Có bạn bè người lớn', 'Adult friends'), (lf, st) => on(st, lf) && has(lf, ['friend', 'bestie', 'coworker', 'contact']), 0.04, (lf) => ({ q: pick(lf, adults(lf, ['friend', 'coworker', 'contact'])) || mk(lf, 'friend', lf.age) }), {
    1: (lf, c) => ({ text: L(`Gió thổi bay một chiếc lều. Bạn phải ngủ chung lều với ${nm(lf, c.q)}, chung một túi ngủ đôi.`, `The wind takes a tent. You end up sharing with ${nm(lf, c.q)}, one double sleeping bag.`), choices: [
      { label: L('Ôm cho đỡ lạnh', 'Huddle for warmth'), outcomes: [oc(L('Lạnh thì không còn lạnh nữa.', 'Not cold anymore.'), { happy: 7 }, (x) => { fire(c.q, 30); if (chance(x, agree(x, c.q, 0.4, true))) rom(x, c.q); })] },
      { label: L('Quay lưng, ngủ', 'Turn over and sleep'), outcomes: [oc(L('Cả hai giả vờ ngủ đến sáng.', 'You both pretend to sleep until dawn.'), {}, () => fire(c.q, 15))] },
    ] }),
  }),
  S('karaoke', L('Phòng karaoke VIP', 'The VIP karaoke room'), L('Có việc làm', 'Have a job'), (lf, st) => on(st, lf) && !!lf.job, 0.04, (lf) => ({ q: pick(lf, adults(lf, ['coworker'])) || mk(lf, 'coworker', lf.age) }), {
    1: (lf, c) => ({ text: L(`Tiệc công ty, phòng karaoke kín, trò uống rượu. Đến 2 giờ sáng chỉ còn bạn và ${nm(lf, c.q)}, người bạn đang cố tránh.`, `Office party, private karaoke room, drinking games. By 2am it's just you and ${nm(lf, c.q)}, the one you've been trying to avoid.`), choices: [
      { label: L('Song ca bài tình ca', 'Duet on a love song'), outcomes: [oc(L('Đến điệp khúc cuối, micro đã nằm trên bàn.', 'By the last chorus, the mics are on the table.'), { happy: 7 }, (x) => { rom(x, c.q); risk(x, 0.2); })] },
      { label: L('Gọi taxi về', 'Call a taxi'), outcomes: [oc(L('Bạn về nhà kịp trước khi làm điều gì đáng tiếc.', 'You get home before doing anything regrettable.'), { willpower: 3 }, () => fire(c.q, 10))] },
    ] }),
  }),
  S('work_trip', L('Công tác chung một tuần', 'A week-long work trip'), L('Có việc làm', 'Have a job'), (lf, st) => on(st, lf) && !!lf.job, 0.04, (lf) => ({ q: pick(lf, adults(lf, ['coworker'])) || mk(lf, 'coworker', lf.age) }), {
    1: (lf, c, go) => ({ text: L(`Một tuần công tác nước ngoài với ${nm(lf, c.q)}. Hai phòng khách sạn có cửa thông nhau.`, `A week abroad with ${nm(lf, c.q)}. Two hotel rooms with a connecting door.`), choices: [
      { label: L('Để ý cánh cửa ấy', 'Notice that door'), outcomes: [oc(L('Mỗi tối hai người ăn tối cùng nhau, về muộn hơn hôm trước.', 'Every evening you eat together, getting back later each night.'), {}, (x) => { fire(c.q, 20); go(x, 2); })] },
      { label: L('Khóa cửa thông phòng', 'Lock the connecting door'), outcomes: [oc(L('Một chuyến công tác hiệu quả nhất năm.', 'The most productive trip of the year.'), { willpower: 2 }, (x) => { if (x.job) x.job.perf = clamp(x.job.perf + 5); })] },
    ] }),
    2: (lf, c) => ({ text: L('Đêm thứ năm, có tiếng gõ nhẹ từ phía cánh cửa thông phòng.', 'Night five: a soft knock on the connecting door.'), choices: [
      { label: L('Mở cửa', 'Open it'), outcomes: [oc(L('Hai đêm cuối của chuyến công tác không ai ngủ phòng mình.', 'For the last two nights, neither of you sleeps in your own room.'), { happy: 9 }, (x) => { rom(x, c.q); risk(x, 0.15); })] },
      { label: L('Giả vờ đã ngủ', 'Pretend to be asleep'), outcomes: [oc(L('Tiếng gõ dừng lại. Sáng ra họ cười như không có gì.', 'The knocking stops. In the morning they smile like nothing happened.'), {}, () => fire(c.q, 10))] },
    ] }),
  }),
  S('bridesmaid', L('Phù dâu và phù rể', 'Best man, maid of honour'), L('Có bạn bè', 'Have friends'), (lf, st) => on(st, lf) && has(lf, ['friend', 'bestie']), 0.04, (lf) => ({ q: mk(lf, 'contact', lf.age + randint(lf, -4, 4)) }), {
    1: (lf, c) => ({ text: L(`Ở đám cưới bạn thân, bạn làm phù dâu/phù rể cùng ${nm(lf, c.q)}. Hai người hợp đến mức cô dâu chú rể trêu suốt buổi.`, `At your best friend's wedding, you're in the wedding party with ${nm(lf, c.q)}. You click so well the couple teases you all night.`), choices: [
      { label: L('Đi after party, rồi về phòng khách sạn', 'After party, then the hotel room'), outcomes: [oc(L('Sáng hôm sau, cả hai xuất hiện ở bữa sáng với cùng một bộ đồ hôm qua.', 'Next morning you both show up to breakfast in yesterday\'s clothes.'), { happy: 9 }, (x) => { rom(x, c.q); risk(x, 0.2); })] },
      { label: L('Xin số, hẹn sau', 'Get their number for later'), outcomes: [oc(L('Một tin nhắn "về đến nhà chưa?" lúc 3 giờ sáng.', 'A "home safe?" text at 3am.'), { happy: 4 }, () => { c.q.att = 'crush'; fire(c.q, 30); })] },
    ] }),
  }),
  S('titfortat', L('Ăn miếng trả miếng', 'Tit for tat'), L('Có vợ/chồng và người tình', 'A spouse and a lover'), (lf, st) => on(st, lf) && !!spouse(lf) && lovers(lf).length > 0 && !polyOk(lf), 0.04, (lf) => ({ sp: spouse(lf) }), {
    1: (lf, c) => ({ text: L(`${nm(lf, c.sp)} biết hết. Không khóc, không đòi ly hôn, chỉ nói: "Vậy thì mình cũng sẽ có người khác."`, `${nm(lf, c.sp)} knows everything. No tears, no divorce papers. Just: "Then I'll have someone too."`), choices: [
      { label: L('"Được thôi."', '"Fine."'), outcomes: [oc(L('Từ nay hai người sống chung một nhà, mỗi người một lịch hẹn riêng.', 'From now on you share a house and keep separate calendars.'), { happy: -3 }, (x) => { setFlag(x, 'open_rel'); const p = mk(x, 'contact', c.sp.age + randint(x, -6, 6)); p.tag = 'spouseLover'; cl(c.sp, -10); addLog(x, L(`${nm(x, c.sp)} bắt đầu hẹn hò với ${nm(x, p)}.`, `${nm(x, c.sp)} starts seeing ${nm(x, p)}.`)); })] },
      { label: L('Xin tha thứ, chấm dứt tất cả', 'Beg forgiveness and end it all'), outcomes: [oc(L('Bạn chấm dứt với mọi người tình. Một khởi đầu mới, mong manh.', 'You end it with every lover. A fragile fresh start.'), { happy: -6, karma: 5 }, (x) => { endAllLovers(x); cl(c.sp, 8); })] },
      { label: L('Ly hôn', 'Divorce'), outcomes: [oc(L('Luật sư hai bên bắt đầu làm việc.', 'The lawyers get to work.'), { happy: -10 }, (x) => breakUp(x, 'event'))] },
    ] }),
  }),
  S('partner_bestie', L('Người yêu thích bạn thân của bạn', 'Your partner and your best friend'), L('Có người yêu và bạn thân', 'A partner and a best friend'), (lf, st) => on(st, lf) && !!partner(lf) && has(lf, ['bestie']), 0.03, (lf) => ({ pt: partner(lf), bf: pick(lf, adults(lf, ['bestie'])) }), {
    1: (lf, c) => ({ text: L(`Bạn bắt gặp ${nm(lf, c.pt)} và ${nm(lf, c.bf)} đứng rất gần nhau trong bếp. Họ giật mình tách ra.`, `You catch ${nm(lf, c.pt)} and ${nm(lf, c.bf)} standing very close in the kitchen. They jump apart.`), choices: [
      { label: L('Đối chất', 'Confront them'), outcomes: [oc(L('Hai người thừa nhận đã có tình cảm. Bạn mất cả hai trong một buổi tối.', 'They admit their feelings. You lose both in one evening.'), { happy: -12 }, (x) => { breakUp(x, 'event'); c.bf.att = 'hate'; c.bf.closeness = 5; }, null, 0.5), oc(L('Hóa ra họ đang lén lên kế hoạch sinh nhật bất ngờ cho bạn.', 'Turns out they were secretly planning your surprise party.'), { happy: 6 }, () => { cl(c.pt, 5); cl(c.bf, 5); }, null, 0.5)] },
      { label: L('Giả vờ không biết, trả đũa', 'Pretend you saw nothing, then get even'), outcomes: [oc(L('Bạn tìm một người khác. Ăn miếng trả miếng.', 'You find someone else. Tit for tat.'), { happy: 3, karma: -5 }, (x) => { const p = mk(x, 'contact', x.age + randint(x, -6, 6)); rom(x, p); })] },
      { label: L('Buông cả hai', 'Let them both go'), outcomes: [oc(L('Bạn rời đi, mang theo lòng tự trọng.', 'You walk away with your dignity.'), { willpower: 6, happy: -6 }, (x) => { breakUp(x, 'choice'); c.bf.cut = true; })] },
    ] }),
  }),
  S('elevator_lovers', L('Kẹt thang máy với hai người tình', 'Stuck between two lovers'), L('Có ít nhất hai người tình bí mật', 'Two or more secret lovers'), (lf, st) => on(st, lf) && lovers(lf).length >= 2 && !polyOk(lf), 0.05, (lf) => { const ls = lovers(lf); return { a: ls[0], b: ls[1] }; }, {
    1: (lf, c) => ({ text: L(`Cửa thang máy mở: ${nm(lf, c.a)} bên trái, ${nm(lf, c.b)} bên phải, họ không biết nhau. Bạn đứng giữa. Ba mươi tầng.`, `The lift opens: ${nm(lf, c.a)} on the left, ${nm(lf, c.b)} on the right. They don't know each other. You in the middle. Thirty floors.`), choices: [
      { label: L('Bình tĩnh, chào cả hai như người quen', 'Stay calm, greet both like acquaintances'), outcomes: [oc(L('Ba mươi tầng dài nhất đời bạn, nhưng không ai nghi ngờ.', 'The longest thirty floors of your life, but nobody suspects.'), { willpower: 3 }, null, null, 0.5), oc(L('Cả hai cùng gọi tên thân mật của bạn. Rồi nhìn nhau.', 'They both use your pet name. Then look at each other.'), { happy: -8 }, () => { prof(c.a).knows = true; prof(c.b).knows = true; cl(c.a, -15); cl(c.b, -15); }, null, 0.5)] },
      { label: L('Giả vờ nghe điện thoại', 'Fake a phone call'), outcomes: [oc(L('Bạn nói chuyện với "khách hàng" suốt 30 tầng.', 'You chat with a "client" for 30 floors.'), {}, null)] },
      { label: L('Xuống ở tầng kế tiếp', 'Get off at the next floor'), outcomes: [oc(L('Bạn leo bộ 29 tầng còn lại.', 'You take the stairs for the remaining 29.'), { health: 2 })] },
    ] }),
  }),
  S('old_letters', L('Thư tình cũ', 'Old love letters'), L('Có người yêu và từng có người cũ', 'A partner and an ex'), (lf, st) => on(st, lf) && !!partner(lf) && has(lf, ['ex', 'contact']), 0.04, (lf) => ({ pt: partner(lf), q: pick(lf, adults(lf, ['ex'])) || pick(lf, adults(lf, ['contact'])) }), {
    1: (lf, c) => ({ text: L(`Dọn nhà, ${nm(lf, c.pt)} tìm thấy một hộp thư tình cũ. Người viết là ${nm(lf, c.q)}, người họ biết rất rõ.`, `Clearing out, ${nm(lf, c.pt)} finds a box of old love letters. The writer is ${nm(lf, c.q)}, someone they know very well.`), choices: [
      { label: L('Kể thật mọi chuyện', 'Tell the whole truth'), outcomes: [oc(L('Người yêu im lặng rất lâu, rồi gật đầu: "Cảm ơn vì đã thành thật."', 'A long silence, then a nod: "Thank you for being honest."'), {}, () => cl(c.pt, -3), null, agree(lf, c.pt, 0.6)), oc(L('"Bạn vẫn còn giữ chúng. Vì sao?" Câu hỏi không có lời đáp.', '"You kept them. Why?" There\'s no answer.'), { happy: -6 }, () => cl(c.pt, -12), null, 1 - agree(lf, c.pt, 0.6))] },
      { label: L('Đốt hết trước mặt người yêu', 'Burn them in front of your partner'), outcomes: [oc(L('Ngọn lửa nhỏ, ý nghĩa lớn.', 'A small fire, a big gesture.'), { happy: 2 }, () => cl(c.pt, 5))] },
      { label: L('Nói là thư giả', 'Claim they\'re fake'), outcomes: [oc(L('Không ai tin.', 'Nobody believes you.'), { karma: -3 }, () => cl(c.pt, -10))] },
    ] }),
  }),
  S('twin_news', L('Hai người cùng có thai', 'Two pregnancies at once'), L('Hậu cung có từ 2 người khác giới với bạn, dưới 46 tuổi', 'Harem with 2+ opposite-gender members under 46'), (lf, st) => on(st, lf) && members(lf).filter((p) => p.gender !== lf.gender && p.age <= 45).length >= 2, 0.05, (lf) => { const c = members(lf).filter((p) => p.gender !== lf.gender && p.age <= 45); return { a: c[0], b: c[1] }; }, {
    1: (lf, c) => ({ text: L(`${nm(lf, c.a)} và ${nm(lf, c.b)} cùng báo tin vui trong một tuần. Cuộc tranh ngôi bắt đầu từ trong bụng.`, `${nm(lf, c.a)} and ${nm(lf, c.b)} announce pregnancies in the same week. The race for rank starts in the womb.`), choices: [
      { label: L('Hai con được đối xử như nhau', 'Both children treated equally'), outcomes: [oc(L('Hai đứa trẻ chào đời cách nhau ba ngày, nằm cạnh nhau trong một phòng.', 'Two babies born three days apart, side by side in one nursery.'), { happy: 12 }, (x) => { addChild(x, c.a.id); addChild(x, c.b.id); hstate(x).harmony = clamp(hstate(x).harmony + 6); })] },
      { label: L('Ưu tiên người có ngôi cao hơn', 'Favour the higher-ranked one'), outcomes: [oc(L('Một người hãnh diện, một người ghi thù.', 'One beams, one holds a grudge.'), { happy: 8 }, (x) => { addChild(x, c.a.id); addChild(x, c.b.id); const lo = hm(c.a).rank > hm(c.b).rank ? c.a : c.b; hm(lo).mood = clamp(hm(lo).mood - 20); setRel(x, c.a, c.b, relOf(x, c.a, c.b) - 25); })] },
    ] }),
  }),
  S('charmer', L('Người mới làm cả nhà mê', 'The newcomer everyone falls for'), L('Hậu cung từ 3 người', 'Harem of 3+'), (lf, st) => on(st, lf) && members(lf).length >= 3, 0.05, (lf) => ({ q: members(lf)[members(lf).length - 1] }), {
    1: (lf, c) => ({ text: L(`${nm(lf, c.q)} mới vào hậu cung, nhưng không chỉ bạn bị cuốn hút. Từng người trong nhà đều tìm cớ ngồi cạnh họ.`, `${nm(lf, c.q)} only just joined, but you're not the only one smitten. Everyone in the house finds excuses to sit beside them.`), choices: [
      { label: L('Để mọi chuyện tự nhiên', 'Let it unfold'), outcomes: [oc(L('Ngôi nhà ấm áp hẳn lên, dù trật tự cũ bị đảo lộn.', 'The house warms up, even as the old order is turned upside down.'), { happy: 4 }, (x) => { for (const p of members(x)) if (p !== c.q) setRel(x, p, c.q, relOf(x, p, c.q) + 25); hstate(x).harmony = clamp(hstate(x).harmony + 5); hm(c.q).favor = clamp(hm(c.q).favor + 10); })] },
      { label: L('Phong họ lên ngôi cao ngay', 'Promote them right away'), outcomes: [oc(L('Người cũ bất bình. Người mới mỉm cười bí ẩn.', 'The old guard grumbles. The newcomer smiles mysteriously.'), {}, (x) => { hm(c.q).rank = Math.max(1, hm(c.q).rank - 2); hstate(x).harmony = clamp(hstate(x).harmony - 8); })] },
      { label: L('Nhắc khéo ai mới là trung tâm', 'Remind everyone who is the centre here'), outcomes: [oc(L('Mọi người quay về phía bạn, hơi ngượng.', 'Everyone turns back to you, a little sheepish.'), { willpower: 2 }, (x) => { for (const p of members(x)) hm(p).favor = clamp(hm(p).favor + 3); })] },
    ] }),
  }),
  S('other_harem', L('Gặp một hậu cung khác', 'Meeting another harem'), L('Hậu cung từ 2 người', 'Harem of 2+'), (lf, st) => on(st, lf) && members(lf).length >= 2, 0.05, (lf) => ({ q: mk(lf, 'contact', lf.age + randint(lf, -8, 8), { tag: 'otherHarem' }) }), {
    1: (lf, c) => ({ text: L(`Trên một chiếc du thuyền, bạn gặp ${nm(lf, c.q)} cùng "gia đình" năm người của họ. Hai nhà nhìn nhau đầy tò mò.`, `On a yacht you meet ${nm(lf, c.q)} and their five-person "family". The two households eye each other with curiosity.`), choices: [
      { label: L('Giao lưu hai nhà', 'Socialise'), outcomes: [oc(L('Một bữa tối dài, hai nhà trao đổi kinh nghiệm giữ hòa khí.', 'A long dinner swapping tips on keeping the peace.'), { happy: 6 }, (x) => { hstate(x).harmony = clamp(hstate(x).harmony + 6); cl(c.q, 10); })] },
      { label: L('Đổi thành viên một đêm (ai đồng ý thì tham gia)', 'Swap for a night (only those who agree)'), outcomes: [oc(L('Vài người đồng ý, vài người ở lại boong tàu ngắm sao. Sáng ra ai cũng có chuyện để kể.', 'Some say yes, some stay on deck stargazing. In the morning everyone has a story.'), { happy: 9 }, (x) => { for (const p of members(x)) { if (chance(x, agree(x, p, (p.poly ?? 30) / 120 + 0.2, true))) fire(p, 10); else hm(p).mood = clamp(hm(p).mood - 4); } me(x).groups++; })] },
      { label: L('Ganh đua xem nhà nào hạnh phúc hơn', 'Compete over whose family is happier'), outcomes: [oc(hstate(lf).harmony >= 60 ? L('Nhà bạn thắng áp đảo. Một thành viên nhà kia xin chuyển sang.', 'Your family wins by a mile. One of theirs asks to switch sides.') : L('Nhà kia rõ ràng hòa thuận hơn. Cả nhà bạn im lặng trên đường về.', 'Their family is clearly happier. Your household is quiet on the way home.'), {}, (x) => { if (hstate(x).harmony >= 60) { const p = mk(x, 'contact', x.age + randint(x, -6, 6)); p.att = 'like'; p.poly = 85; fire(p, 50); hstate(x).harmony = clamp(hstate(x).harmony + 5); } else hstate(x).harmony = clamp(hstate(x).harmony - 6); })] },
    ] }),
  }),
  S('exposed_harem', L('Hậu cung bị lộ ra ngoài', 'The harem goes public'), L('Hậu cung từ 4 người', 'Harem of 4+'), (lf, st) => on(st, lf) && members(lf).length >= 4, 0.06, () => ({}), {
    1: (lf) => ({ text: L(`Một tờ báo lá cải đăng ảnh "ngôi nhà ${members(lf).length} người" của bạn. Paparazzi đứng kín trước cổng.`, `A tabloid runs photos of your "${members(lf).length}-person household". Paparazzi crowd the gate.`), choices: [
      { label: L('Đón nhận, trả lời phỏng vấn', 'Embrace it, give interviews'), outcomes: [oc(L('Một show thực tế mời cả nhà tham gia. Người theo dõi tăng vọt.', 'A reality show invites the whole household. Followers explode.'), { happy: 5, fame: 10 }, (x) => { x.social ||= { followers: 0, posts: 0 }; x.social.followers = Math.round(x.social.followers * 2 + 20000); me(x).scandal = clamp(me(x).scandal + 10); })] },
      { label: L('Giấu kín, dọn đi chỗ khác', 'Go private, move somewhere quieter'), outcomes: [oc(L('Tốn kém, nhưng yên tĩnh trở lại.', 'Expensive, but peaceful again.'), { money: -80 }, (x) => { hstate(x).harmony = clamp(hstate(x).harmony + 4); })] },
      { label: L('Biến nó thành kênh nội dung', 'Turn it into content'), outcomes: [oc(L('Kênh "Gia đình mở" ra đời. Mỗi tập là một drama mới.', 'The "Open Family" channel is born. Every episode a new drama.'), { happy: 6 }, (x) => { x.creator ||= { subs: 0, total: 0, price: 1, exposed: true, since: x.age }; x.creator.subs += 3000; me(x).scandal = clamp(me(x).scandal + 8); })] },
      ...(lf.job ? [{ label: L('Lo cho công việc trước', 'Worry about your job first'), outcomes: [oc(L('Sếp gọi lên nói chuyện. Đồng nghiệp xì xào.', 'The boss calls you in. Coworkers whisper.'), { happy: -4 }, (x) => { if (x.job) x.job.perf = clamp(x.job.perf - 10); })] }] : []),
    ] }),
  }),
  S('blackout', L('Đêm mất điện', 'The blackout'), L('Người lớn', 'Adult'), (lf) => lf.age >= 18, 0.04, (lf) => ({ n: mk(lf, 'neighbor', lf.age + randint(lf, -6, 6)) }), {
    1: (lf, c) => { const ms = members(lf); const pt = partner(lf); const adult = lf.age >= 18 && lf._st25; return { text: L('Cả khu phố tối om. Điện thoại còn 4% pin.', 'The whole neighbourhood goes dark. Your phone is at 4%.'), choices: [
      ...(ms.length >= 2 ? [{ label: L('Chơi trò "ai đang ở đâu" với cả nhà', 'Play "who\'s where" with the household'), outcomes: [oc(L('Tiếng cười, tiếng va vào nhau, tiếng ai đó thì thầm tên bạn trong bóng tối.', 'Laughter, bumping into each other, someone whispering your name in the dark.'), { happy: 8 }, (x) => { hstate(x).harmony = clamp(hstate(x).harmony + 6); for (const p of ms) fire(p, 5); })] }] : []),
      ...(pt ? [{ label: L(`Thắp nến với ${nm(lf, pt)}`, `Light candles with ${nm(lf, pt)}`), outcomes: [oc(L('Không TV, không điện thoại, chỉ có hai người và ánh nến.', 'No TV, no phones, just the two of you and candlelight.'), { happy: 7 }, (x) => { cl(pt, 6); fire(pt, 8); setFlag(x, 'recent_intimate'); })] }] : []),
      { label: L('Có tiếng gõ cửa', 'There\'s a knock at the door'), outcomes: [oc(L(`${nm(lf, c.n)}, hàng xóm, đứng đó với cây nến tắt: "Cho mình xin ít lửa?" Họ ở lại đến khi có điện.`, `${nm(lf, c.n)}, your neighbour, stands there with an unlit candle: "Got a light?" They stay until the power's back.`), { happy: 5 }, () => { cl(c.n, 10); fire(c.n, 20); if (attOf(c.n) === 'neutral') c.n.att = 'crush'; })] },
    ] }; },
  }),
  S('storm_stuck', L('Kẹt lại vì bão', 'Stranded by a storm'), L('Người lớn, bật 25+', 'Adult, 25+ on'), (lf, st) => on(st, lf), 0.04, (lf) => ({ q: pick(lf, adults(lf, ['coworker', 'ex', 'boss'])) || mk(lf, 'contact', lf.age + randint(lf, -6, 6)) }), {
    1: (lf, c) => ({ text: L(`Bão chặn đường về. Khách sạn ven đường chỉ còn một phòng, và người kẹt lại cùng bạn là ${nm(lf, c.q)}.`, `A storm blocks the road home. The roadside motel has one room left, and the person stranded with you is ${nm(lf, c.q)}.`), choices: [
      { label: L('Chia phòng', 'Share the room'), outcomes: [oc(L('Gió gào bên ngoài. Bên trong, khoảng cách giữa hai chiếc gối biến mất dần.', 'The wind howls outside. Inside, the gap between two pillows slowly disappears.'), { happy: 8 }, (x) => { fire(c.q, 30); if (chance(x, agree(x, c.q, 0.5, true))) rom(x, c.q); })] },
      { label: L('Ngủ trong xe', 'Sleep in the car'), outcomes: [oc(L('Lạnh, mỏi lưng, nhưng lương tâm thì nhẹ.', 'Cold, stiff back, clear conscience.'), { health: -2, willpower: 3 })] },
      { label: L('Thức trắng nói chuyện', 'Stay up talking'), outcomes: [oc(L('Đến sáng hai người biết về nhau nhiều hơn mười năm quen biết.', 'By morning you know more about each other than in ten years.'), { happy: 4 }, () => { cl(c.q, 15); fire(c.q, 15); })] },
    ] }),
  }),
];
export const scenarioById = Object.fromEntries(SCENARIOS.map((s) => [s.id, s]));

/** Dựng sự kiện cho một bước kịch bản. Nhân vật được lưu theo id trong item.cast để dựng lại ổn định. */
function scenarioEvent(life, item, st) {
  const sc = scenarioById[item.id];
  if (!sc) return null;
  let cast = {};
  if (!item.cast) {
    if (!sc.need(life, st) && !item.forced) return null;
    let c;
    try { c = sc.cast(life, item) || {}; } catch { return null; }
    for (const [k, p] of Object.entries(c)) if (!p) return null;
    item.cast = Object.fromEntries(Object.entries(c).map(([k, p]) => [k, p.id]));
    cast = c;
  } else {
    for (const [k, id] of Object.entries(item.cast)) { const p = byId(life, id); if (!p || !p.alive) return null; cast[k] = p; }
  }
  const step = item.step || 1;
  const fn = sc.steps[step];
  if (!fn) return null;
  life._st25 = on(st, life);
  const go = (lf, n) => lf.queue.unshift({ sys: 'sc', id: sc.id, step: n, cast: item.cast, r2: item.r2 });
  const ev = fn(life, cast, go, item);
  delete life._st25;
  return sev(`sc/${sc.id}/${step}`, ev.text, ev.choices);
}

// ───────── Sự kiện hệ thống của đợt 3 ─────────
export function buildDramaSys(life, item, st) {
  if (item.sys === 'sc') return scenarioEvent(life, item, st);
  if (item.sys === 'h_pair') {
    const a = byId(life, item.a); const b = byId(life, item.b);
    if (!a || !b || !inHarem(life, a) || !inHarem(life, b)) return null;
    return sev('sys/h_pair', L(`${nm(life, a)} và ${nm(life, b)} cùng đến gặp bạn, tay nắm tay: "Tụi mình có chuyện muốn nói. Tụi mình thích nhau, nhưng vẫn muốn ở lại bên bạn."`, `${nm(life, a)} and ${nm(life, b)} come to you hand in hand: "We need to tell you something. We've fallen for each other, but we still want to stay with you."`), [
      { label: L('Chúc phúc cho hai người', 'Give them your blessing'), outcomes: [oc(L('Cả hai ôm chầm lấy bạn. Ngôi nhà ấm hơn hẳn.', 'They both throw their arms around you. The house feels warmer.'), { happy: 6 }, (x) => { setPair(x, a, b, 'blessed', 65); hstate(x).harmony = clamp(hstate(x).harmony + 10); })] },
      { label: L('Chỉ khi có mặt bạn', 'Only when you are there'), outcomes: [oc(L('Họ gật đầu. Những đêm có cả ba sẽ đặc biệt hơn.', 'They nod. The nights with all three of you will be special.'), { happy: 3 }, (x) => setPair(x, a, b, 'withyou', 55))] },
      { label: L('Không cho phép', 'Forbid it'), outcomes: [oc(L('Hai người cúi đầu. Bạn không chắc họ sẽ nghe lời.', "They lower their heads. You're not sure they'll listen."), { happy: -2 }, (x) => { setPair(x, a, b, 'forbidden', 50); hm(a).mood = clamp(hm(a).mood - 15); hm(b).mood = clamp(hm(b).mood - 15); })] },
    ]);
  }
  if (item.sys === 'h_pair_found') {
    const a = byId(life, item.a); const b = byId(life, item.b);
    if (!a || !b || !inHarem(life, a) || !inHarem(life, b)) return null;
    return sev('sys/h_pair_found', L(`Nửa đêm, bạn bắt gặp ${nm(life, a)} và ${nm(life, b)} ngủ quên trong vòng tay nhau ở phòng khách. Họ đã lén yêu nhau từ lâu.`, `At midnight you find ${nm(life, a)} and ${nm(life, b)} asleep in each other's arms in the living room. They've been secretly in love for a while.`), [
      { label: L('Tha thứ và tác hợp', 'Forgive and bless them'), outcomes: [oc(L('Sáng ra bạn đặt hai ly cà phê trước mặt họ. Không cần nói gì thêm.', 'In the morning you set two coffees in front of them. Nothing else needs saying.'), { happy: 4 }, (x) => { setPair(x, a, b, 'blessed', 70); hstate(x).harmony = clamp(hstate(x).harmony + 6); })] },
      { label: L('Giận vì bị giấu', 'Be angry they hid it'), outcomes: [oc(L('Một cuộc nói chuyện căng thẳng. Từ nay phải xin phép.', 'A tense talk. From now on they ask first.'), {}, (x) => { setPair(x, a, b, 'withyou', 55); hm(a).favor = clamp(hm(a).favor - 6); hm(b).favor = clamp(hm(b).favor - 6); })] },
      { label: L('Trục xuất cả hai', 'Expel them both'), outcomes: [oc(L('Họ dọn đi cùng nhau, tay vẫn nắm chặt.', 'They move out together, still holding hands.'), { happy: -8 }, (x) => { leave(x, a); leave(x, b); })] },
    ]);
  }
  if (item.sys === 'evidence') {
    const pt = partner(life);
    if (!pt || polyOk(life)) return null;
    const ITEM = { lipstick: L('một thỏi son không phải của ai trong nhà', 'a lipstick that belongs to nobody in the house'), watch: L('một chiếc đồng hồ lạ trên kệ phòng tắm', "a stranger's watch on the bathroom shelf"), shirt: L('một chiếc áo sơ mi không phải cỡ của bạn', "a shirt that isn't your size"), phone: L('một tin nhắn chưa kịp xóa trên điện thoại bạn', 'an undeleted message on your phone') };
    const k = item.item && ITEM[item.item] ? item.item : (item.item = pick(life, Object.keys(ITEM)));
    const ok = agree(life, pt, 0.5);
    return sev('sys/evidence', L(`${nm(life, pt)} tìm thấy ${ITEM[k].vi}.`, `${nm(life, pt)} finds ${ITEM[k].en}.`), [
      { label: L('"Của bạn mình để quên."', '"A friend left it."'), outcomes: [oc(L('Người yêu gật đầu chậm rãi.', 'Your partner nods slowly.'), {}, null, null, ok), oc(L('"Bạn nào? Tên gì? Số điện thoại?"', '"Which friend? Name? Number?"'), { happy: -5 }, (x) => { cl(pt, -8); if (chance(x, 0.4)) x.queue.unshift({ sys: 'affair_exposed' }); }, null, 1 - ok)] },
      { label: L('Lấy lại và đổi chủ đề', 'Grab it and change the subject'), outcomes: [oc(L('Không khí đặc quánh cả buổi tối.', 'The air is thick all evening.'), {}, () => cl(pt, -5))] },
      { label: L('Thú nhận', 'Confess'), outcomes: [oc(L('Bạn hít một hơi thật sâu.', 'You take a deep breath.'), {}, (x) => x.queue.unshift({ sys: 'affair_exposed', confess: true }))] },
    ]);
  }
  if (item.sys === 'h_visitor') {
    if (!members(life).length) return null;
    return sev('sys/h_visitor', L('Thứ Sáu. Đúng lúc cả nhà đang theo luật "không mặc gì", chuông cửa reo. Là bố mẹ bạn.', "Friday. Right while the house is observing the no-clothes rule, the doorbell rings. It's your parents."), [
      { label: L('Ba mươi giây để mặc đồ', 'Thirty seconds to get dressed'), outcomes: [oc(L('Cả nhà mặc nhầm đồ của nhau. Bố mẹ không hỏi gì, nhưng nhìn rất lâu.', 'Everyone ends up in each other\'s clothes. Your parents say nothing, but stare a long time.'), { happy: 2 }, (x) => { for (const p of x.people) if (p.alive && (p.role === 'mother' || p.role === 'father')) cl(p, -4); })] },
      { label: L('Giả vờ không có nhà', 'Pretend nobody\'s home'), outcomes: [oc(L('Bố mẹ để lại hộp bánh trước cửa.', 'Your parents leave a box of cakes on the step.'), {}, null)] },
    ]);
  }
  return null;
}

// ───────── Hằng năm ─────────
export function dramaYear(life, st) {
  const fq = freqOf(st);
  const m = me(life);
  // Hậu cung
  if (life.harem && members(life).length) {
    pairYear(life, st);
    const h = life.harem;
    const ms = members(life);
    if (h.nude) { for (const p of ms) fire(p, 3); if (chance(life, 0.15)) life.queue.push({ sys: 'h_visitor' }); }
    if (h.jacuzzi) { for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) setRel(life, ms[i], ms[j], relOf(life, ms[i], ms[j]) + 2); h.harmony = clamp(h.harmony + 2); }
    if (h.vowed && h.harmony < 30) h.harmony = 30;
    if (h.vowed && (h.lastCount ?? ms.length) > ms.length) { life.stats.happy = clamp(life.stats.happy - 8 * ((h.lastCount ?? ms.length) - ms.length)); addLog(life, L('Một người rời đi sau lời thề chung. Cả nhà đau gấp đôi.', 'Someone leaves after the shared vows. It hurts twice as much.'), 'bad'); }
    h.lastCount = ms.length;
  }
  // Thợ massage tại gia
  for (const p of life.people) if (p.masseur && p.alive && !p.cut) { life.money -= u(life, 20); life.stats.health = clamp(life.stats.health + 2); if (adultOK(life, p)) fire(p, 3); if (members(life).length && chance(life, 0.15)) addLog(life, L(`Cả hậu cung lườm ${nm(life, p)} mỗi khi họ đến.`, `The whole harem glares at ${nm(life, p)} whenever they come over.`)); }
  // Tranh treo trong nhà
  if (m.portrait && chance(life, 0.12)) addLog(life, pick(life, [L('Bố mẹ đến chơi, đứng trước bức tranh trong phòng khách rất lâu, rồi xin về sớm.', 'Your parents visit, stand before the living-room painting for a long time, then leave early.'), L('Bạn bè đến chơi, chụp ảnh với bức tranh và gọi bạn là "nàng thơ".', 'Friends come over, take selfies with the painting and call you "the muse".'), L('Sếp đến dự tiệc, ngắm bức tranh rồi hỏi giá.', 'Your boss comes to a party, studies the painting, and asks the price.')]));
  // Người tình khắp năm châu (110)
  m.lc ||= [];
  for (const p of life.people) {
    if (p.lcCounted) continue;
    if (p.role === 'lover' || p.wasLover || p.fling) { p.lcCounted = true; const code = p.country || (p.fling ? pick(life, COUNTRIES).code : life.country); p.country = code; if (!m.lc.includes(code)) m.lc.push(code); }
  }
  // Bằng chứng để quên (183)
  if (on(st, life) && partner(life) && lovers(life).length && !polyOk(life) && chance(life, 0.1 * fq.m)) life.queue.push({ sys: 'evidence' });
  // Kịch bản (150–189) + bảo đảm (190)
  life.scen ||= {};
  const elig = SCENARIOS.filter((s) => !life.scen[s.id]?.done && s.need(life, st));
  const forced = []; const rolled = [];
  for (const s of elig) {
    const rec = (life.scen[s.id] ||= { first: life.age });
    if (life.age - rec.first >= fq.g) forced.push(s);
    else if (chance(life, s.p * fq.m)) rolled.push(s);
  }
  for (const s of [...forced, ...rolled].slice(0, Math.max(1, fq.cap - 1))) { life.scen[s.id].done = true; life.queue.push({ sys: 'sc', id: s.id, step: 1 }); }
  newsYear(life, st);
}

// ───────── 126 · Nhật báo cuối năm ─────────
function snap(life) {
  return { partners: life.counts.partners || 0, marriages: life.counts.marriages || 0, children: life.counts.children || 0, exposed: (life.counts.affairsExposed || 0) + (life.counts.multiExposed || 0), lovers: lovers(life).length, money: life.money, fame: life.stats.fame, harem: members(life).length, level: life.job ? life.job.level : -1, scandal: life.ix ? life.ix.scandal : 0, ons: life.counts.ons || 0, dead: !!life.dead };
}
function newsYear(life, st) {
  const prev = life.newsSnap;
  const now = snap(life);
  life.newsSnap = now;
  if (!prev) return;
  const name = life.first;
  const items = [];
  if (now.marriages > prev.marriages) items.push(L(`Đám cưới của ${name} khiến cả khu phố xôn xao`, `${name}'s wedding sets the neighbourhood buzzing`));
  if (now.children > prev.children) items.push(L(`${name} đón thêm thành viên mới`, `${name} welcomes a new arrival`));
  if (now.exposed > prev.exposed) items.push(L(`Bê bối tình ái: ${name} bị bắt quả tang`, `Love scandal: ${name} caught red-handed`));
  if (now.harem > prev.harem) items.push(L(`"Ngôi nhà ${now.harem} người" của ${name} lại có thêm thành viên`, `${name}'s "${now.harem}-person house" grows again`));
  if (now.harem < prev.harem) items.push(L(`Có người rời "ngôi nhà nhiều người" của ${name}`, `Someone leaves ${name}'s crowded household`));
  if (now.level > prev.level && prev.level >= 0) items.push(L(`${name} thăng chức`, `${name} gets promoted`));
  if (now.level < 0 && prev.level >= 0) items.push(L(`${name} rời công việc`, `${name} leaves their job`));
  if (now.money > prev.money * 1.5 && now.money - prev.money > u(life, 300)) items.push(L(`${name} giàu lên trông thấy`, `${name}'s fortunes soar`));
  if (now.money < prev.money * 0.6 && prev.money > u(life, 100)) items.push(L(`${name} lao đao về tài chính`, `${name} hits money trouble`));
  if (now.fame >= prev.fame + 8) items.push(L(`Ngôi sao đang lên: ${name}`, `Rising star: ${name}`));
  const rumor = on(st, life) && (now.lovers > 0 || now.ons > prev.ons) ? pick(life, [L(`Tin đồn: ${name} thường xuyên ra vào một khách sạn lúc nửa đêm`, `Rumour: ${name} spotted at a hotel at midnight… again`), L(`Tin đồn: người ta thấy ${name} ở một quán rượu với "bạn mới"`, `Rumour: ${name} seen at a bar with a "new friend"`), L(`Tin đồn: điện thoại của ${name} luôn úp xuống bàn`, `Rumour: ${name}'s phone is always face-down`)]) : null;
  const head = items[0] || pick(life, [L(`Một năm bình yên của ${name}`, `A quiet year for ${name}`), L(`${name}: "Năm nay không có gì để kể"`, `${name}: "Nothing to report this year"`), L(`${name} sống chậm lại`, `${name} slows down`)]);
  life.news ||= [];
  life.news.push({ age: life.age - 1, head, items: items.slice(1, 4), rumor });
  if (life.news.length > 80) life.news.shift();
}

// ───────── God Mode ─────────
export function godDramaPerson(life, p, v) {
  if (v.orient && ORIENT[v.orient] && p.age >= 18) { p.orient = v.orient; p.orientKnown = true; }
  if (inHarem(life, p) && v.pairWith !== undefined) {
    for (const q of members(life)) if (q !== p && (v.pairWith === '' || q.id !== v.pairWith)) { const pr = life.harem.pairs?.[pk(p, q)]; if (pr && v.pairWith !== '' ) { /* giữ các cặp khác */ } }
    if (v.pairWith) { const q = byId(life, v.pairWith); if (q && inHarem(life, q) && q !== p) setPair(life, p, q, v.pairSt && PAIR_ST[v.pairSt] ? v.pairSt : 'blessed', v.pairLove ?? 70); }
    else if (v.pairClear) for (const q of members(life)) if (q !== p) setPair(life, p, q, null);
  }
}
export function godDramaSelf(life, v) {
  if (v.orientation && ['opposite', 'same', 'both'].includes(v.orientation)) life.orientation = v.orientation;
  const m = me(life);
  if (v.pole != null) m.pole = !!v.pole;
  if (v.portrait !== undefined) m.portrait = v.portrait || null;
  if (life.harem) {
    const h = life.harem;
    for (const k of ['nude', 'jacuzzi', 'vowed']) if (v[k] != null) h[k] = !!v[k];
    if (v.allowPairs != null) h.allowPairs = !!v.allowPairs;
  }
}
/** God Mode: kích hoạt ngay một kịch bản. Trả về { ok, req }. */
export function godTrigger(life, st, id) {
  if (id.startsWith('fated:')) { life.queue.unshift({ sys: 'ix_fated', id: id.slice(6), step: 1 }); return { ok: true }; }
  const sc = scenarioById[id];
  if (!sc) return { ok: false };
  if (!sc.need(life, st)) return { ok: false, req: sc.req };
  (life.scen ||= {})[id] = { first: life.age, done: true };
  life.queue.unshift({ sys: 'sc', id, step: 1 });
  return { ok: true };
}
