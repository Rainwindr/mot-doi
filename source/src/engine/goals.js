// Mục tiêu của mỗi đời (3 cái bốc ngẫu nhiên lúc sinh) và thành tựu vĩnh viễn qua nhiều đời.
import { L, pick } from './util.js';
import { country, people, spouse, addLog, milestone } from './life.js';
import { netWorth } from './economy.js';
import { EDU_RANK, ladderOf } from '../data/careers.js';

const G = (id, em, vi, en, check, minAge = 0) => ({ id, em, name: L(vi, en), check, minAge });
export const GOALS = [
  G('degree', '🎓', 'Tốt nghiệp đại học', 'Graduate from university', (l) => EDU_RANK[l.edu.level] >= 2),
  G('phd', '🧑‍🔬', 'Lấy bằng tiến sĩ', 'Earn a PhD', (l) => l.edu.level === 'phd'),
  G('trade', '🧰', 'Học xong một nghề', 'Finish trade school', (l) => (l.edu.trades || []).length > 0),
  G('marry', '💍', 'Kết hôn', 'Get married', (l) => !!spouse(l) || (l.counts.marriages || 0) > 0),
  G('kids3', '👨‍👩‍👧', 'Có 3 người con', 'Have 3 children', (l) => people(l, 'child').length >= 3),
  G('home', '🏠', 'Sở hữu một căn nhà', 'Own a home', (l) => (l.homes || []).length > 0),
  G('rich', '💰', 'Tài sản gấp 50 lần thu nhập trung bình', 'Net worth 50× the average income', (l) => netWorth(l) >= 50 * country(l).gdp),
  G('famous', '⭐', 'Danh tiếng đạt 80', 'Reach 80 fame', (l) => l.stats.fame >= 80),
  G('genius', '🧠', 'Trí tuệ đạt 100', 'Reach 100 smarts', (l) => l.stats.smarts >= 100),
  G('saint', '😇', 'Karma đạt 90', 'Reach 90 karma', (l) => l.stats.karma >= 90),
  G('old', '🎂', 'Sống đến 90 tuổi', 'Live to 90', (l) => l.age >= 90),
  G('top', '💼', 'Lên cấp cao nhất trong nghề', 'Reach the top of a career', (l) => !!l.job && l.job.level >= ladderOf(l.job.id).length - 1),
  G('abroad', '✈️', 'Định cư ở nước khác', 'Settle in another country', (l) => (l.counts.moves || 0) > 0),
  G('boss', '🏢', 'Mở công ty của riêng mình', 'Start your own company', (l) => (l.counts.businesses || 0) > 0),
  G('escape', '🏃', 'Vượt ngục thành công', 'Break out of prison', (l) => (l.counts.escapes || 0) > 0),
  G('bestie', '🤝', 'Có một người bạn thân', 'Have a best friend', (l) => people(l, 'bestie').some((p) => p.alive)),
  G('fit', '💪', 'Sức khỏe 90 trở lên khi 60 tuổi', 'Health 90+ at age 60', (l) => l.age >= 60 && l.stats.health >= 90, 60),
];
export const goalById = Object.fromEntries(GOALS.map((g) => [g.id, g]));

export function assignGoals(life) {
  const pool = [...GOALS];
  const out = [];
  while (out.length < 3 && pool.length) {
    const g = pick(life, pool);
    pool.splice(pool.indexOf(g), 1);
    if (g.id === 'phd' && out.includes('degree')) continue;
    out.push(g.id);
  }
  life.goals = out.map((id) => ({ id, done: null }));
}

/** Đánh dấu mục tiêu vừa đạt. Trả về danh sách mục tiêu mới hoàn thành. */
export function checkGoals(life) {
  if (!life || !life.goals) return [];
  const fresh = [];
  for (const g of life.goals) {
    if (g.done != null) continue;
    const def = goalById[g.id];
    try {
      if (def && def.check(life)) {
        g.done = life.age;
        fresh.push(def);
        milestone(life, L(`🎯 Hoàn thành mục tiêu: ${def.name.vi}`, `🎯 Goal complete: ${def.name.en}`), 'good');
      }
    } catch { /* bỏ qua mục tiêu lỗi */ }
  }
  if (fresh.length && life.goals.every((g) => g.done != null)) addLog(life, L('🏆 Bạn đã hoàn thành cả 3 mục tiêu của đời này!', '🏆 You completed all 3 goals for this life!'), 'good');
  return fresh;
}

// ───────── Thành tựu vĩnh viễn ─────────
const A = (id, em, vi, en, wvi, wen, test) => ({ id, em, name: L(vi, en), why: L(wvi, wen), test });
export const ACHIEVEMENTS = [
  A('first', '🪦', 'Một đời người', 'A life lived', 'Sống trọn một đời', 'Finish a life', (p) => p.lives.length >= 1),
  A('lives10', '🔁', 'Luân hồi', 'Reincarnated', 'Sống 10 đời', 'Live 10 lives', (p) => p.lives.length >= 10),
  A('lives50', '♾️', 'Linh hồn già', 'Old soul', 'Sống 50 đời', 'Live 50 lives', (p) => p.lives.length >= 50),
  A('century', '💯', 'Trăm tuổi', 'Centenarian', 'Sống đến 100 tuổi', 'Live to 100', (p) => p.lives.some((x) => x.age >= 100 && !x.custom)),
  A('young', '🥀', 'Ra đi quá sớm', 'Gone too soon', 'Mất trước 18 tuổi', 'Die before 18', (p) => p.lives.some((x) => x.age < 18)),
  A('countries5', '🌍', 'Công dân thế giới', 'World citizen', 'Sinh ra ở 5 quốc gia khác nhau', 'Be born in 5 different countries', (p) => p.countries.length >= 5),
  A('countries15', '🗺️', 'Khắp năm châu', 'All over the map', 'Sinh ra ở 15 quốc gia khác nhau', 'Be born in 15 different countries', (p) => p.countries.length >= 15),
  A('ribbons10', '🎀', 'Nhà sưu tầm', 'Collector', 'Sưu tầm 10 ribbon khác nhau', 'Collect 10 different ribbons', (p) => Object.keys(p.ribbons).length >= 10),
  A('allgoals', '🎯', 'Sống có mục tiêu', 'Purpose-driven', 'Hoàn thành cả 3 mục tiêu trong một đời', 'Complete all 3 goals in one life', (p) => p.lives.some((x) => x.goals === 3 && !x.custom)),
  A('goals25', '🏹', 'Bách phát bách trúng', 'Sharpshooter', 'Hoàn thành tổng cộng 25 mục tiêu', 'Complete 25 goals in total', (p) => p.goalsDone >= 25),
  A('dynasty', '👑', 'Dòng tộc', 'Dynasty', 'Sống tiếp qua 3 thế hệ', 'Play through 3 generations', (p) => p.lives.some((x) => (x.gen || 1) >= 3)),
  A('doctor', '🧑‍🔬', 'Tiến sĩ', 'Doctorate', 'Có bằng tiến sĩ', 'Earn a PhD', (p) => p.lives.some((x) => x.edu === 'phd' && !x.custom)),
  A('rags', '🚀', 'Từ hai bàn tay trắng', 'Rags to riches', 'Sinh ra nghèo, chết giàu', 'Born poor, die rich', (p) => p.lives.some((x) => x.wealth === 'poor' && x.worthX >= 50 && !x.custom)),
];

export function emptyProfile() {
  return { v: 1, lives: [], ribbons: {}, countries: [], goalsDone: 0, ach: {} };
}

/** Lưu đời vừa mất vào nghĩa trang. Trả về các thành tựu mới mở khóa. */
export function archiveLife(profile, life, extra = {}) {
  const c = country(life);
  const goals = (life.goals || []).filter((g) => g.done != null).length;
  const entry = {
    id: `${life.rng}-${life.age}-${life.first}`,
    first: life.first, last: life.last, gender: life.gender, country: life.country, birth: life.birthCountry || life.country,
    age: life.age, cause: life.cause, ribbons: life.ribbons || [], worth: netWorth(life), worthX: netWorth(life) / c.gdp,
    wealth: life.wealth, edu: life.edu.level, goals, custom: !!life.customized, gen: life.gen || 1, kids: life.counts.children,
    job: life.job ? life.job.id : null,
  };
  profile.lives.unshift(entry);
  profile.lives = profile.lives.slice(0, 200);
  if (!entry.custom) {
    for (const r of entry.ribbons) profile.ribbons[r] = (profile.ribbons[r] || 0) + 1;
    profile.goalsDone += goals;
  }
  if (!profile.countries.includes(entry.birth)) profile.countries.push(entry.birth);
  const fresh = [];
  for (const a of ACHIEVEMENTS) {
    if (profile.ach[a.id]) continue;
    try { if (a.test(profile)) { profile.ach[a.id] = Date.now(); fresh.push(a); } } catch { /* bỏ qua */ }
  }
  return fresh;
}
