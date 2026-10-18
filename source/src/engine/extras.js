// Hành động mở rộng: hoạt động mới, thú cưng, hành động với từng người, công việc, vay mượn và bảo hiểm.
import { L, clamp, rand, chance, randint, pick } from './util.js';
import { country, unit, partner, people, byId, randomPerson, personName, addLog, setFlag, milestone } from './life.js';
import { applyEffects, newContact } from './events.js';
import { COUNTRIES } from '../data/countries.js';

const res = (text, changes = [], tone) => ({ text, changes, tone });
const fx = (life, e) => applyEffects(life, e);
const u = (life, n) => n * unit(life);
const nm = (life, p) => personName(life, p);
const canPay = (life, units) => life.money >= u(life, units) || life.money - u(life, units) > -2 * country(life).gdp;

// ───────── Hoạt động mới ─────────
const A = (id, group, min, max, vi, en, run, extra = {}) => ({ id, group, min, max, label: L(vi, en), run, ...extra });
export const EXTRA_ACTIVITIES = [
  // Rèn luyện
  A('language', 'mind', 8, 90, 'Học ngoại ngữ', 'Learn a language', (lf) => { lf.langs = (lf.langs || 0) + 1; return res(pick(lf, [L('Bạn học thêm 200 từ mới và quên 150 từ cũ.', 'You learn 200 new words and forget 150 old ones.'), L('Bạn đã có thể gọi món bằng ngôn ngữ mới. Phục vụ trả lời bằng tiếng mẹ đẻ của bạn.', 'You can now order food in the new language. The waiter replies in yours.')]), fx(lf, { smarts: randint(lf, 2, 3) })); }),
  A('instrument', 'mind', 6, 90, 'Học nhạc cụ', 'Learn an instrument', (lf) => res(pick(lf, [L('Hàng xóm bắt đầu nhận ra giai điệu bạn tập.', 'The neighbours are starting to recognise the tune.'), L('Bạn chơi trọn một bài mà không sai nốt nào. Không ai ở nhà để nghe.', 'You play a whole song without a mistake. Nobody was home to hear it.')]), fx(lf, { smarts: 1, happy: 3 }))),
  A('martial', 'mind', 8, 70, 'Tập võ', 'Martial arts', (lf) => (chance(lf, 0.1) ? res(L('Bạn lên đai mới! Thầy gật đầu một lần, rất nghiêm.', 'You earn a new belt! Your teacher nods once, very seriously.'), fx(lf, { health: 4, willpower: 4, happy: 6 }), 'good') : res(L('Bạn đá vào bao cát đến khi chân tê.', 'You kick the bag until your shins go numb.'), fx(lf, { health: 3, willpower: 2 })))),
  A('yoga', 'mind', 14, 100, 'Tập yoga', 'Yoga', (lf) => res(pick(lf, [L('Bạn giữ được tư thế cái cây trong 30 giây. Cái cây thật cũng phải nể.', 'You hold tree pose for 30 seconds. Real trees would be impressed.'), L('Bạn ngủ quên trong tư thế xác chết. Giáo viên bảo thế là đúng.', 'You fall asleep in corpse pose. The teacher says that\'s correct.')]), fx(lf, { health: 2, happy: 3 }))),
  A('hike', 'mind', 12, 80, 'Leo núi', 'Go hiking', (lf) => (chance(lf, 0.08) ? res(L('Bạn trượt chân ở dốc đá và phải chống gậy về.', 'You slip on a rocky slope and limp home.'), fx(lf, { health: -6, happy: -2 }), 'bad') : res(L('Lên đến đỉnh, bạn chụp 40 tấm ảnh giống hệt nhau.', 'At the summit you take 40 identical photos.'), fx(lf, { health: 4, happy: 5 })))),
  A('diet', 'mind', 16, 90, 'Ăn kiêng lành mạnh', 'Eat healthy for a while', (lf) => res(L('Một tháng rau củ. Bạn mơ thấy bánh ngọt mỗi đêm.', 'A month of vegetables. You dream of cake every night.'), fx(lf, { health: 3, looks: 1, happy: -2 }))),
  A('spa', 'mind', 18, 100, 'Đi spa', 'Go to a spa', (lf) => res(L('Đắp mặt nạ dưa leo, nghe nhạc thiền, ngủ quên lúc massage.', 'Cucumber mask, ambient music, asleep halfway through the massage.'), fx(lf, { looks: 2, happy: 5 })), { units: 3 }),
  // Giải trí
  A('movie', 'fun', 6, 100, 'Đi xem phim', 'Go to the cinema', (lf) => res(pick(lf, [L('Phim hay. Người ngồi sau đá ghế bạn suốt.', 'Great film. The person behind kicked your seat the whole time.'), L('Bạn khóc ở đoạn cuối và giả vờ bị bụi bay vào mắt.', 'You cry at the end and pretend it\'s dust.')]), fx(lf, { happy: 4 })), { units: 0.5 }),
  A('concert', 'fun', 14, 90, 'Đi xem hòa nhạc', 'Go to a concert', (lf) => res(L('Bạn hát theo đến mất giọng. Sáng mai họp online chỉ gõ chữ.', 'You sing until you lose your voice. Tomorrow\'s meeting is text-only.'), fx(lf, { happy: 8 })), { units: 2 }),
  A('cook', 'fun', 10, 100, 'Nấu ăn', 'Cook something', (lf) => (chance(lf, 0.12) ? res(L('Chuông báo cháy kêu. Bữa tối là mì gói.', 'The smoke alarm goes off. Dinner is instant noodles.'), fx(lf, { happy: -2 }), 'bad') : res(L('Món ăn ngon đến mức bạn chụp ảnh trước khi ăn.', 'It\'s good enough that you photograph it first.'), fx(lf, { happy: 4, health: 1 })))),
  A('garden', 'fun', 8, 110, 'Làm vườn', 'Do some gardening', (lf) => res(L('Bạn nói chuyện với cây cà chua. Nó có vẻ lắng nghe.', 'You talk to the tomato plant. It seems to listen.'), fx(lf, { happy: 3, health: 1 }))),
  A('comics', 'fun', 6, 100, 'Đọc truyện tranh', 'Read comics', (lf) => res(L('Bạn đọc hết một bộ 40 tập trong một cuối tuần.', 'You binge a 40-volume series in one weekend.'), fx(lf, { happy: 4 }))),
  A('boardgame', 'fun', 8, 100, 'Chơi board game với bạn', 'Board games with friends', (lf) => res(pick(lf, [L('Một ván cờ tỷ phú kéo dài bốn tiếng và hai tình bạn.', 'A four-hour property game. Two friendships barely survive.'), L('Bạn thắng và không ai muốn chơi tiếp với bạn.', 'You win, and nobody wants to play with you again.')]), fx(lf, { happy: 4, rel_friend: 4 }))),
  // Mua sắm
  A('luxury', 'shop', 18, 100, 'Mua đồ hiệu', 'Buy designer clothes', (lf) => res(L('Túi mới, giày mới, tài khoản cũ hơn.', 'New bag, new shoes, older bank balance.'), fx(lf, { looks: 3, happy: 7 })), { units: 20 }),
  A('thrift', 'shop', 12, 100, 'Săn đồ cũ', 'Go thrifting', (lf) => (chance(lf, 0.06) ? res(L('Bạn mua một bức tranh cũ giá rẻ. Hóa ra nó đáng giá!', 'You buy a cheap old painting. It turns out to be valuable!'), fx(lf, { money: 25, happy: 10 }), 'good') : res(L('Một chiếc áo khoác cũ rất hợp. Túi áo có tờ vé xem phim năm 1998.', 'A perfect vintage jacket. A 1998 cinema ticket in the pocket.'), fx(lf, { happy: 3, looks: 1 }))), { units: 1 }),
  // Đời sống
  A('tattoo', 'life', 18, 80, 'Xăm hình', 'Get a tattoo', (lf) => (chance(lf, 0.15) ? res(L('Hình xăm không giống ảnh mẫu lắm. Bạn bảo đó là "nghệ thuật".', 'The tattoo doesn\'t quite match the sample. You call it "art".'), fx(lf, { looks: -2, happy: 1 }), 'bad') : res(L('Hình xăm đẹp. Bạn mặc áo cộc tay cả mùa đông.', 'A great tattoo. You wear short sleeves all winter.'), fx(lf, { looks: 2, happy: 5 }))), { units: 2 }),
  A('hairdye', 'life', 13, 100, 'Đổi kiểu tóc', 'New hairstyle', (lf) => (chance(lf, 0.2) ? res(L('Thợ hỏi "cắt ngắn chút nhé?" và bạn gật đầu quá nhanh.', 'The stylist asked "a little shorter?" and you nodded too fast.'), fx(lf, { looks: -2, happy: -2 }), 'bad') : res(L('Kiểu tóc mới khiến ba người hỏi bạn có chuyện gì vui.', 'Three people ask what good news you\'ve had.'), fx(lf, { looks: 2, happy: 3 }))), { units: 1 }),
  A('license', 'life', 16, 80, 'Thi bằng lái xe', 'Take a driving test', (lf) => {
    if (lf.license) return res(L('Bạn đã có bằng lái rồi.', 'You already have a licence.'), []);
    if (chance(lf, clamp(0.45 + lf.stats.smarts / 300 + lf.stats.willpower / 400, 0.2, 0.9))) { lf.license = true; milestone(lf, L('Có bằng lái xe', 'Got a driving licence'), 'good'); return res(L('Bạn đỗ! Giám khảo thở phào nhẹ nhõm hơn cả bạn.', 'You pass! The examiner looks more relieved than you.'), fx(lf, { happy: 8 }), 'good'); }
    return res(pick(lf, [L('Bạn quên bật xi nhan và đỗ xe lên vỉa hè. Trượt.', 'You forget to signal and park on the pavement. Fail.'), L('Bạn lùi vào cọc tiêu duy nhất trong bãi. Trượt.', 'You reverse into the only cone in the car park. Fail.')]), fx(lf, { happy: -4 }), 'bad');
  }, { units: 2 }),
  A('travel', 'life', 18, 95, 'Du lịch nước ngoài', 'Travel abroad', (lf) => {
    const c = pick(lf, COUNTRIES.filter((x) => x.code !== lf.country));
    lf.visited = [...new Set([...(lf.visited || []), c.code])];
    return res(L(`Bạn đi du lịch ${c.name.vi} ${c.flag}. ${pick(lf, ['Bạn ăn món lạ và không hỏi trong đó có gì.', 'Bạn lạc đường ba lần và có thêm ba người bạn.', 'Bạn mua quà lưu niệm mà sau này không biết để đâu.'])}`, `You travel to ${c.name.en} ${c.flag}. ${pick(lf, ['You eat something unfamiliar and don\'t ask what\'s in it.', 'You get lost three times and make three new friends.', 'You buy souvenirs you\'ll never find a place for.'])}`), fx(lf, { happy: 12, smarts: 1 }), 'good');
  }, { units: 15 }),
  A('comeout', 'life', 14, 90, 'Công khai xu hướng tính dục', 'Come out', (lf) => {
    if (lf.out) return res(L('Mọi người đều đã biết và yêu thương bạn như cũ.', 'Everyone already knows and loves you just the same.'), []);
    lf.out = true;
    const good = chance(lf, 0.7);
    for (const p of people(lf, 'mother').concat(people(lf, 'father'))) p.closeness = clamp(p.closeness + (good ? 5 : -12));
    milestone(lf, L('Công khai xu hướng tính dục', 'Came out'), good ? 'good' : undefined);
    return good ? res(L('Bố mẹ ôm bạn. Mẹ nói "mẹ biết từ lâu rồi".', 'Your parents hug you. Your mum says "I always knew".'), fx(lf, { happy: 12, willpower: 4 }), 'good') : res(L('Gia đình cần thời gian. Nhưng bạn thấy nhẹ lòng vì được là chính mình.', 'Your family needs time. But it feels good to be yourself.'), fx(lf, { happy: 4, willpower: 6 }));
  }, { when: (lf) => lf.orientation !== 'opposite' && !lf.out }),
  A('donate', 'life', 16, 120, 'Quyên góp từ thiện', 'Donate to charity', (lf) => res(L('Bạn quyên góp một khoản. Một tổ chức nhỏ gửi thư cảm ơn viết tay.', 'You donate. A small charity sends a handwritten thank-you.'), fx(lf, { karma: randint(lf, 5, 9), happy: 4 })), { units: 5 }),
  A('will', 'life', 40, 120, 'Viết di chúc', 'Write a will', (lf) => { if (lf.flags.will) return res(L('Bạn đã có di chúc.', 'You already have a will.'), []); lf.flags.will = lf.age; return res(L('Bạn viết di chúc. Luật sư bảo bạn là người chu đáo.', 'You write your will. The lawyer calls you thoughtful.'), fx(lf, { karma: 2, happy: 2 })); }, { units: 2 }),
  A('rename', 'life', 18, 120, 'Đổi tên', 'Change your name', () => ({ input: 'rename' })),
  // Thú cưng
  A('adopt_pet', 'pet', 6, 95, 'Nhận nuôi thú cưng', 'Adopt a pet', (lf) => ({ event: adoptPetEvent(lf) }), { when: (lf) => people(lf, 'pet').filter((p) => p.alive).length < 4 }),
  // Tài chính
  A('loan', 'money', 18, 90, 'Vay ngân hàng', 'Take a bank loan', (lf) => ({ event: loanEvent(lf) })),
  A('repay', 'money', 18, 120, 'Trả nợ vay', 'Repay your loan', (lf) => repayLoan(lf), { when: (lf) => (lf.loans || []).length > 0 }),
  A('insure', 'money', 18, 90, 'Mua bảo hiểm', 'Buy insurance', (lf) => ({ event: insuranceEvent(lf) })),
];
export const EXTRA_GROUPS = ['fun', 'shop', 'life', 'pet', 'money'];

// ───────── Thú cưng ─────────
export const SPECIES = {
  dog: { em: '🐶', name: L('Chó', 'Dog'), life: [10, 15], names: ['Vàng', 'Mực', 'Lucky', 'Bơ', 'Max', 'Bella'] },
  cat: { em: '🐱', name: L('Mèo', 'Cat'), life: [12, 18], names: ['Mướp', 'Mochi', 'Tôm', 'Luna', 'Simba', 'Miu'] },
  rabbit: { em: '🐰', name: L('Thỏ', 'Rabbit'), life: [7, 11], names: ['Bông', 'Kem', 'Cà Rốt', 'Snow'] },
  parrot: { em: '🦜', name: L('Vẹt', 'Parrot'), life: [20, 45], names: ['Kiwi', 'Coco', 'Chíp', 'Rio'] },
  turtle: { em: '🐢', name: L('Rùa', 'Tortoise'), life: [40, 80], names: ['Chậm', 'Đá', 'Sheldon', 'Rùa Vàng'] },
};
function adoptPetEvent(life) {
  const choice = (sp, units) => ({
    label: L(`${SPECIES[sp].em} ${SPECIES[sp].name.vi}${units ? ` · ${units === 1 ? 'rẻ' : 'đắt'}` : ' · trạm cứu hộ'}`, `${SPECIES[sp].em} ${SPECIES[sp].name.en}${units ? ` · ${units === 1 ? 'cheap' : 'pricey'}` : ' · shelter'}`),
    outcomes: [{ chance: 1, effects: { happy: 10, money: -units }, run: (lf) => addPet(lf, sp), text: L(`Bạn có thêm một thành viên mới. Nó chiếm chỗ đẹp nhất trên ghế sofa ngay ngày đầu.`, 'A new family member. It claims the best spot on the sofa on day one.') }],
  });
  return { uid: 'pet/adopt', text: L('Bạn muốn nuôi con gì?', 'What kind of pet?'), choices: [choice('dog', 0), choice('cat', 0), choice('rabbit', 1), choice('parrot', 8), choice('turtle', 3), { label: L('Thôi, để sau', 'Not now'), outcomes: [{ chance: 1, effects: {}, text: L('Bạn về nhà, hơi tiếc.', 'You go home, a bit wistful.') }] }] };
}
export function addPet(life, sp) {
  const s = SPECIES[sp];
  const p = randomPerson(life, life, { role: 'pet', age: randint(life, 0, sp === 'turtle' ? 10 : 3), closeness: 70 });
  Object.assign(p, { first: pick(life, s.names), last: '', pet: true, species: sp, lifespan: randint(life, s.life[0], s.life[1]), health: randint(life, 70, 100) });
  delete p.poly; delete p.fert; delete p.skill; delete p.size;
  life.people.push(p);
  addLog(life, L(`Bạn nhận nuôi ${s.name.vi.toLowerCase()} ${p.first}.`, `You adopt a ${s.name.en.toLowerCase()} named ${p.first}.`), 'good');
  return p;
}
export function petYear(life) {
  for (const p of life.people) {
    if (p.role !== 'pet' || !p.alive) continue;
    p.health = clamp((p.health ?? 80) - randint(life, 0, 4));
    if (p.closeness > 70) life.stats.happy = clamp(life.stats.happy + 1);
    const span = p.lifespan ?? 14;
    if ((p.age >= span && chance(life, 0.35)) || p.health <= 0) {
      p.alive = false;
      life.stats.happy = clamp(life.stats.happy - 8);
      addLog(life, L(`${p.first} ra đi ở tuổi ${p.age}. Ngôi nhà bỗng yên tĩnh lạ.`, `${p.first} passes away at ${p.age}. The house is strangely quiet.`), 'bad');
    }
  }
}

// ───────── Hành động với từng người ─────────
const ADULT_FIGHT = ['friend', 'bestie', 'contact', 'ex', 'rival', 'mentor', 'sibling', 'half', 'coworker', 'neighbor'];
export function extraPersonActions(life, p) {
  const out = [];
  if (!p.alive || life.prison) return out;
  const r = p.role;
  if (r === 'pet') return [['walk', L('Dắt đi dạo / chơi cùng', 'Walk / play')], ['vet', L('Đưa đi thú y', 'Take to the vet')], ['treat', L('Cho ăn món ngon', 'Give a treat')]];
  if ((r === 'mother' || r === 'father')) {
    if (life.age < 18) out.push(['outing', L('Xin đi chơi', 'Ask for an outing')]);
    if (life.age >= 18 && p.age >= 60) out.push(['care', L('Chăm sóc bố mẹ', 'Care for them')]);
    if (life.age >= 18) out.push(['familytrip', L('Đưa đi du lịch', 'Take them on a trip')]);
    if (life.age >= 18 && (p.wealth || 0) > 0) out.push(['inherit', L('Xin thừa kế sớm', 'Ask for an early inheritance')]);
  }
  if (r === 'child') {
    if (p.age < 10) out.push(['read', L('Đọc truyện cho con', 'Read a story')]);
    if (p.age < 14) out.push(['play', L('Chơi cùng con', 'Play together')]);
    if (p.age >= 6 && p.age < 18) {
      out.push(['teach', L('Kèm con học', 'Help with homework')]);
      out.push(['allowance', L('Cho tiền tiêu vặt', 'Give pocket money')]);
      out.push(['tutor', L('Cho đi học thêm', 'Pay for tutoring')]);
    }
    if (p.age < 18) { out.push(['praise', L('Khen con', 'Praise them')]); out.push(['punish', L('Phạt con', 'Discipline them')]); }
  }
  if (['friend', 'bestie'].includes(r) && life.age >= 18) {
    out.push(['drinks', L('Rủ đi nhậu', 'Go for drinks')]);
    out.push(['borrow', L('Vay tiền', 'Borrow money')]);
    out.push(['lend', L('Cho vay tiền', 'Lend money')]);
    if (!partner(life)) out.push(['setup', L('Nhờ giới thiệu người yêu', 'Ask to be set up')]);
  }
  if (['friend', 'bestie', 'sibling'].includes(r) && life.age >= 8) out.push(['prank', L('Chơi khăm', 'Prank them')]);
  if ((r === 'spouse' || r === 'partner') && life.age >= 18) out.push(['counsel', L('Đi tư vấn hôn nhân', 'Couples counselling')]);
  if (r !== 'child' || p.age >= 18) out.push(['photo', L('Chụp ảnh chung', 'Take a photo together')]);
  if (p.age >= 18 && life.age >= 16 && r !== 'child') out.push(['insult', L('Xúc phạm', 'Insult')]);
  if (p.age >= 18 && life.age >= 16 && ADULT_FIGHT.includes(r)) out.push(['fight', L('Đánh nhau', 'Start a fight')]);
  if (p.owesYou > 0) out.push(['collect', L('Đòi nợ', 'Ask for your money back')]);
  if (p.youOwe > 0) out.push(['payback', L('Trả nợ', 'Pay them back')]);
  if (life.age >= 16 && r !== 'pet') out.push(['cutoff', L('Cắt đứt liên lạc', 'Cut contact')]);
  return out;
}
const closer = (life, p, a, b) => { p.closeness = clamp(p.closeness + randint(life, a, b)); };
export function doExtraPersonAction(life, p, act, n) {
  const name = nm(life, p);
  const tired = res(L('Năm nay như vậy là đủ rồi.', "That's enough for this year."), []);
  switch (act) {
    case 'walk': if (n > 3) return tired; closer(life, p, 4, 8); p.health = clamp((p.health ?? 80) + 2); return res(L(`${name} vui đến mức chạy vòng quanh bạn ba lần.`, `${name} is so happy it runs circles around you.`), fx(life, { happy: 3, health: 2 }));
    case 'vet': if (n > 1) return tired; if (!canPay(life, 2)) return res(L('Bạn không đủ tiền.', "You can't afford it."), [], 'bad'); life.money -= u(life, 2); p.health = clamp((p.health ?? 70) + 25); p.closeness = clamp(p.closeness - 3); return res(L(`Bác sĩ thú y nói ${name} khỏe mạnh. ${name} giận bạn cả buổi chiều vì bị tiêm.`, `The vet says ${name} is healthy. ${name} sulks all afternoon about the injection.`), [['money', -u(life, 2)]]);
    case 'treat': if (n > 3) return tired; closer(life, p, 3, 6); return res(L(`${name} ăn xong rồi nhìn bạn đòi thêm.`, `${name} finishes and stares at you for more.`), fx(life, { happy: 2 }));
    case 'outing': if (n > 2) return tired; if (chance(life, p.closeness / 120)) { closer(life, p, 4, 8); return res(L(`${name} đưa bạn đi công viên giải trí. Bạn nôn sau trò tàu lượn, nhưng rất vui.`, `${name} takes you to a theme park. You throw up after the coaster, but it's great.`), fx(life, { happy: 8 }), 'good'); } return res(L(`${name} bảo "để cuối tuần sau". Cuối tuần sau không bao giờ đến.`, `${name} says "next weekend". Next weekend never comes.`), fx(life, { happy: -2 }));
    case 'care': if (n > 1) return tired; life.money -= u(life, 3); closer(life, p, 8, 14); return res(L(`Bạn đưa ${name} đi khám, nấu cơm, ngồi nghe kể chuyện cũ.`, `You take ${name} to the doctor, cook, and listen to old stories.`), fx(life, { karma: 4, happy: 3, money: 0 }), 'good');
    case 'familytrip': if (n > 1) return tired; if (!canPay(life, 10)) return res(L('Bạn không đủ tiền.', "You can't afford it."), [], 'bad'); life.money -= u(life, 10); closer(life, p, 10, 15); return res(L(`${name} chụp ảnh mọi thứ, kể cả bữa sáng ở khách sạn.`, `${name} photographs everything, including the hotel breakfast.`), [['money', -u(life, 10)], ['happy', 6]].concat(fx(life, { happy: 6 })).slice(0, 2), 'good');
    case 'inherit': {
      if (n > 1) return tired;
      if (chance(life, clamp(p.closeness / 200, 0.03, 0.45))) { const amt = Math.min((p.wealth || 0) * 0.2, u(life, 150)); p.wealth -= amt; life.money += amt; p.closeness = clamp(p.closeness - 5); return res(L(`${name} thở dài rồi chuyển cho bạn một khoản.`, `${name} sighs and transfers you a sum.`), [['money', amt]], 'good'); }
      p.closeness = clamp(p.closeness - 15); return res(L(`${name} nhìn bạn: "Bố/mẹ còn sống mà."`, `${name} stares: "I'm still alive, you know."`), fx(life, { karma: -2 }), 'bad');
    }
    case 'read': if (n > 3) return tired; p.smarts = clamp(p.smarts + 2); closer(life, p, 3, 6); return res(L(`Bạn đọc truyện. ${name} đòi nghe lại lần thứ năm.`, `You read a story. ${name} asks for it a fifth time.`), fx(life, { happy: 3 }));
    case 'play': if (n > 3) return tired; closer(life, p, 4, 8); return res(L(`Bạn và ${name} xây pháo đài bằng gối. Phòng khách thất thủ.`, `You and ${name} build a pillow fort. The living room falls.`), fx(life, { happy: 4 }));
    case 'teach': if (n > 2) return tired; if (chance(life, 0.75)) { p.smarts = clamp(p.smarts + randint(life, 2, 4)); closer(life, p, 1, 4); return res(L(`${name} hiểu bài. Bạn cũng vừa hiểu.`, `${name} gets it. So do you, finally.`), fx(life, { smarts: 1 })); } p.closeness = clamp(p.closeness - 3); return res(L(`Buổi học kết thúc bằng nước mắt. Của cả hai.`, `The session ends in tears. Both of you.`), fx(life, { happy: -2 }), 'bad');
    case 'allowance': if (n > 1) return tired; life.money -= u(life, 1); closer(life, p, 3, 6); return res(L(`${name} cầm tiền và chạy ngay ra tiệm tạp hóa.`, `${name} grabs it and runs straight to the corner shop.`), [['money', -u(life, 1)]]);
    case 'tutor': if (n > 1) return tired; if (!canPay(life, 3)) return res(L('Bạn không đủ tiền.', "You can't afford it."), [], 'bad'); life.money -= u(life, 3); p.smarts = clamp(p.smarts + randint(life, 4, 7)); p.closeness = clamp(p.closeness - 2); return res(L(`${name} đi học thêm. Điểm lên, thời gian chơi xuống.`, `${name} goes to tutoring. Grades up, playtime down.`), [['money', -u(life, 3)]]);
    case 'praise': if (n > 3) return tired; closer(life, p, 3, 7); return res(L(`${name} cười tươi cả ngày.`, `${name} beams all day.`), fx(life, { happy: 2 }));
    case 'punish': if (n > 2) return tired; p.closeness = clamp(p.closeness - randint(life, 4, 9)); p.smarts = clamp(p.smarts + 1); return res(L(`${name} bị cấm xem TV một tuần. Không khí trong nhà rất lạnh.`, `${name} is banned from TV for a week. The house is very chilly.`), []);
    case 'drinks': if (n > 2) return tired; life.money -= u(life, 1); closer(life, p, 4, 9); return res(pick(life, [L(`Bạn và ${name} kể lại chuyện cũ đến lúc quán đóng cửa.`, `You and ${name} retell old stories until closing time.`), L(`${name} hát karaoke một bài buồn và khóc thật.`, `${name} sings a sad karaoke song and genuinely cries.`)]), fx(life, { happy: 5, health: -1 }));
    case 'borrow': {
      if (n > 1) return tired;
      if (chance(life, clamp(p.closeness / 130, 0.05, 0.8))) { const amt = u(life, randint(life, 5, 20)); life.money += amt; p.youOwe = (p.youOwe || 0) + amt; return res(L(`${name} cho bạn vay. "Khi nào có thì trả."`, `${name} lends you the money. "Pay me back whenever."`), [['money', amt]], 'good'); }
      p.closeness = clamp(p.closeness - 6); return res(L(`${name} nói dạo này cũng kẹt.`, `${name} says money's tight for them too.`), [], 'bad');
    }
    case 'lend': { if (n > 1) return tired; const amt = u(life, 10); if (!canPay(life, 10)) return res(L('Bạn không đủ tiền.', "You can't afford it."), [], 'bad'); life.money -= amt; p.owesYou = (p.owesYou || 0) + amt; closer(life, p, 5, 10); return res(L(`${name} cảm ơn rối rít và hứa trả trong tháng.`, `${name} thanks you profusely and promises to repay within the month.`), [['money', -amt]]); }
    case 'collect': { if (n > 1) return tired; if (chance(life, 0.55 + p.closeness / 300)) { const amt = p.owesYou; life.money += amt; p.owesYou = 0; return res(L(`${name} trả đủ, kèm lời xin lỗi vì trễ.`, `${name} pays it all back, with an apology for the delay.`), [['money', amt]], 'good'); } p.closeness = clamp(p.closeness - 8); return res(L(`${name} bảo "tuần sau nhé" lần thứ tư.`, `${name} says "next week" for the fourth time.`), [], 'bad'); }
    case 'payback': { const amt = p.youOwe; life.money -= amt; p.youOwe = 0; closer(life, p, 5, 10); return res(L(`Bạn trả ${name} đủ số tiền đã vay.`, `You pay ${name} back in full.`), [['money', -amt]], 'good'); }
    case 'setup': { if (n > 1) return tired; if (chance(life, clamp(p.closeness / 120, 0.1, 0.8))) { const c = newContact(life); c.role = 'partner'; c.closeness = 60; life.counts.partners++; return res(L(`${name} giới thiệu bạn với ${nm(life, c)}. Hai người nói chuyện như quen từ lâu.`, `${name} sets you up with ${nm(life, c)}. You click instantly.`), fx(life, { happy: 8 }), 'good'); } return res(L(`Người ${name} giới thiệu nói chuyện về tiền ảo suốt buổi.`, `The person ${name} found talks about crypto all night.`), fx(life, { happy: -2 })); }
    case 'prank': if (n > 2) return tired; if (chance(life, 0.6)) { closer(life, p, 1, 4); return res(L(`Bạn giấu điện thoại của ${name} trong tủ lạnh. Cả hai cười mãi.`, `You hide ${name}'s phone in the fridge. You both laugh for ages.`), fx(life, { happy: 5 })); } p.closeness = clamp(p.closeness - 8); return res(L(`${name} không thấy buồn cười chút nào.`, `${name} does not find it funny at all.`), fx(life, { happy: -1 }), 'bad');
    case 'counsel': if (n > 1) return tired; if (!canPay(life, 4)) return res(L('Bạn không đủ tiền.', "You can't afford it."), [], 'bad'); life.money -= u(life, 4); if (chance(life, 0.7)) { closer(life, p, 8, 15); return res(L('Chuyên gia giúp hai người nói ra những điều giữ trong lòng nhiều năm.', 'The counsellor helps you both say things you\'d held in for years.'), [['money', -u(life, 4)], ['happy', 5]], 'good'); } p.closeness = clamp(p.closeness - 5); return res(L('Buổi tư vấn biến thành một trận cãi nhau có người làm chứng.', 'Counselling turns into a fight with a witness.'), [['money', -u(life, 4)]], 'bad');
    case 'photo': if (n > 2) return tired; closer(life, p, 1, 4); return res(L(`Bạn và ${name} chụp 30 tấm, chọn được đúng 1 tấm cả hai đều đẹp.`, `You and ${name} take 30 photos; exactly one flatters you both.`), fx(life, { happy: 2 }));
    case 'insult': p.closeness = clamp(p.closeness - randint(life, 12, 22)); return res(pick(life, [L(`Bạn nói một câu cay nghiệt. ${name} im lặng rồi bỏ đi.`, `You say something cruel. ${name} goes quiet, then leaves.`), L(`${name} đáp trả còn sắc hơn. Bạn thua.`, `${name} fires back even sharper. You lose.`)]), fx(life, { karma: -3 }), 'bad');
    case 'fight': {
      if (n > 1) return tired;
      p.closeness = clamp(p.closeness - 25);
      if (chance(life, 0.12)) { life.record = true; return res(L(`Cảnh sát đến. Bạn bị lập biên bản và có tiền án nhẹ.`, `The police arrive. You're charged and now have a minor record.`), fx(life, { health: -8, karma: -6, happy: -6 }), 'bad'); }
      return chance(life, 0.5) ? res(L(`Bạn thắng, nhưng tay đau cả tuần.`, `You win, but your hand hurts for a week.`), fx(life, { health: -3, karma: -4, willpower: 2 })) : res(L(`${name} thắng. Bạn về nhà với con mắt tím.`, `${name} wins. You go home with a black eye.`), fx(life, { health: -7, karma: -4, happy: -4 }), 'bad');
    }
    case 'cutoff': p.cut = true; p.closeness = 0; return res(L(`Bạn chặn số ${name}. Một chương khép lại.`, `You block ${name}. A chapter closes.`), fx(life, { happy: 1 }));
  }
  return null;
}

// ───────── Công việc ─────────
export const EXTRA_WORK = [['overtime', L('Làm thêm giờ', 'Work overtime')], ['bossdrinks', L('Đi nhậu với sếp', 'Drinks with the boss')], ['transfer', L('Xin chuyển phòng ban', 'Ask for a transfer')], ['leave', L('Xin nghỉ phép', 'Take leave')], ['strike', L('Tham gia đình công', 'Join a strike')], ['whistle', L('Tố cáo sai phạm của sếp', 'Report your boss\'s misconduct')]];
export function extraWorkAction(life, act, n) {
  const j = life.job;
  if (!j) return null;
  const tired = res(L('Năm nay như vậy là đủ rồi.', "That's enough for this year."), []);
  switch (act) {
    case 'overtime': if (n > 2) return tired; j.perf = clamp(j.perf + randint(life, 5, 10)); life.money += j.salary * 0.04; return res(L('Bạn ở lại văn phòng đến khi đèn hành lang tự tắt.', 'You stay until the corridor lights switch themselves off.'), [['money', j.salary * 0.04]].concat(fx(life, { health: -2, happy: -2 })));
    case 'bossdrinks': if (n > 1) return tired; if (chance(life, 0.12)) { j.perf = clamp(j.perf - 8); return res(L('Bạn uống quá chén và gọi sếp bằng biệt danh cả phòng vẫn dùng sau lưng.', 'You overdo it and call your boss by the nickname everyone uses behind their back.'), fx(life, { happy: -5, health: -2 }), 'bad'); } j.perf = clamp(j.perf + randint(life, 4, 8)); return res(L('Sếp kể chuyện đời mình. Bạn gật đầu đúng lúc.', 'Your boss tells their life story. You nod at the right moments.'), fx(life, { health: -2 }));
    case 'transfer': if (n > 1) return tired; j.perf = 55; return res(L('Bạn chuyển sang phòng mới. Đồng nghiệp mới, bàn mới, máy pha cà phê tốt hơn.', 'You move to a new team. New colleagues, new desk, better coffee machine.'), fx(life, { happy: 4 }));
    case 'leave': if (n > 1) return tired; j.perf = clamp(j.perf - 4); return res(L('Một tuần nghỉ phép. Bạn tắt thông báo email, rồi bật lại, rồi tắt.', 'A week off. You mute email notifications, unmute them, mute them again.'), fx(life, { happy: 8, health: 3 }));
    case 'strike': {
      if (n > 1) return tired;
      const r = rand(life);
      if (r < 0.45) { j.salary = Math.round(j.salary * 1.08); return res(L('Cuộc đình công thắng lợi. Lương tăng 8%.', 'The strike wins. Pay goes up 8%.'), fx(life, { happy: 8, karma: 2 }), 'good'); }
      if (r < 0.9) { j.perf = clamp(j.perf - 15); return res(L('Đình công thất bại. Ban lãnh đạo ghi nhớ từng gương mặt.', 'The strike fails. Management remembers every face.'), fx(life, { happy: -4 }), 'bad'); }
      life.job = null; addLog(life, L('Bạn bị cho nghỉ việc sau cuộc đình công.', 'You\'re let go after the strike.'), 'bad'); return res(L('Bạn bị đuổi việc vì "gây rối".', 'You\'re fired for "disruption".'), fx(life, { happy: -10 }), 'bad');
    }
    case 'whistle': {
      if (n > 1) return tired;
      if (chance(life, 0.5)) { j.perf = clamp(j.perf + 15); j.salary = Math.round(j.salary * 1.1); return res(L('Ban giám đốc điều tra và sếp bị cách chức. Bạn được giao thêm trách nhiệm.', 'The board investigates and your boss is removed. You get more responsibility.'), fx(life, { karma: 8, fame: 2 }), 'good'); }
      life.job = null; addLog(life, L('Bạn mất việc sau khi tố cáo sếp.', 'You lose your job after blowing the whistle.'), 'bad'); return res(L('Công ty bao che. Bạn là người phải ra đi.', 'The company covers it up. You\'re the one who has to go.'), fx(life, { karma: 8, happy: -10 }), 'bad');
    }
  }
  return null;
}

// ───────── Vay ngân hàng và bảo hiểm ─────────
function loanEvent(life) {
  const gdp = country(life).gdp;
  const score = clamp(0.3 + (life.job ? 0.35 : 0) + life.stats.smarts / 500 - (life.record ? 0.2 : 0) - (life.loans || []).length * 0.15, 0.05, 0.95);
  const opt = (x, years, rate) => ({
    label: L(`Vay ${x} lần thu nhập TB · ${years} năm · lãi ${Math.round(rate * 100)}%`, `Borrow ${x}× avg income · ${years} yrs · ${Math.round(rate * 100)}% interest`),
    outcomes: [
      { chance: score, effects: { happy: 3 }, run: (lf) => { lf.loans = [...(lf.loans || []), { amt: x * gdp, left: x * gdp, rate, years, paid: 0 }]; lf.money += x * gdp; }, text: L('Ngân hàng duyệt khoản vay. Tiền về tài khoản, nỗi lo về theo.', 'The bank approves. The money arrives, and so does the worry.') },
      { chance: 1 - score, effects: { happy: -3 }, text: L('Ngân hàng từ chối. Nhân viên tín dụng rất tiếc, theo đúng kịch bản.', 'Rejected. The loan officer is very sorry, as scripted.') },
    ],
  });
  return { uid: 'money/loan', text: L(`Khả năng được duyệt: ${Math.round(score * 100)}%. Trả góp mỗi năm, trễ hạn nhiều có thể bị siết nhà.`, `Approval chance: ${Math.round(score * 100)}%. Repaid yearly; heavy arrears can cost you your home.`), choices: [opt(1, 3, 0.08), opt(5, 10, 0.1), opt(20, 20, 0.09), { label: L('Thôi', 'Never mind'), outcomes: [{ chance: 1, effects: {}, text: L('Bạn quyết định không vay.', 'You decide not to borrow.') }] }] };
}
function repayLoan(life) {
  const ln = (life.loans || [])[0];
  if (!ln) return res(L('Bạn không có khoản vay nào.', 'You have no loans.'), []);
  const pay = Math.min(ln.left, Math.max(0, life.money));
  if (pay <= 0) return res(L('Bạn không có tiền để trả.', "You don't have money to pay."), [], 'bad');
  ln.left -= pay;
  life.money -= pay;
  if (ln.left <= 1) { life.loans.shift(); milestone(life, L('Trả hết một khoản vay', 'Paid off a loan'), 'good'); return res(L('Bạn trả hết khoản vay! Ngân hàng gửi thư chúc mừng kèm lời mời vay tiếp.', 'Loan paid off! The bank congratulates you and offers another loan.'), [['money', -pay]].concat(fx(life, { happy: 8 })), 'good'); }
  return res(L('Bạn trả bớt một phần nợ.', 'You pay down part of the loan.'), [['money', -pay]]);
}
function insuranceEvent(life) {
  const opt = (kind, vi, en) => ({ label: L(vi, en), outcomes: [{ chance: 1, effects: {}, run: (lf) => { lf.insurance = { ...(lf.insurance || {}), [kind]: true }; }, text: L('Bạn ký hợp đồng bảo hiểm. Phí trừ mỗi năm.', 'You sign the policy. Premiums are taken yearly.') }] });
  const ins = life.insurance || {};
  const ch = [];
  if (!ins.health) ch.push(opt('health', 'Bảo hiểm sức khỏe · đi khám miễn phí, giảm chi phí chữa bệnh', 'Health insurance · free doctor visits, cheaper treatment'));
  if (!ins.life) ch.push(opt('life', 'Bảo hiểm nhân thọ · con cái nhận thêm tiền khi bạn mất', 'Life insurance · your children receive a payout when you die'));
  if (ins.health || ins.life) ch.push({ label: L('Hủy tất cả bảo hiểm', 'Cancel all insurance'), outcomes: [{ chance: 1, effects: {}, run: (lf) => { lf.insurance = {}; }, text: L('Bạn hủy hợp đồng. Hy vọng không có gì xảy ra.', 'You cancel. Fingers crossed.') }] });
  ch.push({ label: L('Thôi', 'Never mind'), outcomes: [{ chance: 1, effects: {}, text: L('Bạn suy nghĩ thêm.', 'You think it over.') }] });
  return { uid: 'money/insure', text: L('Nhân viên bảo hiểm mỉm cười rất rộng. Bạn muốn mua gói nào?', 'The insurance agent smiles very widely. Which policy?'), choices: ch };
}
/** Trả góp, lãi, phí bảo hiểm, bạn bè trả nợ. Gọi mỗi năm. */
export function financeYear(life) {
  const gdp = country(life).gdp;
  for (const ln of life.loans || []) {
    ln.left *= 1 + ln.rate;
    const due = Math.min(ln.left, (ln.amt * (1 + ln.rate)) / ln.years);
    life.money -= due;
    ln.left -= due;
    ln.paid++;
  }
  life.loans = (life.loans || []).filter((ln) => ln.left > 1);
  if ((life.loans || []).length && life.money < -3 * gdp && chance(life, 0.4)) {
    if (life.homes && life.homes.length) {
      const h = life.homes.shift();
      life.money += h.value * 0.7 - (h.debt || 0);
      addLog(life, L('Ngân hàng siết nhà vì bạn nợ quá hạn.', 'The bank repossesses your home over unpaid debt.'), 'bad');
      milestone(life, L('Bị siết nhà', 'Home repossessed'), 'bad');
    } else {
      life.stats.happy = clamp(life.stats.happy - 8);
      addLog(life, L('Ngân hàng gửi thư đòi nợ lần cuối. Điểm tín dụng của bạn rơi tự do.', 'The bank sends a final demand. Your credit score is in free fall.'), 'bad');
    }
  }
  const ins = life.insurance || {};
  if (ins.health) life.money -= 0.02 * gdp;
  if (ins.life) life.money -= 0.015 * gdp;
  for (const p of life.people) {
    if (p.owesYou > 0 && p.alive && chance(life, 0.25)) { life.money += p.owesYou; addLog(life, L(`${nm(life, p)} trả lại số tiền đã vay.`, `${nm(life, p)} repays what they borrowed.`), 'good'); p.owesYou = 0; }
    if (p.youOwe > 0 && p.alive) p.closeness = clamp(p.closeness - 2);
  }
}
