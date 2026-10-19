// Hành động chủ động của người chơi: hoạt động, quan hệ, học & nghề, God Mode.
import { L, clamp, rand, chance, randint, pick } from './util.js';
import { CAREERS, careerById, EDU_RANK, missingFor, ladderOf } from '../data/careers.js';
import { entryRank, entryBonus, randomCompany, hire, nextRank, promote } from './career.js';
import { socialAction } from './specials.js';
import { EXTRA_ACTIVITIES, extraPersonActions, doExtraPersonAction, EXTRA_WORK, extraWorkAction } from './extras.js';
import { canStudy, majorEvent, tradeEvent, gradEvent, studentAction } from './school.js';
import { byCode } from '../data/countries.js';
import {
  country, unit, partner, spouse, people, byId, randomPerson, partnerGender, personName,
  addLog, setFlag, STAT_KEYS, HIDDEN_KEYS, milestone, lovers, polyOk, makeLover, canSeduce,
} from './life.js';
import { applyEffects, tryConceive, protectChance, newContact, startAffair, breakUp } from './events.js';
import { CRIMES, commitCrime, prisonAction } from './crime.js';
import { ROMANTIC, partnerActionList, partnerAction, datingApp, blindDate } from './love.js';
import { ixPersonActions, doIxPersonAction, IX_ACTIVITIES, agree, prof, godIxPerson, godIxSelf, me } from './intimacy.js';
import { memberActions, doMemberAction, haremAction, godHaremSelf, godHaremMember } from './harem.js';
import { DRAMA_ACTIVITIES, doDramaHaremAction, godDramaPerson, godDramaSelf, godTrigger } from './drama.js';
import { WORLD_ACTIVITIES, workPersonActions, doWorkPersonAction, babyActions, doBabyAction, doAllPeople, godWorldSelf, godWorldPerson, godUnlockAll } from './world.js';

const fx = (life, effects) => applyEffects(life, effects);
const res = (text, changes = [], tone) => ({ text, changes, tone });
const cost = (life, units) => units * unit(life);
const canAfford = (life, units) => life.money >= cost(life, units) || units === 0;

// Cảnh tình một đêm dùng chung cho hộp đêm và app hẹn hò.
function onsModal(life, settings, intro) {
  const go = (protect) => ({
    chance: 1,
    text: settings.adult25
      ? L('Một đêm nồng nhiệt với người lạ. Sáng ra, cả hai chỉ còn nhớ tên nhau lờ mờ.', 'A heated night with a stranger. By morning you barely remember each other\'s names.')
      : L('Hai người về chung một nhà. Cánh cửa khép lại.', 'You go home together. The door closes.'),
    effects: { happy: 10, risk: 3 },
    run: (lf) => {
      const c = newContact(lf);
      lf.counts.ons++;
      setFlag(lf, 'ons_happened');
      tryConceive(lf, c, protectChance(protect));
    },
  });
  return {
    event: {
      uid: 'act/ons',
      text: intro,
      choices: [
        { label: L('Đi, có dùng biện pháp', 'Go, with protection'), outcomes: [go(true)] },
        { label: L('Đi, không dùng biện pháp', 'Go, without protection'), outcomes: [go(false)] },
        { label: L('Từ chối lịch sự', 'Politely decline'), outcomes: [{ chance: 1, effects: { willpower: 3 }, text: L('Bạn về nhà một mình, ngủ ngon.', 'You head home alone and sleep well.') }] },
      ],
    },
  };
}

function intimateModal(life, settings, p) {
  const name = personName(life, p);
  const go = (protect) => ({
    chance: 1,
    effects: { happy: 8 },
    text: settings.adult25
      ? L(`Bạn và ${name} dành cả buổi tối cho nhau, chậm rãi và không vội vàng.`, `You and ${name} spend the whole evening on each other, slow and unhurried.`)
      : L(`Bạn và ${name} có một buổi tối riêng tư bên nhau.`, `You and ${name} share a private evening together.`),
    run: (lf) => {
      p.closeness = clamp(p.closeness + randint(lf, 4, 10));
      setFlag(lf, 'recent_intimate');
      tryConceive(lf, p, protectChance(protect));
    },
  });
  return {
    event: {
      uid: 'act/intimate',
      text: L(`Bạn muốn gần gũi với ${name}.`, `You want some intimacy with ${name}.`),
      choices: [
        { label: L('Dùng biện pháp', 'Use protection'), outcomes: [go(true)] },
        { label: L('Không dùng biện pháp', 'Skip protection'), outcomes: [go(false)] },
      ],
    },
  };
}

// ───────── Hoạt động ─────────
// group: kid | mind | night | love · min/max: tuổi · units: chi phí (đơn vị = 1% thu nhập TB)
export const ACTIVITIES = [
  { id: 'cry', group: 'kid', min: 0, max: 4, label: L('Khóc đòi bế', 'Cry to be held'), run: (lf) => (chance(lf, 0.6) ? res(L('Mẹ bế bạn đi một vòng quanh nhà.', 'Mum carries you around the house.'), fx(lf, { happy: 4, rel_mother: 2 })) : res(L('Không ai để ý. Bạn khóc to hơn.', 'Nobody comes. You cry louder.'), fx(lf, { happy: -2 }))) },
  { id: 'toys', group: 'kid', min: 0, max: 8, label: L('Chơi đồ chơi', 'Play with toys'), run: (lf) => res(pick(lf, [L('Bạn xếp một tòa tháp rồi đạp đổ nó. Kiến trúc sư và kẻ hủy diệt trong cùng một người.', 'You build a tower, then destroy it. Architect and villain in one.'), L('Bạn tổ chức đám cưới cho con gấu bông và con khủng long. Không ai phản đối.', 'You marry your teddy bear to your toy dinosaur. Nobody objects.'), L('Bạn cho búp bê đi khám bệnh. Chẩn đoán: cần thêm bánh quy.', 'You give your doll a check-up. Diagnosis: needs more biscuits.')]), fx(lf, { happy: 4, smarts: 1 })) },
  { id: 'mischief', group: 'kid', min: 2, max: 10, label: L('Nghịch phá', 'Cause mischief'), run: (lf) => (chance(lf, 0.4) ? res(L('Bạn vẽ lên tường và bị mắng.', 'You draw on the wall and get scolded.'), fx(lf, { happy: 2, rel_mother: -4, rel_father: -4, risk: 2 })) : res(L('Bạn giấu dép của bố. Không ai phát hiện.', 'You hide Dad\'s slippers. Nobody finds out.'), fx(lf, { happy: 5, risk: 2 }))) },
  { id: 'cartoons', group: 'kid', min: 3, max: 12, label: L('Xem hoạt hình', 'Watch cartoons'), run: (lf) => res(pick(lf, [L('Bạn thuộc lòng bài hát mở đầu và hát nó lúc 6 giờ sáng.', 'You learn the theme song and sing it at 6am.'), L('Bạn xem liền 9 tập. Mắt bạn hình vuông.', 'Nine episodes in a row. Your eyes are now square.')]), fx(lf, { happy: 4, smarts: -1 })) },
  { id: 'friends', group: 'kid', min: 5, max: 17, label: L('Chơi với bạn', 'Hang out with friends'), run: (lf) => {
    if (!people(lf, 'friend').length) lf.people.push(randomPerson(lf, lf, { role: 'friend', age: lf.age + randint(lf, -1, 1), closeness: 55 }));
    return res(L('Cả nhóm chạy nhảy đến tối mịt.', 'You all run around until dark.'), fx(lf, { happy: 5, rel_friend: 4, health: 1 }));
  } },
  { id: 'art', group: 'kid', min: 5, max: 17, label: L('Học vẽ, học nhạc', 'Art and music lessons'), run: (lf) => res(L('Bạn tiến bộ từng chút một.', 'You get a little better each week.'), fx(lf, { smarts: 2, happy: 2, willpower: 1 })) },
  { id: 'sleepover', group: 'kid', min: 6, max: 14, label: L('Ngủ lại nhà bạn', 'Sleepover at a friend\'s'), run: (lf) => (chance(lf, 0.8) ? res(L('Cả đêm kể chuyện ma, không ai ngủ.', 'Ghost stories all night. Nobody sleeps.'), fx(lf, { happy: 6, rel_friend: 5, health: -1 })) : res(L('Bạn nhớ nhà và gọi bố mẹ đón lúc nửa đêm.', 'You get homesick and call home at midnight.'), fx(lf, { happy: -3, rel_mother: 3 }))) },
  { id: 'swim', group: 'kid', min: 5, max: 17, label: L('Đi bơi', 'Go swimming'), run: (lf) => res(L('Bạn bơi đến khi tay chân rã rời.', 'You swim until your arms give out.'), fx(lf, { health: randint(lf, 2, 4), happy: 3 })) },
  { id: 'tutor', group: 'teen', min: 9, max: 17, when: (lf) => !!lf.edu.stage, label: L('Đi học thêm', 'Extra tutoring'), run: (lf) => { lf.edu.gpa = clamp(lf.edu.gpa + randint(lf, 3, 7)); return res(L('Thầy giảng lại đúng chỗ bạn hổng.', 'The tutor fixes exactly what you missed.'), fx(lf, { smarts: randint(lf, 2, 4), happy: -2 })); } },
  { id: 'sportclub', group: 'teen', min: 9, max: 17, label: L('Tập ở câu lạc bộ thể thao', 'Train with a sports club'), run: (lf) => (chance(lf, 0.12) ? res(L('Bạn giành huy chương ở giải thành phố!', 'You win a medal at the city championship!'), fx(lf, { health: 4, happy: 10, fame: 3 }), 'good') : res(L('Một buổi tập mệt nhưng đã.', 'A hard, satisfying session.'), fx(lf, { health: randint(lf, 3, 5), looks: 1, willpower: 2 }))) },
  { id: 'band', group: 'teen', min: 11, max: 17, label: L('Tập với ban nhạc', 'Rehearse with a band'), run: (lf) => (chance(lf, 0.1) ? res(L('Ban nhạc được mời diễn ở lễ hội trường!', 'Your band gets booked for the school festival!'), fx(lf, { happy: 10, fame: 4 }), 'good') : res(L('Hàng xóm gõ cửa phàn nàn tiếng ồn.', 'The neighbours bang on the door about the noise.'), fx(lf, { happy: 5, smarts: 1 }))) },
  { id: 'volunteer', group: 'teen', min: 12, max: 100, label: L('Làm tình nguyện', 'Volunteer'), run: (lf) => res(L('Bạn giúp phát cơm ở bếp ăn từ thiện.', 'You help serve meals at a community kitchen.'), fx(lf, { karma: randint(lf, 4, 8), happy: 3 })) },
  { id: 'chores', group: 'teen', min: 7, max: 17, when: (lf) => people(lf, 'mother').length + people(lf, 'father').length > 0, label: L('Làm việc nhà lấy tiền tiêu vặt', 'Do chores for pocket money'), run: (lf) => res(L('Bạn rửa bát cả tuần và được trả công.', 'You wash dishes all week and get paid.'), fx(lf, { money: { poor: 0.5, middle: 1, well: 2, rich: 5 }[lf.wealth], willpower: 2, rel_mother: 2 })) },
  { id: 'games', group: 'kid', min: 10, max: 40, label: L('Chơi điện tử', 'Play video games'), run: (lf) => res(pick(lf, [L('Bạn leo thêm một bậc xếp hạng. Đồng đội vẫn tệ.', 'You climb a rank. Your teammates are still terrible.'), L('Một đứa 11 tuổi hạ bạn và nói những lời rất khó nghe.', 'An 11-year-old destroys you and says unrepeatable things.'), L('Bạn chơi “một trận nữa thôi” đến 3 giờ sáng.', 'You play “just one more” until 3am.')]), fx(lf, { happy: 5, health: -1 })) },
  { id: 'net_photo', group: 'net', min: 13, max: 90, label: L('Đăng ảnh', 'Post a photo'), run: (lf) => socialAction(lf, 'photo') },
  { id: 'net_video', group: 'net', min: 13, max: 90, label: L('Đăng video', 'Post a video'), run: (lf) => socialAction(lf, 'video') },
  { id: 'net_live', group: 'net', min: 16, max: 90, label: L('Livestream', 'Go live'), run: (lf) => socialAction(lf, 'live') },
  { id: 'net_sponsor', group: 'net', min: 18, max: 90, when: (lf) => (lf.social?.followers || 0) >= 10000, label: L('Nhận quảng cáo', 'Do a sponsored post'), run: (lf) => socialAction(lf, 'sponsor') },
  { id: 'social', group: 'mind', min: 12, max: 90, label: L('Lướt mạng xã hội', 'Scroll social media'), run: (lf) => (chance(lf, 0.05) ? res(L('Bài đăng của bạn được chia sẻ hàng nghìn lần!', 'Your post gets shared thousands of times!'), fx(lf, { fame: 8, happy: 6 }), 'good') : res(pick(lf, [L('Một tiếng trôi qua mà bạn không nhớ đã xem gì.', 'An hour passes and you remember nothing.'), L('Bạn cãi nhau với một người lạ về cách luộc trứng. Bạn thua.', 'You argue with a stranger about boiling eggs. You lose.'), L('Bạn thả tim nhầm một bức ảnh từ 6 năm trước của người yêu cũ.', 'You accidentally like your ex’s photo from six years ago.')]), fx(lf, { happy: 1, fame: 1 }))) },
  { id: 'gym', group: 'mind', min: 13, max: 100, label: L('Tập gym', 'Go to the gym'), run: (lf) => res(pick(lf, [L('Bạn đổ mồ hôi và thấy khỏe hơn.', 'You sweat it out and feel stronger.'), L('Bạn tập chân. Ngày mai cầu thang sẽ là kẻ thù.', 'Leg day. Tomorrow, stairs are the enemy.'), L('Một người lạ chỉnh tư thế cho bạn mà không ai nhờ.', 'A stranger corrects your form. Nobody asked.'), L('Bạn chụp ảnh gương nhiều hơn tập. Nhưng ảnh đẹp.', 'More mirror selfies than reps. Great photos though.')]), fx(lf, { health: randint(lf, 3, 6), looks: randint(lf, 0, 2), happy: 1 })) },
  { id: 'library', group: 'mind', min: 6, max: 100, label: L('Đến thư viện', 'Visit the library'), run: (lf) => res(pick(lf, [L('Bạn đọc xong một cuốn sách hay.', 'You finish a good book.'), L('Bạn mượn một cuốn sách về tiết kiệm thời gian và mất ba tiếng để đọc.', 'You borrow a book on saving time. It takes three hours.'), L('Thủ thư suỵt bạn vì lật trang quá to.', 'The librarian shushes you for turning pages too loudly.')]), fx(lf, { smarts: randint(lf, 2, 4) })) },
  { id: 'meditate', group: 'mind', min: 12, max: 100, label: L('Thiền', 'Meditate'), run: (lf) => res(pick(lf, [L('Đầu óc bạn nhẹ nhõm hơn.', 'Your mind feels lighter.'), L('Bạn thiền được 4 phút, rồi nghĩ về món ăn trưa trong 16 phút còn lại.', 'You meditate for 4 minutes, then think about lunch for 16.'), L('Bạn ngủ quên giữa buổi thiền. Vẫn tính là thư giãn.', 'You fall asleep mid-session. Still counts.')]), fx(lf, { happy: 3, willpower: 3 })) },
  { id: 'doctor', group: 'mind', min: 0, max: 120, units: 3, label: L('Đi khám bác sĩ', 'See a doctor'), run: (lf) => {
    if (lf.ill && chance(lf, lf.ill.cure ?? 0.8)) {
      const n = lf.ill.name;
      lf.ill = null;
      return res(L(`Bác sĩ chữa khỏi ${n.vi} cho bạn.`, `The doctor cures your ${n.en}.`), fx(lf, { health: 10, happy: 4 }), 'good');
    }
    if (lf.ill) return res(L(`Bác sĩ kê đơn điều trị ${lf.ill.name.vi}. Chưa khỏi hẳn, nhưng bạn thấy đỡ hơn.`, `The doctor prescribes treatment for your ${lf.ill.name.en}. Not cured, but you feel better.`), fx(lf, { health: randint(lf, 4, 8) }));
    return res(L('Bác sĩ khám tổng quát và kê vitamin.', 'A general check-up and some vitamins.'), fx(lf, { health: randint(lf, 2, 6) }));
  } },
  { id: 'vacation', group: 'mind', min: 18, max: 100, units: 15, label: L('Đi du lịch', 'Take a vacation'), run: (lf) => res(L('Một tuần ở nơi xa giúp bạn nạp lại năng lượng.', 'A week away recharges you.'), fx(lf, { happy: 12, health: 3 })) },
  { id: 'surgery', group: 'mind', min: 18, max: 80, units: 40, label: L('Phẫu thuật thẩm mỹ', 'Cosmetic surgery'), run: (lf) => (chance(lf, 0.75) ? res(L('Ca phẫu thuật thành công. Gương soi khen bạn.', 'The surgery goes well. The mirror approves.'), fx(lf, { looks: randint(lf, 10, 20), happy: 6 }), 'good') : res(L('Kết quả không như mong đợi.', 'The results are not what you hoped.'), fx(lf, { looks: -8, happy: -10, health: -4 }), 'bad')) },
  { id: 'bar', group: 'night', min: 18, max: 90, units: 1, label: L('Đi bar', 'Go to a bar'), run: (lf) => (chance(lf, 0.2) ? res(L('Bạn uống quá chén, sáng ra đau đầu như búa bổ.', 'You overdo it and wake up with a pounding headache.'), fx(lf, { happy: 3, health: -3 })) : res(pick(lf, [L('Vài ly với người lạ, vài câu chuyện vui.', 'A few drinks, a few good stories.'), L('Bạn kết bạn thân với bartender. Tình bạn kéo dài đến lúc quán đóng cửa.', 'You become best friends with the bartender. Until closing time.'), L('Bạn kể một câu chuyện cười ba lần cho cùng một người.', 'You tell the same joke to the same person three times.')]), fx(lf, { happy: 4 }))) },
  { id: 'club', group: 'night', min: 18, max: 60, units: 2, label: L('Đi hộp đêm', 'Go clubbing'), run: (lf, st) => {
    fx(lf, { happy: 5, risk: 2 });
    if (!partner(lf) && chance(lf, 0.35 + lf.stats.looks / 300)) return onsModal(lf, st, L('Trên sàn nhảy, một người lạ quyến rũ ghé tai rủ bạn về nhà họ.', 'On the dance floor, an attractive stranger leans in and asks you back to their place.'));
    return res(L('Bạn nhảy đến khi đèn bật sáng.', 'You dance until the lights come on.'), [['happy', 5]]);
  } },
  { id: 'casino', group: 'night', min: 18, max: 100, label: L('Vào sòng bạc', 'Visit the casino'), run: () => ({ mini: { kind: 'cards', bets: [5, 25] } }) },
  { id: 'races', group: 'night', min: 18, max: 100, label: L('Cá cược đua ngựa', 'Bet on the horses'), run: () => ({ mini: { kind: 'race' } }) },
  { id: 'blackjack', group: 'night', min: 18, max: 100, label: L('Chơi xì dách', 'Play blackjack'), run: () => ({ mini: { kind: 'blackjack', bets: [5, 25] } }) },
  { id: 'lottery', group: 'night', min: 18, max: 120, units: 0.5, label: L('Mua vé số', 'Buy a lottery ticket'), run: (lf) => (chance(lf, 0.0008) ? res(L('TRÚNG ĐỘC ĐẮC!', 'JACKPOT!'), fx(lf, { money: 500, happy: 30 }), 'good') : res(pick(lf, [L('Trượt. Như mọi khi.', 'No luck. As usual.'), L('Trượt. Bạn chỉ sai có 6 số.', 'No luck. You were just six numbers off.'), L('Trượt, nhưng bạn đã kịp tiêu hết số tiền đó trong đầu.', 'No luck, but you already spent it all in your head.')]), [])) },
  { id: 'date', group: 'love', min: 18, max: 90, when: (lf) => !partner(lf), label: L('Nhờ bạn bè giới thiệu', 'Get set up by friends'), run: (lf) => blindDate(lf) },
  { id: 'app', group: 'love', min: 18, max: 90, when: (lf) => !partner(lf), label: L('Ứng dụng hẹn hò', 'Dating app'), run: (lf) => datingApp(lf) },
  { id: 'hookup', group: 'love', min: 18, max: 70, label: L('Tìm tình một đêm qua app', 'Find a hookup on an app'), run: (lf, st) => (chance(lf, 0.3 + lf.stats.looks / 200) ? onsModal(lf, st, L('Một người trên app nhắn tin thẳng thắn: tối nay rảnh không?', 'Someone on the app is direct: free tonight?')) : res(L('Không ai trả lời tin nhắn của bạn.', 'Nobody replies to your messages.'), fx(lf, { happy: -2 }))) },
  { id: 'affair', group: 'love', min: 18, max: 85, label: L('Tìm thêm người tình', 'Find another lover'), run: (lf) => ({
    event: {
      uid: 'act/affair',
      text: !partner(lf) ? L(`Bạn đang độc thân${lovers(lf).length ? ` và đã có ${lovers(lf).length} người tình` : ''}. Một người ở phòng gym nhìn bạn hơi lâu.`, `You're single${lovers(lf).length ? ` with ${lovers(lf).length} lover(s) already` : ''}. Someone at the gym holds your gaze a little too long.`)
        : polyOk(lf) ? L('Mối quan hệ của bạn đang mở. Một người dễ thương trên app hẹn hò muốn gặp bạn.', 'Your relationship is open. Someone lovely on a dating app wants to meet.')
        : L(`Một người đồng nghiệp tỏ ra quan tâm đến bạn hơn mức bình thường, dù ai cũng biết bạn đã có ${spouse(lf) ? 'gia đình' : 'người yêu'}${lovers(lf).length ? `, và bạn còn đang giấu ${lovers(lf).length} người khác` : ''}.`, `A coworker shows more interest than they should, though everyone knows you're ${spouse(lf) ? 'married' : 'taken'}${lovers(lf).length ? `, and you're already hiding ${lovers(lf).length} others` : ''}.`),
      choices: [
        { label: L('Bắt đầu lén lút', 'Start seeing them secretly'), outcomes: [{ chance: 1, effects: { happy: 8, karma: -10, risk: 5 }, text: L('Mối quan hệ bí mật bắt đầu. Mỗi năm đều có nguy cơ bị lộ.', 'A secret relationship begins. Every year it may come out.'), run: (l2) => startAffair(l2) }] },
        { label: L('Giữ khoảng cách', 'Keep your distance'), outcomes: [{ chance: 1, effects: { karma: 4, willpower: 4 }, text: L('Bạn chọn chung thủy.', 'You stay faithful.') }] },
      ],
    },
  }) },
  ...CRIMES.map((c) => ({ id: `crime_${c.id}`, group: 'crime', min: 18, max: 80, label: c.name, crime: c.id })),
  { id: 'prison_escape', group: 'prison', min: 0, max: 120, label: L('Vượt ngục', 'Attempt an escape'), prison: 'escape' },
  { id: 'prison_parole', group: 'prison', min: 0, max: 120, label: L('Xin ân xá', 'Apply for parole'), prison: 'parole' },
  { id: 'prison_work', group: 'prison', min: 0, max: 120, label: L('Làm việc trong trại', 'Work in the prison shop'), prison: 'work' },
  { id: 'prison_riot', group: 'prison', min: 0, max: 120, label: L('Kích động bạo loạn', 'Start a riot'), prison: 'riot' },
];

const PRISON_OK = new Set(['gym', 'library', 'meditate']);
ACTIVITIES.push(...EXTRA_ACTIVITIES, ...IX_ACTIVITIES, ...WORLD_ACTIVITIES, ...DRAMA_ACTIVITIES);

export function availableActivities(life, settings) {
  if (life.prison) return ACTIVITIES.filter((a) => a.group === 'prison' || PRISON_OK.has(a.id));
  return ACTIVITIES.filter((a) => a.group !== 'prison' && life.age >= a.min && life.age <= a.max && (!a.when || a.when(life, settings)));
}
const FLEX_ACTS = new Set(['gym', 'yoga', 'martial', 'hike']);

export function doActivity(life, settings, id) {
  const a = ACTIVITIES.find((x) => x.id === id);
  if (!a || life.dead) return null;
  if (a.crime) return commitCrime(life, a.crime);
  if (a.prison) return prisonAction(life, a.prison);
  if (a.id === 'doctor' && life.insurance?.health) { const r = a.run(life, settings); return r; }
  if (a.units && !canAfford(life, a.units)) return res(L('Bạn không đủ tiền.', 'You can\'t afford it.'), [], 'bad');
  const n = (life.yearActs[id] = (life.yearActs[id] || 0) + 1);
  if (n > 3) return res(L('Bạn đã làm việc này đủ nhiều trong năm nay.', 'You\'ve done this enough for one year.'), []);
  if (a.when && !a.when(life, settings)) return null;
  if (a.units) life.money -= cost(life, a.units);
  if (FLEX_ACTS.has(id) && life.age >= 16) { const m = me(life); m.flex = clamp(m.flex + randint(life, 1, 3)); }
  return a.run(life, settings);
}

// ───────── Quan hệ ─────────
const dedupe = (list) => { const seen = new Set(); return list.filter(([k]) => (seen.has(k) ? false : seen.add(k))); };
export function personActions(life, p, settings) {
  const out = [];
  if (!p.alive) return out;
  out.push(['talk', L('Trò chuyện', 'Talk')]);
  if (life.prison) return out.concat([['argue', L('Cãi nhau', 'Argue')]]);
  if (p.role === 'pet') return extraPersonActions(life, p);
  if (ROMANTIC.includes(p.role)) return dedupe(partnerActionList(life, p).concat(babyActions(life, p, settings), memberActions(life, p, settings), ixPersonActions(life, p, settings), extraPersonActions(life, p)));
  if (life.age >= 10) out.push(['gift', L('Tặng quà', 'Give a gift')]);
  out.push(['argue', L('Cãi nhau', 'Argue')]);
  if ((p.role === 'mother' || p.role === 'father') && life.age >= 6) out.push(['money', L('Xin tiền', 'Ask for money')]);
  if (life.age >= 18 && ['partner', 'spouse', 'lover'].includes(p.role)) out.push(['intimate', L('Gần gũi', 'Be intimate')]);
  if (p.role === 'partner' && life.age >= 18) out.push(['propose', L('Cầu hôn', 'Propose')]);
  if (p.role === 'partner') out.push(['breakup', L('Chia tay', 'Break up')]);
  if (p.role === 'spouse') out.push(['divorce', L('Ly hôn', 'Divorce')]);
  if (p.role === 'lover') out.push(['endaffair', L('Chấm dứt', 'End it')]);
  if (canSeduce(life, p) && !partner(life)) out.push(['askout', L('Rủ hẹn hò', 'Ask out')]);
  if (canSeduce(life, p)) out.push(['seduce', L('Quyến rũ', 'Seduce')]);
  return dedupe(out.concat(workPersonActions(life, p), memberActions(life, p, settings), ixPersonActions(life, p, settings), extraPersonActions(life, p)));
}

export function doPersonAction(life, settings, personId, act) {
  const p = byId(life, personId);
  if (!p || !p.alive || life.dead) return null;
  if (ROMANTIC.includes(p.role) && !life.prison) { const r0 = partnerAction(life, settings, p, act); if (r0) return r0; }
  const name = personName(life, p);
  const key = `p:${act}:${p.id}`;
  const n = (life.yearActs[key] = (life.yearActs[key] || 0) + 1);
  if (n > 3 && ['talk', 'gift', 'money'].includes(act)) return res(L('Năm nay như vậy là đủ rồi.', 'That\'s enough for this year.'), []);
  const rx = doMemberAction(life, settings, p, act, n) || doBabyAction(life, settings, p, act, n) || doWorkPersonAction(life, settings, p, act, n) || doIxPersonAction(life, settings, p, act, n);
  if (rx) return rx;
  switch (act) {
    case 'talk': p.closeness = clamp(p.closeness + randint(life, 2, 7)); return res(L(`Bạn và ${name} nói chuyện rất lâu.`, `You and ${name} talk for a long time.`), [['happy', 0]]);
    case 'gift':
      if (!canAfford(life, 3)) return res(L('Bạn không đủ tiền mua quà.', 'You can\'t afford a gift.'), [], 'bad');
      life.money -= cost(life, 3);
      p.closeness = clamp(p.closeness + randint(life, 6, 14));
      return res(L(`${name} rất thích món quà.`, `${name} loves the gift.`), [['money', -cost(life, 3)]]);
    case 'argue': p.closeness = clamp(p.closeness - randint(life, 6, 14)); return res(L(`Bạn và ${name} cãi nhau to.`, `You and ${name} have a big fight.`), fx(life, { happy: -3 }), 'bad');
    case 'money': {
      const mult = { poor: 1, middle: 4, well: 12, rich: 40 }[life.wealth];
      if (chance(life, agree(life, p, p.closeness / 130))) {
        const u = randint(life, 1, 3) * mult;
        return res(L(`${name} cho bạn một ít tiền.`, `${name} gives you some money.`), fx(life, { money: u }), 'good');
      }
      p.closeness = clamp(p.closeness - 3);
      return res(L(`${name} từ chối: "Tiền đâu mà cho!"`, `${name} refuses: "Money doesn't grow on trees!"`), []);
    }
    case 'intimate': return intimateModal(life, settings, p);
    case 'propose': {
      const ok = clamp(0.2 + p.closeness / 120, 0.05, 0.95);
      if (chance(life, ok)) {
        p.role = 'spouse';
        p.closeness = clamp(p.closeness + 10);
        life.money -= cost(life, 20);
        return res(L(`${name} đồng ý! Hai người tổ chức đám cưới.`, `${name} says yes! You get married.`), fx(life, { happy: 15 }), 'good');
      }
      p.closeness = clamp(p.closeness - 15);
      return res(L(`${name} từ chối lời cầu hôn.`, `${name} turns down your proposal.`), fx(life, { happy: -12 }), 'bad');
    }
    case 'breakup':
    case 'divorce': breakUp(life, 'choice'); return res(L('Mọi chuyện đã kết thúc.', 'It\'s over.'), fx(life, { happy: -8 }), 'bad');
    case 'endaffair': p.role = 'ex'; life.affair = null; delete life.flags.has_affair; return res(L(`Bạn chấm dứt với ${name}.`, `You end things with ${name}.`), fx(life, { karma: 3 }));
    case 'seduce': {
      if (!canSeduce(life, p)) return res(L('Bạn không thể làm vậy với người này.', "You can't do that with this person."), [], 'bad');
      if (n > 2) return res(L('Năm nay như vậy là đủ rồi.', "That's enough for this year."), []);
      const x = prof(p);
      const pr = agree(life, p, 0.15 + life.stats.looks / 250 + p.closeness / 250 + (p.poly ?? 30) / 400 + life.stats.fame / 500 + (life.skill ?? 50) / 600 - (p.fidelity ?? 60) / 400 + x.fire / 400 - 0.05, true);
      if (chance(life, pr)) {
        const slow = x.fire >= 80;
        x.fire = clamp(x.fire + 20);
        if (slow) life.stats.happy = clamp(life.stats.happy + 6);
        makeLover(life, p);
        p.wasLover = true;
        setFlag(life, 'recent_intimate');
        const taken = partner(life) && !polyOk(life);
        if (taken) life.stats.karma = clamp(life.stats.karma - 6);
        life.stats.happy = clamp(life.stats.happy + 10);
        return res(settings.adult25
          ? L(`Một ánh nhìn, một câu nói đúng lúc, và ${name} không rời mắt khỏi bạn. Đêm đó cả hai không về nhà riêng.`, `One look, the right words at the right time, and ${name} can't look away. Neither of you goes home alone that night.`)
          : L(`${name} đáp lại tình cảm của bạn. Hai người bắt đầu qua lại.`, `${name} returns your feelings. You start seeing each other.`), [['happy', 10]].concat(taken ? [['karma', -6]] : []), 'good');
      }
      p.closeness = clamp(p.closeness - 10);
      life.stats.happy = clamp(life.stats.happy - 4);
      if (['mentor', 'rival'].includes(p.role) && chance(life, 0.15)) { life.stats.fame = clamp(life.stats.fame + 2); return res(L(`${name} từ chối và kể chuyện này với mọi người. Bạn thành chủ đề bàn tán.`, `${name} turns you down and tells everyone. You're the talk of the town.`), [['happy', -4]], 'bad'); }
      return res(L(`${name} lịch sự lùi lại một bước. Không khí hơi ngượng.`, `${name} politely steps back. It's a bit awkward.`), [['happy', -4]], 'bad');
    }
    case 'askout':
      if (chance(life, agree(life, p, p.closeness / 100 + 0.1, true))) { p.role = 'partner'; p.closeness = 65; life.counts.partners++; return res(L(`${name} đồng ý hẹn hò với bạn.`, `${name} agrees to date you.`), fx(life, { happy: 8 }), 'good'); }
      return res(L(`${name} không muốn.`, `${name} isn't interested.`), fx(life, { happy: -3 }));
  }
  return doExtraPersonAction(life, p, act, n);
}

// ───────── Học & nghề ─────────
export function jobOpenings(life) {
  if (life.age < 15) return [];
  const teen = life.age < 18;
  return CAREERS.filter((c) => (teen ? c.teen : true) && !missingFor(life, c));
}
/** Nghề chưa đủ bằng cấp (để người chơi biết cần học gì). */
export function jobsLocked(life) {
  if (life.age < 18) return [];
  return CAREERS.map((c) => [c, missingFor(life, c)]).filter(([, m]) => m);
}

export function applyJob(life, id, opts = {}) {
  const c = careerById[id];
  if (!c || life.dead) return null;
  if (life.prison) return res(L('Bạn đang ngồi tù.', "You're in prison."), [], 'bad');
  if (life.job) return res(L('Hãy nghỉ việc hiện tại trước.', 'Quit your current job first.'), []);
  if (life.special) return res(L('Bạn đang theo nghề đặc biệt. Hãy rời nghề đó trước.', 'You have a special career. Leave it first.'), []);
  if (missingFor(life, c)) return res(L('Bạn chưa có bằng cấp phù hợp cho nghề này.', "You don't have the right qualifications for this job."), [], 'bad');
  if (opts.interview == null && life.age >= 18 && (life.yearActs['apply'] || 0) < 3) return { mini: { kind: 'interview', job: id } };
  const n = (life.yearActs['apply'] = (life.yearActs['apply'] || 0) + 1);
  if (n > 3) return res(L('Bạn đã nộp đủ hồ sơ trong năm nay.', 'You\'ve sent enough applications this year.'), []);
  const meets = Object.entries(c.min).every(([k, v]) => life.stats[k] >= v);
  const e = life.edu;
  const fit = c.major && (e.degrees || []).some((d) => c.major.includes(d.major));
  const honors = fit && e.degrees.some((d) => d.honors && c.major.includes(d.major));
  const intern = e.intern && (!c.major || c.major.includes(e.intern));
  const iv = opts.interview != null ? (opts.interview - 0.5) * 0.4 : 0;
  const stigma = 'adult_past' in life.flags && ['teacher', 'police', 'professor', 'nurse', 'lawyer'].includes(id) ? 0.6 : 1;
  const p = stigma * (meets ? clamp(0.35 + life.stats.smarts / 200 + life.stats.looks / 400 + (honors ? 0.1 : 0) + (intern ? 0.15 : 0) + iv, 0.05, 0.97) : 0.04) * (life.record ? 0.55 : 1);
  if (!chance(life, p)) return res(L(`Hồ sơ ${c.title.vi.toLowerCase()} của bạn bị từ chối.`, `Your application for ${c.title.en.toLowerCase()} is rejected.`), fx(life, { happy: -3 }), 'bad');
  const rank = entryRank(life, id, entryBonus(life, id));
  const company = randomCompany(life);
  hire(life, id, rank, company);
  const rn = ladderOf(id)[rank].name;
  return res(L(`Bạn được nhận làm ${rn.vi.toLowerCase()}!`, `You're hired as ${rn.en.toLowerCase()}!`), fx(life, { happy: 8 }), 'good');
}

export function workAction(life, act) {
  if (life.dead) return null;
  const key = `w:${act}`;
  const n = (life.yearActs[key] = (life.yearActs[key] || 0) + 1);
  const e = life.edu;
  switch (act) {
    case 'study': if (n > 3) break; e.gpa = clamp(e.gpa + randint(life, 3, 8)); return res(L('Bạn học bài đến khuya.', 'You study late into the night.'), fx(life, { smarts: 2, happy: -1 }));
    case 'skip': if (n > 3) break; e.gpa = clamp(e.gpa - randint(life, 4, 10)); return res(L('Bạn trốn học đi chơi.', 'You skip class to hang out.'), fx(life, { happy: 4, risk: 2 }));
    case 'dropout': e.stage = null; e.years = 0; addLog(life, L('Bạn bỏ học.', 'You drop out.'), 'bad'); return res(L('Bạn bỏ học.', 'You drop out.'), fx(life, { happy: 3 }), 'bad');
    case 'uni':
      if (!canStudy(life) || n > 1) break;
      return { event: majorEvent(life) };
    case 'trade':
      if (!canStudy(life) || n > 1) break;
      return { event: tradeEvent(life) };
    case 'grad':
      if (!canStudy(life) || EDU_RANK[e.level] < 2 || n > 1) break;
      return { event: gradEvent(life) };
    case 'switch':
      if (e.stage !== 'uni' || n > 1) break;
      return { event: majorEvent(life, true) };
    case 'overtime': case 'bossdrinks': case 'transfer': case 'leave': case 'strike': case 'whistle': {
      const r = extraWorkAction(life, act, n);
      if (r) return r;
      break;
    }
    case 'exam':
      if (n > 1) break;
      return { mini: { kind: 'exam', total: 6, level: life.stats.smarts >= 70 ? 2 : 1 } };
    case 'club': case 'parttime': case 'scholar': case 'exchange': case 'intern': case 'olympiad': {
      const r = studentAction(life, act, n, res, fx);
      if (r) return r;
      break;
    }
    case 'hard': if (!life.job || n > 3) break; life.job.perf = clamp(life.job.perf + randint(life, 6, 14)); return res(L('Bạn làm việc chăm chỉ hơn mọi người.', 'You outwork everyone.'), fx(life, { happy: -2, health: -1 }));
    case 'promote': {
      if (!life.job || n > 1) break;
      const nx = nextRank(life);
      if (nx.top) return res(L('Bạn đã ở cấp cao nhất của nghề này.', "You're already at the top of this career."), []);
      if (nx.yearsHave < nx.yearsNeed) return res(L(`Sếp nói bạn cần ít nhất ${nx.yearsNeed} năm kinh nghiệm (bạn mới có ${nx.yearsHave}).`, `Your boss says you need at least ${nx.yearsNeed} years of experience (you have ${nx.yearsHave}).`), fx(life, { happy: -2 }), 'bad');
      if (nx.need) return res(nx.need.edu ? L(`Vị trí ${nx.rank.name.vi.toLowerCase()} cần bằng ${nx.need.edu === 'phd' ? 'tiến sĩ' : 'thạc sĩ'}.`, `The ${nx.rank.name.en.toLowerCase()} role needs a ${nx.need.edu === 'phd' ? 'PhD' : "master's degree"}.`) : L('Bạn chưa đáp ứng yêu cầu của vị trí này.', "You don't meet this role's requirements yet."), [], 'bad');
      const p = life.job.perf >= nx.perfNeed ? 0.6 + (life.job.perf - nx.perfNeed) / 100 : 0.12;
      if (chance(life, p)) { promote(life); return res(L(`Bạn được thăng chức lên ${nx.rank.name.vi.toLowerCase()}!`, `You're promoted to ${nx.rank.name.en.toLowerCase()}!`), fx(life, { happy: 12 }), 'good'); }
      life.job.perf = clamp(life.job.perf - 5);
      return res(life.job.perf + 5 >= nx.perfNeed ? L('Sếp bảo "năm sau xem tiếp". Năm nào sếp cũng nói vậy.', 'Your boss says "let\'s revisit next year". They say that every year.') : L(`Sếp nói hiệu suất của bạn cần đạt ${nx.perfNeed} trở lên.`, `Your boss says your performance needs to be ${nx.perfNeed}+.`), fx(life, { happy: -4 }), 'bad');
    }
    case 'raise': {
      if (!life.job || n > 1) break;
      if (life.job.perf >= 60 && chance(life, 0.5)) { life.job.salary = Math.round(life.job.salary * 1.1); return res(L('Sếp đồng ý tăng lương 10%.', 'Your boss agrees to a 10% raise.'), fx(life, { happy: 8 }), 'good'); }
      life.job.perf = clamp(life.job.perf - 6);
      return res(L('Sếp từ chối và nhìn bạn khác đi.', 'Your boss says no and eyes you differently.'), fx(life, { happy: -4 }), 'bad');
    }
    case 'quit': if (!life.job) break; addLog(life, L('Bạn nghỉ việc.', 'You quit your job.')); life.job = null; return res(L('Bạn nộp đơn nghỉ việc.', 'You hand in your notice.'), fx(life, { happy: 4 }));
  }
  return res(L('Năm nay như vậy là đủ rồi.', 'That\'s enough for this year.'), []);
}

// ───────── God Mode ─────────
// Mọi thay đổi bật cờ customized: đời này không còn tính bảng xếp hạng và ribbon khó.
export function godApply(life, change) {
  if (life.dead) return;
  life.customized = true;
  life.counts.godUses++;
  if (change.stats) for (const [k, v] of Object.entries(change.stats)) if (STAT_KEYS.includes(k) || HIDDEN_KEYS.includes(k)) life.stats[k] = clamp(Number(v));
  if (change.money != null) life.money = Number(change.money) || 0;
  if (change.cure) { life.ill = null; life.addicted = false; life.stats.health = Math.max(life.stats.health, 80); }
  if (change.clearDebt && life.money < 0) life.money = 0;
  if (change.ix) godIxSelf(life, change.ix);
  if (change.harem) godHaremSelf(life, change.harem);
  if (change.world) godWorldSelf(life, change.world);
  if (change.unlockAll) godUnlockAll(life);
  if (change.drama) godDramaSelf(life, change.drama);
  if (change.body) for (const k of ['fert', 'skill', 'size']) if (change.body[k] != null && (k !== 'size' || life.gender === 'male')) life[k] = clamp(Number(change.body[k]));
  if (change.country && byCode[change.country] && change.country !== life.country) {
    const from = country(life);
    life.country = change.country;
    if (life.job) life.job.salary = Math.round(life.job.salary * (byCode[change.country].gdp / from.gdp));
    addLog(life, L(`Bạn chuyển đến sống ở ${byCode[change.country].name.vi}.`, `You move to ${byCode[change.country].name.en}.`));
  }
  addLog(life, L('⚡ God Mode đã thay đổi đời này.', '⚡ God Mode changed this life.'));
}

/** Quay lại 1 năm (tối đa 3 lần mỗi đời). Trả về đời cũ hoặc null. */
/** God Mode cho một người: chỉnh chỉ số, không bao giờ chỉnh tuổi. Chỉ số thân mật chỉ áp dụng cho người từ 18 tuổi. */
export function godPerson(life, id, vals) {
  const p = byId(life, id);
  if (!p) return null;
  life.customized = true;
  life.counts.godUses++;
  for (const k of ['closeness', 'looks', 'smarts']) if (vals[k] != null) p[k] = clamp(Number(vals[k]));
  if (p.age >= 18) {
    for (const k of ['poly', 'fert', 'skill', 'fidelity', 'crazy']) if (vals[k] != null) p[k] = clamp(Number(vals[k]));
    if (p.gender === 'male' && vals.size != null) p.size = clamp(Number(vals.size));
  }
  godIxPerson(life, p, vals);
  godHaremMember(life, p, vals);
  godWorldPerson(life, p, vals);
  godDramaPerson(life, p, vals);
  return p;
}

export function godRewind(life) {
  if (!life.snapshots.length || life.counts.rewinds >= 3) return null;
  const prev = JSON.parse(life.snapshots[life.snapshots.length - 1]);
  prev.snapshots = life.snapshots.slice(0, -1);
  prev.customized = true;
  prev.counts.rewinds = life.counts.rewinds + 1;
  prev.counts.godUses = life.counts.godUses + 1;
  prev.rng = (life.rng ^ 0x9e3779b9) >>> 0; // đổi hướng số phận
  return prev;
}

/** Hành động trên màn hình Hậu cung. */
export function doHaremAction(life, settings, act, arg) { if (!life || life.dead) return null; return haremAction(life, settings, act, arg) || doDramaHaremAction(life, settings, act); }
/** God Mode: kích hoạt một kịch bản ngay. */
export function doGodTrigger(life, settings, id) { if (!life || life.dead) return { ok: false }; life.customized = true; life.counts.godUses++; return godTrigger(life, settings, id); }
/** Nút "Làm tất cả": tương tác tích cực với mọi người, rồi chăm sóc cả hậu cung nếu có. */
export function doAll(life, settings) {
  if (!life || life.dead) return null;
  const n = doAllPeople(life, settings, doPersonAction);
  return { text: L(`Bạn dành thời gian cho ${n} người: trò chuyện, ôm, chơi với con, dắt thú cưng đi dạo.`, `You spend time with ${n} people: chats, hugs, playtime with the kids, walking the pets.`), changes: [], tone: 'good' };
}
