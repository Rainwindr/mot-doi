// Học tập sau phổ thông: chọn chuyên ngành, sau đại học, trường nghề, và tiến trình từng năm.
import { L, clamp, chance, randint } from './util.js';
import { country, tier, addLog, milestone } from './life.js';
import { MAJORS, TRADES, majorById, tradeById } from '../data/majors.js';
import { EDU_RANK } from '../data/careers.js';

export const STAGE_YEARS = { master: 2, phd: 4, trade: 2 };
const LEVEL_NAME = { bachelor: L('Cử nhân', 'Bachelor'), master: L('Thạc sĩ', 'Master'), phd: L('Tiến sĩ', 'PhD') };
export const degreeName = (d) => L(`${LEVEL_NAME[d.level].vi} ${majorById[d.major]?.name.vi ?? ''}`.trim(), `${LEVEL_NAME[d.level].en} · ${majorById[d.major]?.name.en ?? ''}`);

function edu(life) {
  const e = life.edu;
  e.degrees ||= [];
  e.trades ||= [];
  return e;
}

/** Khả năng đỗ một ngành, theo trí tuệ và điểm phổ thông. */
export function admitChance(life, m) {
  return clamp(0.3 + (life.stats.smarts - m.min) / 35 + (life.edu.gpa - 50) / 150 + (life.edu.examBonus || 0), 0.05, 0.97);
}

export function canStudy(life) {
  const e = edu(life);
  return life.age >= 17 && !e.stage && !life.prison && EDU_RANK[e.level] >= 1;
}

/** Cảnh chọn ngành (dùng cho sau tốt nghiệp, thi lại và đổi ngành). */
export function majorEvent(life, switching = false) {
  const choices = MAJORS.map((m) => {
    const p = switching ? clamp(admitChance(life, m) + 0.15, 0.05, 0.98) : admitChance(life, m);
    return {
      label: L(`${m.em} ${m.name.vi} · ${Math.round(p * 100)}%`, `${m.em} ${m.name.en} · ${Math.round(p * 100)}%`),
      requires: { min: { smarts: Math.max(0, m.min - 15) } },
      outcomes: [
        { chance: p, effects: { happy: switching ? 4 : 10 }, run: (lf) => enrollUni(lf, m.id, switching), text: switching ? L(`Bạn chuyển sang ngành ${m.name.vi}. Bạn bè cũ hứa sẽ vẫn rủ đi ăn, nhưng ai cũng biết là không.`, `You switch to ${m.name.en}. Your old classmates promise to keep in touch. Nobody believes it.`) : L(`Bạn đỗ ngành ${m.name.vi}! Cả họ hàng biết tin trong vòng 15 phút.`, `You're accepted into ${m.name.en}! The whole extended family knows within 15 minutes.`) },
        { chance: 1 - p, effects: { happy: -8 }, text: L(`Bạn trượt ngành ${m.name.vi}. Năm sau có thể thi lại trong mục Học & Nghề.`, `You don't get into ${m.name.en}. You can try again next year from School & Work.`) },
      ],
    };
  });
  choices.push({ label: switching ? L('Thôi, giữ ngành cũ', 'Never mind, stay put') : L('Để năm sau', 'Maybe next year'), outcomes: [{ chance: 1, effects: {}, text: L('Bạn quyết định chưa đi học lúc này.', 'You decide not to study for now.') }] });
  return {
    uid: 'school/major', category: 'school',
    text: switching ? L('Đổi ngành? Bạn sẽ học lại từ năm nhất ở ngành mới.', 'Switch majors? You start again from first year.') : L('Bạn muốn học ngành gì? Ngành khó cần trí tuệ cao, % là khả năng đỗ.', 'What do you want to study? Harder majors need more smarts; % is your chance of getting in.'),
    choices,
  };
}

export function tradeEvent() {
  const choices = TRADES.map((t) => ({
    label: L(`${t.em} ${t.name.vi}`, `${t.em} ${t.name.en}`),
    outcomes: [{ chance: 1, effects: { happy: 6, willpower: 3 }, run: (lf) => enrollTrade(lf, t.id), text: L(`Bạn nhập học nghề ${t.name.vi.toLowerCase()}. Hai năm nữa là có nghề trong tay.`, `You enrol in ${t.name.en.toLowerCase()}. Two years and you'll have a trade.`) }],
  }));
  choices.push({ label: L('Để sau', 'Maybe later'), outcomes: [{ chance: 1, effects: {}, text: L('Bạn chưa đi học nghề.', 'You hold off on trade school.') }] });
  return { uid: 'school/trade', category: 'school', text: L('Trường nghề học 2 năm, học phí rẻ, ra trường làm được ngay. Bạn chọn nghề nào?', 'Trade school takes 2 years, costs little, and gets you working fast. Which trade?'), choices };
}

export function gradEvent(life) {
  const e = edu(life);
  const choices = [];
  const bach = e.degrees.filter((d) => d.level === 'bachelor').map((d) => d.major);
  const mast = e.degrees.filter((d) => d.level === 'master').map((d) => d.major);
  const opts = [...new Set(bach)].filter((m) => !mast.includes(m)).map((m) => ['master', m]);
  if (!bach.includes('business') && !mast.includes('business')) opts.push(['master', 'business']);
  for (const m of new Set(mast)) if (!e.degrees.some((d) => d.level === 'phd' && d.major === m)) opts.push(['phd', m]);
  for (const [level, m] of opts) {
    const mj = majorById[m];
    const p = clamp((level === 'phd' ? 0.1 : 0.3) + (life.stats.smarts - mj.min) / 40 + (e.gpa - 60) / 100, 0.05, 0.95);
    const name = level === 'phd' ? L('Tiến sĩ', 'PhD in') : L(m === 'business' && !bach.includes('business') ? 'Thạc sĩ (MBA)' : 'Thạc sĩ', m === 'business' && !bach.includes('business') ? 'MBA in' : 'Master in');
    choices.push({
      label: L(`${mj.em} ${name.vi} ${mj.name.vi} · ${Math.round(p * 100)}%`, `${mj.em} ${name.en} ${mj.name.en} · ${Math.round(p * 100)}%`),
      requires: level === 'phd' ? { min: { smarts: 65 } } : undefined,
      outcomes: [
        { chance: p, effects: { happy: 8 }, run: (lf) => enrollGrad(lf, level, m), text: level === 'phd' ? L('Bạn được nhận làm nghiên cứu sinh. Lương thấp, deadline cao, nhưng danh xưng "Tiến sĩ" thì đáng.', "You're accepted as a doctoral student. Low pay, high deadlines, but \"Dr.\" will be worth it.") : L(`Bạn được nhận vào chương trình ${name.vi.toLowerCase()} ${mj.name.vi}.`, `You're accepted into the ${name.en.toLowerCase()} ${mj.name.en} programme.`) },
        { chance: 1 - p, effects: { happy: -6 }, text: L('Hội đồng tuyển sinh gửi thư từ chối rất lịch sự.', 'The admissions committee sends a very polite rejection.') },
      ],
    });
  }
  choices.push({ label: L('Để sau', 'Maybe later'), outcomes: [{ chance: 1, effects: {}, text: L('Bạn chưa học tiếp.', 'You hold off for now.') }] });
  return { uid: 'school/grad', category: 'school', text: L('Học tiếp sau đại học? Thạc sĩ 2 năm, tiến sĩ 4 năm (có trợ cấp). Bằng cao hơn mở thêm nghề và tăng lương.', 'Keep studying? A master takes 2 years, a PhD 4 (with a stipend). Higher degrees unlock jobs and raise pay.'), choices };
}

export function enrollUni(life, major, switching = false) {
  const e = edu(life);
  e.stage = 'uni';
  e.major = major;
  e.years = 0;
  if (switching) e.gpa = clamp(e.gpa - 5);
  addLog(life, L(`Bạn nhập học ngành ${majorById[major].name.vi}.`, `You start studying ${majorById[major].name.en}.`), 'good');
}
export function enrollGrad(life, level, major) {
  const e = edu(life);
  e.stage = 'grad';
  e.gradLevel = level;
  e.major = major;
  e.years = 0;
}
export function enrollTrade(life, id) {
  const e = edu(life);
  e.stage = 'trade';
  e.trade = id;
  e.years = 0;
}

export function stageLength(life) {
  const e = life.edu;
  if (e.stage === 'uni') return majorById[e.major]?.years ?? 4;
  if (e.stage === 'grad') return STAGE_YEARS[e.gradLevel];
  if (e.stage === 'trade') return STAGE_YEARS.trade;
  return 0;
}

/** Một năm ở đại học, sau đại học hoặc trường nghề. */
export function higherEdYear(life) {
  const e = edu(life);
  const s = life.stats;
  const gdp = country(life).gdp;
  e.years++;
  if (e.stage === 'uni' && !e.major) e.major = 'business'; // bản lưu cũ chưa có ngành
  if (e.stage === 'uni' || e.stage === 'grad') {
    s.smarts = clamp(s.smarts + randint(life, 1, 3));
    e.gpa = clamp(Math.round(e.gpa * 0.6 + s.smarts * 0.4 + randint(life, -6, 6)));
  } else {
    s.willpower = clamp(s.willpower + randint(life, 0, 2));
  }
  const parentsPay = { poor: 0, middle: 0.4, well: 0.9, rich: 1 }[life.wealth];
  let fee = 0;
  if (e.stage === 'uni') fee = { low: 0.3, mid: 0.4, high: life.country === 'US' ? 0.5 : 0.15 }[tier(life)] * gdp * (majorById[e.major]?.fee ?? 1) * (1 - parentsPay);
  else if (e.stage === 'grad') fee = e.gradLevel === 'phd' ? -0.35 * gdp : 0.45 * gdp * (1 - parentsPay * 0.5);
  else fee = 0.12 * gdp * (1 - parentsPay);
  if (e.scholarship && fee > 0) fee *= 0.2;
  life.money -= fee;
  if (e.years < stageLength(life)) return;
  // Ra trường
  if (e.stage === 'trade') {
    const t = tradeById[e.trade];
    e.trades = [...new Set([...e.trades, e.trade])];
    milestone(life, L(`Tốt nghiệp trường nghề: ${t.name.vi}`, `Finished trade school: ${t.name.en}`), 'good');
    life.queue.push({ sys: 'job_offers', trade: e.trade });
  } else {
    const level = e.stage === 'uni' ? 'bachelor' : e.gradLevel;
    const d = { level, major: e.major, honors: e.gpa >= 80 };
    e.degrees.push(d);
    if (EDU_RANK[level] > EDU_RANK[e.level]) e.level = level;
    const hon = d.honors ? L(' (loại giỏi)', ' with honours') : L('', '');
    milestone(life, L(`Tốt nghiệp ${degreeName(d).vi}${hon.vi}`, `Graduated: ${degreeName(d).en}${hon.en}`), 'good');
    if (d.honors) s.happy = clamp(s.happy + 6);
    life.queue.push({ sys: 'job_offers', major: e.major });
  }
  e.stage = null;
  e.years = 0;
  e.scholarship = false;
  e.gradLevel = null;
}

/** Hành động riêng của sinh viên trong mục Học & Nghề. Trả về res hoặc null nếu không áp dụng. */
export function studentAction(life, act, n, res, fx) {
  const e = edu(life);
  const gdp = country(life).gdp;
  const tired = res(L('Năm nay như vậy là đủ rồi.', "That's enough for this year."), []);
  switch (act) {
    case 'club':
      if (n > 1) return tired;
      if (chance(life, 0.2)) return res(L('Bạn được bầu làm chủ nhiệm câu lạc bộ. Quyền lực đầu tiên: quyết định mua bánh gì cho buổi họp.', 'You get elected club president. First power move: choosing the snacks.'), fx(life, { happy: 6, fame: 3, willpower: 2 }), 'good');
      return res(L('Bạn tham gia câu lạc bộ và có thêm một nhóm bạn mới.', 'You join a club and find a new crowd.'), fx(life, { happy: 5, smarts: 1 }));
    case 'parttime':
      if (n > 1) return tired;
      e.gpa = clamp(e.gpa - randint(life, 2, 6));
      return res(L('Bạn đi làm thêm buổi tối. Tiền vào túi, điểm thì ra đi.', 'You work evening shifts. Money comes in, grades go out.'), fx(life, { money: 12, happy: -2, willpower: 2 }));
    case 'scholar':
      if (n > 1 || e.scholarship) return tired;
      if (e.gpa >= 80 && chance(life, 0.6)) { e.scholarship = true; return res(L('Bạn giành học bổng! Học phí giảm 80%. Bố mẹ khoe trên mạng xã hội trong vòng 3 phút.', 'You win a scholarship! Fees drop 80%. Your parents post it online within 3 minutes.'), fx(life, { happy: 10 }), 'good'); }
      return res(L(e.gpa >= 80 ? 'Hồ sơ tốt nhưng suất học bổng đã về tay người khác.' : 'Hội đồng xem điểm của bạn rồi cười rất nhẹ.', e.gpa >= 80 ? 'A strong application, but someone else gets it.' : 'The committee looks at your grades and smiles gently.'), fx(life, { happy: -3 }), 'bad');
    case 'exchange':
      if (e.exchanged) return res(L('Bạn đã đi trao đổi một lần rồi.', "You've already done an exchange."), []);
      if (life.money < 0.2 * gdp && life.wealth === 'poor') return res(L('Bạn không đủ tiền đi trao đổi.', "You can't afford an exchange."), [], 'bad');
      e.exchanged = true;
      return res(L('Bạn đi trao đổi một học kỳ ở nước ngoài. Về nước bạn nói chuyện chen tiếng Anh, ai cũng khó chịu.', 'You spend a semester abroad. You come back dropping foreign words into every sentence. Everyone notices.'), fx(life, { money: -20, smarts: 4, happy: 10, looks: 1 }), 'good');
    case 'intern': {
      if (n > 1) return tired;
      const p = clamp(0.4 + e.gpa / 250 + life.stats.looks / 500, 0.2, 0.9);
      if (chance(life, p)) { e.intern = e.major; return res(L('Bạn được nhận thực tập. Việc chính là pha cà phê, nhưng hồ sơ xin việc sẽ đẹp hơn nhiều.', 'You land an internship. Mostly coffee runs, but your CV will look much better.'), fx(life, { smarts: 2, willpower: 3 }), 'good'); }
      return res(L('Công ty nói sẽ "liên hệ lại sau". Họ không liên hệ.', 'The company says they\'ll "be in touch". They are not.'), fx(life, { happy: -3 }), 'bad');
    }
    case 'olympiad':
      if (n > 1) return tired;
      return { mini: { kind: 'quiz', total: 6, level: life.age < 12 ? 0 : life.stats.smarts >= 70 ? 2 : 1 } };
  }
  return null;
}
