// pack-lint: kiểm tra gói nội dung theo schema của game.
// Dùng: node scripts/pack-lint.mjs <file.json> [file2.json ...]
import { readFileSync } from 'node:fs';
import { validatePack } from '../src/engine/validate.js';

const files = process.argv.slice(2);
let failed = 0;
const allSet = new Set();
const allNeeded = [];
const packs = [];
for (const f of files) {
  let pack;
  try {
    pack = JSON.parse(readFileSync(f, 'utf8'));
  } catch (e) {
    console.log(`✗ ${f}: JSON lỗi — ${e.message}`);
    failed++;
    continue;
  }
  packs.push([f, pack]);
}
for (const [f, pack] of packs) {
  const { errors, warnings } = validatePack(pack);
  const n = pack.events?.length ?? 0;
  if (errors.length) failed++;
  console.log(`${errors.length ? '✗' : '✓'} ${f} — ${n} sự kiện, ${errors.length} lỗi, ${warnings.length} cảnh báo`);
  for (const e of errors) console.log('   LỖI  ', e);
  for (const w of warnings) console.log('   chú ý', w);
  for (const ev of pack.events ?? []) {
    for (const c of ev.choices ?? []) for (const o of c.outcomes ?? []) for (const fl of o.setFlags ?? []) allSet.add(fl);
    for (const fl of ev.requires?.flags ?? []) allNeeded.push([ev.id, fl]);
  }
}
// Cờ được yêu cầu nhưng không gói nào bật (engine có thể tự bật một số cờ hệ thống)
const engineFlags = new Set(['recent_breakup', 'long_distance', 'in_relationship', 'recent_intimate', 'widowed', 'adult_past', 'has_affair', 'open_rel', 'retire_now']);
for (const [id, fl] of allNeeded) {
  if (!allSet.has(fl) && !engineFlags.has(fl)) console.log(`   chú ý  ${id}: cần cờ "${fl}" nhưng không sự kiện nào bật cờ này`);
}
process.exit(failed ? 1 : 0);
