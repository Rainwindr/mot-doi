// Build: gom JS + CSS thành một trang HTML duy nhất (dist/motdoi.html).
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

mkdirSync('dist', { recursive: true });
execFileSync('node', ['scripts/bundle.mjs', 'src/ui/main.js', 'dist/app.js'], { stdio: 'inherit' });
const js = readFileSync('dist/app.js', 'utf8');
const css = readFileSync('src/ui/styles.css', 'utf8');
const fonts = 'https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=IBM+Plex+Mono:wght@400;600&display=swap&subset=vietnamese';
const html = `<title>Một Đời</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="Game mô phỏng cuộc đời dạng chữ, song ngữ Việt/Anh, dành cho người từ 25 tuổi.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${fonts}">
<style>
${css}
</style>
<div id="app"></div>
<script>
${js.replace(/<\/script/gi, '<\\/script')}
</script>
`;
writeFileSync('dist/motdoi.html', html);
console.log(`dist/motdoi.html ${(html.length / 1024).toFixed(0)} KB`);
