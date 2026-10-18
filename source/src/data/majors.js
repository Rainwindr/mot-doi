// Chuyên ngành đại học và trường nghề. min = trí tuệ chuẩn để đỗ, years = số năm học, fee = hệ số học phí.
const M = (id, em, vi, en, min, years, fee) => ({ id, em, name: { vi, en }, min, years, fee });
export const MAJORS = [
  M('cs', '💻', 'Khoa học máy tính', 'Computer science', 60, 4, 1),
  M('engineering', '🛠️', 'Kỹ thuật', 'Engineering', 60, 4, 1),
  M('medicine', '🩺', 'Y khoa', 'Medicine', 75, 6, 1.4),
  M('nursing', '🩹', 'Điều dưỡng', 'Nursing', 45, 4, 0.9),
  M('law', '⚖️', 'Luật', 'Law', 65, 4, 1.1),
  M('business', '📊', 'Quản trị kinh doanh', 'Business', 40, 4, 1),
  M('finance', '🧮', 'Tài chính - Kế toán', 'Finance & accounting', 50, 4, 1),
  M('science', '🔬', 'Khoa học tự nhiên', 'Natural sciences', 55, 4, 0.9),
  M('architecture', '📐', 'Kiến trúc', 'Architecture', 60, 5, 1.1),
  M('psychology', '🧠', 'Tâm lý học', 'Psychology', 45, 4, 0.9),
  M('comms', '📣', 'Báo chí - Truyền thông', 'Media & communications', 40, 4, 0.9),
  M('education', '🧑‍🏫', 'Sư phạm', 'Education', 40, 4, 0.6),
  M('arts', '🎨', 'Mỹ thuật - Thiết kế', 'Fine arts & design', 25, 4, 0.9),
];
const T = (id, em, vi, en) => ({ id, em, name: { vi, en } });
export const TRADES = [
  T('chef', '👨‍🍳', 'Nấu ăn', 'Culinary arts'),
  T('electrician', '⚡', 'Điện dân dụng', 'Electrical work'),
  T('mechanic', '🔧', 'Sửa chữa ô tô', 'Auto mechanics'),
  T('beauty', '💇', 'Làm tóc - Thẩm mỹ', 'Hair & beauty'),
  T('it', '🖥️', 'Kỹ thuật viên máy tính', 'IT support'),
];
export const majorById = Object.fromEntries(MAJORS.map((m) => [m.id, m]));
export const tradeById = Object.fromEntries(TRADES.map((m) => [m.id, m]));
