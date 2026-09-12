const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'admin.html'), 'utf8');
const source = fs.readFileSync(path.join(__dirname, '..', 'admin.js'), 'utf8');
assert.match(html, /id="productUrl"/);
assert.match(html, /id="copyProductUrl"/);
assert.match(html, /id="openProductUrl"/);
assert.match(source, /location\.origin\+'\/e\/'/);
assert.match(source, /navigator\.clipboard\.writeText/);
console.log('PASS: product editor exposes copyable C-end experience URL');
