// Dữ liệu quốc gia — SỐ LIỆU XẤP XỈ (khoảng 2023), cần cập nhật từ UN WPP / WHO / World Bank trước khi ra mắt.
// births: nghìn ca sinh/năm (trọng số bốc nơi sinh) · life: tuổi thọ trung bình · gdp: GDP/người (USD)
// u5: tỉ lệ tử vong dưới 5 tuổi (‰) · cur: tiền tệ · rate: tỉ giá so với 1 USD
// abortion: chấm dứt thai kỳ theo yêu cầu có hợp pháp không (giản lược, chỉ dùng để ẩn/hiện lựa chọn trong game)
const C = (code, flag, vi, en, region, births, life, gdp, u5, cur, rate, abortion) => ({ code, flag, name: { vi, en }, region, births, life, gdp, u5, cur, rate, abortion });

export const COUNTRIES = [
  C('IN', '🇮🇳', 'Ấn Độ', 'India', 'south_asia', 23000, 72, 2500, 30, 'INR', 83, true),
  C('CN', '🇨🇳', 'Trung Quốc', 'China', 'china', 9000, 78, 12600, 7, 'CNY', 7.2, true),
  C('NG', '🇳🇬', 'Nigeria', 'Nigeria', 'africa', 7500, 54, 1600, 107, 'NGN', 1500, false),
  C('PK', '🇵🇰', 'Pakistan', 'Pakistan', 'south_asia', 6300, 67, 1500, 61, 'PKR', 280, false),
  C('ID', '🇮🇩', 'Indonesia', 'Indonesia', 'sea', 4500, 71, 4900, 21, 'IDR', 15800, false),
  C('CD', '🇨🇩', 'CHDC Congo', 'DR Congo', 'africa', 4300, 60, 650, 78, 'CDF', 2700, false),
  C('ET', '🇪🇹', 'Ethiopia', 'Ethiopia', 'africa', 3900, 66, 1100, 47, 'ETB', 57, false),
  C('US', '🇺🇸', 'Hoa Kỳ', 'United States', 'anglo', 3600, 77, 80000, 6, 'USD', 1, true),
  C('BD', '🇧🇩', 'Bangladesh', 'Bangladesh', 'south_asia', 3000, 73, 2600, 27, 'BDT', 110, false),
  C('BR', '🇧🇷', 'Brazil', 'Brazil', 'latam', 2500, 76, 10000, 14, 'BRL', 5, false),
  C('EG', '🇪🇬', 'Ai Cập', 'Egypt', 'mena', 2100, 71, 3500, 19, 'EGP', 48, false),
  C('TZ', '🇹🇿', 'Tanzania', 'Tanzania', 'africa', 2100, 66, 1200, 43, 'TZS', 2500, false),
  C('MX', '🇲🇽', 'Mexico', 'Mexico', 'latam', 1800, 75, 13000, 13, 'MXN', 17, true),
  C('PH', '🇵🇭', 'Philippines', 'Philippines', 'sea', 1700, 70, 3800, 26, 'PHP', 56, false),
  C('UG', '🇺🇬', 'Uganda', 'Uganda', 'africa', 1600, 63, 1000, 40, 'UGX', 3700, false),
  C('KE', '🇰🇪', 'Kenya', 'Kenya', 'africa', 1500, 63, 2000, 37, 'KES', 130, false),
  C('VN', '🇻🇳', 'Việt Nam', 'Vietnam', 'vietnam', 1350, 74, 4300, 20, 'VND', 25000, true),
  C('RU', '🇷🇺', 'Nga', 'Russia', 'europe', 1260, 73, 14000, 5, 'RUB', 90, true),
  C('ZA', '🇿🇦', 'Nam Phi', 'South Africa', 'africa', 1150, 62, 6000, 32, 'ZAR', 18.5, true),
  C('IR', '🇮🇷', 'Iran', 'Iran', 'mena', 1100, 74, 4500, 12, 'IRR', 42000, false),
  C('TR', '🇹🇷', 'Thổ Nhĩ Kỳ', 'Türkiye', 'mena', 1000, 78, 13000, 9, 'TRY', 32, true),
  C('JP', '🇯🇵', 'Nhật Bản', 'Japan', 'japan', 730, 84, 34000, 2, 'JPY', 150, true),
  C('DE', '🇩🇪', 'Đức', 'Germany', 'europe', 690, 81, 52000, 4, 'EUR', 0.92, true),
  C('GB', '🇬🇧', 'Anh', 'United Kingdom', 'anglo', 680, 81, 48000, 4, 'GBP', 0.79, true),
  C('FR', '🇫🇷', 'Pháp', 'France', 'europe', 680, 82, 44000, 4, 'EUR', 0.92, true),
  C('SA', '🇸🇦', 'Ả Rập Xê Út', 'Saudi Arabia', 'mena', 560, 77, 30000, 7, 'SAR', 3.75, false),
  C('CO', '🇨🇴', 'Colombia', 'Colombia', 'latam', 510, 77, 7000, 13, 'COP', 3900, true),
  C('TH', '🇹🇭', 'Thái Lan', 'Thailand', 'sea', 500, 79, 7200, 8, 'THB', 36, true),
  C('AR', '🇦🇷', 'Argentina', 'Argentina', 'latam', 460, 76, 13000, 7, 'ARS', 900, true),
  C('MY', '🇲🇾', 'Malaysia', 'Malaysia', 'sea', 450, 76, 11600, 8, 'MYR', 4.7, false),
  C('IT', '🇮🇹', 'Ý', 'Italy', 'europe', 380, 83, 38000, 3, 'EUR', 0.92, true),
  C('CA', '🇨🇦', 'Canada', 'Canada', 'anglo', 350, 82, 53000, 5, 'CAD', 1.36, true),
  C('ES', '🇪🇸', 'Tây Ban Nha', 'Spain', 'europe', 320, 83, 32000, 3, 'EUR', 0.92, true),
  C('AU', '🇦🇺', 'Úc', 'Australia', 'anglo', 290, 83, 65000, 4, 'AUD', 1.52, true),
  C('PL', '🇵🇱', 'Ba Lan', 'Poland', 'europe', 270, 78, 22000, 4, 'PLN', 4, false),
  C('KR', '🇰🇷', 'Hàn Quốc', 'South Korea', 'korea', 230, 84, 33000, 3, 'KRW', 1350, true),
];

export const byCode = Object.fromEntries(COUNTRIES.map((c) => [c.code, c]));
export const tierOf = (c) => (c.gdp < 4000 ? 'low' : c.gdp < 20000 ? 'mid' : 'high');

// Họ đứng trước tên ở các vùng này
export const FAMILY_FIRST = new Set(['china', 'japan', 'korea', 'vietnam']);

export const NAMES = {
  south_asia: { m: ['Arjun', 'Rahul', 'Imran', 'Rohan', 'Amit', 'Farhan', 'Vikram', 'Hassan'], f: ['Priya', 'Ananya', 'Ayesha', 'Fatima', 'Sana', 'Kavya', 'Nusrat', 'Meera'], last: ['Sharma', 'Khan', 'Patel', 'Rahman', 'Singh', 'Hossain', 'Gupta', 'Ali'] },
  china: { m: ['Wei', 'Hao', 'Jun', 'Lei', 'Ming', 'Yu'], f: ['Mei', 'Xiu', 'Lan', 'Jing', 'Yan', 'Hui'], last: ['Wang', 'Li', 'Zhang', 'Liu', 'Chen', 'Yang'] },
  japan: { m: ['Haruto', 'Ren', 'Sota', 'Yuto', 'Kaito'], f: ['Yui', 'Hina', 'Sakura', 'Aoi', 'Mio'], last: ['Sato', 'Suzuki', 'Takahashi', 'Tanaka', 'Ito'] },
  korea: { m: ['Minjun', 'Jiho', 'Seojun', 'Hyun', 'Dohyun'], f: ['Seoyeon', 'Jiwoo', 'Minji', 'Hayun', 'Soyeon'], last: ['Kim', 'Lee', 'Park', 'Choi', 'Jung'] },
  vietnam: { m: ['Minh', 'Huy', 'Khang', 'Bảo', 'Long', 'Tuấn', 'Phúc'], f: ['Linh', 'Trang', 'Anh', 'Ngọc', 'Vy', 'Thảo', 'Tiên'], last: ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Võ', 'Đặng'] },
  sea: { m: ['Budi', 'Andi', 'Joshua', 'Somchai', 'Arif', 'Rizal'], f: ['Siti', 'Dewi', 'Maria', 'Nicha', 'Aisyah', 'Putri'], last: ['Santoso', 'Reyes', 'Wongsa', 'Rahman', 'Cruz', 'Wijaya'] },
  africa: { m: ['Chinedu', 'Kwame', 'Tendai', 'Abebe', 'Juma', 'Thabo', 'Emeka'], f: ['Amara', 'Chiamaka', 'Wanjiru', 'Aisha', 'Nandi', 'Zawadi', 'Ifeoma'], last: ['Okafor', 'Mensah', 'Mwangi', 'Bekele', 'Nkosi', 'Kabila', 'Adeyemi'] },
  mena: { m: ['Omar', 'Ahmed', 'Mehmet', 'Ali', 'Yusuf', 'Reza'], f: ['Layla', 'Zeynep', 'Fatma', 'Sara', 'Noor', 'Maryam'], last: ['Hassan', 'Yilmaz', 'Mansour', 'Karimi', 'Demir', 'Haddad'] },
  latam: { m: ['Mateo', 'Santiago', 'João', 'Diego', 'Lucas', 'Gabriel'], f: ['Sofía', 'Valentina', 'Camila', 'Ana', 'Isabela', 'Lucía'], last: ['Silva', 'García', 'Rodríguez', 'Santos', 'López', 'Oliveira'] },
  europe: { m: ['Lukas', 'Louis', 'Marco', 'Pablo', 'Jakub', 'Ivan', 'Felix'], f: ['Emma', 'Chloé', 'Giulia', 'Lucía', 'Zofia', 'Anna', 'Lea'], last: ['Müller', 'Martin', 'Rossi', 'Fernández', 'Nowak', 'Ivanov', 'Schmidt'] },
  anglo: { m: ['Liam', 'Noah', 'James', 'Ethan', 'Jack', 'Oliver'], f: ['Olivia', 'Ava', 'Mia', 'Charlotte', 'Harper', 'Grace'], last: ['Johnson', 'Williams', 'Brown', 'Miller', 'Taylor', 'Davis'] },
};
