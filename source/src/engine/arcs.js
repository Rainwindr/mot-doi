// Mạch truyện dài: mỗi mạch gắn với một nhân vật có tên, quay lại nhiều lần trong đời.
// Lựa chọn được ghi vào arc.data và quyết định các giai đoạn sau.
import { L, clamp, chance, randint, pick } from './util.js';
import { partner, spouse, people, byId, randomPerson, partnerGender, personName, addLog, unit } from './life.js';
import { startDating } from './love.js';

const nm = (life, p) => (p ? personName(life, p) : '');
// o(chance, effects, text, next, set, run): next = [giai đoạn, sau ít nhất, sau nhiều nhất] hoặc null = kết thúc
const o = (chance, effects, text, next = null, set = null, run = null) => ({ chance, effects, text, arcNext: next, arcSet: set, run });
const ch = (label, outcomes, requires) => ({ label, outcomes, requires });
const bump = (p, d) => { if (p) p.closeness = clamp(p.closeness + d); };
const kill = (p) => { if (p) p.alive = false; };
const PET_NAMES = ['Mực', 'Vàng', 'Bông', 'Lucky', 'Tôm', 'Mochi', 'Bơ'];

export const ARCS = {
  // ───────── Bạn thân thời thơ ấu ─────────
  bestie: {
    tag: L('Bạn thân', 'Best friend'),
    start: { age: [6, 8], p: 0.6 },
    npc: (life) => randomPerson(life, life, { role: 'bestie', age: life.age, closeness: 45 }),
    stages: {
      meet: (life, n) => ({
        text: L(`Bạn mới chuyển đến lớp, ${nm(life, n)}, ngồi cạnh bạn và chia cho bạn nửa hộp bánh.`, `A new kid, ${nm(life, n)}, sits next to you and shares half their snack.`),
        choices: [
          ch(L('Nhận bánh và rủ chơi cùng', 'Take it and invite them to play'), [o(1, { happy: 8 }, L('Từ hôm đó hai đứa đi đâu cũng có nhau.', 'From that day on you go everywhere together.'), ['secret', 5, 7], { close: true }, (lf) => bump(n, 30))]),
          ch(L('Lắc đầu, quay đi', 'Shake your head and turn away'), [o(1, { happy: -2 }, L(`${nm(life, n)} ngồi ăn một mình.`, `${nm(life, n)} eats alone.`), ['secret', 5, 7], { close: false })]),
        ],
      }),
      secret: (life, n, d) => ({
        text: d.close
          ? L(`${nm(life, n)} thú nhận đã lấy tiền quỹ lớp vì nhà hết gạo. Cô giáo đang nghi ngờ bạn.`, `${nm(life, n)} confesses they took the class fund because there's no food at home. The teacher suspects you.`)
          : L(`Tiền quỹ lớp biến mất. Bạn thấy ${nm(life, n)} lén nhét phong bì vào cặp. Cô giáo đang nghi ngờ bạn.`, `The class fund is missing. You saw ${nm(life, n)} slip an envelope into their bag. The teacher suspects you.`),
        choices: [
          ch(L('Nhận tội thay cho bạn ấy', 'Take the blame for them'), [o(1, { karma: 10, happy: -8 }, L(`Bạn bị phạt cả tuần. ${nm(life, n)} sẽ không bao giờ quên chuyện này.`, `You're punished for a week. ${nm(life, n)} will never forget it.`), ['parting', 4, 6], { loyal: true }, () => bump(n, 35))]),
          ch(L('Rủ nhau đi làm thêm trả lại', 'Work odd jobs together to pay it back'), [o(1, { willpower: 6, karma: 6 }, L('Hai đứa rửa xe cả tháng, lặng lẽ trả tiền vào quỹ.', 'You wash cars for a month and quietly repay the fund.'), ['parting', 4, 6], { loyal: true }, () => bump(n, 25))]),
          ch(L('Nói thật với cô giáo', 'Tell the teacher the truth'), [o(1, { karma: 2 }, L(`${nm(life, n)} bị đình chỉ học và không nói chuyện với bạn nữa.`, `${nm(life, n)} is suspended and stops speaking to you.`), ['parting', 4, 6], { loyal: false }, () => bump(n, -40))]),
        ],
      }),
      parting: (life, n, d) => ({
        text: L(`${nm(life, n)} sắp chuyển đến thành phố khác.${d.loyal ? ' Họ ôm bạn rất lâu ở bến xe.' : ''}`, `${nm(life, n)} is moving to another city.${d.loyal ? ' They hug you for a long time at the station.' : ''}`),
        choices: [
          ch(L('Hứa sẽ nhắn tin mỗi tuần', 'Promise to text every week'), [
            o(0.65, { happy: 3 }, L('Và bạn giữ lời, suốt nhiều năm.', 'And you keep your word for years.'), ['reunion', 10, 13], { kept: true }),
            o(0.35, { happy: -2 }, L('Tin nhắn thưa dần rồi dừng hẳn.', 'The messages slow down, then stop.'), ['reunion', 10, 13], { kept: false }),
          ]),
          ch(L('Vẫy tay chào', 'Just wave goodbye'), [o(1, {}, L('Mỗi người một hướng.', 'You go your separate ways.'), ['reunion', 10, 13], { kept: false })]),
        ],
      }),
      reunion: (life, n, d) => d.kept && d.loyal ? {
        text: L(`${nm(life, n)} quay về. Giờ họ có một công ty nhỏ đang ăn nên làm ra và muốn bạn góp vốn làm đối tác.`, `${nm(life, n)} is back, running a small company that's taking off, and wants you as a partner.`),
        choices: [
          ch(L('Góp vốn', 'Invest'), [
            o(0.65, { money: 150, happy: 12 }, L('Công ty bùng nổ. Hai người bạn thơ ấu thành đối tác giàu có.', 'The company explodes. Childhood friends turned wealthy partners.'), ['twilight', 25, 32], { partner: true }, () => bump(n, 15)),
            o(0.35, { money: -40, happy: -8 }, L('Công ty phá sản, nhưng tình bạn vẫn còn.', 'The company folds, but the friendship survives.'), ['twilight', 25, 32], { partner: true }),
          ], { min: { money: 40 } }),
          ch(L('Từ chối nhưng vẫn ủng hộ', 'Decline, but cheer them on'), [o(1, { happy: 5 }, L('Hai người vẫn ăn tối cùng nhau mỗi tháng.', 'You still have dinner together every month.'), ['twilight', 25, 32])]),
        ],
      } : {
        text: L(`Bạn thấy ${nm(life, n)} trên bản tin. Đã ${life.age - (d.metAge ?? 7)} năm không gặp.`, `You spot ${nm(life, n)} on the news. It's been years.`),
        choices: [
          ch(L('Nhắn tin hỏi thăm', 'Send a message'), [
            o(0.6, { happy: 8 }, L('Họ gọi lại ngay. Hai người nói chuyện đến sáng.', 'They call right back. You talk until dawn.'), ['twilight', 25, 32], { kept: true }, () => bump(n, 30)),
            o(0.4, { happy: -3 }, L('Họ đọc nhưng không trả lời.', 'Seen. No reply.'), ['twilight', 25, 32]),
          ]),
          ch(L('Thôi, chuyện cũ rồi', "Let it go, it's the past"), [o(1, {}, L('Bạn tắt ti vi.', 'You switch off the TV.'), ['twilight', 25, 32])]),
        ],
      },
      twilight: (life, n, d) => ({
        text: L(`${nm(life, n)} nhập viện, bệnh rất nặng, và nhờ người nhắn hỏi bạn có đến không.`, `${nm(life, n)} is gravely ill in hospital and asks whether you'll come.`),
        choices: [
          ch(L('Ở bên họ đến cuối', 'Stay by their side'), [o(1, { happy: -8, karma: 10 }, d.kept ? L('Hai người kể lại chuyện hộp bánh năm lớp một. Họ ra đi mỉm cười.', 'You retell the story of the shared snack. They pass away smiling.') : L('Họ nắm tay bạn: "Cảm ơn vì đã đến."', 'They squeeze your hand: "Thank you for coming."'), null, null, () => kill(n))]),
          ch(L('Gửi hoa, nói mình bận', 'Send flowers, say you are busy'), [o(1, { karma: -6 }, L('Tuần sau bạn nhận tin họ đã mất.', 'A week later you hear they have died.'), null, null, () => kill(n))]),
        ],
      }),
    },
  },

  // ───────── Kẻ thù truyền kiếp ─────────
  rival: {
    tag: L('Đối thủ', 'Rival'),
    start: { age: [9, 11], p: 0.5 },
    npc: (life) => randomPerson(life, life, { role: 'rival', age: life.age, closeness: 20 }),
    stages: {
      meet: (life, n) => ({
        text: L(`${nm(life, n)} chép bài của bạn rồi được cô khen trước cả lớp.`, `${nm(life, n)} copies your homework and gets praised in front of the class.`),
        choices: [
          ch(L('Tố cáo ngay', 'Call them out'), [
            o(0.5, { happy: 6, willpower: 3 }, L('Cô xem lại và trả điểm cho bạn.', 'The teacher checks and gives you the credit.'), ['contest', 4, 6], { grudge: true }),
            o(0.5, { happy: -6 }, L('Cả lớp nghĩ bạn ghen tị.', 'The class thinks you are just jealous.'), ['contest', 4, 6], { grudge: true }),
          ]),
          ch(L('Im lặng, nhớ kỹ mặt', 'Stay quiet and remember'), [o(1, { willpower: 4 }, L('Cuộc chiến chính thức bắt đầu.', 'The war has officially begun.'), ['contest', 4, 6], { grudge: true })]),
          ch(L('Rủ họ học nhóm', 'Invite them to study together'), [o(1, { karma: 5 }, L(`${nm(life, n)} ngạc nhiên, rồi gật đầu.`, `${nm(life, n)} looks surprised, then nods.`), ['contest', 4, 6], { respect: true }, () => bump(n, 25))]),
        ],
      }),
      contest: (life, n, d) => ({
        text: L(`Bạn và ${nm(life, n)} cùng vào chung kết cuộc thi lớn nhất năm.`, `You and ${nm(life, n)} both reach the final of the year's biggest contest.`),
        choices: [
          ch(L('Ôn luyện ngày đêm', 'Train day and night'), [
            o(0.7, { smarts: 5, fame: 6, happy: 10 }, L('Bạn thắng. Gương mặt của họ là phần thưởng đẹp nhất.', 'You win. Their face is the best prize.'), ['workplace', 10, 13], { won: true }),
            o(0.3, { happy: -8 }, L(`${nm(life, n)} thắng với cách biệt một điểm.`, `${nm(life, n)} wins by a single point.`), ['workplace', 10, 13], { won: false }),
          ], { min: { smarts: 55 } }),
          ch(L('Giấu tài liệu của họ', 'Hide their notes'), [
            o(0.6, { karma: -12, happy: 6 }, L('Bạn thắng, nhưng không vui lắm.', "You win, but it doesn't feel great."), ['workplace', 10, 13], { won: true, dirty: true }),
            o(0.4, { karma: -15, happy: -12, fame: -5 }, L('Camera ghi lại. Bạn bị loại.', 'The camera caught you. Disqualified.'), ['workplace', 10, 13], { won: false, dirty: true }),
          ]),
          ch(L('Bắt tay chúc may mắn', 'Shake hands and wish them luck'), [
            o(0.35, { happy: 12, karma: 6 }, L('Bạn thắng một cách đẹp đẽ.', 'You win, fair and square.'), ['workplace', 10, 13], { won: true, respect: true }, () => bump(n, 20)),
            o(0.65, { karma: 6, happy: -3 }, L('Họ thắng, và lần đầu tiên nói lời cảm ơn.', 'They win, and thank you for the first time.'), ['workplace', 10, 13], { respect: true }, () => bump(n, 25)),
          ]),
        ],
      }),
      workplace: (life, n, d) => ({
        text: life.job
          ? L(`Công ty thông báo sếp mới của bạn: ${nm(life, n)}.`, `Your company announces your new boss: ${nm(life, n)}.`)
          : L(`${nm(life, n)} dọn đến sống ngay cạnh nhà bạn, mua chiếc xe to hơn xe bạn.`, `${nm(life, n)} moves in next door and buys a bigger car than yours.`),
        choices: [
          ch(L('Chủ động làm hòa', 'Make peace'), [
            o(d.respect ? 0.85 : 0.45, { happy: 6, rel_boss: 8 }, L('Hai người cười về chuyện ngày xưa.', 'You laugh about the old days.'), ['reckoning', 12, 16], { peace: true }, () => bump(n, 30)),
            o(d.respect ? 0.15 : 0.55, { happy: -5 }, d.dirty ? L('Họ chưa quên chuyện cuộc thi năm ấy.', "They haven't forgotten the contest.") : L('Họ cười khẩy.', 'They smirk.'), ['reckoning', 12, 16]),
          ]),
          ch(L('Cạnh tranh đến cùng', 'Compete to the bitter end'), [
            o(0.5, { willpower: 6, money: 30, happy: 6 }, L('Bạn vượt mặt họ. Lần này nữa.', 'You beat them. Again.'), ['reckoning', 12, 16]),
            o(0.5, { happy: -8, health: -3 }, L('Họ thắng ván này. Bạn mất ngủ cả tháng.', 'They win this round. You lose sleep for a month.'), ['reckoning', 12, 16]),
          ]),
          ch(L('Tránh mặt, chuyển đi chỗ khác', 'Avoid them and move on'), [o(1, { happy: -2 }, L('Bạn chọn bình yên.', 'You choose peace and quiet.'), ['reckoning', 12, 16])]),
        ],
      }),
      reckoning: (life, n, d) => ({
        text: L(`${nm(life, n)} phá sản, gõ cửa nhà bạn lúc nửa đêm xin giúp đỡ.`, `${nm(life, n)} is bankrupt and knocks on your door at midnight asking for help.`),
        choices: [
          ch(L('Cho vay một khoản lớn', 'Lend them a large sum'), [
            o(0.5, { money: -30, karma: 12 }, L('Năm năm sau họ trả gấp đôi, kèm một lá thư xin lỗi cho mọi chuyện.', 'Five years later they repay double, with a letter apologising for everything.'), null, null, (lf) => { lf.money += 60 * unit(lf); bump(n, 40); }),
            o(0.5, { money: -30, karma: 10 }, L('Họ biến mất cùng khoản tiền.', 'They vanish with the money.'), null),
          ], { min: { money: 30 } }),
          ...(d.peace ? [ch(L('Mời họ về làm cùng', 'Offer them a job with you'), [o(1, { karma: 10, happy: 6 }, L('Kẻ thù cũ thành người đồng hành đáng tin nhất.', 'Your old rival becomes your most loyal ally.'), null, null, () => bump(n, 40))])] : []),
          ch(L('Đóng cửa lại', 'Close the door'), [o(1, { karma: -6, happy: 4 }, L('Bạn thấy vui, một cách hơi xấu hổ.', 'You feel good, in a slightly shameful way.'))]),
        ],
      }),
    },
  },

  // ───────── Mối tình đầu (chỉ từ 18 tuổi) ─────────
  firstlove: {
    tag: L('Mối tình đầu', 'First love'),
    start: { age: [18, 22], p: 0.45, when: (life) => !partner(life) && !life.prison },
    npc: (life) => randomPerson(life, life, { role: 'contact', gender: partnerGender(life, life), age: clamp(life.age + randint(life, -1, 2), 18, 30), closeness: 50 }),
    stages: {
      meet: (life, n) => ({
        text: L(`Một buổi chiều mưa, bạn trú mưa cùng ${nm(life, n)}. Hai người nói chuyện như đã quen từ lâu.`, `Sheltering from the rain, you meet ${nm(life, n)}. You talk like you've known each other forever.`),
        choices: [
          ch(L('Xin số và hẹn gặp lại', 'Ask for their number'), [
            o(0.75, { happy: 12 }, L('Hai người bắt đầu hẹn hò. Mọi bài hát tình yêu bỗng có nghĩa.', 'You start dating. Every love song suddenly makes sense.'), ['storm', 1, 3], { together: true }, (lf) => { if (!partner(lf)) startDating(lf, n); }),
            o(0.25, { happy: -4 }, L('Họ cười, nhưng nói đang chuẩn bị đi xa.', "They smile, but say they're about to move away."), ['storm', 1, 3], { together: false }),
          ]),
          ch(L('Để khoảnh khắc trôi qua', 'Let the moment pass'), [o(1, {}, L('Mưa tạnh. Mỗi người một ngả.', 'The rain stops. You go separate ways.'), ['storm', 1, 3], { together: false })]),
        ],
      }),
      storm: (life, n, d) => (d.together && partner(life) === n) ? {
        text: L(`${nm(life, n)} nhận được học bổng ở nước ngoài, ba năm.`, `${nm(life, n)} wins a three-year scholarship abroad.`),
        choices: [
          ch(L('Hứa sẽ chờ', 'Promise to wait'), [
            o(0.45, { happy: 4 }, L('Ba năm yêu xa. Họ trở về và ôm bạn ở sân bay.', 'Three years apart. They come back and hold you at the airport.'), ['return', 12, 15], { waited: true }, () => bump(n, 20)),
            o(0.55, { happy: -12 }, L('Một ngày, họ nhắn rằng đã yêu người khác.', 'One day they text that they have met someone else.'), ['return', 12, 15], { together: false }, (lf) => { if (partner(lf) === n) { n.role = 'ex'; lf.flags.recent_breakup = lf.age; } }),
          ]),
          ch(L('Chia tay trong nước mắt', 'Break up in tears'), [o(1, { happy: -10 }, L('Bạn giữ lại chiếc áo khoác họ để quên.', 'You keep the jacket they left behind.'), ['return', 12, 15], { together: false }, (lf) => { if (partner(lf) === n) { n.role = 'ex'; lf.flags.recent_breakup = lf.age; } })]),
        ],
      } : {
        text: L(`Bạn thấy ảnh ${nm(life, n)} tay trong tay với người khác. Hơi nhói.`, `You see a photo of ${nm(life, n)} holding hands with someone else. It stings.`),
        choices: [ch(L('Thả tim rồi đi ngủ', 'Like it and go to sleep'), [o(1, { happy: -4 }, L('Đêm đó bạn ngủ muộn.', 'You sleep late that night.'), ['return', 12, 15])])],
      },
      return: (life, n, d) => {
        const mine = spouse(life) === n || partner(life) === n;
        if (mine) return {
          text: L(`Mười mấy năm bên nhau, ${nm(life, n)} vẫn giữ chiếc vé xe buýt từ buổi hẹn đầu tiên.`, `Years together, and ${nm(life, n)} still keeps the bus ticket from your first date.`),
          choices: [ch(L('Đưa họ quay lại nơi trú mưa năm ấy', 'Take them back to where you met'), [o(1, { happy: 10 }, L('Trời lại đổ mưa, như được sắp đặt.', 'It starts raining again, as if on cue.'), ['letter', 30, 38], null, () => bump(n, 15))])],
        };
        const taken = !!partner(life);
        return {
          text: L(`${nm(life, n)} quay lại thành phố, vẫn độc thân, nhắn tin: "Lâu rồi không gặp."`, `${nm(life, n)} is back in town, still single, and texts: "Long time no see."`),
          choices: taken ? [
            ch(L('Gặp như bạn cũ, có cả người yêu đi cùng', 'Meet as old friends, bringing your partner'), [o(1, { karma: 4, happy: 3 }, L('Một buổi cà phê dễ chịu, không ai khó xử.', 'A pleasant coffee. No awkwardness.'), ['letter', 30, 38])]),
            ch(L('Hẹn gặp riêng', 'Meet them alone'), [o(1, { happy: 10, karma: -10, risk: 5 }, L('Một buổi tối mà bạn sẽ phải giấu.', 'An evening you will have to keep secret.'), ['letter', 30, 38], { affair: true }, (lf) => { if (!lf.affair) { n.role = 'lover'; lf.affair = { id: n.id, since: lf.age }; lf.flags.has_affair = lf.age; } })]),
            ch(L('Không trả lời', "Don't reply"), [o(1, { willpower: 5 }, L('Có những cánh cửa nên để đóng.', 'Some doors should stay closed.'), ['letter', 30, 38])]),
          ] : [
            ch(L('Hẹn gặp lại', 'Meet up'), [
              o(0.6, { happy: 15 }, L('Như chưa từng xa cách. Hai người quay lại với nhau.', 'As if no time had passed. You get back together.'), ['letter', 30, 38], { together: true }, (lf) => { if (!partner(lf)) startDating(lf, n); }),
              o(0.4, { happy: -3 }, L('Hóa ra cả hai đã thay đổi quá nhiều.', "Turns out you've both changed too much."), ['letter', 30, 38]),
            ]),
            ch(L('Thôi, chuyện đã qua', "Leave it in the past"), [o(1, {}, L('Bạn lưu số rồi không bao giờ gọi.', 'You save the number and never call.'), ['letter', 30, 38])]),
          ],
        };
      },
      letter: (life, n) => ({
        text: L(`Bạn nhận được một lá thư tay từ ${nm(life, n)}.`, `A handwritten letter arrives from ${nm(life, n)}.`),
        choices: [ch(L('Đọc', 'Read it'), [o(1, { happy: 8 }, spouse(life) === n ? L('"Cảm ơn vì cơn mưa năm ấy, và cả đời sau đó."', '"Thank you for that rainy day, and for the whole life after."') : L('"Bạn là điều đẹp nhất của tuổi trẻ mình."', '"You were the most beautiful part of my youth."'))])],
      }),
    },
  },

  // ───────── Người thầy ─────────
  mentor: {
    tag: L('Thầy cô', 'Mentor'),
    start: { age: [12, 15], p: 0.5, when: (life) => !!life.edu.stage && life.stats.smarts >= 45 },
    npc: (life) => randomPerson(life, life, { role: 'mentor', age: life.age + randint(life, 25, 40), closeness: 50 }),
    stages: {
      meet: (life, n) => ({
        text: L(`Thầy/cô ${nm(life, n)} giữ bạn lại sau giờ học: "Em có năng khiếu. Đừng phí nó."`, `Your teacher, ${nm(life, n)}, keeps you after class: "You have a gift. Don't waste it."`),
        choices: [
          ch(L('Nhận học kèm mỗi chiều', 'Accept extra lessons every afternoon'), [o(1, { smarts: 8, willpower: 4 }, L('Những buổi chiều ấy thay đổi cách bạn nhìn thế giới.', 'Those afternoons change how you see the world.'), ['recommend', 2, 4], { taught: true }, () => bump(n, 25))]),
          ch(L('Ngại, viện cớ bận', 'Make an excuse'), [o(1, {}, L('Thầy/cô gật đầu, không nói gì thêm.', 'The teacher nods and says nothing more.'), ['repay', 15, 18], { taught: false })]),
        ],
      }),
      recommend: (life, n) => ({
        text: L(`Nhờ thư giới thiệu của ${nm(life, n)}, bạn được mời phỏng vấn một học bổng danh giá.`, `Thanks to a letter from ${nm(life, n)}, you're invited to interview for a prestigious scholarship.`),
        choices: [
          ch(L('Chuẩn bị thật kỹ', 'Prepare thoroughly'), [
            o(0.7, { money: 60, happy: 12, smarts: 3 }, L('Bạn giành được học bổng toàn phần!', 'You win a full scholarship!'), ['repay', 12, 15], { scholar: true }),
            o(0.3, { happy: -6 }, L('Bạn lọt vào vòng cuối, rồi dừng lại.', 'You reach the final round, then fall short.'), ['repay', 12, 15]),
          ], { min: { smarts: 55 } }),
          ch(L('Cứ đi, tới đâu hay tới đó', 'Just wing it'), [
            o(0.25, { money: 60, happy: 12 }, L('Ban giám khảo thích sự tự nhiên của bạn.', 'The panel loves your spontaneity.'), ['repay', 12, 15], { scholar: true }),
            o(0.75, { happy: -5 }, L('Bạn quên mất câu trả lời đã nghĩ sẵn.', 'You forget every answer you had planned.'), ['repay', 12, 15]),
          ]),
        ],
      }),
      repay: (life, n, d) => ({
        text: L(`Trường cũ sắp đóng cửa vì thiếu tiền. ${nm(life, n)}, giờ đã già, gọi điện cho từng học trò cũ.`, `Your old school is closing for lack of funds. ${nm(life, n)}, now old, is calling every former student.`),
        choices: [
          ch(L('Quyên góp một khoản lớn', 'Donate a large sum'), [o(1, { money: -30, karma: 15, happy: 6 }, L('Ngôi trường được cứu. Một phòng học được đặt tên bạn.', 'The school is saved. A classroom is named after you.'), ['farewell', 8, 15], { saved: true })], { min: { money: 30 } }),
          ch(L('Viết bài kêu gọi trên mạng', 'Write an appeal online'), [
            o(0.5, { fame: 6, karma: 8 }, L('Bài viết lan truyền, ngôi trường được cứu.', 'The post goes viral. The school is saved.'), ['farewell', 8, 15], { saved: true }),
            o(0.5, { karma: 4 }, L('Bài viết chìm giữa dòng tin.', 'The post sinks without a trace.'), ['farewell', 8, 15]),
          ]),
          ch(L('Không bắt máy', "Don't pick up"), [o(1, { karma: -5 }, L('Điện thoại rung rồi im.', 'The phone buzzes, then goes quiet.'), ['farewell', 8, 15])]),
        ],
      }),
      farewell: (life, n, d) => ({
        text: L(`${nm(life, n)} qua đời. Học trò cũ đến chật sân trường${d.saved ? ', ngôi trường mà bạn đã giúp giữ lại' : ''}.`, `${nm(life, n)} has died. Former students fill the schoolyard${d.saved ? ', the school you helped save' : ''}.`),
        choices: [ch(L('Đứng lên nói vài lời', 'Say a few words'), [o(1, { happy: -5, karma: 4 }, d.taught ? L('Bạn kể về những buổi chiều học kèm. Cả sân im lặng.', 'You talk about those afternoon lessons. The yard falls silent.') : L('Bạn ước mình đã nhận lời học kèm năm ấy.', "You wish you'd said yes to those lessons."), null, null, () => kill(n))])],
      }),
    },
  },

  // ───────── Bí mật gia đình ─────────
  secret: {
    tag: L('Anh chị em cùng cha/mẹ khác', 'Half-sibling'),
    start: { age: [15, 24], p: 0.12, force: false, when: (life) => people(life, 'mother').length + people(life, 'father').length > 0 },
    npc: (life) => randomPerson(life, life, { role: 'half', age: life.age + randint(life, -4, 6), closeness: 20 }),
    stages: {
      meet: (life, n) => ({
        text: L(`Dọn nhà kho, bạn tìm thấy những lá thư cho thấy bố hoặc mẹ có một người con riêng: ${nm(life, n)}.`, `Clearing out the attic, you find letters revealing a parent has another child: ${nm(life, n)}.`),
        choices: [
          ch(L('Tìm gặp người đó', 'Track them down'), [
            o(0.7, { happy: 6 }, L('Hai người có cùng một kiểu cười.', 'You both have the same laugh.'), ['inherit', 12, 20], { met: true }, () => bump(n, 35)),
            o(0.3, { happy: -6 }, L('Họ đóng sầm cửa: "Tôi không có gia đình nào khác."', 'They slam the door: "I have no other family."'), ['inherit', 12, 20], { met: false }),
          ]),
          ch(L('Hỏi thẳng bố mẹ', 'Confront your parents'), [o(1, { rel_mother: -10, rel_father: -10, willpower: 4 }, L('Bữa cơm tối hôm đó dài nhất đời bạn.', 'The longest dinner of your life.'), ['inherit', 12, 20], { asked: true })]),
          ch(L('Đốt thư, giữ bí mật', 'Burn the letters and keep the secret'), [o(1, { karma: -2 }, L('Tro bay theo gió. Bí mật thì không.', 'The ashes blow away. The secret does not.'), ['inherit', 12, 20])]),
        ],
      }),
      inherit: (life, n, d) => ({
        text: d.met
          ? L(`Gia đình có chuyện lớn về tài sản. ${nm(life, n)} đứng về phía bạn trong buổi họp gia đình.`, `A big family dispute over property. ${nm(life, n)} stands by you at the family meeting.`)
          : L(`Luật sư báo ${nm(life, n)} đòi chia phần tài sản của gia đình bạn.`, `A lawyer says ${nm(life, n)} is claiming a share of your family's estate.`),
        choices: [
          ch(L('Chia đều', 'Split it fairly'), [o(1, { money: 20, karma: 8 }, L('Hai người ký giấy rồi cùng đi ăn tối.', 'You sign the papers, then go to dinner together.'), null, null, () => bump(n, 30))]),
          ch(L('Ra tòa giành phần hơn', 'Fight in court for more'), [
            o(0.6, { money: 60, karma: -8 }, L('Bạn thắng kiện. Họ không bao giờ gọi lại.', 'You win. They never call again.'), null, null, () => bump(n, -40)),
            o(0.4, { money: -25, happy: -8 }, L('Bạn thua kiện và mất cả án phí.', 'You lose, and pay the court costs.'), null, null, () => bump(n, -30)),
          ]),
          ch(L('Nhường hết cho họ', 'Give them everything'), [o(1, { karma: 15, happy: 4 }, L('Họ khóc, ôm bạn lần đầu tiên.', 'They cry and hug you for the first time.'), null, null, () => bump(n, 50))]),
        ],
      }),
    },
  },

  // ───────── Thú cưng ─────────
  pet: {
    tag: L('Thú cưng', 'Pet'),
    start: { age: [5, 10], p: 0.4 },
    npc: (life) => ({ ...randomPerson(life, life, { role: 'pet', age: 0, closeness: 70 }), first: pick(life, PET_NAMES), last: '', pet: true }),
    stages: {
      meet: (life, n) => ({
        text: L(`Một chú chó con ướt sũng lẽo đẽo theo bạn về tận cửa nhà.`, 'A soaked little puppy follows you all the way home.'),
        choices: [
          ch(L('Năn nỉ bố mẹ giữ lại', 'Beg your parents to keep it'), [
            o(0.7, { happy: 12 }, L(`Cả nhà đặt tên nó là ${n.first}.`, `The family names it ${n.first}.`), ['trouble', 3, 5], { kept: true }),
            o(0.3, { happy: -8 }, L('Bố mẹ mang nó đến trại cứu hộ.', 'Your parents take it to a shelter.'), null, null, () => kill(n)),
          ]),
          ch(L('Cho ăn rồi để nó đi', 'Feed it and let it go'), [o(1, { karma: 3 }, L('Nó vẫy đuôi rồi chạy mất.', 'It wags its tail and runs off.'), null, null, () => kill(n))]),
        ],
      }),
      trouble: (life, n) => ({
        text: L(`${n.first} nuốt phải một chiếc tất và nằm bẹp cả ngày.`, `${n.first} swallowed a sock and has been lying flat all day.`),
        choices: [
          ch(L('Đưa đi thú y ngay', 'Rush to the vet'), [o(1, { money: -2, happy: 6 }, L(`${n.first} khỏe lại và nhả ra... chiếc tất thứ hai.`, `${n.first} recovers and produces... a second sock.`), ['oldage', 8, 11])]),
          ch(L('Chờ xem sao', 'Wait and see'), [
            o(0.5, { happy: 3 }, L(`Sáng hôm sau ${n.first} lại chạy nhảy như chưa có gì.`, `Next morning ${n.first} is bouncing around as if nothing happened.`), ['oldage', 8, 11]),
            o(0.5, { happy: -20 }, L(`${n.first} không qua khỏi đêm đó. Bạn tự trách mình rất lâu.`, `${n.first} doesn't make it through the night. You blame yourself for a long time.`), null, null, () => kill(n)),
          ]),
        ],
      }),
      oldage: (life, n) => ({
        text: L(`${n.first} đã già, mắt mờ, đi lại khó khăn. Bác sĩ thú y nói nó không còn nhiều thời gian.`, `${n.first} is old now, half-blind and slow. The vet says there isn't much time left.`),
        choices: [ch(L('Ở bên nó những ngày cuối', 'Stay with it until the end'), [o(1, { happy: -10, karma: 4 }, L(`${n.first} ngủ thiếp đi trong lòng bạn, đuôi vẫn khẽ vẫy.`, `${n.first} falls asleep in your arms, tail still gently wagging.`), null, null, () => kill(n))])],
      }),
    },
  },
};

// ───────── Bộ máy chạy mạch truyện ─────────
export function arcYear(life) {
  life.arcs = life.arcs || {};
  for (const [id, def] of Object.entries(ARCS)) {
    const st = life.arcs[id];
    if (!st) {
      const [a, b] = def.start.age;
      if (life.age < a || life.age > b) continue;
      if (def.start.when && !def.start.when(life)) continue;
      if (!chance(life, life.age === b && def.start.force !== false ? 1 : def.start.p)) continue;
      const npc = def.npc(life);
      npc.tag = id;
      life.people.push(npc);
      life.arcs[id] = { stage: 'meet', at: life.age, npc: npc.id, data: { metAge: life.age } };
      life.queue.push({ sys: 'arc', arc: id });
    } else if (!st.done && st.at <= life.age && !life.queue.some((q) => q.arc === id)) {
      life.queue.push({ sys: 'arc', arc: id });
    }
  }
}

export function buildArcEvent(life, item) {
  if (item.sys !== 'arc') return null;
  const def = ARCS[item.arc];
  const st = life.arcs?.[item.arc];
  if (!def || !st || st.done) return null;
  const npc = byId(life, st.npc);
  if (!npc || (!npc.alive && st.stage !== 'farewell')) { st.done = true; return null; }
  if (life.prison && item.arc !== 'secret') { st.at = life.age + 1; return null; }
  const stage = def.stages[st.stage];
  if (!stage) { st.done = true; return null; }
  const built = stage(life, npc, st.data);
  return { uid: `arc/${item.arc}/${st.stage}`, sys: true, arc: item.arc, tag: def.tag, npcName: personName(life, npc), text: built.text, choices: built.choices };
}

export function applyArc(life, arcId, outcome) {
  const st = life.arcs?.[arcId];
  if (!st) return;
  if (outcome.arcSet) Object.assign(st.data, outcome.arcSet);
  if (outcome.arcNext) {
    const [stage, a, b] = outcome.arcNext;
    st.stage = stage;
    st.at = life.age + randint(life, a, b);
  } else {
    st.done = true;
  }
}

export { addLog };
