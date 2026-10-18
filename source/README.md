# Một Đời — bản chơi thử

Game mô phỏng cuộc đời dạng chữ trên web, lối chơi kiểu BitLife, nơi sinh bốc theo dữ liệu dân số thật (ý tưởng từ 1in8b). Song ngữ Việt/Anh, chỉ dành cho người từ 25 tuổi.

## Chạy và build

Không cần cài thư viện, chỉ cần Node 18+.

```
node scripts/build.mjs                       # ra dist/motdoi.html (một file, mở được trên web)
node scripts/pack-lint.mjs src/data/packs/*.json   # kiểm tra gói nội dung
node scripts/bundle.mjs scripts/sim.mjs /tmp/sim.cjs && node /tmp/sim.cjs 2000   # mô phỏng 2000 đời
```

## Cấu trúc

```
src/engine/   logic thuần, không đụng giao diện
  validate.js   schema + luật an toàn cho gói nội dung (dùng chung với pack-lint)
  life.js       tạo nhân vật, người thân, chỉ số
  events.js     lọc/bốc sự kiện, áp kết quả, mang thai, ngoại tình, sự kiện hệ thống
  year.js       vòng +1 tuổi: học, làm, tiền, quan hệ, tử vong, ribbon
  actions.js    hoạt động, quan hệ, học & nghề, God Mode
  economy.js    chu kỳ kinh tế, đầu tư, nhà, xe, công ty
  crime.js      phạm tội, tòa án, nhà tù, vượt ngục, truy nã, di cư, 4 người sinh cùng giây
  love.js       app hẹn hò, tương tác người yêu, cầu hôn, hợp đồng tiền hôn nhân, cưới, ly hôn, con nuôi
  school.js     chuyên ngành đại học, sau đại học, trường nghề, hành động sinh viên
  specials.js   nghề đặc biệt (diễn viên, ca sĩ, vận động viên) và mạng xã hội
  minigames.js  kết quả trò chơi nhỏ (vượt ngục mê cung, cao hay thấp, thi học sinh giỏi)
  career.js     cấp bậc từng nghề theo năm kinh nghiệm, loại công ty, lời mời việc khi ra trường, săn đầu người
  extras.js     hoạt động mở rộng, thú cưng, hành động với từng người, công việc, vay ngân hàng, bảo hiểm
  goals.js      3 mục tiêu mỗi đời, thành tựu vĩnh viễn, nghĩa trang
  arcs.js       6 mạch truyện dài gắn với nhân vật quay lại (bạn thân, đối thủ, mối tình đầu, thầy cô, bí mật gia đình, thú cưng)
  game.js       điều phối gói + hàng đợi sự kiện
src/data/     quốc gia (số liệu xấp xỉ), nghề, gói sự kiện JSON
src/ui/       giao diện (main.js), chữ song ngữ (i18n.js), styles.css
scripts/      build, bundle, pack-lint, sim
```

## Gói nội dung

Mỗi gói là một file JSON (`manifest` + `events`). Thêm gói mới vào `src/data/packs/` rồi khai báo trong `src/engine/game.js`, hoặc nạp trực tiếp trong game: Cài đặt → Nạp gói nội dung. Gói lỗi bị từ chối kèm danh sách lỗi cụ thể. Sự kiện có thể gắn "big": true (biến cố lớn, hiếm) và lựa chọn có thể có "requires": { "min": {...} } để khóa theo chỉ số. Luật cố định: sự kiện tình cảm hoặc 25+ phải có tuổi tối thiểu từ 18.

Điều kiện có thể dùng trong `requires`: gender, partnerGender, inSchool, employed, hasPartner, married, hasChildren, inPrison, addicted, pregnant, hasAffair, hasBusiness, ownsHome, fugitive, hasRecord, engaged, cohabiting, incomeTier, min, max, flags, notFlags, job (mảng mã nghề), special (mảng: actor, musician, athlete, adult_actor, adult_director), lovers (số người tình tối thiểu), retired, ill, childAge ([min, max] tuổi của một người con), eduStage (mảng: primary, secondary, uni, grad, trade), major (mảng mã ngành: cs, engineering, medicine, nursing, law, business, finance, science, architecture, psychology, comms, education, arts).

Hiệu ứng đặc biệt thêm: jobPerf (±50, hiệu suất công việc), salaryPct (±50, % lương), illness (flu_long, back, insomnia, hypertension, diabetes, arthritis, heart, burnout, depression, memory, cancer), cure, retire, loseJob, endAffair, endAllAffairs, promoteLover.

## Chưa có trong bản này

Thử thách tuần, giới tính phi nhị nguyên, nghề chính trị. Số liệu quốc gia cần cập nhật từ UN, WHO, World Bank trước khi ra mắt.
