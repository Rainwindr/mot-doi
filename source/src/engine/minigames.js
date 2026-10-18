// Kết quả của các trò chơi nhỏ. Phần chơi nằm ở giao diện; engine chỉ nhận kết quả và áp vào đời.
import { L, clamp, chance, pick } from './util.js';
import { milestone, addLog } from './life.js';
import { applyEffects } from './events.js';

const res = (text, changes = [], tone) => ({ text, changes, tone });

/** Vượt ngục bằng mê cung: thoát được hay bị bắt. */
export function resolveEscape(life, success) {
  if (!life.prison) return null;
  if (success) {
    life.prison = null;
    life.fugitive = true;
    life.counts.escapes = (life.counts.escapes || 0) + 1;
    milestone(life, L('Vượt ngục', 'Escaped prison'), 'good');
    return res(L('Bạn chui qua lỗ hổng cuối cùng và chạy vào màn đêm. Giờ bạn là kẻ bị truy nã.', "You squeeze through the last gap and vanish into the night. You're a fugitive now."), applyEffects(life, { happy: 15, risk: 5 }), 'good');
  }
  life.prison.years += 2;
  return res(L('Quản giáo tóm được bạn. Bạn bị cộng thêm 2 năm tù.', 'A guard grabs you. Two more years added to your sentence.'), applyEffects(life, { health: -8, happy: -10 }), 'bad');
}

/** Cao hay thấp ở sòng bạc. bet và pot tính theo đơn vị tiền (1% thu nhập trung bình). */
export function resolveCasino(life, bet, pot) {
  const net = pot - bet;
  const fx = applyEffects(life, { money: net, happy: net > 0 ? Math.min(15, 4 + net / 5) : net < 0 ? -6 : 0, risk: 1 });
  if (pot >= bet * 8) addLog(life, L('Cả sòng bạc vây quanh bàn của bạn.', 'The whole casino crowds around your table.'), 'good');
  if (net > 0) return res(L(`Bạn rút tiền đúng lúc và thắng đậm.`, `You cash out at the right moment and win big.`), fx, 'good');
  if (net === 0) return res(L('Bạn hòa vốn và đi về với cảm giác mình là thiên tài.', 'You break even and leave feeling like a genius.'), fx);
  return res(L('Lá bài phản bội bạn. Nhà cái luôn thắng.', 'The card betrays you. The house always wins.'), fx, 'bad');
}

/** Thi học sinh giỏi: score là số câu đúng trên total. */
export function resolveOlympiad(life, score, total) {
  const e = life.edu;
  const r = score / total;
  if (r >= 1 && life.stats.smarts >= 70) {
    e.gpa = clamp(e.gpa + 8);
    milestone(life, L('Giải nhất học sinh giỏi quốc gia', 'National academic olympiad winner'), 'good');
    return res(L(`${score}/${total} câu. GIẢI NHẤT QUỐC GIA! Ảnh bạn treo ở cổng trường, hơi mờ, nhưng là bạn.`, `${score}/${total}. NATIONAL CHAMPION! Your photo hangs at the school gate. Blurry, but it's you.`), applyEffects(life, { happy: 15, fame: 8, smarts: 3 }), 'good');
  }
  if (r >= 0.6) {
    e.gpa = clamp(e.gpa + 5);
    return res(L(`${score}/${total} câu. Bạn đạt giải học sinh giỏi cấp thành phố.`, `${score}/${total}. You win a city-level academic prize.`), applyEffects(life, { happy: 8, fame: 2, smarts: 2 }), 'good');
  }
  return res(L(`${score}/${total} câu. Bạn đọc đề và nhận ra mình đã ôn nhầm chương.`, `${score}/${total}. You realise you revised the wrong chapter.`), applyEffects(life, { happy: -4, smarts: 1 }), 'bad');
}

/** Dùng cho mô phỏng: chơi ngẫu nhiên thay người chơi. */
export function autoPlay(life, mini) {
  if (mini.kind === 'maze') return resolveEscape(life, chance(life, 0.35));
  if (mini.kind === 'cards') return resolveCasino(life, mini.bets[0], chance(life, 0.45) ? mini.bets[0] * 2 : 0);
  if (mini.kind === 'quiz') return resolveOlympiad(life, Math.round(Math.random() * mini.total), mini.total);
  if (mini.kind === 'exam') return resolveExam(life, Math.round(Math.random() * 6), 6);
  if (mini.kind === 'race') return resolveRace(life, 5, chance(life, 0.25), 3, 'Gió');
  if (mini.kind === 'blackjack') return resolveBlackjack(life, 5, pick(life, ['win', 'lose', 'lose', 'push', 'bj']));
  return null;
}

/** Đua ngựa: thắng thì nhận tiền theo tỷ lệ cược. */
export function resolveRace(life, bet, won, odds, horse) {
  const net = won ? bet * odds - bet : -bet;
  const fx = applyEffects(life, { money: net, happy: won ? Math.min(15, 5 + odds) : -5, risk: 1 });
  return won
    ? res(L(`${horse} về nhất! Bạn hét to đến mức người bên cạnh giật mình.`, `${horse} wins! You scream so loud the person next to you jumps.`), fx, 'good')
    : res(L(`${horse} dừng lại giữa đường để ngắm khán đài. Bạn mất tiền cược.`, `${horse} stops mid-race to admire the crowd. You lose your bet.`), fx, 'bad');
}

/** Xì dách: outcome là 'bj' | 'win' | 'push' | 'lose'. */
export function resolveBlackjack(life, bet, outcome) {
  const net = outcome === 'bj' ? bet * 1.5 : outcome === 'win' ? bet : outcome === 'push' ? 0 : -bet;
  const fx = applyEffects(life, { money: net, happy: net > 0 ? 6 : net < 0 ? -5 : 0, risk: 1 });
  const t = { bj: L('Xì dách! Nhà cái trả gấp rưỡi.', 'Blackjack! The house pays 3 to 2.'), win: L('Bạn thắng ván này.', 'You win the hand.'), push: L('Hòa. Tiền cược trả lại.', 'Push. Your bet is returned.'), lose: L('Nhà cái thắng. Như thường lệ.', 'The house wins. As usual.') }[outcome];
  return res(t, fx, net > 0 ? 'good' : net < 0 ? 'bad' : '');
}

/** Luyện thi đại học: kết quả cộng vào khả năng đỗ ngành. */
export function resolveExam(life, score, total) {
  const r = score / total;
  life.edu.examBonus = Math.max(life.edu.examBonus || 0, Math.round((r - 0.4) * 30) / 100);
  if (r >= 0.8) return res(L(`${score}/${total} câu. Thầy nói với đà này bạn đỗ ngành nào cũng được.`, `${score}/${total}. Your teacher says at this rate you'll get in anywhere.`), applyEffects(life, { smarts: 2, happy: 6 }), 'good');
  if (r >= 0.5) return res(L(`${score}/${total} câu. Ổn, nhưng còn phải cố.`, `${score}/${total}. Decent, but keep at it.`), applyEffects(life, { smarts: 1 }));
  return res(L(`${score}/${total} câu. Bạn cần ôn lại từ đầu.`, `${score}/${total}. Back to basics.`), applyEffects(life, { happy: -3 }), 'bad');
}

const Q = (vi, en, a) => ({ q: L(vi, en), a });
const A3 = (good, ok, bad) => [{ t: good, s: 1 }, { t: ok, s: 0.5 }, { t: bad, s: 0 }];
export const INTERVIEW_QS = [
  Q('Điểm yếu lớn nhất của bạn là gì?', 'What is your greatest weakness?', A3(L('Tôi hay ôm việc, đang học cách giao việc.', "I take on too much; I'm learning to delegate."), L('Tôi quá cầu toàn.', "I'm a perfectionist."), L('Tôi ghét dậy sớm và ghét họp.', 'I hate mornings and meetings.'))),
  Q('Vì sao bạn muốn làm ở đây?', 'Why do you want to work here?', A3(L('Tôi thích cách công ty làm sản phẩm và muốn đóng góp.', 'I admire how you build things and want to contribute.'), L('Công ty gần nhà tôi.', "It's close to my home."), L('Tôi cần tiền trả nợ.', 'I need money for my debts.'))),
  Q('5 năm nữa bạn thấy mình ở đâu?', 'Where do you see yourself in 5 years?', A3(L('Dẫn dắt một nhóm nhỏ, giỏi hơn trong chuyên môn.', 'Leading a small team and better at my craft.'), L('Vẫn ở đây, chắc vậy.', 'Still here, probably.'), L('Ngồi ghế của anh/chị.', 'In your chair.'))),
  Q('Kể về một lần bạn thất bại.', 'Tell me about a time you failed.', A3(L('Một dự án trễ hạn; tôi học được cách lập kế hoạch tốt hơn.', 'A project ran late; I learned to plan better.'), L('Tôi không nhớ mình từng thất bại.', "I can't recall failing."), L('Lần phỏng vấn trước. Và có lẽ lần này.', 'My last interview. And possibly this one.'))),
  Q('Bạn mong muốn mức lương bao nhiêu?', 'What salary are you expecting?', A3(L('Tôi tin mức lương thị trường cho vị trí này là hợp lý.', 'The market rate for the role seems fair to me.'), L('Bao nhiêu cũng được.', 'Anything is fine.'), L('Gấp đôi mức anh/chị định nói.', "Double whatever you were going to say."))),
  Q('Bạn xử lý mâu thuẫn với đồng nghiệp thế nào?', 'How do you handle conflict with colleagues?', A3(L('Nói chuyện riêng, bình tĩnh, tìm điểm chung.', 'Talk privately and calmly, find common ground.'), L('Tôi tránh mặt họ.', 'I avoid them.'), L('Tôi đăng bài ẩn ý lên mạng.', 'I post passive-aggressive status updates.'))),
  Q('Nếu được làm một con vật, bạn sẽ là con gì?', 'If you were an animal, which would you be?', A3(L('Con ong: chăm chỉ và làm việc nhóm tốt.', 'A bee: hard-working and a team player.'), L('Con mèo.', 'A cat.'), L('Con lười. Không cần giải thích.', 'A sloth. No explanation needed.'))),
  Q('Bạn có câu hỏi gì cho chúng tôi không?', 'Do you have any questions for us?', A3(L('Thành công ở vị trí này trông như thế nào sau 6 tháng?', 'What does success look like in this role after six months?'), L('Không ạ.', 'No.'), L('Có được làm từ nhà mỗi ngày không?', 'Can I work from home every day?'))),
];
