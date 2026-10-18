// Kết quả của các trò chơi nhỏ. Phần chơi nằm ở giao diện; engine chỉ nhận kết quả và áp vào đời.
import { L, clamp, chance } from './util.js';
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
  return null;
}
