// 북마크 코드를 줄여서 js/bookmarklet.js (앱 오른쪽 바에서 씀), bookmarklet/workline-import.min.txt, bookmarklet.html 에 넣어요.
// 실행: node bookmarklet/build.js   (terser 필요: npm i terser)
const fs = require('fs'), path = require('path');
const { minify } = require('terser');
const root = path.join(__dirname, '..');
minify(fs.readFileSync(path.join(__dirname, 'workline-import.js'), 'utf8'), { compress: true, mangle: true, format: { comments: false } }).then(r => {
  const line = 'javascript:' + encodeURIComponent(r.code);
  fs.writeFileSync(path.join(__dirname, 'workline-import.min.txt'), line + '\n');
  fs.writeFileSync(path.join(root, 'js/bookmarklet.js'), '/* 자동 생성: node bookmarklet/build.js */\nwindow.GIFT_BOOKMARKLET = ' + JSON.stringify(line) + ';\n');
  const esc = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const hp = path.join(root, 'bookmarklet.html');
  let h = fs.readFileSync(hp, 'utf8');
  h = h.replace(/href="javascript:[^"]*"/, () => 'href="' + esc(line) + '"').replace(/(<textarea id="t" readonly>)javascript:[^<]*(<\/textarea>)/, (m, a, b) => a + esc(line) + b);
  fs.writeFileSync(hp, h);
  console.log('ok', line.length);
});
