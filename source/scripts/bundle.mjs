// Trình đóng gói tối giản, không phụ thuộc thư viện: gom các ES module (+ JSON) thành một script.
// Dùng: node scripts/bundle.mjs <entry.js> <out.js>
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';

const [entry, out] = process.argv.slice(2);
const root = process.cwd();
const modules = new Map(); // id -> code
const order = [];

const IMPORT_RE = /import\s+(?:(\w+)|\{([\s\S]*?)\})\s+from\s+['"](.+?)['"];?/g;

function load(file) {
  const id = relative(root, file);
  if (modules.has(id)) return id;
  modules.set(id, null);
  const src = readFileSync(file, 'utf8');
  if (file.endsWith('.json')) {
    modules.set(id, `return { default: ${src.trim()} };`);
    order.push(id);
    return id;
  }
  const exports = [];
  let code = src.replace(IMPORT_RE, (_, def, named, spec) => {
    const dep = load(resolve(dirname(file), spec));
    if (def) return `const ${def} = __req(${JSON.stringify(dep)}).default;`;
    const names = named.split(',').map((s) => s.trim()).filter(Boolean).map((s) => s.replace(/\s+as\s+/, ': '));
    return `const { ${names.join(', ')} } = __req(${JSON.stringify(dep)});`;
  });
  code = code.replace(/export\s+\{([^}]*)\};?/g, (_, names) => {
    for (const n of names.split(',').map((s) => s.trim()).filter(Boolean)) exports.push(n);
    return '';
  });
  code = code.replace(/export\s+default\s+/g, () => {
    exports.push('default: __default');
    return 'const __default = ';
  });
  code = code.replace(/export\s+(async\s+function\*?|function\*?|const|let|class)\s+(\w+)/g, (_, kw, name) => {
    exports.push(name);
    return `${kw} ${name}`;
  });
  modules.set(id, `${code}\nreturn { ${exports.join(', ')} };`);
  order.push(id);
  return id;
}

const entryId = load(resolve(entry));
let bundle = '(() => {\nconst __defs = {};\nconst __cache = {};\nconst __req = (id) => __cache[id] || (__cache[id] = __defs[id]());\n';
for (const id of order) bundle += `__defs[${JSON.stringify(id)}] = () => {\n${modules.get(id)}\n};\n`;
bundle += `__req(${JSON.stringify(entryId)});\n})();\n`;
writeFileSync(out, bundle);
console.log(`bundled ${order.length} modules → ${out} (${(bundle.length / 1024).toFixed(0)} KB)`);
