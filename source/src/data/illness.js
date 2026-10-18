// Bệnh mạn tính dùng cho hiệu ứng "illness" trong gói nội dung. drain = sức khỏe mất mỗi năm, mood = hạnh phúc mất mỗi năm.
const I = (id, vi, en, drain, mood = 0, smarts = 0, cure = 0.3) => ({ id, name: { vi, en }, drain, mood, smarts, cure });
export const ILLNESSES = [
  I('flu_long', 'viêm phế quản kéo dài', 'lingering bronchitis', 1, 0, 0, 0.9),
  I('back', 'đau lưng mãn tính', 'chronic back pain', 1, 2, 0, 0.35),
  I('insomnia', 'mất ngủ kéo dài', 'chronic insomnia', 1, 3, 0, 0.4),
  I('hypertension', 'cao huyết áp', 'high blood pressure', 1, 0, 0, 0.25),
  I('diabetes', 'tiểu đường', 'diabetes', 1, 1, 0, 0.1),
  I('arthritis', 'viêm khớp', 'arthritis', 1, 2, 0, 0.15),
  I('heart', 'bệnh tim', 'heart disease', 3, 1, 0, 0.25),
  I('burnout', 'kiệt sức', 'burnout', 1, 5, 0, 0.5),
  I('depression', 'trầm cảm', 'depression', 1, 6, 0, 0.4),
  I('memory', 'suy giảm trí nhớ', 'memory decline', 1, 2, 3, 0.05),
  I('cancer', 'ung thư', 'cancer', 5, 3, 0, 0.35),
];
export const illnessById = Object.fromEntries(ILLNESSES.map((x) => [x.id, x]));
export const ILLNESS_IDS = ILLNESSES.map((x) => x.id);
