# Hướng dẫn viết gói nội dung cho "Một Đời"

Gói nội dung là **một file JSON**, gồm `manifest` (thông tin gói) và `events` (danh sách sự kiện). File mẫu đi kèm là `mau-goi-noi-dung.json`: sao chép nó, giữ nguyên cấu trúc, rồi thay chữ và số.

Mọi chữ hiển thị phải có **đủ hai ngôn ngữ**: `{ "vi": "...", "en": "..." }`.

---

## 1. Manifest

| Khóa | Bắt buộc | Ghi chú |
|---|---|---|
| `id` | ✓ | Chữ thường, số, dấu `_ . -`. Ví dụ `tacgia.mua_he`. Không trùng gói có sẵn. |
| `name` | ✓ | `{vi, en}` |
| `version` | | Ví dụ `"1.0.0"` |
| `rating` | ✓ | `all`, `18+` hoặc `25+`. Là mức cao nhất mà sự kiện trong gói được phép có. |
| `languages` | | `["vi", "en"]` |

## 2. Một sự kiện

| Khóa | Bắt buộc | Ghi chú |
|---|---|---|
| `id` | ✓ | snake_case, không trùng trong gói |
| `category` | ✓ | `childhood`, `school`, `teen`, `love`, `work`, `money`, `health`, `crime`, `family`, `random`, `old_age` |
| `age` | ✓ | `[tuổi_min, tuổi_max]`, từ 0 đến 120 |
| `weight` | ✓ | 1–10. Số càng lớn càng hay xuất hiện. Sự kiện hiếm dùng 1–2. |
| `once` | | `true` nếu cả đời chỉ xảy ra một lần |
| `rating` | ✓ | `all`, `18+`, `25+`. Không được cao hơn rating của gói. |
| `text` | ✓ | Đoạn mô tả tình huống |
| `requires` | | Điều kiện để sự kiện xuất hiện (mục 4) |
| `choices` | * | 1–4 lựa chọn. **Nên có 2–3 lựa chọn khác nhau thật sự.** |
| `effects` | * | Chỉ dùng khi **không có** `choices` (sự kiện tự xảy ra) |
| `big` | | `true` cho biến cố lớn, rất hiếm, hiện thẻ đặc biệt |
| `setFlags` / `clearFlags` | | Gắn hoặc xóa cờ để nối chuỗi sự kiện |

\* Mỗi sự kiện có **hoặc** `choices` **hoặc** `effects`.

### Lựa chọn và kết quả

```json
{
  "label": { "vi": "...", "en": "..." },
  "requires": { "min": { "smarts": 60 } },
  "outcomes": [
    { "chance": 0.7, "effects": { "happy": 5 }, "text": { "vi": "...", "en": "..." } },
    { "chance": 0.3, "effects": { "happy": -3 }, "text": { "vi": "...", "en": "..." } }
  ]
}
```

- Tổng `chance` các kết quả của **một lựa chọn phải bằng 1**.
- `requires` của lựa chọn chỉ nhận `min` / `max`. Lựa chọn chưa đủ chỉ số sẽ hiện ổ khóa.
- Mỗi kết quả có thể kèm `setFlags` / `clearFlags`.

## 3. Hiệu ứng (`effects`)

| Khóa | Giá trị | Ý nghĩa |
|---|---|---|
| `health` `happy` `smarts` `looks` | số, khoảng ±30 | Chỉ số chính (0–100) |
| `karma` `willpower` `risk` `fame` | số, khoảng ±30 | Chỉ số ẩn |
| `money` | số, khoảng ±500 | Đơn vị = **1% thu nhập trung bình năm** của nước đang sống (100 = một năm lương trung bình) |
| `rel_mother` `rel_father` `rel_sibling` `rel_partner` `rel_spouse` `rel_child` `rel_friend` `rel_boss` | số | Độ thân thiết với người đó |
| `jobPerf` | ±50 | Hiệu suất công việc |
| `salaryPct` | ±50 | Tăng/giảm lương theo % |
| `pregnancyChance` | 0–1 | Khả năng có thai (chỉ dùng trong cảnh tình cảm người lớn) |
| `illness` | mã bệnh | Mắc bệnh (hỏi bên mình danh sách mã) |
| `cure` `retire` `loseJob` `breakup` `divorce` | `true` | Khỏi bệnh, nghỉ hưu, mất việc, chia tay, ly hôn |
| `newContact` `startAffair` `endAffair` `endAllAffairs` `affairExposed` `promoteLover` | `true` | Các hiệu ứng tình cảm đặc biệt |

Số vượt giới hạn sẽ bị game tự cắt bớt. Gợi ý cân bằng: chuyện nhỏ ±2–5, chuyện vừa ±6–12, biến cố ±15–30.

## 4. Điều kiện (`requires`)

| Khóa | Ví dụ | Ý nghĩa |
|---|---|---|
| `gender` | `"male"` / `"female"` / `"any"` | Giới tính người chơi |
| `partnerGender` | `"female"` | Giới tính người yêu |
| `employed` `inSchool` `hasPartner` `married` `hasChildren` `engaged` `cohabiting` `pregnant` `hasAffair` `hasBusiness` `ownsHome` `retired` `ill` `inPrison` `fugitive` `hasRecord` `addicted` | `true` / `false` | Tình trạng hiện tại |
| `min` / `max` | `{ "money": 50, "age": 30, "smarts": 60 }` | Ngưỡng chỉ số, tiền, tuổi, độ thân thiết |
| `job` | `["doctor", "nurse"]` | Đang làm nghề này (danh sách mã ở mục 6) |
| `country` | `["VN", "JP"]` | Đang sống ở nước này (mã 2 chữ cái) |
| `eduStage` | `["primary","secondary","uni","grad","trade"]` | Đang học cấp nào |
| `major` | `["medicine"]` | Ngành học |
| `incomeTier` | `["low","mid","high"]` | Nhóm thu nhập của nước |
| `childAge` | `[13, 17]` | Có con trong độ tuổi này |
| `lovers` | `2` | Có ít nhất N người tình |
| `flags` / `notFlags` | `["co_da_gap"]` | Cần có / không được có cờ |

## 5. Luật nội dung (bắt buộc, gói vi phạm sẽ không được nhận)

1. Sự kiện `love` hoặc `25+` phải có tuổi tối thiểu **từ 18**. Game tự từ chối nếu sai.
2. Mọi nhân vật trong nội dung tình cảm hay tình dục đều **từ 18 tuổi**. Không nhập vai trẻ em hay học sinh.
3. **Không bao giờ** có tình cảm với người trong gia đình (bố mẹ, anh chị em, con, họ hàng, gia đình kế) hay thú cưng.
4. Mọi thứ đều **có đồng thuận**. Không biến ép buộc (thật hay giả vờ) thành thứ khêu gợi.
5. Cảnh 25+ viết **gợi cảm, không mô tả chi tiết** thân thể hay từng động tác.
6. Không bệnh tình dục, không người thật, không fetish nguy hiểm.
7. Không hướng dẫn phạm tội thật, không bạo lực làm phương pháp. Tự tử chỉ được nhắc như một chủ đề, đánh dấu `"sensitive": "suicide"`.
8. Trung lập giới: người chơi giới nào cũng đọc được tự nhiên.
9. Tuổi thơ và tuổi teen phải trong sáng.

## 6. Mã tham khảo

**Nghề (`job`)**: fast_food, delivery, babysitter, retail, waiter, factory, driver, cleaner, bartender, model, office_clerk, sales, police, nurse, teacher, marketing, accountant, engineer, developer, lawyer, doctor, chef, electrician, mechanic, hairdresser, it_tech, designer, journalist, architect, analyst, pharmacist, psychologist, scientist, professor.

**Ngành (`major`)**: cs, engineering, medicine, nursing, law, business, finance, science, architecture, psychology, comms, education, arts.

**Nước (`country`)**: IN, CN, NG, PK, ID, CD, ET, US, BD, BR, EG, TZ, MX, PH, UG, KE, VN, RU, ZA, IR, TR, JP, DE, GB, FR, SA, CO, TH, AR, MY, IT, CA, ES, AU, PL, KR.

## 7. Văn phong

- Ngắn, dí dỏm, có một chi tiết bất ngờ. Ví dụ: *"Bạn tập chân. Ngày mai cầu thang sẽ là kẻ thù."*
- Viết ở ngôi "bạn". Câu ngắn, ít dấu gạch ngang.
- Mỗi lựa chọn nên dẫn tới kết quả khác hẳn nhau, không chỉ khác con số.
- Bản tiếng Anh là bản viết lại tự nhiên, không dịch từng chữ.

## 8. Tự kiểm tra trước khi gửi

- JSON hợp lệ (dán vào jsonlint.com để thử).
- Tổng `chance` mỗi lựa chọn = 1.
- Mọi `text` và `label` có đủ `vi` lẫn `en`.
- Có thể nạp thử ngay trong game: **Cài đặt → Nạp gói nội dung**. Nếu lỗi, game liệt kê chính xác dòng sai.
