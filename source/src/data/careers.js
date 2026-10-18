// Nghề nghiệp. pay = bội số GDP/người của quốc gia (lương năm khởi điểm).
// edu: none | highschool | bachelor · min: chỉ số tối thiểu · teen: cho phép làm thêm từ 15 tuổi
// need: { major: [...] } cần bằng đúng ngành · { trade: id } cần chứng chỉ trường nghề
const J = (id, vi, en, edu, pay, min = {}, teen = false, need = {}) => ({ id, title: { vi, en }, edu, pay, min, teen, ...need });

export const CAREERS = [
  J('fast_food', 'Nhân viên đồ ăn nhanh', 'Fast food worker', 'none', 0.5, {}, true),
  J('delivery', 'Shipper giao hàng', 'Delivery rider', 'none', 0.6, {}, true),
  J('babysitter', 'Trông trẻ', 'Babysitter', 'none', 0.4, {}, true),
  J('retail', 'Nhân viên bán hàng', 'Retail assistant', 'none', 0.7, {}, true),
  J('waiter', 'Phục vụ nhà hàng', 'Waiter', 'none', 0.6, {}, true),
  J('factory', 'Công nhân nhà máy', 'Factory worker', 'none', 0.8),
  J('driver', 'Tài xế', 'Driver', 'none', 0.9),
  J('cleaner', 'Nhân viên vệ sinh', 'Cleaner', 'none', 0.5),
  J('bartender', 'Bartender', 'Bartender', 'none', 0.8, { looks: 40 }),
  J('model', 'Người mẫu', 'Model', 'none', 2.5, { looks: 80 }),
  J('office_clerk', 'Nhân viên văn phòng', 'Office clerk', 'highschool', 1.2, { smarts: 30 }),
  J('sales', 'Nhân viên kinh doanh', 'Sales rep', 'highschool', 1.4, { smarts: 25, looks: 30 }),
  J('police', 'Cảnh sát', 'Police officer', 'highschool', 1.5, { smarts: 35, health: 50 }),
  J('nurse', 'Y tá', 'Nurse', 'bachelor', 1.8, { smarts: 50 }, false, { major: ['nursing', 'medicine'] }),
  J('teacher', 'Giáo viên', 'Teacher', 'bachelor', 1.5, { smarts: 50 }, false, { major: ['education'] }),
  J('marketing', 'Chuyên viên marketing', 'Marketing specialist', 'bachelor', 2.0, { smarts: 50 }, false, { major: ['business', 'comms'] }),
  J('accountant', 'Kế toán', 'Accountant', 'bachelor', 2.2, { smarts: 60 }, false, { major: ['finance', 'business'] }),
  J('engineer', 'Kỹ sư', 'Engineer', 'bachelor', 2.8, { smarts: 65 }, false, { major: ['engineering', 'cs', 'science'] }),
  J('developer', 'Lập trình viên', 'Software developer', 'bachelor', 3.0, { smarts: 65 }, false, { major: ['cs', 'engineering'] }),
  J('lawyer', 'Luật sư', 'Lawyer', 'bachelor', 3.5, { smarts: 75 }, false, { major: ['law'] }),
  J('doctor', 'Bác sĩ', 'Doctor', 'bachelor', 4.0, { smarts: 80 }, false, { major: ['medicine'] }),
  J('chef', 'Đầu bếp', 'Chef', 'none', 1.1, {}, false, { trade: 'chef' }),
  J('electrician', 'Thợ điện', 'Electrician', 'none', 1.2, {}, false, { trade: 'electrician' }),
  J('mechanic', 'Thợ sửa ô tô', 'Mechanic', 'none', 1.1, {}, false, { trade: 'mechanic' }),
  J('hairdresser', 'Thợ làm tóc', 'Hairdresser', 'none', 0.9, { looks: 30 }, false, { trade: 'beauty' }),
  J('it_tech', 'Kỹ thuật viên IT', 'IT technician', 'none', 1.2, { smarts: 35 }, false, { trade: 'it' }),
  J('designer', 'Nhà thiết kế đồ họa', 'Graphic designer', 'bachelor', 1.7, { smarts: 35 }, false, { major: ['arts', 'architecture'] }),
  J('journalist', 'Nhà báo', 'Journalist', 'bachelor', 1.5, { smarts: 45 }, false, { major: ['comms'] }),
  J('architect', 'Kiến trúc sư', 'Architect', 'bachelor', 2.6, { smarts: 60 }, false, { major: ['architecture'] }),
  J('analyst', 'Chuyên viên tài chính', 'Financial analyst', 'bachelor', 2.6, { smarts: 60 }, false, { major: ['finance', 'business'] }),
  J('pharmacist', 'Dược sĩ', 'Pharmacist', 'bachelor', 2.4, { smarts: 60 }, false, { major: ['medicine', 'science'] }),
  J('psychologist', 'Nhà tâm lý học', 'Psychologist', 'master', 2.4, { smarts: 60 }, false, { major: ['psychology'] }),
  J('scientist', 'Nhà khoa học', 'Research scientist', 'phd', 3.0, { smarts: 75 }, false, { major: ['science', 'cs', 'engineering', 'medicine', 'psychology'] }),
  J('professor', 'Giảng viên đại học', 'University lecturer', 'phd', 2.8, { smarts: 70 }),
];

export const careerById = Object.fromEntries(CAREERS.map((c) => [c.id, c]));
export const EDU_RANK = { none: 0, highschool: 1, bachelor: 2, master: 3, phd: 4 };

/** Đủ bằng cấp cho nghề này không? Trả về null nếu đủ, hoặc lý do thiếu. */
export function missingFor(life, c) {
  const e = life.edu;
  if (c.trade && !(e.trades || []).includes(c.trade)) return { trade: c.trade };
  if (EDU_RANK[e.level] < EDU_RANK[c.edu]) return { level: c.edu, major: c.major };
  if (c.major && e.degrees && !e.degrees.some((d) => c.major.includes(d.major) && EDU_RANK[d.level] >= EDU_RANK[c.edu])) return { level: c.edu, major: c.major };
  return null;
}
export const LEVELS = [
  { vi: 'Mới vào', en: 'Junior' },
  { vi: 'Chính thức', en: 'Associate' },
  { vi: 'Cấp cao', en: 'Senior' },
  { vi: 'Trưởng nhóm', en: 'Lead' },
  { vi: 'Quản lý', en: 'Manager' },
];

// ───────── Thang cấp bậc từng nghề ─────────
// [tên vi, tên en, số năm kinh nghiệm tối thiểu trong nghề, hệ số lương, điều kiện thêm]
// Điều kiện thêm: { edu: 'master' | 'phd' } cần bằng cao hơn · { looks: 90 } cần chỉ số.
const R = (vi, en, y, m, need) => ({ name: { vi, en }, y, m, need });
export const LADDERS = {
  fast_food: [R('Nhân viên phục vụ', 'Crew member', 0, 1), R('Nhân viên chính', 'Senior crew', 1, 1.15), R('Trưởng ca', 'Shift lead', 3, 1.4), R('Quản lý cửa hàng', 'Restaurant manager', 6, 1.9)],
  delivery: [R('Shipper', 'Rider', 0, 1), R('Shipper lâu năm', 'Senior rider', 2, 1.15), R('Điều phối viên', 'Dispatcher', 4, 1.4), R('Trưởng trạm', 'Hub manager', 7, 1.8)],
  babysitter: [R('Trông trẻ', 'Babysitter', 0, 1), R('Bảo mẫu', 'Nanny', 2, 1.3), R('Bảo mẫu cao cấp', 'Head nanny', 5, 1.7)],
  retail: [R('Nhân viên bán hàng', 'Sales assistant', 0, 1), R('Nhân viên chính', 'Senior assistant', 2, 1.15), R('Trưởng ca', 'Shift supervisor', 4, 1.4), R('Cửa hàng trưởng', 'Store manager', 7, 1.9)],
  waiter: [R('Phục vụ', 'Waiter', 0, 1), R('Phục vụ chính', 'Head waiter', 2, 1.15), R('Trưởng nhóm phục vụ', 'Floor supervisor', 4, 1.4), R('Quản lý nhà hàng', 'Restaurant manager', 7, 2)],
  factory: [R('Công nhân', 'Line worker', 0, 1), R('Công nhân bậc cao', 'Skilled worker', 2, 1.2), R('Tổ trưởng', 'Team leader', 5, 1.5), R('Quản đốc', 'Plant supervisor', 9, 2)],
  driver: [R('Tài xế', 'Driver', 0, 1), R('Tài xế lâu năm', 'Senior driver', 3, 1.2), R('Tài xế riêng cho lãnh đạo', 'Executive chauffeur', 6, 1.5)],
  cleaner: [R('Nhân viên vệ sinh', 'Cleaner', 0, 1), R('Tổ trưởng vệ sinh', 'Cleaning supervisor', 4, 1.3), R('Quản lý tòa nhà', 'Building manager', 8, 1.8)],
  bartender: [R('Phụ bar', 'Barback', 0, 0.9), R('Bartender', 'Bartender', 1, 1.1), R('Bartender trưởng', 'Head bartender', 4, 1.5), R('Quản lý quán bar', 'Bar manager', 7, 2)],
  model: [R('Người mẫu mới', 'New face', 0, 1), R('Người mẫu ảnh', 'Photo model', 2, 1.6), R('Người mẫu sàn diễn', 'Runway model', 4, 2.5, { looks: 80 }), R('Siêu mẫu', 'Supermodel', 7, 5, { looks: 92 })],
  office_clerk: [R('Nhân viên văn phòng', 'Office clerk', 0, 1), R('Chuyên viên', 'Officer', 2, 1.25), R('Chuyên viên chính', 'Senior officer', 5, 1.6), R('Trưởng phòng', 'Department head', 9, 2.4), R('Giám đốc khối', 'Division director', 14, 3.5)],
  sales: [R('Nhân viên kinh doanh', 'Sales rep', 0, 1), R('Chuyên viên kinh doanh', 'Account executive', 2, 1.3), R('Trưởng nhóm kinh doanh', 'Sales team lead', 4, 1.8), R('Giám đốc kinh doanh', 'Sales director', 8, 3), R('Giám đốc khu vực', 'Regional director', 13, 4.5)],
  police: [R('Cảnh sát tập sự', 'Police recruit', 0, 0.9), R('Cảnh sát viên', 'Police officer', 1, 1.1), R('Trung sĩ', 'Sergeant', 4, 1.4), R('Thanh tra', 'Detective', 8, 1.9), R('Đội trưởng', 'Captain', 12, 2.5), R('Cục trưởng', 'Police chief', 18, 3.4)],
  nurse: [R('Điều dưỡng mới', 'Junior nurse', 0, 1), R('Điều dưỡng', 'Registered nurse', 2, 1.2), R('Điều dưỡng chính', 'Senior nurse', 5, 1.5), R('Điều dưỡng trưởng khoa', 'Head nurse', 10, 2)],
  teacher: [R('Giáo viên tập sự', 'Trainee teacher', 0, 0.9), R('Giáo viên', 'Teacher', 1, 1.1), R('Giáo viên giỏi', 'Senior teacher', 5, 1.4), R('Tổ trưởng chuyên môn', 'Head of department', 9, 1.7), R('Hiệu phó', 'Deputy head', 13, 2.1), R('Hiệu trưởng', 'Headteacher', 17, 2.6)],
  marketing: [R('Thực tập sinh marketing', 'Marketing intern', 0, 0.6), R('Chuyên viên marketing', 'Marketing specialist', 1, 1), R('Chuyên viên cấp cao', 'Senior specialist', 4, 1.5), R('Trưởng nhóm marketing', 'Marketing lead', 7, 2.1), R('Giám đốc marketing', 'Marketing director', 11, 3.5)],
  accountant: [R('Kế toán viên', 'Accountant', 0, 1), R('Kế toán tổng hợp', 'Senior accountant', 3, 1.4), R('Kế toán trưởng', 'Chief accountant', 7, 2.2), R('Giám đốc tài chính', 'Chief financial officer', 13, 4, { edu: 'master' })],
  engineer: [R('Kỹ sư mới', 'Graduate engineer', 0, 1), R('Kỹ sư', 'Engineer', 2, 1.3), R('Kỹ sư cao cấp', 'Senior engineer', 5, 1.8), R('Kỹ sư trưởng', 'Principal engineer', 9, 2.6), R('Giám đốc kỹ thuật', 'Engineering director', 14, 3.8)],
  developer: [R('Thực tập sinh lập trình', 'Software intern', 0, 0.5), R('Lập trình viên junior', 'Junior developer', 1, 1), R('Lập trình viên', 'Developer', 3, 1.5), R('Lập trình viên senior', 'Senior developer', 5, 2.1), R('Trưởng nhóm kỹ thuật', 'Tech lead', 8, 2.8), R('Giám đốc công nghệ', 'Chief technology officer', 13, 4.5)],
  lawyer: [R('Trợ lý luật sư', 'Paralegal', 0, 0.7), R('Luật sư', 'Associate lawyer', 2, 1), R('Luật sư cao cấp', 'Senior associate', 6, 1.8), R('Luật sư thành viên', 'Partner', 10, 3), R('Luật sư điều hành', 'Managing partner', 15, 5)],
  doctor: [R('Bác sĩ nội trú', 'Resident doctor', 0, 0.6), R('Bác sĩ', 'Doctor', 3, 1), R('Bác sĩ chuyên khoa', 'Specialist', 6, 1.6, { edu: 'master' }), R('Trưởng khoa', 'Head of department', 12, 2.4), R('Giám đốc bệnh viện', 'Hospital director', 18, 3.5)],
  chef: [R('Phụ bếp', 'Kitchen hand', 0, 0.8), R('Đầu bếp', 'Line cook', 1, 1), R('Bếp phó', 'Sous chef', 4, 1.4), R('Bếp trưởng', 'Head chef', 8, 2), R('Bếp trưởng điều hành', 'Executive chef', 13, 2.8)],
  electrician: [R('Thợ điện phụ', 'Apprentice electrician', 0, 0.8), R('Thợ điện', 'Electrician', 1, 1), R('Thợ điện cả', 'Master electrician', 5, 1.4), R('Chủ thầu điện', 'Electrical contractor', 9, 2)],
  mechanic: [R('Thợ phụ', 'Apprentice mechanic', 0, 0.8), R('Thợ sửa xe', 'Mechanic', 1, 1), R('Thợ cả', 'Master mechanic', 5, 1.4), R('Chủ xưởng', 'Garage owner', 9, 2)],
  hairdresser: [R('Thợ phụ', 'Junior stylist', 0, 0.8), R('Thợ làm tóc', 'Hairdresser', 1, 1), R('Stylist', 'Stylist', 4, 1.5), R('Stylist trưởng', 'Creative director', 8, 2.2)],
  it_tech: [R('Kỹ thuật viên IT', 'IT technician', 0, 1), R('Kỹ thuật viên chính', 'Senior technician', 3, 1.3), R('Trưởng nhóm hỗ trợ', 'Support team lead', 6, 1.7), R('Quản lý hạ tầng', 'Infrastructure manager', 10, 2.3)],
  designer: [R('Thiết kế viên mới', 'Junior designer', 0, 1), R('Thiết kế viên', 'Designer', 2, 1.3), R('Thiết kế cao cấp', 'Senior designer', 5, 1.8), R('Giám đốc sáng tạo', 'Creative director', 10, 3)],
  journalist: [R('Phóng viên tập sự', 'Trainee reporter', 0, 0.8), R('Phóng viên', 'Reporter', 1, 1), R('Phóng viên chính', 'Senior reporter', 5, 1.4), R('Biên tập viên', 'Editor', 8, 1.9), R('Tổng biên tập', 'Editor-in-chief', 15, 3)],
  architect: [R('Kiến trúc sư tập sự', 'Junior architect', 0, 0.8), R('Kiến trúc sư', 'Architect', 2, 1), R('Kiến trúc sư chủ trì', 'Project architect', 6, 1.6), R('Kiến trúc sư trưởng', 'Principal architect', 11, 2.5), R('Giám đốc thiết kế', 'Design director', 16, 3.5)],
  analyst: [R('Chuyên viên phân tích', 'Analyst', 0, 1), R('Chuyên viên cao cấp', 'Senior analyst', 3, 1.5), R('Phó phòng đầu tư', 'Vice president', 6, 2.2), R('Giám đốc đầu tư', 'Investment director', 11, 3.8, { edu: 'master' })],
  pharmacist: [R('Dược sĩ', 'Pharmacist', 0, 1), R('Dược sĩ chính', 'Senior pharmacist', 4, 1.3), R('Dược sĩ trưởng', 'Chief pharmacist', 8, 1.8), R('Giám đốc nhà thuốc', 'Pharmacy director', 12, 2.4)],
  psychologist: [R('Nhà tâm lý tập sự', 'Trainee psychologist', 0, 0.8), R('Nhà tâm lý học', 'Psychologist', 2, 1), R('Chuyên gia tâm lý', 'Senior psychologist', 6, 1.5), R('Trưởng phòng khám', 'Clinic director', 11, 2.2, { edu: 'phd' })],
  scientist: [R('Nghiên cứu viên sau tiến sĩ', 'Postdoc', 0, 0.8), R('Nghiên cứu viên', 'Research scientist', 2, 1), R('Nghiên cứu viên chính', 'Senior scientist', 6, 1.5), R('Trưởng nhóm nghiên cứu', 'Principal investigator', 10, 2.2), R('Viện trưởng', 'Institute director', 16, 3)],
  professor: [R('Giảng viên', 'Lecturer', 0, 1), R('Giảng viên chính', 'Senior lecturer', 4, 1.3), R('Phó giáo sư', 'Associate professor', 9, 1.7), R('Giáo sư', 'Professor', 15, 2.3), R('Hiệu trưởng đại học', 'University president', 20, 3)],
};
export const ladderOf = (id) => LADDERS[id] || [R('Nhân viên', 'Employee', 0, 1)];
export const COMPANIES = {
  corp: { em: '🏙️', name: { vi: 'Tập đoàn lớn', en: 'Big corporation' }, pay: 1.15, note: { vi: 'lương cao, áp lực lớn', en: 'high pay, high pressure' } },
  startup: { em: '🚀', name: { vi: 'Công ty khởi nghiệp', en: 'Startup' }, pay: 0.9, note: { vi: 'thăng tiến nhanh, dễ phá sản', en: 'fast promotions, may fold' } },
  gov: { em: '🏛️', name: { vi: 'Cơ quan nhà nước', en: 'Public sector' }, pay: 0.85, note: { vi: 'ổn định, khó bị đuổi', en: 'stable, hard to get fired' } },
  mid: { em: '🏢', name: { vi: 'Công ty vừa', en: 'Mid-sized company' }, pay: 1, note: { vi: 'cân bằng', en: 'balanced' } },
};
