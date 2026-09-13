const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = fs.existsSync(path.join(__dirname, '..', 'admin.html')) ? path.join(__dirname, '..') : __dirname;
const html = fs.readFileSync(path.join(root, 'admin.html'), 'utf8');
const source = fs.readFileSync(path.join(root, 'admin.js'), 'utf8');

assert.match(html, /accept="[^"]*\.csv/);
assert.match(html, /导入 \.MD \/ CSV \/ 图片/);
assert.match(source, /\.csv\$\/i\.test\(file\.name\)/);
assert.match(source, /source:isCsv\?'CSV 文件':'Markdown 文件'/);
assert.match(source, /text\.trim\(\)/);

console.log('PASS: product knowledge accepts CSV files and keeps CSV text for context');
