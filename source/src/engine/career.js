// Thăng tiến nghề nghiệp: kinh nghiệm theo năm, cấp bậc riêng từng nghề, loại công ty, lời mời việc khi ra trường và săn đầu người.
import { L, clamp, chance, randint, rand, pick } from './util.js';
import { country, addLog, milestone } from './life.js';
import { CAREERS, careerById, ladderOf, COMPANIES, EDU_RANK, missingFor } from '../data/careers.js';

const COMPANY_IDS = Object.keys(COMPANIES);
export const expIn = (life, id) => (life.exp && life.exp[id]) || 0;

/** Kinh nghiệm tính cho một nghề: năm làm đúng nghề + một nửa số năm ở nghề cùng ngành. */
export function effExp(life, id) {
  const c = careerById[id];
  let e = expIn(life, id);
  for (const [k, v] of Object.entries(life.exp || {})) {
    if (k === id) continue;
    const o = careerById[k];
    if (!o || !c) continue;
    const sameMajor = c.major && o.major && c.major.some((m) => o.major.includes(m));
    if (sameMajor || (c.trade && c.trade === o.trade)) e += v * 0.5;
  }
  return Math.floor(e);
}

export function needMissing(life, r) {
  if (!r || !r.need) return null;
  if (r.need.edu && EDU_RANK[life.edu.level] < EDU_RANK[r.need.edu]) return { edu: r.need.edu };
  for (const k of ['looks', 'smarts', 'health']) if (r.need[k] && life.stats[k] < r.need[k]) return { stat: k, v: r.need[k] };
  return null;
}

/** Cấp vào làm, dựa trên kinh nghiệm (+ năm cộng thêm nhờ bằng giỏi, thực tập, sau đại học). Không vào thẳng cấp cao nhất. */
export function entryRank(life, id, bonus = 0) {
  const lad = ladderOf(id);
  const e = effExp(life, id) + bonus;
  let r = 0;
  for (let i = 1; i < lad.length - 1; i++) if (lad[i].y <= e && !needMissing(life, lad[i])) r = i;
  return r;
}

export function entryBonus(life, id) {
  const e = life.edu;
  const c = careerById[id];
  let b = 0;
  if (c.major && (e.degrees || []).some((d) => d.honors && c.major.includes(d.major))) b += 1;
  if (e.intern && (!c.major || c.major.includes(e.intern))) b += 1;
  if (c.major && (e.degrees || []).some((d) => c.major.includes(d.major) && EDU_RANK[d.level] > EDU_RANK[c.edu])) b += EDU_RANK[e.level] - EDU_RANK[c.edu];
  return b;
}

export function salaryFor(life, id, rank, company = 'mid', jitter = true) {
  const c = careerById[id];
  const lad = ladderOf(id);
  const teen = life.age < 18 ? 0.4 : 1;
  return Math.round(c.pay * country(life).gdp * lad[rank].m * COMPANIES[company].pay * teen * (jitter ? 0.92 + rand(life) * 0.16 : 1));
}

export const randomCompany = (life) => pick(life, COMPANY_IDS);

export function hire(life, id, rank, company) {
  const c = careerById[id];
  const lad = ladderOf(id);
  life.job = { id, level: rank, salary: salaryFor(life, id, rank, company), years: 0, perf: 55, company };
  life.jobHistory = (life.jobHistory || 0) + 1;
  if (life.edu.intern && (!c.major || c.major.includes(life.edu.intern))) life.edu.intern = null;
  if (life.jobHistory === 1 && life.age >= 18) milestone(life, L(`Công việc đầu tiên: ${lad[rank].name.vi.toLowerCase()}`, `First job: ${lad[rank].name.en.toLowerCase()}`), 'good');
  addLog(life, L(`Bạn bắt đầu làm ${lad[rank].name.vi.toLowerCase()} tại một ${COMPANIES[company].name.vi.toLowerCase()}.`, `You start as ${lad[rank].name.en.toLowerCase()} at a ${COMPANIES[company].name.en.toLowerCase()}.`), 'good');
}

export const rankName = (job) => { const lad = ladderOf(job.id); return lad[Math.min(job.level, lad.length - 1)].name; };

/** Thông tin để lên cấp tiếp theo. */
export function nextRank(life) {
  const j = life.job;
  if (!j) return null;
  const lad = ladderOf(j.id);
  if (j.level >= lad.length - 1) return { top: true };
  const r = lad[j.level + 1];
  const have = effExp(life, j.id);
  const perfNeed = Math.min(80, 55 + j.level * 5);
  const need = needMissing(life, r);
  return { rank: r, index: j.level + 1, yearsNeed: r.y, yearsHave: have, perfNeed, need, eligible: have >= r.y && !need };
}

export function promote(life, by) {
  const j = life.job;
  const lad = ladderOf(j.id);
  j.level++;
  j.salary = Math.max(Math.round(j.salary * 1.12), salaryFor(life, j.id, j.level, j.company, false));
  j.perf = 55;
  addLog(life, by === 'auto'
    ? L(`Sếp chủ động đề bạt bạn lên ${lad[j.level].name.vi.toLowerCase()}.`, `Your boss promotes you to ${lad[j.level].name.en.toLowerCase()}.`)
    : L(`Bạn được thăng chức lên ${lad[j.level].name.vi.toLowerCase()}.`, `You're promoted to ${lad[j.level].name.en.toLowerCase()}.`), 'good');
  if (j.level === lad.length - 1) milestone(life, L(`Lên đỉnh sự nghiệp: ${lad[j.level].name.vi}`, `Reached the top: ${lad[j.level].name.en}`), 'good');
  else if (j.level >= 3) milestone(life, L(`Thăng chức: ${lad[j.level].name.vi}`, `Promoted: ${lad[j.level].name.en}`), 'good');
}

/** Một năm đi làm. Trả về false nếu mất việc. */
export function careerYear(life) {
  const j = life.job;
  if (!j) return;
  life.exp ||= {};
  life.exp[j.id] = (life.exp[j.id] || 0) + 1;
  j.years++;
  j.company ||= 'mid';
  j.level = Math.min(j.level, ladderOf(j.id).length - 1);
  j.perf = clamp(j.perf + Math.round((58 - j.perf) * 0.2) + randint(life, -9, 7) + Math.round((life.stats.smarts - 50) / 12) + Math.round((life.stats.willpower - 50) / 20) + (j.company === 'startup' ? 2 : 0));
  if (j.company === 'corp') life.stats.happy = clamp(life.stats.happy - 1);
  if (j.company === 'startup' && chance(life, 0.07)) {
    addLog(life, L('Công ty khởi nghiệp của bạn hết tiền và đóng cửa. Văn phòng còn lại mấy cái ghế lười.', 'Your startup runs out of money and shuts down. All that remains are the beanbags.'), 'bad');
    life.job = null;
    life.stats.happy = clamp(life.stats.happy - 8);
    return;
  }
  const nx = nextRank(life);
  if (nx && nx.eligible && j.perf >= nx.perfNeed + 8 && chance(life, j.company === 'startup' ? 0.45 : j.company === 'gov' ? 0.22 : 0.32)) {
    promote(life, 'auto');
  } else if (j.perf < 15 && chance(life, j.company === 'gov' ? 0.1 : 0.5)) {
    const c = careerById[j.id];
    addLog(life, L(`Bạn bị cho nghỉ việc ${c.title.vi.toLowerCase()}.`, `You're let go from your job as ${c.title.en.toLowerCase()}.`), 'bad');
    life.job = null;
    life.stats.happy = clamp(life.stats.happy - 15);
    return;
  } else {
    j.salary = Math.round(j.salary * (1 + randint(life, 0, j.company === 'gov' ? 2 : 4) / 100));
  }
  if (life.job && nx && !nx.top && j.years >= 2 && expIn(life, j.id) >= 3 && j.perf >= 60 && chance(life, 0.09)) life.queue.push({ sys: 'headhunt' });
}

// ───────── Sự kiện: lời mời việc khi ra trường, săn đầu người ─────────
const fmt = (life, usd) => {
  const c = country(life);
  const v = usd * c.rate;
  const n = (x, d) => x.toFixed(d).replace(/\.0$/, '');
  const nv = (x, d) => n(x, d).replace('.', ',');
  return {
    vi: v >= 1e9 ? `${nv(v / 1e9, 1)} tỷ ${c.cur}` : v >= 1e6 ? `${nv(v / 1e6, 1)} triệu ${c.cur}` : `${Math.round(v).toLocaleString('vi-VN')} ${c.cur}`,
    en: v >= 1e9 ? `${n(v / 1e9, 1)}B ${c.cur}` : v >= 1e6 ? `${n(v / 1e6, 1)}M ${c.cur}` : `${Math.round(v).toLocaleString('en-US')} ${c.cur}`,
  };
};

function offerChoice(life, id, company) {
  const rank = entryRank(life, id, entryBonus(life, id));
  const lad = ladderOf(id);
  const pay = salaryFor(life, id, rank, company, false);
  const co = COMPANIES[company];
  const m = fmt(life, pay);
  return {
    label: L(`${co.em} ${lad[rank].name.vi} · ${co.name.vi} · ${m.vi}/năm`, `${co.em} ${lad[rank].name.en} · ${co.name.en} · ${m.en}/yr`),
    outcomes: [{ chance: 1, effects: { happy: 8 }, run: (lf) => hire(lf, id, rank, company), text: L(`Bạn nhận lời làm ${lad[rank].name.vi.toLowerCase()} (${co.note.vi}).`, `You accept the ${lad[rank].name.en.toLowerCase()} role (${co.note.en}).`) }],
  };
}

export function buildCareerSys(life, item) {
  if (item.sys === 'job_offers') {
    if (life.prison || life.age < 17) return null;
    const e = life.edu;
    let pool;
    if (item.trade) pool = CAREERS.filter((c) => c.trade === item.trade);
    else if (item.major) pool = CAREERS.filter((c) => c.major && c.major.includes(item.major) && !missingFor(life, c));
    else pool = CAREERS.filter((c) => !c.major && !c.trade && !missingFor(life, c) && c.edu !== 'none');
    if (!pool.length) pool = CAREERS.filter((c) => !missingFor(life, c) && !c.teen);
    if (!pool.length) return null;
    const picks = [];
    const left = [...pool];
    while (picks.length < 3 && left.length) picks.push(left.splice(Math.floor(rand(life) * left.length), 1)[0]);
    while (picks.length < 3 && pool.length) picks.push(pick(life, pool));
    const used = new Set();
    const choices = picks.map((c) => {
      let co = randomCompany(life);
      for (let k = 0; k < 4 && used.has(c.id + co); k++) co = randomCompany(life);
      used.add(c.id + co);
      return offerChoice(life, c.id, co);
    });
    choices.push({ label: L('Từ chối hết, tự tìm việc sau', 'Decline them all, look later'), outcomes: [{ chance: 1, effects: { willpower: 2 }, text: L('Bạn muốn tự chọn. Mục Học & Nghề luôn có việc đang tuyển.', 'You want to choose for yourself. School & Work always has listings.') }] });
    const intro = item.trade || item.major
      ? L(`Vừa ra trường, bạn nhận được ${choices.length - 1} lời mời làm việc. Hộp thư chưa bao giờ đông vui như vậy.`, `Fresh out of school, you get ${choices.length - 1} job offers. Your inbox has never been this popular.`)
      : L('Bạn quyết định đi làm luôn. Có vài nơi đang tuyển người không cần bằng đại học.', 'You decide to start working. A few places are hiring without a degree.');
    return { uid: 'sys/job_offers', sys: true, category: 'work', text: intro, choices };
  }
  if (item.sys === 'headhunt') {
    const j = life.job;
    if (!j || life.prison) return null;
    const lad = ladderOf(j.id);
    if (j.level >= lad.length - 1) return null;
    const co = randomCompany(life);
    const nr = lad[j.level + 1];
    const pay = Math.round(Math.max(j.salary * 1.25, salaryFor(life, j.id, j.level + 1, co, false)));
    const m = fmt(life, pay);
    return {
      uid: 'sys/headhunt', sys: true, category: 'work',
      text: L(`Một người săn đầu người gọi cho bạn: một ${COMPANIES[co].name.vi.toLowerCase()} muốn mời bạn làm ${nr.name.vi.toLowerCase()}, lương ${m.vi}/năm.`, `A headhunter calls: a ${COMPANIES[co].name.en.toLowerCase()} wants you as ${nr.name.en.toLowerCase()}, paying ${m.en}/yr.`),
      choices: [
        { label: L('Nhận lời, nhảy việc', 'Accept and jump ship'), outcomes: [{ chance: 1, effects: { happy: 10 }, run: (lf) => { const jj = lf.job; if (!jj) return; jj.level = Math.min(lad.length - 1, jj.level + 1); jj.company = co; jj.salary = pay; jj.perf = 55; jj.years = 0; addLog(lf, L(`Bạn chuyển sang làm ${nr.name.vi.toLowerCase()} ở chỗ mới.`, `You move to the new company as ${nr.name.en.toLowerCase()}.`), 'good'); if (jj.level >= 3) milestone(lf, L(`Nhảy việc lên ${nr.name.vi}`, `Jumped ship to ${nr.name.en}`), 'good'); }, text: L('Đồng nghiệp cũ tổ chức tiệc chia tay. Sếp cũ không đến.', 'Your old team throws a leaving party. Your old boss doesn\'t come.') }] },
        { label: L('Dùng lời mời để đòi tăng lương', 'Use it to negotiate a raise'), outcomes: [
          { chance: 0.45, effects: { happy: 6 }, run: (lf) => { if (lf.job) lf.job.salary = Math.round(lf.job.salary * 1.15); }, text: L('Sếp tái mặt rồi tăng lương cho bạn 15%.', 'Your boss goes pale and gives you a 15% raise.') },
          { chance: 0.55, effects: { happy: -5 }, run: (lf) => { if (lf.job) lf.job.perf = clamp(lf.job.perf - 12); }, text: L('Sếp nói: "Vậy em cứ đi đi." Rồi không nói gì thêm. Không khí rất lạ.', 'Your boss says "Then go." Nothing else. It\'s awkward now.') },
        ] },
        { label: L('Từ chối, ở lại', 'Decline and stay'), outcomes: [{ chance: 1, effects: { karma: 2 }, run: (lf) => { if (lf.job) lf.job.perf = clamp(lf.job.perf + 5); }, text: L('Bạn ở lại. Sếp không biết, nhưng bạn thấy mình trung thành.', 'You stay. Your boss never knows, but you feel loyal.') }] },
      ],
    };
  }
  return null;
}
